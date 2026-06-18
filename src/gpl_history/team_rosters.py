from __future__ import annotations

import csv
import json
import re
import unicodedata
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


def _title_key(value: str | None) -> str:
    return _compact_name(value)


def _fold_text(value: str) -> str:
    value = value.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    value = value.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue").replace("é", "e")
    value = value.replace("ÃƒÆ’Ã‚Â¤", "ae").replace("ÃƒÆ’Ã‚Â¶", "oe").replace("ÃƒÆ’Ã‚Â¼", "ue").replace("ÃƒÆ’Ã…Â¸", "ss")
    value = value.replace("ÃƒÆ’Ã¢â‚¬Å¾", "Ae").replace("ÃƒÆ’Ã¢â‚¬â€œ", "Oe").replace("ÃƒÆ’Ã…â€œ", "Ue").replace("ÃƒÆ’Ã‚Â©", "e")
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _season_sort(value: str) -> int:
    match = re.search(r"season_0*(\d+)", value or "")
    return int(match.group(1)) if match else 999


def _division_sort(value: str) -> int:
    return {
        "Regular Season": 1,
        "Singles": 2,
        "Doubles": 3,
        "Playoffs": 4,
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
        has_rueckrunde = any(_title_key(entry.get("title")) == "draftpicksruckrunde" for entry in index)
        for entry in index:
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

    return _sort_roster_rows(_dedupe_rows(rows))


def _sheet_config(season_id: str, title: str, has_rueckrunde: bool) -> dict[str, str] | None:
    key = _title_key(title)
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
            "notes": "Playoffkader nach Playoffdraft",
        }
    if season_id == "season_009" and key == "kadersingles":
        return {
            "layout": "block",
            "division": "Singles",
            "roster_phase": "season_with_rueckrunde" if has_rueckrunde else "season",
            "notes": "Rückrundendraft erkannt; Kader enthält Initial- und Rückrundenpicks" if has_rueckrunde else "",
        }
    if season_id == "season_009" and key == "kaderdoubles":
        return {
            "layout": "block",
            "division": "Doubles",
            "roster_phase": "season_with_rueckrunde" if has_rueckrunde else "season",
            "notes": "Rückrundendraft erkannt; Kader enthält Initial- und Rückrundenpicks" if has_rueckrunde else "",
        }
    return None


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
) -> list[dict[str, Any]]:
    people = _people_lookup(teams, season_id, division)
    seen: set[tuple[str, str]] = set()
    slot_counts: dict[str, int] = {}
    rows: list[dict[str, Any]] = []

    for csv_row in csv_rows:
        for index, cell in enumerate(csv_row[:-1]):
            team = _lookup_person(people, cell)
            if team is None:
                continue
            pokemon = _pokemon_cell(csv_row[index + 1])
            if pokemon is None or _lookup_person(people, pokemon) is not None:
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
        "data_status": "sheet_extracted",
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
            for key in {_canonical_name(name), _compact_name(name)}:
                if key:
                    lookup[key] = row
    return lookup


def _lookup_person(people: dict[str, dict[str, Any]], value: str | None) -> dict[str, Any] | None:
    return people.get(_canonical_name(value)) or people.get(_compact_name(value))


def _pokemon_cell(value: str | None) -> str | None:
    clean = str(value or "").strip()
    key = _canonical_name(clean)
    if not key or key in SKIP_POKEMON_VALUES or key in {"w", "l", "s", "n", "x"} or key.isdigit():
        return None
    display = pokemon_display_name(clean) or clean
    return display.strip() or None


def _dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, str, str, str]] = set()
    deduped: list[dict[str, Any]] = []
    for row in rows:
        key = (
            row.get("season_id", ""),
            row.get("division", ""),
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
            row.get("person_name_normalized", ""),
            int(row.get("slot") or 999),
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
