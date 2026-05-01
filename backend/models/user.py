from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    JSON,
    Float,
    ForeignKey,
)
from datetime import datetime
from ..core.database import Base
import enum


class UserRole(enum.Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))

    role = Column(String(20), default="viewer")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    alert_keywords = Column(JSON, default=lambda: [])
    alert_sources = Column(JSON, default=lambda: [])
    alert_iocs = Column(JSON, default=lambda: [])

    notification_preferences = Column(JSON, default=lambda: {})

    last_login = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    alert_type = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)

    source_id = Column(Integer, ForeignKey("sources.id"))
    source_name = Column(String(255))

    entity_type = Column(String(50))
    entity_id = Column(Integer)
    entity_value = Column(String(500))

    severity = Column(String(20), default="medium")
    confidence = Column(Float, default=0.5)

    matched_keywords = Column(JSON, default=lambda: [])
    meta_data = Column(JSON, default=lambda: {})

    is_read = Column(Boolean, default=False, index=True)
    is_dismissed = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    read_at = Column(DateTime)
