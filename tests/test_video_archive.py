import csv
import json

from gpl_history.video_archive import (
    build_video_archive,
    channel_candidate_from_url,
    classify_video_type,
    discover_channel_candidates,
    match_video_to_matches,
    parse_gpl_video_title,
)


def test_channel_candidate_from_common_youtube_url_shapes():
    assert channel_candidate_from_url("https://www.youtube.com/user/PresentLP") == {
        "kind": "username",
        "value": "PresentLP",
        "canonical_url": "https://www.youtube.com/user/PresentLP",
    }
    assert channel_candidate_from_url("https://www.youtube.com/@BeneVGC/videos") == {
        "kind": "handle",
        "value": "@BeneVGC",
        "canonical_url": "https://www.youtube.com/@BeneVGC",
    }
    assert channel_candidate_from_url("https://www.youtube.com/channel/UCabc123") == {
        "kind": "channel_id",
        "value": "UCabc123",
        "canonical_url": "https://www.youtube.com/channel/UCabc123",
    }
    assert channel_candidate_from_url("https://www.youtube.com/watch?v=abc") is None


def test_discover_channel_candidates_maps_participant_description_links(tmp_path):
    raw_dir = tmp_path / "raw" / "season_007"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_007",
                "division": "Regular Season",
                "person_id": "person_tabasco_tv",
                "person_name": "Tabasco TV",
                "team_name": "Aggron Berlin",
                "channel_url": "https://www.youtube.com/user/TabascoTV",
                "data_status": "sheet_extracted",
            }
        ],
    )
    (raw_dir / "videos.json").write_text(
        json.dumps(
            [
                {
                    "videoId": "present_s7_01",
                    "title": "GPL [S7] - Spieltag 01 - vs. Igalima Impoleon",
                    "description": "\n".join(
                        [
                            "Zweitkanal:",
                            "https://www.youtube.com/channel/UCnotParticipant",
                            "",
                            "Alle Teilnehmer:",
                            "",
                            "TabascoTV:",
                            "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                        ]
                    ),
                }
            ]
        ),
        encoding="utf-8",
    )

    candidates = discover_channel_candidates(tmp_path, include_description_channels=True)

    participant = next(
        candidate
        for candidate in candidates
        if candidate["canonical_url"] == "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ"
    )
    assert participant["source_person_names"] == "Tabasco TV"
    assert participant["source_team_names"] == "Aggron Berlin"
    assert participant["source_seasons"] == "season_007"
    assert "https://www.youtube.com/channel/UCnotParticipant" not in {
        candidate["canonical_url"] for candidate in candidates
    }


def test_parse_gpl_video_title_extracts_season_week_and_playoff_round():
    parsed = parse_gpl_video_title("GPL Season 10 - Spieltag 7 vs Bene")
    assert parsed["is_gpl"] is True
    assert parsed["season_id"] == "season_010"
    assert parsed["week_number"] == 7
    assert parsed["stage"] == "regular_season"
    assert parsed["division"] is None

    playoff = parse_gpl_video_title("German Pokémon League S7 Playoffs Finale vs Nestfloh")
    assert playoff["is_gpl"] is True
    assert playoff["season_id"] == "season_007"
    assert playoff["stage"] == "playoffs"
    assert playoff["round"] == "finale"

    league_two = parse_gpl_video_title("GPL [S5] [Liga 2] - Spieltag 01 - vs. Elekid's Club")
    assert league_two["season_id"] == "season_005"
    assert league_two["week_number"] == 1
    assert league_two["division"] == "Liga 2"

    storyline = parse_gpl_video_title("GPL [S4] - Spieltag 22 - vs. Enteikutierung: Relegation oder Liga 1?")
    assert storyline["division"] is None


def test_classify_video_type_distinguishes_games_teambuildings_and_other_gpl_videos():
    assert classify_video_type("GPL [S8] Spieltag 3 vs Bene") == "game"
    assert classify_video_type("GPL Season 10 Teambuilding - Wackel Backel") == "teambuilding"
    assert classify_video_type("German Pokémon League S7 Team Building mit Draftanalyse") == "teambuilding"
    assert classify_video_type("GPL Season 2 - Update") == "update"
    assert classify_video_type("GPL Season 4 - Ankündigung") == "announcement"
    assert classify_video_type("Legendäre GPL Kämpfe | Reaction | GPL S1 Raizor vs Fnupa") == "reaction"
    assert classify_video_type("GPL S6 Recap und Rückblick") == "recap"


def test_classify_video_type_keeps_match_titles_with_teambuilding_jokes_as_games():
    assert classify_video_type("GPL [S2] - Spieltag 18 - VS. Little Litleos: Teambuilding Fail vom Feinsten") == "game"


def test_match_video_to_matches_prefers_same_season_week_and_people():
    video = {
        "title": "GPL Season 10 - Spieltag 7 vs Bene",
        "channel_person_name": "Minetube",
    }
    matches = [
        {
            "season_id": "season_010",
            "match_id": "season_010_schedule_0042",
            "week": "Spieltag 7",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Bene",
            "player_b": "Minetube",
            "team_a": "Wackel Backel",
            "team_b": "Backel Gefackel",
        },
        {
            "season_id": "season_010",
            "match_id": "season_010_schedule_0043",
            "week": "Spieltag 7",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "PresentLP",
            "player_b": "Dauni Daunstar",
            "team_a": "Prekani",
            "team_b": "Team Dauni",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_010_schedule_0042"
    assert result["perspective_person"] == "Minetube"
    assert result["opponent"] == "Bene"
    assert result["confidence"] >= 90
    assert "season" in result["match_basis"]
    assert "week" in result["match_basis"]
    assert "channel" in result["match_basis"]
    assert "title names Bene as opponent" in result["confidence_explanation"]
    assert "channel identifies Minetube" in result["confidence_explanation"]


def test_match_video_to_matches_rejects_explicit_week_mismatch():
    video = {
        "title": "GPL - Spieltag 21 - vs. Raizoroark",
        "channel_person_name": "DaumenkinoLP",
    }
    matches = [
        {
            "season_id": "season_001",
            "match_id": "season_001_schedule_0080",
            "week": "10. Spieltag - Sonntag der 16.11.2014",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "DaumenkinoLP",
            "player_b": "Raizor",
            "team_a": "",
            "team_b": "Raizoroark",
        }
    ]

    assert match_video_to_matches(video, matches) is None


def test_match_video_to_matches_rejects_season_channel_only_updates():
    video = {
        "title": "GPL Season 2 - Update",
        "channel_person_name": "Raizor",
    }
    matches = [
        {
            "season_id": "season_002",
            "match_id": "season_002_schedule_0001",
            "week": "1. Spieltag - Sonntag der 15.03.2015",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Raizor",
            "player_b": "RegiBang",
            "team_a": "Raizoroark",
            "team_b": "Lucha Libres",
        }
    ]

    assert match_video_to_matches(video, matches) is None


def test_match_video_to_matches_accepts_team_name_opponent_from_title():
    video = {
        "title": "GPL [S2] - Spieltag 1 - VS. Lucha Libres",
        "channel_person_name": "Raizor",
    }
    matches = [
        {
            "season_id": "season_002",
            "match_id": "season_002_schedule_0001",
            "week": "1. Spieltag - Sonntag der 15.03.2015",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Raizor",
            "player_b": "RegiBang",
            "team_a": "Raizoroark",
            "team_b": "Lucha Libres",
        }
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_002_schedule_0001"


def test_match_video_to_matches_rejects_teambuildings_even_with_season_context():
    video = {
        "title": "GPL Season 2 Teambuilding - Raizoroark",
        "channel_person_name": "Raizor",
    }
    matches = [
        {
            "season_id": "season_002",
            "match_id": "season_002_schedule_0001",
            "week": "1. Spieltag - Sonntag der 15.03.2015",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Raizor",
            "player_b": "RegiBang",
            "team_a": "Raizoroark",
            "team_b": "Lucha Libres",
        }
    ]

    assert match_video_to_matches(video, matches) is None


def test_match_video_to_matches_rejects_explicit_division_mismatch():
    video = {
        "title": "Die GPL Cypher beginnt! - GPL [S5] [Liga 2] - Spieltag 01 - vs. Elekid's Club",
        "channel_person_name": "PokeBazi",
    }
    matches = [
        {
            "season_id": "season_005",
            "match_id": "season_005_schedule_0001",
            "week": "1. Spieltag - Sonntag der 11.03.2018",
            "stage": "regular_season",
            "division": "Liga 1",
            "player_a": "Bene",
            "player_b": "Lauris",
            "team_a": "Victini Bottom",
            "team_b": "Shockwaving Magearnas",
        }
    ]

    assert match_video_to_matches(video, matches) is None


def test_build_video_archive_uses_matched_season_when_title_has_no_season(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCpresent",
                    "title": "Present",
                    "canonical_url": "https://www.youtube.com/user/Present",
                    "source_person_names": "PresentLP",
                    "source_team_names": "Prekani",
                    "source_urls": "https://www.youtube.com/user/Present",
                    "raw_path": str(raw_dir / "present_uploads.json").replace("\\", "/"),
                }
            ]
        ),
        encoding="utf-8",
    )
    (raw_dir / "present_uploads.json").write_text(
        json.dumps(
            [
                {
                    "videoId": "abc123",
                    "title": "GPL - Spieltag 1 - vs. Mortox: Ein wässriger Start",
                    "publishedAt": "2014-09-14T10:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_001",
                "match_id": "season_001_schedule_0001",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "1. Spieltag - Sonntag der 14.09.2014",
                "player_a": "Morbolth",
                "player_b": "PresentLP",
                "team_a": "Mortox",
                "team_b": "Prekani",
                "score_a": "0",
                "score_b": "4",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_001",
                "person_name": "PresentLP",
                "team_name": "Prekani",
                "data_status": "sheet_extracted",
            }
        ],
    )

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert archive_rows[0]["detected_season_id"] == "season_001"
    assert archive_rows[0]["detected_week"] == "1"
    assert archive_rows[0]["match_status"] == "matched"
    assert archive_rows[0]["confidence_tier"] == "high"
    assert "week" in archive_rows[0]["match_basis"]
    assert "matched season" in archive_rows[0]["confidence_explanation"]
    assert match_rows[0]["season_id"] == "season_001"
    assert (normalized_dir / "video_urls.txt").read_text(encoding="utf-8").strip() == "https://www.youtube.com/watch?v=abc123"


def test_build_video_archive_canonicalizes_stale_channel_person_names(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    uploads_path = raw_dir / "silva_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCsilva",
                    "title": "Silva",
                    "canonical_url": "https://www.youtube.com/user/FinaALFaNtAsyLP",
                    "source_person_ids": "person_finaalfantasylp",
                    "source_person_names": "FinaALFaNtAsyLP",
                    "source_team_names": "Diggersby Army",
                    "source_urls": "https://www.youtube.com/user/FinaALFaNtAsyLP",
                    "raw_path": str(uploads_path).replace("\\", "/"),
                }
            ]
        ),
        encoding="utf-8",
    )
    uploads_path.write_text(
        json.dumps(
            [
                {
                    "videoId": "silva_info",
                    "title": "GPL Infovideo | Silva",
                    "publishedAt": "2014-09-01T10:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(normalized_dir / "matches.csv", [])
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert len(archive_rows) == 1
    assert archive_rows[0]["source_person_ids"] == "person_silva"
    assert archive_rows[0]["source_person_names"] == "Silva"
    assert archive_rows[0]["perspective_person"] == "Silva"
    assert "https://www.youtube.com/user/FinaALFaNtAsyLP" in archive_rows[0]["source_urls"]
    assert match_rows == []


def test_build_video_archive_keeps_explicit_liga2_video_without_wrong_match(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    uploads_path = raw_dir / "pokebazi_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCbazi",
                    "title": "PokeBazi",
                    "canonical_url": "https://www.youtube.com/c/PokeBazi",
                    "source_person_names": "PokeBazi",
                    "source_team_names": "Krebuknackis",
                    "source_urls": "https://www.youtube.com/c/PokeBazi",
                    "raw_path": str(uploads_path).replace("\\", "/"),
                }
            ]
        ),
        encoding="utf-8",
    )
    uploads_path.write_text(
        json.dumps(
            [
                {
                    "videoId": "liga2s5",
                    "title": "Die GPL Cypher beginnt! - GPL [S5] [Liga 2] - Spieltag 01 - vs. Elekid's Club",
                    "publishedAt": "2018-03-11T10:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_005",
                "match_id": "season_005_schedule_0001",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "1. Spieltag - Sonntag der 11.03.2018",
                "player_a": "Bene",
                "player_b": "Lauris",
                "team_a": "Victini Bottom",
                "team_b": "Shockwaving Magearnas",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert len(archive_rows) == 1
    assert archive_rows[0]["division"] == "Liga 2"
    assert archive_rows[0]["detected_season_id"] == "season_005"
    assert archive_rows[0]["detected_week"] == "1"
    assert archive_rows[0]["match_status"] == "unmatched"
    assert archive_rows[0]["best_match_id"] is None
    assert match_rows == []


def test_build_video_archive_sorts_weeks_numerically(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    uploads_path = raw_dir / "present_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCpresent",
                    "title": "Present",
                    "canonical_url": "https://www.youtube.com/user/Present",
                    "source_person_names": "PresentLP",
                    "source_team_names": "Prekani",
                    "source_urls": "https://www.youtube.com/user/Present",
                    "raw_path": str(uploads_path).replace("\\", "/"),
                }
            ]
        ),
        encoding="utf-8",
    )
    uploads_path.write_text(
        json.dumps(
            [
                {"videoId": "week11", "title": "GPL S1 Spieltag 11 vs Mortox", "publishedAt": "2014-11-01T10:00:00Z"},
                {"videoId": "week2", "title": "GPL S1 Spieltag 2 vs Mortox", "publishedAt": "2014-09-21T10:00:00Z"},
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_001",
                "match_id": "season_001_schedule_0002",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "2. Spieltag",
                "player_a": "Morbolth",
                "player_b": "PresentLP",
                "team_a": "Mortox",
                "team_b": "Prekani",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_001",
                "match_id": "season_001_schedule_0011",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "11. Spieltag",
                "player_a": "Morbolth",
                "player_b": "PresentLP",
                "team_a": "Mortox",
                "team_b": "Prekani",
                "data_status": "sheet_extracted",
            },
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, _ = build_video_archive(tmp_path)

    assert [row["detected_week"] for row in archive_rows] == ["2", "11"]


def _write_test_csv(path, rows):
    fields = sorted({key for row in rows for key in row}) or ["data_status"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
