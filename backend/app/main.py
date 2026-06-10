from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, text
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import tempfile
import os
import shutil
import csv
import io

from .database import engine, get_db, Base
from .models import Card, Transaction, CardMonthlyUsage, Upload, User, SalaryEntry, WithdrawalEntry
from .parser import parse_screenshot
from .auth import hash_password, verify_password, create_access_token, get_current_user

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
def get_cards(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
            "id": card.id, "name": card.name, "bank": card.bank,
            "monthly_limit": float(card.monthly_limit), "used_amount": used,
            "remaining": float(card.monthly_limit) - used,
            "percent": round(used / float(card.monthly_limit) * 100, 1) if card.monthly_limit else 0,
        })
    return result


@app.post("/api/cards")
def create_card(data: CardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card = Card(user_id=current_user.id, name=data.name, bank=data.bank, monthly_limit=data.monthly_limit)
    db.add(card); db.commit(); db.refresh(card)
    return {"id": card.id, "name": card.name}


@app.put("/api/cards/{card_id}")
def update_card(card_id: int, data: CardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card = db.query(Card).filter(Card.id == card_id, Card.user_id == current_user.id).first()
    if not card:
        raise HTTPException(404, "Card not found")
    if data.name is not None: card.name = data.name
    if data.bank is not None: card.bank = data.bank
    if data.monthly_limit is not None: card.monthly_limit = data.monthly_limit
    if data.is_active is not None: card.is_active = data.is_active
    db.commit()
    return {"ok": True}


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    card = db.query(Card).filter(Card.id == card_id, Card.user_id == current_user.id).first()
    if not card:
        raise HTTPException(404, "Card not found")
    db.query(CardMonthlyUsage).filter(CardMonthlyUsage.card_id == card_id).delete()
    db.delete(card); db.commit()
    return {"ok": True}


@app.put("/api/cards/{card_id}/usage")
def update_card_usage(card_id: int, amount: float, year: Optional[int] = None,
    month: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now()
    year = year or now.year; month = month or now.month
    card = db.query(Card).filter(Card.id == card_id, Card.user_id == current_user.id).first()
    if not card: raise HTTPException(404, "Card not found")
    usage = db.query(CardMonthlyUsage).filter(
        CardMonthlyUsage.card_id == card_id,
        CardMonthlyUsage.year == year, CardMonthlyUsage.month == month).first()
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
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    content = await file.read()
    csv_text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(csv_text))
    saved = 0; skipped = 0; errors = []
    for i, row in enumerate(reader, start=2):
        tx_type = row.get("type", "").strip()
        date_str = row.get("date", "").strip()
        usdt_raw = row.get("usdt_amount", "").strip()
        uah_raw = row.get("uah_amount", "").strip()
        price_raw = row.get("price_per_usdt", "").strip()
        counterparty = row.get("counterparty", "").strip() or None
        if tx_type not in VALID_TYPES:
            errors.append(f"Row {i}: unknown type '{tx_type}'"); continue
        try:
            date = datetime.strptime(date_str, "%Y-%m-%d %H:%M")
        except ValueError:
            errors.append(f"Row {i}: bad date '{date_str}'"); continue
        usdt = float(usdt_raw) if usdt_raw else None
        uah = float(uah_raw) if uah_raw else None
        price = float(price_raw) if price_raw else None
        exists = db.query(Transaction).filter(
            Transaction.user_id == current_user.id, Transaction.type == tx_type,
            Transaction.date == date, Transaction.usdt_amount == usdt).first()
        if exists: skipped += 1; continue
        db.add(Transaction(user_id=current_user.id, type=tx_type, date=date,
            usdt_amount=usdt, uah_amount=uah, price_per_usdt=price,
            counterparty=counterparty, screenshot_source="csv"))
        saved += 1
    db.commit()
    return {"saved": saved, "skipped": skipped, "errors": errors}


# ── Helper: parse date range ───────────────────────────────────────────────

def _date_range(date_from: Optional[str], date_to: Optional[str], year: Optional[int], month: Optional[int]):
    """Returns (df, dt) datetime objects for filtering."""
    now = datetime.now()
    if date_from and date_to:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d")
            dt = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            return df, dt
        except ValueError:
            pass
    y = year or now.year
    m = month or now.month
    from calendar import monthrange
    last_day = monthrange(y, m)[1]
    return datetime(y, m, 1), datetime(y, m, last_day, 23, 59, 59)


def _apply_range(q, df, dt):
    return q.filter(Transaction.date >= df, Transaction.date <= dt)


def _period_label(date_from, date_to, year, month):
    now = datetime.now()
    if date_from and date_to:
        return f"{date_from} – {date_to}"
    y = year or now.year
    m = month or now.month
    return f"{y}-{m:02d}"


# ── Stats ─────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def get_stats(year: int = None, month: int = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    df, dt = _date_range(date_from, date_to, year, month)

    base = db.query(Transaction).filter(Transaction.user_id == current_user.id)

    def agg(tx_type, col):
        return _apply_range(base.filter(Transaction.type == tx_type), df, dt)\
            .with_entities(func.sum(col)).scalar() or 0

    def cnt(tx_type):
        return _apply_range(base.filter(Transaction.type == tx_type), df, dt).count()

    sell_uah = float(agg("sell_usdt", Transaction.uah_amount))
    sell_usdt = float(agg("sell_usdt", Transaction.usdt_amount))
    buy_uah = float(agg("buy_usdt", Transaction.uah_amount))
    buy_usdt = float(agg("buy_usdt", Transaction.usdt_amount))
    deposit_usdt = float(agg("deposit", Transaction.usdt_amount))
    withdrawal_usdt = float(agg("withdrawal", Transaction.usdt_amount))
    buy_count = cnt("buy_usdt")
    sell_count = cnt("sell_usdt")

    avg_buy = round(buy_uah / buy_usdt, 4) if buy_usdt else 0
    avg_sell = round(sell_uah / sell_usdt, 4) if sell_usdt else 0
    spread = round(avg_sell - avg_buy, 4) if (avg_buy and avg_sell) else 0

    # Global avg buy rate (all-time, not filtered) for correct profit
    global_buy_uah = db.query(func.sum(Transaction.uah_amount))\
        .filter(Transaction.user_id == current_user.id, Transaction.type == "buy_usdt")\
        .scalar() or 0
    global_buy_usdt = db.query(func.sum(Transaction.usdt_amount))\
        .filter(Transaction.user_id == current_user.id, Transaction.type == "buy_usdt")\
        .scalar() or 0
    global_avg_buy = float(global_buy_uah) / float(global_buy_usdt) if global_buy_usdt else 0

    # Correct profit: sell_revenue - (sold_usdt × global_avg_buy_rate)
    profit_correct = round(sell_uah - sell_usdt * global_avg_buy, 2) if global_avg_buy else 0
    profit_pct = round(profit_correct / (sell_usdt * global_avg_buy) * 100, 2) \
        if (global_avg_buy and sell_usdt) else 0

    period = _period_label(date_from, date_to, year, month)

    # Cancel rate (within date range)
    cancel_count = cnt("cancel_order")
    total_p2p = buy_count + sell_count + cancel_count
    cancel_rate = round(cancel_count / total_p2p * 100, 1) if total_p2p else 0

    # Current balance (all-time, ignores date filter)
    at_deposit = float(db.query(func.sum(Transaction.usdt_amount))
        .filter(Transaction.user_id == current_user.id, Transaction.type == "deposit")
        .scalar() or 0)
    at_buy_usdt = float(global_buy_usdt)
    at_sell_usdt = float(db.query(func.sum(Transaction.usdt_amount))
        .filter(Transaction.user_id == current_user.id, Transaction.type == "sell_usdt")
        .scalar() or 0)
    at_withdrawal = float(db.query(func.sum(Transaction.usdt_amount))
        .filter(Transaction.user_id == current_user.id, Transaction.type == "withdrawal")
        .scalar() or 0)
    at_salary = float(db.query(func.sum(SalaryEntry.usdt_amount))
        .filter(SalaryEntry.user_id == current_user.id)
        .scalar() or 0)
    at_manual_withdrawal = float(db.query(func.sum(WithdrawalEntry.usdt_amount))
        .filter(WithdrawalEntry.user_id == current_user.id)
        .scalar() or 0)
    current_balance_usdt = round(
        at_deposit + at_buy_usdt - at_sell_usdt - at_withdrawal - at_salary - at_manual_withdrawal, 4
    )

    return {
        "period": period,
        "month": period,
        "total_sold_uah": sell_uah,
        "total_bought_uah": buy_uah,
        "total_sold_usdt": sell_usdt,
        "total_bought_usdt": buy_usdt,
        "total_deposited_usdt": deposit_usdt,
        "total_withdrawn_usdt": withdrawal_usdt,
        "buy_count": buy_count,
        "sell_count": sell_count,
        "avg_buy_rate": avg_buy,
        "avg_sell_rate": avg_sell,
        "spread": spread,
        "global_avg_buy_rate": round(global_avg_buy, 4),
        "estimated_profit_uah": profit_correct,
        "profit_pct": profit_pct,
        "cancel_count": cancel_count,
        "cancel_rate": cancel_rate,
        "current_balance_usdt": current_balance_usdt,
    }


# ── Transactions (paginated) ───────────────────────────────────────────────

@app.get("/api/transactions")
def get_transactions(page: int = 1, limit: int = 20,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    tx_type: Optional[str] = None,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

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
    rows = q.order_by(Transaction.date.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "total": total, "page": page, "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
        "items": [{
            "id": t.id, "type": t.type, "date": t.date.isoformat(),
            "usdt_amount": float(t.usdt_amount) if t.usdt_amount else None,
            "uah_amount": float(t.uah_amount) if t.uah_amount else None,
            "price_per_usdt": float(t.price_per_usdt) if t.price_per_usdt else None,
            "counterparty": t.counterparty, "source": t.screenshot_source,
        } for t in rows],
    }


# ── Monthly analytics ──────────────────────────────────────────────────────

@app.get("/api/analytics/monthly")
def monthly_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Per-month breakdown: buy/sell USDT, rates, spread, profit, salary, withdrawal."""

    # Global avg buy rate for correct profit calc
    g_buy_uah = float(db.query(func.sum(Transaction.uah_amount))
        .filter(Transaction.user_id == current_user.id, Transaction.type == "buy_usdt")
        .scalar() or 0)
    g_buy_usdt = float(db.query(func.sum(Transaction.usdt_amount))
        .filter(Transaction.user_id == current_user.id, Transaction.type == "buy_usdt")
        .scalar() or 0)
    global_avg_buy = g_buy_uah / g_buy_usdt if g_buy_usdt else 0

    # Get all months that have transactions
    rows = db.execute(
        text("""
        SELECT
            EXTRACT(YEAR  FROM date)::int AS yr,
            EXTRACT(MONTH FROM date)::int AS mo,
            SUM(CASE WHEN type='buy_usdt'  THEN usdt_amount ELSE 0 END) AS buy_usdt,
            SUM(CASE WHEN type='buy_usdt'  THEN uah_amount  ELSE 0 END) AS buy_uah,
            SUM(CASE WHEN type='sell_usdt' THEN usdt_amount ELSE 0 END) AS sell_usdt,
            SUM(CASE WHEN type='sell_usdt' THEN uah_amount  ELSE 0 END) AS sell_uah,
            SUM(CASE WHEN type='deposit'   THEN usdt_amount ELSE 0 END) AS deposit_usdt,
            SUM(CASE WHEN type='withdrawal'THEN usdt_amount ELSE 0 END) AS withdrawal_usdt,
            COUNT(CASE WHEN type='buy_usdt'  THEN 1 END) AS buy_count,
            COUNT(CASE WHEN type='sell_usdt' THEN 1 END) AS sell_count
        FROM transactions
        WHERE user_id = :uid
        GROUP BY yr, mo
        ORDER BY yr, mo
        """),
        {"uid": str(current_user.id)},
    ).fetchall()

    # Salary entries for this user
    salaries = {
        (s.year, s.month): float(s.usdt_amount)
        for s in db.query(SalaryEntry).filter(SalaryEntry.user_id == current_user.id).all()
    }

    # Manual withdrawal entries for this user
    manual_withdrawals = {
        (w.year, w.month): float(w.usdt_amount)
        for w in db.query(WithdrawalEntry).filter(WithdrawalEntry.user_id == current_user.id).all()
    }

    MONTH_NAMES = {
        "uk": ["Січень","Лютий","Березень","Квітень","Травень","Червень",
               "Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"],
        "en": ["January","February","March","April","May","June",
               "July","August","September","October","November","December"],
        "ru": ["Январь","Февраль","Март","Апрель","Май","Июнь",
               "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"],
    }

    result = []
    for r in rows:
        yr, mo = r[0], r[1]
        buy_usdt, buy_uah = float(r[2] or 0), float(r[3] or 0)
        sell_usdt, sell_uah = float(r[4] or 0), float(r[5] or 0)
        deposit_usdt = float(r[6] or 0)
        withdrawal_usdt = float(r[7] or 0)
        buy_count, sell_count = int(r[8] or 0), int(r[9] or 0)

        salary = salaries.get((yr, mo), 0)
        manual_withdrawal = manual_withdrawals.get((yr, mo), 0)
        total_withdrawal = withdrawal_usdt + manual_withdrawal
        total_in = buy_usdt + salary + deposit_usdt

        avg_buy = round(buy_uah / buy_usdt, 4) if buy_usdt else 0
        avg_sell = round(sell_uah / sell_usdt, 4) if sell_usdt else 0
        spread = round(avg_sell - avg_buy, 4) if (avg_buy and avg_sell) else 0

        profit = round(sell_uah - sell_usdt * global_avg_buy, 2) if global_avg_buy else 0
        profit_pct = round(profit / (sell_usdt * global_avg_buy) * 100, 2) \
            if (global_avg_buy and sell_usdt) else 0
        roi_pct = round(profit / (total_in * global_avg_buy) * 100, 2) \
            if (total_in and global_avg_buy) else 0

        result.append({
            "year": yr, "month": mo,
            "month_names": {lang: f"{MONTH_NAMES[lang][mo-1]} {yr}" for lang in MONTH_NAMES},
            "buy_usdt": buy_usdt, "buy_uah": buy_uah,
            "sell_usdt": sell_usdt, "sell_uah": sell_uah,
            "deposit_usdt": deposit_usdt,
            "withdrawal_usdt": total_withdrawal,
            "manual_withdrawal_usdt": manual_withdrawal,
            "buy_count": buy_count, "sell_count": sell_count,
            "salary_usdt": salary,
            "total_in_usdt": round(total_in, 4),
            "avg_buy_rate": avg_buy,
            "avg_sell_rate": avg_sell,
            "spread": spread,
            "spread_ok": spread >= 0.90,
            "profit_uah": profit,
            "profit_pct": profit_pct,
            "roi_pct": roi_pct,
        })

    # Totals row
    if result:
        total_buy_usdt = sum(r["buy_usdt"] for r in result)
        total_buy_uah  = sum(r["buy_uah"]  for r in result)
        total_sell_usdt = sum(r["sell_usdt"] for r in result)
        total_sell_uah  = sum(r["sell_uah"]  for r in result)
        total_salary    = sum(r["salary_usdt"] for r in result)
        total_deposit   = sum(r["deposit_usdt"] for r in result)
        total_withdrawal = sum(r["withdrawal_usdt"] for r in result)
        total_manual_withdrawal = sum(r["manual_withdrawal_usdt"] for r in result)
        t_avg_buy  = round(total_buy_uah / total_buy_usdt, 4) if total_buy_usdt else 0
        t_avg_sell = round(total_sell_uah / total_sell_usdt, 4) if total_sell_usdt else 0
        t_spread   = round(t_avg_sell - t_avg_buy, 4) if (t_avg_buy and t_avg_sell) else 0
        t_profit   = round(total_sell_uah - total_sell_usdt * global_avg_buy, 2) if global_avg_buy else 0
        t_profit_pct = round(t_profit / (total_sell_usdt * global_avg_buy) * 100, 2) \
            if (global_avg_buy and total_sell_usdt) else 0
        t_roi_pct = round(t_profit / (total_buy_usdt + total_salary + total_deposit) / global_avg_buy * 100, 2) \
            if ((total_buy_usdt + total_salary + total_deposit) and global_avg_buy) else 0
    else:
        total_buy_usdt = total_buy_uah = total_sell_usdt = total_sell_uah = 0
        total_salary = total_deposit = total_withdrawal = total_manual_withdrawal = 0
        t_avg_buy = t_avg_sell = t_spread = t_profit = t_profit_pct = t_roi_pct = 0

    return {
        "global_avg_buy_rate": round(global_avg_buy, 4),
        "rows": result,
        "totals": {
            "buy_usdt": total_buy_usdt, "buy_uah": total_buy_uah,
            "sell_usdt": total_sell_usdt, "sell_uah": total_sell_uah,
            "salary_usdt": total_salary, "deposit_usdt": total_deposit,
            "withdrawal_usdt": total_withdrawal,
            "manual_withdrawal_usdt": total_manual_withdrawal,
            "total_in_usdt": round(total_buy_usdt + total_salary + total_deposit, 4),
            "avg_buy_rate": t_avg_buy, "avg_sell_rate": t_avg_sell,
            "spread": t_spread, "profit_uah": t_profit, "profit_pct": t_profit_pct,
            "roi_pct": t_roi_pct,
        },
    }


# ── Salary entries ─────────────────────────────────────────────────────────

class SalaryPayload(BaseModel):
    year: int
    month: int
    usdt_amount: float
    note: Optional[str] = None


@app.get("/api/salary")
def get_salaries(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.query(SalaryEntry).filter(SalaryEntry.user_id == current_user.id)\
        .order_by(SalaryEntry.year, SalaryEntry.month).all()
    return [{"id": r.id, "year": r.year, "month": r.month,
             "usdt_amount": float(r.usdt_amount), "note": r.note} for r in rows]


@app.put("/api/salary")
def upsert_salary(data: SalaryPayload, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    entry = db.query(SalaryEntry).filter(
        SalaryEntry.user_id == current_user.id,
        SalaryEntry.year == data.year, SalaryEntry.month == data.month).first()
    if entry:
        entry.usdt_amount = data.usdt_amount
        entry.note = data.note
    else:
        entry = SalaryEntry(user_id=current_user.id, year=data.year, month=data.month,
            usdt_amount=data.usdt_amount, note=data.note)
        db.add(entry)
    db.commit()
    return {"ok": True}


@app.delete("/api/salary/{entry_id}")
def delete_salary(entry_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    entry = db.query(SalaryEntry).filter(
        SalaryEntry.id == entry_id, SalaryEntry.user_id == current_user.id).first()
    if not entry: raise HTTPException(404, "Not found")
    db.delete(entry); db.commit()
    return {"ok": True}


# ── Withdrawal entries ─────────────────────────────────────────────────────

class WithdrawalPayload(BaseModel):
    year: int
    month: int
    usdt_amount: float
    note: Optional[str] = None


@app.put("/api/withdrawals")
def upsert_withdrawal(data: WithdrawalPayload, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    entry = db.query(WithdrawalEntry).filter(
        WithdrawalEntry.user_id == current_user.id,
        WithdrawalEntry.year == data.year, WithdrawalEntry.month == data.month).first()
    if entry:
        entry.usdt_amount = data.usdt_amount
        entry.note = data.note
    else:
        entry = WithdrawalEntry(user_id=current_user.id, year=data.year, month=data.month,
            usdt_amount=data.usdt_amount, note=data.note)
        db.add(entry)
    db.commit()
    return {"ok": True}


@app.delete("/api/withdrawals/{entry_id}")
def delete_withdrawal(entry_id: int, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    entry = db.query(WithdrawalEntry).filter(
        WithdrawalEntry.id == entry_id, WithdrawalEntry.user_id == current_user.id).first()
    if not entry: raise HTTPException(404, "Not found")
    db.delete(entry); db.commit()
    return {"ok": True}


# ── Manual transaction ────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    type: str
    date: str  # "YYYY-MM-DD HH:MM"
    usdt_amount: Optional[float] = None
    uah_amount: Optional[float] = None
    price_per_usdt: Optional[float] = None
    counterparty: Optional[str] = None


@app.post("/api/transactions")
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)):
    if data.type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid type: {data.type}")
    try:
        date = datetime.strptime(data.date, "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(400, "Bad date format, use YYYY-MM-DD HH:MM")
    tx = Transaction(user_id=current_user.id, type=data.type, date=date,
        usdt_amount=data.usdt_amount, uah_amount=data.uah_amount,
        price_per_usdt=data.price_per_usdt, counterparty=data.counterparty,
        screenshot_source="manual")
    db.add(tx); db.commit(); db.refresh(tx)
    return {"id": tx.id}


# ── Counterparty analytics ────────────────────────────────────────────────

@app.get("/api/analytics/counterparties")
def get_counterparties(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = db.execute(text("""
        SELECT counterparty,
               COUNT(*) as deal_count,
               SUM(usdt_amount) as total_usdt,
               AVG(price_per_usdt) as avg_price,
               MAX(date) as last_date,
               COUNT(CASE WHEN type='sell_usdt' THEN 1 END) as sell_count,
               COUNT(CASE WHEN type='buy_usdt' THEN 1 END) as buy_count
        FROM transactions
        WHERE user_id = :uid AND counterparty IS NOT NULL AND counterparty != ''
          AND type IN ('sell_usdt', 'buy_usdt')
        GROUP BY counterparty
        ORDER BY deal_count DESC
        LIMIT 30
    """), {"uid": str(current_user.id)}).fetchall()
    return [
        {
            "counterparty": r[0],
            "deal_count": int(r[1]),
            "total_usdt": round(float(r[2] or 0), 2),
            "avg_price": round(float(r[3] or 0), 4),
            "last_date": str(r[4])[:10] if r[4] else None,
            "sell_count": int(r[5]),
            "buy_count": int(r[6]),
        }
        for r in rows
    ]


# ── Health ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}
