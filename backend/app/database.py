from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import ssl
import urllib.parse as _up
from dotenv import load_dotenv

load_dotenv()

def _build_engine():
    url = os.getenv("DATABASE_URL", "")

    # Parse and clean query params not supported by pg8000
    parsed = _up.urlparse(url)
    qs = dict(_up.parse_qsl(parsed.query))
    qs.pop("channel_binding", None)
    qs.pop("sslmode", None)

    # Rebuild URL with pg8000 dialect
    clean = parsed._replace(
        scheme="postgresql+pg8000",
        query=_up.urlencode(qs),
    ).geturl()

    # pg8000 needs ssl context passed via connect_args
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    return create_engine(clean, connect_args={"ssl_context": ctx}, pool_pre_ping=True)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
