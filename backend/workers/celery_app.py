from celery import Celery
from kombu import Exchange, Queue
import os

import sys

sys.path.insert(0, "/app")

settings = {
    "broker_url": os.environ.get(
        "CELERY_BROKER_URL", os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    ),
    "result_backend": os.environ.get(
        "CELERY_RESULT_BACKEND", os.environ.get("REDIS_URL", "redis://localhost:6379/0")
    ),
    "task_serializer": "json",
    "result_serializer": "json",
    "accept_content": ["json"],
    "timezone": "UTC",
    "enable_utc": True,
    "task_track_started": True,
    "task_time_limit": 3600,
    "task_soft_time_limit": 3000,
    "worker_prefetch_multiplier": 1,
    "worker_max_tasks_per_child": 100,
}

app = Celery("dwtip")
app.config_from_object(settings)

task_exchanges = [
    Exchange("scraping", type="direct"),
    Exchange("alerts", type="direct"),
    Exchange("processing", type="direct"),
]

app.conf.task_queues = (
    Queue("scraping", Exchange("scraping", type="direct"), routing_key="scrape"),
    Queue("alerts", Exchange("alerts", type="direct"), routing_key="alert"),
    Queue("processing", Exchange("processing", type="direct"), routing_key="process"),
    Queue("default"),
)

app.conf.task_default_queue = "default"
app.conf.task_default_exchange = "default"
app.conf.task_default_routing_key = "default"

app.conf.task_routes = {
    "backend.workers.tasks.scrape_*": {"queue": "scraping"},
    "backend.workers.tasks.alert_*": {"queue": "alerts"},
    "backend.workers.tasks.process_*": {"queue": "processing"},
}

app.conf.beat_schedule = {
    "periodic-scrape": {
        "task": "workers.tasks.scrape_sources",
        "schedule": 900.0,
        "options": {"queue": "scraping"},
    },
    "cleanup-old-alerts": {
        "task": "workers.tasks.cleanup_old_alerts",
        "schedule": 86400.0,
        "options": {"queue": "processing"},
    },
    "rotate-tor-circuit": {
        "task": "workers.tasks.rotate_tor_circuit",
        "schedule": 300.0,
        "options": {"queue": "scraping"},
    },
}

__all__ = ["app"]
