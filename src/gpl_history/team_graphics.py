from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from .pokemon_names import name_key
from .storage import ensure_dir, safe_slug

TEAM_GRAPHIC_SLOT_FIELDS = [
    "slot_id",
    "season_id",
    "division",
    "graphic_group",
    "graphic_row",
    "slot_number",
    "image_path",
    "source_file",
    "crop_x",
    "crop_y",
    "crop_width",
    "crop_height",
    "team_name",
    "team_name_normalized",
    "person_name",
    "person_name_normalized",
    "suggested_pokemon",
    "suggested_pokemon_normalized",
    "suggestion_rank",
    "suggestion_confidence",
    "data_status",
    "source_urls",
]

TEAM_POKEMON_USAGE_FIELDS = [
    "season_id",
    "division",
    "team_name",
    "team_name_normalized",
    "person_name",
    "person_name_normalized",
    "pokemon",
    "pokemon_normalized",
    "slot",
    "source_file",
    "source_urls",
    "data_status",
]

S4_SLOTS = [
    (286, 119, 179, 102),
    (583, 119, 179, 102),
    (879, 119, 179, 102),
    (286, 247, 179, 102),
    (583, 247, 179, 102),
    (879, 247, 179, 102),
    (435, 376, 179, 102),
    (731, 376, 179, 102),
    (286, 502, 179, 102),
    (583, 502, 179, 102),
    (879, 502, 179, 102),
]

S5_SLOTS = [
    (61, 119, 270, 143),
    (382, 119, 270, 143),
    (224, 294, 270, 143),
    (544, 294, 270, 143),
    (61, 469, 270, 143),
    (382, 469, 270, 143),
    (705, 469, 270, 143),
    (224, 644, 270, 143),
    (544, 644, 270, 143),
    (61, 819, 270, 143),
    (382, 819, 270, 143),
]

S3_X = [210, 302, 394, 486, 578, 670, 762, 854, 946, 1038, 1130]
S3_Y = [64, 151, 238, 325, 412, 499, 586]
S3_SLOT_SIZE = 76

TEAM_NAME_ALIASES = {
    "aggronberlin": "aggronsuccessors",
    "soulstealer": "soulstealer",
}

TEAM_GRAPHIC_MANUAL_TEAMS = {
    ("season_005", "shockingshaymins"): {
        "team_name": "Shocking Shaymins",
        "team_name_normalized": "shocking shaymins",
        "person_name": "MeLevies",
        "person_name_normalized": "melevies",
    },
}


def build_and_write_team_graphic_slots(data_dir: Path, graphics_dir: Path = Path("output/team-graphics")) -> list[dict[str, Any]]:
    teams = _read_csv(data_dir / "normalized" / "teams.csv")
    rows = build_team_graphic_slots(graphics_dir, teams)
    out_path = data_dir / "review" / "team_graphic_slots.csv"
    ensure_dir(out_path.parent)
    _write_csv(out_path, TEAM_GRAPHIC_SLOT_FIELDS, rows)
    return rows


def build_team_graphic_slots(graphics_dir: Path, teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for path in sorted(graphics_dir.glob("s3/*")):
        if path.is_file():
            rows.extend(_s3_slots(path))
    for path in sorted(graphics_dir.glob("s4/*")):
        if path.is_file():
            rows.extend(_single_team_slots(path, "season_004", "Regular Season", S4_SLOTS, teams))
    for path in sorted(graphics_dir.glob("s5/*")):
        if path.is_file():
            rows.extend(_single_team_slots(path, "season_005", "Liga 1", S5_SLOTS, teams))
    return rows


def _s3_slots(path: Path) -> list[dict[str, Any]]:
    group = _graphic_group("season_003", path)
    rows: list[dict[str, Any]] = []
    for row_index, y in enumerate(S3_Y, start=1):
        for column_index, x in enumerate(S3_X, start=1):
            slot_number = (row_index - 1) * len(S3_X) + column_index
            rows.append(
                _slot_row(
                    season_id="season_003",
                    division="Regular Season",
                    path=path,
                    graphic_group=f"{group}_row_{row_index}",
                    graphic_row=str(row_index),
                    slot_number=slot_number,
                    crop=(x, y, S3_SLOT_SIZE, S3_SLOT_SIZE),
                    team=None,
                )
            )
    return rows


def _single_team_slots(
    path: Path,
    season_id: str,
    division: str,
    slot_layout: list[tuple[int, int, int, int]],
    teams: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    team = _team_for_graphic(path, season_id, teams)
    group = _graphic_group(season_id, path)
    return [
        _slot_row(
            season_id=season_id,
            division=division,
            path=path,
            graphic_group=group,
            graphic_row="",
            slot_number=index,
            crop=crop,
            team=team,
        )
        for index, crop in enumerate(slot_layout, start=1)
    ]


def _slot_row(
    *,
    season_id: str,
    division: str,
    path: Path,
    graphic_group: str,
    graphic_row: str,
    slot_number: int,
    crop: tuple[int, int, int, int],
    team: dict[str, Any] | None,
) -> dict[str, Any]:
    x, y, width, height = crop
    source_file = _source_file(path)
    team = team or {}
    return {
        "slot_id": safe_slug(f"{graphic_group}_{slot_number:02d}"),
        "season_id": season_id,
        "division": division,
        "graphic_group": graphic_group,
        "graphic_row": graphic_row,
        "slot_number": str(slot_number),
        "image_path": f"../{source_file}",
        "source_file": source_file,
        "crop_x": str(x),
        "crop_y": str(y),
        "crop_width": str(width),
        "crop_height": str(height),
        "team_name": team.get("team_name", ""),
        "team_name_normalized": team.get("team_name_normalized", ""),
        "person_name": team.get("person_name", ""),
        "person_name_normalized": team.get("person_name_normalized", ""),
        "suggested_pokemon": "",
        "suggested_pokemon_normalized": "",
        "suggestion_rank": "",
        "suggestion_confidence": "",
        "data_status": "graphic_slot",
        "source_urls": source_file,
    }


def _team_for_graphic(path: Path, season_id: str, teams: list[dict[str, Any]]) -> dict[str, Any] | None:
    season_teams = [row for row in teams if row.get("season_id") == season_id]
    stem_parts = [part.strip() for part in path.stem.split(" - ") if part.strip()]
    candidates = [path.stem, *stem_parts]
    for candidate in candidates:
        manual_team = TEAM_GRAPHIC_MANUAL_TEAMS.get((season_id, _name_key(candidate)))
        if manual_team:
            return manual_team
    for candidate in candidates:
        team = _find_team(candidate, season_teams)
        if team:
            return team
    if len(stem_parts) == 2:
        team_name, person_name = stem_parts
        return {
            "team_name": team_name,
            "team_name_normalized": _name_key(team_name),
            "person_name": person_name,
            "person_name_normalized": _name_key(person_name),
        }
    return None


def _find_team(value: str, teams: list[dict[str, Any]]) -> dict[str, Any] | None:
    target = TEAM_NAME_ALIASES.get(_name_key(value), _name_key(value))
    for team in teams:
        if TEAM_NAME_ALIASES.get(_name_key(team.get("team_name", "")), _name_key(team.get("team_name", ""))) == target:
            return team
    return None


def _source_file(path: Path) -> str:
    return f"output/team-graphics/{path.parent.name}/{path.name}"


def _graphic_group(season_id: str, path: Path) -> str:
    return safe_slug(f"{season_id}_{path.stem}")


def _name_key(value: str) -> str:
    return name_key(value)


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
