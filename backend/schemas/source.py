from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class SourceBase(BaseModel):
    name: str
    type: str
    url: Optional[str] = None
    onion_url: Optional[str] = None
    description: Optional[str] = None
    language: str = "en"
    requires_auth: bool = False
    auth_type: Optional[str] = None
    is_onion: bool = False
    uses_tor: bool = False
    scrape_interval_minutes: int = 60
    tags: List[str] = []


class SourceCreate(SourceBase):
    credentials: Optional[Dict[str, str]] = None
    scraping_config: Optional[Dict[str, Any]] = None
    selectors: Optional[Dict[str, str]] = None


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    url: Optional[str] = None
    onion_url: Optional[str] = None
    description: Optional[str] = None
    requires_auth: Optional[bool] = None
    is_active: Optional[bool] = None
    scrape_interval_minutes: Optional[int] = None
    tags: Optional[List[str]] = None


class Source(SourceBase):
    id: int
    scraping_config: Optional[Dict[str, Any]] = {}
    selectors: Optional[Dict[str, str]] = {}
    reliability_score: float = 0.5
    last_scraped: Optional[datetime] = None
    last_success: Optional[datetime] = None
    scrape_failure_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SourceList(BaseModel):
    total: int
    sources: List[Source]


class SourceHealthResponse(BaseModel):
    source_id: int
    source_name: str
    status: str
    response_time_ms: Optional[int] = None
    last_check: datetime
    error_message: Optional[str] = None
