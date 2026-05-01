#!/usr/bin/env python3
"""
DWTIP - Advanced Dark Web Scraper with Tor
Properly extracts readable content from onion sites
"""

import os
import re
import json
import time
import random
import hashlib
import requests
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
from html.parser import HTMLParser
from bs4 import BeautifulSoup
import urllib.parse

DEEPDARKCTI_PATH = os.environ.get(
    "DEEPDARKCTI_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "deepdarkCTI"),
)
API_URL = os.environ.get("API_URL", "http://localhost:8000")
API_TOKEN = None
SOCKS_PROXY = {"http": "socks5h://127.0.0.1:9050", "https": "socks5h://127.0.0.1:9050"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

requests.packages.urllib3.disable_warnings()

scrape_stats = {
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


def log(msg: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_line = f"[{timestamp}] {msg}"
    print(log_line)
    scrape_stats["logs"].append(log_line)
    if len(scrape_stats["logs"]) > 100:
        scrape_stats["logs"] = scrape_stats["logs"][-100:]


def extract_readable_content(html: str) -> Dict[str, str]:
    """
    Extract meaningful, readable content from HTML using BeautifulSoup
    Returns: {title, summary, full_text, keywords}
    """
    try:
        soup = BeautifulSoup(html, "html.parser")

        for script in soup(["script", "style", "nav", "footer", "header", "noscript"]):
            script.decompose()

        title = ""
        title_tag = soup.find("title")
        if title_tag:
            title = title_tag.get_text().strip()

        if not title:
            h1 = soup.find("h1")
            if h1:
                title = h1.get_text().strip()

        main_content = ""
        for tag in soup.find_all(["div", "article", "main", "section"]):
            if tag.get("class"):
                class_text = " ".join(tag.get("class", []))
                if any(
                    x in class_text.lower()
                    for x in [
                        "content",
                        "post",
                        "article",
                        "entry",
                        "body",
                        "main",
                        "leak",
                    ]
                ):
                    main_content = tag.get_text(separator=" ", strip=True)
                    break

        if not main_content:
            body = soup.find("body")
            if body:
                main_content = body.get_text(separator=" ", strip=True)
            else:
                main_content = soup.get_text(separator=" ", strip=True)

        main_content = re.sub(r"\s+", " ", main_content)
        main_content = main_content.strip()

        words = main_content.split()
        if len(words) > 300:
            summary = " ".join(words[:200])
        else:
            summary = main_content

        keywords = []
        keyword_patterns = [
            r"ransomware",
            r"breach",
            r"leaked",
            r"database",
            r"password",
            r"credential",
            r"bitcoin",
            r"wallet",
            r"payment",
            r"decrypt",
            r"cve-\d{4}-\d+",
            r"exploit",
            r"vulnerability",
            r"attack",
            r"malware",
            r"phishing",
            r"darknet",
            r"onion",
            r"tor",
        ]
        content_lower = html.lower()
        for pattern in keyword_patterns:
            matches = re.findall(pattern, content_lower, re.IGNORECASE)
            keywords.extend(
                [
                    m.lower() if isinstance(m, str) else m
                    for m in set(matches)
                    if len(str(m)) > 3
                ]
            )
        keywords = list(set(keywords))[:10]

        return {
            "title": title[:200] if title else "",
            "summary": summary[:1500],
            "full_text": main_content[:5000],
            "keywords": keywords,
        }
    except Exception as e:
        return {
            "title": "",
            "summary": f"Error parsing content: {str(e)[:100]}",
            "full_text": "",
            "keywords": [],
        }


def detect_leak_info(html: str, url: str) -> Dict[str, Any]:
    """Detect what type of leak/content this is"""
    html_lower = html.lower()
    url_lower = url.lower()

    info = {
        "page_type": "general",
        "severity": "medium",
        "threat_actor": "",
        "victim": "",
        "data_type": [],
        "is_ransomware": False,
    }

    if any(x in url_lower for x in ["leak", "breach", "stolen", "exposed", "dump"]):
        info["page_type"] = "leak_site"

    if any(
        x in html_lower
        for x in ["ransom", "decrypt", "payment", "bitcoin", "wallet", "btc"]
    ):
        info["page_type"] = "ransomware"
        info["is_ransomware"] = True

    if any(x in html_lower for x in ["forum", "market", "marketplace"]):
        info["page_type"] = "marketplace"

    actor_patterns = [
        r"rhysida",
        r"lockbit",
        r"alphv",
        r"blackcat",
        r"conti",
        r"revil",
        r"darkSide",
        r"blackmatter",
        r"hive",
        r"clop",
        r"avaddon",
    ]
    for pattern in actor_patterns:
        if re.search(pattern, html_lower):
            info["threat_actor"] = pattern.upper()
            break

    victim_patterns = [
        r"(?:victim|target|organization|company)[:\s]+([A-Z][a-zA-Z\s]{3,50})",
        r"(?:leaked|stolen|exposed)[:\s]+([A-Z][a-zA-Z\s]{3,50})",
    ]
    for pattern in victim_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            info["victim"] = match.group(1).strip()
            break

    data_types = []
    if any(x in html_lower for x in ["password", "hash", "credential"]):
        data_types.append("credentials")
    if any(x in html_lower for x in ["email", "mail"]):
        data_types.append("emails")
    if any(x in html_lower for x in ["phone", "mobile", "tel"]):
        data_types.append("phone numbers")
    if any(x in html_lower for x in ["ssn", "social security"]):
        data_types.append("SSN")
    if any(x in html_lower for x in ["credit card", "card number"]):
        data_types.append("credit cards")
    if any(x in html_lower for x in ["database", "sql", "dump"]):
        data_types.append("database")
    if any(x in html_lower for x in ["source code", "repo"]):
        data_types.append("source code")
    info["data_type"] = data_types

    if any(
        x in html_lower
        for x in ["critical", "urgent", "massive", "major breach", "100k", "1m", "10m"]
    ):
        info["severity"] = "critical"
    elif (
        any(x in html_lower for x in ["high", "serious", "significant"])
        or info["is_ransomware"]
    ):
        info["severity"] = "high"
    elif any(x in html_lower for x in ["minor", "test", "sample"]):
        info["severity"] = "low"

    return info


def extract_iocs(content: str, source_url: str) -> List[Dict[str, Any]]:
    """Extract IOCs from content"""
    iocs = []

    ip_pattern = r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b"
    ips = re.findall(ip_pattern, content)
    for ip in set(ips):
        if not any(
            ip.startswith(p)
            for p in [
                "0.",
                "10.",
                "127.",
                "192.168.",
                "172.16.",
                "172.31.",
                "255.",
                "169.254.",
            ]
        ):
            iocs.append(
                {
                    "type": "ip",
                    "value": ip,
                    "source_name": "deepdarkCTI",
                    "source_url": source_url,
                    "confidence": 0.7,
                    "tags": ["dark-web", "tor"],
                }
            )

    btc_pattern = r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b"
    for wallet in set(re.findall(btc_pattern, content)):
        iocs.append(
            {
                "type": "crypto_wallet",
                "value": wallet,
                "source_name": "deepdarkCTI",
                "source_url": source_url,
                "confidence": 0.8,
                "tags": ["dark-web", "tor", "bitcoin"],
            }
        )

    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    for email in set(re.findall(email_pattern, content)):
        if not any(
            x in email.lower() for x in ["example.com", "test.com", "localhost"]
        ):
            iocs.append(
                {
                    "type": "email",
                    "value": email,
                    "source_name": "deepdarkCTI",
                    "source_url": source_url,
                    "confidence": 0.6,
                    "tags": ["dark-web", "tor"],
                }
            )

    cve_pattern = r"CVE-\d{4}-\d{4,7}"
    for cve in set(re.findall(cve_pattern, content, re.IGNORECASE)):
        iocs.append(
            {
                "type": "cve",
                "value": cve.upper(),
                "source_name": "deepdarkCTI",
                "source_url": source_url,
                "confidence": 0.95,
                "tags": ["dark-web", "tor", "vulnerability"],
            }
        )

    domain_pattern = r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b"
    for domain in set(re.findall(domain_pattern, content)):
        if (
            not any(
                x in domain.lower()
                for x in ["example.com", "google.com", "facebook.com"]
            )
            and len(domain) > 5
        ):
            iocs.append(
                {
                    "type": "domain",
                    "value": domain.lower(),
                    "source_name": "deepdarkCTI",
                    "source_url": source_url,
                    "confidence": 0.5,
                    "tags": ["dark-web", "tor"],
                }
            )

    return iocs[:30]


def extract_urls_from_file(filepath: str) -> List[Dict[str, str]]:
    """Extract onion URLs from deepdarkCTI markdown"""
    urls = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        category = (
            os.path.basename(filepath).replace(".md", "").replace("_", " ").title()
        )
        onion_pattern = r"http[s]?://[a-z2-7]{10,56}\.onion[a-zA-Z0-9/._\-?=&]*"

        for url in set(re.findall(onion_pattern, content)):
            url = url.strip()
            if len(url) > 20:
                urls.append(
                    {
                        "url": url.split(" ")[0].split(")")[0],
                        "category": category,
                        "source": "deepdarkCTI",
                        "is_onion": True,
                    }
                )
    except Exception as e:
        log(f"Error reading {filepath}: {e}")

    return urls


def get_all_onion_urls() -> List[Dict[str, str]]:
    """Get all onion URLs from deepdarkCTI"""
    all_urls = []

    if not os.path.exists(DEEPDARKCTI_PATH):
        log(f"DeepdarkCTI path not found: {DEEPDARKCTI_PATH}")
        return []

    for filename in os.listdir(DEEPDARKCTI_PATH):
        if filename.endswith(".md"):
            urls = extract_urls_from_file(os.path.join(DEEPDARKCTI_PATH, filename))
            all_urls.extend(urls)

    seen = set()
    unique_urls = []
    for url_data in all_urls:
        if url_data["url"] not in seen:
            seen.add(url_data["url"])
            unique_urls.append(url_data)

    log(f"Found {len(unique_urls)} unique onion URLs")
    return unique_urls


def get_auth_token() -> Optional[str]:
    global API_TOKEN
    if API_TOKEN:
        return API_TOKEN

    username = os.environ.get("SCRAPER_USERNAME", "admin")
    password = os.environ.get(
        "SCRAPER_PASSWORD", os.environ.get("ADMIN_PASSWORD", "admin123")
    )

    try:
        response = requests.post(
            f"{API_URL}/api/v1/auth/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        if response.status_code == 200:
            API_TOKEN = response.json().get("access_token")
            log("Authenticated with API")
            return API_TOKEN
    except Exception as e:
        log(f"Auth failed: {e}")
    return None


def push_ioc(ioc_data: Dict[str, Any]) -> bool:
    token = get_auth_token()
    if not token:
        return False

    try:
        response = requests.post(
            f"{API_URL}/api/v1/iocs",
            json=ioc_data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        return response.status_code in [200, 201, 409]
    except Exception as e:
        log(f"Push IOC failed: {e}")
        return False


def push_leak(leak_data: Dict[str, Any]) -> Optional[int]:
    token = get_auth_token()
    if not token:
        return None

    try:
        response = requests.post(
            f"{API_URL}/api/v1/leaks",
            json=leak_data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if response.status_code in [200, 201]:
            return response.json().get("id")
        elif response.status_code == 409:
            return response.json().get("id")
        return None
    except Exception as e:
        log(f"Push leak failed: {e}")
        return None


def push_alert(alert_data: Dict[str, Any]) -> bool:
    token = get_auth_token()
    if not token:
        return False

    try:
        response = requests.post(
            f"{API_URL}/api/v1/alerts",
            json=alert_data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        if response.status_code in [200, 201]:
            log(f"Alert created: {alert_data['title'][:50]}...")
        return response.status_code in [200, 201, 409]
    except Exception as e:
        log(f"Push alert failed: {e}")
        return False


def scrape_url_with_retry(url_data: Dict[str, Any], retries: int = 3) -> Dict[str, Any]:
    """Scrape URL with retry logic"""
    for attempt in range(retries):
        result = scrape_url_single(url_data)
        if result["success"]:
            return result
        if attempt < retries - 1:
            wait_time = (attempt + 1) * 2
            time.sleep(wait_time)
    return scrape_stats.get(
        "last_result", {"success": False, "error": "All retries failed"}
    )


def scrape_url_single(url_data: Dict[str, Any]) -> Dict[str, Any]:
    global scrape_stats
    url = url_data["url"]
    category = url_data["category"]

    result = {
        "url": url,
        "category": category,
        "success": False,
        "readable_content": {},
        "leak_info": {},
        "error": None,
        "iocs": [],
    }

    scrape_stats["current_url"] = url

    try:
        session = requests.Session()
        session.headers.update(HEADERS)

        response = session.get(
            url,
            proxies=SOCKS_PROXY,
            timeout=45,
            verify=False,
            allow_redirects=True,
            stream=True,
        )

        if response.status_code == 200:
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > 5_000_000:
                result["error"] = "Content too large"
                scrape_stats["failed"] += 1
                log(f"TOO_LARGE {url[:50]}")
                scrape_stats["progress"] += 1
                return result

            html = response.text

            readable = extract_readable_content(html)
            result["readable_content"] = readable

            leak_info = detect_leak_info(html, url)
            result["leak_info"] = leak_info

            iocs = extract_iocs(html, url)
            result["iocs"] = iocs

            result["success"] = True
            scrape_stats["success"] += 1

            title_display = readable["title"][:40] if readable["title"] else url[:40]
            log(f"OK {title_display}... [{leak_info['page_type']}] ({len(iocs)} IOCs)")
        else:
            result["error"] = f"HTTP {response.status_code}"
            scrape_stats["failed"] += 1
            log(f"FAIL {url[:50]} - HTTP {response.status_code}")

    except requests.exceptions.Timeout:
        result["error"] = "Timeout"
        scrape_stats["failed"] += 1
        log(f"TIMEOUT {url[:50]}")
    except requests.exceptions.ConnectionError as e:
        result["error"] = "Connection failed"
        scrape_stats["failed"] += 1
        log(f"CONN_ERR {url[:50]}")
    except requests.exceptions.ContentDecodingError:
        result["error"] = "Decoding error"
        scrape_stats["failed"] += 1
        log(f"DECODE_ERR {url[:50]}")
    except Exception as e:
        result["error"] = str(e)
        scrape_stats["failed"] += 1
        log(f"ERR {url[:50]}")

    scrape_stats["progress"] += 1
    return result


def scrape_url(url_data: Dict[str, Any]) -> Dict[str, Any]:
    return scrape_url_with_retry(url_data, retries=2)


def process_scrape_result(result: Dict[str, Any]) -> bool:
    if not result["success"]:
        return False

    url = result["url"]
    category = result["category"]
    readable = result["readable_content"]
    leak_info = result["leak_info"]

    title = readable.get("title", "") if readable.get("title") else f"[TOR] {category}"
    if not title:
        title = f"[TOR] {category} - {url.split('/')[2][:30]}"
    if len(title) > 150:
        title = title[:150]

    victim = leak_info.get("victim", "") or "Unknown"
    if not leak_info.get("victim") and ".onion" in url:
        match = re.search(r"([a-z2-7]{10,56})\.onion", url)
        if match:
            victim = match.group(1)[:30]

    summary = readable.get("summary", "") if readable.get("summary") else ""
    if summary and len(summary) > 100:
        description = f"Source: {category}\n\n{summary}"
    else:
        description = f"Scraped from {category}. Content analysis detected: {', '.join(leak_info.get('data_type', [])[:3]) or 'general content'}"

    if leak_info.get("threat_actor"):
        description = f"Threat Actor: {leak_info['threat_actor']}\n\n{description}"

    if len(description) > 2000:
        description = description[:2000]

    severity = leak_info.get("severity", "medium")

    tags = [category.lower(), "scraped", "tor", "onion"]
    if leak_info.get("threat_actor"):
        tags.append(leak_info["threat_actor"].lower())
    if leak_info.get("is_ransomware"):
        tags.append("ransomware")
    if leak_info.get("page_type"):
        tags.append(leak_info["page_type"])
    tags.extend(leak_info.get("data_type", [])[:3])

    leak_data = {
        "title": title,
        "description": description,
        "victim_name": victim,
        "severity": severity,
        "source_url": url,
        "source_type": "dark_web",
        "status": "new",
        "tags": tags,
        "published_date": datetime.utcnow().isoformat(),
    }

    leak_id = push_leak(leak_data)

    for ioc in result.get("iocs", [])[:15]:
        push_ioc(ioc)

    if severity in ["critical", "high"]:
        push_alert(
            {
                "title": f"{severity.upper()}: {title[:80]}",
                "description": f"New {severity} severity threat detected from dark web source. Victim: {victim}",
                "severity": severity,
                "alert_type": "threat_detection",
                "source_url": url,
                "related_leak_id": leak_id,
                "tags": tags[:5],
            }
        )

    return True


def save_stats():
    stats_file = "/tmp/dwtip_scrape_status.json"
    with open(stats_file, "w") as f:
        json.dump(scrape_stats, f, indent=2, default=str)


def run_scrape(max_urls: int = 50, max_workers: int = 2):
    global scrape_stats

    log("=" * 60)
    log("DWTIP TOR SCRAPER - Advanced Dark Web Intelligence")
    log("=" * 60)

    scrape_stats = {
        "status": "running",
        "progress": 0,
        "total": 0,
        "success": 0,
        "failed": 0,
        "current_url": "Initializing...",
        "logs": [],
        "start_time": datetime.now().isoformat(),
        "end_time": None,
    }
    save_stats()

    onion_urls = get_all_onion_urls()

    if not onion_urls:
        log("ERROR: No onion URLs found!")
        scrape_stats["status"] = "error"
        save_stats()
        return

    random.shuffle(onion_urls)
    urls_to_scrape = onion_urls[:max_urls]
    scrape_stats["total"] = len(urls_to_scrape)
    save_stats()

    log(f"Target: {len(urls_to_scrape)} onion URLs via Tor")

    total_leaks = 0
    total_iocs = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {
            executor.submit(scrape_url, url_data): url_data
            for url_data in urls_to_scrape
        }

        for future in as_completed(future_to_url):
            result = future.result()

            if process_scrape_result(result):
                total_leaks += 1
                total_iocs += len(result.get("iocs", []))

            save_stats()
            time.sleep(random.uniform(1, 3))

    scrape_stats["status"] = "completed"
    scrape_stats["end_time"] = datetime.now().isoformat()
    save_stats()

    log("=" * 60)
    log("SCRAPE COMPLETE")
    log(
        f"  Total: {scrape_stats['total']} | Success: {scrape_stats['success']} | Failed: {scrape_stats['failed']}"
    )
    log(f"  Leaks: {total_leaks} | IOCs: {total_iocs}")
    log("=" * 60)

    return scrape_stats


if __name__ == "__main__":
    import sys

    max_urls = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 200
    workers = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 4

    result = run_scrape(max_urls=max_urls, max_workers=workers)
    print(json.dumps(result, indent=2, default=str))
