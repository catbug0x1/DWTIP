import os
import sys
import json
import time
from datetime import datetime, timedelta
from celery import Task
from celery.utils.log import get_task_logger

sys.path.insert(0, "/app")

from backend.workers.celery_app import app
from backend.core.database import SessionLocal
from backend.models.source import Source
from backend.models.ioc import IOC
from backend.models.leak import Leak
from backend.models.user import User, Alert

logger = get_task_logger(__name__)

__all__ = [
    "scrape_url",
    "process_scrape_result",
    "scrape_sources",
    "send_alert_email",
    "rotate_tor_circuit",
    "cleanup_old_alerts",
    "process_ioc_batch",
]


class DatabaseTask(Task):
    _db = None

    @property
    def db(self):
        if self._db is None:
            self._db = SessionLocal()
        return self._db

    def after_return(self, *args, **kwargs):
        if self._db is not None:
            self._db.close()
            self._db = None


def get_scrape_status():
    status_file = os.environ.get("SCRAPE_STATUS_FILE", "/tmp/dwtip_scrape_status.json")
    try:
        with open(status_file, "r") as f:
            return json.load(f)
    except Exception:
        return {"status": "idle", "progress": 0, "total": 0}


def update_scrape_status(status_data):
    status_file = os.environ.get("SCRAPE_STATUS_FILE", "/tmp/dwtip_scrape_status.json")
    if "start_time" not in status_data:
        status_data["start_time"] = datetime.now().isoformat()
    with open(status_file, "w") as f:
        json.dump(status_data, f)
    return status_data


@app.task(bind=True, base=DatabaseTask, name="workers.tasks.scrape_url")
def scrape_url(self, url: str, source_id: int, scrape_config: dict = None):
    import requests
    from bs4 import BeautifulSoup
    import re

    config = scrape_config or {}
    timeout = config.get("timeout", 30)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    proxies = {
        "http": os.environ.get("TOR_PROXY", "socks5://127.0.0.1:9050"),
        "https": os.environ.get("TOR_PROXY", "socks5://127.0.0.1:9050"),
    }

    result = {
        "url": url,
        "source_id": source_id,
        "success": False,
        "content": None,
        "iocs": [],
        "leaks": [],
        "error": None,
    }

    try:
        response = requests.get(
            url, headers=headers, proxies=proxies, timeout=timeout, verify=False
        )
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        text_content = soup.get_text(separator=" ", strip=True)

        result["success"] = True
        result["content"] = response.text[:50000]

        ioc_patterns = {
            "ip": r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b",
            "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            "btc": r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b",
            "eth": r"\b0x[a-fA-F0-9]{40}\b",
            "cve": r"\bCVE-\d{4}-\d{4,}\b",
            "domain": r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b",
            "onion": r"\b[a-z2-7]{56}\.onion\b",
        }

        for ioc_type, pattern in ioc_patterns.items():
            matches = re.findall(pattern, text_content)
            for match in matches[:100]:
                result["iocs"].append(
                    {
                        "type": ioc_type,
                        "value": match,
                        "source_name": f"scraper_{source_id}",
                    }
                )

        leak_keywords = [
            "breach",
            "leaked",
            "database",
            "ransomware",
            "stolen",
            "compromised",
        ]
        if any(kw in text_content.lower() for kw in leak_keywords):
            title_match = re.search(
                r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,5})", text_content[:500]
            )
            result["leaks"].append(
                {
                    "title": title_match.group(1)
                    if title_match
                    else "Potential Leak Detected",
                    "source_url": url,
                    "source_id": source_id,
                    "severity": "medium",
                }
            )

    except requests.exceptions.Timeout:
        result["error"] = "Timeout"
    except requests.exceptions.ConnectionError:
        result["error"] = "Connection Error"
    except Exception as e:
        result["error"] = str(e)

    return result


@app.task(bind=True, base=DatabaseTask, name="workers.tasks.process_scrape_result")
def process_scrape_result(self, scrape_result: dict):
    db = self.db

    if not scrape_result.get("success"):
        return {"status": "failed", "reason": scrape_result.get("error")}

    source_id = scrape_result.get("source_id")
    iocs = scrape_result.get("iocs", [])
    leaks = scrape_result.get("leaks", [])

    saved_iocs = 0
    for ioc_data in iocs:
        existing = (
            db.query(IOC)
            .filter(IOC.value == ioc_data["value"], IOC.type == ioc_data["type"])
            .first()
        )

        if not existing:
            new_ioc = IOC(
                type=ioc_data["type"],
                value=ioc_data["value"],
                source_name=ioc_data.get("source_name", "scraper"),
                source_id=source_id,
                first_seen=datetime.utcnow(),
                last_seen=datetime.utcnow(),
                confidence=0.7,
            )
            db.add(new_ioc)
            saved_iocs += 1

    for leak_data in leaks:
        existing_leak = (
            db.query(Leak).filter(Leak.source_url == leak_data["source_url"]).first()
        )

        if not existing_leak:
            new_leak = Leak(
                title=leak_data["title"],
                source_url=leak_data["source_url"],
                source_id=source_id,
                severity=leak_data.get("severity", "medium"),
                status="new",
                published_date=datetime.utcnow(),
            )
            db.add(new_leak)

            alerts = db.query(User).filter(User.role.in_(["admin", "analyst"])).all()
            for user in alerts:
                alert = Alert(
                    user_id=user.id,
                    alert_type="new_leak",
                    title=f"New Leak Detected: {leak_data['title']}",
                    description=f"Potential data leak found at {leak_data['source_url']}",
                    source_name="Auto-Scraper",
                    severity=leak_data.get("severity", "medium"),
                    entity_type="leak",
                    entity_value=leak_data["title"],
                    source_id=source_id,
                )
                db.add(alert)

    db.commit()

    return {
        "status": "processed",
        "iocs_saved": saved_iocs,
        "leaks_saved": len(leaks),
    }


@app.task(bind=True, name="workers.tasks.scrape_sources")
def scrape_sources(self, limit: int = 50):
    db = SessionLocal()

    update_scrape_status(
        {
            "status": "running",
            "progress": 0,
            "total": limit,
            "success": 0,
            "failed": 0,
            "current_url": "Starting scrape...",
            "logs": [
                f"[{datetime.now().strftime('%H:%M:%S')}] Starting scheduled scrape..."
            ],
            "start_time": datetime.now().isoformat(),
            "end_time": None,
        }
    )

    try:
        sources = (
            db.query(Source)
            .filter(Source.is_active)
            .filter((Source.url.like("%.onion%")) | (Source.onion_url.like("%.onion%")))
            .limit(limit)
            .all()
        )

        total = len(sources)
        success = 0
        failed = 0

        for idx, source in enumerate(sources):
            url = source.url or source.onion_url
            if not url:
                continue

            update_scrape_status(
                {
                    "status": "running",
                    "progress": idx + 1,
                    "total": total,
                    "success": success,
                    "failed": failed,
                    "current_url": url,
                    "logs": [f"[{datetime.now().strftime('%H:%M:%S')}] Scraping {url}"],
                    "start_time": update_scrape_status({"status": "running"})[
                        "start_time"
                    ],
                    "end_time": None,
                }
            )

            scrape_result = scrape_url.delay(
                url, source.id, source.scraping_config or {}
            )

            try:
                result = scrape_result.get(timeout=60)
                if result.get("success"):
                    success += 1
                    process_scrape_result.delay(result)
                else:
                    failed += 1
            except Exception as e:
                logger.error(f"Scrape failed for {url}: {e}")
                failed += 1

            time.sleep(2)

        update_scrape_status(
            {
                "status": "completed",
                "progress": total,
                "total": total,
                "success": success,
                "failed": failed,
                "current_url": "",
                "logs": [
                    f"[{datetime.now().strftime('%H:%M:%S')}] Scrape completed: {success} success, {failed} failed"
                ],
            }
        )

    finally:
        db.close()

    return {"status": "completed", "success": success, "failed": failed}


@app.task(bind=True, base=DatabaseTask, name="workers.tasks.alert_*")
def send_alert_email(self, alert_id: int):
    from backend.core.config import get_settings
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    settings = get_settings()
    db = self.db

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        return {"status": "error", "message": "Alert not found"}

    user = db.query(User).filter(User.id == alert.user_id).first()
    if not user or not user.email:
        return {"status": "error", "message": "User email not found"}

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP not configured, skipping email")
        return {"status": "skipped", "message": "SMTP not configured"}

    try:
        msg = MIMEMultipart()
        msg["From"] = settings.smtp_user
        msg["To"] = user.email
        msg["Subject"] = f"[DWTIP] {alert.severity.upper()}: {alert.title}"

        body = f"""
        <html>
        <body>
        <h2>{alert.title}</h2>
        <p><strong>Severity:</strong> {alert.severity}</p>
        <p><strong>Type:</strong> {alert.alert_type}</p>
        <p><strong>Description:</strong></p>
        <p>{alert.description or "No description provided"}</p>
        <hr>
        <p><small>This alert was generated by DWTIP. <a href="{settings.alert_email}">Manage preferences</a></small></p>
        </body>
        </html>
        """

        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)

        logger.info(f"Alert email sent to {user.email}")
        return {"status": "sent", "recipient": user.email}

    except Exception as e:
        logger.error(f"Failed to send alert email: {e}")
        return {"status": "error", "message": str(e)}


@app.task(bind=True, name="workers.tasks.rotate_tor_circuit")
def rotate_tor_circuit(self):
    import socket

    tor_control = os.environ.get("TOR_CONTROL", "127.0.0.1:9051")
    tor_password = os.environ.get("TOR_PASSWORD", "")

    try:
        host, port = tor_control.split(":")
        port = int(port)

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((host, port))

        if tor_password:
            s.send(f"AUTHENTICATE {tor_password}\r\n".encode())
            response = s.recv(1024)
            if b"250" not in response:
                s.close()
                return {"status": "error", "message": "Tor authentication failed"}

        s.send(b"SIGNAL NEWNYM\r\n")
        response = s.recv(1024)
        s.close()

        logger.info("Tor circuit rotated successfully")
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Failed to rotate Tor circuit: {e}")
        return {"status": "error", "message": str(e)}


@app.task(bind=True, base=DatabaseTask, name="workers.tasks.cleanup_old_alerts")
def cleanup_old_alerts(self, days: int = 90):
    db = self.db

    cutoff = datetime.utcnow() - timedelta(days=days)

    old_alerts = (
        db.query(Alert)
        .filter(Alert.created_at < cutoff, Alert.is_dismissed)
        .all()
    )

    count = len(old_alerts)
    for alert in old_alerts:
        db.delete(alert)

    db.commit()

    logger.info(f"Cleaned up {count} old alerts")
    return {"status": "success", "deleted": count}


@app.task(bind=True, name="workers.tasks.process_*")
def process_ioc_batch(self, ioc_ids: list):
    db = SessionLocal()

    try:
        for ioc_id in ioc_ids:
            ioc = db.query(IOC).filter(IOC.id == ioc_id).first()
            if ioc:
                threat_score = 0.0

                if ioc.type == "ip":
                    if ioc.value.startswith(("10.", "172.16.", "192.168.")):
                        ioc.is_whitelisted = True
                    elif any(x in ioc.value for x in ["1.1.1.1", "8.8.8.8"]):
                        ioc.is_whitelisted = True

                if "test" in ioc.value.lower() or "example" in ioc.value.lower():
                    ioc.false_positive_rate = 0.9

                ioc.threat_score = min(1.0, max(0.0, threat_score))
                ioc.last_seen = datetime.utcnow()

        db.commit()

    finally:
        db.close()

    return {"status": "success", "processed": len(ioc_ids)}
