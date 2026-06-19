from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any

import requests

from .normalize import _canonical_name as _canonical_person_name
from .normalize import _display_name as _display_person_name
from .pokemon_names import name_key
from .storage import ensure_dir

SHOWDOWN_FORMATS_DATA_URL = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts"
SHOWDOWN_FORMATS_DATA_URLS = {
    "gen6": "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen6/formats-data.ts",
    "gen7": "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen7/formats-data.ts",
    "gen8": "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen8/formats-data.ts",
    "gen9": SHOWDOWN_FORMATS_DATA_URL,
}
SHOWDOWN_FORMATS_GENERATIONS = ("gen6", "gen7", "gen8", "gen9")
OLD_PROJECT_KILL_SHEET_ID = "1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA"
OLD_PROJECT_EWIGE_TABELLE_GID = "352888197"
OLD_PROJECT_EWIGE_TABELLE_URL = (
    f"https://docs.google.com/spreadsheets/d/{OLD_PROJECT_KILL_SHEET_ID}/edit#gid={OLD_PROJECT_EWIGE_TABELLE_GID}"
)
OLD_PROJECT_TEAM_NOTE_RE = re.compile(r"^\s*(?P<person>.+?)\s+S(?P<season>[1-5])\b", flags=re.IGNORECASE)

POKEMON_DRAFT_OVERVIEW_FIELDS = [
    "rank",
    "species_id",
    "pokemon",
    "pokemon_normalized",
    "english",
    "asset_id",
    "tier",
    "tier_rank",
    "gen6_tier",
    "gen6_tier_rank",
    "gen7_tier",
    "gen7_tier_rank",
    "gen8_tier",
    "gen8_tier_rank",
    "gen9_tier",
    "gen9_tier_rank",
    "draft_count",
    "season_count",
    "season_list",
    "title_count",
    "title_seasons",
    "trainer_count",
    "team_count",
    "picked_status",
    "source_urls",
]

POKEMON_DRAFT_INSTANCE_FIELDS = [
    "season_id",
    "division",
    "roster_phase",
    "pokemon",
    "pokemon_normalized",
    "asset_id",
    "person_name",
    "person_name_normalized",
    "team_name",
    "team_name_normalized",
    "data_status",
    "source_urls",
]

TIER_ORDER = {
    "AG": 1,
    "Uber": 2,
    "OU": 3,
    "UUBL": 4,
    "UU": 5,
    "RUBL": 6,
    "RU": 7,
    "NUBL": 8,
    "NU": 9,
    "PUBL": 10,
    "PU": 11,
    "ZUBL": 12,
    "ZU": 13,
    "NFE": 14,
    "LC": 15,
    "Unreleased": 16,
    "Illegal": 17,
}


def build_and_write_pokemon_draft_overview(data_dir: Path, refresh: bool = False) -> list[dict[str, Any]]:
    generation_formats = _read_or_fetch_generation_formats_data(data_dir, refresh)
    formats_text = generation_formats["gen9"]
    translations = _read_csv(data_dir / "normalized" / "pokemon_name_translations.csv")
    killlists = _read_csv(data_dir / "normalized" / "pokemon_killlists.csv")
    team_usage = [
        *_read_csv(data_dir / "manual" / "team_pokemon_usage.csv"),
        *_read_csv(data_dir / "normalized" / "team_rosters.csv"),
        *_old_project_team_note_usage_rows(data_dir),
    ]
    rows = build_pokemon_draft_overview(
        translations,
        killlists,
        team_usage,
        formats_text,
        _read_csv(data_dir / "normalized" / "champions.csv"),
        generation_formats_data=generation_formats,
    )
    out_path = data_dir / "normalized" / "pokemon_draft_overview.csv"
    ensure_dir(out_path.parent)
    _write_csv(out_path, POKEMON_DRAFT_OVERVIEW_FIELDS, rows)

    instance_rows = build_pokemon_draft_instances(translations, killlists, team_usage)
    _write_csv(data_dir / "normalized" / "pokemon_draft_instances.csv", POKEMON_DRAFT_INSTANCE_FIELDS, instance_rows)
    return rows


def build_pokemon_draft_overview(
    translations: list[dict[str, str]],
    killlists: list[dict[str, str]],
    team_usage: list[dict[str, str]],
    formats_data: str,
    champions: list[dict[str, str]] | None = None,
    *,
    generation_formats_data: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    tier_lookup = parse_showdown_tiers(formats_data)
    generation_tier_lookup = parse_generation_showdown_tiers(generation_formats_data or {"gen9": formats_data})
    forms = _translation_forms(translations)
    aliases = _translation_aliases(translations)
    overview_killlists = _primary_competition_rows(killlists)
    overview_team_usage = _primary_competition_rows(team_usage)
    draft_map = _draft_instances(overview_killlists, overview_team_usage, aliases)
    title_draft_map = _draft_instances(overview_killlists, overview_team_usage, aliases, distinct_by_phase=True)
    title_seasons_by_asset = _title_seasons_by_asset(title_draft_map, champions or [])

    rows: list[dict[str, Any]] = []
    for asset, form in forms.items():
        drafts = draft_map.get(asset, [])
        tier_info = tier_lookup.get(asset, {})
        if not drafts and not _is_gen9_natdex_candidate(tier_info):
            continue
        seasons = sorted({draft["season_id"] for draft in drafts if draft.get("season_id")}, key=_season_sort)
        title_seasons = title_seasons_by_asset.get(asset, [])
        trainers = {draft["trainer"] for draft in drafts if draft.get("trainer")}
        teams = {draft["team"] for draft in drafts if draft.get("team")}
        sources = _join_sources(form.get("source_url"), *(draft.get("source_urls") for draft in drafts))
        tier = tier_info.get("tier", "")
        generation_tiers = _generation_tier_fields(asset, generation_tier_lookup)
        rows.append(
            {
                "species_id": form.get("species_id", ""),
                "pokemon": form.get("german", ""),
                "pokemon_normalized": name_key(form.get("german", "")),
                "english": form.get("english", ""),
                "asset_id": asset,
                "tier": tier,
                "tier_rank": TIER_ORDER.get(tier, 99),
                **generation_tiers,
                "draft_count": len(drafts),
                "season_count": len(seasons),
                "season_list": _format_season_list(seasons),
                "title_count": len(title_seasons),
                "title_seasons": _format_season_list(title_seasons),
                "trainer_count": len(trainers),
                "team_count": len(teams),
                "picked_status": "picked" if drafts else "never_picked",
                "source_urls": sources,
            }
        )

    rows.sort(key=lambda row: (-int(row["draft_count"]), int(row["tier_rank"]), row["pokemon"]))
    for index, row in enumerate(rows, start=1):
        row["rank"] = index
        numeric_fields = (
            "tier_rank",
            "gen6_tier_rank",
            "gen7_tier_rank",
            "gen8_tier_rank",
            "gen9_tier_rank",
            "draft_count",
            "season_count",
            "title_count",
            "trainer_count",
            "team_count",
        )
        for field in numeric_fields:
            row[field] = str(row[field])
    return rows


def build_pokemon_draft_instances(
    translations: list[dict[str, str]],
    killlists: list[dict[str, str]],
    team_usage: list[dict[str, str]],
) -> list[dict[str, Any]]:
    forms = _translation_forms(translations)
    aliases = _translation_aliases(translations)
    draft_map = _draft_instances(killlists, team_usage, aliases, distinct_by_phase=True)
    rows: list[dict[str, Any]] = []
    for asset, drafts in draft_map.items():
        form = forms.get(asset, {})
        pokemon = form.get("german") or drafts[0].get("pokemon") or asset
        for draft in drafts:
            rows.append(
                {
                    "season_id": draft.get("season_id", ""),
                    "division": draft.get("division", ""),
                    "roster_phase": draft.get("roster_phase", ""),
                    "pokemon": pokemon,
                    "pokemon_normalized": name_key(pokemon),
                    "asset_id": asset,
                    "person_name": draft.get("trainer", ""),
                    "person_name_normalized": draft.get("trainer_key", ""),
                    "team_name": draft.get("team", ""),
                    "team_name_normalized": name_key(draft.get("team", "")),
                    "data_status": draft.get("data_status", ""),
                    "source_urls": draft.get("source_urls", ""),
                }
            )
    return sorted(
        rows,
        key=lambda row: (
            _season_sort(str(row.get("season_id", ""))),
            str(row.get("person_name", "")),
            str(row.get("team_name", "")),
            str(row.get("pokemon", "")),
        ),
    )


def _primary_competition_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    return [row for row in rows if row.get("division") != "Liga 2"]


def parse_showdown_tiers(formats_data: str) -> dict[str, dict[str, str]]:
    tiers: dict[str, dict[str, str]] = {}
    for match in re.finditer(r"(?m)^\s*([a-z0-9]+):\s*\{(.*?)^\s*\},", formats_data, flags=re.DOTALL):
        asset = match.group(1)
        block = match.group(2)
        tier_match = re.search(r'tier:\s*"([^"]+)"', block)
        natdex_tier_match = re.search(r'natDexTier:\s*"([^"]+)"', block)
        if tier_match or natdex_tier_match:
            standard_tier = tier_match.group(1) if tier_match else ""
            natdex_tier = natdex_tier_match.group(1) if natdex_tier_match else ""
            tiers[asset] = {
                "tier": natdex_tier or standard_tier,
                "standard_tier": standard_tier,
                "natdex_tier": natdex_tier,
            }
    return tiers


def parse_generation_showdown_tiers(formats_by_generation: dict[str, str]) -> dict[str, dict[str, dict[str, str]]]:
    return {
        generation: parse_showdown_tiers(formats_data)
        for generation, formats_data in formats_by_generation.items()
        if generation in SHOWDOWN_FORMATS_GENERATIONS
    }


def _generation_tier_fields(
    asset: str,
    generation_tier_lookup: dict[str, dict[str, dict[str, str]]],
) -> dict[str, str | int]:
    fields: dict[str, str | int] = {}
    for generation in SHOWDOWN_FORMATS_GENERATIONS:
        tier_info = generation_tier_lookup.get(generation, {}).get(asset, {})
        tier = tier_info.get("standard_tier") or ""
        fields[f"{generation}_tier"] = tier
        fields[f"{generation}_tier_rank"] = TIER_ORDER.get(tier, 99) if tier else ""
    return fields


def _is_gen9_natdex_candidate(tier_info: dict[str, str]) -> bool:
    return bool(tier_info.get("natdex_tier"))


def _translation_forms(translations: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    forms: dict[str, dict[str, str]] = {}
    for row in translations:
        asset = row.get("asset_id", "").strip()
        if not asset:
            continue
        current = forms.get(asset)
        candidate = {
            "species_id": row.get("species_id", "").strip(),
            "german": row.get("german", "").strip(),
            "english": row.get("english", "").strip(),
            "asset_id": asset,
            "source_url": row.get("source_url", "").strip(),
        }
        if current is None or _display_score(candidate["german"]) > _display_score(current["german"]):
            forms[asset] = candidate
    return forms


def _translation_aliases(translations: list[dict[str, str]]) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for row in translations:
        asset = row.get("asset_id", "").strip()
        if not asset:
            continue
        for value in (row.get("german"), row.get("english"), asset):
            key = name_key(str(value or ""))
            if key:
                aliases[key] = asset
    return aliases


def _draft_instances(
    killlists: list[dict[str, str]],
    team_usage: list[dict[str, str]],
    aliases: dict[str, str],
    *,
    distinct_by_phase: bool = False,
) -> dict[str, list[dict[str, str]]]:
    drafts: dict[str, list[dict[str, str]]] = {}

    def add(
        row: dict[str, str],
        *,
        trainer_field: str,
        trainer_normalized_field: str,
        team_field: str,
        source_kind: str,
    ) -> None:
        if row.get("data_status") == "not_available":
            return
        asset = _asset_for_row(row, aliases)
        if not asset:
            return
        trainer = row.get(trainer_field) or row.get(trainer_normalized_field) or ""
        trainer_key = _person_key(row.get(trainer_normalized_field) or row.get(trainer_field))
        team = row.get(team_field) or ""
        if not trainer and not team:
            return
        candidate = {
            "season_id": row.get("season_id", ""),
            "division": row.get("division", ""),
            "roster_phase": row.get("roster_phase", ""),
            "pokemon": row.get("pokemon") or row.get("pokemon_normalized") or "",
            "trainer": trainer,
            "trainer_key": trainer_key,
            "team": team,
            "source_kind": source_kind,
            "data_status": row.get("data_status", ""),
            "source_urls": row.get("source_urls", ""),
        }
        bucket = drafts.setdefault(asset, [])
        for existing in bucket:
            if _same_draft_pick(existing, candidate, distinct_by_phase=distinct_by_phase):
                _merge_draft_pick(existing, candidate)
                return
        bucket.append(candidate)

    for row in killlists:
        add(row, trainer_field="trainer", trainer_normalized_field="trainer_normalized", team_field="team_name", source_kind="killlist")
    for row in team_usage:
        add(
            row,
            trainer_field="person_name",
            trainer_normalized_field="person_name_normalized",
            team_field="team_name",
            source_kind="team_usage",
        )
    return drafts


def _same_draft_pick(existing: dict[str, str], candidate: dict[str, str], *, distinct_by_phase: bool) -> bool:
    if existing.get("season_id") != candidate.get("season_id"):
        return False
    existing_trainer = existing.get("trainer_key", "")
    candidate_trainer = candidate.get("trainer_key", "")
    existing_team = name_key(existing.get("team", ""))
    candidate_team = name_key(candidate.get("team", ""))
    same_owner = bool(existing_trainer and candidate_trainer and existing_trainer == candidate_trainer)
    same_owner = same_owner or bool(existing_team and candidate_team and existing_team == candidate_team)
    if not same_owner:
        return False
    if distinct_by_phase and _known_values_conflict(existing.get("division", ""), candidate.get("division", "")):
        return False
    if _known_values_conflict(existing_team, candidate_team):
        return False
    if distinct_by_phase and _known_values_conflict(existing.get("roster_phase", ""), candidate.get("roster_phase", "")):
        return False
    return True


def _known_values_conflict(left: str | None, right: str | None) -> bool:
    left_key = name_key(left or "")
    right_key = name_key(right or "")
    return bool(left_key and right_key and left_key != right_key)


def _merge_draft_pick(existing: dict[str, str], candidate: dict[str, str]) -> None:
    for field in ("division", "roster_phase", "pokemon", "trainer", "trainer_key", "team", "data_status"):
        if not existing.get(field) and candidate.get(field):
            existing[field] = candidate[field]
    existing["source_urls"] = _join_sources(existing.get("source_urls"), candidate.get("source_urls"))
    existing["source_kind"] = _merge_source_kind(existing.get("source_kind", ""), candidate.get("source_kind", ""))


def _merge_source_kind(left: str, right: str) -> str:
    if not left:
        return right
    if not right or left == right:
        return left
    return f"{left}+{right}"


def _title_seasons_by_asset(
    draft_map: dict[str, list[dict[str, str]]],
    champions: list[dict[str, str]],
) -> dict[str, list[str]]:
    champion_team_keys: set[tuple[str, str]] = set()
    champion_person_keys_with_team: set[tuple[str, str]] = set()
    playoff_champion_team_keys: set[tuple[str, str]] = set()
    playoff_champion_person_keys_with_team: set[tuple[str, str]] = set()
    for row in champions:
        if row.get("data_status") == "not_available":
            continue
        season_id = row.get("season_id", "")
        team_key = name_key(row.get("champion_team", ""))
        is_playoff_champion = _is_playoff_champion(row)
        if season_id and team_key:
            champion_team_keys.add((season_id, team_key))
            if is_playoff_champion:
                playoff_champion_team_keys.add((season_id, team_key))
            person_key = _person_key(row.get("champion_person_id") or row.get("champion_name"))
            if person_key:
                champion_person_keys_with_team.add((season_id, person_key))
                if is_playoff_champion:
                    playoff_champion_person_keys_with_team.add((season_id, person_key))

    playoff_roster_team_keys, playoff_roster_person_keys = _playoff_roster_keys(draft_map)

    title_seasons: dict[str, set[str]] = {}
    for asset, drafts in draft_map.items():
        for draft in drafts:
            season_id = draft.get("season_id", "")
            team_key = name_key(draft.get("team", ""))
            trainer_key = draft.get("trainer_key") or _person_key(draft.get("trainer"))
            team_matches = (season_id, team_key) in champion_team_keys
            person_matches_missing_team = not team_key and (season_id, trainer_key) in champion_person_keys_with_team
            playoff_team_match = (season_id, team_key) in playoff_champion_team_keys
            playoff_person_match = not team_key and (season_id, trainer_key) in playoff_champion_person_keys_with_team
            if playoff_team_match or playoff_person_match:
                has_playoff_roster = (season_id, team_key) in playoff_roster_team_keys or (
                    season_id,
                    trainer_key,
                ) in playoff_roster_person_keys
                if has_playoff_roster:
                    if draft.get("source_kind") != "team_usage" or not _is_playoff_draft(draft):
                        continue
                elif not _is_playoff_draft(draft):
                    continue
            if team_matches or person_matches_missing_team:
                title_seasons.setdefault(asset, set()).add(season_id)

    return {asset: sorted(seasons, key=_season_sort) for asset, seasons in title_seasons.items()}


def _playoff_roster_keys(draft_map: dict[str, list[dict[str, str]]]) -> tuple[set[tuple[str, str]], set[tuple[str, str]]]:
    team_keys: set[tuple[str, str]] = set()
    person_keys: set[tuple[str, str]] = set()
    for drafts in draft_map.values():
        for draft in drafts:
            if draft.get("source_kind") != "team_usage" or not _is_playoff_draft(draft):
                continue
            season_id = draft.get("season_id", "")
            team_key = name_key(draft.get("team", ""))
            trainer_key = draft.get("trainer_key") or _person_key(draft.get("trainer"))
            if season_id and team_key:
                team_keys.add((season_id, team_key))
            if season_id and trainer_key:
                person_keys.add((season_id, trainer_key))
    return team_keys, person_keys


def _is_playoff_champion(row: dict[str, str]) -> bool:
    text = " ".join(str(row.get(field) or "") for field in ("evidence_type", "notes")).lower()
    return "playoff" in text or "final_kader" in text or "final kader" in text


def _is_playoff_draft(row: dict[str, str]) -> bool:
    return name_key(row.get("division")) == "playoffs" or name_key(row.get("roster_phase")) == "playoffs"


def _old_project_team_note_usage_rows(data_dir: Path) -> list[dict[str, str]]:
    teams = _read_csv(data_dir / "normalized" / "teams.csv")
    teams_by_person = _teams_by_season_and_person(teams)
    rows: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()

    for path in _old_project_ewige_tabelle_paths(data_dir):
        for record in _read_csv(path):
            pokemon = (record.get("Pokemon") or record.get("pokemon") or "").strip()
            if not pokemon:
                continue
            for column, value in record.items():
                if not str(column or "").lower().startswith("team note"):
                    continue
                match = OLD_PROJECT_TEAM_NOTE_RE.match(str(value or "").strip())
                if not match:
                    continue

                season_id = f"season_{int(match.group('season')):03d}"
                person_raw = match.group("person").strip()
                person_key = _old_project_person_key(person_raw)
                identity = (season_id, name_key(pokemon), person_key)
                if identity in seen:
                    continue
                seen.add(identity)

                team = _select_team_for_person(teams_by_person, season_id, person_raw)
                person_display = team.get("person_name") or _display_person_name(person_raw) or person_raw
                person_normalized = team.get("person_name_normalized") or _canonical_person_name(person_raw) or name_key(person_display)
                rows.append(
                    {
                        "season_id": season_id,
                        "division": team.get("division", ""),
                        "team_name": team.get("team_name", ""),
                        "team_name_normalized": team.get("team_name_normalized", ""),
                        "person_name": person_display,
                        "person_name_normalized": person_normalized,
                        "pokemon": pokemon,
                        "pokemon_normalized": name_key(pokemon),
                        "data_status": "old_project_team_note",
                        "source_files": str(path),
                        "source_urls": _join_sources(OLD_PROJECT_EWIGE_TABELLE_URL, team.get("source_urls")),
                        "notes": "Pick-Zuordnung aus Team-Note-Zelle der alten Ewigen GPL-Tabelle; keine Kill-Aussage.",
                    }
                )

    return rows


def _old_project_ewige_tabelle_paths(data_dir: Path) -> list[Path]:
    raw_dir = data_dir / "raw"
    return sorted(raw_dir.glob(f"season_*/sheets/*ewige_tabelle_gpl_{OLD_PROJECT_EWIGE_TABELLE_GID}.csv"))


def _teams_by_season_and_person(teams: list[dict[str, str]]) -> dict[tuple[str, str], list[dict[str, str]]]:
    index: dict[tuple[str, str], list[dict[str, str]]] = {}
    for row in teams:
        season_id = row.get("season_id", "")
        if not season_id:
            continue
        for key in _old_project_person_keys(row.get("person_name"), row.get("person_name_normalized"), row.get("person_id")):
            bucket = index.setdefault((season_id, key), [])
            if row not in bucket:
                bucket.append(row)
    return index


def _select_team_for_person(
    teams_by_person: dict[tuple[str, str], list[dict[str, str]]],
    season_id: str,
    person_name: str,
) -> dict[str, str]:
    matches: list[dict[str, str]] = []
    for key in _old_project_person_keys(person_name):
        for row in teams_by_person.get((season_id, key), []):
            if row not in matches:
                matches.append(row)
    if not matches:
        return {}
    return sorted(matches, key=_team_preference_key)[0]


def _team_preference_key(row: dict[str, str]) -> tuple[int, str]:
    division = name_key(row.get("division", ""))
    priority = {
        "regular season": 0,
        "hauptliga": 0,
        "liga 1": 1,
        "singles": 1,
        "moon conference": 2,
        "sun conference": 2,
        "liga 2": 9,
    }
    return (priority.get(division, 5), row.get("team_name", ""))


def _old_project_person_keys(*values: str | None) -> set[str]:
    keys: set[str] = set()
    for value in values:
        key = _old_project_person_key(value)
        if key:
            keys.add(key)
    return keys


def _old_project_person_key(value: str | None) -> str:
    text = str(value or "").strip()
    if text.startswith("person_"):
        text = text[len("person_") :].replace("_", " ")
    canonical = _canonical_person_name(text) or text
    return name_key(canonical)


def _person_key(value: str | None) -> str:
    text = str(value or "").strip()
    if text.startswith("person_"):
        text = text[len("person_") :]
    canonical = _canonical_person_name(text) or text
    return name_key(canonical)


def _asset_for_row(row: dict[str, str], aliases: dict[str, str]) -> str:
    for value in (row.get("pokemon_normalized"), row.get("pokemon")):
        key = name_key(str(value or ""))
        if key in aliases:
            return aliases[key]
    return ""


def _display_score(value: str) -> tuple[int, int]:
    text = value or ""
    form_penalty = 0 if not re.search(r"form|forme", text, flags=re.IGNORECASE) else -1
    alias_bonus = 1 if "-" in text or "Mega" in text or "Giga" in text else 0
    return (form_penalty + alias_bonus, -len(text))


def _read_or_fetch_formats_data(data_dir: Path, refresh: bool) -> str:
    return _read_or_fetch_formats_data_url(data_dir, "gen9", SHOWDOWN_FORMATS_DATA_URL, refresh)


def _read_or_fetch_generation_formats_data(data_dir: Path, refresh: bool) -> dict[str, str]:
    return {
        generation: _read_or_fetch_formats_data_url(data_dir, generation, url, refresh)
        for generation, url in SHOWDOWN_FORMATS_DATA_URLS.items()
    }


def _read_or_fetch_formats_data_url(data_dir: Path, generation: str, url: str, refresh: bool) -> str:
    filename = "formats-data.ts" if generation == "gen9" else f"{generation}-formats-data.ts"
    cache_path = data_dir / "raw" / "pokemon_showdown" / filename
    if cache_path.exists() and not refresh:
        return cache_path.read_text(encoding="utf-8")
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    ensure_dir(cache_path.parent)
    cache_path.write_text(response.text, encoding="utf-8")
    return response.text


def _season_sort(value: str) -> tuple[int, str]:
    match = re.search(r"season_0*(\d+)", value or "")
    return (int(match.group(1)) if match else 999, value or "")


def _format_season_list(season_ids: list[str]) -> str:
    labels = []
    for season_id in season_ids:
        match = re.search(r"season_0*(\d+)", season_id)
        labels.append(f"S{int(match.group(1))}" if match else season_id)
    return ", ".join(labels)


def _join_sources(*values: str | None) -> str:
    seen: list[str] = []
    for value in values:
        for item in str(value or "").split(";"):
            clean = item.strip()
            if clean and clean not in seen:
                seen.append(clean)
    return ";".join(seen)


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
