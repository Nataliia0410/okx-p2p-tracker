from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Strip channel_binding — not supported by psycopg2
_url = os.getenv("DATABASE_URL", "")
if "channel_binding" in _url:
    import urllib.parse as _up
    _parsed = _up.urlparse(_url)
    _qs = {k: v for k, v in _up.parse_qsl(_parsed.query) if k != "channel_binding"}
    _url = _parsed._replace(query=_up.urlencode(_qs)).geturl()
DATABASE_URL = _url

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
