from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    WebSocket,
    WebSocketDisconnect,
    Request,
)
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from jose import JWTError, jwt
from passlib.context import CryptContext
from collections import defaultdict
from datetime import datetime as dt
import json
import re

from backend.core.config import get_settings
from backend.core.database import (
    get_db,
    connect_mongo,
    close_mongo,
    connect_redis,
    close_redis,
)
from backend.models.user import User as UserModel, Alert as AlertModel
from backend.models.threat_actor import ThreatActor as ThreatActorModel
from backend.models.leak import Leak as LeakModel
from backend.models.ioc import IOC as IOCModel
from backend.models.source import Source as SourceModel
from backend.models.post import Post as PostModel
from backend.schemas import (
    Token,
    UserCreate,
    User,
    ThreatActorList,
    ThreatActorCreate,
    ThreatActor,
    LeakList,
    LeakCreate,
    Leak,
    IOCList,
    IOCCreate,
    IOC,
    SourceList,
    SourceCreate,
    Source,
    PostList,
    PostCreate,
    Post,
    Alert,
    AlertCreate,
    AlertResponse,
    AlertUpdate,
    UserUpdate,
)

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

app = FastAPI(
    title="DWTIP API",
    description="Dark Web Threat Intelligence Platform API",
    version="1.0.0",
)

origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
if "*" in origins:
    allow_all = True
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    allow_all = False
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class RateLimiter:
    MAX_CLIENTS = 10000

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)

    def is_allowed(self, client_id: str) -> bool:
        now = dt.now()
        minute_ago = now - timedelta(minutes=1)

        if len(self.requests) >= self.MAX_CLIENTS:
            oldest_key = next(iter(self.requests))
            del self.requests[oldest_key]

        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id] if req_time > minute_ago
        ]

        if len(self.requests[client_id]) >= self.requests_per_minute:
            return False

        self.requests[client_id].append(now)
        return True


rate_limiter = RateLimiter(requests_per_minute=settings.rate_limit_requests_per_minute)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        if not rate_limiter.is_allowed(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
            )
    response = await call_next(request)
    return response


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"[!] WebSocket broadcast error: {e}")
                pass


manager = ConnectionManager()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return encoded_jwt


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


@app.on_event("startup")
async def startup():
    await connect_mongo()
    await connect_redis()


@app.on_event("shutdown")
async def shutdown():
    await close_mongo()
    await close_redis()


@app.get("/")
async def root():
    return {"message": "DWTIP API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/v1/auth/register", response_model=User)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(UserModel).filter(UserModel.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_user = db.query(UserModel).filter(UserModel.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        hashed_password=hashed_password,
        role=user.role.value,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.post("/api/v1/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = db.query(UserModel).filter(UserModel.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    user.last_login = datetime.utcnow()
    db.commit()
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/v1/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@app.put("/api/v1/auth/me", response_model=User)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if user_update.email:
        current_user.email = user_update.email
    if user_update.full_name:
        current_user.full_name = user_update.full_name
    if user_update.role:
        current_user.role = user_update.role.value
    if user_update.alert_keywords:
        current_user.alert_keywords = user_update.alert_keywords
    if user_update.alert_sources:
        current_user.alert_sources = user_update.alert_sources
    if user_update.alert_iocs:
        current_user.alert_iocs = user_update.alert_iocs
    if user_update.notification_preferences:
        current_user.notification_preferences = user_update.notification_preferences
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/v1/threat-actors", response_model=ThreatActorList)
async def get_threat_actors(
    skip: int = 0, limit: int = 50, search: str = None, db: Session = Depends(get_db)
):
    query = db.query(ThreatActorModel)
    if search:
        sanitized = search.replace("%", "").replace("_", "")
        query = query.filter(ThreatActorModel.name.ilike(f"%{sanitized}%"))
    total = query.count()
    actors = query.offset(skip).limit(limit).all()
    return {"total": total, "actors": actors}


@app.post("/api/v1/threat-actors", response_model=ThreatActor)
async def create_threat_actor(actor: ThreatActorCreate, db: Session = Depends(get_db)):
    db_actor = ThreatActorModel(**actor.model_dump())
    db.add(db_actor)
    db.commit()
    db.refresh(db_actor)
    return db_actor


@app.get("/api/v1/threat-actors/{actor_id}", response_model=ThreatActor)
async def get_threat_actor(actor_id: int, db: Session = Depends(get_db)):
    actor = db.query(ThreatActorModel).filter(ThreatActorModel.id == actor_id).first()
    if not actor:
        raise HTTPException(status_code=404, detail="Threat actor not found")
    return actor


@app.put("/api/v1/threat-actors/{actor_id}", response_model=ThreatActor)
async def update_threat_actor(
    actor_id: int,
    actor_update: dict,
    db: Session = Depends(get_db),
):
    actor = db.query(ThreatActorModel).filter(ThreatActorModel.id == actor_id).first()
    if not actor:
        raise HTTPException(status_code=404, detail="Threat actor not found")

    for key, value in actor_update.items():
        if hasattr(actor, key):
            setattr(actor, key, value)

    db.commit()
    db.refresh(actor)
    return actor


@app.delete("/api/v1/threat-actors/{actor_id}")
async def delete_threat_actor(
    actor_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403, detail="Only admins can delete threat actors"
        )
    actor = db.query(ThreatActorModel).filter(ThreatActorModel.id == actor_id).first()
    if not actor:
        raise HTTPException(status_code=404, detail="Threat actor not found")
    db.delete(actor)
    db.commit()
    return {"message": "Threat actor deleted successfully"}


@app.get("/api/v1/leaks", response_model=LeakList)
async def get_leaks(
    skip: int = 0,
    limit: int = 50,
    severity: str = None,
    status: str = None,
    search: str = None,
    source: str = None,
    source_url: str = None,
    is_onion: bool = None,
    db: Session = Depends(get_db),
):
    query = db.query(LeakModel)
    if severity:
        query = query.filter(LeakModel.severity == severity)
    if status:
        query = query.filter(LeakModel.status == status)
    if search:
        sanitized = search.replace("%", "").replace("_", "")
        query = query.filter(LeakModel.title.ilike(f"%{sanitized}%"))
    if source:
        sanitized_source = source.replace("%", "").replace("_", "")
        query = query.filter(LeakModel.victim_name.ilike(f"%{sanitized_source}%"))
    if source_url:
        sanitized_url = source_url.replace("%", "").replace("_", "")
        query = query.filter(LeakModel.source_url.ilike(f"%{sanitized_url}%"))
    if is_onion is not None:
        if is_onion:
            query = query.filter(LeakModel.source_url.like("%.onion%"))
        else:
            query = query.filter(
                ~LeakModel.source_url.like("%.onion%") | (LeakModel.source_url.is_(None))
            )
    total = query.count()
    leaks = query.order_by(LeakModel.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "leaks": leaks}


@app.post("/api/v1/leaks", response_model=Leak)
async def create_leak(leak: LeakCreate, db: Session = Depends(get_db)):
    db_leak = LeakModel(**leak.model_dump())
    db.add(db_leak)
    db.commit()
    db.refresh(db_leak)

    await manager.broadcast(
        {
            "type": "new_leak",
            "data": {
                "id": db_leak.id,
                "title": db_leak.title,
                "severity": db_leak.severity,
                "victim_name": db_leak.victim_name,
                "created_at": db_leak.created_at.isoformat(),
            },
        }
    )

    return db_leak


@app.get("/api/v1/leaks/{leak_id}", response_model=Leak)
async def get_leak(leak_id: int, db: Session = Depends(get_db)):
    leak = db.query(LeakModel).filter(LeakModel.id == leak_id).first()
    if not leak:
        raise HTTPException(status_code=404, detail="Leak not found")
    return leak


@app.delete("/api/v1/leaks/{leak_id}")
async def delete_leak(
    leak_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete leaks")
    leak = db.query(LeakModel).filter(LeakModel.id == leak_id).first()
    if not leak:
        raise HTTPException(status_code=404, detail="Leak not found")
    db.delete(leak)
    db.commit()
    return {"message": "Leak deleted successfully"}


@app.get("/api/v1/iocs", response_model=IOCList)
async def get_iocs(
    skip: int = 0,
    limit: int = 50,
    ioc_type: str = None,
    search: str = None,
    source: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(IOCModel).filter(~IOCModel.is_whitelisted)
    if ioc_type:
        query = query.filter(IOCModel.type == ioc_type)
    if search:
        sanitized = search.replace("%", "").replace("_", "")
        query = query.filter(IOCModel.value.ilike(f"%{sanitized}%"))
    if source:
        sanitized_source = source.replace("%", "").replace("_", "")
        query = query.filter(IOCModel.source_name.ilike(f"%{sanitized_source}%"))
    total = query.count()
    iocs = query.order_by(IOCModel.last_seen.desc()).offset(skip).limit(limit).all()
    return {"total": total, "iocs": iocs}


@app.post("/api/v1/iocs", response_model=IOC)
async def create_ioc(ioc: IOCCreate, db: Session = Depends(get_db)):
    existing = db.query(IOCModel).filter(IOCModel.value == ioc.value).first()
    if existing:
        raise HTTPException(status_code=400, detail="IOC already exists")
    db_ioc = IOCModel(**ioc.model_dump())
    db.add(db_ioc)
    db.commit()
    db.refresh(db_ioc)
    return db_ioc


@app.post("/api/v1/iocs/bulk", response_model=List[IOC])
async def create_iocs_bulk(iocs_data: List[IOCCreate], db: Session = Depends(get_db)):
    created = []
    for ioc_data in iocs_data:
        existing = db.query(IOCModel).filter(IOCModel.value == ioc_data.value).first()
        if not existing:
            db_ioc = IOCModel(**ioc_data.model_dump())
            db.add(db_ioc)
            created.append(db_ioc)
    db.commit()
    for ioc in created:
        db.refresh(ioc)
    return created


@app.delete("/api/v1/iocs/{ioc_id}")
async def delete_ioc(
    ioc_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete IOCs")
    ioc = db.query(IOCModel).filter(IOCModel.id == ioc_id).first()
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found")
    db.delete(ioc)
    db.commit()
    return {"message": "IOC deleted successfully"}


@app.get("/api/v1/sources", response_model=SourceList)
async def get_sources(
    skip: int = 0,
    limit: int = 100,
    source_type: str = None,
    is_active: bool = None,
    db: Session = Depends(get_db),
):
    query = db.query(SourceModel)
    if is_active is not None:
        query = query.filter(SourceModel.is_active == is_active)
    if source_type:
        query = query.filter(SourceModel.type == source_type)
    total = query.count()
    sources = query.offset(skip).limit(limit).all()
    return {"total": total, "sources": sources}


@app.get("/api/v1/sources/types")
async def get_source_types(db: Session = Depends(get_db)):
    types = db.query(SourceModel.type).distinct().limit(100).all()
    return {"types": [t[0] for t in types if t[0]]}


@app.get("/api/v1/sources/names")
async def get_source_names(db: Session = Depends(get_db)):
    sources = db.query(SourceModel.name).distinct().limit(100).all()
    return {"names": [s[0] for s in sources if s[0]]}


@app.post("/api/v1/sources", response_model=Source)
async def create_source(source: SourceCreate, db: Session = Depends(get_db)):
    db_source = SourceModel(**source.model_dump())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@app.put("/api/v1/sources/{source_id}", response_model=Source)
async def update_source(
    source_id: int, source_update: dict, db: Session = Depends(get_db)
):
    source = db.query(SourceModel).filter(SourceModel.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    if "is_active" in source_update:
        source.is_active = source_update["is_active"]
    if "scrape_interval_minutes" in source_update:
        source.scrape_interval_minutes = source_update["scrape_interval_minutes"]
    db.commit()
    db.refresh(source)
    return source


@app.post("/api/v1/sources/import-deepdarkcti")
async def import_deepdarkcti_sources(db: Session = Depends(get_db)):
    import os

    base_path = os.environ.get("DWTIP_ROOT", "/app")
    DEEPDARKCTI_PATH = os.environ.get(
        "DEEPDARKCTI_PATH", os.path.join(base_path, "deepdarkCTI")
    )

    if not os.path.exists(DEEPDARKCTI_PATH):
        raise HTTPException(
            status_code=404,
            detail=f"DeepdarkCTI directory not found: {DEEPDARKCTI_PATH}. "
            "Please mount the directory or set DEEPDARKCTI_PATH environment variable.",
        )

    added = 0
    skipped = 0

    TYPE_MAPPING = {
        "ransomware_gang": "ransomware_gang",
        "forum": "hacker_forum",
        "markets": "marketplace",
        "search_engines": "search_engine",
        "counterfeit_goods": "fraud",
        "maas": "ransomware_gang",
        "rat": "darkweb",
        "others": "other",
    }

    for filename in os.listdir(DEEPDARKCTI_PATH):
        if not filename.endswith(".md"):
            continue

        category = filename.replace(".md", "").replace("_", " ").title()
        source_type = TYPE_MAPPING.get(filename.replace(".md", "").lower(), "darkweb")

        try:
            with open(
                os.path.join(DEEPDARKCTI_PATH, filename), "r", encoding="utf-8"
            ) as f:
                content = f.read()

            onion_pattern = r"http[s]?://([a-z2-7]{10,56})\.onion[a-zA-Z0-9/._\-?=&]*"
            urls = re.findall(onion_pattern, content)

            for onion_id in set(urls):
                url = f"http://{onion_id}.onion"

                existing = (
                    db.query(SourceModel)
                    .filter((SourceModel.url == url) | (SourceModel.onion_url == url))
                    .first()
                )

                if existing:
                    skipped += 1
                    continue

                db_source = SourceModel(
                    name=f"deepdarkCTI - {category} ({onion_id[:16]})",
                    onion_url=url,
                    type=source_type,
                    description=f"Auto-imported from deepdarkCTI - {category}",
                    is_active=True,
                    uses_tor=True,
                    scrape_interval_minutes=360,
                )
                db.add(db_source)
                added += 1

        except Exception:
            continue

    db.commit()
    return {
        "added": added,
        "skipped": skipped,
        "total_sources": db.query(SourceModel).count(),
    }


@app.get("/api/v1/posts", response_model=PostList)
async def get_posts(
    skip: int = 0, limit: int = 50, search: str = None, db: Session = Depends(get_db)
):
    query = db.query(PostModel)
    if search:
        query = query.filter(
            PostModel.content.ilike(f"%{search}%")
            | PostModel.title.ilike(f"%{search}%")
        )
    total = query.count()
    posts = query.order_by(PostModel.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "posts": posts}


@app.post("/api/v1/posts", response_model=Post)
async def create_post(post: PostCreate, db: Session = Depends(get_db)):
    import hashlib

    content_hash = hashlib.sha256((post.content or "").encode()).hexdigest()
    db_post = PostModel(**post.model_dump(), content_hash=content_hash)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post


@app.get("/api/v1/alerts", response_model=AlertResponse)
async def get_alerts(
    skip: int = 0,
    limit: int = 50,
    is_read: bool = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    query = db.query(AlertModel)
    if current_user.role != "admin":
        query = query.filter(
            (AlertModel.user_id == current_user.id) | (AlertModel.user_id.is_(None))
        )
    if is_read is not None:
        query = query.filter(AlertModel.is_read == is_read)
    total = query.count()
    unread = query.filter(~AlertModel.is_read).count()
    alerts = (
        query.order_by(AlertModel.created_at.desc()).offset(skip).limit(limit).all()
    )
    return {"total": total, "unread": unread, "alerts": alerts}


@app.post("/api/v1/alerts", response_model=Alert)
async def create_alert(alert: AlertCreate, db: Session = Depends(get_db)):
    db_alert = AlertModel(**alert.model_dump())
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)

    await manager.broadcast(
        {
            "type": "new_alert",
            "data": {
                "id": db_alert.id,
                "title": db_alert.title,
                "severity": db_alert.severity,
                "alert_type": db_alert.alert_type,
            },
        }
    )

    return db_alert


@app.put("/api/v1/alerts/{alert_id}", response_model=Alert)
async def update_alert(
    alert_id: int,
    alert_update: AlertUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert_update.is_read is not None:
        alert.is_read = alert_update.is_read
        if alert_update.is_read:
            alert.read_at = datetime.utcnow()
    if alert_update.is_dismissed is not None:
        alert.is_dismissed = alert_update.is_dismissed
    db.commit()
    db.refresh(alert)
    return alert


@app.delete("/api/v1/alerts/{alert_id}")
async def delete_alert(
    alert_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete alerts")
    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    db.delete(alert)
    db.commit()
    return {"message": "Alert deleted successfully"}


@app.get("/api/v1/stats/dashboard")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    total_actors = db.query(ThreatActorModel).count()
    active_actors = (
        db.query(ThreatActorModel).filter(ThreatActorModel.is_active).count()
    )
    total_leaks = db.query(LeakModel).count()
    today = datetime.utcnow().date()
    new_leaks_today = db.query(LeakModel).filter(LeakModel.created_at >= today).count()
    total_iocs = db.query(IOCModel).filter(~IOCModel.is_whitelisted).count()
    active_sources = db.query(SourceModel).filter(SourceModel.is_active).count()

    # Onion vs Web breakdown
    onion_leaks = (
        db.query(LeakModel).filter(LeakModel.source_url.like("%.onion%")).count()
    )
    web_leaks = total_leaks - onion_leaks

    # Severity breakdown
    from sqlalchemy import func

    severity_breakdown = {}
    severity_results = (
        db.query(LeakModel.severity, func.count(LeakModel.id))
        .group_by(LeakModel.severity)
        .all()
    )
    for sev, count in severity_results:
        severity_breakdown[sev or "unknown"] = count

    # Source breakdown
    source_breakdown = {
        "dark_web": onion_leaks,
        "surface_web": web_leaks,
    }

    return {
        "threat_actors": {"total": total_actors, "active": active_actors},
        "leaks": {
            "total": total_leaks,
            "new_today": new_leaks_today,
            "onion": onion_leaks,
            "web": web_leaks,
            "by_severity": severity_breakdown,
            "by_source": source_breakdown,
        },
        "iocs": {"total": total_iocs},
        "sources": {"active": active_sources},
    }


@app.post("/api/v1/scrape/trigger")
async def trigger_scrape(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    import subprocess
    import sys
    import os
    import threading

    base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    scraper_path = os.path.join(base_path, "scripts", "scrape_tor.py")
    stats_file = "/tmp/dwtip_scrape_status.json"

    with open(stats_file, "w") as f:
        json.dump(
            {
                "status": "starting",
                "progress": 0,
                "total": 0,
                "success": 0,
                "failed": 0,
                "current_url": "Initializing Tor connection...",
                "logs": ["Starting scrape..."],
                "start_time": str(datetime.now()),
                "end_time": None,
            },
            f,
        )

    def run_scraper():
        try:
            subprocess.Popen(
                [sys.executable, scraper_path, "800", "5"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=base_path,
            )
        except Exception as e:
            with open(stats_file, "w") as f:
                json.dump(
                    {
                        "status": "error",
                        "error": str(e),
                        "logs": [f"Error: {e}"],
                    },
                    f,
                )

    thread = threading.Thread(target=run_scraper)
    thread.start()

    return {
        "status": "started",
        "message": "Scraping onion URLs via Tor. Progress will update automatically.",
    }


@app.get("/api/v1/scrape/status")
async def get_scrape_status(
    db: Session = Depends(get_db),
):
    import os

    stats_file = "/tmp/dwtip_scrape_status.json"

    if os.path.exists(stats_file):
        with open(stats_file, "r") as f:
            return json.load(f)

    return {
        "status": "idle",
        "progress": 0,
        "total": 0,
        "success": 0,
        "failed": 0,
        "current_url": "",
        "logs": [],
    }


@app.post("/api/v1/scrape/stop")
async def stop_scrape():
    import os

    stats_file = "/tmp/dwtip_scrape_status.json"

    if os.path.exists(stats_file):
        with open(stats_file, "w") as f:
            json.dump(
                {
                    "status": "stopped",
                    "logs": ["Scrape stopped by user"],
                },
                f,
            )

    return {"status": "stopped", "message": "Scrape stopped"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
