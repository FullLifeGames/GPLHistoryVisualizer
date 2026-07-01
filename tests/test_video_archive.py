import csv
import json

from gpl_history.video_archive import (
    build_video_archive,
    channel_candidate_from_url,
    classify_video_type,
    discover_channel_candidates,
    match_video_to_matches,
    parse_gpl_video_title,
    scan_video_archive,
)
from gpl_history.youtube import YouTubeApiError


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


def test_discover_channel_candidates_maps_s10_teilnehmerfeld_handles(tmp_path):
    raw_dir = tmp_path / "raw" / "season_010"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_010",
                "division": "Regular Season",
                "person_id": "person_present",
                "person_name": "PresentLP",
                "team_name": "Prekani",
                "channel_url": "",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_010",
                "division": "Regular Season",
                "person_id": "person_raizor",
                "person_name": "Raizor",
                "team_name": "Unbound Soul",
                "channel_url": "",
                "data_status": "sheet_extracted",
            },
        ],
    )
    (raw_dir / "videos.json").write_text(
        json.dumps(
            [
                {
                    "videoId": "s10_live",
                    "title": "GPL Season 10 - Spieltag 1 - Live Event",
                    "description": "\n".join(
                        [
                            "►Teilnehmerfeld:",
                            "Present:",
                            "https://www.youtube.com/@PresPres",
                            "Raizor:",
                            "https://www.youtube.com/@RaizorDATA",
                            "OST Credits:",
                            "https://www.youtube.com/@Mewmore",
                        ]
                    ),
                }
            ]
        ),
        encoding="utf-8",
    )

    candidates = discover_channel_candidates(tmp_path, include_description_channels=True)

    by_url = {candidate["canonical_url"]: candidate for candidate in candidates}
    assert by_url["https://www.youtube.com/@PresPres"]["source_person_names"] == "PresentLP"
    assert by_url["https://www.youtube.com/@PresPres"]["source_team_names"] == "Prekani"
    assert by_url["https://www.youtube.com/@RaizorDATA"]["source_person_names"] == "Raizor"
    assert by_url["https://www.youtube.com/@RaizorDATA"]["source_team_names"] == "Unbound Soul"
    assert "https://www.youtube.com/@Mewmore" not in by_url


def test_discover_channel_candidates_includes_manual_reaction_channels(tmp_path):
    normalized_dir = tmp_path / "normalized"
    manual_dir = tmp_path / "manual"
    normalized_dir.mkdir()
    manual_dir.mkdir()
    _write_test_csv(normalized_dir / "teams.csv", [])
    _write_test_csv(
        manual_dir / "video_channels.csv",
        [
            {
                "kind": "handle",
                "value": "@theMinehamsterDE",
                "canonical_url": "https://www.youtube.com/@theMinehamsterDE",
                "source_person_names": "theMinehamsterDE",
                "source_seasons": "",
                "source_divisions": "Reaction",
                "source_urls": "https://www.youtube.com/@theMinehamsterDE",
            }
        ],
    )

    candidates = discover_channel_candidates(tmp_path)

    by_url = {candidate["canonical_url"]: candidate for candidate in candidates}
    assert by_url["https://www.youtube.com/@theMinehamsterDE"]["source_person_names"] == "theMinehamsterDE"
    assert by_url["https://www.youtube.com/@theMinehamsterDE"]["source_divisions"] == "Reaction"


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

    semifinal = parse_gpl_video_title("Dieser Kampf entscheidet ALLES! - GPL [S10] - Halbfinale")
    assert semifinal["season_id"] == "season_010"
    assert semifinal["stage"] == "playoffs"
    assert semifinal["round"] == "halbfinale"

    league_two = parse_gpl_video_title("GPL [S5] [Liga 2] - Spieltag 01 - vs. Elekid's Club")
    assert league_two["season_id"] == "season_005"
    assert league_two["week_number"] == 1
    assert league_two["division"] == "Liga 2"

    storyline = parse_gpl_video_title("GPL [S4] - Spieltag 22 - vs. Enteikutierung: Relegation oder Liga 1?")
    assert storyline["division"] is None


def test_parse_gpl_video_title_rejects_udt_false_positive_even_when_title_mentions_gpl():
    parsed = parse_gpl_video_title("GPL Liga 2 Letzter vs GPL Vorjahresletzter | UDT Spieltag 6 VS. Pokgalaxy")

    assert parsed["is_gpl"] is False


def test_parse_gpl_video_title_treats_matchday_as_week_marker():
    parsed = parse_gpl_video_title("Surprise fireworks on the final matchday! GPL Matchday 13 vs. @Bene")

    assert parsed["is_gpl"] is True
    assert parsed["season_id"] is None
    assert parsed["week_number"] == 13
    assert parsed["stage"] == "regular_season"
    assert parsed["video_type"] == "game"


def test_parse_gpl_video_title_detects_hash_prefixed_spieltag_numbers():
    parsed = parse_gpl_video_title("[GPL S9] Kusha macht den Flobert! | Spieltag #05: vs. @Hydronic")

    assert parsed["is_gpl"] is True
    assert parsed["season_id"] == "season_009"
    assert parsed["week_number"] == 5
    assert parsed["video_type"] == "game"


def test_parse_gpl_video_title_detects_plural_english_playoff_rounds():
    parsed = parse_gpl_video_title("There's no turning back now! GPL Playoff Quarterfinals vs. @RaizorDATA")

    assert parsed["is_gpl"] is True
    assert parsed["stage"] == "playoffs"
    assert parsed["round"] == "viertelfinale"
    assert parsed["video_type"] == "game"


def test_parse_gpl_video_title_rejects_gpc_foreign_league_titles():
    parsed = parse_gpl_video_title("Der GPL Kollege! - GPC - Spieltag 2 - vs. @DauniDaunstar")

    assert parsed["is_gpl"] is False


def test_parse_gpl_video_title_rejects_paldea_fabrik_false_positive_titles():
    parsed = parse_gpl_video_title("GPL Teilnehmer in der Paldea-Fabrik!? 💥 Paldea-Fabrik #36")

    assert parsed["is_gpl"] is False


def test_classify_video_type_distinguishes_games_teambuildings_and_other_gpl_videos():
    assert classify_video_type("GPL [S8] Spieltag 3 vs Bene") == "game"
    assert classify_video_type("GPL Showkampf gegen Minetube!") == "showmatch"
    assert classify_video_type("GPL Season 10 Teambuilding - Wackel Backel") == "teambuilding"
    assert classify_video_type("German Pokémon League S7 Team Building mit Draftanalyse") == "teambuilding"
    assert classify_video_type("GPL [S4] - Spieltag 22 - vs. Enteikutierung: Teambuilding!") == "teambuilding"
    assert classify_video_type("GPL Season 2 - Update") == "update"
    assert classify_video_type("GPL Season 4 - Ankündigung") == "announcement"
    assert classify_video_type("Legendäre GPL Kämpfe | Reaction | GPL S1 Raizor vs Fnupa") == "reaction"
    assert classify_video_type("GPL S6 Recap und Rückblick") == "recap"
    assert classify_video_type("GPL gehate von Zuschauern (Spieltag 21) ... meine Meinung!") == "reaction"


    assert classify_video_type('"Curelei ist trash!" - GPL [S9] Rückblick - Spieltag 1') == "recap"


def test_classify_video_type_keeps_match_titles_with_teambuilding_jokes_as_games():
    assert classify_video_type("GPL [S2] - Spieltag 18 - VS. Little Litleos: Teambuilding Fail vom Feinsten") == "game"


def test_classify_video_type_detects_reactions_even_with_week_and_versus():
    assert classify_video_type("Nestfloh schaut GPL | Pokgalaxy vs. BlackLink | GPL-Reaction Spieltag 10") == "reaction"


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


def test_match_video_to_matches_uses_matchday_titles_for_s10_flobert_uploads():
    video = {
        "title": "Surprise fireworks on the final matchday! GPL Matchday 13 vs. @Bene",
        "source_person_names": "Nestfloh",
    }
    matches = [
        {
            "season_id": "season_010",
            "match_id": "season_010_wrong_week",
            "week": "Spieltag 12",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Bene",
            "player_b": "Sirazoa",
            "team_a": "Wackel Backel",
            "team_b": "Sliggoo Gap",
        },
        {
            "season_id": "season_010",
            "match_id": "season_010_nestfloh_bene",
            "week": "Spieltag 13",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Nestfloh",
            "player_b": "Bene",
            "team_a": "Böller Brüder",
            "team_b": "Wackel Backel",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_010_nestfloh_bene"
    assert result["perspective_person"] == "Nestfloh"
    assert result["opponent"] == "Bene"
    assert "week" in result["match_basis"]


def test_match_video_to_matches_uses_source_season_when_title_has_no_season():
    video = {
        "title": "Can I maintain my number 1 position?! GPL Matchday 10 vs. @Pokgalaxy",
        "source_person_names": "Nestfloh",
        "source_seasons": "season_010",
    }
    matches = [
        {
            "season_id": "season_009",
            "match_id": "season_009_wrong",
            "week": "10. Spieltag",
            "stage": "regular_season",
            "division": "Doubles",
            "player_a": "Nestfloh",
            "player_b": "Pokgalaxy",
            "team_a": "Voltwizards",
            "team_b": "Galaxy Gang",
        },
        {
            "season_id": "season_010",
            "match_id": "season_010_right",
            "week": "Spieltag 10",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Pokgalaxy",
            "player_b": "Nestfloh",
            "team_a": "Tails of Mystery",
            "team_b": "Böller Brüder",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_010_right"
    assert "source_season" in result["match_basis"]


def test_match_video_to_matches_rejects_source_season_when_publish_date_is_far_from_match_week():
    video = {
        "title": "GPL - Spieltag 22 - vs. Dancing Darmanitans: #UnluckyShiro",
        "source_person_names": "Cabgolord",
        "source_seasons": "season_002",
        "published_at": "2015-02-15T13:00:00Z",
    }
    matches = [
        {
            "season_id": "season_002",
            "match_id": "season_002_wrong_date",
            "week": "22. Spieltag - Sonntag der 16.08.2015 [12:00 -18:00]",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Cabgolord",
            "player_b": "RegiBang",
            "team_a": "Cabgospot",
            "team_b": "Dancing Darmanitans",
        }
    ]

    assert match_video_to_matches(video, matches) is None


def test_match_video_to_matches_uses_publish_date_to_choose_between_source_seasons():
    video = {
        "title": "GPL - Spieltag 22 - vs. Dancing Darmanitans: #UnluckyShiro",
        "source_person_names": "Cabgolord",
        "source_seasons": "season_001;season_002",
        "published_at": "2015-02-15T13:00:00Z",
    }
    matches = [
        {
            "season_id": "season_001",
            "match_id": "season_001_manual_0022_fnupa_shiro",
            "week": "22. Spieltag - Sonntag der 15.02.2015 [12:00 -17:00]",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Cabgolord",
            "player_b": "Shiro",
            "team_a": "Fnupagladi",
            "team_b": "Dancing Darmanitans",
        },
        {
            "season_id": "season_002",
            "match_id": "season_002_wrong_date",
            "week": "22. Spieltag - Sonntag der 16.08.2015 [12:00 -18:00]",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Cabgolord",
            "player_b": "RegiBang",
            "team_a": "Cabgospot",
            "team_b": "Dancing Darmanitans",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_001_manual_0022_fnupa_shiro"
    assert result["opponent"] == "Shiro"


def test_match_video_to_matches_source_season_and_week_are_enough_for_known_channel():
    video = {
        "title": "I anticipated this tactic, but... GPL Matchday 4 vs. @PresPres",
        "source_person_names": "Nestfloh",
        "source_seasons": "season_010",
    }
    matches = [
        {
            "season_id": "season_010",
            "match_id": "season_010_nestfloh_present",
            "week": "Spieltag 4",
            "stage": "regular_season",
            "division": "Regular Season",
            "player_a": "Nestfloh",
            "player_b": "PresentLP",
            "team_a": "Böller Brüder",
            "team_b": "Prekani",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_010_nestfloh_present"
    assert result["perspective_person"] == "Nestfloh"
    assert result["opponent"] == "PresentLP"


def test_match_video_to_matches_uses_plural_playoff_round_with_source_season():
    video = {
        "title": "There's no turning back now! GPL Playoff Quarterfinals vs. @RaizorDATA",
        "source_person_names": "Nestfloh",
        "source_seasons": "season_010",
    }
    matches = [
        {
            "season_id": "season_010",
            "match_id": "season_010_qf_nestfloh",
            "week": "Viertelfinale",
            "stage": "playoffs",
            "division": "Playoffs",
            "player_a": "Raizor",
            "player_b": "Nestfloh",
            "team_a": "Unbound Soul",
            "team_b": "Böller Brüder",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_010_qf_nestfloh"
    assert result["perspective_person"] == "Nestfloh"
    assert result["opponent"] == "Raizor"
    assert "round" in result["match_basis"]


def test_match_video_to_matches_requires_specific_playoff_round_when_title_has_one():
    matches = [
        {
            "season_id": "season_010",
            "match_id": "season_010_qf_present",
            "week": "Viertelfinale",
            "stage": "playoffs",
            "division": "Playoffs",
            "player_a": "RobinVGC",
            "player_b": "PresentLP",
            "score_a": "0",
            "score_b": "4",
        },
        {
            "season_id": "season_010",
            "match_id": "season_010_sf_present",
            "week": "Halbfinale",
            "stage": "playoffs",
            "division": "Playoffs",
            "player_a": "PresentLP",
            "player_b": "Bene",
            "score_a": "0",
            "score_b": "2",
        },
        {
            "season_id": "season_010",
            "match_id": "season_010_place_3",
            "week": "Spiel um Platz 3",
            "stage": "playoffs",
            "division": "Playoffs",
            "player_a": "PresentLP",
            "player_b": "Minetube",
        },
    ]

    semifinal = match_video_to_matches(
        {
            "title": "Dieser Kampf entscheidet ALLES! - GPL [S10] - Halbfinale",
            "channel_person_name": "PresentLP",
        },
        matches,
    )
    third_place = match_video_to_matches(
        {
            "title": "Mein krassester GPL Kampf JEMALS! - GPL [S10] - Spiel um Platz 3",
            "channel_person_name": "PresentLP",
        },
        matches,
    )

    assert semifinal is not None
    assert semifinal["match_id"] == "season_010_sf_present"
    assert semifinal["opponent"] == "Bene"
    assert "round" in semifinal["match_basis"]
    assert third_place is not None
    assert third_place["match_id"] == "season_010_place_3"
    assert third_place["opponent"] == "Minetube"


def test_match_video_to_matches_rejects_season_week_only_match_without_participant_evidence():
    video = {
        "title": "GPL [S5] - Spieltag 8 - vs. Weavile Got Killed",
        "channel_person_name": "BelmontGabriel",
        "channel_team_name": "Symphonic Swellow",
    }
    matches = [
        {
            "season_id": "season_005",
            "match_id": "season_005_schedule_0026",
            "week": "8. Spieltag - Sonntag der 29.04.2018",
            "stage": "regular_season",
            "division": "Liga 1",
            "player_a": "Minetube",
            "player_b": "Parsifani",
            "team_a": "Triyolotree",
            "team_b": "Aggron Successors",
        }
    ]

    assert match_video_to_matches(video, matches) is None


def test_match_video_to_matches_prefers_channel_person_over_shared_tag_team_name():
    video = {
        "title": "STILLE Wasser sind TIEF?! - GPL [S9] - Spieltag 12 - vs. Toon World",
        "channel_person_name": "Raizor",
        "channel_team_name": "Soulblaze",
    }
    matches = [
        {
            "season_id": "season_009",
            "match_id": "season_009_schedule_0089",
            "week": "12. Spieltag - Sonntag der 10.07.2022",
            "stage": "regular_season",
            "division": "Tag Team",
            "player_a": "PresentLP",
            "player_b": "KingBlex",
            "team_a": "Soulblaze",
            "team_b": "Toon World",
        },
        {
            "season_id": "season_009",
            "match_id": "season_009_schedule_0090",
            "week": "12. Spieltag - Mittwoch der 13.07.2022",
            "stage": "regular_season",
            "division": "Tag Team",
            "player_a": "Raizor",
            "player_b": "OGDNZ",
            "team_a": "Soulblaze",
            "team_b": "Toon World",
        },
    ]

    result = match_video_to_matches(video, matches)

    assert result is not None
    assert result["match_id"] == "season_009_schedule_0090"
    assert result["perspective_person"] == "Raizor"
    assert result["opponent"] == "OGDNZ"


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
    assert match_rows[0]["published_at"] == "2014-09-14T10:00:00Z"
    assert (normalized_dir / "video_urls.txt").read_text(encoding="utf-8").strip() == "https://www.youtube.com/watch?v=abc123"


def test_scan_video_archive_resume_reuses_current_raw_uploads(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()
    uploads_path = raw_dir / "present_uploads.json"

    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_010",
                "person_id": "person_presentlp",
                "person_name": "PresentLP",
                "team_name": "Prekani",
                "channel_url": "https://www.youtube.com/@PresPres",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "matches.csv", [])
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "kind": "handle",
                    "value": "@PresPres",
                    "canonical_url": "https://www.youtube.com/@PresPres",
                    "source_person_names": "PresentLP",
                    "source_team_names": "Prekani",
                    "source_seasons": "season_010",
                    "source_urls": "https://www.youtube.com/@PresPres",
                    "channelId": "UCpresent",
                    "title": "Present",
                    "uploadsPlaylistId": "UUpresent",
                    "status": "available",
                    "video_count": 1,
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
                    "videoId": "present-s10",
                    "title": "GPL S10 Spieltag 1 vs Bene",
                    "publishedAt": "2025-10-05T12:00:00Z",
                    "videoPublishedAt": "2025-10-05T12:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )

    class FailingClient:
        def resolve_channel(self, *args, **kwargs):
            raise AssertionError("cached channel should not be resolved")

        def list_playlist_videos(self, *args, **kwargs):
            raise AssertionError("current raw uploads should not be fetched")

    archive_rows, _ = scan_video_archive(tmp_path, FailingClient(), resume=True)

    assert archive_rows[0]["video_id"] == "present-s10"


def test_scan_video_archive_resume_keeps_stale_raw_uploads_when_refresh_hits_quota(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()
    uploads_path = raw_dir / "tabasco_uploads.json"

    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_004",
                "person_id": "person_tabasco_tv",
                "person_name": "Tabasco TV",
                "team_name": "Insirnapes",
                "channel_url": "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "matches.csv", [])
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "kind": "channel_id",
                    "value": "UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "canonical_url": "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "source_person_names": "Tabasco TV",
                    "source_team_names": "Insirnapes",
                    "source_seasons": "season_004",
                    "source_urls": "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "channelId": "UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "title": "Tabasco TV",
                    "uploadsPlaylistId": "UUIgpF-qa1qagv0Xg2O5_6RQ",
                    "status": "available",
                    "video_count": 1,
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
                    "videoId": "1t9f2nYGEP4",
                    "title": "GPL [S4] - Spieltag 11 - vs. Energie Tobutz: Ich habe euch gewarnt.",
                    "publishedAt": "2017-05-24T12:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )

    class QuotaClient:
        def list_playlist_videos(self, *args, **kwargs):
            raise YouTubeApiError("quota exceeded")

    archive_rows, _ = scan_video_archive(tmp_path, QuotaClient(), resume=True)
    channel_rows = json.loads((raw_dir / "channels.json").read_text(encoding="utf-8"))

    assert archive_rows[0]["video_id"] == "1t9f2nYGEP4"
    assert archive_rows[0]["channel_title"] == "Tabasco TV"
    assert channel_rows[0]["status"] == "available"
    assert channel_rows[0]["raw_path"] == str(uploads_path).replace("\\", "/")
    assert "refresh_error" in channel_rows[0]


def test_scan_video_archive_resume_recovers_existing_channel_id_uploads_when_raw_path_was_lost(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()
    uploads_path = raw_dir / "ucigpf_qa1qagv0xg2o5_6rq_uploads.json"

    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_004",
                "person_id": "person_tabasco_tv",
                "person_name": "Tabasco TV",
                "team_name": "Insirnapes",
                "channel_url": "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "matches.csv", [])
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "kind": "channel_id",
                    "value": "UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "canonical_url": "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "source_person_names": "Tabasco TV",
                    "source_team_names": "Insirnapes",
                    "source_seasons": "season_004",
                    "source_urls": "https://www.youtube.com/channel/UCIgpF-qa1qagv0Xg2O5_6RQ",
                    "status": "unavailable",
                    "error": "quota exceeded",
                    "video_count": 0,
                    "raw_path": None,
                }
            ]
        ),
        encoding="utf-8",
    )
    uploads_path.write_text(
        json.dumps(
            [
                {
                    "videoId": "1t9f2nYGEP4",
                    "title": "GPL [S4] - Spieltag 11 - vs. Energie Tobutz: Ich habe euch gewarnt.",
                    "publishedAt": "2017-05-24T12:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )

    class QuotaClient:
        def resolve_channel(self, *args, **kwargs):
            raise YouTubeApiError("quota exceeded")

    archive_rows, _ = scan_video_archive(tmp_path, QuotaClient(), resume=True)
    channel_rows = json.loads((raw_dir / "channels.json").read_text(encoding="utf-8"))

    assert archive_rows[0]["video_id"] == "1t9f2nYGEP4"
    assert archive_rows[0]["channel_title"] == "Tabasco TV"
    assert channel_rows[0]["status"] == "available"
    assert channel_rows[0]["raw_path"] == str(uploads_path).replace("\\", "/")
    assert "refresh_error" in channel_rows[0]


def test_build_video_archive_applies_manual_reference_videos_to_matches(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    manual_dir = tmp_path / "manual"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()
    manual_dir.mkdir()

    uploads_path = raw_dir / "present_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCpresent",
                    "title": "Present",
                    "canonical_url": "https://www.youtube.com/@PresPres",
                    "source_person_names": "PresentLP",
                    "source_team_names": "Prekani",
                    "source_urls": "https://www.youtube.com/@PresPres",
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
                    "videoId": "0UElsZUhmV8",
                    "title": "Das BESTE Pokémon Turnier geht los! (GPL S10 LIVE EVENT)",
                    "publishedAt": "2025-10-04T10:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        manual_dir / "video_archive.csv",
        [
            {
                "video_id": "25cLVY-vNDg",
                "title": "GPL S10 Finale Stream",
                "video_type": "livestream",
                "detected_season_id": "season_010",
                "detected_stage": "playoffs",
                "detected_round": "finale",
                "source_urls": "https://www.youtube.com/watch?v=25cLVY-vNDg",
            }
        ],
    )
    _write_test_csv(
        manual_dir / "video_references.csv",
        [
            {
                "video_id": "0UElsZUhmV8",
                "season_id": "season_010",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "Spieltag 1",
                "video_type": "reference",
                "confidence": "100",
                "match_basis": "manual_reference",
            },
            {
                "video_id": "25cLVY-vNDg",
                "season_id": "season_010",
                "division": "Playoffs",
                "stage": "playoffs",
                "week": "Finale",
                "video_type": "livestream",
                "confidence": "100",
                "match_basis": "manual_final_stream",
            },
        ],
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_010",
                "match_id": "season_010_schedule_0001",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "Spieltag 1",
                "player_a": "Bene",
                "player_b": "Dauni",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_010",
                "match_id": "season_010_schedule_0002",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "Spieltag 1",
                "player_a": "Raizor",
                "player_b": "PresentLP",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_010",
                "match_id": "season_010_schedule_final",
                "division": "Playoffs",
                "stage": "playoffs",
                "week": "Finale",
                "player_a": "Bene",
                "player_b": "Raizor",
                "data_status": "sheet_extracted",
            },
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)
    match_reference_keys = {(row["video_id"], row["match_id"]): row for row in match_rows}

    assert "25cLVY-vNDg" in {row["video_id"] for row in archive_rows}
    assert match_reference_keys[("0UElsZUhmV8", "season_010_schedule_0001")]["video_type"] == "reference"
    assert match_reference_keys[("0UElsZUhmV8", "season_010_schedule_0002")]["video_type"] == "reference"
    assert match_reference_keys[("25cLVY-vNDg", "season_010_schedule_final")]["video_type"] == "livestream"


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


def test_build_video_archive_treats_manual_reaction_channels_as_reactions(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    uploads_path = raw_dir / "reaction_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCreaction",
                    "title": "Hamster",
                    "canonical_url": "https://www.youtube.com/channel/UCreaction",
                    "source_person_names": "theMinehamsterDE",
                    "source_divisions": "Reaction",
                    "source_urls": "https://www.youtube.com/@theMinehamsterDE",
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
                    "videoId": "reaction-week",
                    "title": "Das ist KEIN Despotar! | GPL Schau Season X Spieltag 10",
                    "publishedAt": "2025-12-18T05:01:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_010",
                "match_id": "season_010_schedule_0010",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "Spieltag 10",
                "player_a": "Blocki",
                "player_b": "RobinVGC",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert archive_rows[0]["video_type"] == "reaction"
    assert archive_rows[0]["match_status"] == "reaction"
    assert archive_rows[0]["best_match_id"] is None
    assert match_rows == []


def test_build_video_archive_merges_duplicate_channel_context_before_matching(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    uploads_path = raw_dir / "blocki_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCblocki",
                    "title": "Blocki",
                    "canonical_url": "https://www.youtube.com/c/Blocki",
                    "source_person_names": "Blocki",
                    "source_team_names": "Kastanienbomber",
                    "source_seasons": "season_008",
                    "source_urls": "https://www.youtube.com/c/Blocki",
                    "raw_path": str(uploads_path).replace("\\", "/"),
                },
                {
                    "channelId": "UCblocki",
                    "title": "Blocki",
                    "canonical_url": "https://www.youtube.com/user/Blocki",
                    "source_person_names": "Blocki",
                    "source_team_names": "Voltwizards",
                    "source_seasons": "season_010",
                    "source_urls": "https://www.youtube.com/user/Blocki",
                    "raw_path": str(uploads_path).replace("\\", "/"),
                },
            ]
        ),
        encoding="utf-8",
    )
    uploads_path.write_text(
        json.dumps(
            [
                {
                    "videoId": "blocki_s10_bene",
                    "title": "Alles laeuft nach Plan! | GPL Spieltag 09 vs. @Bene",
                    "publishedAt": "2025-11-30T15:00:45Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_008",
                "match_id": "season_008_present_bene",
                "division": "Liga 1",
                "stage": "regular_season",
                "week": "9. Spieltag",
                "player_a": "PresentLP",
                "player_b": "Bene",
                "team_a": "Prekani",
                "team_b": "Victini Bottom",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_010",
                "match_id": "season_010_blocki_bene",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "Spieltag 9",
                "player_a": "Blocki",
                "player_b": "Bene",
                "team_a": "Kastanienbomber",
                "team_b": "Wackel Backel",
                "data_status": "sheet_extracted",
            },
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert archive_rows[0]["detected_season_id"] == "season_010"
    assert archive_rows[0]["best_match_id"] == "season_010_blocki_bene"
    assert archive_rows[0]["source_seasons"] == "season_008;season_010"
    assert match_rows[0]["season_id"] == "season_010"


def test_build_video_archive_skips_manual_false_positive_videos(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    manual_dir = tmp_path / "manual"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()
    manual_dir.mkdir()

    uploads_path = raw_dir / "raizor_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCraizor",
                    "title": "Raizor",
                    "canonical_url": "https://www.youtube.com/user/RaizorZockt",
                    "source_person_names": "Raizor",
                    "source_team_names": "Raizoroark",
                    "source_seasons": "season_001",
                    "source_urls": "https://www.youtube.com/user/RaizorZockt",
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
                    "videoId": "lpk0yS8pg88",
                    "title": "GPL - Spieltag 2 - vs. Prekani : Arkani die schnelle Sau",
                    "publishedAt": "2014-09-21T15:03:34Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        manual_dir / "video_exclusions.csv",
        [
            {
                "video_id": "lpk0yS8pg88",
                "reason": "false positive GPL video",
                "source_urls": "https://www.youtube.com/watch?v=lpk0yS8pg88",
            }
        ],
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_001",
                "match_id": "season_001_schedule_0045",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "2. Spieltag",
                "player_a": "PresentLP",
                "player_b": "Raizor",
                "team_a": "Prekani",
                "team_b": "Raizoroark",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert archive_rows == []
    assert match_rows == []


def test_build_video_archive_can_reclassify_excluded_raw_showmatch_as_manual_archive_row(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    manual_dir = tmp_path / "manual"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()
    manual_dir.mkdir()

    uploads_path = raw_dir / "bene_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "channelId": "UCbene",
                    "title": "Bene",
                    "canonical_url": "https://www.youtube.com/@Bene",
                    "source_person_names": "Bene",
                    "source_team_names": "Wackel Backel",
                    "source_seasons": "season_010",
                    "source_urls": "https://www.youtube.com/@Bene",
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
                    "videoId": "LcW38V5_oPQ",
                    "title": "GPL Showkampf gegen Minetube!",
                    "publishedAt": "2021-05-18T16:00:10Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        manual_dir / "video_exclusions.csv",
        [
            {
                "video_id": "LcW38V5_oPQ",
                "reason": "manual_reclassified_showmatch",
                "source_urls": "https://www.youtube.com/watch?v=LcW38V5_oPQ",
            }
        ],
    )
    _write_test_csv(
        manual_dir / "video_archive.csv",
        [
            {
                "video_id": "LcW38V5_oPQ",
                "video_url": "https://www.youtube.com/watch?v=LcW38V5_oPQ",
                "title": "GPL Showkampf gegen Minetube!",
                "video_type": "showmatch",
                "published_at": "2021-05-18T16:00:10Z",
                "channel_title": "Bene",
                "channel_url": "https://www.youtube.com/@Bene",
                "source_person_names": "Bene",
                "source_seasons": "season_008",
                "detected_season_id": "season_008",
                "detected_stage": "regular_season",
                "match_status": "showmatch",
                "perspective_person": "Bene",
                "opponent": "Minetube",
                "source_urls": "https://www.youtube.com/watch?v=LcW38V5_oPQ;https://www.youtube.com/@Bene",
            }
        ],
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_010",
                "match_id": "season_010_schedule_0031",
                "division": "Regular Season",
                "stage": "regular_season",
                "week": "Spieltag 4",
                "player_a": "Minetube",
                "player_b": "Bene",
                "team_a": "Backel Gefackel",
                "team_b": "Wackel Backel",
                "data_status": "sheet_extracted",
            }
        ],
    )
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert len(archive_rows) == 1
    assert archive_rows[0]["video_id"] == "LcW38V5_oPQ"
    assert archive_rows[0]["video_type"] == "showmatch"
    assert archive_rows[0]["detected_season_id"] == "season_008"
    assert archive_rows[0]["match_status"] == "showmatch"
    assert match_rows == []


def test_build_video_archive_infers_preseason_s1_videos_from_publish_date(tmp_path):
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
                    "title": "PresentLP",
                    "canonical_url": "https://www.youtube.com/user/PresentLP",
                    "source_person_names": "PresentLP",
                    "source_team_names": "Prekani",
                    "source_seasons": "season_001;season_002;season_003",
                    "source_urls": "https://www.youtube.com/user/PresentLP",
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
                    "videoId": "RtEBA9VGr0g",
                    "title": "GPL Teaser [31.08.2014] | PresentLP",
                    "publishedAt": "2014-08-24T13:00:04Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "seasons.csv",
        [
            {
                "season_id": "season_001",
                "start_date": "2014-09-14T10:00:06Z",
                "end_date": "2015-02-15T15:00:01Z",
            },
            {
                "season_id": "season_002",
                "start_date": "2015-03-15T12:23:13Z",
                "end_date": "2015-09-20T17:20:26Z",
            },
        ],
    )
    _write_test_csv(normalized_dir / "matches.csv", [])
    _write_test_csv(normalized_dir / "teams.csv", [])

    archive_rows, match_rows = build_video_archive(tmp_path)

    assert len(archive_rows) == 1
    assert archive_rows[0]["video_id"] == "RtEBA9VGr0g"
    assert archive_rows[0]["detected_season_id"] == "season_001"
    assert archive_rows[0]["match_status"] == "other"
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


def test_build_video_archive_uses_current_shared_channel_metadata_for_matching(tmp_path):
    raw_dir = tmp_path / "raw" / "video_archive"
    normalized_dir = tmp_path / "normalized"
    raw_dir.mkdir(parents=True)
    normalized_dir.mkdir()

    team_mauni_uploads = raw_dir / "team_mauni_uploads.json"
    bene_uploads = raw_dir / "bene_uploads.json"
    (raw_dir / "channels.json").write_text(
        json.dumps(
            [
                {
                    "kind": "username",
                    "value": "TeamMauni",
                    "channelId": "UCteammauni",
                    "title": "Team Mauni",
                    "canonical_url": "https://www.youtube.com/user/TeamMauni",
                    "source_person_ids": "person_maxi_von_vogel",
                    "source_person_names": "Maxi von Vogel",
                    "source_team_names": "Lazycakes;Youngstars",
                    "source_seasons": "season_006",
                    "source_urls": "https://www.youtube.com/user/TeamMauni",
                    "raw_path": str(team_mauni_uploads).replace("\\", "/"),
                },
                {
                    "kind": "handle",
                    "value": "@Bene",
                    "channelId": "UCbene",
                    "title": "Bene",
                    "canonical_url": "https://www.youtube.com/@Bene",
                    "source_person_ids": "person_bene",
                    "source_person_names": "Bene",
                    "source_team_names": "Kleinsteins;Gate",
                    "source_seasons": "season_006",
                    "source_urls": "https://www.youtube.com/@Bene",
                    "raw_path": str(bene_uploads).replace("\\", "/"),
                },
            ]
        ),
        encoding="utf-8",
    )
    team_mauni_uploads.write_text(
        json.dumps(
            [
                {
                    "videoId": "GLuc2UqeYjg",
                    "title": "Der Minetube-Kader und die Minetube-Plays! - GPL [S6] - Spieltag 08 - VS. Triyolotree | Maxi",
                    "publishedAt": "2019-06-02T15:00:04Z",
                },
                {
                    "videoId": "7h5D7AOsc9w",
                    "title": "Das Hit or Miss Festival - GPL [S6] - Spieltag 08 - vs. KleinSteins; Gate | Dauni",
                    "publishedAt": "2019-06-05T14:00:01Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    bene_uploads.write_text(
        json.dumps(
            [
                {
                    "videoId": "66SCMFW272E",
                    "title": "GPL [S6] - Spieltag 08 - vs. Lazycakes: Triff!",
                    "publishedAt": "2019-06-05T14:00:00Z",
                }
            ]
        ),
        encoding="utf-8",
    )
    _write_test_csv(
        normalized_dir / "matches.csv",
        [
            {
                "season_id": "season_006",
                "match_id": "season_006_schedule_0034",
                "division": "Sun Conference",
                "stage": "regular_season",
                "week": "8. Spieltag - Sonntag der 02.06.2019",
                "player_a": "Minetube",
                "player_b": "Maxi von Vogel",
                "team_a": "",
                "team_b": "",
                "score_a": "0",
                "score_b": "1",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_006",
                "match_id": "season_006_schedule_0098",
                "division": "Moon Conference",
                "stage": "regular_season",
                "week": "8. Spieltag - Mittwoch der 05.06.2019",
                "player_a": "Dauni",
                "player_b": "Bene",
                "team_a": "",
                "team_b": "",
                "score_a": "3",
                "score_b": "0",
                "data_status": "sheet_extracted",
            },
        ],
    )
    _write_test_csv(
        normalized_dir / "teams.csv",
        [
            {
                "season_id": "season_006",
                "person_id": "person_maxi_von_vogel",
                "person_name": "Maxi von Vogel",
                "team_name": "Youngstars",
                "division": "Sun Conference",
                "channel_url": "https://www.youtube.com/user/TeamMauni",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_006",
                "person_id": "person_dauni_daunstar",
                "person_name": "Dauni",
                "team_name": "Lazycakes",
                "division": "Moon Conference",
                "channel_url": "https://www.youtube.com/user/TeamMauni",
                "data_status": "sheet_extracted",
            },
            {
                "season_id": "season_006",
                "person_id": "person_bene",
                "person_name": "Bene",
                "team_name": "Kleinsteins;Gate",
                "division": "Moon Conference",
                "channel_url": "https://www.youtube.com/@Bene",
                "data_status": "sheet_extracted",
            },
        ],
    )

    archive_rows, match_rows = build_video_archive(tmp_path)

    archive_by_id = {row["video_id"]: row for row in archive_rows}
    assert archive_by_id["7h5D7AOsc9w"]["source_person_names"] == "Maxi von Vogel"
    assert archive_by_id["7h5D7AOsc9w"]["best_match_id"] == "season_006_schedule_0098"
    assert archive_by_id["7h5D7AOsc9w"]["perspective_person"] == "Dauni"
    assert archive_by_id["GLuc2UqeYjg"]["best_match_id"] == "season_006_schedule_0034"
    assert archive_by_id["GLuc2UqeYjg"]["perspective_person"] == "Maxi von Vogel"
    assert archive_by_id["66SCMFW272E"]["best_match_id"] == "season_006_schedule_0098"
    assert {
        (row["video_id"], row["match_id"], row["perspective_person"], row["opponent"])
        for row in match_rows
    } == {
        ("GLuc2UqeYjg", "season_006_schedule_0034", "Maxi von Vogel", "Minetube"),
        ("7h5D7AOsc9w", "season_006_schedule_0098", "Dauni", "Bene"),
        ("66SCMFW272E", "season_006_schedule_0098", "Bene", "Dauni"),
    }


def _write_test_csv(path, rows):
    fields = sorted({key for row in rows for key in row}) or ["data_status"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
