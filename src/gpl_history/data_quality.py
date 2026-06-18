from __future__ import annotations

import csv
import hashlib
from collections import defaultdict
from pathlib import Path
from typing import Any

from .storage import ensure_dir

SOURCE_CLAIM_FIELDS = [
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
]

DATA_QUALITY_FIELDS = [
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
]

CLAIM_TABLES = {
    "champions": ("champion", ["champion_name", "champion_team"]),
    "matches": ("match", ["player_a", "player_b", "winner"]),
    "standings": ("standing", ["rank", "player_name", "team_name", "wins", "losses"]),
    "pokemon_draft_instances": ("pokemon_draft", ["pokemon", "person_name", "team_name"]),
    "pokemon_killlists": ("pokemon_killlist", ["pokemon", "trainer", "team_name", "kills"]),
    "video_archive": ("video", ["title", "video_type", "match_status", "best_match_id"]),
}

GENERATED_ARTIFACTS = [
    (Path("normalized") / "person_all_time.csv", "data/normalized/person_all_time.csv"),
    (Path("normalized") / "pokemon_all_time.csv", "data/normalized/pokemon_all_time.csv"),
    (Path("normalized") / "matchup_summary.csv", "data/normalized/matchup_summary.csv"),
    (Path("normalized") / "roster_scores.csv", "data/normalized/roster_scores.csv"),
    (Path("normalized") / "season_storylines.csv", "data/normalized/season_storylines.csv"),
    (Path("normalized") / "team_rosters.csv", "data/normalized/team_rosters.csv"),
    (Path("normalized") / "pokemon_draft_overview.csv", "data/normalized/pokemon_draft_overview.csv"),
    (Path("normalized") / "pokemon_draft_instances.csv", "data/normalized/pokemon_draft_instances.csv"),
    (Path("normalized") / "data_quality.csv", "data/normalized/data_quality.csv"),
    (Path("normalized") / "source_claims.csv", "data/normalized/source_claims.csv"),
    (Path("review") / "review_index.csv", "data/review/review_index.csv"),
]


def generate_data_quality(data_dir: Path) -> dict[str, int]:
    normalized_dir = ensure_dir(data_dir / "normalized")
    source_claims = _source_claims(normalized_dir)
    data_quality = _data_quality_rows(normalized_dir)

    _write_csv(normalized_dir / "source_claims.csv", SOURCE_CLAIM_FIELDS, source_claims)
    _write_csv(normalized_dir / "data_quality.csv", DATA_QUALITY_FIELDS, data_quality)
    return {"source_claims": len(source_claims), "data_quality": len(data_quality)}


def check_generated_artifacts(data_dir: Path) -> list[str]:
    before = {
        logical_path: _read_bytes(data_dir / relative_path)
        for relative_path, logical_path in GENERATED_ARTIFACTS
    }

    from .pokemon_drafts import build_and_write_pokemon_draft_overview
    from .review import generate_review_queue
    from .team_rosters import build_and_write_team_rosters
    from .aggregates import build_and_write_aggregates

    build_and_write_team_rosters(data_dir)
    build_and_write_pokemon_draft_overview(data_dir)
    generate_data_quality(data_dir)
    build_and_write_aggregates(data_dir)
    generate_review_queue(data_dir)

    changed = []
    for relative_path, logical_path in GENERATED_ARTIFACTS:
        after = _read_bytes(data_dir / relative_path)
        if before.get(logical_path) != after:
            changed.append(logical_path)
    return changed


def _source_claims(normalized_dir: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for table_name, (claim_type, fields) in CLAIM_TABLES.items():
        for index, row in enumerate(_read_csv(normalized_dir / f"{table_name}.csv"), start=1):
            for field in fields:
                value = row.get(field)
                if not _has_value(value):
                    continue
                rows.append(
                    {
                        "claim_id": _claim_id(table_name, index, field, value),
                        "season_id": row.get("season_id") or row.get("detected_season_id") or "",
                        "table_name": table_name,
                        "claim_type": claim_type,
                        "claim_subject": _claim_subject(table_name, row),
                        "claim_field": field,
                        "claim_value": value,
                        "evidence_status": row.get("data_status") or row.get("match_status") or "",
                        "confidence": row.get("confidence") or "",
                        "source_urls": row.get("source_urls") or row.get("video_url") or "",
                        "notes": _claim_notes(row),
                    }
                )
    return rows


def _data_quality_rows(normalized_dir: Path) -> list[dict[str, Any]]:
    seasons = _read_csv(normalized_dir / "seasons.csv")
    standings = _by_season(_read_csv(normalized_dir / "standings.csv"), "season_id")
    matches = _by_season(_read_csv(normalized_dir / "matches.csv"), "season_id")
    champions = _by_season(_read_csv(normalized_dir / "champions.csv"), "season_id")
    killlists = _by_season(_read_csv(normalized_dir / "pokemon_killlists.csv"), "season_id")
    videos = _by_season(_read_csv(normalized_dir / "video_archive.csv"), "detected_season_id", fallback_key="season_id")

    all_season_ids = {
        row.get("season_id")
        for row in seasons
        if row.get("season_id")
    }
    for grouped in (standings, matches, champions, killlists, videos):
        all_season_ids.update(key for key in grouped if key)

    labels = {row.get("season_id"): row.get("season_label") or row.get("season_id") for row in seasons}
    season_sources = {row.get("season_id"): row.get("source_urls") or row.get("playlist_url") for row in seasons}
    rows: list[dict[str, Any]] = []

    for season_id in sorted(all_season_ids):
        season_standings = _available(standings.get(season_id, []))
        season_matches = [
            row
            for row in _available(matches.get(season_id, []))
            if row.get("data_status") != "source_video_only"
        ]
        season_champions = [
            row
            for row in _available(champions.get(season_id, []))
            if _has_value(row.get("champion_name"))
        ]
        season_killlists_all = killlists.get(season_id, [])
        season_killlists = _available(season_killlists_all)
        unavailable_killlists = [row for row in season_killlists_all if row.get("data_status") == "not_available"]
        season_videos = videos.get(season_id, [])
        missing_categories = _missing_categories(season_standings, season_matches, season_champions, season_killlists)
        review_flags = _review_flags(season_killlists, unavailable_killlists, season_videos)
        scores = _quality_scores(
            season_standings=season_standings,
            season_matches=season_matches,
            season_champions=season_champions,
            season_killlists=season_killlists,
            unavailable_killlists=unavailable_killlists,
            season_videos=season_videos,
            missing_categories=missing_categories,
            review_flags=review_flags,
        )
        coverage_status = _coverage_status(missing_categories, review_flags)
        priority_gaps = [*missing_categories, *review_flags]
        rows.append(
            {
                "season_id": season_id,
                "season_label": labels.get(season_id) or season_id,
                "coverage_status": coverage_status,
                "standings_rows": len(season_standings),
                "match_rows": len(season_matches),
                "playoff_match_rows": sum(1 for row in season_matches if _is_playoff(row)),
                "champion_rows": len(season_champions),
                "killlist_rows": len(season_killlists),
                "killlist_rows_missing_appearances": sum(1 for row in season_killlists if _missing_appearances(row)),
                "unavailable_killlist_rows": len(unavailable_killlists),
                "video_rows": len(season_videos),
                "matched_video_rows": sum(1 for row in season_videos if row.get("match_status") == "matched"),
                "unmatched_game_video_rows": sum(1 for row in season_videos if row.get("video_type") == "game" and row.get("match_status") == "unmatched"),
                "low_confidence_video_rows": sum(1 for row in season_videos if row.get("match_status") == "matched" and row.get("confidence_tier") in {"low", "medium"}),
                **scores,
                "quality_summary": f"{scores['quality_score']}/100 - {coverage_status}",
                "priority_gaps": ";".join(priority_gaps),
                "missing_categories": ";".join(missing_categories),
                "review_flags": ";".join(review_flags),
                "source_urls": _source_urls(
                    [*season_standings, *season_matches, *season_champions, *season_killlists_all, *season_videos],
                    season_sources.get(season_id),
                ),
            }
        )
    return rows


def _quality_scores(
    *,
    season_standings: list[dict[str, str]],
    season_matches: list[dict[str, str]],
    season_champions: list[dict[str, str]],
    season_killlists: list[dict[str, str]],
    unavailable_killlists: list[dict[str, str]],
    season_videos: list[dict[str, str]],
    missing_categories: list[str],
    review_flags: list[str],
) -> dict[str, int]:
    tables_score = (60 if season_standings else 0) + (40 if season_champions else 0)
    matches_score = 100 if season_matches else 0
    killlists_score = 100 if season_killlists else 0
    if "missing_appearances" in review_flags:
        killlists_score -= 35
    if "partial_killlists" in review_flags:
        killlists_score -= 20
    if unavailable_killlists:
        killlists_score -= 25
    videos_score = 100 if season_videos else 0
    if any(row.get("video_type") == "game" and row.get("match_status") == "unmatched" for row in season_videos):
        videos_score -= 25
    if any(row.get("match_status") == "matched" and row.get("confidence_tier") in {"low", "medium"} for row in season_videos):
        videos_score -= 25
    claims_score = 100 if not missing_categories else max(0, 100 - len(missing_categories) * 25)

    scores = {
        "tables_score": _clamp_score(tables_score),
        "matches_score": _clamp_score(matches_score),
        "killlists_score": _clamp_score(killlists_score),
        "videos_score": _clamp_score(videos_score),
        "claims_score": _clamp_score(claims_score),
    }
    scores["quality_score"] = round(sum(scores.values()) / len(scores))
    return scores


def _clamp_score(value: int) -> int:
    return max(0, min(100, int(value)))


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})


def _read_bytes(path: Path) -> bytes | None:
    return path.read_bytes() if path.exists() else None


def _by_season(rows: list[dict[str, str]], key: str, fallback_key: str | None = None) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        season_id = row.get(key) or (row.get(fallback_key) if fallback_key else "")
        if season_id:
            grouped[season_id].append(row)
    return grouped


def _available(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    return [row for row in rows if row.get("data_status") != "not_available"]


def _has_value(value: Any) -> bool:
    return str(value or "").strip() != ""


def _claim_id(table_name: str, row_index: int, field: str, value: Any) -> str:
    digest = hashlib.sha1(f"{table_name}\0{row_index}\0{field}\0{value}".encode("utf-8")).hexdigest()[:10]
    return f"claim_{table_name}_{row_index}_{field}_{digest}"


def _claim_subject(table_name: str, row: dict[str, str]) -> str:
    if table_name == "champions":
        return row.get("champion_name") or row.get("champion_team") or row.get("season_id") or ""
    if table_name == "matches":
        return row.get("match_id") or " vs ".join(value for value in [row.get("player_a"), row.get("player_b")] if value)
    if table_name == "standings":
        return row.get("player_name") or row.get("team_name") or row.get("season_id") or ""
    if table_name == "pokemon_killlists":
        pokemon = row.get("pokemon") or ""
        trainer = row.get("trainer") or row.get("team_name") or ""
        return " / ".join(value for value in [pokemon, trainer] if value)
    if table_name == "video_archive":
        return row.get("video_id") or row.get("title") or row.get("video_url") or ""
    return row.get("season_id") or ""


def _claim_notes(row: dict[str, str]) -> str:
    notes = []
    if row.get("confidence_explanation"):
        notes.append(row["confidence_explanation"])
    if row.get("data_status") == "not_available":
        notes.append("not_available")
    return "; ".join(notes)


def _missing_categories(
    standings: list[dict[str, str]],
    matches: list[dict[str, str]],
    champions: list[dict[str, str]],
    killlists: list[dict[str, str]],
) -> list[str]:
    missing = []
    if not standings:
        missing.append("standings")
    if not matches:
        missing.append("matches")
    if not champions:
        missing.append("champions")
    if not killlists:
        missing.append("killlists")
    return missing


def _review_flags(
    killlists: list[dict[str, str]],
    unavailable_killlists: list[dict[str, str]],
    videos: list[dict[str, str]],
) -> list[str]:
    flags = []
    if any(_missing_appearances(row) for row in killlists):
        flags.append("missing_appearances")
    if any(str(row.get("data_status") or "").startswith("partial_") for row in killlists):
        flags.append("partial_killlists")
    if unavailable_killlists:
        flags.append("unavailable_killlists")
    if any(row.get("video_type") == "game" and row.get("match_status") == "unmatched" for row in videos):
        flags.append("unmatched_game_videos")
    if any(row.get("match_status") == "matched" and row.get("confidence_tier") in {"low", "medium"} for row in videos):
        flags.append("low_confidence_videos")
    return flags


def _missing_appearances(row: dict[str, str]) -> bool:
    return _has_value(row.get("kills")) and not _has_value(row.get("appearances"))


def _coverage_status(missing_categories: list[str], review_flags: list[str]) -> str:
    if missing_categories:
        return "partial_with_review_flags" if review_flags else "partial"
    return "complete_with_review_flags" if review_flags else "complete"


def _is_playoff(row: dict[str, str]) -> bool:
    return row.get("stage") == "playoffs" or row.get("division") == "Playoffs"


def _source_urls(rows: list[dict[str, str]], extra: str | None = None) -> str:
    urls: set[str] = set()
    for value in [extra] if extra else []:
        _add_urls(urls, value)
    for row in rows:
        _add_urls(urls, row.get("source_urls"))
        _add_urls(urls, row.get("video_url"))
    return ";".join(sorted(urls))


def _add_urls(urls: set[str], value: str | None) -> None:
    for item in str(value or "").split(";"):
        item = item.strip()
        if item.startswith("http"):
            urls.add(item)
