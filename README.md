# OKX P2P Tracker

## Налаштування

### 1. Скопіюй .env файл
```bash
cp .env.example .env
```
Відкрий `.env` і встав:
- `DATABASE_URL` — connection string з Neon (Settings → Connection string)
- `ANTHROPIC_API_KEY` — API ключ з console.anthropic.com

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # або venv\Scripts\activate на Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Backend запуститься на http://localhost:8000

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Дашборд відкриється на http://localhost:5173

## Використання
1. Вкладка **Карти** — додай свої 8 карт з лімітами
2. Вкладка **Завантажити скрін** — загружай скріни з OKX
3. Вкладка **Дашборд** — дивись прогрес
