from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class ThreatActorBase(BaseModel):
    name: str
    aliases: List[str] = []
    description: Optional[str] = None
    motivation: Optional[str] = None
    sophistication: Optional[str] = None
    resource_level: Optional[str] = None
    primary_languages: List[str] = []
    target_industries: List[str] = []
    target_regions: List[str] = []
    ttps: List[str] = []
    associated_malware: List[str] = []
    associated_tools: List[str] = []
    associated_ransomware: List[str] = []
    tags: List[str] = []
    notes: Optional[str] = None


class ThreatActorCreate(ThreatActorBase):
    pass


class ThreatActorUpdate(BaseModel):
    aliases: Optional[List[str]] = None
    description: Optional[str] = None
    motivation: Optional[str] = None
    sophistication: Optional[str] = None
    resource_level: Optional[str] = None
    primary_languages: Optional[List[str]] = None
    target_industries: Optional[List[str]] = None
    target_regions: Optional[List[str]] = None
    ttps: Optional[List[str]] = None
    associated_malware: Optional[List[str]] = None
    associated_tools: Optional[List[str]] = None
    associated_ransomware: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ThreatActor(ThreatActorBase):
    id: int
    attribution_score: float = 0.0
    threat_score: float = 0.0
    risk_level: str = "low"
    first_seen: datetime
    last_activity: datetime
    contact_info: Dict[str, Any] = {}
    infrastructure_ips: List[str] = []
    infrastructure_domains: List[str] = []
    wallet_addresses: List[str] = []
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ThreatActorList(BaseModel):
    total: int
    actors: List[ThreatActor]


class ThreatActorStats(BaseModel):
    total_actors: int
    active_actors: int
    by_risk_level: Dict[str, int]
    top_actors: List[Dict[str, Any]]
    recent_activity: int
