from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

from .storage import ensure_dir

MISSING_KILLLIST_FIELDS = [
    "season_id",
    "division",
    "trainer",
    "team_name",
    "source_urls",
    "review_reason",
]

MISSING_KILLLIST_APPEARANCE_FIELDS = [
    "season_id",
    "division",
    "stage",
    "pokemon",
    "trainer",
    "team_name",
    "kills",
    "source_urls",
    "review_reason",
]

VIDEO_REVIEW_FIELDS = [
    "video_id",
    "video_url",
    "title",
    "video_type",
    "match_status",
    "confidence",
    "confidence_tier",
    "match_basis",
    "confidence_explanation",
    "detected_season_id",
    "detected_week",
    "source_urls",
    "review_reason",
]

REVIEW_INDEX_FIELDS = [
    "review_file",
    "row_count",
    "severity",
    "review_reason",
    "correction_file",
    "suggested_action",
    "description",
]

REVIEW_INDEX_DEFINITIONS = [
    {
        "review_file": "missing_killlists.csv",
        "severity": "high",
        "review_reason": "killlist_source_unavailable",
        "correction_file": "data/manual/pokemon_killlists.csv",
        "suggested_action": "Add sourced killlist rows or keep the placeholder if the source is unavailable.",
        "description": "Killlist source rows that are known but unavailable.",
    },
    {
        "review_file": "missing_killlist_appearances.csv",
        "severity": "medium",
        "review_reason": "killlist_appearances_not_in_source",
        "correction_file": "data/manual/pokemon_killlists.csv",
        "suggested_action": "Add appearance counts only when a source explicitly provides them.",
        "description": "Killlist rows with kills but no appearance count in the source.",
    },
    {
        "review_file": "low_confidence_videos.csv",
        "severity": "medium",
        "review_reason": "low_or_medium_match_confidence",
        "correction_file": "data/manual/matches.csv",
        "suggested_action": "Confirm or override the video-to-match assignment with source evidence.",
        "description": "Matched videos whose assignment should be manually reviewed.",
    },
    {
        "review_file": "ambiguous_matches.csv",
        "severity": "high",
        "review_reason": "unmatched_game_video",
        "correction_file": "data/manual/matches.csv",
        "suggested_action": "Map the video to a sourced match row or leave it unmatched.",
        "description": "Game-like GPL videos that could not be matched to a normalized match.",
    },
]


def generate_review_queue(data_dir: Path) -> dict[str, int]:
    normalized_dir = data_dir / "normalized"
    review_dir = ensure_dir(data_dir / "review")

    killlists = _read_csv(normalized_dir / "pokemon_killlists.csv")
    missing_killlists = [
        {
            "season_id": row.get("season_id"),
            "division": row.get("division"),
            "trainer": row.get("trainer"),
            "team_name": row.get("team_name"),
            "source_urls": row.get("source_urls"),
            "review_reason": "killlist_source_unavailable",
        }
        for row in killlists
        if row.get("data_status") == "not_available"
    ]
    missing_killlist_appearances = [
        {
            "season_id": row.get("season_id"),
            "division": row.get("division"),
            "stage": row.get("stage"),
            "pokemon": row.get("pokemon"),
            "trainer": row.get("trainer"),
            "team_name": row.get("team_name"),
            "kills": row.get("kills"),
            "source_urls": row.get("source_urls"),
            "review_reason": "killlist_appearances_not_in_source",
        }
        for row in killlists
        if row.get("data_status") != "not_available" and row.get("kills") and not row.get("appearances")
    ]
    videos = _read_csv(normalized_dir / "video_archive.csv")
    low_confidence_videos = [
        {
            **_video_review_row(row),
            "review_reason": "low_or_medium_match_confidence",
        }
        for row in videos
        if row.get("match_status") == "matched" and row.get("confidence_tier") in {"low", "medium"}
    ]
    ambiguous_matches = [
        {
            **_video_review_row(row),
            "review_reason": "unmatched_game_video",
        }
        for row in videos
        if row.get("video_type") == "game" and row.get("match_status") == "unmatched"
    ]

    _write_csv(review_dir / "missing_killlists.csv", MISSING_KILLLIST_FIELDS, missing_killlists)
    _write_csv(
        review_dir / "missing_killlist_appearances.csv",
        MISSING_KILLLIST_APPEARANCE_FIELDS,
        missing_killlist_appearances,
    )
    _write_csv(review_dir / "low_confidence_videos.csv", VIDEO_REVIEW_FIELDS, low_confidence_videos)
    _write_csv(review_dir / "ambiguous_matches.csv", VIDEO_REVIEW_FIELDS, ambiguous_matches)
    review_index = _review_index_rows(
        {
            "missing_killlists.csv": len(missing_killlists),
            "missing_killlist_appearances.csv": len(missing_killlist_appearances),
            "low_confidence_videos.csv": len(low_confidence_videos),
            "ambiguous_matches.csv": len(ambiguous_matches),
        }
    )
    _write_csv(review_dir / "review_index.csv", REVIEW_INDEX_FIELDS, review_index)

    return {
        "missing_killlists": len(missing_killlists),
        "missing_killlist_appearances": len(missing_killlist_appearances),
        "low_confidence_videos": len(low_confidence_videos),
        "ambiguous_matches": len(ambiguous_matches),
        "review_index": len(review_index),
    }


def _video_review_row(row: dict[str, Any]) -> dict[str, Any]:
    return {field: row.get(field) for field in VIDEO_REVIEW_FIELDS if field != "review_reason"}


def _review_index_rows(counts: dict[str, int]) -> list[dict[str, Any]]:
    return [
        {
            **definition,
            "row_count": counts.get(definition["review_file"], 0),
        }
        for definition in REVIEW_INDEX_DEFINITIONS
    ]


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
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})
