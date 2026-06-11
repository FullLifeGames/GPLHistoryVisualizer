from __future__ import annotations

import csv
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

from .storage import ensure_dir, safe_slug


class SheetsApiError(RuntimeError):
    pass


@dataclass(frozen=True)
class SheetsApiClient:
    api_key: str
    timeout: int = 30
    retry_after_seconds: int = 65

    base_url = "https://sheets.googleapis.com/v4/spreadsheets"

    def metadata(self, spreadsheet_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base_url}/{spreadsheet_id}",
            params={
                "fields": "properties(title),sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount)))",
                "key": self.api_key,
            },
            timeout=self.timeout,
        )
        payload = _json_response(response, "metadata", spreadsheet_id)
        return payload

    def values(self, spreadsheet_id: str, sheet_title: str) -> list[list[str]]:
        response = requests.get(
            f"{self.base_url}/{spreadsheet_id}/values/{_quote_sheet_title(sheet_title)}",
            params={
                "majorDimension": "ROWS",
                "valueRenderOption": "FORMATTED_VALUE",
                "key": self.api_key,
            },
            timeout=self.timeout,
        )
        payload = _json_response(response, "values", spreadsheet_id)
        return payload.get("values", [])

    def batch_values(self, spreadsheet_id: str, tabs: list[dict[str, Any]]) -> dict[str, list[list[str]]]:
        params: list[tuple[str, str]] = [
            ("majorDimension", "ROWS"),
            ("valueRenderOption", "FORMATTED_VALUE"),
            ("key", self.api_key),
        ]
        for tab in tabs:
            params.append(("ranges", _quote_sheet_title(tab["title"])))
        response = requests.get(
            f"{self.base_url}/{spreadsheet_id}/values:batchGet",
            params=params,
            timeout=self.timeout,
        )
        if response.status_code == 429 and self.retry_after_seconds > 0:
            time.sleep(self.retry_after_seconds)
            response = requests.get(
                f"{self.base_url}/{spreadsheet_id}/values:batchGet",
                params=params,
                timeout=self.timeout,
            )
        payload = _json_response(response, "batch values", spreadsheet_id)
        return _values_by_title(payload, tabs)

    def fetch_visible_tabs(self, spreadsheet_id: str, out_dir: Path, source_url: str) -> list[dict[str, Any]]:
        metadata = self.metadata(spreadsheet_id)
        tabs = visible_sheet_tabs(metadata)
        values_by_title = self.batch_values(spreadsheet_id, tabs) if tabs else {}
        ensure_dir(out_dir)
        results: list[dict[str, Any]] = []
        for tab in tabs:
            rows = values_by_title.get(tab["title"], [])
            filename = api_tab_csv_filename(spreadsheet_id, tab["gid"], tab["title"])
            raw_path = out_dir / filename
            _write_csv_rows(raw_path, rows)
            results.append(
                {
                    "sheet_id": spreadsheet_id,
                    "workbook_title": metadata.get("properties", {}).get("title"),
                    "gid": tab["gid"],
                    "title": tab["title"],
                    "index": tab["index"],
                    "source_url": source_url,
                    "raw_path": str(raw_path).replace("\\", "/"),
                    "status": "available",
                    "status_code": 200,
                    "error": None,
                    "rows": len(rows),
                    "columns": max((len(row) for row in rows), default=0),
                    "fetch_method": "sheets_api",
                }
            )
        return results


def visible_sheet_tabs(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tabs: list[dict[str, Any]] = []
    for sheet in payload.get("sheets", []):
        props = sheet.get("properties", {})
        if props.get("hidden"):
            continue
        grid = props.get("gridProperties", {})
        tabs.append(
            {
                "gid": str(props.get("sheetId")),
                "title": props.get("title"),
                "index": props.get("index"),
                "row_count": grid.get("rowCount"),
                "column_count": grid.get("columnCount"),
            }
        )
    tabs.sort(key=lambda item: item.get("index") if item.get("index") is not None else 999999)
    return tabs


def api_tab_csv_filename(spreadsheet_id: str, gid: str, title: str) -> str:
    return f"{safe_slug(spreadsheet_id)}_{safe_slug(title, 'sheet')}_{safe_slug(gid)}.csv"


def _values_by_title(payload: dict[str, Any], tabs: list[dict[str, Any]]) -> dict[str, list[list[str]]]:
    values_by_title: dict[str, list[list[str]]] = {}
    for tab, value_range in zip(tabs, payload.get("valueRanges", [])):
        values_by_title[tab["title"]] = value_range.get("values", [])
    return values_by_title


def _json_response(response: requests.Response, action: str, spreadsheet_id: str) -> dict[str, Any]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise SheetsApiError(f"Sheets API returned non-JSON {action} response for {spreadsheet_id}") from exc
    if response.status_code >= 400:
        error = payload.get("error", {})
        message = error.get("message") or response.text[:300]
        raise SheetsApiError(f"Sheets API {action} error {response.status_code} for {spreadsheet_id}: {message}")
    return payload


def _quote_sheet_title(title: str) -> str:
    escaped = title.replace("'", "''")
    return f"'{escaped}'"


def _write_csv_rows(path: Path, rows: list[list[str]]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerows(rows)
