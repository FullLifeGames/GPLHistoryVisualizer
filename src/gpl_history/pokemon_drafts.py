from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Any

import requests

from .pokemon_names import name_key
from .storage import ensure_dir

SHOWDOWN_FORMATS_DATA_URL = "https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/formats-data.ts"

POKEMON_DRAFT_OVERVIEW_FIELDS = [
    "rank",
    "species_id",
    "pokemon",
    "pokemon_normalized",
    "english",
    "asset_id",
    "tier",
    "tier_rank",
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
    formats_text = _read_or_fetch_formats_data(data_dir, refresh)
    team_usage = [
        *_read_csv(data_dir / "manual" / "team_pokemon_usage.csv"),
        *_read_csv(data_dir / "normalized" / "team_rosters.csv"),
    ]
    rows = build_pokemon_draft_overview(
        _read_csv(data_dir / "normalized" / "pokemon_name_translations.csv"),
        _read_csv(data_dir / "normalized" / "pokemon_killlists.csv"),
        team_usage,
        formats_text,
        _read_csv(data_dir / "normalized" / "champions.csv"),
    )
    out_path = data_dir / "normalized" / "pokemon_draft_overview.csv"
    ensure_dir(out_path.parent)
    _write_csv(out_path, POKEMON_DRAFT_OVERVIEW_FIELDS, rows)
    return rows


def build_pokemon_draft_overview(
    translations: list[dict[str, str]],
    killlists: list[dict[str, str]],
    team_usage: list[dict[str, str]],
    formats_data: str,
    champions: list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    tier_lookup = parse_showdown_tiers(formats_data)
    forms = _translation_forms(translations)
    aliases = _translation_aliases(translations)
    draft_map = _draft_instances(killlists, team_usage, aliases)
    title_seasons_by_asset = _title_seasons_by_asset(draft_map, champions or [])

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
        rows.append(
            {
                "species_id": form.get("species_id", ""),
                "pokemon": form.get("german", ""),
                "pokemon_normalized": name_key(form.get("german", "")),
                "english": form.get("english", ""),
                "asset_id": asset,
                "tier": tier,
                "tier_rank": TIER_ORDER.get(tier, 99),
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
        for field in ("tier_rank", "draft_count", "season_count", "title_count", "trainer_count", "team_count"):
            row[field] = str(row[field])
    return rows


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
) -> dict[str, list[dict[str, str]]]:
    seen: set[tuple[str, str, str, str]] = set()
    drafts: dict[str, list[dict[str, str]]] = {}

    def add(row: dict[str, str], *, trainer_field: str, trainer_normalized_field: str, team_field: str) -> None:
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
        season_id = row.get("season_id", "")
        identity = (asset, season_id, trainer_key, name_key(team))
        if identity in seen:
            return
        seen.add(identity)
        drafts.setdefault(asset, []).append(
            {
                "season_id": season_id,
                "trainer": trainer,
                "trainer_key": trainer_key,
                "team": team,
                "source_urls": row.get("source_urls", ""),
            }
        )

    for row in killlists:
        add(row, trainer_field="trainer", trainer_normalized_field="trainer_normalized", team_field="team_name")
    for row in team_usage:
        add(row, trainer_field="person_name", trainer_normalized_field="person_name_normalized", team_field="team_name")
    return drafts


def _title_seasons_by_asset(
    draft_map: dict[str, list[dict[str, str]]],
    champions: list[dict[str, str]],
) -> dict[str, list[str]]:
    champion_team_keys: set[tuple[str, str]] = set()
    champion_person_keys_with_team: set[tuple[str, str]] = set()
    for row in champions:
        if row.get("data_status") == "not_available":
            continue
        season_id = row.get("season_id", "")
        team_key = name_key(row.get("champion_team", ""))
        if season_id and team_key:
            champion_team_keys.add((season_id, team_key))
            person_key = _person_key(row.get("champion_person_id") or row.get("champion_name"))
            if person_key:
                champion_person_keys_with_team.add((season_id, person_key))

    title_seasons: dict[str, set[str]] = {}
    for asset, drafts in draft_map.items():
        for draft in drafts:
            season_id = draft.get("season_id", "")
            team_key = name_key(draft.get("team", ""))
            trainer_key = draft.get("trainer_key") or _person_key(draft.get("trainer"))
            team_matches = (season_id, team_key) in champion_team_keys
            person_matches_missing_team = not team_key and (season_id, trainer_key) in champion_person_keys_with_team
            if team_matches or person_matches_missing_team:
                title_seasons.setdefault(asset, set()).add(season_id)

    return {asset: sorted(seasons, key=_season_sort) for asset, seasons in title_seasons.items()}


def _person_key(value: str | None) -> str:
    text = str(value or "").strip()
    if text.startswith("person_"):
        text = text[len("person_") :]
    return name_key(text)


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
    cache_path = data_dir / "raw" / "pokemon_showdown" / "formats-data.ts"
    if cache_path.exists() and not refresh:
        return cache_path.read_text(encoding="utf-8")
    response = requests.get(SHOWDOWN_FORMATS_DATA_URL, timeout=30)
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
