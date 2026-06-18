import csv
from pathlib import Path

from gpl_history.data_quality import (
    check_generated_artifacts,
    generate_data_quality,
)


def test_generate_data_quality_writes_source_claims_and_quality_rows(tmp_path):
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "seasons.csv",
        [
            {
                "season_id": "season_010",
                "season_label": "Season 10",
                "playlist_url": "https://youtube.test/playlist",
                "source_urls": "https://youtube.test/playlist",
            }
        ],
    )
    _write_csv(
        normalized / "standings.csv",
        [
            {
                "season_id": "season_010",
                "division": "Regular Season",
                "rank": "1",
                "player_name": "Minetube",
                "team_name": "Backel Gefackel",
                "wins": "8",
                "losses": "1",
                "data_status": "sheet_extracted",
                "source_urls": "https://sheet.test/table",
            }
        ],
    )
    _write_csv(
        normalized / "matches.csv",
        [
            {
                "season_id": "season_010",
                "match_id": "season_010_playoffs_final",
                "division": "Playoffs",
                "stage": "playoffs",
                "week": "Finale",
                "player_a": "Bene",
                "player_b": "Minetube",
                "winner": "Bene",
                "data_status": "sheet_extracted",
                "source_urls": "https://sheet.test/playoffs",
            }
        ],
    )
    _write_csv(
        normalized / "champions.csv",
        [
            {
                "season_id": "season_010",
                "champion_name": "Bene",
                "champion_person_id": "person_bene",
                "champion_team": "Wackel Backel",
                "data_status": "source_evidenced",
                "source_urls": "https://sheet.test/playoffs",
            }
        ],
    )
    _write_csv(
        normalized / "pokemon_killlists.csv",
        [
            {
                "season_id": "season_010",
                "division": "Playoffs",
                "stage": "playoffs",
                "pokemon": "UHaFniR",
                "trainer": "Bene",
                "team_name": "Wackel Backel",
                "appearances": "",
                "kills": "9",
                "data_status": "sheet_extracted",
                "source_urls": "https://sheet.test/killlist",
            },
            {
                "season_id": "season_010",
                "division": "Regular Season",
                "trainer": "Bene",
                "team_name": "Wackel Backel",
                "data_status": "not_available",
                "source_urls": "https://sheet.test/deleted",
            },
        ],
    )
    _write_csv(
        normalized / "video_archive.csv",
        [
            {
                "video_id": "matched-low",
                "video_type": "game",
                "detected_season_id": "season_010",
                "match_status": "matched",
                "confidence": "70",
                "confidence_tier": "medium",
                "source_urls": "https://youtube.test/watch?v=matched-low",
            },
            {
                "video_id": "unmatched",
                "video_type": "game",
                "detected_season_id": "season_010",
                "match_status": "unmatched",
                "confidence": "",
                "confidence_tier": "",
                "source_urls": "https://youtube.test/watch?v=unmatched",
            },
        ],
    )

    counts = generate_data_quality(tmp_path)

    assert counts == {"source_claims": 20, "data_quality": 1}
    claims = _read_csv(normalized / "source_claims.csv")
    assert {
        "season_id": "season_010",
        "table_name": "champions",
        "claim_type": "champion",
        "claim_subject": "Bene",
        "claim_field": "champion_name",
        "claim_value": "Bene",
        "evidence_status": "source_evidenced",
        "confidence": "",
        "source_urls": "https://sheet.test/playoffs",
        "notes": "",
    }.items() <= claims[0].items()
    assert any(row["claim_field"] == "winner" and row["claim_value"] == "Bene" for row in claims)

    quality = _read_csv(normalized / "data_quality.csv")
    assert quality == [
        {
            "season_id": "season_010",
            "season_label": "Season 10",
            "coverage_status": "complete_with_review_flags",
            "standings_rows": "1",
            "match_rows": "1",
            "playoff_match_rows": "1",
            "champion_rows": "1",
            "killlist_rows": "1",
            "killlist_rows_missing_appearances": "1",
            "unavailable_killlist_rows": "1",
            "video_rows": "2",
            "matched_video_rows": "1",
            "unmatched_game_video_rows": "1",
            "low_confidence_video_rows": "1",
            "quality_score": "78",
            "tables_score": "100",
            "matches_score": "100",
            "killlists_score": "40",
            "videos_score": "50",
            "claims_score": "100",
            "quality_summary": "78/100 - complete_with_review_flags",
            "priority_gaps": "missing_appearances;unavailable_killlists;unmatched_game_videos;low_confidence_videos",
            "missing_categories": "",
            "review_flags": "missing_appearances;unavailable_killlists;unmatched_game_videos;low_confidence_videos",
            "source_urls": "https://sheet.test/deleted;https://sheet.test/killlist;https://sheet.test/playoffs;https://sheet.test/table;https://youtube.test/playlist;https://youtube.test/watch?v=matched-low;https://youtube.test/watch?v=unmatched",
        }
    ]


def test_check_generated_artifacts_reports_drift(tmp_path):
    normalized = tmp_path / "normalized"
    review = tmp_path / "review"
    showdown_cache = tmp_path / "raw" / "pokemon_showdown"
    normalized.mkdir()
    review.mkdir()
    showdown_cache.mkdir(parents=True)
    (showdown_cache / "formats-data.ts").write_text("export const FormatsData = {};\n", encoding="utf-8")
    _write_csv(normalized / "seasons.csv", [{"season_id": "season_001", "season_label": "Season 1"}])
    _write_csv(normalized / "standings.csv", [])
    _write_csv(normalized / "matches.csv", [])
    _write_csv(normalized / "champions.csv", [])
    _write_csv(normalized / "pokemon_killlists.csv", [])
    _write_csv(normalized / "video_archive.csv", [])
    _write_csv(review / "missing_killlists.csv", [])
    _write_csv(review / "missing_killlist_appearances.csv", [])
    _write_csv(review / "low_confidence_videos.csv", [])
    _write_csv(review / "ambiguous_matches.csv", [])

    generate_data_quality(tmp_path)
    (normalized / "data_quality.csv").write_text("changed\n", encoding="utf-8")

    changed = check_generated_artifacts(tmp_path)

    assert changed == [
        "data/normalized/person_all_time.csv",
        "data/normalized/pokemon_all_time.csv",
        "data/normalized/matchup_summary.csv",
        "data/normalized/roster_scores.csv",
        "data/normalized/season_storylines.csv",
        "data/normalized/team_rosters.csv",
        "data/normalized/pokemon_draft_overview.csv",
        "data/normalized/pokemon_draft_instances.csv",
        "data/normalized/data_quality.csv",
        "data/review/review_index.csv",
    ]


def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    fields = sorted({key for row in rows for key in row}) or ["data_status"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))
