from __future__ import annotations

import csv
from pathlib import Path
from typing import Any


def read_manual_table(data_dir: Path, table: str, fields: list[str]) -> list[dict[str, str]]:
    path = data_dir / "manual" / f"{table}.csv"
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            return []
        rows = []
        for row in reader:
            normalized = {field: (row.get(field) or "").strip() for field in fields}
            if any(normalized.values()):
                rows.append(normalized)
        return rows


def apply_manual_rows(data_dir: Path, output: Any, table_fields: dict[str, list[str]]) -> None:
    for table, fields in table_fields.items():
        rows = read_manual_table(data_dir, table, fields)
        if rows:
            getattr(output, table).extend(rows)
