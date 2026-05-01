from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    JSON,
    Float,
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class SourceType(enum.Enum):
    RANSOMWARE_BLOG = "ransomware_blog"
    HACKER_FORUM = "hacker_forum"
    MARKETPLACE = "marketplace"
    PASTE_SITE = "paste_site"
    TELEGRAM = "telegram"
    NEWS_FEED = "news_feed"
    RSS = "rss"
    TWITTER = "twitter"
    REDDIT = "reddit"
    OTHER = "other"


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    type = Column(String(50), nullable=False)
    url = Column(String(1000))
    onion_url = Column(String(1000))

    description = Column(Text)
    language = Column(String(10), default="en")

    requires_auth = Column(Boolean, default=False)
    auth_type = Column(String(50))
    credentials = Column(JSON)

    is_active = Column(Boolean, default=True)
    is_onion = Column(Boolean, default=False)
    uses_tor = Column(Boolean, default=False)

    scrape_interval_minutes = Column(Integer, default=60)
    last_scraped = Column(DateTime)
    last_success = Column(DateTime)
    scrape_failure_count = Column(Integer, default=0)

    scraping_config = Column(JSON, default=lambda: {})
    selectors = Column(JSON, default=lambda: {})

    reliability_score = Column(Float, default=0.5)
    tags = Column(JSON, default=lambda: [])

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    leaks = relationship("Leak", back_populates="source")
    posts = relationship("Post", back_populates="source")
    iocs = relationship("IOC", back_populates="source")


class SourceHealth(Base):
    __tablename__ = "source_health"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, nullable=False, index=True)
    status = Column(String(20))
    response_time_ms = Column(Integer)
    error_message = Column(Text)
    checked_at = Column(DateTime, default=datetime.utcnow)
