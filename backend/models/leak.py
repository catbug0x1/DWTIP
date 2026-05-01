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
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class LeakStatus(enum.Enum):
    NEW = "new"
    VERIFIED = "verified"
    FALSE_POSITIVE = "false_positive"
    EXPIRED = "expired"


class LeakSeverity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Leak(Base):
    __tablename__ = "leaks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)

    victim_name = Column(String(255))
    victim_industry = Column(String(100))
    victim_country = Column(String(100))
    victim_website = Column(String(500))
    victim_size = Column(String(50))

    actor_id = Column(Integer, ForeignKey("threat_actors.id"))
    actor_name = Column(String(255))

    source_id = Column(Integer, ForeignKey("sources.id"))
    source_url = Column(String(1000))

    status = Column(String(20), default="new")
    severity = Column(String(20), default="medium")
    confidence = Column(Float, default=0.5)

    data_types = Column(JSON, default=lambda: [])
    data_size = Column(String(100))
    record_count = Column(Integer)

    published_date = Column(DateTime)
    deadline_date = Column(DateTime)

    asking_price = Column(String(100))
    currency = Column(String(20))

    tags = Column(JSON, default=lambda: [])
    extracted_iocs = Column(JSON, default=lambda: [])

    screenshot_url = Column(String(1000))

    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    threat_actor = relationship("ThreatActor", back_populates="leaks")
    source = relationship("Source", back_populates="leaks")
    iocs = relationship("IOC", back_populates="leak")


class LeakTag(Base):
    __tablename__ = "leak_tags"

    id = Column(Integer, primary_key=True, index=True)
    leak_id = Column(Integer, ForeignKey("leaks.id"), nullable=False)
    tag = Column(String(100), nullable=False)
    source = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
