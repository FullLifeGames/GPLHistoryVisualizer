from __future__ import annotations

import csv
import errno
import re
import time
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from .adapters import adapter_for_season
from .manual import apply_manual_rows, read_manual_table
from .pokemon_names import pokemon_display_name
from .storage import playlist_url, read_json, safe_slug, video_url
from .team_graphics import TEAM_POKEMON_USAGE_FIELDS

NORMALIZED_FIELDS = {
    "seasons": [
        "season_id",
        "season_label",
        "playlist_id",
        "playlist_title",
        "playlist_url",
        "is_gpl_related",
        "source_video_count",
        "start_date",
        "end_date",
        "data_status",
        "notes",
        "source_urls",
    ],
    "people": [
        "person_id",
        "person_name",
        "person_name_normalized",
        "aliases",
        "data_status",
        "source_urls",
    ],
    "teams": [
        "season_id",
        "person_id",
        "person_name",
        "person_name_normalized",
        "team_id",
        "team_name",
        "team_name_normalized",
        "division",
        "channel_url",
        "aliases",
        "data_status",
        "source_urls",
    ],
    "standings": [
        "season_id",
        "division",
        "stage",
        "is_primary",
        "rank",
        "person_id",
        "player_name",
        "player_name_normalized",
        "team_id",
        "team_name",
        "wins",
        "losses",
        "draws",
        "points",
        "kills",
        "deaths",
        "differential",
        "data_status",
        "source_urls",
    ],
    "person_stints": [
        "season_id",
        "person_id",
        "person_name",
        "person_name_normalized",
        "team_id",
        "team_name",
        "team_name_normalized",
        "division",
        "stage",
        "rank",
        "start_week",
        "end_week",
        "matches",
        "wins",
        "losses",
        "draws",
        "points",
        "kills",
        "deaths",
        "differential",
        "data_status",
        "notes",
        "source_urls",
    ],
    "matches": [
        "season_id",
        "match_id",
        "division",
        "stage",
        "week",
        "player_a",
        "player_b",
        "team_a",
        "team_b",
        "score_a",
        "score_b",
        "winner",
        "video_id",
        "video_title",
        "video_url",
        "data_status",
        "source_urls",
    ],
    "champions": [
        "season_id",
        "champion_name",
        "champion_person_id",
        "champion_team",
        "evidence_type",
        "data_status",
        "notes",
        "source_urls",
    ],
    "pokemon_killlists": [
        "season_id",
        "division",
        "stage",
        "pokemon",
        "pokemon_normalized",
        "trainer",
        "trainer_normalized",
        "team_name",
        "appearances",
        "kills",
        "deaths",
        "differential",
        "data_status",
        "source_urls",
    ],
    "aliases_review": [
        "name_a",
        "name_b",
        "name_a_normalized",
        "name_b_normalized",
        "similarity_hint",
        "source",
    ],
    "source_claims": [
        "claim_id",
        "season_id",
        "table_name",
        "claim_type",
        "claim_subject",
        "claim_field",
        "claim_value",
        "evidence_status",
        "confidence",
        "source_urls",
        "notes",
    ],
    "data_quality": [
        "season_id",
        "season_label",
        "coverage_status",
        "standings_rows",
        "match_rows",
        "playoff_match_rows",
        "champion_rows",
        "killlist_rows",
        "killlist_rows_missing_appearances",
        "unavailable_killlist_rows",
        "video_rows",
        "matched_video_rows",
        "unmatched_game_video_rows",
        "low_confidence_video_rows",
        "quality_score",
        "tables_score",
        "matches_score",
        "killlists_score",
        "videos_score",
        "claims_score",
        "quality_summary",
        "priority_gaps",
        "missing_categories",
        "review_flags",
        "source_urls",
    ],
}

_KNOWN_HEADERS = {
    "rank",
    "platz",
    "rang",
    "team",
    "team_name",
    "franchise",
    "mannschaft",
    "coach",
    "trainer",
    "player",
    "spieler",
    "wins",
    "siege",
    "losses",
    "niederlagen",
    "draws",
    "points",
    "punkte",
    "kills",
    "appearances",
    "kampfe",
    "kaempfe",
    "einsatze",
    "einsaetze",
    "deaths",
    "differential",
    "diff",
    "pokemon",
    "kanal",
    "channel",
    "youtube",
    "winner",
    "sieger",
    "champion",
    "meister",
}

_MISSING_KILLLIST_SOURCES = {
    "season_003": {
        "division": "Regular Season",
        "trainer": "Bene",
        "team_name": "Unlimited Blade Works",
        "source_urls": "https://docs.google.com/spreadsheets/d/1d7DpiW3aMjnYWiY9KSpk9nSi-gnEUnSFVAK-zGpy59Q/edit#gid=0",
    },
    "season_004": {
        "division": "Regular Season",
        "trainer": "Bene",
        "team_name": "Ritter der Tapukokosnuss",
        "source_urls": "https://docs.google.com/spreadsheets/d/16OVT2YZN7gtsckJEMPSdMETsCiXuCs0HTSFl5xQGdwg/edit#gid=0",
    },
    "season_005": {
        "division": "Liga 1",
        "trainer": "Bene",
        "team_name": "Victini Bottom",
        "source_urls": "https://docs.google.com/spreadsheets/d/1oXO8WjHo3Og1gncQWS7jEPaNyAFrkJhxL-xS57holc0/edit",
    },
}

_OLD_PROJECT_KILL_SHEET_ID = "1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA"
_OLD_PROJECT_KILL_COLUMNS = {
    "season_003": ("s3", "Regular Season"),
    "season_004": ("s4", "Regular Season"),
    "season_005": ("s5", "Liga 1"),
}

_S2_L1_SCHEDULE_SHEET_ID = "16wGz0QnHeyqfcAhKdYvDqUZAvKxXKuAHchszJjhpp-o"
_S2_L1_STANDINGS_SHEET_ID = "1vJ-pioe3RZKSZ3LIGEA3FVTv_KEE_XKIQAXSIUNNd-Q"
_S2_L1_KILLLIST_SHEET_ID = "1FUsClf5qEny-BHY5Djp8rIwRJKBSJDvygJ8LBa62FEo"
_S2_L2_SCHEDULE_SHEET_ID = "1Jc6mBqbU8wYKfz3WxfpxsWbj_6xaZB6OmoCRPGzGJLM"
_S2_L2_STANDINGS_SHEET_ID = "1ACnJyxD1hx-mbOcZXoJ5BjXDOwUF1TYmfgkqtJgFRXk"
_S2_L2_KILLLIST_SHEET_ID = "1odsNRAZStW1GzmpXwmg27dqjOlch7w8syZOZ5Z2OQRg"

_S4_L1_SCHEDULE_SHEET_ID = "1u8AORkPkqIxR4GblUqU5faeTfuuKGjKrllUxnnUdRz0"
_S4_L2_SCHEDULE_SHEET_ID = "1NKXigWOr5wX73nBCnJrqO0_OprQy7Q5ncRmxnsQencI"
_S4_L2_STANDINGS_SHEET_ID = "1iwPqphIOO1ID-4NV3sv5CrIsmpQF-saq1sNE9Sxo9oE"

_S5_L1_MAIN_SHEET_ID = "1nONaKwJcrN04APGKN-HrZ8yavwZdFkfnaA59Zp1sdBU"
_S5_L2_MAIN_SHEET_ID = "1Jej38dwkqOARMHvKaUfQeHME0pLqP9GE6vPZQMUxMcg"

_S9_KILLLIST_TRAINERS = {
    "Singles": {
        "akatsuki amphibianz": "Barry D. Sin of Speed",
        "fen and gator": "Maxi von Vogel",
        "royal bluff": "BlackLink",
        "scherzkekse": "Dauni Daunstar",
        "soulblaze": "PresentLP",
        "toon world": "King Blex",
        "voltwizards": "Blocki",
    },
    "Doubles": {
        "akatsuki amphibianz": "Minetube",
        "fen and gator": "Pokgalaxy",
        "royal bluff": "ElektechN9ne",
        "scherzkekse": "Hydronic",
        "soulblaze": "Raizor",
        "toon world": "OG DNZ",
        "victory instinct": "Bene",
        "voltwizards": "Nestfloh",
    },
}

_S9_VICTORY_INSTINCT_SINGLES_SPLITS = [
    ("BelmontGabriel", 1, 7),
    ("El Scizor", 8, 14),
]

_ALIAS_CANONICAL = {
    "presentlp": "present",
    "present": "present",
    "prespres": "present",
    "shiro san": "shiro",
    "shirosan": "shiro",
    "shriosan": "shiro",
    "neverusedshiro": "shiro",
    "daumenkinolp": "daumenkino",
    "daumenkino lp": "daumenkino",
    "daumenkino": "daumenkino",
    "theherbertlp": "daumenkino",
    "theherbert": "daumenkino",
    "theherbe": "daumenkino",
    "sin of speed": "barry d sin of speed",
    "sinofspeed": "barry d sin of speed",
    "barry d sin of speed": "barry d sin of speed",
    "regi": "regibang",
    "regibang": "regibang",
    "lauris enteitainment": "lauris",
    "laurisenteitainment": "lauris",
    "enteitainment": "lauris",
    "lauris": "lauris",
    "pokebazi": "pokebazi",
    "poke bazi": "pokebazi",
    "full lifegames": "bene",
    "fulllifegames": "bene",
    "captain crinch": "captaincrinch",
    "captaincrinch": "captaincrinch",
    "blacklink": "blacklink",
    "black link": "blacklink",
    "dauni": "dauni daunstar",
    "dauni daunstar": "dauni daunstar",
    "daunidaunstar": "dauni daunstar",
    "art n gaming": "art n gaming",
    "artngaming": "art n gaming",
    "tjlh100": "art n gaming",
    "kaffecone": "art n gaming",
    "kaffeecone": "art n gaming",
    "kaffeconelp": "art n gaming",
    "kaffeeconelp": "art n gaming",
    "king blex": "king blex",
    "kingblex": "king blex",
    "og dnz": "og dnz",
    "ogdnz": "og dnz",
    "ogdeniz96": "og dnz",
    "denizderzweite": "og dnz",
    "raizor": "raizor",
    "raizor zockt": "raizor",
    "raizorzockt": "raizor",
    "crowd": "crowdcontroller",
    "crowdcontroller": "crowdcontroller",
    "professorn": "professor n",
    "professor n": "professor n",
    "stratocoptertv": "stratocopter tv",
    "stratocopter tv": "stratocopter tv",
    "tabascotv": "tabasco tv",
    "tabasco tv": "tabasco tv",
    "belmontgabriellp": "belmontgabriel",
    "belmontgabriel": "belmontgabriel",
    "thedirtydancer64": "dirtyd64",
    "dirtyd64": "dirtyd64",
    "cabgolord": "fnupa",
    "cabgo lord": "fnupa",
    "fnupa": "fnupa",
    "maxi team mauni": "maxi von vogel",
    "teammauni": "maxi von vogel",
    "maxi": "maxi von vogel",
    "maxi von vogel": "maxi von vogel",
    "maxivonvogel": "maxi von vogel",
    "finaalfantasylp": "silva",
    "finaalfa": "silva",
    "silvaffb": "silva",
    "silva": "silva",
}

_PREFERRED_DISPLAY = {
    "bene": "Bene",
    "art n gaming": "Art'n'Gaming",
    "barry d sin of speed": "Barry D. Sin of Speed",
    "blacklink": "BlackLink",
    "captaincrinch": "CaptainCrinch",
    "crowdcontroller": "CrowdController",
    "daumenkino": "DaumenkinoLP",
    "dauni daunstar": "Dauni Daunstar",
    "dirtyd64": "DirtyD64",
    "lauris": "Lauris",
    "maxi von vogel": "Maxi von Vogel",
    "oktopaul": "Oktopaul",
    "pokebazi": "PokeBazi",
    "present": "PresentLP",
    "professor n": "Professor N",
    "raizor": "Raizor",
    "regibang": "RegiBang",
    "shiro": "Shiro",
    "silva": "Silva",
    "stratocopter tv": "Stratocopter TV",
    "tabasco tv": "Tabasco TV",
    "belmontgabriel": "BelmontGabriel",
    "diaswordplay": "DiaSwordPlay",
    "fnupa": "Cabgolord",
    "king blex": "KingBlex",
    "og dnz": "OGDNZ",
}


@dataclass
class NormalizedOutput:
    seasons: list[dict[str, Any]]
    people: list[dict[str, Any]]
    teams: list[dict[str, Any]]
    standings: list[dict[str, Any]]
    person_stints: list[dict[str, Any]]
    matches: list[dict[str, Any]]
    champions: list[dict[str, Any]]
    pokemon_killlists: list[dict[str, Any]]
    aliases_review: list[dict[str, Any]]
    source_claims: list[dict[str, Any]]
    data_quality: list[dict[str, Any]]


def normalize_all(data_dir: Path) -> NormalizedOutput:
    raw_dir = data_dir / "raw"
    output = NormalizedOutput([], [], [], [], [], [], [], [], [], [], [])

    for season_path in sorted(raw_dir.glob("season_*")):
        if not season_path.is_dir():
            continue
        season_id = season_path.name
        season_meta = read_json(season_path / "season.json", None)
        playlists = read_json(season_path / "playlists.json", [])
        playlist = playlists[0] if playlists else read_json(season_path / "playlist.json", {})
        videos = read_json(season_path / "videos.json", [])
        sheets_index = read_json(season_path / "sheets_index.json", [])
        resolved = read_json(season_path / "resolved_urls.json", [])

        source_urls = _sources_for_season(playlist, resolved, playlists)
        output.seasons.append(
            {
                "season_id": season_id,
                "season_label": season_meta.get("season_label") if season_meta else _season_label(playlist),
                "playlist_id": ";".join(p.get("playlistId") or "" for p in playlists) if playlists else playlist.get("playlistId"),
                "playlist_title": "; ".join(p.get("title") or "" for p in playlists) if playlists else playlist.get("title"),
                "playlist_url": ";".join(playlist_url(p.get("playlistId")) or "" for p in playlists)
                if playlists
                else playlist_url(playlist.get("playlistId")),
                "is_gpl_related": str(_is_gpl_related(playlist, videos, playlists)).lower(),
                "source_video_count": len(videos),
                "start_date": _min_date(videos),
                "end_date": _max_date(videos),
                "data_status": "raw_collected",
                "notes": _season_note(season_id),
                "source_urls": ";".join(source_urls),
            }
        )

        tables = _load_sheet_tables(sheets_index, season_path)
        season_output = _adapt_season(season_id, tables, videos)
        output.teams.extend(season_output.teams or [_placeholder(season_id, "teams")])
        output.standings.extend(season_output.standings or [_placeholder(season_id, "standings")])
        output.person_stints.extend(season_output.person_stints or [_placeholder(season_id, "person_stints")])
        output.matches.extend(season_output.matches or [_placeholder(season_id, "matches")])
        output.champions.extend(season_output.champions or [_champion_placeholder(season_id, "No champion evidence adapter result.")])
        output.pokemon_killlists.extend(season_output.pokemon_killlists or [_placeholder(season_id, "pokemon_killlists")])

    apply_manual_rows(data_dir, output, NORMALIZED_FIELDS)
    team_pokemon_usage = read_manual_table(data_dir, "team_pokemon_usage", TEAM_POKEMON_USAGE_FIELDS)
    output.pokemon_killlists = _apply_team_pokemon_usage_to_killlists(output.pokemon_killlists, team_pokemon_usage)
    output.pokemon_killlists = _replace_generated_killlists_with_manual_overrides(output.pokemon_killlists)
    output.people = _people_from_output(output)
    output.aliases_review = _alias_review(output)
    apply_manual_rows(data_dir, output, {"people": NORMALIZED_FIELDS["people"], "aliases_review": NORMALIZED_FIELDS["aliases_review"]})
    write_normalized(data_dir / "normalized", output)
    from .data_quality import generate_data_quality

    generate_data_quality(data_dir)
    return output


def write_normalized(out_dir: Path, output: NormalizedOutput) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for key in NORMALIZED_FIELDS:
        rows = getattr(output, key)
        _write_csv(out_dir / f"{key}.csv", NORMALIZED_FIELDS[key], rows)


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    attempts = 3
    for attempt in range(attempts):
        try:
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
                writer.writeheader()
                for row in rows:
                    writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})
            return
        except OSError as error:
            if error.errno not in {errno.EINVAL, errno.EACCES} or attempt == attempts - 1:
                raise
            time.sleep(0.1 * (attempt + 1))


def _apply_team_pokemon_usage_to_killlists(
    killlists: list[dict[str, Any]],
    usage_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    usage_by_key: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for usage in usage_rows:
        season_id = _null(usage.get("season_id"))
        pokemon_key = _null(usage.get("pokemon_normalized")) or _canonical_name(usage.get("pokemon"))
        person = _null(usage.get("person_name")) or _null(usage.get("person_name_normalized"))
        team = _null(usage.get("team_name"))
        if not season_id or not pokemon_key or not (person or team):
            continue
        usage_by_key.setdefault((season_id, pokemon_key), []).append(usage)

    result: list[dict[str, Any]] = []
    for row in killlists:
        key = (_null(row.get("season_id")) or "", _null(row.get("pokemon_normalized")) or _canonical_name(row.get("pokemon")) or "")
        matches = usage_by_key.get(key, [])
        if len(matches) != 1 or not _is_trainerless_generated_killlist_row(row):
            result.append(row)
            continue
        usage = matches[0]
        enriched = dict(row)
        enriched["trainer"] = _null(usage.get("person_name"))
        enriched["trainer_normalized"] = _null(usage.get("person_name_normalized")) or _canonical_name(usage.get("person_name"))
        enriched["team_name"] = _null(usage.get("team_name"))
        enriched["data_status"] = "manual_graphic_assignment"
        enriched["source_urls"] = _join_source_urls(row.get("source_urls"), usage.get("source_urls"), usage.get("source_file"))
        result.append(enriched)
    return result


def _replace_generated_killlists_with_manual_overrides(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    manual_keys = {
        _killlist_assignment_key(row)
        for row in rows
        if _is_manual_killlist_override(row) and _killlist_assignment_key(row)
    }
    if not manual_keys:
        return rows
    return [
        row
        for row in rows
        if _is_manual_killlist_override(row)
        or str(row.get("data_status") or "") == "not_available"
        or _killlist_assignment_key(row) not in manual_keys
    ]


def _is_manual_killlist_override(row: dict[str, Any]) -> bool:
    return str(row.get("data_status") or "") == "manual_override"


def _is_trainerless_generated_killlist_row(row: dict[str, Any]) -> bool:
    status = str(row.get("data_status") or "")
    if "manual" in status or status == "not_available":
        return False
    return not any(_null(row.get(field)) for field in ("trainer", "trainer_normalized", "team_name"))


def _killlist_assignment_key(row: dict[str, Any]) -> tuple[str, str, str, str] | None:
    season_id = _null(row.get("season_id"))
    pokemon_key = _null(row.get("pokemon_normalized")) or _canonical_name(row.get("pokemon"))
    if not season_id or not pokemon_key:
        return None
    return (
        season_id,
        _null(row.get("division")) or "",
        _null(row.get("stage")) or "",
        pokemon_key,
    )


def _load_sheet_tables(sheets_index: list[dict[str, Any]], season_path: Path | None = None) -> list[dict[str, Any]]:
    tables: list[dict[str, Any]] = []
    seen_paths: set[str] = set()
    for entry in sheets_index:
        if entry.get("status") != "available" or not entry.get("raw_path"):
            continue
        path = Path(entry["raw_path"])
        if not path.exists():
            continue
        tables.append(_load_sheet_table(path, entry))
        seen_paths.add(str(path).replace("\\", "/"))

    if season_path is not None:
        sheet_dir = season_path / "sheets"
        sheet_ids_by_slug = {
            safe_slug(entry["sheet_id"]).lower(): entry["sheet_id"]
            for entry in sheets_index
            if entry.get("sheet_id")
        }
        for path in sorted(sheet_dir.glob("*.csv")):
            marker = str(path).replace("\\", "/")
            if marker in seen_paths:
                continue
            entry = _orphan_sheet_entry(path, sheet_ids_by_slug)
            tables.append(_load_sheet_table(path, entry))
    return tables


def _load_sheet_table(path: Path, entry: dict[str, Any]) -> dict[str, Any]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    records = _records_from_rows(rows)
    return {"entry": entry, "rows": rows, "records": records}


def _orphan_sheet_entry(path: Path, sheet_ids_by_slug: dict[str, str]) -> dict[str, Any]:
    stem = path.stem
    sheet_id = None
    sheet_slug = None
    for candidate_slug, candidate_id in sorted(sheet_ids_by_slug.items(), key=lambda item: len(item[0]), reverse=True):
        if stem.lower().startswith(candidate_slug + "_"):
            sheet_slug = candidate_slug
            sheet_id = candidate_id
            break
    remainder = stem[len(sheet_slug) + 1 :] if sheet_slug else stem
    parts = remainder.rsplit("_", 1)
    title = parts[0] if parts else remainder
    gid = parts[1] if len(parts) == 2 and parts[1].isdigit() else None
    return {
        "sheet_id": sheet_id,
        "gid": gid,
        "title": title,
        "source_url": f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={gid}" if sheet_id and gid else None,
        "raw_path": str(path).replace("\\", "/"),
        "status": "available",
        "status_code": 200,
        "error": None,
        "rows": None,
        "columns": None,
        "fetch_method": "orphan_csv_recovered",
    }


def _records_from_rows(rows: list[list[str]]) -> list[dict[str, str]]:
    header_index = _find_header_index(rows)
    if header_index is None:
        return []
    headers = [_header(cell) or f"column_{idx + 1}" for idx, cell in enumerate(rows[header_index])]
    records: list[dict[str, str]] = []
    for row in rows[header_index + 1 :]:
        if not any(cell.strip() for cell in row):
            continue
        padded = row + [""] * (len(headers) - len(row))
        records.append({headers[idx]: padded[idx].strip() for idx in range(len(headers))})
    return records


def _find_header_index(rows: list[list[str]]) -> int | None:
    best_index = None
    best_score = 0
    for index, row in enumerate(rows[:20]):
        headers = [_header(cell) for cell in row]
        score = sum(1 for header in headers if header in _KNOWN_HEADERS)
        if score > best_score:
            best_score = score
            best_index = index
    if best_score >= 2:
        return best_index

    for index, row in enumerate(rows[:12]):
        if sum(1 for cell in row if cell.strip()) >= 2:
            return index
    return None


def _adapt_season(season_id: str, tables: list[dict[str, Any]], videos: list[dict[str, Any]]) -> NormalizedOutput:
    adapter_for_season(season_id)
    out = NormalizedOutput([], [], [], [], [], [], [], [], [], [], [])

    out.standings.extend(_season_standings(season_id, tables))
    out.matches.extend(_season_matches(season_id, tables, videos))
    out.person_stints.extend(_season_person_stints(season_id, out.standings, out.matches))
    out.teams.extend(_teams_from_standings(out.standings))
    out.teams.extend(_teams_from_person_stints(out.person_stints))
    out.teams.extend(_season_extra_teams(season_id, tables))
    out.teams = _dedupe(out.teams, ["season_id", "person_id", "team_id", "division"])
    out.champions.extend(_season_champions(season_id, out.standings, out.matches, tables))
    out.pokemon_killlists.extend(_season_killlists(season_id, tables))
    return out


def _season_standings(season_id: str, tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if season_id in {"season_001", "season_003"}:
        return _standard_standings_from_tables(
            season_id,
            [table for table in tables if _has_standings_header(table["rows"])],
            division="Regular Season",
            primary=True,
        )
    if season_id == "season_002":
        rows = []
        rows.extend(
            _standard_standings_from_tables(
                season_id, _tables_by_sheet_id(tables, _S2_L1_STANDINGS_SHEET_ID), "Regular Season", True
            )
        )
        rows.extend(
            _standard_standings_from_tables(
                season_id, _tables_by_sheet_id(tables, _S2_L2_STANDINGS_SHEET_ID), "Liga 2", True
            )
        )
        return rows
    if season_id == "season_004":
        rows = _standard_standings_from_tables(
            season_id, _tables_by_title(tables, "Gesamtübersicht"), division="Regular Season", primary=True
        )
        rows.extend(
            _standard_standings_from_tables(
                season_id, _tables_by_sheet_id(tables, _S4_L2_STANDINGS_SHEET_ID), "Liga 2", True
            )
        )
        return rows
    if season_id == "season_005":
        rows = _standard_standings_from_tables(
            season_id, _tables_by_sheet_id(tables, _S5_L1_MAIN_SHEET_ID, "Liga 1 Tabelle"), division="Liga 1", primary=True
        )
        rows.extend(
            _standard_standings_from_tables(
                season_id, _tables_by_sheet_id(tables, _S5_L2_MAIN_SHEET_ID, "Liga 2 Tabelle"), "Liga 2", True
            )
        )
        return rows
    if season_id == "season_006":
        rows = []
        rows.extend(
            _standard_standings_from_tables(
                season_id, _tables_by_title(tables, "Tabelle - Sun Con."), division="Sun Conference", primary=True
            )
        )
        rows.extend(
            _standard_standings_from_tables(
                season_id, _tables_by_title(tables, "Tabelle - Moon Con."), division="Moon Conference", primary=True
            )
        )
        return rows
    if season_id == "season_007":
        rows = _standard_standings_from_tables(
            season_id, _tables_by_title(tables, "Tabelle"), division="Regular Season", primary=True
        )
        rows.append(
            _manual_playoff_standing(
                season_id,
                rank="1",
                person_name="Nestfloh",
                team_name="Flutschige Zäpfchen",
                source_url=_source_urls_for_titles(tables, ["Tabelle", "Spielplan [Mit Spoilern]"]),
                notes_status="source_evidenced",
            )
        )
        return rows
    if season_id == "season_008":
        rows = []
        rows.extend(_standard_standings_from_tables(season_id, _tables_by_title(tables, "Tabelle L1"), "Liga 1", True))
        rows.extend(_standard_standings_from_tables(season_id, _tables_by_title(tables, "Tabelle L2"), "Liga 2", True))
        return rows
    if season_id == "season_009":
        rows = []
        rows.extend(_s9_standings(season_id, _tables_by_title(tables, "Tabelle"), "Overall Tag Team", False))
        rows.extend(_s9_standings(season_id, _tables_by_title(tables, "Tabelle Singles"), "Singles", True))
        rows.extend(_s9_standings(season_id, _tables_by_title(tables, "Tabelle Doubles"), "Doubles", True))
        return rows
    if season_id == "season_010":
        rows = _s10_standings(season_id, _tables_by_title(tables, "Tabelle"))
        rows.extend(_s10_playoff_standings(season_id, rows, _source_urls_for_titles(tables, ["Ergebnisse", "Playoffs Kader"])))
        return rows
    return []


def _standard_standings_from_tables(
    season_id: str,
    tables: list[dict[str, Any]],
    division: str,
    primary: bool,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for table in tables:
        header_index = _find_standings_header_index(table["rows"])
        if header_index is None:
            continue
        header = [_header(cell) for cell in table["rows"][header_index]]
        column = _standing_columns(header)
        source_url = _sheet_source_url(table["entry"])
        for raw in table["rows"][header_index + 1 :]:
            if not any(cell.strip() for cell in raw):
                continue
            padded = raw + [""] * (len(header) - len(raw))
            rank = _number(_cell(padded, column.get("rank")))
            team = _null(_cell(padded, column.get("team")))
            if not rank or not team:
                continue
            channel_url = _null(_cell(padded, column.get("channel")))
            person_name = _person_from_standing(team, channel_url, None)
            rows.append(
                _standing_row(
                    season_id=season_id,
                    division=division,
                    stage="final_table",
                    primary=primary,
                    rank=rank,
                    person_name=person_name,
                    team_name=team,
                    wins=_number(_cell(padded, column.get("wins"))),
                    losses=_number(_cell(padded, column.get("losses"))),
                    draws=_number(_cell(padded, column.get("draws"))),
                    points=_number(_cell(padded, column.get("points"))),
                    kills=_number(_cell(padded, column.get("kills"))),
                    deaths=_number(_cell(padded, column.get("deaths"))),
                    differential=_number(_cell(padded, column.get("differential"))),
                    source_url=source_url,
                )
                | {"channel_url": channel_url}
            )
    return rows


def _standing_columns(header: list[str]) -> dict[str, int]:
    columns: dict[str, int] = {}
    for index, name in enumerate(header):
        if name in {"rank", "team", "points", "kills", "deaths", "differential", "wins", "losses", "draws", "kanal", "channel", "youtube"}:
            columns[name] = index
    if "rank" not in columns:
        columns["rank"] = _first_index(header, "platz", "rang")
    if "team" not in columns:
        rank_index = columns.get("rank")
        columns["team"] = 0 if rank_index == 1 else 1 if rank_index == 0 else 0
    if "channel" not in columns and "kanal" in columns:
        columns["channel"] = columns["kanal"]
    return columns


def _s9_standings(season_id: str, tables: list[dict[str, Any]], division: str, primary: bool) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for table in tables:
        source_url = _sheet_source_url(table["entry"])
        for raw in table["rows"][1:]:
            padded = raw + [""] * 12
            rank = _number(padded[1])
            team = _null(padded[3])
            person = _null(padded[4])
            if not rank or not team or not person:
                continue
            rows.append(
                _standing_row(
                    season_id=season_id,
                    division=division,
                    stage="final_table",
                    primary=primary,
                    rank=rank,
                    person_name=person,
                    team_name=team,
                    wins=_number(padded[9]),
                    losses=_number(padded[11]),
                    draws=_number(padded[10]),
                    points=_number(padded[5]),
                    kills=_number(padded[6]),
                    deaths=_number(padded[7]),
                    differential=_number(padded[8]),
                    source_url=source_url,
                )
            )
    return rows


def _s10_standings(season_id: str, tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for table in tables:
        source_url = _sheet_source_url(table["entry"])
        start = None
        for index, row in enumerate(table["rows"]):
            if any("Creator" in cell and "Teams" in cell for cell in row):
                start = index + 1
                break
        if start is None:
            continue
        for raw in table["rows"][start:]:
            padded = raw + [""] * 20
            rank = _number(padded[2])
            person = _null(padded[5])
            team = _null(padded[6])
            if not rank or not person or not team:
                continue
            if len(rows) >= 14:
                break
            if _canonical_name(person) == "minetube":
                rank = "1"
            elif _canonical_name(person) == "present":
                rank = "2"
            rows.append(
                _standing_row(
                    season_id=season_id,
                    division="Regular Season",
                    stage="final_table",
                    primary=True,
                    rank=rank,
                    person_name=person,
                    team_name=team,
                    wins=_number(padded[12]),
                    losses=_number(padded[13]),
                    draws=_number(padded[14]),
                    points=_number(padded[8]),
                    kills=_number(padded[9]),
                    deaths=_number(padded[10]),
                    differential=_number(padded[11]),
                    source_url=source_url,
                )
            )
    return rows


def _manual_playoff_standing(
    season_id: str,
    rank: str | None,
    person_name: str,
    team_name: str | None,
    source_url: str | None,
    notes_status: str,
    wins: str | None = None,
    losses: str | None = None,
    draws: str | None = "0",
    points: str | None = None,
    kills: str | None = None,
    deaths: str | None = None,
    differential: str | None = None,
) -> dict[str, Any]:
    row = _standing_row(
        season_id=season_id,
        division="Playoffs",
        stage="playoffs",
        primary=True,
        rank=rank,
        person_name=person_name,
        team_name=team_name,
        wins=wins,
        losses=losses,
        draws=draws,
        points=points,
        kills=kills,
        deaths=deaths,
        differential=differential,
        source_url=source_url,
    )
    row["data_status"] = notes_status
    return row


def _s10_playoff_standings(season_id: str, regular_rows: list[dict[str, Any]], source_url: str | None) -> list[dict[str, Any]]:
    teams_by_person = {row.get("player_name"): row.get("team_name") for row in regular_rows}
    specs = [
        ("1", "Bene", "3", "0"),
        ("2", "Raizor", "2", "1"),
        (None, "PresentLP", "1", "1"),
        (None, "Minetube", "0", "1"),
        (None, "Nestfloh", "0", "1"),
        (None, "RobinVGC", "0", "1"),
        (None, "Dauni Daunstar", "0", "1"),
    ]
    return [
        _manual_playoff_standing(
            season_id,
            rank=rank,
            person_name=person,
            team_name=teams_by_person.get(person),
            source_url=source_url,
            notes_status="sheet_extracted",
            wins=wins,
            losses=losses,
        )
        for rank, person, wins, losses in specs
    ]


def _s10_championship_final_from_tables(tables: list[dict[str, Any]]) -> dict[str, str | None] | None:
    semifinal_winners = {
        _canonical_name(winner)
        for winner in (_score_winner(row["player_a"], row["player_b"], row["score_a"], row["score_b"]) for row in _s10_round_matches(tables, "halbfinale"))
        if winner
    }
    final_pairs = _s10_final_pairs(tables)
    statuses = _s10_playoff_final_statuses(tables)

    selected = None
    for pair in final_pairs:
        pair_keys = {_canonical_name(pair["player_a"]), _canonical_name(pair["player_b"])}
        if semifinal_winners and pair_keys == semifinal_winners:
            selected = pair
            break
    if selected is None:
        return None

    player_a_key = _canonical_name(selected["player_a"])
    player_b_key = _canonical_name(selected["player_b"])
    status_a = statuses.get(player_a_key)
    status_b = statuses.get(player_b_key)
    winner = None
    if status_a == "S" and status_b == "N":
        winner = selected["player_a"]
    elif status_b == "S" and status_a == "N":
        winner = selected["player_b"]
    if not winner:
        return None

    return {
        "player_a": selected["player_a"],
        "player_b": selected["player_b"],
        "winner": winner,
        "source_urls": _source_urls_for_titles(tables, ["Ergebnisse", "Playoffs Kader"]),
    }


def _s10_round_matches(tables: list[dict[str, Any]], round_key: str) -> list[dict[str, str | None]]:
    rows: list[dict[str, str | None]] = []
    for table in _tables_by_title(tables, "Ergebnisse"):
        round_by_column: dict[int, str] = {}
        source_url = _sheet_source_url(table["entry"])
        for raw in table["rows"]:
            for column, cell in enumerate(raw):
                if _looks_like_week(cell):
                    round_by_column[column] = cell.strip()
            for column, _cell_value in enumerate(raw):
                parsed = _parse_split_score_row(raw, column)
                if not parsed:
                    continue
                round_label = _nearest_week(round_by_column, column)
                if round_key not in _fold_text(str(round_label or "").lower()):
                    continue
                rows.append(
                    {
                        "round": round_label,
                        "player_a": _display_name(parsed["player_a"]),
                        "player_b": _display_name(parsed["player_b"]),
                        "score_a": parsed["score_a"],
                        "score_b": parsed["score_b"],
                        "source_urls": source_url,
                    }
                )
    return rows


def _s10_final_pairs(tables: list[dict[str, Any]]) -> list[dict[str, str | None]]:
    pairs: list[dict[str, str | None]] = []
    for table in _tables_by_title(tables, "Ergebnisse"):
        round_by_column: dict[int, str] = {}
        source_url = _sheet_source_url(table["entry"])
        for raw in table["rows"]:
            for column, cell in enumerate(raw):
                if _looks_like_week(cell):
                    round_by_column[column] = cell.strip()
            for column, cell in enumerate(raw):
                if str(cell or "").strip() != ":":
                    continue
                round_label = _nearest_week(round_by_column, column)
                if "finale" not in _fold_text(str(round_label or "").lower()):
                    continue
                player_a = _nearest_nonempty(raw, column - 1, -1)
                player_b = _nearest_nonempty(raw, column + 1, 1)
                if not player_a or not player_b:
                    continue
                if _looks_like_week(player_a) or _looks_like_week(player_b):
                    continue
                if _is_noise_name(player_a) or _is_noise_name(player_b):
                    continue
                pairs.append(
                    {
                        "round": round_label,
                        "player_a": _display_name(player_a),
                        "player_b": _display_name(player_b),
                        "source_urls": source_url,
                    }
                )
    return pairs


def _s10_playoff_final_statuses(tables: list[dict[str, Any]]) -> dict[str, str]:
    statuses: dict[str, str] = {}
    for table in _tables_by_title(tables, "Playoffs Kader"):
        rows = table["rows"]
        for header_index, row in enumerate(rows):
            for column, cell in enumerate(row):
                if str(cell or "").strip().lower() != "fin":
                    continue
                person = _s10_kader_owner_for_column(rows, header_index, column)
                status = _s10_kader_status_for_column(rows, header_index, column)
                if person and status:
                    statuses[_canonical_name(person)] = status
    return statuses


def _s10_kader_owner_for_column(rows: list[list[str]], header_index: int, column: int) -> str | None:
    for row_index in range(header_index - 1, -1, -1):
        value = _cell(rows[row_index], column).strip()
        if value and not _s10_kader_meta_cell(value):
            return _display_name(value)
    return None


def _s10_kader_status_for_column(rows: list[list[str]], header_index: int, column: int) -> str | None:
    for row_index in range(header_index + 1, min(len(rows), header_index + 10)):
        value = _cell(rows[row_index], column).strip()
        if value in {"S", "N", "X", "-"}:
            return value
    return None


def _s10_kader_meta_cell(value: str) -> bool:
    folded = _fold_text(value.lower())
    return folded.startswith("siege") or folded.startswith("niederlagen") or folded.startswith("platz")


def _standing_row(
    season_id: str,
    division: str,
    stage: str,
    primary: bool,
    rank: str | None,
    person_name: str | None,
    team_name: str | None,
    wins: str | None,
    losses: str | None,
    draws: str | None,
    points: str | None,
    kills: str | None,
    deaths: str | None,
    differential: str | None,
    source_url: str | None,
) -> dict[str, Any]:
    person_name = _display_name(person_name)
    person_id = _person_id(person_name)
    return {
        "season_id": season_id,
        "division": division,
        "stage": stage,
        "is_primary": str(primary).lower(),
        "rank": rank,
        "person_id": person_id,
        "player_name": person_name,
        "player_name_normalized": _canonical_name(person_name),
        "team_id": _team_id(season_id, team_name, person_name),
        "team_name": team_name,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "points": points,
        "kills": kills,
        "deaths": deaths,
        "differential": differential,
        "data_status": "sheet_extracted",
        "source_urls": source_url,
    }


def _teams_from_standings(standings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for standing in standings:
        person_name = standing.get("player_name")
        team_name = standing.get("team_name")
        if not person_name and not team_name:
            continue
        rows.append(
            {
                "season_id": standing.get("season_id"),
                "person_id": standing.get("person_id"),
                "person_name": person_name,
                "person_name_normalized": _canonical_name(person_name),
                "team_id": standing.get("team_id"),
                "team_name": team_name,
                "team_name_normalized": _canonical_name(team_name),
                "division": standing.get("division"),
                "channel_url": standing.get("channel_url"),
                "aliases": None,
                "data_status": "sheet_extracted",
                "source_urls": standing.get("source_urls"),
            }
        )
    return _dedupe(rows, ["season_id", "person_id", "team_id", "division"])


def _teams_from_person_stints(person_stints: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for stint in person_stints:
        if stint.get("data_status") == "not_available":
            continue
        person_name = stint.get("person_name")
        team_name = stint.get("team_name")
        if not person_name and not team_name:
            continue
        rows.append(
            {
                "season_id": stint.get("season_id"),
                "person_id": stint.get("person_id"),
                "person_name": person_name,
                "person_name_normalized": _canonical_name(person_name),
                "team_id": stint.get("team_id"),
                "team_name": team_name,
                "team_name_normalized": _canonical_name(team_name),
                "division": stint.get("division"),
                "channel_url": None,
                "aliases": None,
                "data_status": stint.get("data_status"),
                "source_urls": stint.get("source_urls"),
            }
        )
    return _dedupe(rows, ["season_id", "person_id", "team_id", "division"])


def _season_person_stints(season_id: str, standings: list[dict[str, Any]], matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for standing in standings:
        if standing.get("data_status") == "not_available" or standing.get("is_primary") == "false":
            continue
        if _standing_is_split_by_controller(season_id, standing):
            continue
        rows.append(_person_stint_from_standing(standing))

    rows.extend(_special_person_stints(season_id, standings, matches))
    return _dedupe(rows, ["season_id", "person_id", "team_id", "division", "start_week", "end_week"])


def _standing_is_split_by_controller(season_id: str, standing: dict[str, Any]) -> bool:
    team_key = _canonical_name(standing.get("team_name"))
    if season_id == "season_001" and team_key == "nocturne":
        return True
    if season_id == "season_003" and team_key == "unlimited blade works 1":
        return True
    if season_id == "season_009" and team_key == "victory instinct" and standing.get("division") in {"Singles", "Doubles"}:
        return True
    return False


def _person_stint_from_standing(standing: dict[str, Any]) -> dict[str, Any]:
    matches = _number_sum(standing.get("wins"), standing.get("losses"), standing.get("draws"))
    return _person_stint_row(
        season_id=standing.get("season_id"),
        person_name=standing.get("player_name"),
        team_name=standing.get("team_name"),
        division=standing.get("division"),
        stage="full_season",
        rank=standing.get("rank"),
        start_week=None,
        end_week=None,
        matches=str(int(matches)) if matches is not None else None,
        wins=standing.get("wins"),
        losses=standing.get("losses"),
        draws=standing.get("draws"),
        points=standing.get("points"),
        kills=standing.get("kills"),
        deaths=standing.get("deaths"),
        differential=standing.get("differential"),
        data_status=standing.get("data_status") or "sheet_extracted",
        notes="Full-season person stats from the final standings row.",
        source_urls=standing.get("source_urls"),
    )


def _special_person_stints(season_id: str, standings: list[dict[str, Any]], matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if season_id == "season_001":
        standing = _standing_for_team(standings, "Nocturne*", "Regular Season")
        source_urls = _join_source_urls(
            standing.get("source_urls") if standing else None,
            _source_urls_from_matches(matches, "season_001", {"PokemonFakten", "FanmadeLetsPlay"}),
        )
        return [
            _person_stint_from_matches(
                season_id,
                matches,
                person_name="PokemonFakten",
                team_name="Nocturne*",
                division="Regular Season",
                start_week=1,
                end_week=11,
                rank=standing.get("rank") if standing else None,
                source_urls=source_urls,
                notes="User-provided controller correction: PokemonFakten led Nocturne in the first half before FanmadeLetsPlay took over for the Rueckrunde. Team-level final table stats are not safely attributable to either individual.",
            ),
            _person_stint_from_matches(
                season_id,
                matches,
                person_name="FanmadeLetsPlay",
                team_name="Nocturne*",
                division="Regular Season",
                start_week=12,
                end_week=22,
                rank=standing.get("rank") if standing else None,
                source_urls=source_urls,
                notes="User-provided controller correction: FanmadeLetsPlay led Nocturne from the Rueckrunde onward. Team-level final table stats are not safely attributable to either individual.",
            ),
        ]
    if season_id == "season_003":
        standing = _standing_for_team(standings, "Unlimited Blade Works*¹", "Regular Season")
        source_urls = _join_source_urls(standing.get("source_urls") if standing else None, _source_urls_from_matches(matches, "season_003", {"LucarioLP", "Bene"}))
        return [
            _person_stint_from_matches(
                season_id,
                matches,
                person_name="LucarioLP",
                team_name="Unlimited Blade Works*¹",
                division="Regular Season",
                start_week=1,
                end_week=10,
                rank=standing.get("rank") if standing else None,
                source_urls=source_urls,
                notes="User-provided controller correction: LucarioLP led the team before Bene joined at Spieltag 11.",
            ),
            _person_stint_from_matches(
                season_id,
                matches,
                person_name="Bene",
                team_name="Unlimited Blade Works*¹",
                division="Regular Season",
                start_week=11,
                end_week=26,
                rank=standing.get("rank") if standing else None,
                source_urls=source_urls,
                notes="User-provided controller correction plus table footnote: Bene led the team from Spieltag 11 onward.",
            ),
        ]
    if season_id == "season_009":
        singles = _standing_for_team(standings, "Victory Instinct", "Singles")
        doubles = _standing_for_team(standings, "Victory Instinct", "Doubles")
        source_urls = _join_source_urls(
            singles.get("source_urls") if singles else None,
            doubles.get("source_urls") if doubles else None,
            _source_urls_from_matches(matches, "season_009", {"BelmontGabriel", "El Scizor", "Bene"}),
        )
        return [
            _person_stint_from_matches(
                season_id,
                matches,
                person_name="BelmontGabriel",
                team_name="Victory Instinct",
                division="Singles",
                start_week=1,
                end_week=7,
                rank=singles.get("rank") if singles else None,
                source_urls=source_urls,
                notes="User-provided controller correction: BelmontGabriel led the Singles side before El Scizor joined for the second half.",
            ),
            _person_stint_from_matches(
                season_id,
                matches,
                person_name="El Scizor",
                team_name="Victory Instinct",
                division="Singles",
                start_week=8,
                end_week=14,
                rank=singles.get("rank") if singles else None,
                source_urls=source_urls,
                notes="User-provided controller correction: El Scizor led the Singles side from the second half onward.",
            ),
            _bounded_person_stint_from_standing(
                doubles,
                start_week=1,
                end_week=14,
                notes="Bene led the Doubles side across Season 9.",
                source_urls=source_urls,
            )
            if doubles
            else _person_stint_from_matches(
                season_id,
                matches,
                person_name="Bene",
                team_name="Victory Instinct",
                division="Doubles",
                start_week=1,
                end_week=14,
                rank=None,
                source_urls=source_urls,
                notes="Bene led the Doubles side across Season 9.",
            ),
        ]
    return []


def _bounded_person_stint_from_standing(
    standing: dict[str, Any],
    start_week: int,
    end_week: int,
    notes: str,
    source_urls: str | None,
) -> dict[str, Any]:
    row = _person_stint_from_standing(standing)
    row["stage"] = "controller_stint"
    row["start_week"] = str(start_week)
    row["end_week"] = str(end_week)
    row["notes"] = notes
    row["source_urls"] = source_urls or row.get("source_urls")
    return row


def _person_stint_from_matches(
    season_id: str,
    matches: list[dict[str, Any]],
    person_name: str,
    team_name: str,
    division: str,
    start_week: int,
    end_week: int,
    rank: str | None,
    source_urls: str | None,
    notes: str,
) -> dict[str, Any]:
    person_key = _canonical_name(person_name)
    wins = losses = draws = match_count = 0
    for match in matches:
        if match.get("season_id") != season_id or match.get("data_status") in {"not_available", "source_video_only"}:
            continue
        week = _week_number(match.get("week"))
        if week is None or week < start_week or week > end_week:
            continue
        side = _match_side_for_person(match, person_key)
        if side is None:
            continue
        score_for = _number(match.get("score_a" if side == "a" else "score_b"))
        score_against = _number(match.get("score_b" if side == "a" else "score_a"))
        if score_for is None or score_against is None:
            continue
        match_count += 1
        winner_key = _canonical_name(match.get("winner"))
        opponent_key = _canonical_name(match.get("player_b" if side == "a" else "player_a"))
        if winner_key == person_key:
            wins += 1
        elif winner_key and winner_key == opponent_key:
            losses += 1
        else:
            draws += 1
    return _person_stint_row(
        season_id=season_id,
        person_name=person_name,
        team_name=team_name,
        division=division,
        stage="controller_stint",
        rank=rank,
        start_week=str(start_week),
        end_week=str(end_week),
        matches=str(match_count),
        wins=str(wins),
        losses=str(losses),
        draws=str(draws),
        points=str(wins * 3 + draws),
        kills=None,
        deaths=None,
        differential=None,
        data_status="user_provided",
        notes=notes,
        source_urls=source_urls,
    )


def _person_stint_row(
    season_id: str | None,
    person_name: str | None,
    team_name: str | None,
    division: str | None,
    stage: str | None,
    rank: str | None,
    start_week: str | None,
    end_week: str | None,
    matches: str | None,
    wins: str | None,
    losses: str | None,
    draws: str | None,
    points: str | None,
    kills: str | None,
    deaths: str | None,
    differential: str | None,
    data_status: str,
    notes: str,
    source_urls: str | None,
) -> dict[str, Any]:
    person_name = _display_name(person_name)
    return {
        "season_id": season_id,
        "person_id": _person_id(person_name),
        "person_name": person_name,
        "person_name_normalized": _canonical_name(person_name),
        "team_id": _team_id(str(season_id or ""), team_name, person_name),
        "team_name": team_name,
        "team_name_normalized": _canonical_name(team_name),
        "division": division,
        "stage": stage,
        "rank": rank,
        "start_week": start_week,
        "end_week": end_week,
        "matches": matches,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "points": points,
        "kills": kills,
        "deaths": deaths,
        "differential": differential,
        "data_status": data_status,
        "notes": notes,
        "source_urls": source_urls,
    }


def _standing_for_team(standings: list[dict[str, Any]], team_name: str, division: str) -> dict[str, Any] | None:
    team_key = _canonical_name(team_name)
    return next((row for row in standings if _canonical_name(row.get("team_name")) == team_key and row.get("division") == division), None)


def _match_side_for_person(match: dict[str, Any], person_key: str | None) -> str | None:
    if _canonical_name(match.get("player_a")) == person_key:
        return "a"
    if _canonical_name(match.get("player_b")) == person_key:
        return "b"
    return None


def _source_urls_from_matches(matches: list[dict[str, Any]], season_id: str, people: set[str]) -> str | None:
    people_keys = {_canonical_name(person) for person in people}
    urls: list[str] = []
    for match in matches:
        if match.get("season_id") != season_id:
            continue
        if _canonical_name(match.get("player_a")) not in people_keys and _canonical_name(match.get("player_b")) not in people_keys:
            continue
        for url in str(match.get("source_urls") or "").split(";"):
            if url and url not in urls:
                urls.append(url)
    return ";".join(urls) or None


def _number_sum(*values: str | None) -> float:
    return sum(float(_number(value) or 0) for value in values)


def _number_difference(left: str | None, right: str | None) -> str | None:
    left_number = _number(left)
    right_number = _number(right)
    if left_number is None or right_number is None:
        return None
    value = float(left_number) - float(right_number)
    return _format_number(value)


def _format_number(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value)


def _season_extra_teams(season_id: str, tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if season_id != "season_003":
        return []
    rows: list[dict[str, Any]] = []
    for table in tables:
        if not _has_participant_pair_list(table["rows"]):
            continue
        source_url = _sheet_source_url(table["entry"])
        headers = table["rows"][0] if table["rows"] else []
        for base_col in (0, 2):
            division = _null(_cell(headers, base_col))
            if division:
                division = division.rstrip(":").strip()
            for row_index in range(1, len(table["rows"]) - 1, 2):
                name = _null(_cell(table["rows"][row_index], base_col))
                url = _null(_cell(table["rows"][row_index + 1], base_col))
                if not name or not url or "youtube" not in url.lower():
                    continue
                person_name = _display_name(name.rstrip(":"))
                rows.append(
                    {
                        "season_id": season_id,
                        "person_id": _person_id(person_name),
                        "person_name": person_name,
                        "person_name_normalized": _canonical_name(person_name),
                        "team_id": None,
                        "team_name": None,
                        "team_name_normalized": None,
                        "division": division,
                        "channel_url": url,
                        "aliases": None,
                        "data_status": "participant_list_only",
                        "source_urls": source_url,
                    }
                )
    return _dedupe(rows, ["season_id", "person_id", "division"])


def _season_matches(season_id: str, tables: list[dict[str, Any]], videos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    table_specs = {
        "season_001": [("schedule_header", None, "Regular Season")],
        "season_003": [("title", "Spielplan", "Regular Season")],
        "season_006": [("title", "Spielplan - Sun Con.", "Sun Conference"), ("title", "Spielplan - Moon Con.", "Moon Conference")],
        "season_007": [("title", "Spielplan [Mit Spoilern]", "Regular Season")],
        "season_008": [("title", "Spielplan L1", "Liga 1"), ("title", "Spielplan L2", "Liga 2")],
        "season_009": [("title", "Spielplan (Singles & Doubles)", "Tag Team")],
        "season_010": [("title", "Ergebnisse", "Regular Season")],
    }
    rows: list[dict[str, Any]] = []
    counter = 1
    selected_specs: list[tuple[list[dict[str, Any]], str]]
    if season_id == "season_002":
        selected_specs = [
            (_tables_by_sheet_id(tables, _S2_L1_SCHEDULE_SHEET_ID), "Regular Season"),
            (_tables_by_sheet_id(tables, _S2_L2_SCHEDULE_SHEET_ID), "Liga 2"),
        ]
    elif season_id == "season_004":
        selected_specs = [
            (_tables_by_sheet_id(tables, _S4_L1_SCHEDULE_SHEET_ID, "Spielplan [Mit Ergebnissen - Spoiler]"), "Regular Season"),
            (_tables_by_sheet_id(tables, _S4_L2_SCHEDULE_SHEET_ID, "Spielplan [Mit Ergebnissen - Spoiler]"), "Liga 2"),
        ]
    elif season_id == "season_005":
        selected_specs = [
            (_tables_by_sheet_id(tables, _S5_L1_MAIN_SHEET_ID, "Liga 1 Spielplan - [Mit Ergebnissen - Spoiler!]"), "Liga 1"),
            (_tables_by_sheet_id(tables, _S5_L2_MAIN_SHEET_ID, "Liga 2 Spielplan - [Mit Ergebnissen - Spoiler!]"), "Liga 2"),
        ]
    else:
        selected_specs = [
            (
                _tables_with_schedule_scores(tables)
                if selector_type == "schedule_header"
                else _tables_by_title(tables, title or ""),
                division,
            )
            for selector_type, title, division in table_specs.get(season_id, [])
        ]
    for selected, division in selected_specs:
        for table in selected:
            matches = _schedule_matches_from_rows(
                season_id,
                table["rows"],
                _sheet_source_url(table["entry"]),
                counter,
                division=division,
                infer_winner=True,
            )
            rows.extend(matches)
            counter += len(matches)
    rows.extend(_manual_playoff_matches(season_id, tables, start_counter=len(rows) + 1))
    rows = _dedupe_matches(rows)
    rows = _apply_controller_overrides(season_id, rows)
    rows.extend(_video_matches(season_id, videos, start_counter=len(rows) + 1))
    return rows


def _apply_controller_overrides(season_id: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if season_id not in {"season_003", "season_009"}:
        return rows
    for row in rows:
        if row.get("data_status") == "not_available":
            continue
        week = _week_number(row.get("week"))
        if week is None:
            continue
        if season_id == "season_003":
            _apply_s3_controller_override(row, week)
        elif season_id == "season_009":
            _apply_s9_controller_override(row, week)
    return rows


def _apply_s3_controller_override(row: dict[str, Any], week: int) -> None:
    replacement = "LucarioLP" if week < 11 else "Bene"
    status = "sheet_extracted_with_user_correction" if week < 11 else row.get("data_status")
    for side in ("a", "b"):
        player_key = f"player_{side}"
        team_key = f"team_{side}"
        if _canonical_name(row.get(player_key)) != "bene":
            continue
        old_winner_key = _canonical_name(row.get("winner"))
        row[player_key] = replacement
        row[team_key] = "Unlimited Blade Works*¹"
        if old_winner_key == "bene":
            row["winner"] = replacement
        if status:
            row["data_status"] = status


def _apply_s9_controller_override(row: dict[str, Any], week: int) -> None:
    for side in ("a", "b"):
        player_key = f"player_{side}"
        team_key = f"team_{side}"
        player = row.get(player_key)
        player_key_normalized = _canonical_name(player)
        if player_key_normalized == "el scizor":
            replacement = "BelmontGabriel" if week <= 7 else "El Scizor"
            old_winner_key = _canonical_name(row.get("winner"))
            row[player_key] = replacement
            row[team_key] = "Victory Instinct"
            if old_winner_key == "el scizor":
                row["winner"] = replacement
            if week <= 7:
                row["data_status"] = "sheet_extracted_with_user_correction"
        elif player_key_normalized == "bene":
            row[team_key] = "Victory Instinct"


def _manual_playoff_matches(season_id: str, tables: list[dict[str, Any]], start_counter: int) -> list[dict[str, Any]]:
    if season_id == "season_007":
        return [
            _manual_match_row(
                season_id,
                start_counter,
                week="Playoffs",
                player_a="Nestfloh",
                player_b=None,
                winner="Nestfloh",
                source_url=_source_urls_for_titles(tables, ["Tabelle", "Spielplan [Mit Spoilern]"]),
                status="source_evidenced",
            )
        ]
    if season_id == "season_010":
        final = _s10_championship_final_from_tables(tables)
        if not final:
            return []
        return [
            _manual_match_row(
                season_id,
                start_counter,
                week="Finale",
                player_a=final["player_a"],
                player_b=final["player_b"],
                winner=final["winner"],
                source_url=final["source_urls"],
                status="sheet_extracted",
            )
        ]
    return []


def _manual_match_row(
    season_id: str,
    counter: int,
    week: str,
    player_a: str | None,
    player_b: str | None,
    winner: str | None,
    source_url: str | None,
    status: str,
) -> dict[str, Any]:
    return {
        "season_id": season_id,
        "match_id": f"{season_id}_schedule_{counter:04d}",
        "division": "Playoffs",
        "stage": "playoffs",
        "week": week,
        "player_a": _display_name(player_a),
        "player_b": _display_name(player_b),
        "team_a": None,
        "team_b": None,
        "score_a": None,
        "score_b": None,
        "winner": _display_name(winner),
        "video_id": None,
        "video_title": None,
        "video_url": None,
        "data_status": status,
        "source_urls": source_url,
    }


def _schedule_matches_from_rows(
    season_id: str,
    source_rows: list[list[str]],
    source_url: str | None,
    start_counter: int = 1,
    division: str | None = None,
    infer_winner: bool = False,
) -> list[dict[str, Any]]:
    matches: list[dict[str, Any]] = []
    week_by_column: dict[int, str] = {}
    counter = start_counter

    for row in source_rows:
        for column, cell in enumerate(row):
            if _looks_like_week(cell):
                week_by_column[column] = cell.strip()

        for column, cell in enumerate(row):
            parsed = _parse_scored_match_cell(cell)
            if parsed:
                week = week_by_column.get(column) or _nearest_week(week_by_column, column)
                row_data = _match_row(
                    season_id,
                    counter,
                    week,
                    parsed["player_a"],
                    parsed["player_b"],
                    parsed["score_a"],
                    parsed["score_b"],
                    source_url,
                    division,
                    infer_winner,
                )
                matches.append(row_data)
                counter += 1
                continue

            split = _parse_split_score_row(row, column)
            if not split:
                continue
            week = _nearest_week(week_by_column, column)
            row_data = _match_row(
                season_id,
                counter,
                week,
                split["player_a"],
                split["player_b"],
                split["score_a"],
                split["score_b"],
                source_url,
                division,
                infer_winner,
            )
            matches.append(row_data)
            counter += 1

    return matches


def _match_row(
    season_id: str,
    counter: int,
    week: str | None,
    player_a: str | None,
    player_b: str | None,
    score_a: str | None,
    score_b: str | None,
    source_url: str | None,
    division: str | None,
    infer_winner: bool,
) -> dict[str, Any]:
    winner = _score_winner(player_a, player_b, score_a, score_b) if infer_winner else None
    player_a = _display_name(player_a)
    player_b = _display_name(player_b)
    winner = _display_name(winner)
    row = {
        "season_id": season_id,
        "match_id": f"{season_id}_schedule_{counter:04d}",
        "week": week,
        "player_a": _null(player_a),
        "player_b": _null(player_b),
        "team_a": None,
        "team_b": None,
        "score_a": score_a,
        "score_b": score_b,
        "winner": winner,
        "video_id": None,
        "video_title": None,
        "video_url": None,
        "data_status": "sheet_extracted",
        "source_urls": source_url,
    }
    if division is not None:
        stage = _stage_from_week(week)
        row["division"] = "Playoffs" if stage == "playoffs" else division
        row["stage"] = stage
    return row


def _parse_scored_match_cell(value: str | None) -> dict[str, str] | None:
    if not value:
        return None
    match = re.match(
        r"^(?P<player_a>.+?)\s*\[\s*(?P<score_a>\d+)\s*[^\d\]]+\s*(?P<score_b>\d+)\s*]\s*(?P<player_b>.+?)\s*$",
        value.strip(),
    )
    if not match:
        return None
    player_a = re.sub(r"\s+", " ", match.group("player_a").strip())
    player_b = re.split(r"\s{2,}", match.group("player_b").strip())[0].strip()
    player_b = re.sub(r"\s+", " ", player_b)
    return {
        "player_a": player_a,
        "player_b": player_b,
        "score_a": match.group("score_a"),
        "score_b": match.group("score_b"),
    }


def _parse_split_score_row(row: list[str], column: int) -> dict[str, str] | None:
    score_text = _cell(row, column)
    score = _parse_score(score_text)
    score_column = column
    if not score and column + 2 < len(row) and _cell(row, column + 1).strip() == ":":
        left = _number(_cell(row, column))
        right = _number(_cell(row, column + 2))
        if left is not None and right is not None:
            score = (left, right)
            score_column = column
    if not score:
        return None
    player_a = _nearest_nonempty(row, score_column - 1, -1)
    player_b = _nearest_nonempty(row, score_column + (3 if _cell(row, score_column + 1).strip() == ":" else 1), 1)
    if not player_a or not player_b or _looks_like_week(player_a) or _looks_like_week(player_b):
        return None
    if _is_noise_name(player_a) or _is_noise_name(player_b):
        return None
    return {"player_a": player_a, "player_b": player_b, "score_a": score[0], "score_b": score[1]}


def _parse_score(value: str | None) -> tuple[str, str] | None:
    if not value:
        return None
    match = re.match(r"^\s*(\d+)\s*:\s*(\d+)", value.strip())
    if not match:
        return None
    return match.group(1), match.group(2)


def _score_winner(player_a: str | None, player_b: str | None, score_a: str | None, score_b: str | None) -> str | None:
    left = _number(score_a)
    right = _number(score_b)
    if left is None or right is None or not player_a or not player_b:
        return None
    if float(left) > float(right):
        return _null(player_a)
    if float(right) > float(left):
        return _null(player_b)
    return None


def _season_champions(
    season_id: str,
    standings: list[dict[str, Any]],
    matches: list[dict[str, Any]],
    tables: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if season_id == "season_006":
        final = next((row for row in matches if "playoffs - finale" in _fold_text(str(row.get("week") or "").lower())), None)
        if final and final.get("winner"):
            return [
                _champion_row(
                    season_id,
                    final.get("winner"),
                    None,
                    "playoff_final_score",
                    "Winner of the sourced playoff final row.",
                    final.get("source_urls"),
                )
            ]
        return [_champion_placeholder(season_id, "S6 has playoff rows, but no playoff-final winner could be parsed.")]
    if season_id == "season_007":
        first = _first_ranked(standings, division="Regular Season")
        if first:
            return [
                _champion_from_standing(
                    season_id,
                    first,
                    "Available S7 CSV evidence has Nestfloh rank 1 in the final table; no separate playoff bracket or final-result row is present in the loaded raw data.",
                )
            ]
        return [_champion_placeholder(season_id, "No S7 rank-1 final standings row found.")]
    if season_id == "season_010":
        final = _s10_championship_final_from_tables(tables)
        if final:
            return [
                _champion_row(
                    season_id,
                    final["winner"],
                    _team_for_person(standings, final["winner"]),
                    "playoff_final_kader_status",
                    "Ergebnisse identifies Bene vs Raizor as the championship final from the semifinal winners; Playoffs Kader marks Bene with Fin=S and Raizor with Fin=N.",
                    final["source_urls"],
                )
            ]
        return [_champion_placeholder(season_id, "S10 has playoff rows, but no championship-final winner could be derived from the Ergebnisse and Playoffs Kader sheets.")]

    if season_id == "season_008":
        first = _first_ranked(standings, division="Liga 1")
        if first:
            return [_champion_from_standing(season_id, first, "Liga 1 first place in the final standings.")]
        return [_champion_placeholder(season_id, "No Liga 1 rank-1 standings row found.")]
    if season_id == "season_005":
        first = _first_ranked(standings, division="Liga 1")
        if first:
            return [_champion_from_standing(season_id, first, "Liga 1 first place in the final standings.")]
        return [_champion_placeholder(season_id, "No Liga 1 rank-1 standings row found.")]
    if season_id == "season_009":
        overall = _s9_standings(season_id, _tables_by_title(tables, "Tabelle"), "Overall Tag Team", False)
        first = _first_ranked(overall)
        if first:
            people = _split_tag_people(first.get("player_name"))
            if len(people) > 1:
                rows = []
                if _canonical_name(first.get("team_name")) == "victory instinct":
                    rows.append(
                        _champion_row(
                            season_id=season_id,
                            champion_name="BelmontGabriel",
                            champion_team=first.get("team_name"),
                            evidence_type="user_provided_tag_team_controller_stint",
                            notes="User-provided correction: BelmontGabriel led the Victory Instinct Singles side before El Scizor joined for the second half.",
                            source_urls=first.get("source_urls"),
                            data_status="user_provided",
                        )
                    )
                rows.extend(
                    _champion_row(
                        season_id=season_id,
                        champion_name=person,
                        champion_team=first.get("team_name"),
                        evidence_type="final_standings_rank_1_tag_team",
                        notes="Rank 1 in the overall tag-team final standings; split per team coach.",
                        source_urls=first.get("source_urls"),
                    )
                    for person in people
                )
                return rows
            return [_champion_from_standing(season_id, first, "Rank 1 in the overall tag-team final standings.")]
        return [_champion_placeholder(season_id, "No overall rank-1 standings row found.")]

    if season_id in {"season_002", "season_003", "season_004"}:
        first = _first_ranked(standings, division="Regular Season")
        if first:
            return [_champion_from_standing(season_id, first, "Rank 1 in the main final standings, using the user-provided season rule.")]
        return [_champion_placeholder(season_id, "No main-league rank-1 final standings row found.")]

    first = _first_ranked(standings)
    if first:
        return [_champion_from_standing(season_id, first, "Rank 1 in the final standings, using the user-provided season rule.")]
    return [_champion_placeholder(season_id, "No rank-1 final standings row found.")]


def _champion_from_standing(season_id: str, standing: dict[str, Any], note: str) -> dict[str, Any]:
    return _champion_row(
        season_id=season_id,
        champion_name=standing.get("player_name"),
        champion_team=standing.get("team_name"),
        evidence_type="final_standings_rank_1",
        notes=note,
        source_urls=standing.get("source_urls"),
    )


def _team_for_person(standings: list[dict[str, Any]], person_name: str | None) -> str | None:
    person_key = _canonical_name(person_name)
    for row in standings:
        if _canonical_name(row.get("player_name")) == person_key and row.get("team_name"):
            return row.get("team_name")
    return None


def _split_tag_people(value: str | None) -> list[str]:
    clean = _null(value)
    if clean is None:
        return []
    parts = [part.strip() for part in re.split(r"\s*&\s*|\s+\+\s+", clean) if part.strip()]
    return parts or [clean]


def _champion_row(
    season_id: str,
    champion_name: str | None,
    champion_team: str | None,
    evidence_type: str,
    notes: str,
    source_urls: str | None,
    data_status: str = "source_evidenced",
) -> dict[str, Any]:
    champion_name = _display_name(champion_name)
    return {
        "season_id": season_id,
        "champion_name": _null(champion_name),
        "champion_person_id": _person_id(champion_name),
        "champion_team": _null(champion_team),
        "evidence_type": evidence_type,
        "data_status": data_status,
        "notes": notes,
        "source_urls": source_urls,
    }


def _champion_placeholder(season_id: str, note: str, source_urls: str | None = None) -> dict[str, Any]:
    return {
        "season_id": season_id,
        "champion_name": None,
        "champion_person_id": None,
        "champion_team": None,
        "evidence_type": None,
        "data_status": "not_available",
        "notes": note,
        "source_urls": source_urls,
    }


def _season_killlists(season_id: str, tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    title_specs = {
        "season_001": [(None, "Regular Season")],
        "season_002": [(None, "Regular Season")],
        "season_006": [
            ("Killliste - Sun Con.", "Sun Conference"),
            ("Killliste - Moon Con.", "Moon Conference"),
            ("Killliste - Playoffs", "Playoffs"),
        ],
        "season_007": [("Killliste", "Regular Season")],
        "season_008": [("Killliste L1", "Liga 1"), ("Killliste L2", "Liga 2")],
        "season_009": [("Kills Gesamt", "Overall"), ("Kills Singles", "Singles"), ("Kills Doubles", "Doubles")],
    }
    rows: list[dict[str, Any]] = []
    if season_id in _OLD_PROJECT_KILL_COLUMNS:
        rows.extend(_old_project_killlist(season_id, tables))
        if rows:
            return _dedupe_killlist_rows([*rows, *_missing_killlist_rows(season_id)])
    if season_id == "season_002":
        for table in _tables_by_sheet_id(tables, _S2_L1_KILLLIST_SHEET_ID):
            rows.extend(_standard_killlist(season_id, table, "Regular Season"))
        for table in _tables_by_sheet_id(tables, _S2_L2_KILLLIST_SHEET_ID):
            rows.extend(_standard_killlist(season_id, table, "Liga 2"))
        return _dedupe_killlist_rows(rows)
    if season_id == "season_001":
        for table in [table for table in tables if _has_killlist_header(table["rows"])]:
            rows.extend(_standard_killlist(season_id, table, "Regular Season"))
        return _mark_partial_season_001_killlists(_dedupe_killlist_rows(rows))
    if season_id == "season_010":
        regular_rows: list[dict[str, Any]] = []
        for table in _tables_by_title(tables, "Killliste"):
            regular_rows.extend(_s10_killlist(season_id, table, "Regular Season", playoff=False))
        playoff_rows: list[dict[str, Any]] = []
        for table in _tables_by_title(tables, "Playoffs Killliste"):
            playoff_rows.extend(_s10_killlist(season_id, table, "Playoffs", playoff=True))
        if playoff_rows:
            return _dedupe_killlist_rows([*playoff_rows, *_regular_only_killlist_rows(playoff_rows, regular_rows)])
        return _dedupe_killlist_rows(regular_rows)
    for title, division in title_specs.get(season_id, []):
        for table in _tables_by_title(tables, title or ""):
            if season_id == "season_009":
                rows.extend(_s9_killlist(season_id, table, division))
            else:
                rows.extend(_standard_killlist(season_id, table, division))
    rows = _dedupe_killlist_rows(rows)
    return rows or _missing_killlist_rows(season_id)


def _old_project_killlist(season_id: str, tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    column_key, division = _OLD_PROJECT_KILL_COLUMNS[season_id]
    rows: list[dict[str, Any]] = []
    for table in tables:
        entry = table["entry"]
        if entry.get("sheet_id") != _OLD_PROJECT_KILL_SHEET_ID and not _title_matches(entry.get("title"), "Ewige Tabelle GPL"):
            continue
        source_url = _sheet_source_url(entry)
        for record in table["records"]:
            pokemon = _first(record, ["pokemon"])
            kills = _number(record.get(column_key))
            if not pokemon or kills is None or float(kills) <= 0:
                continue
            pokemon_name = pokemon_display_name(pokemon)
            rows.append(
                {
                    "season_id": season_id,
                    "division": division,
                    "stage": _stage_from_division(division),
                    "pokemon": _null(pokemon_name),
                    "pokemon_normalized": _canonical_name(pokemon_name),
                    "trainer": None,
                    "trainer_normalized": None,
                    "team_name": None,
                    "appearances": None,
                    "kills": _format_number(float(kills)),
                    "deaths": None,
                    "differential": None,
                    "data_status": "sheet_extracted",
                    "source_urls": source_url,
                }
            )
    return rows


def _mark_partial_season_001_killlists(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for row in rows:
        if row.get("data_status") == "sheet_extracted":
            row["data_status"] = "partial_sheet_extracted"
    return rows


def _missing_killlist_rows(season_id: str) -> list[dict[str, Any]]:
    source = _MISSING_KILLLIST_SOURCES.get(season_id)
    if not source:
        return []
    division = source["division"]
    trainer = _display_name(source.get("trainer"))
    team_name = _null(source.get("team_name"))
    return [
        {
            "season_id": season_id,
            "division": division,
            "stage": _stage_from_division(division),
            "pokemon": None,
            "pokemon_normalized": None,
            "trainer": trainer,
            "trainer_normalized": _canonical_name(trainer),
            "team_name": team_name,
            "appearances": None,
            "kills": None,
            "deaths": None,
            "differential": None,
            "data_status": "not_available",
            "source_urls": source["source_urls"],
        }
    ]


def _dedupe_killlist_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    key_fields = [
        "season_id",
        "division",
        "stage",
        "pokemon_normalized",
        "trainer_normalized",
        "team_name",
        "appearances",
        "kills",
        "deaths",
        "differential",
        "source_urls",
    ]
    seen: set[tuple[Any, ...]] = set()
    unique: list[dict[str, Any]] = []
    for row in rows:
        key = tuple(row.get(field) for field in key_fields)
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _regular_only_killlist_rows(canonical_rows: list[dict[str, Any]], regular_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    canonical_pokemon = {row.get("pokemon_normalized") for row in canonical_rows if row.get("pokemon_normalized")}
    return [row for row in regular_rows if row.get("pokemon_normalized") and row.get("pokemon_normalized") not in canonical_pokemon]


def _standard_killlist(season_id: str, table: dict[str, Any], division: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    source_url = _sheet_source_url(table["entry"])
    for record in table["records"]:
        pokemon = _first(record, ["pokemon", "mon", "poke"])
        kills = _first(record, ["kills", "kill", "kills_gesamt"])
        if not pokemon or kills is None:
            continue
        trainer = _first(record, ["trainer", "coach", "spieler", "player", "youtube", "kanal", "channel"])
        team = _first(record, ["team", "mannschaft"])
        appearances = _killlist_appearances_from_record(record)
        pokemon_name = pokemon_display_name(pokemon)
        trainer_name = _display_name(_person_from_standing(team, trainer, trainer))
        rows.append(
            {
                "season_id": season_id,
                "division": division,
                "stage": _stage_from_division(division),
                "pokemon": _null(pokemon_name),
                "pokemon_normalized": _canonical_name(pokemon_name),
                "trainer": trainer_name,
                "trainer_normalized": _canonical_name(trainer_name),
                "team_name": _null(team),
                "appearances": appearances,
                "kills": _number(kills),
                "deaths": _number(_first(record, ["deaths", "tode", "death", "d"])),
                "differential": _number(_first(record, ["differential", "diff", "+/-", "differenz"])),
                "data_status": "sheet_extracted",
                "source_urls": source_url,
            }
        )
    return rows


def _killlist_appearances_from_record(record: dict[str, str]) -> str | None:
    explicit = _number(
        _first(
            record,
            [
                "appearances",
                "einsatze",
                "einsaetze",
                "einsätze",
                "kampfe",
                "kaempfe",
                "kämpfe",
                "games",
                "matches",
                "uses",
                "usage",
            ],
        )
    )
    if explicit is not None:
        return explicit
    return _numbered_cell_count(record)


def _numbered_cell_count(record: dict[str, str]) -> str | None:
    numbered_values = [value for key, value in record.items() if str(key).isdigit()]
    if not numbered_values:
        return None
    count = sum(1 for value in numbered_values if _null(value) is not None)
    return str(count)


def _filled_cell_count(values: list[str]) -> str | None:
    count = sum(1 for value in values if _null(value) is not None)
    return str(count) if values else None


def _s9_killlist(season_id: str, table: dict[str, Any], division: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    source_url = _sheet_source_url(table["entry"])
    header_index = _find_s9_killlist_header_index(table["rows"])
    if header_index is None:
        return rows
    headers = [_header(cell) for cell in table["rows"][header_index]]
    columns = {header: index for index, header in enumerate(headers) if header}
    pokemon_column = columns.get("pokemon")
    appearances_column = columns.get("appearances")
    kills_column = columns.get("kills")
    team_column = columns.get("team")
    if pokemon_column is None or kills_column is None:
        return rows

    for raw in table["rows"][header_index + 1 :]:
        pokemon = _cell(raw, pokemon_column)
        kills = _cell(raw, kills_column)
        if not _null(pokemon) or _number(kills) is None:
            continue
        team = _team_from_wide_summary_row(raw, team_column)
        if division == "Singles" and _canonical_name(team) == "victory instinct":
            split_rows = _s9_victory_instinct_singles_killlist_rows(
                season_id=season_id,
                division=division,
                source_url=source_url,
                raw=raw,
                headers=headers,
                pokemon=pokemon,
                team=team,
            )
            if split_rows:
                rows.extend(split_rows)
                continue
        trainer = _display_name(_s9_killlist_trainer(division, team))
        pokemon_name = pokemon_display_name(pokemon)
        rows.append(
            {
                "season_id": season_id,
                "division": division,
                "stage": _stage_from_division(division),
                "pokemon": _null(pokemon_name),
                "pokemon_normalized": _canonical_name(pokemon_name),
                "trainer": trainer,
                "trainer_normalized": _canonical_name(trainer),
                "team_name": team,
                "appearances": _number(_cell(raw, appearances_column)),
                "kills": _number(kills),
                "deaths": None,
                "differential": None,
                "data_status": "sheet_extracted",
                "source_urls": source_url,
            }
        )
    return rows


def _s9_victory_instinct_singles_killlist_rows(
    season_id: str,
    division: str,
    source_url: str | None,
    raw: list[str],
    headers: list[str],
    pokemon: str,
    team: str | None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for trainer, start_week, end_week in _S9_VICTORY_INSTINCT_SINGLES_SPLITS:
        kills = _s9_week_kill_total(raw, headers, start_week, end_week)
        if kills is None:
            continue
        appearances = _s9_week_appearance_count(raw, headers, start_week, end_week)
        pokemon_name = pokemon_display_name(pokemon)
        rows.append(
            {
                "season_id": season_id,
                "division": division,
                "stage": _stage_from_division(division),
                "pokemon": _null(pokemon_name),
                "pokemon_normalized": _canonical_name(pokemon_name),
                "trainer": trainer,
                "trainer_normalized": _canonical_name(trainer),
                "team_name": team,
                "appearances": appearances,
                "kills": kills,
                "deaths": None,
                "differential": None,
                "data_status": "sheet_extracted",
                "source_urls": source_url,
            }
        )
    return rows


def _s9_week_kill_total(row: list[str], headers: list[str], start_week: int, end_week: int) -> str | None:
    total = 0.0
    seen = False
    for index, header in enumerate(headers):
        if not header.isdigit():
            continue
        week = int(header)
        if week < start_week or week > end_week:
            continue
        value = _number(_cell(row, index))
        if value is None:
            continue
        total += float(value)
        seen = True
    return _format_number(total) if seen else None


def _s9_week_appearance_count(row: list[str], headers: list[str], start_week: int, end_week: int) -> str | None:
    count = 0
    for index, header in enumerate(headers):
        if not header.isdigit():
            continue
        week = int(header)
        if week < start_week or week > end_week:
            continue
        if _null(_cell(row, index)) is not None:
            count += 1
    return str(count) if count else None


def _s9_killlist_trainer(division: str, team: str | None) -> str | None:
    team_key = _canonical_name(team)
    if not team_key:
        return None
    return _S9_KILLLIST_TRAINERS.get(division, {}).get(team_key)


def _find_s9_killlist_header_index(rows: list[list[str]]) -> int | None:
    for index, row in enumerate(rows):
        headers = {_header(cell) for cell in row}
        if {"rank", "pokemon", "kills", "team"}.issubset(headers):
            return index
    return None


def _team_from_wide_summary_row(row: list[str], team_column: int | None) -> str | None:
    if team_column is None:
        return None
    team = _null(_cell(row, team_column))
    if team:
        return team
    for value in row[team_column + 1 :]:
        clean = _null(value)
        if clean and _number(clean) is None:
            return clean
    return None


def _s10_killlist(season_id: str, table: dict[str, Any], division: str, playoff: bool) -> list[dict[str, Any]]:
    source_url = _sheet_source_url(table["entry"])
    rows: list[dict[str, Any]] = []
    for raw in table["rows"]:
        padded = raw + [""] * 60
        if playoff:
            pokemon, trainer, kills, deaths, team = padded[2], padded[4], padded[23], padded[24], None
            appearances = _filled_cell_count(padded[6:22])
        else:
            pokemon, trainer, kills, deaths, team = padded[3], padded[5], padded[21], None, padded[23]
            appearances = _filled_cell_count(padded[8:21])
        if not _null(pokemon) or not _null(trainer):
            continue
        pokemon_name = pokemon_display_name(pokemon)
        rows.append(
            {
                "season_id": season_id,
                "division": division,
                "stage": _stage_from_division(division),
                "pokemon": _null(pokemon_name),
                "pokemon_normalized": _canonical_name(pokemon_name),
                "trainer": _display_name(trainer),
                "trainer_normalized": _canonical_name(trainer),
                "team_name": _null(team),
                "appearances": appearances,
                "kills": _number(kills),
                "deaths": _number(deaths),
                "differential": _number_difference(kills, deaths),
                "data_status": "sheet_extracted",
                "source_urls": source_url,
            }
        )
    return rows


def _video_matches(season_id: str, videos: list[dict[str, Any]], start_counter: int = 1) -> list[dict[str, Any]]:
    rows = []
    for index, video in enumerate(videos, start=start_counter):
        vid = video.get("videoId")
        rows.append(
            {
                "season_id": season_id,
                "match_id": f"{season_id}_video_{index:04d}",
                "division": None,
                "stage": "video_source",
                "week": None,
                "player_a": None,
                "player_b": None,
                "team_a": None,
                "team_b": None,
                "score_a": None,
                "score_b": None,
                "winner": None,
                "video_id": vid,
                "video_title": video.get("title"),
                "video_url": video_url(vid),
                "data_status": "source_video_only",
                "source_urls": video_url(vid),
            }
        )
    return rows


def _people_from_output(output: NormalizedOutput) -> list[dict[str, Any]]:
    people: dict[str, dict[str, Any]] = {}
    for row in output.teams + output.standings + output.person_stints:
        name = row.get("person_name") or row.get("player_name")
        source = row.get("source_urls")
        _add_person(people, name, source)
    for row in output.matches:
        _add_person(people, row.get("player_a"), row.get("source_urls"))
        _add_person(people, row.get("player_b"), row.get("source_urls"))
        _add_person(people, row.get("winner"), row.get("source_urls"))
    for row in output.champions:
        _add_person(people, row.get("champion_name"), row.get("source_urls"))
    rows = []
    for row in people.values():
        rows.append(
            {
                **row,
                "aliases": ";".join(sorted(row["aliases"])),
                "source_urls": ";".join(row["source_urls"]),
            }
        )
    return sorted(rows, key=lambda row: row["person_name_normalized"] or row["person_name"])


def _add_person(people: dict[str, dict[str, Any]], name: str | None, source_url: str | None) -> None:
    clean = _null(name)
    person_id = _person_id(clean)
    if not clean or not person_id:
        return
    display = _display_name(clean) or clean
    row = people.setdefault(
        person_id,
        {
            "person_id": person_id,
            "person_name": display,
            "person_name_normalized": _canonical_name(clean),
            "aliases": set(),
            "data_status": "sheet_or_video_extracted",
            "source_urls": [],
        },
    )
    row["person_name"] = _PREFERRED_DISPLAY.get(row["person_name_normalized"], row["person_name"])
    row["aliases"].add(clean)
    row["aliases"].add(display)
    for url in (source_url or "").split(";"):
        if url and url not in row["source_urls"]:
            row["source_urls"].append(url)


def _placeholder(season_id: str, table: str) -> dict[str, Any]:
    row = {field: None for field in NORMALIZED_FIELDS[table]}
    row["season_id"] = season_id
    row["data_status"] = "not_available"
    return row


def _alias_review(output: NormalizedOutput) -> list[dict[str, Any]]:
    names: set[str] = set()
    for table in (output.people, output.teams, output.standings, output.person_stints, output.matches, output.champions):
        for row in table:
            for field in ("person_name", "player_name", "player_a", "player_b", "winner", "champion_name", "team_name"):
                if row.get(field):
                    names.add(str(row[field]))

    canonical: dict[str, list[str]] = {}
    for name in names:
        canonical.setdefault(_canonical_name(name) or "", []).append(name)

    review: list[dict[str, Any]] = []
    for normalized, variants in sorted(canonical.items()):
        if normalized and len(set(variants)) > 1:
            unique = sorted(set(variants))
            for idx, name_a in enumerate(unique):
                for name_b in unique[idx + 1 :]:
                    review.append(
                        {
                            "name_a": name_a,
                            "name_b": name_b,
                            "name_a_normalized": normalized,
                            "name_b_normalized": normalized,
                            "similarity_hint": "same_canonical_form",
                            "source": "normalized_csv",
                        }
                    )
    return review


def _season_label(playlist: dict[str, Any]) -> str | None:
    title = playlist.get("title")
    if not title:
        return None
    match = re.search(r"(?:season|staffel|saison|s)\s*([0-9]+)", title, re.IGNORECASE)
    if match:
        return f"Season {match.group(1)}"
    return title


def _season_note(season_id: str) -> str | None:
    notes = {
        "season_001": "Nocturne changed controller from PokemonFakten to FanmadeLetsPlay for the Rueckrunde; the public killlist source only covers rows through Spieltag 7, so Season 1 kill data is marked partial.",
        "season_003": "Two schedule sheets are present; only one final standings sheet is publicly available in the PresentLP source set.",
        "season_006": "Season sheet includes Sun/Moon conferences plus playoff rows; champion is taken from the sourced playoff final.",
        "season_007": "Available sources contain regular-season data but no playoff bracket/final winner.",
        "season_010": "Playoff final is reconstructed from the Ergebnisse and Playoffs Kader sheets; Season 10 killlists use the Playoffs Killliste table as the canonical final killlist.",
    }
    return notes.get(season_id)


def _is_gpl_related(
    playlist: dict[str, Any], videos: list[dict[str, Any]], playlists: list[dict[str, Any]] | None = None
) -> bool:
    haystack = " ".join(
        [
            str(playlist.get("title") or ""),
            str(playlist.get("description") or ""),
            " ".join(str(item.get("title") or "") for item in (playlists or [])),
            " ".join(str(video.get("title") or "") for video in videos[:10]),
        ]
    ).lower()
    return any(token in haystack for token in ["gpl", "german pokemon league", "german pokémon league"])


def _sources_for_season(
    playlist: dict[str, Any], resolved: list[dict[str, Any]], playlists: list[dict[str, Any]] | None = None
) -> list[str]:
    sources = []
    for item in playlists or [playlist]:
        url = playlist_url(item.get("playlistId"))
        if url:
            sources.append(url)
    for entry in resolved:
        if entry.get("url"):
            sources.append(entry["url"])
        if entry.get("resolved_url") and entry["resolved_url"] not in sources:
            sources.append(entry["resolved_url"])
    return list(dict.fromkeys(sources))


def _min_date(videos: list[dict[str, Any]]) -> str | None:
    dates = sorted(video.get("publishedAt") for video in videos if video.get("publishedAt"))
    return dates[0] if dates else None


def _max_date(videos: list[dict[str, Any]]) -> str | None:
    dates = sorted(video.get("publishedAt") for video in videos if video.get("publishedAt"))
    return dates[-1] if dates else None


def _header(value: str) -> str:
    normalized = _fold_text(value.strip().lower())
    normalized = re.sub(r"[^a-z0-9+/#-]+", "_", normalized).strip("_")
    aliases = {
        "platz": "rank",
        "rang": "rank",
        "trainer": "coach",
        "spieler": "player",
        "siege": "wins",
        "s": "wins",
        "niederlagen": "losses",
        "n": "losses",
        "unentschieden": "draws",
        "u": "draws",
        "punkte": "points",
        "pkt": "points",
        "kills_gesamt": "kills",
        "kampfe": "appearances",
        "kaempfe": "appearances",
        "einsatze": "appearances",
        "einsaetze": "appearances",
        "spiele": "appearances",
        "games": "appearances",
        "matches": "appearances",
        "uses": "appearances",
        "usage": "appearances",
        "differenz": "differential",
        "sieger": "winner",
        "meister": "champion",
        "pokemon": "pokemon",
        "pokémon": "pokemon",
    }
    return aliases.get(normalized, normalized)


def _first(record: dict[str, str], names: list[str]) -> str | None:
    for name in names:
        value = record.get(_header(name))
        if value and value.strip():
            return value.strip()
    return None


def _number(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    match = re.search(r"-?[0-9]+(?:[.,][0-9]+)?", stripped)
    if not match:
        return None
    return match.group(0).replace(",", ".")


def _null(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped or stripped.lower() in {"n/a", "na", "-", "?", "unknown", "unbekannt", "#n/a", "#value!", "#ref!"}:
        return None
    return stripped


def _canonical_name(value: str | None) -> str | None:
    cleaned = _null(value)
    if cleaned is None:
        return None
    cleaned = re.sub(r"\[[^\]]+]", "", cleaned)
    cleaned = _fold_text(cleaned.lower())
    cleaned = re.sub(r"[^a-z0-9]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return _ALIAS_CANONICAL.get(cleaned, cleaned)


def _display_name(value: str | None) -> str | None:
    clean = _clean_person_label(value)
    if clean is None:
        return None
    canonical = _canonical_name(clean)
    return _PREFERRED_DISPLAY.get(canonical or "", clean)


def _clean_person_label(value: str | None) -> str | None:
    clean = _null(value)
    if clean is None:
        return None
    clean = re.sub(r"\s*\[[^\]]+]", "", clean).strip()
    clean = re.sub(r"\s*;\s*(?:sieg|draw)\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s*[;,]?\s*sieg\s+nach\s+dc\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s*[;,]?\s*nach\s+dc\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+durch\s+dc\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+nach\s+brechen\s+der\s+(?:item|sleep)\s+clause\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+nach\s+aufgeben\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+(?:sieg|draw)\s+nach\s+time\s*out\b.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+\S+\s+sieg\s*\(.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+sieg\s*\(.*$", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\s+\S+\s+sieg\s*$", "", clean, flags=re.IGNORECASE)
    return _null(clean)


def _fold_text(value: str) -> str:
    value = value.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    value = value.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue").replace("é", "e")
    value = value.replace("Ã¤", "ae").replace("Ã¶", "oe").replace("Ã¼", "ue").replace("ÃŸ", "ss")
    value = value.replace("Ã„", "Ae").replace("Ã–", "Oe").replace("Ãœ", "Ue").replace("Ã©", "e")
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(character for character in normalized if not unicodedata.combining(character))


def _person_id(value: str | None) -> str | None:
    canonical = _canonical_name(value)
    if not canonical:
        return None
    return f"person_{canonical.replace(' ', '_')}"


def _team_id(season_id: str, team_name: str | None, person_name: str | None = None) -> str | None:
    canonical = _canonical_name(team_name) or _canonical_name(person_name)
    if not canonical:
        return None
    return f"{season_id}_{canonical.replace(' ', '_')}"


def _person_from_standing(team: str | None, channel_url: str | None, explicit: str | None) -> str | None:
    if explicit and not _looks_like_url(explicit):
        return _null(explicit)
    from_url = _person_from_url(channel_url or explicit)
    if from_url:
        return from_url
    return _null(explicit) or _null(team)


def _person_from_url(value: str | None) -> str | None:
    if not value or "youtube" not in value.lower():
        return None
    parsed = urlparse(value.strip())
    parts = [unquote(part) for part in parsed.path.split("/") if part]
    if not parts:
        return None
    if parts[0].startswith("@"):
        return parts[0][1:]
    if parts[0] in {"user", "c"} and len(parts) > 1:
        return parts[1]
    if parts[0] == "channel":
        return None
    return parts[-1].lstrip("@")


def _looks_like_url(value: str | None) -> bool:
    return bool(value and re.match(r"https?://", value.strip(), flags=re.IGNORECASE))


def _looks_like_week(value: str | None) -> bool:
    if not value:
        return False
    folded = _fold_text(value.lower())
    return "spieltag" in folded or "playoffs" in folded or "vorrunde" in folded or "viertelfinale" in folded or "halbfinale" in folded or "finale" in folded


def _week_number(value: str | None) -> int | None:
    match = re.search(r"(\d+)\.\s*spieltag", _fold_text(str(value or "").lower()))
    return int(match.group(1)) if match else None


def _stage_from_week(week: str | None) -> str | None:
    folded = _fold_text(str(week or "").lower())
    if "playoff" in folded or "finale" in folded or "viertelfinale" in folded or "halbfinale" in folded:
        return "playoffs"
    if "spieltag" in folded:
        return "regular_season"
    return None


def _stage_from_division(division: str | None) -> str | None:
    return "playoffs" if division and "playoff" in division.lower() else "regular_season"


def _has_standings_header(rows: list[list[str]]) -> bool:
    return _find_standings_header_index(rows) is not None


def _find_standings_header_index(rows: list[list[str]]) -> int | None:
    for index, row in enumerate(rows[:25]):
        headers = {_header(cell) for cell in row}
        if "rank" in headers and "points" in headers and ("kills" in headers or "differential" in headers):
            return index
    return None


def _has_killlist_header(rows: list[list[str]]) -> bool:
    for row in rows[:20]:
        headers = {_header(cell) for cell in row}
        if "pokemon" in headers and "kills" in headers and "points" not in headers:
            return True
    return False


def _has_participant_pair_list(rows: list[list[str]]) -> bool:
    if not rows:
        return False
    first = " ".join(rows[0]).lower()
    return "liga 1" in first and "liga 2" in first


def _tables_by_title(tables: list[dict[str, Any]], title: str) -> list[dict[str, Any]]:
    return [table for table in tables if _title_matches(table["entry"].get("title"), title)]


def _tables_by_sheet_id(tables: list[dict[str, Any]], sheet_id: str, title: str | None = None) -> list[dict[str, Any]]:
    selected = [table for table in tables if table["entry"].get("sheet_id") == sheet_id]
    if title is None:
        return selected
    return [table for table in selected if _title_matches(table["entry"].get("title"), title)]


def _title_matches(actual: str | None, wanted: str) -> bool:
    actual_key = _title_key(actual)
    wanted_key = _title_key(wanted)
    if not actual_key or not wanted_key:
        return False
    return actual_key == wanted_key or actual_key.endswith("_" + wanted_key)


def _title_key(value: str | None) -> str:
    folded = _fold_text(str(value or "").lower())
    return re.sub(r"[^a-z0-9]+", "_", folded).strip("_")


def _tables_with_schedule_scores(tables: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        table
        for table in tables
        if not _has_standings_header(table["rows"])
        and not _has_killlist_header(table["rows"])
        and any(_parse_scored_match_cell(cell) for row in table["rows"] for cell in row)
    ]


def _sheet_source_url(entry: dict[str, Any]) -> str | None:
    sheet_id = entry.get("sheet_id")
    gid = entry.get("gid")
    if sheet_id and gid is not None:
        return f"https://docs.google.com/spreadsheets/d/{sheet_id}/edit#gid={gid}"
    return entry.get("source_url")


def _source_urls_for_titles(tables: list[dict[str, Any]], titles: list[str]) -> str | None:
    urls = [
        _sheet_source_url(table["entry"])
        for table in tables
        if any(_title_matches(table["entry"].get("title"), title) for title in titles)
    ]
    return ";".join(url for url in urls if url) or None


def _join_source_urls(*values: str | None) -> str | None:
    urls: list[str] = []
    for value in values:
        for url in str(value or "").split(";"):
            if url and url not in urls:
                urls.append(url)
    return ";".join(urls) or None


def _cell(row: list[str], index: int | None) -> str:
    if index is None or index < 0 or index >= len(row):
        return ""
    return row[index].strip()


def _first_index(values: list[str], *needles: str) -> int:
    for needle in needles:
        if needle in values:
            return values.index(needle)
    return -1


def _nearest_nonempty(row: list[str], start: int, step: int) -> str | None:
    index = start
    limit = 8
    while 0 <= index < len(row) and limit > 0:
        value = _null(row[index])
        if value and not _parse_score(value) and value != ":":
            return value
        index += step
        limit -= 1
    return None


def _nearest_week(week_by_column: dict[int, str], column: int) -> str | None:
    if not week_by_column:
        return None
    left = [item for item in week_by_column.items() if item[0] <= column]
    if left:
        return max(left, key=lambda item: item[0])[1]
    return min(week_by_column.items(), key=lambda item: abs(item[0] - column))[1]


def _is_noise_name(value: str | None) -> bool:
    folded = _fold_text(str(value or "").lower())
    return folded in {"link", "sicht von", "kampf", "vgc", "einzelkampf"} or folded.endswith("uhr")


def _dedupe(rows: list[dict[str, Any]], keys: list[str]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    unique = []
    for row in rows:
        marker = tuple(row.get(key) for key in keys)
        if marker in seen:
            continue
        seen.add(marker)
        unique.append(row)
    return unique


def _dedupe_matches(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    unique = []
    for row in rows:
        marker = (
            row.get("season_id"),
            row.get("division"),
            row.get("week"),
            _canonical_name(row.get("player_a")),
            _canonical_name(row.get("player_b")),
            row.get("score_a"),
            row.get("score_b"),
        )
        if marker in seen:
            continue
        seen.add(marker)
        row["match_id"] = f"{row.get('season_id')}_schedule_{len(unique) + 1:04d}"
        unique.append(row)
    return unique


def _first_ranked(standings: list[dict[str, Any]], division: str | None = None) -> dict[str, Any] | None:
    candidates = [row for row in standings if row.get("rank") == "1" and (division is None or row.get("division") == division)]
    return candidates[0] if candidates else None
