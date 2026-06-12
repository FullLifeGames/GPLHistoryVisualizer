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


def generate_review_queue(data_dir: Path) -> dict[str, int]:
    normalized_dir = data_dir / "normalized"
    review_dir = ensure_dir(data_dir / "review")

    missing_killlists = [
        {
            "season_id": row.get("season_id"),
            "division": row.get("division"),
            "trainer": row.get("trainer"),
            "team_name": row.get("team_name"),
            "source_urls": row.get("source_urls"),
            "review_reason": "killlist_source_unavailable",
        }
        for row in _read_csv(normalized_dir / "pokemon_killlists.csv")
        if row.get("data_status") == "not_available"
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
    _write_csv(review_dir / "low_confidence_videos.csv", VIDEO_REVIEW_FIELDS, low_confidence_videos)
    _write_csv(review_dir / "ambiguous_matches.csv", VIDEO_REVIEW_FIELDS, ambiguous_matches)

    return {
        "missing_killlists": len(missing_killlists),
        "low_confidence_videos": len(low_confidence_videos),
        "ambiguous_matches": len(ambiguous_matches),
    }


def _video_review_row(row: dict[str, Any]) -> dict[str, Any]:
    return {field: row.get(field) for field in VIDEO_REVIEW_FIELDS if field != "review_reason"}


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
