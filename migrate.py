"""
One-time migration script:
1. Create users table
2. Add user_id to transactions, cards
3. Create the owner user account
4. Assign all existing transactions/cards to that user
"""
import sys
import os
import ssl
import urllib.parse as _up
import uuid

# Load env
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import pg8000.native

DATABASE_URL = os.getenv("DATABASE_URL", "")
EMAIL = "nataliiamakarchuk0410@gmail.com"
PASSWORD = "makarchuk0410"

# Parse connection
parsed = _up.urlparse(DATABASE_URL)
host = parsed.hostname
port = parsed.port or 5432
database = parsed.path.lstrip("/")
user = parsed.username
password = parsed.password

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

conn = pg8000.native.Connection(
    host=host, port=port, database=database, user=user, password=password, ssl_context=ssl_ctx
)

print("Connected to Neon.")

# 1. Create users table
conn.run("""
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
)
""")
print("✓ Table users ready.")

# 2. Add user_id to transactions
try:
    conn.run("ALTER TABLE transactions ADD COLUMN user_id UUID REFERENCES users(id)")
    print("✓ Added user_id to transactions.")
except Exception as e:
    if "already exists" in str(e):
        print("  user_id already exists in transactions, skipping.")
    else:
        raise

# 3. Add user_id to cards
try:
    conn.run("ALTER TABLE cards ADD COLUMN user_id UUID REFERENCES users(id)")
    print("✓ Added user_id to cards.")
except Exception as e:
    if "already exists" in str(e):
        print("  user_id already exists in cards, skipping.")
    else:
        raise

# 4. Create owner user with bcrypt password
import bcrypt as _bcrypt
hashed = _bcrypt.hashpw(PASSWORD.encode(), _bcrypt.gensalt()).decode()

existing = conn.run("SELECT id FROM users WHERE email = :email", email=EMAIL)
if existing:
    user_id = existing[0][0]
    print(f"  User already exists: {user_id}")
else:
    user_id = str(uuid.uuid4())
    conn.run(
        "INSERT INTO users (id, email, hashed_password) VALUES (:id, :email, :hp)",
        id=user_id, email=EMAIL, hp=hashed,
    )
    print(f"✓ Created user {EMAIL} with id={user_id}")

# 5. Assign all existing transactions to this user
result = conn.run("UPDATE transactions SET user_id = :uid WHERE user_id IS NULL", uid=user_id)
print(f"✓ Assigned existing transactions to user.")

# 6. Assign all existing cards to this user
conn.run("UPDATE cards SET user_id = :uid WHERE user_id IS NULL", uid=user_id)
print(f"✓ Assigned existing cards to user.")

print("\nMigration complete!")
conn.close()
