from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit

from .storage import ensure_dir, write_json


@dataclass(frozen=True)
class ExternalWorkbook:
    label: str
    sheet_id: str
    source_url: str
    description: str


class SheetsTabFetcher(Protocol):
    def fetch_visible_tabs(self, spreadsheet_id: str, out_dir: Path, source_url: str) -> list[dict[str, Any]]:
        ...


EXTERNAL_WORKBOOKS: tuple[ExternalWorkbook, ...] = (
    ExternalWorkbook(
        label="old_project_ewige_tabelle",
        sheet_id="1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA",
        source_url="https://docs.google.com/spreadsheets/d/1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA/edit?gid=352888197#gid=352888197",
        description="Old GPL all-time workbook with team summaries, S1 kills, S2-S8 kill ranking, logos, and status values.",
    ),
    ExternalWorkbook(
        label="player_compare",
        sheet_id="1ejA0nLQQnRHKhIvUiBmf4L7qHUqY6y91ifaxzfFuy8c",
        source_url="https://docs.google.com/spreadsheets/d/1ejA0nLQQnRHKhIvUiBmf4L7qHUqY6y91ifaxzfFuy8c/edit?gid=0#gid=0",
        description="GPL player-vs-player comparison workbook with S1-S9 match rows across divisions and conferences.",
    ),
)


def fetch_external_workbooks(data_dir: Path, client: SheetsTabFetcher) -> list[dict[str, Any]]:
    external_dir = ensure_dir(data_dir / "raw" / "external")
    manifest: list[dict[str, Any]] = []

    for workbook in EXTERNAL_WORKBOOKS:
        workbook_dir = ensure_dir(external_dir / workbook.label)
        sheets_dir = ensure_dir(workbook_dir / "sheets")
        workbook_payload = asdict(workbook)
        write_json(workbook_dir / "workbook.json", workbook_payload)

        tables = client.fetch_visible_tabs(workbook.sheet_id, sheets_dir, workbook.source_url)
        for table in tables:
            table["source_url"] = _tab_source_url(workbook.source_url, table.get("gid"))
            table["external_label"] = workbook.label
            table["external_description"] = workbook.description
        write_json(workbook_dir / "sheets_index.json", tables)

        manifest.append(
            {
                **workbook_payload,
                "status": "available" if any(table.get("status") == "available" for table in tables) else "unavailable",
                "tabs": len(tables),
                "rows": sum(int(table.get("rows") or 0) for table in tables),
                "sheets_index_path": str(workbook_dir / "sheets_index.json").replace("\\", "/"),
            }
        )

    write_json(external_dir / "external_sheets_index.json", manifest)
    return manifest


def _tab_source_url(source_url: str, gid: str | None) -> str:
    if not gid:
        return source_url
    parts = urlsplit(source_url)
    query = "&".join(part for part in parts.query.split("&") if part and not part.startswith("gid="))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, query, f"gid={gid}"))
