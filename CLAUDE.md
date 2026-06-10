# OKX P2P Tracker — Project Context

## Links
- **Frontend:** https://okx-p2p-frontend.vercel.app
- **Backend:** https://okx-p2p-backend.vercel.app
- **GitHub:** https://github.com/Nataliia0410/okx-p2p-tracker

## Stack
- **Frontend:** React + Vite → `frontend/`, deployed on Vercel
- **Backend:** FastAPI (Python) → `backend/`, Vercel entry point: `backend/api/index.py`
- **DB:** Neon PostgreSQL, driver: `pg8000` (NOT psycopg2)
- **Auth:** JWT via `python-jose` + `bcrypt` directly (no passlib — incompatible with bcrypt 5.x)
- **Token storage:** `localStorage('okx_token')`, `Authorization: Bearer <token>`

## Frontend structure (`frontend/src/`)
```
App.jsx           ThemeProvider > LangProvider > AuthProvider > AppInner
AuthContext.jsx   login/register/logout → /api/auth/*
ThemeContext.jsx  dark/light, persisted in localStorage('okx_theme')
LangContext.jsx   uk/en/ru translations T[lang], persisted in localStorage('okx_lang')
api.js            fetch wrapper — auto-adds Bearer token, handles FormData
pages/Auth.jsx    Login + Register (mode state)
pages/Dashboard.jsx  date filter, stat cards (2 rows), monthly table, paginated tx table
pages/Cards.jsx   card limits tracker
pages/Upload.jsx  CSV upload
```

## API endpoints (all require JWT except /auth/* and /health)
```
POST /api/auth/register
POST /api/auth/login           → { access_token, email }
GET  /api/auth/me

GET  /api/stats                ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
                               → avg_buy_rate, avg_sell_rate, spread, spread indicator,
                                 buy_count, sell_count, estimated_profit_uah (global formula),
                                 profit_pct, total_withdrawn_usdt
GET  /api/transactions         ?date_from&date_to&page&limit&tx_type → paginated
GET  /api/analytics/monthly   → per-month rows + totals (spread, profit, salary, withdrawal)
GET  /api/salary               list salary entries
PUT  /api/salary               { year, month, usdt_amount, note } — upsert
DELETE /api/salary/{id}

GET/POST  /api/cards
PUT       /api/cards/{id}
PUT       /api/cards/{id}/usage
POST      /api/upload-csv      multipart CSV
GET       /api/health          → {"status":"ok"}
```

## Database tables
```sql
users            id UUID PK, email UNIQUE, hashed_password
transactions     id, user_id UUID FK, type, date, usdt_amount, uah_amount, price_per_usdt, counterparty, screenshot_source
cards            id, user_id UUID FK, name, bank, monthly_limit, is_active
card_monthly_usage  card_id, year, month, used_amount  UNIQUE(card_id,year,month)
salary_entries   id, user_id UUID FK, year, month, usdt_amount, note  UNIQUE(user_id,year,month)
uploads          filename, screenshot_type, parsed_count
```

**Transaction types:** `sell_usdt` `buy_usdt` `deposit` `withdrawal` `cancel_order` `internal` `other`

## Owner account
- **Email:** `nataliiamakarchuk0410@gmail.com`
- **Password:** `makarchuk0410`
- ~240 transactions loaded (Dec 2025 – Jun 2026) linked to this account
- Salary 2200 USDT pre-seeded for April 2026 in `salary_entries`

## Profit formula (important!)
```
Profit = sell_UAH − (sold_USDT × global_avg_buy_rate)
```
`global_avg_buy_rate` = total UAH spent on all BUY / total USDT bought (all-time, ignores date filter).  
Current value: **~43.05 UAH/USDT**

**Spread rule:** spread ≥ 0.90 ₴ = 🟢 do the cycle | spread < 0.90 ₴ = 🔴 skip

## Vercel env vars (backend)
- `DATABASE_URL` — Neon connection string (pg8000 driver strips `channel_binding` and `sslmode` params internally)
- `JWT_SECRET` — `okx-p2p-jwt-secret-2026-nataliiamakarchuk`

## CSV format for upload
```csv
type,date,usdt_amount,uah_amount,price_per_usdt,counterparty
sell_usdt,2026-06-08 07:07,21.64,1000,46.19,elektrod
buy_usdt,2026-06-04 00:29,570,24971.7,43.81,DmytroK
deposit,2026-06-06 01:53,1748,,,
```

## Key decisions & gotchas
- pg8000 used instead of psycopg2 — Neon requires SSL, psycopg2 had `channel_binding` issues
- bcrypt 5.x incompatible with passlib — using `bcrypt` directly in `auth.py`
- SQLAlchemy 2.x raw SQL requires `text()` wrapper
- Vercel env vars must be set with `printf '%s' 'value' | vercel env add KEY production` to avoid shell escaping corruption
- Frontend `api.js` does NOT set `Content-Type` for FormData (lets browser set boundary)
- Monthly analytics uses `text()` raw SQL for GROUP BY year/month aggregation
