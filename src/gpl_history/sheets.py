from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import requests

from .storage import ensure_dir, safe_slug
from .urls import normalize_url, resolve_google_sheets_id

USER_AGENT = "gpl-history/1.0 (+https://github.com/FullLifeGames/GPLHistoryVisualizer)"


def resolve_redirect(url: str, timeout: int = 12) -> dict[str, Any]:
    normalized = normalize_url(url)
    try:
        response = requests.get(
            normalized,
            allow_redirects=True,
            headers={"User-Agent": USER_AGENT},
            stream=True,
            timeout=timeout,
        )
        response.close()
    except requests.RequestException as exc:
        return {
            "url": normalized,
            "resolved_url": None,
            "status_code": None,
            "ok": False,
            "error": str(exc),
            "redirect_chain": [],
        }

    return {
        "url": normalized,
        "resolved_url": response.url,
        "status_code": response.status_code,
        "ok": response.ok,
        "error": None if response.ok else response.reason,
        "redirect_chain": [entry.url for entry in response.history],
    }


def gid_from_url(url: str) -> str | None:
    parsed = urlparse(normalize_url(url))
    params = parse_qs(parsed.query)
    if "gid" in params and params["gid"]:
        return params["gid"][0]
    fragment_params = parse_qs(parsed.fragment)
    if "gid" in fragment_params and fragment_params["gid"]:
        return fragment_params["gid"][0]
    match = re.search(r"gid=([0-9]+)", url)
    if match:
        return match.group(1)
    return None


def is_published_sheet_url(url: str) -> bool:
    parsed = urlparse(normalize_url(url))
    return parsed.netloc.lower() == "docs.google.com" and "/spreadsheets/d/e/" in parsed.path


def fetch_public_sheet_tables(source_url: str, out_dir: Path, timeout: int = 20) -> list[dict[str, Any]]:
    sheet_id = resolve_google_sheets_id(source_url)
    if not sheet_id:
        return []

    ensure_dir(out_dir)
    candidates = _csv_export_candidates(source_url, sheet_id)
    seen_export_urls: set[str] = set()
    results: list[dict[str, Any]] = []

    for label, export_url, gid in candidates:
        if export_url in seen_export_urls:
            continue
        seen_export_urls.add(export_url)
        result = _fetch_csv(export_url, timeout=timeout)
        filename = _sheet_csv_filename(sheet_id, label)
        raw_path = out_dir / filename
        status = "available" if result["rows"] else "unavailable"
        if result["text"]:
            raw_path.write_text(result["text"], encoding="utf-8", newline="")
        rows = _parse_csv(result["text"]) if result["rows"] else []
        results.append(
            {
                "sheet_id": sheet_id,
                "gid": gid,
                "label": label,
                "source_url": source_url,
                "export_url": export_url,
                "raw_path": str(raw_path).replace("\\", "/") if result["text"] else None,
                "status": status,
                "status_code": result["status_code"],
                "error": result["error"],
                "rows": len(rows),
                "columns": max((len(row) for row in rows), default=0),
            }
        )
    return results


def discover_gids(source_url: str, timeout: int = 12) -> list[str]:
    if is_published_sheet_url(source_url):
        return []
    try:
        response = requests.get(
            normalize_url(source_url),
            headers={"User-Agent": USER_AGENT},
            timeout=timeout,
        )
    except requests.RequestException:
        return []
    if not response.ok:
        return []
    gids = set(re.findall(r"(?:gid=|\"sheetId\":)([0-9]+)", response.text))
    return sorted(gids)


def _csv_export_candidates(source_url: str, sheet_id: str) -> list[tuple[str, str, str | None]]:
    normalized = normalize_url(source_url)
    parsed = urlparse(normalized)
    gid = gid_from_url(normalized)
    candidates: list[tuple[str, str, str | None]] = []

    if is_published_sheet_url(normalized):
        candidates.append(("published", f"https://docs.google.com/spreadsheets/d/e/{sheet_id}/pub?output=csv", None))
        return candidates

    gids = [gid] if gid else []
    gids.extend(discovered for discovered in discover_gids(normalized) if discovered not in gids)
    if not gids:
        gids = [None]

    for item_gid in gids:
        params = {"format": "csv"}
        if item_gid:
            params["gid"] = item_gid
        export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?{urlencode(params)}"
        label = f"gid_{item_gid}" if item_gid else "default"
        candidates.append((label, export_url, item_gid))

    if parsed.path.endswith("/pubhtml") or "/pub" in parsed.path:
        candidates.append(("published", f"https://docs.google.com/spreadsheets/d/{sheet_id}/pub?output=csv", None))

    return candidates


def _fetch_csv(url: str, timeout: int) -> dict[str, Any]:
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
    except requests.RequestException as exc:
        return {"text": "", "rows": False, "status_code": None, "error": str(exc)}

    text = _decode_response_content(response.content)
    if not response.ok:
        return {"text": text, "rows": False, "status_code": response.status_code, "error": response.reason}

    parsed_rows = _parse_csv(text)
    looks_like_html = text.lstrip().lower().startswith("<!doctype") or text.lstrip().lower().startswith("<html")
    has_table_data = bool(parsed_rows and any(any(cell.strip() for cell in row) for row in parsed_rows))
    if looks_like_html or not has_table_data:
        return {
            "text": text,
            "rows": False,
            "status_code": response.status_code,
            "error": "Response did not look like CSV table data",
        }
    return {"text": text, "rows": True, "status_code": response.status_code, "error": None}


def _parse_csv(text: str) -> list[list[str]]:
    if not text:
        return []
    return [row for row in csv.reader(io.StringIO(text))]


def _sheet_csv_filename(sheet_id: str, label: str) -> str:
    return f"{safe_slug(sheet_id)}_{safe_slug(label)}.csv"


def _decode_response_content(content: bytes) -> str:
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("utf-8", errors="replace")
