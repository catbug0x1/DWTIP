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


class IOCType(enum.Enum):
    IP = "ip"
    DOMAIN = "domain"
    URL = "url"
    EMAIL = "email"
    WALLET = "wallet"
    HASH_MD5 = "md5"
    HASH_SHA1 = "sha1"
    HASH_SHA256 = "sha256"
    FILE = "file"
    CVE = "cve"
    BOT = "bot"
    MALWARE = "malware"


class IOC(Base):
    __tablename__ = "iocs"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False, index=True)
    value = Column(Text, nullable=False, unique=True, index=True)

    actor_id = Column(Integer, ForeignKey("threat_actors.id"), nullable=True)
    leak_id = Column(Integer, ForeignKey("leaks.id"), nullable=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    source_name = Column(String(255), default="manual")

    context = Column(Text)
    confidence = Column(Float, default=0.5)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)

    threat_score = Column(Float, default=0.0)
    false_positive_rate = Column(Float, default=0.0)

    tags = Column(JSON, default=lambda: [])
    meta_data = Column(JSON, default=lambda: {})

    is_whitelisted = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    threat_actor = relationship("ThreatActor", back_populates="iocs")
    leak = relationship("Leak", back_populates="iocs")
    source = relationship("Source", back_populates="iocs")


class IOCTag(Base):
    __tablename__ = "ioc_tags"

    id = Column(Integer, primary_key=True, index=True)
    ioc_id = Column(Integer, ForeignKey("iocs.id"), nullable=False)
    tag = Column(String(100), nullable=False)
    source = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)


class IOCRelation(Base):
    __tablename__ = "ioc_relations"

    id = Column(Integer, primary_key=True, index=True)
    source_ioc_id = Column(Integer, ForeignKey("iocs.id"), nullable=False)
    target_ioc_id = Column(Integer, ForeignKey("iocs.id"), nullable=False)
    relationship_type = Column(String(100))
    confidence = Column(Float, default=1.0)
    meta_data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
