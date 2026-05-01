from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class LeakBase(BaseModel):
    title: str
    description: Optional[str] = None
    victim_name: Optional[str] = None
    victim_industry: Optional[str] = None
    victim_country: Optional[str] = None
    victim_website: Optional[str] = None
    victim_size: Optional[str] = None
    actor_name: Optional[str] = None
    source_url: Optional[str] = None
    status: str = "new"
    severity: str = "medium"
    confidence: float = 0.5
    data_types: List[str] = []
    data_size: Optional[str] = None
    record_count: Optional[int] = None
    published_date: Optional[datetime] = None
    deadline_date: Optional[datetime] = None
    asking_price: Optional[str] = None
    currency: Optional[str] = None
    tags: List[str] = []


class LeakCreate(LeakBase):
    source_id: Optional[int] = None
    actor_id: Optional[int] = None


class LeakUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    victim_name: Optional[str] = None
    victim_industry: Optional[str] = None
    victim_country: Optional[str] = None
    status: Optional[str] = None
    severity: Optional[str] = None
    confidence: Optional[float] = None
    is_verified: Optional[bool] = None
    tags: Optional[List[str]] = None


class Leak(LeakBase):
    id: int
    actor_id: Optional[int] = None
    source_id: Optional[int] = None
    screenshot_url: Optional[str] = None
    extracted_iocs: List[str] = []
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LeakList(BaseModel):
    total: int
    leaks: List[Leak]


class LeakStats(BaseModel):
    total_leaks: int
    new_today: int
    by_severity: Dict[str, int]
    by_industry: Dict[str, int]
    by_country: Dict[str, int]
    top_actors: List[Dict[str, Any]]
    recent_activity: List[Leak]
