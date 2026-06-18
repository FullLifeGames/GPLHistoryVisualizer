from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

from .pokemon_names import pokemon_display_name
from .storage import ensure_dir

TEAM_ROSTER_FIELDS = [
    "season_id",
    "division",
    "roster_phase",
    "team_name",
    "team_name_normalized",
    "person_name",
    "person_name_normalized",
    "pokemon",
    "pokemon_normalized",
    "slot",
    "source_table",
    "source_file",
    "source_urls",
    "data_status",
    "notes",
]

PERSON_ALIASES = {
    "Dauni Daunstar": ["Dauni"],
    "KingBlex": ["King Blex"],
    "OGDNZ": ["OG DNZ", "OGDeniz96"],
    "PresentLP": ["Present"],
}


def _canonical_name(value: str | None) -> str:
    clean = str(value or "").strip()
    if not clean:
        return ""
    folded = _fold_text(clean.lower())
    folded = re.sub(r"[^a-z0-9]+", " ", folded)
    return re.sub(r"\s+", " ", folded).strip()


def _compact_name(value: str | None) -> str:
    return _canonical_name(value).replace(" ", "")


def _name_keys(value: str | None) -> list[str]:
    variants = [value, _german_transliterated_text(value)]
    keys: list[str] = []
    for variant in variants:
        for key in (_canonical_name(variant), _compact_name(variant)):
            if key and key not in keys:
                keys.append(key)
    return keys


def _german_transliterated_text(value: str | None) -> str:
    text = str(value or "")
    replacements = {
        "ä": "ae",
        "ö": "oe",
        "ü": "ue",
        "ß": "ss",
        "Ä": "Ae",
        "Ö": "Oe",
        "Ü": "Ue",
    }
    for source, target in replacements.items():
        text = text.replace(source, target)
    return text


def _title_key(value: str | None) -> str:
    return _compact_name(value)


def _fold_text(value: str) -> str:
    value = value.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    value = value.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue").replace("é", "e")
    value = value.replace("Ã¤", "ae").replace("Ã¶", "oe").replace("Ã¼", "ue").replace("ÃŸ", "ss")
    value = value.replace("Ã„", "Ae").replace("Ã–", "Oe").replace("Ãœ", "Ue").replace("Ã©", "e")
    value = value.replace("ÃƒÂ¤", "ae").replace("ÃƒÂ¶", "oe").replace("ÃƒÂ¼", "ue").replace("ÃƒÅ¸", "ss")
    value = value.replace("Ãƒâ€ž", "Ae").replace("Ãƒâ€“", "Oe").replace("ÃƒÅ“", "Ue").replace("ÃƒÂ©", "e")
    value = value.replace("ÃƒÆ’Ã‚Â¤", "ae").replace("ÃƒÆ’Ã‚Â¶", "oe").replace("ÃƒÆ’Ã‚Â¼", "ue").replace("ÃƒÆ’Ã…Â¸", "ss")
    value = value.replace("ÃƒÆ’Ã¢â‚¬Å¾", "Ae").replace("ÃƒÆ’Ã¢â‚¬â€œ", "Oe").replace("ÃƒÆ’Ã…â€œ", "Ue").replace("ÃƒÆ’Ã‚Â©", "e")
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _season_sort(value: str) -> int:
    match = re.search(r"season_0*(\d+)", value or "")
    return int(match.group(1)) if match else 999


def _division_sort(value: str) -> int:
    return {
        "Liga 1": 0,
        "Liga 2": 1,
        "Regular Season": 1,
        "Singles": 2,
        "Doubles": 3,
        "Playoffs": 4,
    }.get(value, 50)


def _phase_sort(value: str) -> int:
    return {
        "hinrunde": 1,
        "regular": 2,
        "season": 2,
        "season_with_rueckrunde": 2,
        "rueckrunde": 3,
        "playoffs": 4,
    }.get(value, 50)


SKIP_POKEMON_VALUES = {
    _canonical_name(value)
    for value in (
        "",
        "A-Tier",
        "B-Tier",
        "C-Tier",
        "D-Tier",
        "E-Tier",
        "F-Tier",
        "GPL",
        "Icon",
        "K/M",
        "Kills",
        "Liga",
        "Loses",
        "Matches",
        "Out",
        "Platz",
        "Pokemon",
        "Pokémon",
        "Pokémon",
        "PokÃ©mon",
        "S-Tier",
        "Speed",
        "Spieltag",
        "Tier",
        "Wins",
        "unfilled",
    )
}


def build_and_write_team_rosters(data_dir: Path) -> list[dict[str, Any]]:
    rows = build_team_rosters(data_dir)
    out_path = data_dir / "normalized" / "team_rosters.csv"
    ensure_dir(out_path.parent)
    _write_csv(out_path, TEAM_ROSTER_FIELDS, rows)
    return rows


def build_team_rosters(data_dir: Path) -> list[dict[str, Any]]:
    teams = _read_csv(data_dir / "normalized" / "teams.csv")
    rows: list[dict[str, Any]] = []

    for season_dir in sorted((data_dir / "raw").glob("season_*")):
        if not season_dir.is_dir():
            continue
        season_id = season_dir.name
        index = _read_json(season_dir / "sheets_index.json", [])
        if season_id == "season_009":
            rows.extend(_extract_season_009_draft_rosters(data_dir, teams, index))
        has_rueckrunde = any(_title_key(entry.get("title")) in {"draftpicksruckrunde", "draftpicksrueckrunde"} for entry in index)
        for entry in _sheet_entries_with_fallbacks(data_dir, season_dir, index):
            config = _sheet_config(season_id, entry.get("title", ""), has_rueckrunde)
            if config is None:
                continue
            raw_path = _resolve_raw_path(data_dir, entry.get("raw_path", ""))
            if not raw_path.exists():
                continue
            csv_rows = _read_raw_csv(raw_path)
            source_file = entry.get("raw_path") or str(raw_path)
            source_urls = _entry_source_url(entry)
            if config["layout"] == "pair":
                rows.extend(
                    _extract_pair_kader_rows(
                        csv_rows,
                        teams,
                        season_id=season_id,
                        division=config["division"],
                        roster_phase=config["roster_phase"],
                        source_table=entry.get("title", ""),
                        source_file=source_file,
                        source_urls=source_urls,
                        notes=config["notes"],
                        required_headers=config.get("required_headers", ""),
                    )
                )
            elif config["layout"] == "block":
                rows.extend(
                    _extract_block_kader_rows(
                        csv_rows,
                        teams,
                        season_id=season_id,
                        division=config["division"],
                        roster_phase=config["roster_phase"],
                        source_table=entry.get("title", ""),
                        source_file=source_file,
                        source_urls=source_urls,
                        notes=config["notes"],
                    )
                )
            elif config["layout"] == "usage":
                rows.extend(
                    _extract_usage_kader_rows(
                        csv_rows,
                        teams,
                        season_id=season_id,
                        division=config["division"],
                        source_table=entry.get("title", ""),
                        source_file=source_file,
                        source_urls=source_urls,
                        notes=config["notes"],
                    )
                )

    rows.extend(_season_006_killlist_roster_rows(data_dir, teams))
    rows.extend(_manual_team_graphic_snapshot_rows(data_dir, teams))
    rows.extend(_killlist_supplement_roster_rows(data_dir, rows))
    return _sort_roster_rows(_dedupe_rows(rows))


def _sheet_config(season_id: str, title: str, has_rueckrunde: bool) -> dict[str, str] | None:
    key = _title_key(title)
    if season_id == "season_008" and key == "kaderl1":
        return {
            "layout": "usage",
            "division": "Liga 1",
            "notes": "Kaderphasen aus Kader-Sheet, Out-Zeilen und Spieltags-Einsaetzen inferiert",
        }
    if season_id == "season_008" and key == "kaderl2":
        return {
            "layout": "usage",
            "division": "Liga 2",
            "notes": "Kaderphasen aus Kader-Sheet, Out-Zeilen und Spieltags-Einsaetzen inferiert",
        }
    if season_id == "season_010" and key == "kader":
        return {
            "layout": "pair",
            "division": "Regular Season",
            "roster_phase": "regular",
            "notes": "Hauptrundenkader aus Kader-Sheet",
        }
    if season_id == "season_010" and key == "playoffskader":
        return {
            "layout": "pair",
            "division": "Playoffs",
            "roster_phase": "playoffs",
            "required_headers": "P1;P2;Fin",
            "notes": "Playoffkader nach Playoffdraft",
        }
    if season_id == "season_009" and key == "kadersingles":
        if has_rueckrunde:
            return None
        return {
            "layout": "block",
            "division": "Singles",
            "roster_phase": "season_with_rueckrunde" if has_rueckrunde else "season",
            "notes": "Rückrundendraft erkannt; Kader enthält Initial- und Rückrundenpicks" if has_rueckrunde else "",
        }
    if season_id == "season_009" and key == "kaderdoubles":
        if has_rueckrunde:
            return None
        return {
            "layout": "block",
            "division": "Doubles",
            "roster_phase": "season_with_rueckrunde" if has_rueckrunde else "season",
            "notes": "Rückrundendraft erkannt; Kader enthält Initial- und Rückrundenpicks" if has_rueckrunde else "",
        }
    return None


def _sheet_entries_with_fallbacks(data_dir: Path, season_dir: Path, index: list[dict[str, Any]]) -> list[dict[str, Any]]:
    entries = list(index)
    known_paths = {
        str(_resolve_raw_path(data_dir, entry.get("raw_path", "")).resolve()).lower()
        for entry in entries
        if entry.get("raw_path")
    }
    if season_dir.name != "season_008":
        return entries

    sheet_id = "1B2uTMvWlAHb7WlpupJV1A2Hbi3K3U1vCyoFV0wCapcw"
    fallback_sheets = [
        ("kader_l1", "Kader L1", "1521895812"),
        ("kader_l2", "Kader L2", "1271313224"),
    ]
    sheets_dir = season_dir / "sheets"
    for marker, title, gid in fallback_sheets:
        for path in sorted(sheets_dir.glob(f"*_{marker}_{gid}.csv")):
            resolved = str(path.resolve()).lower()
            if resolved in known_paths:
                continue
            try:
                raw_path = path.relative_to(data_dir.parent).as_posix()
            except ValueError:
                raw_path = str(path)
            entries.append(
                {
                    "sheet_id": sheet_id,
                    "gid": gid,
                    "title": title,
                    "source_url": f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={gid}",
                    "raw_path": raw_path,
                    "status": "available",
                }
            )
            known_paths.add(resolved)
    return entries


def _extract_pair_kader_rows(
    csv_rows: list[list[str]],
    teams: list[dict[str, Any]],
    *,
    season_id: str,
    division: str,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
    roster_phase: str = "",
    required_headers: str = "",
) -> list[dict[str, Any]]:
    people = _people_lookup(teams, season_id, division)
    seen: set[tuple[str, str]] = set()
    slot_counts: dict[str, int] = {}
    rows: list[dict[str, Any]] = []

    header_names = {header.strip() for header in required_headers.split(";") if header.strip()}
    width = max((len(row) for row in csv_rows), default=0)
    padded_rows = [row + [""] * (width - len(row)) for row in csv_rows]

    for row_index, csv_row in enumerate(padded_rows):
        for index, cell in enumerate(csv_row[:-1]):
            team = _lookup_person(people, cell)
            if team is None:
                continue
            pokemon = _pokemon_cell(csv_row[index + 1])
            if pokemon is None or _lookup_person(people, pokemon) is not None:
                continue
            if header_names and not _row_has_values_under_headers(padded_rows, row_index, index, header_names):
                continue
            key = (team["person_name"], _canonical_name(pokemon))
            if key in seen:
                continue
            seen.add(key)
            slot_counts[team["person_name"]] = slot_counts.get(team["person_name"], 0) + 1
            rows.append(
                _roster_row(
                    season_id=season_id,
                    division=division,
                    roster_phase=roster_phase,
                    team=team,
                    pokemon=pokemon,
                    slot=str(slot_counts[team["person_name"]]),
                    source_table=source_table,
                    source_file=source_file,
                    source_urls=source_urls,
                    notes=notes,
                )
            )
    return rows


def _row_has_values_under_headers(
    rows: list[list[str]],
    row_index: int,
    team_column: int,
    headers: set[str],
) -> bool:
    if row_index <= 0:
        return False
    search_end = min(len(rows[row_index]), team_column + 25)
    for header_row_index in range(row_index - 1, -1, -1):
        header_row = rows[header_row_index]
        matching_columns = [
            column
            for column in range(team_column, min(len(header_row), search_end))
            if str(header_row[column]).strip() in headers
        ]
        if matching_columns:
            return any(column < len(rows[row_index]) and str(rows[row_index][column]).strip() for column in matching_columns)
    return False


def _extract_block_kader_rows(
    csv_rows: list[list[str]],
    teams: list[dict[str, Any]],
    *,
    season_id: str,
    division: str,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
    roster_phase: str = "",
) -> list[dict[str, Any]]:
    people = _people_lookup(teams, season_id, division)
    width = max((len(row) for row in csv_rows), default=0)
    padded_rows = [row + [""] * (width - len(row)) for row in csv_rows]
    seen: set[tuple[str, str]] = set()
    slot_counts: dict[str, int] = {}
    rows: list[dict[str, Any]] = []

    for header_index, csv_row in enumerate(padded_rows):
        starts = [
            index
            for index in range(max(0, width - 1))
            if _canonical_name(csv_row[index]) == "tier" and _canonical_name(csv_row[index + 1]) in {"pokemon"}
        ]
        for start in starts:
            team = _block_team(padded_rows, people, header_index, start + 4)
            if team is None:
                continue
            for row_index in range(header_index + 1, len(padded_rows)):
                block_cells = padded_rows[row_index][start : start + 4]
                if row_index > header_index + 1 and all(not str(value).strip() for value in block_cells):
                    break
                if _canonical_name(padded_rows[row_index][start]) == "tier" and _canonical_name(padded_rows[row_index][start + 1]) == "pokemon":
                    break
                pokemon = _pokemon_cell(padded_rows[row_index][start + 1])
                if pokemon is None:
                    continue
                key = (team["person_name"], _canonical_name(pokemon))
                if key in seen:
                    continue
                seen.add(key)
                slot_counts[team["person_name"]] = slot_counts.get(team["person_name"], 0) + 1
                rows.append(
                    _roster_row(
                        season_id=season_id,
                        division=division,
                        roster_phase=roster_phase,
                        team=team,
                        pokemon=pokemon,
                        slot=str(slot_counts[team["person_name"]]),
                        source_table=source_table,
                        source_file=source_file,
                        source_urls=source_urls,
                        notes=notes,
                    )
                )
    return rows


def _extract_usage_kader_rows(
    csv_rows: list[list[str]],
    teams: list[dict[str, Any]],
    *,
    season_id: str,
    division: str,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
) -> list[dict[str, Any]]:
    team_lookup = _team_lookup(teams, season_id, {division})
    width = max((len(row) for row in csv_rows), default=0)
    padded_rows = [row + [""] * (width - len(row)) for row in csv_rows]
    slot_counts: dict[tuple[str, str], int] = {}
    rows: list[dict[str, Any]] = []

    for header_index, csv_row in enumerate(padded_rows):
        for anchor, cell in enumerate(csv_row):
            if _canonical_name(cell) != "spieltag":
                continue
            team = _lookup_team(team_lookup, csv_row[anchor - 2] if anchor >= 2 else "")
            if team is None:
                continue
            week_positions = _week_positions(csv_row, anchor + 1)
            if not week_positions:
                continue

            for row_index in range(header_index + 1, len(padded_rows)):
                row = padded_rows[row_index]
                if all(not str(value).strip() for value in row):
                    break
                if _canonical_name(row[anchor]) == "spieltag":
                    break
                tier = row[anchor - 2] if anchor >= 2 else ""
                pokemon = _pokemon_cell(row[anchor - 1] if anchor >= 1 else "")
                if pokemon is None:
                    continue
                used_weeks = [
                    week
                    for week, position in week_positions
                    if position < len(row) and str(row[position]).strip()
                ]
                is_out = _canonical_name(tier) == "out"
                phases: list[str] = []
                if is_out or any(week <= 7 for week in used_weeks):
                    phases.append("hinrunde")
                if not is_out or any(week >= 8 for week in used_weeks):
                    phases.append("rueckrunde")
                for phase in phases:
                    slot_key = (team["person_name"], phase)
                    slot_counts[slot_key] = slot_counts.get(slot_key, 0) + 1
                    rows.append(
                        _roster_row(
                            season_id=season_id,
                            division=division,
                            roster_phase=phase,
                            team=team,
                            pokemon=pokemon,
                            slot=str(slot_counts[slot_key]),
                            source_table=source_table,
                            source_file=source_file,
                            source_urls=source_urls,
                            notes=notes,
                        )
                    )
    return rows


def _week_positions(row: list[str], start: int) -> list[tuple[int, int]]:
    positions: list[tuple[int, int]] = []
    for index in range(start, len(row)):
        value = str(row[index] or "").strip()
        if not value:
            if positions:
                break
            continue
        if value.isdigit():
            positions.append((int(value), index))
    return positions


def _block_team(
    csv_rows: list[list[str]],
    people: dict[str, dict[str, Any]],
    header_index: int,
    anchor: int,
) -> dict[str, Any] | None:
    for row_index in range(header_index - 1, max(0, header_index - 8) - 1, -1):
        if anchor >= len(csv_rows[row_index]):
            continue
        team = _lookup_person(people, csv_rows[row_index][anchor])
        if team is not None:
            return team
    return None


def _extract_season_009_draft_rosters(
    data_dir: Path,
    teams: list[dict[str, Any]],
    index: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    initial_entry = _find_sheet_entry(index, "draftpicks")
    rueckrunde_entry = _find_sheet_entry(index, "draftpicksruckrunde") or _find_sheet_entry(index, "draftpicksrueckrunde")
    if initial_entry is None or rueckrunde_entry is None:
        return []

    initial_path = _resolve_raw_path(data_dir, initial_entry.get("raw_path", ""))
    rueckrunde_path = _resolve_raw_path(data_dir, rueckrunde_entry.get("raw_path", ""))
    if not initial_path.exists() or not rueckrunde_path.exists():
        return []

    team_lookup = _team_lookup(teams, "season_009", {"Singles", "Doubles"})
    initial_picks = _parse_initial_draft_picks(_read_raw_csv(initial_path), team_lookup)
    changes = _parse_rueckrunde_draft_changes(_read_raw_csv(rueckrunde_path), team_lookup)
    if not initial_picks:
        return []

    rueckrunde_picks = {team_key: list(pokemon) for team_key, pokemon in initial_picks.items()}
    for team_key, change in changes.items():
        current = rueckrunde_picks.setdefault(team_key, [])
        for pokemon in change["out"]:
            _remove_pokemon(current, pokemon)
        for pokemon in change["in"]:
            _append_unique_pokemon(current, pokemon)

    initial_source = _entry_source_url(initial_entry)
    rueckrunde_source = _join_source_urls(initial_source, _entry_source_url(rueckrunde_entry))
    rows: list[dict[str, Any]] = []
    rows.extend(
        _draft_roster_rows(
            "season_009",
            "hinrunde",
            initial_picks,
            team_lookup,
            source_table=initial_entry.get("title", "Draftpicks"),
            source_file=initial_entry.get("raw_path") or str(initial_path),
            source_urls=initial_source,
            notes="Hinrundenkader aus Initialdraft-Picks",
        )
    )
    rows.extend(
        _draft_roster_rows(
            "season_009",
            "rueckrunde",
            rueckrunde_picks,
            team_lookup,
            source_table=rueckrunde_entry.get("title", "Draftpicks Rückrunde"),
            source_file=rueckrunde_entry.get("raw_path") or str(rueckrunde_path),
            source_urls=rueckrunde_source,
            notes="Rückrundenkader aus Initialdraft plus Rückrundendraft-Wechsel",
        )
    )
    return rows


def _find_sheet_entry(index: list[dict[str, Any]], title_key: str) -> dict[str, Any] | None:
    for entry in index:
        if _title_key(entry.get("title")) == title_key:
            return entry
    return None


def _parse_initial_draft_picks(
    csv_rows: list[list[str]],
    team_lookup: dict[str, list[dict[str, Any]]],
) -> dict[str, list[str]]:
    picks: dict[str, list[str]] = defaultdict(list)
    for row in csv_rows:
        for index, cell in enumerate(row):
            team_key = _lookup_team_key(team_lookup, cell)
            if team_key is None:
                continue
            pokemon = _pokemon_cell(row[index + 2] if index + 2 < len(row) else "")
            if pokemon is None:
                continue
            _append_unique_pokemon(picks[team_key], pokemon)
    return picks


def _parse_rueckrunde_draft_changes(
    csv_rows: list[list[str]],
    team_lookup: dict[str, list[dict[str, Any]]],
) -> dict[str, dict[str, list[str]]]:
    changes: dict[str, dict[str, list[str]]] = defaultdict(lambda: {"out": [], "in": []})
    for row in csv_rows:
        for index, cell in enumerate(row):
            team_key = _lookup_team_key(team_lookup, cell)
            if team_key is None:
                continue
            outgoing = _pokemon_in_offsets(row, index, (2, 3))
            incoming = _pokemon_in_offsets(row, index, (5, 6))
            if outgoing:
                _append_unique_pokemon(changes[team_key]["out"], outgoing)
            if incoming:
                _append_unique_pokemon(changes[team_key]["in"], incoming)
    return changes


def _pokemon_in_offsets(row: list[str], start: int, offsets: tuple[int, ...]) -> str | None:
    for offset in offsets:
        index = start + offset
        if index >= len(row):
            continue
        pokemon = _pokemon_cell(row[index])
        if pokemon:
            return pokemon
    return None


def _draft_roster_rows(
    season_id: str,
    roster_phase: str,
    picks_by_team: dict[str, list[str]],
    team_lookup: dict[str, list[dict[str, Any]]],
    *,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for team_key, pokemon_list in picks_by_team.items():
        for team in _phase_team_rows(team_lookup.get(team_key, []), roster_phase):
            for slot, pokemon in enumerate(pokemon_list, start=1):
                rows.append(
                    _roster_row(
                        season_id=season_id,
                        division=team.get("division", ""),
                        roster_phase=roster_phase,
                        team=team,
                        pokemon=pokemon,
                        slot=str(slot),
                        source_table=source_table,
                        source_file=source_file,
                        source_urls=source_urls,
                        notes=notes,
                    )
                )
    return rows


def _phase_team_rows(team_rows: list[dict[str, Any]], roster_phase: str) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for row in team_rows:
        if row.get("season_id") == "season_009" and _canonical_name(row.get("team_name")) == "victory instinct" and row.get("division") == "Singles":
            person = _canonical_name(row.get("person_name"))
            if roster_phase == "hinrunde" and person != "belmontgabriel":
                continue
            if roster_phase == "rueckrunde" and person != "el scizor":
                continue
        filtered.append(row)
    return _unique_team_rows(filtered)


def _manual_team_graphic_snapshot_rows(data_dir: Path, teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    manual_path = data_dir / "manual" / "team_pokemon_usage.csv"
    manual_rows = _read_csv(manual_path)
    wanted_seasons = {"season_003", "season_004", "season_005"}
    grouped: dict[tuple[str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in manual_rows:
        if row.get("season_id") not in wanted_seasons or row.get("data_status") == "not_available":
            continue
        pokemon = _pokemon_cell(row.get("pokemon"))
        if pokemon is None:
            continue
        key = (
            row.get("season_id") or "",
            row.get("division") or "",
            row.get("team_name_normalized") or _canonical_name(row.get("team_name")),
            row.get("person_name_normalized") or _canonical_name(row.get("person_name")),
        )
        grouped[key].append({**row, "pokemon": pokemon})

    rows: list[dict[str, Any]] = []
    for group_rows in grouped.values():
        sorted_group = sorted(group_rows, key=lambda row: _slot_number(row.get("slot")))
        for slot, row in enumerate(sorted_group, start=1):
            team = _manual_team(row, teams)
            phase = _manual_team_graphic_phase(row.get("season_id") or "")
            rows.append(
                _roster_row(
                    season_id=row.get("season_id") or "",
                    division=row.get("division") or "",
                    roster_phase=phase,
                    team=team,
                    pokemon=row["pokemon"],
                    slot=str(slot),
                    source_table="Manual team graphics",
                    source_file=row.get("source_file") or "",
                    source_urls=row.get("source_urls") or str(manual_path.as_posix()),
                    data_status=row.get("data_status") or "manual_override",
                    notes=_manual_team_graphic_notes(row.get("season_id") or ""),
                )
            )
    return rows


def _manual_team_graphic_phase(season_id: str) -> str:
    if season_id == "season_004":
        return "hinrunde"
    return "rueckrunde"


def _manual_team_graphic_notes(season_id: str) -> str:
    if season_id == "season_003":
        return (
            "Manuelle Teamgrafik-Zuordnung als Rückrunden-Snapshot aus Spieltag 14; "
            "exakte Hinrunde nicht strukturiert belegt"
        )
    if season_id == "season_004":
        return (
            "Manuelle Teamgrafik-Zuordnung als Hinrunden-Snapshot; S4 Rückrunden-Teamupdate ist belegt, "
            "aber die strukturierte Killrangliste/Teamwechselquelle ist nicht mehr oeffentlich verfuegbar"
        )
    return "Manuelle Teamgrafik-Zuordnung als Rückrunden-/Saison-Snapshot; exakte Hinrunde nicht strukturiert belegt"


def _season_006_killlist_roster_rows(data_dir: Path, teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    killlist_path = data_dir / "normalized" / "pokemon_killlists.csv"
    killlists = _read_csv(killlist_path)
    slot_counts: dict[tuple[str, str, str, str], int] = {}
    seen: set[tuple[str, str, str, str, str]] = set()
    rows: list[dict[str, Any]] = []

    for row in killlists:
        if row.get("season_id") != "season_006" or row.get("data_status") == "not_available":
            continue
        division = row.get("division") or ""
        division_key = _canonical_name(division)
        if division_key not in {"sun conference", "moon conference", "playoffs"}:
            continue
        pokemon = _pokemon_cell(row.get("pokemon"))
        if pokemon is None:
            continue
        team = _team_from_killlist(row, teams)
        roster_phase = "playoffs" if division_key == "playoffs" else "regular"
        owner_key = (
            division,
            roster_phase,
            team.get("team_name_normalized") or _canonical_name(team.get("team_name")),
            team.get("person_name_normalized") or _canonical_name(team.get("person_name")),
        )
        pokemon_key = _canonical_name(pokemon)
        seen_key = (*owner_key, pokemon_key)
        if seen_key in seen:
            continue
        seen.add(seen_key)
        slot_counts[owner_key] = slot_counts.get(owner_key, 0) + 1
        rows.append(
            _roster_row(
                season_id="season_006",
                division=division,
                roster_phase=roster_phase,
                team=team,
                pokemon=pokemon,
                slot=str(slot_counts[owner_key]),
                source_table="Pokemon killlists",
                source_file=str(killlist_path.as_posix()),
                source_urls=row.get("source_urls") or "",
                data_status=row.get("data_status") or "sheet_extracted",
                notes="Vollstaendige S6 Kader aus Conference-/Playoff-Killlisten abgeleitet",
            )
        )
    return rows


def _killlist_supplement_roster_rows(data_dir: Path, roster_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    killlist_path = data_dir / "normalized" / "pokemon_killlists.csv"
    killlists = _read_csv(killlist_path)
    snapshot_by_owner: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    existing_pokemon: dict[tuple[str, str, str, str], set[str]] = defaultdict(set)
    slot_counts: dict[tuple[str, str, str, str], int] = defaultdict(int)

    for row in roster_rows:
        if row.get("source_table") != "Manual team graphics":
            continue
        if row.get("season_id") not in {"season_003", "season_004", "season_005"}:
            continue
        key = _roster_owner_key(row)
        if not key:
            continue
        snapshot_by_owner.setdefault(key, row)
        pokemon_key = _canonical_name(row.get("pokemon"))
        if pokemon_key:
            existing_pokemon[key].add(pokemon_key)
        slot_counts[key] = max(slot_counts[key], _slot_number(row.get("slot")))

    rows: list[dict[str, Any]] = []
    for row in killlists:
        if row.get("season_id") not in {"season_003", "season_004", "season_005"}:
            continue
        if row.get("data_status") == "not_available":
            continue
        pokemon = _pokemon_cell(row.get("pokemon"))
        if pokemon is None:
            continue
        key = _killlist_owner_key(row)
        snapshot = snapshot_by_owner.get(key)
        if snapshot is None:
            continue
        pokemon_key = _canonical_name(pokemon)
        if pokemon_key in existing_pokemon[key]:
            continue
        existing_pokemon[key].add(pokemon_key)
        slot_counts[key] += 1
        team = {
            "season_id": snapshot.get("season_id", ""),
            "division": snapshot.get("division", ""),
            "team_name": snapshot.get("team_name", ""),
            "team_name_normalized": snapshot.get("team_name_normalized", ""),
            "person_name": snapshot.get("person_name", ""),
            "person_name_normalized": snapshot.get("person_name_normalized", ""),
        }
        rows.append(
            _roster_row(
                season_id=snapshot.get("season_id", ""),
                division=snapshot.get("division", ""),
                roster_phase=snapshot.get("roster_phase", ""),
                team=team,
                pokemon=pokemon,
                slot=str(slot_counts[key]),
                source_table="Pokemon killlist supplement",
                source_file=str(killlist_path.as_posix()),
                source_urls=row.get("source_urls") or "",
                data_status=row.get("data_status") or "manual_override",
                notes="Killlisten-Ergaenzung zu unvollstaendigem Kader-Snapshot",
            )
        )
    return rows


def _roster_owner_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        row.get("season_id") or "",
        row.get("division") or "",
        row.get("team_name_normalized") or _canonical_name(row.get("team_name")),
        row.get("person_name_normalized") or _canonical_name(row.get("person_name")),
    )


def _killlist_owner_key(row: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        row.get("season_id") or "",
        row.get("division") or "",
        _canonical_name(row.get("team_name")),
        row.get("trainer_normalized") or _canonical_name(row.get("trainer")),
    )


def _team_from_killlist(row: dict[str, Any], teams: list[dict[str, Any]]) -> dict[str, Any]:
    season_id = row.get("season_id") or ""
    division = row.get("division") or ""
    team_key = _canonical_name(row.get("team_name"))
    person_key = row.get("trainer_normalized") or _canonical_name(row.get("trainer"))
    for team in teams:
        if team.get("season_id") != season_id:
            continue
        if team.get("division") != division:
            continue
        if (team.get("team_name_normalized") or _canonical_name(team.get("team_name"))) == team_key and (
            team.get("person_name_normalized") or _canonical_name(team.get("person_name"))
        ) == person_key:
            return team
    return {
        "season_id": season_id,
        "division": division,
        "team_name": row.get("team_name") or "",
        "team_name_normalized": team_key,
        "person_name": row.get("trainer") or "",
        "person_name_normalized": person_key,
    }


def _manual_team(row: dict[str, str], teams: list[dict[str, Any]]) -> dict[str, Any]:
    season_id = row.get("season_id") or ""
    division = row.get("division") or ""
    team_key = row.get("team_name_normalized") or _canonical_name(row.get("team_name"))
    person_key = row.get("person_name_normalized") or _canonical_name(row.get("person_name"))
    for team in teams:
        if team.get("season_id") != season_id or team.get("division") != division:
            continue
        if (team.get("team_name_normalized") or _canonical_name(team.get("team_name"))) == team_key and (
            team.get("person_name_normalized") or _canonical_name(team.get("person_name"))
        ) == person_key:
            return team
    return {
        "season_id": season_id,
        "division": division,
        "team_name": row.get("team_name") or "",
        "team_name_normalized": team_key,
        "person_name": row.get("person_name") or "",
        "person_name_normalized": person_key,
    }


def _roster_row(
    *,
    season_id: str,
    division: str,
    roster_phase: str,
    team: dict[str, Any],
    pokemon: str,
    slot: str,
    source_table: str,
    source_file: str,
    source_urls: str,
    notes: str,
    data_status: str = "sheet_extracted",
) -> dict[str, Any]:
    return {
        "season_id": season_id,
        "division": division,
        "roster_phase": roster_phase,
        "team_name": team.get("team_name", ""),
        "team_name_normalized": team.get("team_name_normalized") or _canonical_name(team.get("team_name")),
        "person_name": team.get("person_name", ""),
        "person_name_normalized": team.get("person_name_normalized") or _canonical_name(team.get("person_name")),
        "pokemon": pokemon,
        "pokemon_normalized": _canonical_name(pokemon),
        "slot": slot,
        "source_table": source_table,
        "source_file": source_file,
        "source_urls": source_urls,
        "data_status": data_status,
        "notes": notes,
    }


def _people_lookup(teams: list[dict[str, Any]], season_id: str, division: str) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for row in teams:
        if row.get("season_id") != season_id or row.get("division") != division:
            continue
        person_name = str(row.get("person_name") or "")
        names = [
            person_name,
            str(row.get("person_id") or "").replace("person_", "").replace("_", " "),
            *(PERSON_ALIASES.get(person_name, [])),
        ]
        if person_name and "&" not in person_name:
            names.append(person_name.split()[0])
        for name in names:
            for key in _name_keys(name):
                lookup[key] = row
    return lookup


def _team_lookup(
    teams: list[dict[str, Any]],
    season_id: str,
    divisions: set[str],
) -> dict[str, list[dict[str, Any]]]:
    lookup: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in teams:
        if row.get("season_id") != season_id or row.get("division") not in divisions:
            continue
        names = [row.get("team_name"), row.get("team_name_normalized")]
        for name in names:
            for key in _name_keys(name):
                if row not in lookup[key]:
                    lookup[key].append(row)
    return lookup


def _lookup_person(people: dict[str, dict[str, Any]], value: str | None) -> dict[str, Any] | None:
    for key in _name_keys(value):
        if key in people:
            return people[key]
    return None


def _lookup_team(lookup: dict[str, list[dict[str, Any]]], value: str | None) -> dict[str, Any] | None:
    for key in _name_keys(value):
        rows = lookup.get(key) or []
        if rows:
            return rows[0]
    return None


def _lookup_team_key(lookup: dict[str, list[dict[str, Any]]], value: str | None) -> str | None:
    for key in _name_keys(value):
        if key and key in lookup:
            return key
    return None


def _pokemon_cell(value: str | None) -> str | None:
    clean = str(value or "").strip()
    key = _canonical_name(clean)
    if not key or key in SKIP_POKEMON_VALUES or key in {"w", "l", "s", "n", "x"} or key.isdigit():
        return None
    display = pokemon_display_name(clean) or clean
    return display.strip() or None


def _append_unique_pokemon(target: list[str], pokemon: str) -> None:
    key = _canonical_name(pokemon)
    if key and all(_canonical_name(existing) != key for existing in target):
        target.append(pokemon)


def _remove_pokemon(target: list[str], pokemon: str) -> None:
    key = _canonical_name(pokemon)
    for index, existing in enumerate(target):
        if _canonical_name(existing) == key:
            target.pop(index)
            return


def _unique_team_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row.get("division", ""),
            row.get("team_name_normalized") or _canonical_name(row.get("team_name")),
            row.get("person_name_normalized") or _canonical_name(row.get("person_name")),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _slot_number(value: str | None) -> int:
    try:
        return int(float(str(value or "").strip()))
    except ValueError:
        return 999


def _join_source_urls(*values: str) -> str:
    seen: set[str] = set()
    joined: list[str] = []
    for value in values:
        for item in str(value or "").split(";"):
            clean = item.strip()
            if clean and clean not in seen:
                seen.add(clean)
                joined.append(clean)
    return ";".join(joined)


def _dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str, str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row.get("season_id", ""),
            row.get("division", ""),
            row.get("roster_phase", ""),
            row.get("person_name_normalized", ""),
            row.get("team_name_normalized", ""),
            row.get("pokemon_normalized", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def _sort_roster_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            _season_sort(row.get("season_id", "")),
            _division_sort(row.get("division", "")),
            _phase_sort(row.get("roster_phase", "")),
            row.get("person_name_normalized", ""),
            _slot_number(row.get("slot")),
            row.get("pokemon_normalized", ""),
        ),
    )


def _entry_source_url(entry: dict[str, Any]) -> str:
    sheet_id = entry.get("sheet_id")
    gid = entry.get("gid")
    if sheet_id and gid:
        return f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={gid}"
    return entry.get("source_url", "")


def _resolve_raw_path(data_dir: Path, raw_path: str) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    if path.parts and path.parts[0] == data_dir.name:
        return data_dir.parent / path
    return data_dir / path


def _read_raw_csv(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.reader(handle))


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


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
