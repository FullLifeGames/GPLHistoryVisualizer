from __future__ import annotations

import csv
from pathlib import Path

from src.gpl_history.match_highlights import _highlight_score, build_and_write_match_highlights


def test_match_highlights_aggregate_video_anomalies(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "matches.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score_a",
            "score_b",
            "winner",
            "data_status",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "s4_w1_bene_tabasco",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "1. Spieltag",
                "player_a": "Bene",
                "player_b": "Tabasco TV",
                "score_a": "1",
                "score_b": "0",
                "winner": "Bene",
                "data_status": "source_evidenced",
            }
        ],
    )
    _write_csv(
        normalized / "match_videos.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score",
            "video_id",
            "video_url",
            "perspective_person",
            "view_count",
            "views_multiplier",
            "views_percentile",
            "views_z_score",
            "views_expected",
            "views_trend_multiplier",
            "views_trend_percentile",
            "views_trend_z_score",
            "stats_fetched_at",
            "source_urls",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "s4_w1_bene_tabasco",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "1. Spieltag",
                "player_a": "Bene",
                "player_b": "Tabasco TV",
                "score": "1 - 0",
                "video_id": "a",
                "video_url": "https://youtu.be/a",
                "perspective_person": "Bene",
                "view_count": "8000",
                "views_multiplier": "2",
                "views_percentile": "1",
                "views_z_score": "3",
                "views_expected": "4000",
                "views_trend_multiplier": "2",
                "views_trend_percentile": "1",
                "views_trend_z_score": "3",
                "stats_fetched_at": "2026-06-19T00:00:00Z",
                "source_urls": "https://youtu.be/a",
            },
            {
                "season_id": "season_004",
                "match_id": "s4_w1_bene_tabasco",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "1. Spieltag",
                "player_a": "Bene",
                "player_b": "Tabasco TV",
                "score": "1 - 0",
                "video_id": "b",
                "video_url": "https://youtu.be/b",
                "perspective_person": "Tabasco TV",
                "view_count": "6500",
                "views_multiplier": "1.6",
                "views_percentile": "0.95",
                "views_z_score": "2.6",
                "views_expected": "4062",
                "views_trend_multiplier": "1.6",
                "views_trend_percentile": "0.95",
                "views_trend_z_score": "2.6",
                "stats_fetched_at": "2026-06-19T00:00:00Z",
                "source_urls": "https://youtu.be/b",
            },
        ],
    )

    rows = build_and_write_match_highlights(tmp_path)

    assert len(rows) == 1
    row = rows[0]
    assert row["match_id"] == "s4_w1_bene_tabasco"
    assert row["view_peak"] == 8000
    assert row["view_total"] == 14500
    assert row["both_sides_spiked"] == "1"
    assert row["close_match"] == "1"
    assert row["view_trend_multiplier_peak"] == "2"
    assert row["view_trend_multiplier_match"] == "1.8"
    assert "über Match-Erwartung 1.8x" in row["highlight_reasons"]
    assert "beide Perspektiven über Erwartung" in row["highlight_reasons"]
    assert (normalized / "match_highlights.csv").exists()


def test_match_highlights_keeps_matches_without_video_stats(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "matches.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score_a",
            "score_b",
            "winner",
            "source_urls",
            "data_status",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "s4_w2_bene_regibang",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "2. Spieltag",
                "player_a": "Bene",
                "player_b": "RegiBang",
                "score_a": "6",
                "score_b": "0",
                "winner": "Bene",
                "source_urls": "https://docs.example/match",
                "data_status": "source_evidenced",
            }
        ],
    )

    rows = build_and_write_match_highlights(tmp_path)

    assert len(rows) == 1
    assert rows[0]["match_id"] == "s4_w2_bene_regibang"
    assert rows[0]["video_count"] == 0
    assert rows[0]["view_peak"] == 0
    assert rows[0]["highlight_score"] == "0"
    assert rows[0]["source_urls"] == "https://docs.example/match"


def test_match_highlights_penalizes_single_source_scores() -> None:
    kwargs = {
        "match_view_multiplier": 1.8,
        "match_views_percentile": 0.95,
        "match_views_z_score": 3,
        "raw_attention_percentile": 0.95,
        "perspective_multiplier": 1.8,
        "perspective_views_percentile": 0.95,
        "perspective_views_z_score": 3,
        "perspective_view_share": 0.5,
        "engagement_multiplier": 1,
        "engagement_percentile": 0.5,
        "engagement_z_score": 0,
        "close_match": False,
        "playoff_match": False,
        "both_sides_spiked": False,
    }

    single_score, single_reasons = _highlight_score(**kwargs, videos=[{"video_id": "single"}])
    multi_score, multi_reasons = _highlight_score(**kwargs, videos=[{"video_id": "a"}, {"video_id": "b"}])

    assert single_score < multi_score
    assert "nur eine Quelle (-15%)" in single_reasons
    assert "mehrere Perspektiven" in multi_reasons


def test_match_highlights_ignore_teambuilding_rows(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "matches.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score_a",
            "score_b",
            "winner",
            "data_status",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "s4_w22_lauris_surskit",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "22. Spieltag",
                "player_a": "Lauris",
                "player_b": "SurskitTV",
                "score_a": "0",
                "score_b": "2",
                "winner": "SurskitTV",
                "data_status": "source_evidenced",
            }
        ],
    )
    _write_csv(
        normalized / "match_videos.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score",
            "video_id",
            "video_url",
            "video_title",
            "video_type",
            "perspective_person",
            "view_count",
            "views_multiplier",
            "views_percentile",
            "views_z_score",
            "views_expected",
            "views_trend_multiplier",
            "views_trend_percentile",
            "views_trend_z_score",
            "stats_fetched_at",
            "source_urls",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "s4_w22_lauris_surskit",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "22. Spieltag",
                "player_a": "Lauris",
                "player_b": "SurskitTV",
                "score": "0 - 2",
                "video_id": "game",
                "video_url": "https://youtu.be/game",
                "video_type": "game",
                "perspective_person": "SurskitTV",
                "view_count": "2965",
                "views_multiplier": "2.09",
                "views_percentile": "0.86",
                "views_z_score": "0.74",
                "views_expected": "1200",
                "views_trend_multiplier": "2.47",
                "views_trend_percentile": "0.96",
                "views_trend_z_score": "1.3",
                "stats_fetched_at": "2026-06-19T00:00:00Z",
                "source_urls": "https://youtu.be/game",
            },
            {
                "season_id": "season_004",
                "match_id": "s4_w22_lauris_surskit",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "22. Spieltag",
                "player_a": "Lauris",
                "player_b": "SurskitTV",
                "score": "0 - 2",
                "video_id": "tb",
                "video_url": "https://youtu.be/tb",
                "video_type": "teambuilding",
                "perspective_person": "SurskitTV",
                "view_count": "99999",
                "views_multiplier": "99",
                "views_percentile": "1",
                "views_z_score": "9",
                "views_expected": "100",
                "views_trend_multiplier": "999",
                "views_trend_percentile": "1",
                "views_trend_z_score": "9",
                "stats_fetched_at": "2026-06-19T00:00:00Z",
                "source_urls": "https://youtu.be/tb",
            },
        ],
    )

    rows = build_and_write_match_highlights(tmp_path)

    assert len(rows) == 1
    row = rows[0]
    assert row["video_count"] == 1
    assert row["view_peak"] == 2965
    assert row["view_total"] == 2965
    assert row["video_urls"] == "https://youtu.be/game"


def test_match_highlights_add_engagement_anomaly(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "matches.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score_a",
            "score_b",
            "winner",
            "data_status",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "highlight",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "8. Spieltag",
                "player_a": "RegiBang",
                "player_b": "Bene",
                "score_a": "0",
                "score_b": "2",
                "winner": "Bene",
                "data_status": "source_evidenced",
            },
            {
                "season_id": "season_004",
                "match_id": "baseline_1",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "1. Spieltag",
                "player_a": "Bene",
                "player_b": "A",
                "data_status": "source_evidenced",
            },
            {
                "season_id": "season_004",
                "match_id": "baseline_2",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "2. Spieltag",
                "player_a": "Bene",
                "player_b": "B",
                "data_status": "source_evidenced",
            },
        ],
    )
    _write_csv(
        normalized / "match_videos.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score",
            "video_id",
            "video_url",
            "video_title",
            "video_type",
            "perspective_person",
            "view_count",
            "like_count",
            "comment_count",
            "views_multiplier",
            "views_percentile",
            "views_z_score",
            "views_expected",
            "views_trend_multiplier",
            "views_trend_percentile",
            "views_trend_z_score",
            "stats_fetched_at",
            "source_urls",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "highlight",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "8. Spieltag",
                "player_a": "RegiBang",
                "player_b": "Bene",
                "score": "0 - 2",
                "video_id": "highlight",
                "video_url": "https://youtu.be/highlight",
                "video_title": "GPL [S4] - Spieltag 08 - vs. Flexing Masskito: Kampf um Platz 1!",
                "video_type": "game",
                "perspective_person": "Bene",
                "view_count": "1000",
                "like_count": "100",
                "comment_count": "100",
                "views_multiplier": "1",
                "views_percentile": "0.5",
                "views_z_score": "0",
                "views_expected": "1000",
                "views_trend_multiplier": "1",
                "views_trend_percentile": "0.5",
                "views_trend_z_score": "0",
                "stats_fetched_at": "2026-06-19T00:00:00Z",
                "source_urls": "https://youtu.be/highlight",
            },
            _baseline_video("baseline_1", "b1", 1000, 50, 5),
            _baseline_video("baseline_2", "b2", 1000, 55, 4),
        ],
    )

    rows = build_and_write_match_highlights(tmp_path)
    row = next(item for item in rows if item["match_id"] == "highlight")

    assert float(row["engagement_multiplier_peak"]) > 4
    assert "Engagement-Ausreißer" in row["highlight_reasons"]


def test_match_highlights_rewards_high_reach_and_engagement_together(tmp_path: Path) -> None:
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "matches.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score_a",
            "score_b",
            "winner",
            "data_status",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "community",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "8. Spieltag",
                "player_a": "RegiBang",
                "player_b": "Bene",
                "score_a": "0",
                "score_b": "2",
                "winner": "Bene",
                "data_status": "source_evidenced",
            },
            {"season_id": "season_004", "match_id": "baseline_a", "data_status": "source_evidenced"},
            {"season_id": "season_004", "match_id": "baseline_b", "data_status": "source_evidenced"},
        ],
    )
    _write_csv(
        normalized / "match_videos.csv",
        [
            "season_id",
            "match_id",
            "division",
            "stage",
            "week",
            "player_a",
            "player_b",
            "score",
            "video_id",
            "video_url",
            "video_title",
            "video_type",
            "perspective_person",
            "view_count",
            "like_count",
            "comment_count",
            "views_multiplier",
            "views_percentile",
            "views_z_score",
            "views_expected",
            "views_trend_multiplier",
            "views_trend_percentile",
            "views_trend_z_score",
            "stats_fetched_at",
            "source_urls",
        ],
        [
            {
                "season_id": "season_004",
                "match_id": "community",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "8. Spieltag",
                "player_a": "RegiBang",
                "player_b": "Bene",
                "score": "0 - 2",
                "video_id": "community_a",
                "video_url": "https://youtu.be/community-a",
                "video_type": "game",
                "perspective_person": "Bene",
                "view_count": "8500",
                "like_count": "580",
                "comment_count": "515",
                "views_multiplier": "2",
                "views_percentile": "1",
                "views_z_score": "3",
                "views_expected": "8000",
                "views_trend_multiplier": "1.06",
                "views_trend_percentile": "0.8",
                "views_trend_z_score": "0.7",
                "stats_fetched_at": "2026-06-19T00:00:00Z",
                "source_urls": "https://youtu.be/community-a",
            },
            _baseline_video("baseline_a", "b1", 1000, 20, 2),
            _baseline_video("baseline_b", "b2", 1200, 20, 2),
        ],
    )

    rows = build_and_write_match_highlights(tmp_path)
    row = next(item for item in rows if item["match_id"] == "community")

    assert "Community-Magnet" in row["highlight_reasons"]
    assert float(row["highlight_score"]) > 45


def _baseline_video(match_id: str, video_id: str, views: int, likes: int, comments: int) -> dict[str, str]:
    return {
        "season_id": "season_004",
        "match_id": match_id,
        "division": "Liga 1",
        "stage": "regular_season",
        "week": "1. Spieltag",
        "player_a": "Bene",
        "player_b": "A",
        "score": "",
        "video_id": video_id,
        "video_url": f"https://youtu.be/{video_id}",
        "video_title": f"GPL [S4] - Baseline {video_id}",
        "video_type": "game",
        "perspective_person": "Bene",
        "view_count": str(views),
        "like_count": str(likes),
        "comment_count": str(comments),
        "views_multiplier": "1",
        "views_percentile": "0.5",
        "views_z_score": "0",
        "views_expected": str(views),
        "views_trend_multiplier": "1",
        "views_trend_percentile": "0.5",
        "views_trend_z_score": "0",
        "stats_fetched_at": "2026-06-19T00:00:00Z",
        "source_urls": f"https://youtu.be/{video_id}",
    }


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
