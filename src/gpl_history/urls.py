from __future__ import annotations

import re
from collections.abc import Iterable
from urllib.parse import urlparse

_URL_RE = re.compile(
    r"(?P<url>(?:https?://|www\.|docs\.google\.com/)[^\s<>\]]+)",
    re.IGNORECASE,
)
_SHEETS_ID_RE = re.compile(r"/spreadsheets/d/(?:e/)?(?P<id>[^/?#]+)", re.IGNORECASE)


def normalize_url(value: str) -> str:
    """Normalize a URL-like string found in free text."""
    cleaned = value.strip().strip("<>[](){}")
    cleaned = cleaned.rstrip(".,;:!")

    while cleaned.endswith(")") and cleaned.count("(") < cleaned.count(")"):
        cleaned = cleaned[:-1].rstrip(".,;:!")

    if cleaned.lower().startswith(("www.", "docs.google.com/")):
        cleaned = f"https://{cleaned}"

    return cleaned


def _append_unique(urls: list[str], candidates: Iterable[str]) -> None:
    seen = set(urls)
    for candidate in candidates:
        normalized = normalize_url(candidate)
        if not normalized or normalized in seen:
            continue
        urls.append(normalized)
        seen.add(normalized)


def extract_urls(text: str | None) -> list[str]:
    """Extract normalized URLs from a YouTube description."""
    if not text:
        return []

    urls: list[str] = []
    bare_urls = [match.group("url") for match in _URL_RE.finditer(text)]
    _append_unique(urls, bare_urls)

    return urls


def resolve_google_sheets_id(url: str) -> str | None:
    """Return the Google Sheets ID from supported public Sheets URL shapes."""
    parsed = urlparse(normalize_url(url))
    if parsed.netloc.lower() != "docs.google.com":
        return None

    match = _SHEETS_ID_RE.search(parsed.path)
    if not match:
        return None
    return match.group("id")
