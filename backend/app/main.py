from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
import tempfile
import os
import shutil
import csv
import io

from .database import engine, get_db, Base
from .models import Card, Transaction, CardMonthlyUsage, Upload, User
from .parser import parse_screenshot
from .auth import (
    hash_password, verify_password, create_access_token,
    get_current_user,
)

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


# ── Auth ───────────────────────────────────────────────────────────────────

class AuthPayload(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(data: AuthPayload, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=data.email, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(str(user.id), user.email)
    return {"access_token": token, "token_type": "bearer", "email": user.email}


@app.post("/api/auth/login")
def login(data: AuthPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user.id), user.email)
    return {"access_token": token, "token_type": "bearer", "email": user.email}


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": str(current_user.id), "email": current_user.email}


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
def get_cards(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()
    cards = db.query(Card).filter(Card.user_id == current_user.id, Card.is_active == True).all()
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
def create_card(
    data: CardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = Card(user_id=current_user.id, name=data.name, bank=data.bank, monthly_limit=data.monthly_limit)
    db.add(card)
    db.commit()
    db.refresh(card)
    return {"id": card.id, "name": card.name}


@app.put("/api/cards/{card_id}")
def update_card(
    card_id: int,
    data: CardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = db.query(Card).filter(Card.id == card_id, Card.user_id == current_user.id).first()
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
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()
    year = year or now.year
    month = month or now.month
    card = db.query(Card).filter(Card.id == card_id, Card.user_id == current_user.id).first()
    if not card:
        raise HTTPException(404, "Card not found")
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


# ── CSV upload ────────────────────────────────────────────────────────────

VALID_TYPES = {"sell_usdt", "buy_usdt", "deposit", "withdrawal", "cancel_order", "internal", "other"}


@app.post("/api/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    saved = 0
    errors = []

    for i, row in enumerate(reader, start=2):
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

        exists = db.query(Transaction).filter(
            Transaction.user_id == current_user.id,
            Transaction.type == tx_type,
            Transaction.date == date,
            Transaction.usdt_amount == usdt,
        ).first()
        if exists:
            continue

        tx = Transaction(
            user_id=current_user.id,
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
def get_stats(
    year: int = None,
    month: int = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now()

    def apply_date_filter(q):
        q = q.filter(Transaction.user_id == current_user.id)
        if date_from and date_to:
            try:
                df = datetime.strptime(date_from, "%Y-%m-%d")
                dt = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                q = q.filter(Transaction.date >= df, Transaction.date <= dt)
            except ValueError:
                pass
        else:
            y = year or now.year
            m = month or now.month
            q = q.filter(
                extract("year", Transaction.date) == y,
                extract("month", Transaction.date) == m,
            )
        return q

    sells = apply_date_filter(
        db.query(func.sum(Transaction.uah_amount)).filter(Transaction.type == "sell_usdt")
    ).scalar() or 0

    buys = apply_date_filter(
        db.query(func.sum(Transaction.usdt_amount)).filter(Transaction.type == "buy_usdt")
    ).scalar() or 0

    deposits = apply_date_filter(
        db.query(func.sum(Transaction.usdt_amount)).filter(Transaction.type == "deposit")
    ).scalar() or 0

    buy_orders = apply_date_filter(
        db.query(func.sum(Transaction.uah_amount)).filter(
            Transaction.type == "buy_usdt",
            Transaction.uah_amount.isnot(None),
        )
    ).scalar() or 0

    profit = float(sells) - float(buy_orders)

    # Period label for display
    if date_from and date_to:
        period = f"{date_from} – {date_to}"
    else:
        y = year or now.year
        m = month or now.month
        period = f"{y}-{m:02d}"

    return {
        "period": period,
        "month": period,  # backwards compat
        "total_sold_uah": float(sells),
        "total_bought_usdt": float(buys),
        "total_bought_uah": float(buy_orders),
        "total_deposited_usdt": float(deposits),
        "estimated_profit_uah": profit,
    }


@app.get("/api/transactions")
def get_transactions(
    page: int = 1,
    limit: int = 20,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    tx_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    if date_from and date_to:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d")
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            q = q.filter(Transaction.date >= df, Transaction.date <= dt)
        except ValueError:
            pass

    if tx_type:
        q = q.filter(Transaction.type == tx_type)

    total = q.count()
    offset = (page - 1) * limit
    rows = q.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "items": [
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
            for t in rows
        ],
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
