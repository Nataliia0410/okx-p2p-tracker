-- Cards table: 8 cards with individual monthly limits
CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    bank VARCHAR(100),
    monthly_limit DECIMAL(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions from OKX history & orders screenshots
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    -- Types: 'buy_usdt', 'sell_usdt', 'deposit', 'withdrawal', 'cancel_order', 'internal'
    date TIMESTAMP NOT NULL,
    usdt_amount DECIMAL(12, 4),
    uah_amount DECIMAL(12, 2),
    price_per_usdt DECIMAL(10, 4),  -- UAH per USDT
    card_id INTEGER REFERENCES cards(id),
    counterparty VARCHAR(200),      -- buyer/seller nickname from P2P
    screenshot_source VARCHAR(50),  -- 'history' or 'orders'
    raw_text TEXT,                  -- original parsed text for debugging
    created_at TIMESTAMP DEFAULT NOW()
);

-- Monthly card usage tracking
CREATE TABLE IF NOT EXISTS card_monthly_usage (
    id SERIAL PRIMARY KEY,
    card_id INTEGER REFERENCES cards(id),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    used_amount DECIMAL(12, 2) DEFAULT 0,
    UNIQUE(card_id, year, month)
);

-- Uploaded screenshots log
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    screenshot_type VARCHAR(50),  -- 'history' or 'orders'
    parsed_count INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT NOW()
);
