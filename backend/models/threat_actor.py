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
from ..core.database import Base


class ThreatActor(Base):
    __tablename__ = "threat_actors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    aliases = Column(JSON, default=lambda: [])
    description = Column(Text)
    motivation = Column(String(100))
    sophistication = Column(String(50))
    resource_level = Column(String(50))
    primary_languages = Column(JSON, default=lambda: [])
    target_industries = Column(JSON, default=lambda: [])
    target_regions = Column(JSON, default=lambda: [])

    ttps = Column(JSON, default=lambda: [])
    associated_malware = Column(JSON, default=lambda: [])
    associated_tools = Column(JSON, default=lambda: [])
    associated_ransomware = Column(JSON, default=lambda: [])

    attribution_score = Column(Float, default=0.0)
    threat_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default="low")

    first_seen = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)

    contact_info = Column(JSON, default=lambda: {})
    infrastructure_ips = Column(JSON, default=lambda: [])
    infrastructure_domains = Column(JSON, default=lambda: [])
    wallet_addresses = Column(JSON, default=lambda: [])

    tags = Column(JSON, default=lambda: [])
    notes = Column(Text)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    leaks = relationship("Leak", back_populates="threat_actor")
    posts = relationship("Post", back_populates="threat_actor")
    iocs = relationship("IOC", back_populates="threat_actor")


class ThreatActorAlias(Base):
    __tablename__ = "threat_actor_aliases"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("threat_actors.id"), nullable=False)
    alias = Column(String(255), nullable=False)
    source = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
