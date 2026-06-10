from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    transactions = relationship("Transaction", back_populates="user")
    cards = relationship("Card", back_populates="user")


class Card(Base):
    __tablename__ = "cards"
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False)
    bank = Column(String(100))
    monthly_limit = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    monthly_usages = relationship("CardMonthlyUsage", back_populates="card")
    user = relationship("User", back_populates="cards")


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    type = Column(String(50), nullable=False)
    date = Column(DateTime, nullable=False)
    usdt_amount = Column(Numeric(12, 4))
    uah_amount = Column(Numeric(12, 2))
    price_per_usdt = Column(Numeric(10, 4))
    card_id = Column(Integer, ForeignKey("cards.id"))
    counterparty = Column(String(200))
    screenshot_source = Column(String(50))
    raw_text = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    user = relationship("User", back_populates="transactions")


class CardMonthlyUsage(Base):
    __tablename__ = "card_monthly_usage"
    __table_args__ = (UniqueConstraint("card_id", "year", "month"),)
    id = Column(Integer, primary_key=True)
    card_id = Column(Integer, ForeignKey("cards.id"))
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    used_amount = Column(Numeric(12, 2), default=0)
    card = relationship("Card", back_populates="monthly_usages")


class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True)
    filename = Column(String(255))
    screenshot_type = Column(String(50))
    parsed_count = Column(Integer, default=0)
    uploaded_at = Column(DateTime, server_default=func.now())
