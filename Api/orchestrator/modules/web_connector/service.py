import asyncio
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Env knobs
DOMAINS_WHITELIST = os.getenv("DOMAINS_WHITELIST", "localhost,127.0.0.1").split(",")
WEB_TIMEOUT = float(os.getenv("WEB_CONNECTOR_TIMEOUT", "20"))

# Very small in-memory TTL cache to avoid repeated fetches
_cache: Dict[str, Dict[str, object]] = {}
_CACHE_TTL = int(os.getenv("WEB_CACHE_TTL", "300"))


def _is_allowed(url: str) -> bool:
    try:
        host = url.split("//", 1)[1].split("/", 1)[0]
        return any(host.startswith(d.strip()) for d in DOMAINS_WHITELIST if d.strip())
    except Exception:
        return False


def _strip_html(html: str, max_len: int = 4000) -> str:
    # Very basic HTML to text: remove tags and collapse whitespace
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:max_len]


async def fetch_url_text(url: str) -> Dict[str, object]:
    """Fetch URL and return normalized text snippet. Respects whitelist + timeouts.
    Returns dict with status_code, content_type, content_snippet, fetched_at.
    """
    # Cache check
    now = datetime.utcnow()
    cached = _cache.get(url)
    if cached:
        exp = cached.get("expires_at")
        if isinstance(exp, datetime) and exp > now:
            return cached["data"]  # type: ignore

    if not _is_allowed(url):
        return {
            "status_code": 451,
            "content_type": None,
            "content_snippet": "Domain not allowed by whitelist",
            "fetched_at": now.isoformat()
        }

    async with httpx.AsyncClient(timeout=httpx.Timeout(WEB_TIMEOUT, connect=10)) as client:
        resp = await client.get(url, headers={"User-Agent": "Multi-IA-WebConnector/1.0"})
        content_type = resp.headers.get("content-type")
        snippet = _strip_html(resp.text)
        data = {
            "status_code": resp.status_code,
            "content_type": content_type,
            "content_snippet": snippet,
            "fetched_at": now.isoformat(),
        }
        _cache[url] = {"data": data, "expires_at": now + timedelta(seconds=_CACHE_TTL)}
        return data


async def search_stub(query: str) -> Dict[str, object]:
    """Placeholder search when no external API is configured.
    Returns empty results but structured payload.
    """
    return {
        "query": query,
        "results": [],
        "fetched_at": datetime.utcnow().isoformat(),
    }
