from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import tempfile
import os
import shutil
import csv
import io

from .database import engine, get_db, Base
from .models import Card, Transaction, CardMonthlyUsage, Upload
from .parser import parse_screenshot

app = FastAPI(title="OKX P2P Tracker")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Cards ──────────────────────────────────────────────────────────────────

class CardCreate(BaseModel):
    name: str
    bank: Optional[str] = None
    monthly_limit: float

class CardUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    monthly_limit: Optional[float] = None
    is_active: Optional[bool] = None


@app.get("/api/cards")
def get_cards(db: Session = Depends(get_db)):
    now = datetime.now()
    cards = db.query(Card).filter(Card.is_active == True).all()
    result = []
    for card in cards:
        usage = db.query(CardMonthlyUsage).filter(
            CardMonthlyUsage.card_id == card.id,
            CardMonthlyUsage.year == now.year,
            CardMonthlyUsage.month == now.month,
        ).first()
        used = float(usage.used_amount) if usage else 0.0
        result.append({
            "id": card.id,
            "name": card.name,
            "bank": card.bank,
            "monthly_limit": float(card.monthly_limit),
            "used_amount": used,
            "remaining": float(card.monthly_limit) - used,
            "percent": round(used / float(card.monthly_limit) * 100, 1) if card.monthly_limit else 0,
        })
    return result


@app.post("/api/cards")
def create_card(data: CardCreate, db: Session = Depends(get_db)):
    card = Card(name=data.name, bank=data.bank, monthly_limit=data.monthly_limit)
    db.add(card)
    db.commit()
    db.refresh(card)
    return {"id": card.id, "name": card.name}


@app.put("/api/cards/{card_id}")
def update_card(card_id: int, data: CardUpdate, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(404, "Card not found")
    if data.name is not None:
        card.name = data.name
    if data.bank is not None:
        card.bank = data.bank
    if data.monthly_limit is not None:
        card.monthly_limit = data.monthly_limit
    if data.is_active is not None:
        card.is_active = data.is_active
    db.commit()
    return {"ok": True}


@app.put("/api/cards/{card_id}/usage")
def update_card_usage(
    card_id: int,
    amount: float,
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
):
    now = datetime.now()
    year = year or now.year
    month = month or now.month
    usage = db.query(CardMonthlyUsage).filter(
        CardMonthlyUsage.card_id == card_id,
        CardMonthlyUsage.year == year,
        CardMonthlyUsage.month == month,
    ).first()
    if usage:
        usage.used_amount = amount
    else:
        usage = CardMonthlyUsage(card_id=card_id, year=year, month=month, used_amount=amount)
        db.add(usage)
    db.commit()
    return {"ok": True}


# ── Screenshot upload & parsing ────────────────────────────────────────────

@app.post("/api/upload")
async def upload_screenshot(
    file: UploadFile = File(...),
    screenshot_type: str = Form(...),  # 'history' or 'orders'
    db: Session = Depends(get_db),
):
    if screenshot_type not in ("history", "orders"):
        raise HTTPException(400, "screenshot_type must be 'history' or 'orders'")

    suffix = os.path.splitext(file.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        parsed = parse_screenshot(tmp_path, screenshot_type)
    except Exception as e:
        raise HTTPException(500, f"Parsing failed: {e}")
    finally:
        os.unlink(tmp_path)

    saved = 0
    for item in parsed:
        try:
            date = datetime.strptime(item["date"], "%Y-%m-%d %H:%M")
        except Exception:
            continue

        if screenshot_type == "history":
            tx = Transaction(
                type=item.get("type", "other"),
                date=date,
                usdt_amount=item.get("usdt_amount"),
                screenshot_source="history",
                raw_text=str(item),
            )
        else:
            if item.get("status") == "cancelled":
                continue
            tx = Transaction(
                type=item.get("type", "other"),
                date=date,
                usdt_amount=item.get("usdt_amount"),
                uah_amount=item.get("uah_amount"),
                price_per_usdt=item.get("price_per_usdt"),
                counterparty=item.get("counterparty"),
                screenshot_source="orders",
                raw_text=str(item),
            )

        # Skip duplicates by checking same type+date+usdt_amount
        exists = db.query(Transaction).filter(
            Transaction.type == tx.type,
            Transaction.date == tx.date,
            Transaction.usdt_amount == tx.usdt_amount,
        ).first()
        if not exists:
            db.add(tx)
            saved += 1

    upload = Upload(filename=file.filename, screenshot_type=screenshot_type, parsed_count=saved)
    db.add(upload)
    db.commit()

    return {"parsed": len(parsed), "saved": saved}


# ── CSV upload ────────────────────────────────────────────────────────────

VALID_TYPES = {"sell_usdt", "buy_usdt", "deposit", "withdrawal", "cancel_order", "internal", "other"}

@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8-sig")  # handle BOM from Excel
    reader = csv.DictReader(io.StringIO(text))

    saved = 0
    errors = []

    for i, row in enumerate(reader, start=2):  # row 1 is header
        tx_type = row.get("type", "").strip()
        date_str = row.get("date", "").strip()
        usdt_raw = row.get("usdt_amount", "").strip()
        uah_raw = row.get("uah_amount", "").strip()
        price_raw = row.get("price_per_usdt", "").strip()
        counterparty = row.get("counterparty", "").strip() or None

        if tx_type not in VALID_TYPES:
            errors.append(f"Row {i}: unknown type '{tx_type}'")
            continue

        try:
            date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        except ValueError:
            errors.append(f"Row {i}: bad date '{date_str}' (expected YYYY-MM-DD HH:MM)")
            continue

        usdt = float(usdt_raw) if usdt_raw else None
        uah = float(uah_raw) if uah_raw else None
        price = float(price_raw) if price_raw else None

        # Deduplicate: same type + date + usdt_amount
        exists = db.query(Transaction).filter(
            Transaction.type == tx_type,
            Transaction.date == date,
            Transaction.usdt_amount == usdt,
        ).first()
        if exists:
            continue

        tx = Transaction(
            type=tx_type,
            date=date,
            usdt_amount=usdt,
            uah_amount=uah,
            price_per_usdt=price,
            counterparty=counterparty,
            screenshot_source="csv",
        )
        db.add(tx)
        saved += 1

    db.commit()
    return {"saved": saved, "errors": errors}


# ── Dashboard stats ────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(year: int = None, month: int = None, db: Session = Depends(get_db)):
    now = datetime.now()
    year = year or now.year
    month = month or now.month

    def filter_month(q):
        return q.filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )

    sells = filter_month(
        db.query(func.sum(Transaction.uah_amount)).filter(Transaction.type == "sell_usdt")
    ).scalar() or 0

    buys = filter_month(
        db.query(func.sum(Transaction.usdt_amount)).filter(Transaction.type == "buy_usdt")
    ).scalar() or 0

    deposits = filter_month(
        db.query(func.sum(Transaction.usdt_amount)).filter(Transaction.type == "deposit")
    ).scalar() or 0

    # Estimate buy cost: need avg price — get from orders
    buy_orders = filter_month(
        db.query(func.sum(Transaction.uah_amount)).filter(Transaction.type == "buy_usdt", Transaction.uah_amount != None)
    ).scalar() or 0

    profit = float(sells) - float(buy_orders)

    # Recent transactions
    recent = db.query(Transaction).order_by(Transaction.date.desc()).limit(20).all()
    recent_list = [
        {
            "id": t.id,
            "type": t.type,
            "date": t.date.isoformat(),
            "usdt_amount": float(t.usdt_amount) if t.usdt_amount else None,
            "uah_amount": float(t.uah_amount) if t.uah_amount else None,
            "price_per_usdt": float(t.price_per_usdt) if t.price_per_usdt else None,
            "counterparty": t.counterparty,
            "source": t.screenshot_source,
        }
        for t in recent
    ]

    return {
        "month": f"{year}-{month:02d}",
        "total_sold_uah": float(sells),
        "total_bought_usdt": float(buys),
        "total_bought_uah": float(buy_orders),
        "total_deposited_usdt": float(deposits),
        "estimated_profit_uah": profit,
        "recent_transactions": recent_list,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
