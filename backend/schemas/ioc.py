from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class IOCBase(BaseModel):
    type: str = Field(..., min_length=1, max_length=50)
    value: str = Field(..., min_length=1, max_length=2000)
    source_name: Optional[str] = Field(default="manual", max_length=255)
    confidence: Optional[float] = Field(default=0.5, ge=0.0, le=1.0)
    context: Optional[str] = Field(default=None, max_length=5000)
    tags: List[str] = Field(default_factory=list)
    meta_data: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        valid_types = [
            "ip",
            "domain",
            "url",
            "email",
            "cve",
            "hash",
            "crypto_wallet",
            "file_hash",
            "onion_url",
            "file",
        ]
        if v.lower() not in valid_types:
            raise ValueError(
                f"Invalid IOC type. Must be one of: {', '.join(valid_types)}"
            )
        return v.lower()

    @field_validator("value")
    @classmethod
    def validate_value(cls, v):
        if len(v.strip()) == 0:
            raise ValueError("IOC value cannot be empty")
        return v.strip()


class IOCCreate(IOCBase):
    actor_id: Optional[int] = Field(default=None, gt=0)
    leak_id: Optional[int] = Field(default=None, gt=0)
    source_id: Optional[int] = Field(default=None, gt=0)
    is_whitelisted: bool = False
    is_verified: bool = False
    is_active: bool = True


class IOCUpdate(BaseModel):
    context: Optional[str] = None
    tags: Optional[List[str]] = None
    meta_data: Optional[Dict[str, Any]] = None
    is_whitelisted: Optional[bool] = None
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None


class IOC(IOCBase):
    id: int
    actor_id: Optional[int] = None
    leak_id: Optional[int] = None
    source_id: Optional[int] = None
    first_seen: datetime
    last_seen: datetime
    threat_score: float = 0.0
    false_positive_rate: float = 0.0
    is_whitelisted: bool = False
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IOCList(BaseModel):
    total: int
    iocs: List[IOC]


class IOCStats(BaseModel):
    total_iocs: int
    by_type: Dict[str, int]
    recent_count: int
    high_threat_count: int


class IOCBulkCreate(BaseModel):
    iocs: List[IOCCreate]
