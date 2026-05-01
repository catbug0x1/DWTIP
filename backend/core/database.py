from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os

from .config import get_settings

settings = get_settings()


def get_database_url():
    db_url = os.environ.get("DATABASE_URL") or settings.database_url
    if "postgresql" in db_url and "localhost" in db_url:
        import warnings

        warnings.warn(
            "Falling back to SQLite from PostgreSQL. "
            "This is a development-only behavior. Set DATABASE_URL to a production database.",
            DeprecationWarning,
        )
        return "sqlite:///./dwtip.db"

    # SQLAlchemy defaults to psycopg2 for postgresql:// URLs.
    # On newer Python versions where psycopg2 wheels may be unavailable,
    # transparently switch to psycopg if installed.
    if db_url.startswith("postgresql://"):
        try:
            import psycopg2  # type: ignore  # noqa: F401
        except Exception:
            try:
                import psycopg  # type: ignore  # noqa: F401

                db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
            except Exception:
                pass

    return db_url


try:
    engine = create_engine(
        get_database_url(),
        pool_pre_ping=True,
        connect_args={"check_same_thread": False}
        if "sqlite" in get_database_url()
        else {},
    )
except Exception:
    engine = create_engine(
        "sqlite:///./dwtip.db", connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MongoDB:
    client = None
    db = None


mongo_db = MongoDB()


async def connect_mongo():
    try:
        from motor.motor_asyncio import AsyncIOMotorClient

        mongo_db.client = AsyncIOMotorClient(settings.mongodb_url)
        mongo_db.db = mongo_db.client.dwtip
    except Exception as e:
        print(f"[!] MongoDB connection failed: {e}")


async def close_mongo():
    if mongo_db.client:
        mongo_db.client.close()


def get_mongo():
    return mongo_db.db


redis_client = None


async def connect_redis():
    global redis_client
    try:
        import redis.asyncio as redis

        redis_client = await redis.from_url(settings.redis_url, decode_responses=True)
    except Exception as e:
        print(f"[!] Redis connection failed: {e}")


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()


def get_redis():
    return redis_client


async def init_postgresql():
    try:

        Base.metadata.create_all(bind=engine)
        print("[+] Database tables created")
    except Exception as e:
        print(f"[!] PostgreSQL init failed: {e}")


async def init_mongodb():
    db = mongo_db.db
    if db is None:
        await connect_mongo()
        db = mongo_db.db

    if db is not None:
        try:
            await db.raw_data.create_index([("hash", 1)], unique=True)
            await db.raw_data.create_index([("source_id", 1)])
            await db.raw_data.create_index([("collected_at", -1)])
            await db.raw_data.create_index([("content_type", 1)])
            await db.screenshots.create_index([("source_id", 1)])
            await db.screenshots.create_index([("created_at", -1)])
            await db.alerts.create_index([("created_at", -1)])
            await db.alerts.create_index([("read", 1)])
            print("[+] MongoDB indexes created")
        except Exception as e:
            print(f"[!] MongoDB indexes failed: {e}")
