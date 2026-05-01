from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: UserRole = UserRole.VIEWER


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    alert_keywords: Optional[List[str]] = None
    alert_sources: Optional[List[int]] = None
    alert_iocs: Optional[List[int]] = None
    notification_preferences: Optional[Dict[str, Any]] = None


class UserInDB(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class User(UserInDB):
    pass


class LoginRequest(BaseModel):
    username: str
    password: str


class AlertBase(BaseModel):
    alert_type: str
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    confidence: float = 0.5


class AlertCreate(AlertBase):
    user_id: Optional[int] = None
    source_id: Optional[int] = None
    source_name: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_value: Optional[str] = None
    matched_keywords: Optional[List[str]] = None
    meta_data: Optional[Dict[str, Any]] = None


class AlertUpdate(BaseModel):
    is_read: Optional[bool] = None
    is_dismissed: Optional[bool] = None


class Alert(AlertBase):
    id: int
    user_id: Optional[int] = None
    source_id: Optional[int] = None
    source_name: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_value: Optional[str] = None
    matched_keywords: Optional[List[str]] = []
    meta_data: Optional[Dict[str, Any]] = {}
    is_read: bool
    is_dismissed: bool
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    total: int
    unread: int
    alerts: List[Alert]
