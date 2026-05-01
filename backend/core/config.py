from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import secrets
import os


class Settings(BaseSettings):
    database_url: str = "postgresql://dwtip:dwtip_secure_password@localhost:5432/dwtip"
    mongodb_url: str = "mongodb://localhost:27017/dwtip"
    redis_url: str = "redis://localhost:6379/0"

    tor_proxy: str = "socks5://localhost:9050"
    tor_control: str = "localhost:9051"
    tor_password: Optional[str] = None

    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email: str = ""

    sentry_dsn: Optional[str] = None
    log_level: str = "INFO"

    playwright_browsers_path: str = "/ms-playwright"

    telegram_api_id: Optional[int] = 0
    telegram_api_hash: str = ""
    telegram_session_name: str = "dwtip_session"

    max_workers: int = 4
    scrape_interval_minutes: int = 15
    tor_circuit_rotate_interval: int = 300

    allowed_origins: str = "http://localhost:3000"

    environment: str = "development"

    cors_allow_credentials: bool = True
    cors_allow_methods: list = ["*"]
    cors_allow_headers: list = ["*"]

    rate_limit_requests_per_minute: int = 60
    rate_limit_burst: int = 10

    celery_broker_url: str = ""
    celery_result_backend: str = ""

    deepdarkcti_path: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if (
            not self.secret_key
            or self.secret_key == "dev-secret-key-change-in-production"
        ):
            if self.environment == "production":
                raise ValueError("SECRET_KEY must be set in production environment")
            self.secret_key = secrets.token_urlsafe(32)

        if not self.celery_broker_url:
            self.celery_broker_url = self.redis_url
        if not self.celery_result_backend:
            self.celery_result_backend = self.redis_url

        base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        if not self.deepdarkcti_path:
            self.deepdarkcti_path = os.path.join(base_path, "deepdarkCTI")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
