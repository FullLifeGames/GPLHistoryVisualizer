from __future__ import annotations

import csv
import json
from pathlib import Path

from src.gpl_history.youtube import YouTubeApiError
from src.gpl_history.video_stats import enrich_video_rows_with_stats
from src.gpl_history.video_stats import fetch_and_write_video_stats


def test_video_stats_adds_person_season_anomaly_fields() -> None:
    rows = [
        _video_row("v1", "Bene"),
        _video_row("v2", "Bene"),
        _video_row("v3", "Bene"),
        _video_row("v4", "Bene"),
        _video_row("v5", "Other"),
    ]
    stats = [
        _stats_row("v1", 4000),
        _stats_row("v2", 4000),
        _stats_row("v3", 4000),
        _stats_row("v4", 8000),
        _stats_row("v5", 9000),
    ]

    enriched = {row["video_id"]: row for row in enrich_video_rows_with_stats(rows, stats)}

    assert enriched["v4"]["views_baseline_median"] == "4000"
    assert enriched["v4"]["views_multiplier"] == "2"
    assert enriched["v4"]["views_percentile"] == "1"
    assert "View-Ausreißer 2.0x" in enriched["v4"]["video_highlight_reasons"]
    assert enriched["v5"]["views_multiplier"] == ""


def test_video_stats_adjusts_expected_views_for_high_draw_opponents() -> None:
    rows = []
    stats = []
    for index in range(5):
        person = f"Small {index}"
        rows.extend(
            [
                _video_row(f"{index}_normal_a", person, opponent="Normal", week="2"),
                _video_row(f"{index}_normal_b", person, opponent="Normal", week="2"),
                _video_row(f"{index}_boost", person, opponent="RegiBang", week="2"),
            ]
        )
        stats.extend(
            [
                _stats_row(f"{index}_normal_a", 1000),
                _stats_row(f"{index}_normal_b", 1000),
                _stats_row(f"{index}_boost", 2000),
            ]
        )

    enriched = {row["video_id"]: row for row in enrich_video_rows_with_stats(rows, stats)}

    boosted = enriched["0_boost"]
    assert boosted["views_baseline_median"] == "1000"
    assert boosted["views_week_factor"] == "1"
    assert boosted["views_opponent_factor"] == "2"
    assert boosted["views_expected"] == "2000"
    assert boosted["views_trend_multiplier"] == "1"


def test_video_stats_uses_strict_opening_week_factor() -> None:
    rows = []
    stats = []
    for index in range(10):
        person = f"Starter {index}"
        rows.extend(
            [
                _video_row(f"{index}_opening", person, week="1"),
                _video_row(f"{index}_normal_a", person, week="2"),
                _video_row(f"{index}_normal_b", person, week="3"),
            ]
        )
        stats.extend(
            [
                _stats_row(f"{index}_opening", 3000),
                _stats_row(f"{index}_normal_a", 1000),
                _stats_row(f"{index}_normal_b", 1000),
            ]
        )

    enriched = {row["video_id"]: row for row in enrich_video_rows_with_stats(rows, stats)}

    opening = enriched["0_opening"]
    assert opening["views_baseline_median"] == "1000"
    assert opening["views_week_factor"] == "3"
    assert opening["views_expected"] == "3000"
    assert opening["views_trend_multiplier"] == "1"


def test_fetch_video_stats_writes_partial_cache_when_quota_is_exhausted(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    with (normalized / "video_archive.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["video_id"])
        writer.writeheader()
        writer.writerows({"video_id": f"video_{index:02d}"} for index in range(51))

    result = fetch_and_write_video_stats(tmp_path, _QuotaAfterFirstChunkClient())

    assert result.requested == 51
    assert result.fetched == 50
    assert result.unprocessed == 1
    assert result.error == "quota exhausted"

    cache_path = tmp_path / "raw" / "video_stats" / "video_stats.json"
    cached_rows = json.loads(cache_path.read_text(encoding="utf-8"))
    assert len(cached_rows) == 50
    assert cached_rows[0]["view_count"] == "1000"


def _video_row(video_id: str, person: str, opponent: str | None = None, week: str = "1") -> dict[str, str]:
    return {
        "video_id": video_id,
        "video_type": "game",
        "match_status": "matched",
        "detected_season_id": "season_004",
        "detected_week": week,
        "perspective_person": person,
        "opponent": opponent or "",
    }


def _stats_row(video_id: str, views: int) -> dict[str, str]:
    return {
        "video_id": video_id,
        "view_count": str(views),
        "like_count": "0",
        "comment_count": "0",
        "duration": "PT20M",
        "duration_seconds": "1200",
        "stats_fetched_at": "2026-06-19T00:00:00Z",
    }


class _QuotaAfterFirstChunkClient:
    def __init__(self) -> None:
        self.calls = 0

    def video_details(self, video_ids: list[str]) -> dict[str, dict[str, object]]:
        self.calls += 1
        if self.calls > 1:
            raise YouTubeApiError("quota exhausted")
        return {
            video_id: {
                "video_id": video_id,
                "statistics": {"viewCount": "1000", "likeCount": "100", "commentCount": "10"},
                "contentDetails": {"duration": "PT20M"},
            }
            for video_id in video_ids
        }
