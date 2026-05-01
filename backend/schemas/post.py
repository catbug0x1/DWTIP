from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class PostBase(BaseModel):
    external_id: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    author_username: Optional[str] = None
    author_id: Optional[str] = None
    language: str = "en"
    sentiment: Optional[str] = None
    post_type: Optional[str] = None
    category: Optional[str] = None


class PostCreate(PostBase):
    source_id: Optional[int] = None
    actor_id: Optional[int] = None
    posted_at: Optional[datetime] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    sentiment: Optional[str] = None
    category: Optional[str] = None
    is_flagged: Optional[bool] = None
    extracted_iocs: Optional[List[str]] = None
    extracted_entities: Optional[Dict[str, Any]] = None
    keywords: Optional[List[str]] = None


class Post(PostBase):
    id: int
    source_id: Optional[int] = None
    actor_id: Optional[int] = None
    content_hash: str
    upvotes: int = 0
    replies: int = 0
    views: int = 0
    extracted_iocs: List[str] = []
    extracted_entities: Dict[str, Any] = {}
    keywords: List[str] = []
    is_verified: bool = False
    is_flagged: bool = False
    posted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PostList(BaseModel):
    total: int
    posts: List[Post]


class RawData(BaseModel):
    id: Optional[str] = None
    source_id: int
    source_name: str
    content_type: str
    title: Optional[str] = None
    url: str
    raw_content: str
    cleaned_content: Optional[str] = None
    content_hash: str
    author: Optional[str] = None
    language: str = "en"
    entities: Dict[str, Any] = {}
    iocs: List[Dict[str, Any]] = []
    keywords: List[str] = []
    classification: str = "unknown"
    collected_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
