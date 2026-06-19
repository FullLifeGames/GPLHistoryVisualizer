from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any

from .pokemon_names import pokemon_display_name
from .storage import ensure_dir
from .team_rosters import (
    _canonical_name,
    _entry_source_url,
    _lookup_team,
    _pokemon_cell,
    _read_csv,
    _read_raw_csv,
    _resolve_raw_path,
    _team_lookup,
    _title_key,
)

ROSTER_MATCHDAY_FIELDS = [
    "season_id",
    "division",
    "roster_phase",
    "person_name",
    "person_name_normalized",
    "team_name",
    "team_name_normalized",
    "pokemon",
    "pokemon_normalized",
    "slot",
    "week",
    "week_label",
    "week_sort",
    "result",
    "used",
    "kills",
    "source_table",
    "source_file",
    "source_urls",
    "data_status",
    "notes",
]

S9_VICTORY_INSTINCT_SPLIT = [
    ("BelmontGabriel", 1, 7),
    ("El Scizor", 8, 14),
]


def build_and_write_roster_matchdays(data_dir: Path) -> list[dict[str, Any]]:
    rows = build_roster_matchdays(data_dir)
    out_path = data_dir / "normalized" / "roster_matchdays.csv"
    ensure_dir(out_path.parent)
    _write_csv(out_path, ROSTER_MATCHDAY_FIELDS, rows)
    return rows


def build_roster_matchdays(data_dir: Path) -> list[dict[str, Any]]:
    teams = _read_csv(data_dir / "normalized" / "teams.csv")
    rows: list[dict[str, Any]] = []

    for season_id in ("season_009", "season_010"):
        season_dir = data_dir / "raw" / season_id
        if not season_dir.exists():
            continue
        index = _read_json(season_dir / "sheets_index.json", [])
        for entry in index:
            config = _sheet_config(season_id, entry.get("title", ""))
            if config is None:
                continue
            raw_path = _resolve_raw_path(data_dir, entry.get("raw_path", ""))
            if not raw_path.exists():
                continue
            rows.extend(
                extract_wide_roster_matchday_rows(
                    _read_raw_csv(raw_path),
                    teams,
                    season_id=season_id,
                    division=config["division"],
                    roster_phase=config["roster_phase"],
                    source_table=entry.get("title", ""),
                    source_file=entry.get("raw_path") or str(raw_path),
                    source_urls=_entry_source_url(entry),
                    notes=config["notes"],
                    week_mode=config["week_mode"],
                )
            )
    return _sort_matchday_rows(_dedupe_rows(rows))


def extract_wide_roster_matchday_rows(
    csv_rows: list[list[str]],
    teams: list[dict[str, Any]],
    *,
    season_id: str,
    division: str,
    roster_phase: str,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
    week_mode: str,
) -> list[dict[str, Any]]:
    team_lookup = _team_lookup(teams, season_id, {division})
    width = max((len(row) for row in csv_rows), default=0)
    padded_rows = [row + [""] * (width - len(row)) for row in csv_rows]
    rows: list[dict[str, Any]] = []

    for header_index, row in enumerate(padded_rows):
        for group in _week_header_groups(row, week_mode):
            team = _team_for_group(padded_rows, teams, team_lookup, season_id, division, header_index, group)
            if team is None:
                continue
            result_index = _result_row_index(padded_rows, header_index, group)
            result_row = padded_rows[result_index] if result_index is not None else []
            slot = 0
            started_data = False

            start_index = (result_index + 1) if result_index is not None else (header_index + 1)
            for row_index in range(start_index, len(padded_rows)):
                current = padded_rows[row_index]
                if row_index > header_index + 1 and _starts_week_header_group(current, group["block_anchor"], week_mode):
                    break
                if all(not str(value).strip() for value in current):
                    if started_data:
                        break
                    continue

                pokemon = _roster_pokemon_cell(current[group["pokemon_column"]])
                if pokemon is None:
                    continue
                started_data = True
                slot += 1
                for week in group["weeks"]:
                    raw_value = current[week["column"]]
                    if not str(raw_value).strip():
                        continue
                    week_team = _team_for_week(team, teams, season_id, division, week["label"])
                    rows.append(
                        _matchday_row(
                            season_id=season_id,
                            division=division,
                            roster_phase=_roster_phase_for_week(season_id, roster_phase, week["label"]),
                            team=week_team,
                            pokemon=pokemon_display_name(pokemon) or pokemon,
                            slot=str(slot),
                            week=week["label"],
                            week_sort=week["sort"],
                            result=_result_value(result_row[week["column"]] if week["column"] < len(result_row) else ""),
                            kills=_number(raw_value),
                            source_table=source_table,
                            source_file=source_file,
                            source_urls=source_urls,
                            notes=notes,
                        )
                    )
    return rows


def _sheet_config(season_id: str, title: str) -> dict[str, str] | None:
    key = _title_key(title)
    if season_id == "season_009" and key == "kadersingles":
        return {
            "division": "Singles",
            "roster_phase": "season",
            "week_mode": "regular",
            "notes": "Spieltagseinsaetze und Kills aus Kader Singles",
        }
    if season_id == "season_009" and key == "kaderdoubles":
        return {
            "division": "Doubles",
            "roster_phase": "season",
            "week_mode": "regular",
            "notes": "Spieltagseinsaetze und Kills aus Kader Doubles",
        }
    if season_id == "season_010" and key == "kader":
        return {
            "division": "Regular Season",
            "roster_phase": "regular",
            "week_mode": "regular",
            "notes": "Spieltagseinsaetze und Kills aus S10 Kader",
        }
    if season_id == "season_010" and key == "playoffskader":
        return {
            "division": "Playoffs",
            "roster_phase": "playoffs",
            "week_mode": "playoffs_only",
            "notes": "Playoff-Einsaetze und Kills aus S10 Playoffs Kader",
        }
    return None


def _week_header_groups(row: list[str], week_mode: str) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    index = 0
    while index < len(row):
        direct = _week_label(row[index], week_mode)
        after_spieltag = _canonical_name(row[index]) == "spieltag" and index + 1 < len(row)
        if direct is None and not after_spieltag:
            index += 1
            continue

        block_anchor = index
        cursor = index + 1 if after_spieltag else index
        all_weeks: list[dict[str, Any]] = []
        selected_weeks: list[dict[str, Any]] = []
        first_label = _week_label(row[cursor], week_mode) if cursor < len(row) else None
        if not after_spieltag and first_label != "1":
            index += 1
            continue
        while cursor < len(row):
            label = _week_label(row[cursor], week_mode)
            if label is None:
                break
            week = {"label": label, "sort": _week_sort(label), "column": cursor}
            all_weeks.append(week)
            if week_mode != "playoffs_only" or not label.isdigit():
                selected_weeks.append(week)
            cursor += 1

        if _looks_like_week_group(all_weeks, selected_weeks, week_mode):
            groups.append(
                {
                    "block_anchor": block_anchor,
                    "pokemon_column": max(0, block_anchor - 3),
                    "weeks": selected_weeks,
                }
            )
            index = cursor
        else:
            index += 1
    return groups


def _starts_week_header_group(row: list[str], block_anchor: int, week_mode: str) -> bool:
    if block_anchor >= len(row):
        return False
    groups = _week_header_groups(row, week_mode)
    return any(group["block_anchor"] == block_anchor for group in groups)


def _looks_like_week_group(
    all_weeks: list[dict[str, Any]],
    selected_weeks: list[dict[str, Any]],
    week_mode: str,
) -> bool:
    if not selected_weeks:
        return False
    numeric_weeks = [week for week in all_weeks if str(week["label"]).isdigit()]
    if len(numeric_weeks) < 3:
        return False
    first_numbers = [int(week["label"]) for week in numeric_weeks[:3]]
    if first_numbers != [1, 2, 3]:
        return False
    return week_mode != "playoffs_only" or any(not str(week["label"]).isdigit() for week in selected_weeks)


def _week_label(value: str | None, week_mode: str) -> str | None:
    clean = str(value or "").strip()
    if not clean:
        return None
    if clean.isdigit() and int(clean) > 0:
        return clean
    key = _canonical_name(clean)
    if week_mode == "playoffs_only" and key in {"p1", "p2", "fin", "finale"}:
        return {"p1": "P1", "p2": "P2", "fin": "Fin", "finale": "Fin"}[key]
    if week_mode != "playoffs_only" and key in {"p1", "p2", "fin", "finale"}:
        return {"p1": "P1", "p2": "P2", "fin": "Fin", "finale": "Fin"}[key]
    return None


def _result_row_index(rows: list[list[str]], header_index: int, group: dict[str, Any]) -> int | None:
    week_columns = [week["column"] for week in group["weeks"]]
    for row_index in range(header_index + 1, min(len(rows), header_index + 6)):
        row = rows[row_index]
        values = [row[column] if column < len(row) else "" for column in week_columns]
        if any(_result_value(value) for value in values):
            return row_index
    return None


def _roster_pokemon_cell(value: str | None) -> str | None:
    key = _canonical_name(value)
    if not key or key.startswith("platz") or key in {"kills am spieltag", "kills", "pokemon"}:
        return None
    return _pokemon_cell(value)


def _week_sort(label: str) -> int:
    if label.isdigit():
        return int(label)
    return {"P1": 101, "P2": 102, "Fin": 103}.get(label, 999)


def _team_for_group(
    rows: list[list[str]],
    teams: list[dict[str, Any]],
    lookup: dict[str, list[dict[str, Any]]],
    season_id: str,
    division: str,
    header_index: int,
    group: dict[str, Any],
) -> dict[str, Any] | None:
    anchor = group["block_anchor"]
    for row_index in range(header_index - 1, max(-1, header_index - 8), -1):
        value = rows[row_index][anchor] if anchor < len(rows[row_index]) else ""
        team = _lookup_team(lookup, value)
        if team is not None:
            return team
    for row_index in range(header_index - 1, max(-1, header_index - 8), -1):
        value = rows[row_index][anchor] if anchor < len(rows[row_index]) else ""
        team = _team_by_person(teams, season_id, division, value)
        if team is not None:
            return team
    return None


def _team_for_week(
    team: dict[str, Any],
    teams: list[dict[str, Any]],
    season_id: str,
    division: str,
    week_label: str,
) -> dict[str, Any]:
    if season_id == "season_009" and division == "Singles" and _canonical_name(team.get("team_name")) == "victory instinct":
        week = int(week_label) if week_label.isdigit() else 999
        for person, start_week, end_week in S9_VICTORY_INSTINCT_SPLIT:
            if start_week <= week <= end_week:
                return _team_by_person(teams, season_id, division, person) or {**team, "person_name": person, "person_name_normalized": _canonical_name(person)}
    return team


def _team_by_person(
    teams: list[dict[str, Any]],
    season_id: str,
    division: str,
    person_name: str | None,
) -> dict[str, Any] | None:
    person_key = _canonical_name(person_name)
    if not person_key:
        return None
    for row in teams:
        if row.get("season_id") != season_id or row.get("division") != division:
            continue
        if (row.get("person_name_normalized") or _canonical_name(row.get("person_name"))) == person_key:
            return row
    return None


def _result_value(value: str | None) -> str:
    key = _canonical_name(value)
    if key in {"w", "s", "win", "sieg"}:
        return "win"
    if key in {"l", "n", "loss", "niederlage"}:
        return "loss"
    if key in {"d", "draw", "unentschieden"}:
        return "draw"
    if key in {"x", "-"}:
        return "not_played"
    return ""


def _number(value: str | None) -> str:
    clean = str(value or "").strip().replace(",", ".")
    if not clean:
        return ""
    try:
        number = float(clean)
    except ValueError:
        return ""
    return str(int(number)) if number.is_integer() else f"{number:.1f}".rstrip("0").rstrip(".")


def _matchday_row(
    *,
    season_id: str,
    division: str,
    roster_phase: str,
    team: dict[str, Any],
    pokemon: str,
    slot: str,
    week: str,
    week_sort: int,
    result: str,
    kills: str,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
) -> dict[str, Any]:
    return {
        "season_id": season_id,
        "division": division,
        "roster_phase": roster_phase,
        "person_name": team.get("person_name", ""),
        "person_name_normalized": team.get("person_name_normalized") or _canonical_name(team.get("person_name")),
        "team_name": team.get("team_name", ""),
        "team_name_normalized": team.get("team_name_normalized") or _canonical_name(team.get("team_name")),
        "pokemon": pokemon,
        "pokemon_normalized": _canonical_name(pokemon),
        "slot": slot,
        "week": week,
        "week_label": _week_display_label(week),
        "week_sort": str(week_sort),
        "result": result,
        "used": "1",
        "kills": kills,
        "source_table": source_table,
        "source_file": source_file,
        "source_urls": source_urls,
        "data_status": "sheet_extracted",
        "notes": notes,
    }


def _week_display_label(week: str) -> str:
    return {"P1": "PO 1", "P2": "PO 2", "Fin": "Finale"}.get(week, week)


def _roster_phase_for_week(season_id: str, roster_phase: str, week: str) -> str:
    if season_id == "season_009" and roster_phase == "season" and week.isdigit():
        return "hinrunde" if int(week) <= 7 else "rueckrunde"
    return roster_phase


def _dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str, str, str, str, str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row.get("season_id", ""),
            row.get("division", ""),
            row.get("roster_phase", ""),
            row.get("person_name_normalized", ""),
            row.get("team_name_normalized", ""),
            row.get("pokemon_normalized", ""),
            row.get("week", ""),
            row.get("source_table", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def _sort_matchday_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            _season_number(row.get("season_id")),
            _division_order(row.get("division")),
            row.get("person_name_normalized", ""),
            row.get("team_name_normalized", ""),
            _int(row.get("slot"), 999),
            _int(row.get("week_sort"), 999),
            row.get("pokemon_normalized", ""),
        ),
    )


def _season_number(value: str | None) -> int:
    match = re.search(r"season_0*(\d+)", value or "")
    return int(match.group(1)) if match else 999


def _division_order(value: str | None) -> int:
    return {"Regular Season": 1, "Singles": 2, "Doubles": 3, "Playoffs": 4}.get(str(value or ""), 99)


def _int(value: str | None, fallback: int) -> int:
    try:
        return int(float(str(value or "").strip()))
    except ValueError:
        return fallback


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
