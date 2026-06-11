from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .normalize import NORMALIZED_FIELDS

SOURCE_TABLES = {"seasons", "teams", "standings", "person_stints", "matches", "champions", "pokemon_killlists"}

UNIQUE_KEYS = {
    "seasons": ["season_id"],
    "people": ["person_id"],
    "matches": ["match_id"],
}


@dataclass(frozen=True)
class ValidationIssue:
    level: str
    table: str
    message: str


def validate_normalized_data(data_dir: Path) -> list[ValidationIssue]:
    normalized_dir = data_dir / "normalized"
    issues: list[ValidationIssue] = []
    rows_by_table: dict[str, list[dict[str, str]]] = {}

    for table, expected_fields in NORMALIZED_FIELDS.items():
        path = normalized_dir / f"{table}.csv"
        if not path.exists():
            issues.append(ValidationIssue("error", table, f"Missing normalized file: {path.as_posix()}"))
            continue
        header, rows = _read_csv(path)
        rows_by_table[table] = rows
        if header != expected_fields:
            issues.append(
                ValidationIssue(
                    "error",
                    table,
                    f"CSV header mismatch. Expected {', '.join(expected_fields)}; got {', '.join(header)}",
                )
            )
        issues.extend(_source_url_warnings(table, rows))
        issues.extend(_duplicate_key_errors(table, rows))

    issues.extend(_referential_warnings(rows_by_table))
    return issues


def format_issues(issues: Iterable[ValidationIssue]) -> str:
    return "\n".join(f"{issue.level.upper()} {issue.table}: {issue.message}" for issue in issues)


def _read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def _source_url_warnings(table: str, rows: list[dict[str, str]]) -> list[ValidationIssue]:
    if table not in SOURCE_TABLES:
        return []
    issues = []
    for index, row in enumerate(rows, start=2):
        status = row.get("data_status", "")
        if status and status != "not_available" and "manual" not in status and not row.get("source_urls"):
            issues.append(ValidationIssue("warning", table, f"Row {index} has data_status={status} but no source_urls."))
    return issues


def _duplicate_key_errors(table: str, rows: list[dict[str, str]]) -> list[ValidationIssue]:
    keys = UNIQUE_KEYS.get(table)
    if not keys:
        return []
    seen: set[tuple[str, ...]] = set()
    issues = []
    for index, row in enumerate(rows, start=2):
        marker = tuple(row.get(key, "") for key in keys)
        if not any(marker):
            continue
        if marker in seen:
            issues.append(ValidationIssue("error", table, f"Duplicate key at row {index}: {', '.join(marker)}"))
        seen.add(marker)
    return issues


def _referential_warnings(rows_by_table: dict[str, list[dict[str, str]]]) -> list[ValidationIssue]:
    people = {row.get("person_id") for row in rows_by_table.get("people", []) if row.get("person_id")}
    issues: list[ValidationIssue] = []
    for table, field in (("teams", "person_id"), ("standings", "person_id"), ("person_stints", "person_id")):
        for index, row in enumerate(rows_by_table.get(table, []), start=2):
            person_id = row.get(field)
            if person_id and person_id not in people:
                issues.append(ValidationIssue("warning", table, f"Row {index} references unknown person_id={person_id}."))
    return issues
