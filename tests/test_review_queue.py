import csv

from gpl_history.review import generate_review_queue


def test_generate_review_queue_writes_missing_killlists_and_video_review_files(tmp_path):
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    review = tmp_path / "review"

    _write_csv(
        normalized / "pokemon_killlists.csv",
        [
            {
                "season_id": "season_003",
                "division": "Regular Season",
                "trainer": "Bene",
                "team_name": "Unlimited Blade Works",
                "data_status": "not_available",
                "source_urls": "https://example.test/deleted-killlist",
            },
            {
                "season_id": "season_001",
                "division": "Regular Season",
                "stage": "regular_season",
                "pokemon": "Pikachu",
                "trainer": "PresentLP",
                "team_name": "PrekaKnight",
                "appearances": "",
                "kills": "2",
                "data_status": "sheet_extracted",
                "source_urls": "https://example.test/killlist-without-appearances",
            }
        ],
    )
    _write_csv(
        normalized / "video_archive.csv",
        [
            {
                "video_id": "low",
                "video_url": "https://youtube.test/watch?v=low",
                "title": "GPL S3 Spieltag 4 vs Bene",
                "video_type": "game",
                "match_status": "matched",
                "confidence": "72",
                "confidence_tier": "medium",
                "match_basis": "season,week",
                "confidence_explanation": "season and week matched, participant evidence incomplete",
                "detected_season_id": "season_003",
                "detected_week": "4",
                "source_urls": "https://youtube.test/watch?v=low",
            },
            {
                "video_id": "unmatched",
                "video_url": "https://youtube.test/watch?v=unmatched",
                "title": "GPL S1 Spieltag 2 vs Mortox",
                "video_type": "game",
                "match_status": "unmatched",
                "confidence": "",
                "confidence_tier": "",
                "match_basis": "",
                "confidence_explanation": "",
                "detected_season_id": "season_001",
                "detected_week": "2",
                "source_urls": "https://youtube.test/watch?v=unmatched",
            },
        ],
    )

    generated = generate_review_queue(tmp_path)

    assert generated == {
        "missing_killlists": 1,
        "missing_killlist_appearances": 1,
        "low_confidence_videos": 1,
        "ambiguous_matches": 1,
        "review_index": 4,
    }
    assert _read_csv(review / "missing_killlists.csv") == [
        {
            "season_id": "season_003",
            "division": "Regular Season",
            "trainer": "Bene",
            "team_name": "Unlimited Blade Works",
            "source_urls": "https://example.test/deleted-killlist",
            "review_reason": "killlist_source_unavailable",
        }
    ]
    assert _read_csv(review / "missing_killlist_appearances.csv") == [
        {
            "season_id": "season_001",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Pikachu",
            "trainer": "PresentLP",
            "team_name": "PrekaKnight",
            "kills": "2",
            "source_urls": "https://example.test/killlist-without-appearances",
            "review_reason": "killlist_appearances_not_in_source",
        }
    ]
    assert _read_csv(review / "low_confidence_videos.csv")[0]["confidence_explanation"] == (
        "season and week matched, participant evidence incomplete"
    )
    assert _read_csv(review / "ambiguous_matches.csv")[0]["review_reason"] == "unmatched_game_video"
    assert _read_csv(review / "review_index.csv") == [
        {
            "review_file": "missing_killlists.csv",
            "row_count": "1",
            "severity": "high",
            "review_reason": "killlist_source_unavailable",
            "correction_file": "data/manual/pokemon_killlists.csv",
            "suggested_action": "Add sourced killlist rows or keep the placeholder if the source is unavailable.",
            "description": "Killlist source rows that are known but unavailable.",
        },
        {
            "review_file": "missing_killlist_appearances.csv",
            "row_count": "1",
            "severity": "medium",
            "review_reason": "killlist_appearances_not_in_source",
            "correction_file": "data/manual/pokemon_killlists.csv",
            "suggested_action": "Add appearance counts only when a source explicitly provides them.",
            "description": "Killlist rows with kills but no appearance count in the source.",
        },
        {
            "review_file": "low_confidence_videos.csv",
            "row_count": "1",
            "severity": "medium",
            "review_reason": "low_or_medium_match_confidence",
            "correction_file": "data/manual/matches.csv",
            "suggested_action": "Confirm or override the video-to-match assignment with source evidence.",
            "description": "Matched videos whose assignment should be manually reviewed.",
        },
        {
            "review_file": "ambiguous_matches.csv",
            "row_count": "1",
            "severity": "high",
            "review_reason": "unmatched_game_video",
            "correction_file": "data/manual/matches.csv",
            "suggested_action": "Map the video to a sourced match row or leave it unmatched.",
            "description": "Game-like GPL videos that could not be matched to a normalized match.",
        },
    ]


def _write_csv(path, rows):
    fields = sorted({key for row in rows for key in row}) or ["data_status"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _read_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))
