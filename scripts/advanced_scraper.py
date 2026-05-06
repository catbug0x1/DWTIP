#!/usr/bin/env python3
"""
DWTIP Advanced Tor Scraper
Enterprise-grade dark web intelligence collection system
"""

import os
import sys
import re
import json
import time
import random
import hashlib
import logging
import logging.handlers
import sqlite3
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict
from contextlib import contextmanager
from functools import lru_cache
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning)

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup
from bs4.element import Tag, NavigableString
import tldextract

try:
    import stem
    from stem import SocketError, Controller
    from stem.control import EventType

    HAS_STEM = True
except ImportError:
    HAS_STEM = False

try:
    import psycopg2

    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.handlers.RotatingFileHandler(
            "/tmp/dwtip_scraper.log", maxBytes=10 * 1024 * 1024, backupCount=3
        ),
    ],
)
logger = logging.getLogger(__name__)


@dataclass
class ScraperConfig:
    """Scraper configuration"""

    api_url: str = os.environ.get("API_URL", "http://localhost:8000")
    api_token: Optional[str] = None
    tor_proxy: str = os.environ.get("TOR_PROXY", "socks5h://127.0.0.1:9050")
    tor_control_port: int = int(os.environ.get("TOR_CONTROL_PORT", "9051"))
    tor_control_password: str = os.environ.get("TOR_PASSWORD", "")
    deepdarkcti_path: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    deepdarkcti_subdir: str = "deepdarkCTI"
    max_workers: int = int(os.environ.get("MAX_WORKERS", "4"))
    request_timeout: int = 60
    max_retries: int = 3
    circuit_rotate_interval: int = 300
    min_request_delay: float = 1.0
    max_request_delay: float = 3.0
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    status_file: str = "/tmp/dwtip_scrape_status.json"
    db_path: str = "/tmp/dwtip_scraper_cache.db"
    scraper_username: str = os.environ.get("SCRAPER_USERNAME", "admin")
    scraper_password: str = os.environ.get(
        "SCRAPER_PASSWORD", os.environ.get("ADMIN_PASSWORD", "admin123")
    )


@dataclass
class ScrapeResult:
    """Result of scraping a URL"""

    url: str
    success: bool
    status_code: Optional[int] = None
    content_type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    text_content: Optional[str] = None
    iocs: List[Dict[str, Any]] = field(default_factory=list)
    threats: List[Dict[str, Any]] = field(default_factory=list)
    links: List[str] = field(default_factory=list)
    images: List[str] = field(default_factory=list)
    error: Optional[str] = None
    duration: float = 0.0
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class IOC:
    """Indicator of Compromise"""

    type: str
    value: str
    context: str = ""
    source: str = ""
    confidence: float = 0.7
    tags: List[str] = field(default_factory=list)


class TorManager:
    """Manages Tor circuit for anonymity"""

    def __init__(self, config: ScraperConfig):
        self.config = config
        self.controller: Optional[Controller] = None
        self.last_circuit_time = time.time()
        self._lock = threading.Lock()

    def connect(self) -> bool:
        """Connect to Tor control port"""
        if not HAS_STEM:
            logger.warning("Stem library not available. Tor circuit rotation disabled.")
            return False

        try:
            self.controller = Controller.from_port(port=self.config.tor_control_port)
            if self.config.tor_control_password:
                self.controller.authenticate(password=self.config.tor_control_password)
            else:
                self.controller.authenticate()

            logger.info(f"Connected to Tor control port {self.config.tor_control_port}")
            self.controller.add_event_listener(self._circuit_listener, EventType.CIRC)
            return True

        except SocketError as e:
            logger.warning(f"Could not connect to Tor control: {e}")
            return False
        except Exception as e:
            logger.error(f"Tor connection error: {e}")
            return False

    def _circuit_listener(self, event):
        """Listen for circuit events"""
        if event.status == EventType.CIRC:
            pass

    def rotate_circuit(self) -> bool:
        """Request a new Tor circuit"""
        with self._lock:
            if not self.controller:
                return False

            try:
                self.controller.signal(stem.Signal.NEWNYM)
                self.last_circuit_time = time.time()
                logger.info("Tor circuit rotated")
                return True
            except Exception as e:
                logger.error(f"Failed to rotate circuit: {e}")
                return False

    def should_rotate(self) -> bool:
        """Check if circuit should be rotated"""
        elapsed = time.time() - self.last_circuit_time
        return elapsed >= self.config.circuit_rotate_interval

    def close(self):
        """Close Tor connection"""
        if self.controller:
            try:
                self.controller.remove_event_listener(self._circuit_listener)
                self.controller.close()
            except:
                pass


class SessionManager:
    """Manages HTTP sessions with Tor"""

    def __init__(self, config: ScraperConfig):
        self.config = config
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Create a new requests session with Tor proxy"""
        session = requests.Session()

        session.proxies = {
            "http": self.config.tor_proxy,
            "https": self.config.tor_proxy,
        }

        retry_strategy = Retry(
            total=self.config.max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"],
        )

        adapter = HTTPAdapter(
            max_retries=retry_strategy, pool_connections=10, pool_maxsize=20
        )

        session.mount("http://", adapter)
        session.mount("https://", adapter)

        session.headers.update(
            {
                "User-Agent": self.config.user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Accept-Encoding": "gzip, deflate",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )

        return session

    def get(self, url: str, **kwargs) -> requests.Response:
        """Make GET request"""
        kwargs.setdefault("timeout", self.config.request_timeout)
        kwargs.setdefault("verify", False)
        return self.session.get(url, **kwargs)

    def post(self, url: str, **kwargs) -> requests.Response:
        """Make POST request"""
        kwargs.setdefault("timeout", self.config.request_timeout)
        kwargs.setdefault("verify", False)
        return self.session.post(url, **kwargs)

    def reset(self):
        """Reset session (for new circuit)"""
        self.session.close()
        self.session = self._create_session()


class IOCExtractor:
    """Extracts Indicators of Compromise from text"""

    PATTERNS = {
        "ipv4": re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b"),
        "ipv6": re.compile(r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b"),
        "email": re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", re.IGNORECASE
        ),
        "btc": re.compile(r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b"),
        "btc_segwit": re.compile(r"\bbc1[a-z0-9]{39,59}\b", re.IGNORECASE),
        "eth": re.compile(r"\b0x[a-fA-F0-9]{40}\b"),
        "xmr": re.compile(r"\b4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b"),
        "cve": re.compile(r"\bCVE-\d{4}-\d{4,}\b", re.IGNORECASE),
        "md5": re.compile(r"\b[a-fA-F0-9]{32}\b"),
        "sha1": re.compile(r"\b[a-fA-F0-9]{40}\b"),
        "sha256": re.compile(r"\b[a-fA-F0-9]{64}\b"),
        "domain": re.compile(
            r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b",
            re.IGNORECASE,
        ),
        "onion_v2": re.compile(r"\b[a-z2-7]{56}\.onion\b", re.IGNORECASE),
        "onion_v3": re.compile(r"\b[a-z2-7]{56}\.onion\b", re.IGNORECASE),
        "url": re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+', re.IGNORECASE),
        "phone": re.compile(
            r"\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b"
        ),
        "iban": re.compile(
            r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]?){0,16}\b", re.IGNORECASE
        ),
        "cc": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    }

    THREAT_KEYWORDS = {
        "ransomware": [
            "ransomware",
            "ransom",
            "lockbit",
            "conti",
            "blackcat",
            "alphv",
            "revil",
            "hive",
            "clop",
            "darkside",
            "avaddon",
            "rhysida",
            "lockbit3",
        ],
        "breach": [
            "breach",
            "leaked",
            "exposed",
            "stolen data",
            "compromised",
            "dumped",
            "database leak",
        ],
        "credentials": [
            "password",
            "credential",
            "login",
            "username",
            "credential dump",
            "password list",
        ],
        "malware": ["malware", "trojan", "backdoor", "keylogger", "stealer", " RAT "],
        "exploit": ["exploit", "0day", "zero-day", "vulnerability", "CVE-"],
        "phishing": ["phishing", "spoof", "fake login", "credential harvest"],
    }

    def __init__(self):
        self.whitelist = self._load_whitelist()

    def _load_whitelist(self) -> set:
        """Load whitelisted values"""
        return {
            "1.1.1.1",
            "8.8.8.8",
            "8.8.4.4",
            "1.0.0.1",
            "1.0.0.2",
            "127.0.0.1",
            "localhost",
            "0.0.0.0",
            "google.com",
            "facebook.com",
            "twitter.com",
            "github.com",
            "example.com",
            "test.com",
            "localhost.localdomain",
        }

    def is_whitelisted(self, ioc_type: str, value: str) -> bool:
        """Check if IOC is whitelisted"""
        if value.lower() in self.whitelist:
            return True

        if ioc_type == "ipv4":
            parts = value.split(".")
            if len(parts) == 4:
                if parts[0] in ("10", "127", "192", "172"):
                    if parts[0] == "172" and 16 <= int(parts[1]) <= 31:
                        return True
                    if parts[0] in ("10", "127", "192"):
                        return True

        if ioc_type in ("md5", "sha1", "sha256"):
            if value.lower() in ("0" * 32, "0" * 40, "0" * 64):
                return True

        return False

    def extract(self, text: str, url: str = "") -> List[IOC]:
        """Extract IOCs from text"""
        iocs = []
        seen = set()

        for ioc_type, pattern in self.PATTERNS.items():
            for match in pattern.finditer(text):
                value = match.group().strip()
                if len(value) < 4 or len(value) > 200:
                    continue

                normalized = f"{ioc_type}:{value.lower()}"
                if normalized in seen:
                    continue
                seen.add(normalized)

                if self.is_whitelisted(ioc_type, value):
                    continue

                context = text[
                    max(0, match.start() - 50) : min(len(text), match.end() + 50)
                ]

                confidence = self._calculate_confidence(ioc_type, value, context)

                iocs.append(
                    IOC(
                        type=self._normalize_type(ioc_type),
                        value=value,
                        context=context.strip(),
                        source=url,
                        confidence=confidence,
                        tags=self._extract_tags(context),
                    )
                )

        return iocs

    def _normalize_type(self, pattern_type: str) -> str:
        """Normalize IOC type names"""
        mapping = {
            "ipv4": "ip",
            "ipv6": "ip",
            "btc": "crypto_wallet",
            "btc_segwit": "crypto_wallet",
            "eth": "crypto_wallet",
            "xmr": "crypto_wallet",
            "onion_v2": "onion_url",
            "onion_v3": "onion_url",
            "cc": "credit_card",
        }
        return mapping.get(pattern_type, pattern_type)

    def _calculate_confidence(self, ioc_type: str, value: str, context: str) -> float:
        """Calculate confidence score"""
        confidence = 0.5

        context_lower = context.lower()

        if any(kw in context_lower for kw in ["list", "dump", "leak", "stolen"]):
            confidence += 0.2

        if any(kw in context_lower for kw in ["ransomware", "malware", "exploit"]):
            confidence += 0.15

        if ioc_type == "ipv4":
            octets = value.split(".")
            if len(octets) == 4 and all(0 <= int(o) <= 255 for o in octets):
                confidence += 0.2

        if ioc_type in ("md5", "sha1", "sha256"):
            if re.match(r"^[a-fA-F0-9]+$", value):
                confidence += 0.15

        if ioc_type == "email":
            if re.match(r"^[\w.-]+@[\w.-]+\.\w+$", value):
                confidence += 0.2

        return min(1.0, confidence)

    def _extract_tags(self, context: str) -> List[str]:
        """Extract relevant tags from context"""
        tags = []
        context_lower = context.lower()

        for category, keywords in self.THREAT_KEYWORDS.items():
            if any(kw in context_lower for kw in keywords):
                tags.append(category)

        return list(set(tags))


class ContentExtractor:
    """Extracts structured content from web pages"""

    def __init__(self):
        self.text_cleaner = re.compile(r"\s+")

    def extract(self, html: str, url: str) -> Dict[str, Any]:
        """Extract structured content from HTML"""
        soup = BeautifulSoup(html, "html.parser")

        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()

        title = self._extract_title(soup)
        main_content = self._extract_main_content(soup)
        text = self._clean_text(main_content)
        links = self._extract_links(soup, url)
        images = self._extract_images(soup, url)
        metadata = self._extract_metadata(soup)

        return {
            "title": title,
            "content": main_content,
            "text": text,
            "links": links,
            "images": images,
            "metadata": metadata,
            "url": url,
            "word_count": len(text.split()),
            "extracted_at": datetime.utcnow().isoformat(),
        }

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title"""
        if soup.title:
            return soup.title.string.strip() if soup.title.string else ""

        h1 = soup.find("h1")
        if h1:
            return h1.get_text().strip()

        return ""

    def _extract_main_content(self, soup: BeautifulSoup) -> str:
        """Extract main content area"""
        article = soup.find("article")
        if article:
            return article.get_text(separator="\n", strip=True)

        main = soup.find("main")
        if main:
            return main.get_text(separator="\n", strip=True)

        content_div = soup.find(
            "div", class_=re.compile(r"content|article|post|entry|body", re.I)
        )
        if content_div:
            return content_div.get_text(separator="\n", strip=True)

        body = soup.find("body")
        if body:
            return body.get_text(separator="\n", strip=True)

        return ""

    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract all links from page"""
        links = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("//"):
                href = "https:" + href
            elif href.startswith("/"):
                parsed = tldextract.extract(base_url)
                href = f"{parsed.registered_domain}{href}"

            if href.startswith("http"):
                links.append(href)

        return list(set(links))[:100]

    def _extract_images(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Extract all images from page"""
        images = []
        for img in soup.find_all("img", src=True):
            src = img["src"]
            if src.startswith("//"):
                src = "https:" + src
            elif src.startswith("/"):
                parsed = tldextract.extract(base_url)
                src = f"{parsed.registered_domain}{src}"

            if src.startswith("http"):
                images.append(src)

        return list(set(images))[:50]

    def _extract_metadata(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract metadata"""
        metadata = {}

        for meta in soup.find_all("meta"):
            name = meta.get("name", meta.get("property", ""))
            content = meta.get("content", "")
            if name and content:
                metadata[name] = content

        return metadata

    def _clean_text(self, text: str) -> str:
        """Clean extracted text"""
        text = self.text_cleaner.sub(" ", text)
        return text.strip()


class Scraper:
    """Main scraper class"""

    def __init__(self, config: Optional[ScraperConfig] = None):
        self.config = config or ScraperConfig()
        self.tor = TorManager(self.config)
        self.session = SessionManager(self.config)
        self.direct_session = requests.Session()
        self.ioc_extractor = IOCExtractor()
        self.content_extractor = ContentExtractor()
        self.status = self._load_status()
        self._lock = threading.Lock()

    def _load_status(self) -> Dict[str, Any]:
        """Load scrape status from file"""
        try:
            with open(self.config.status_file, "r") as f:
                return json.load(f)
        except:
            return {
                "status": "idle",
                "progress": 0,
                "total": 0,
                "success": 0,
                "failed": 0,
                "current_url": "",
                "logs": [],
                "start_time": None,
                "end_time": None,
            }

    def _save_status(self):
        """Save scrape status to file"""
        with open(self.config.status_file, "w") as f:
            json.dump(self.status, f, indent=2)

    def _log(self, message: str, level: str = "INFO"):
        """Log message and update status"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}"

        getattr(logger, level.lower(), logger.info)(message)

        with self._lock:
            self.status["logs"].append(log_entry)
            if len(self.status["logs"]) > 100:
                self.status["logs"] = self.status["logs"][-100:]
            self._save_status()

    def authenticate_api(self) -> bool:
        """Authenticate with the API (direct, no Tor)"""
        try:
            direct_session = requests.Session()
            response = direct_session.post(
                f"{self.config.api_url}/api/v1/auth/login",
                data={
                    "username": self.config.scraper_username,
                    "password": self.config.scraper_password,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code == 200:
                data = response.json()
                self.config.api_token = data.get("access_token")
                self._log("Authenticated with API")
                return True
            else:
                self._log(f"API authentication failed: {response.status_code}", "ERROR")
                return False

        except Exception as e:
            self._log(f"API authentication error: {e}", "ERROR")
            return False

    def load_onion_urls(self) -> List[Dict[str, Any]]:
        """Load onion URLs from deepdarkCTI directory"""
        urls = []
        deepdark_path = Path(self.config.deepdarkcti_path)

        if not deepdark_path.exists():
            self._log(f"DeepDarkCTI path not found: {deepdark_path}", "WARNING")
            return self._load_from_database()

        categories = {
            "ransomware": ["ransomware_gang"],
            "forum": ["forum"],
            "marketplace": ["markets", "counterfeit_goods"],
            "search": ["search_engines"],
            "other": ["others"],
        }

        for category, subdirs in categories.items():
            for subdir in subdirs:
                md_file = (
                    deepdark_path / self.config.deepdarkcti_subdir / f"{subdir}.md"
                )
                if md_file.exists():
                    try:
                        with open(md_file, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()

                        found_urls = re.findall(
                            r"http[^\s<>\"{}|\\^`\[\]]*\.onion[^\s<>\"{}|\\^`\[\]]*",
                            content,
                        )

                        for url in found_urls:
                            urls.append(
                                {
                                    "url": url.split()[0] if " " in url else url,
                                    "category": category,
                                    "source": md_file.name,
                                }
                            )

                    except Exception as e:
                        self._log(f"Error reading {md_file}: {e}", "WARNING")

        self._log(f"Found {len(urls)} onion URLs from deepdarkCTI")
        return urls

    def _load_from_database(self) -> List[Dict[str, Any]]:
        """Load URLs from database (direct, no Tor)"""
        if not self.config.api_token:
            self.authenticate_api()

        if not self.config.api_token:
            return []

        try:
            direct_session = requests.Session()
            response = direct_session.get(
                f"{self.config.api_url}/api/v1/sources",
                params={"limit": 1000, "is_onion": True},
                headers={"Authorization": f"Bearer {self.config.api_token}"},
            )

            if response.status_code == 200:
                data = response.json()
                urls = []
                for source in data.get("sources", []):
                    url = source.get("url") or source.get("onion_url")
                    if url:
                        urls.append(
                            {
                                "url": url,
                                "category": source.get("type", "other"),
                                "source": "database",
                            }
                        )

                self._log(f"Loaded {len(urls)} URLs from database")
                return urls

        except Exception as e:
            self._log(f"Error loading from database: {e}", "ERROR")

        return []

    def scrape_url(self, url_data: Dict[str, Any]) -> ScrapeResult:
        """Scrape a single URL"""
        url = url_data.get("url", "")
        start_time = time.time()

        result = ScrapeResult(url=url, success=False)

        try:
            if self.tor.should_rotate():
                self.tor.rotate_circuit()
                self.session.reset()
                time.sleep(1)

            response = self.session.get(url)
            result.status_code = response.status_code
            result.content_type = response.headers.get("Content-Type", "")

            if response.status_code == 200:
                content = response.text
                result.content = content[:100000]

                extracted = self.content_extractor.extract(content, url)
                result.title = extracted["title"]
                result.text_content = extracted["text"]
                result.links = extracted["links"]
                result.images = extracted["images"]

                result.iocs = self.ioc_extractor.extract(extracted["text"], url)
                result.threats = self._detect_threats(
                    extracted["text"], extracted["title"]
                )

                result.success = True
                self._log(
                    f"OK {extracted['title'][:40]}... [{url_data.get('category', 'unknown')}] ({len(result.iocs)} IOCs)"
                )
            else:
                result.error = f"HTTP {response.status_code}"
                self._log(f"FAIL {url} - {result.error}", "WARNING")

        except requests.exceptions.Timeout:
            result.error = "Timeout"
            self._log(f"TIMEOUT {url}", "WARNING")
        except requests.exceptions.ConnectionError:
            result.error = "Connection Error"
            self._log(f"CONN_ERR {url}", "WARNING")
        except Exception as e:
            result.error = str(e)
            self._log(f"ERROR {url}: {e}", "ERROR")

        result.duration = time.time() - start_time

        if random.random() < 0.3:
            time.sleep(
                random.uniform(
                    self.config.min_request_delay, self.config.max_request_delay
                )
            )

        return result

    def _detect_threats(self, text: str, title: str) -> List[Dict[str, Any]]:
        """Detect potential threats in content"""
        threats = []
        text_lower = text.lower()
        title_lower = title.lower()

        threat_indicators = {
            "ransomware_leak": {
                "keywords": [
                    "ransomware",
                    "ransom",
                    "lockbit",
                    "conti",
                    "blackcat",
                    "alphv",
                    "revil",
                    "hive",
                ],
                "severity": "critical",
            },
            "data_breach": {
                "keywords": [
                    "breach",
                    "leaked",
                    "database",
                    "exposed",
                    "stolen",
                    "compromised",
                ],
                "severity": "high",
            },
            "credential_dump": {
                "keywords": [
                    "password",
                    "credential",
                    "login",
                    "username",
                    "dump",
                    "combo",
                ],
                "severity": "medium",
            },
            "malware_distribution": {
                "keywords": ["malware", "trojan", "backdoor", "payload", "exploit kit"],
                "severity": "high",
            },
            "phishing": {
                "keywords": ["phishing", "spoof", "fake login", "credential harvest"],
                "severity": "medium",
            },
        }

        for threat_type, config in threat_indicators.items():
            if any(kw in text_lower or kw in title_lower for kw in config["keywords"]):
                threats.append(
                    {
                        "type": threat_type,
                        "severity": config["severity"],
                        "timestamp": datetime.utcnow().isoformat(),
                    }
                )

        return threats

    def push_results(self, result: ScrapeResult, category: str = "other"):
        """Push scrape results to API"""
        if not self.config.api_token:
            self.authenticate_api()

        if not self.config.api_token:
            return

        try:
            self.direct_session.post(
                f"{self.config.api_url}/api/v1/scrape/results",
                json={
                    "url": result.url,
                    "success": result.success,
                    "status_code": result.status_code,
                    "title": result.title,
                    "content": result.text_content[:5000]
                    if result.text_content
                    else None,
                    "category": category,
                },
                headers={
                    "Authorization": f"Bearer {self.config.api_token}",
                    "Content-Type": "application/json",
                },
            )

            for ioc in result.iocs:
                self.direct_session.post(
                    f"{self.config.api_url}/api/v1/iocs",
                    json={
                        "type": ioc.type,
                        "value": ioc.value,
                        "source_name": result.url,
                        "confidence": ioc.confidence,
                        "context": ioc.context,
                        "tags": ioc.tags,
                    },
                    headers={
                        "Authorization": f"Bearer {self.config.api_token}",
                        "Content-Type": "application/json",
                    },
                )

            for threat in result.threats:
                self.direct_session.post(
                    f"{self.config.api_url}/api/v1/leaks",
                    json={
                        "title": f"Threat Detected: {threat['type']}",
                        "description": f"Potential {threat['type']} detected on {result.url}",
                        "source_url": result.url,
                        "severity": threat["severity"],
                        "status": "new",
                    },
                    headers={
                        "Authorization": f"Bearer {self.config.api_token}",
                        "Content-Type": "application/json",
                    },
                )

        except Exception as e:
            self._log(f"Error pushing results: {e}", "ERROR")

    def run(self, limit: int = 50, workers: int = None):
        """Run the scraper"""
        workers = workers or self.config.max_workers

        self.tor.connect()
        self.authenticate_api()

        self.status = {
            "status": "running",
            "progress": 0,
            "total": limit,
            "success": 0,
            "failed": 0,
            "current_url": "",
            "logs": [],
            "start_time": datetime.now().isoformat(),
            "end_time": None,
        }
        self._save_status()

        self._log("=" * 60)
        self._log("DWTIP Advanced Tor Scraper - Enterprise Edition")
        self._log("=" * 60)

        urls = self.load_onion_urls()
        if not urls:
            self._log("No URLs to scrape", "ERROR")
            return

        urls = random.sample(urls, min(limit, len(urls)))
        self.status["total"] = len(urls)
        self._save_status()

        self._log(f"Target: {len(urls)} onion URLs with {workers} workers")

        total_iocs = 0
        total_threats = 0

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self.scrape_url, url_data): url_data
                for url_data in urls
            }

            for idx, future in enumerate(as_completed(futures)):
                url_data = futures[future]

                try:
                    result = future.result()

                    if result.success:
                        self.status["success"] += 1
                        total_iocs += len(result.iocs)
                        total_threats += len(result.threats)
                        self.push_results(result, url_data.get("category", "other"))
                    else:
                        self.status["failed"] += 1

                    self.status["progress"] = idx + 1
                    self.status["current_url"] = result.url
                    self._save_status()

                except Exception as e:
                    self._log(f"Future error: {e}", "ERROR")
                    self.status["failed"] += 1

        self.status["status"] = "completed"
        self.status["end_time"] = datetime.now().isoformat()
        self._save_status()

        self._log("=" * 60)
        self._log("SCRAPE COMPLETE")
        self._log(
            f"  Total: {len(urls)} | Success: {self.status['success']} | Failed: {self.status['failed']}"
        )
        self._log(f"  IOCs: {total_iocs} | Threats: {total_threats}")
        self._log("=" * 60)

        self.tor.close()

        return self.status

    def stop(self):
        """Stop the scraper"""
        self.status["status"] = "stopped"
        self.status["end_time"] = datetime.now().isoformat()
        self._save_status()
        self._log("Scraper stopped by user")

        if self.tor.controller:
            self.tor.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="DWTIP Advanced Tor Scraper")
    parser.add_argument(
        "limit", type=int, nargs="?", default=50, help="Number of URLs to scrape"
    )
    parser.add_argument(
        "-w", "--workers", type=int, default=None, help="Number of worker threads"
    )
    parser.add_argument("-t", "--tor-proxy", default=None, help="Tor SOCKS proxy URL")
    parser.add_argument("-a", "--api-url", default=None, help="API base URL")
    parser.add_argument("--status-file", default=None, help="Status file path")

    args = parser.parse_args()

    config = ScraperConfig()

    if args.tor_proxy:
        config.tor_proxy = args.tor_proxy
    if args.api_url:
        config.api_url = args.api_url
    if args.status_file:
        config.status_file = args.status_file

    scraper = Scraper(config)

    try:
        scraper.run(limit=args.limit, workers=args.workers)
    except KeyboardInterrupt:
        scraper.stop()
        print("\nScraper interrupted")


if __name__ == "__main__":
    main()
