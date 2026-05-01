from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    JSON,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from ..core.database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"))
    actor_id = Column(Integer, ForeignKey("threat_actors.id"))

    external_id = Column(String(255))
    title = Column(String(500))
    content = Column(Text)
    content_hash = Column(String(64), unique=True, index=True)

    author_username = Column(String(255))
    author_id = Column(String(255))

    language = Column(String(10), default="en")
    sentiment = Column(String(20))

    post_type = Column(String(50))
    category = Column(String(100))

    upvotes = Column(Integer, default=0)
    replies = Column(Integer, default=0)
    views = Column(Integer, default=0)

    extracted_iocs = Column(JSON, default=lambda: [])
    extracted_entities = Column(JSON, default=lambda: {})
    keywords = Column(JSON, default=lambda: [])

    is_verified = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)

    posted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    threat_actor = relationship("ThreatActor", back_populates="posts")
    source = relationship("Source", back_populates="posts")


class PostAttachment(Base):
    __tablename__ = "post_attachments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    filename = Column(String(255))
    file_url = Column(String(1000))
    file_type = Column(String(50))
    file_size = Column(Integer)
    hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
