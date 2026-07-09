import csv
from pathlib import Path

from gpl_history.aggregates import _week_sort, build_and_write_aggregates, person_all_time_rows, pokemon_all_time_rows


def test_week_sort_ranks_both_matchday_spellings_and_playoff_rounds():
    # Seasons 1-9 write "7. Spieltag", season 10 writes "Spieltag 7".
    assert _week_sort("1. Spieltag - Sonntag der 14.09.2014 [12:00 -17:00]", "regular_season") == 1
    assert _week_sort("18. Spieltag – Sonntag der 18.01.2015", "regular_season") == 18
    assert _week_sort("Spieltag 1", "regular_season") == 1
    assert _week_sort("Spieltag 13", "regular_season") == 13

    # Playoff rounds rank after every matchday, in the order they are played.
    assert _week_sort("Playoffs - Vorrunde - Sonntag der 07.07.2019", "playoffs") == 100
    assert _week_sort("Playoffs - Viertelfinale - Sonntag der 14.07.2019", "playoffs") == 110
    assert _week_sort("Halbfinale", "playoffs") == 120
    assert _week_sort("Playoffs - Spiel um Platz 3 - Samstag der 27.07.2019", "playoffs") == 130
    assert _week_sort("Playoffs - Finale - Sonntag der 28.07.2019", "playoffs") == 140
    assert _week_sort("Playoffs", "playoffs") == 150
    assert _week_sort("", "regular_season") == 999


def test_week_sort_does_not_read_a_date_as_a_matchday_number():
    # "07.07.2019" once made the Vorrunde sort as matchday 7, ahead of the
    # regular season it follows.
    assert _week_sort("Playoffs - Vorrunde - Sonntag der 07.07.2019", "playoffs") > 99
    # "Spiel um Platz 3" must not be read as matchday 3.
    assert _week_sort("Playoffs - Spiel um Platz 3 - Samstag der 27.07.2019", "playoffs") > 99


def test_build_and_write_aggregates_writes_person_pokemon_matchup_roster_and_story_rows(tmp_path):
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "person_stints.csv",
        [
            {
                "season_id": "season_010",
                "person_id": "person_bene",
                "person_name": "Bene",
                "team_name": "Wackel Backel",
                "division": "Liga 1",
                "rank": "1",
                "matches": "2",
                "wins": "2",
                "losses": "0",
                "draws": "0",
                "points": "6",
                "kills": "11",
                "deaths": "4",
                "differential": "7",
                "source_urls": "https://sheet.test/standings",
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
                "source_urls": "https://sheet.test/final",
            }
        ],
    )
    _write_csv(
        normalized / "matches.csv",
        [
            {
                "season_id": "season_010",
                "match_id": "m1",
                "division": "Liga 1",
                "player_a": "Bene",
                "player_b": "Minetube",
                "score_a": "5",
                "score_b": "0",
                "winner": "Bene",
                "source_urls": "https://sheet.test/m1",
            },
            {
                "season_id": "season_010",
                "match_id": "m2",
                "division": "Playoffs",
                "player_a": "Bene",
                "player_b": "Minetube",
                "score_a": "6",
                "score_b": "4",
                "winner": "Bene",
                "source_urls": "https://sheet.test/m2",
            },
        ],
    )
    _write_csv(
        normalized / "pokemon_killlists.csv",
        [
            {
                "season_id": "season_010",
                "division": "Playoffs",
                "pokemon": "UHaFnir",
                "pokemon_normalized": "uhafnir",
                "trainer": "Bene",
                "team_name": "Wackel Backel",
                "appearances": "2",
                "kills": "9",
                "source_urls": "https://sheet.test/kills",
            }
        ],
    )
    _write_csv(
        normalized / "team_rosters.csv",
        [
            {
                "season_id": "season_010",
                "division": "Playoffs",
                "team_name": "Wackel Backel",
                "person_name": "Bene",
                "pokemon": "UHaFnir",
                "pokemon_normalized": "uhafnir",
                "slot": "1",
                "source_urls": "https://sheet.test/roster",
            },
            {
                "season_id": "season_010",
                "division": "Playoffs",
                "team_name": "Wackel Backel",
                "person_name": "Bene",
                "pokemon": "Arkani",
                "pokemon_normalized": "arkani",
                "slot": "2",
                "source_urls": "https://sheet.test/roster",
            },
        ],
    )
    _write_csv(
        normalized / "pokemon_draft_overview.csv",
        [
            {
                "pokemon": "UHaFnir",
                "pokemon_normalized": "uhafnir",
                "tier_rank": "120",
                "draft_count": "3",
                "title_count": "1",
                "source_urls": "https://sheet.test/draft",
            },
            {
                "pokemon": "Arkani",
                "pokemon_normalized": "arkani",
                "tier_rank": "180",
                "draft_count": "2",
                "title_count": "1",
                "source_urls": "https://sheet.test/draft",
            },
        ],
    )
    _write_csv(
        normalized / "data_quality.csv",
        [
            {
                "season_id": "season_010",
                "quality_score": "90",
                "match_rows": "2",
                "killlist_rows": "1",
                "video_rows": "2",
                "review_flags": "low_confidence_videos",
                "source_urls": "https://sheet.test/quality",
            }
        ],
    )
    _write_csv(
        normalized / "video_archive.csv",
        [
            {
                "detected_season_id": "season_010",
                "video_type": "game",
                "match_status": "matched",
                "source_urls": "https://youtube.test/v",
            },
            {
                "detected_season_id": "",
                "video_type": "other",
                "match_status": "unmatched",
                "source_urls": "https://youtube.test/unscoped",
            }
        ],
    )

    counts = build_and_write_aggregates(tmp_path)

    assert counts == {
        "person_all_time": 2,
        "pokemon_all_time": 1,
        "matchup_summary": 2,
        "roster_scores": 1,
        "season_storylines": 1,
    }
    assert _read_csv(normalized / "person_all_time.csv")[0] == {
        "person_id": "person_bene",
        "person_name": "Bene",
        "seasons": "1",
        "season_list": "S10",
        "seasons_won": "1",
        "title_seasons": "S10",
        "matches": "2",
        "wins": "2",
        "losses": "0",
        "draws": "0",
        "win_pct": "100.0",
        "weighted_rating": "44.4",
        "elo": "1531",
        "points": "6",
        "kills": "11",
        "deaths": "4",
        "differential": "7",
        "best_rank": "1",
        "source_urls": "https://sheet.test/final;https://sheet.test/m1;https://sheet.test/m2;https://sheet.test/standings",
    }
    pokemon_all_time = _read_csv(normalized / "pokemon_all_time.csv")[0]
    assert pokemon_all_time["titles"] == "1"
    assert "deaths" not in pokemon_all_time
    assert "differential" not in pokemon_all_time
    assert _read_csv(normalized / "matchup_summary.csv")[0]["matches"] == "2"
    assert _read_csv(normalized / "roster_scores.csv")[0]["pokemon_count"] == "2"
    assert _read_csv(normalized / "season_storylines.csv")[0]["top_pokemon"] == "UHaFnir"


def test_pokemon_all_time_rows_uses_canonical_split_and_playoff_killlists():
    rows = pokemon_all_time_rows(
        [
            {
                "season_id": "season_009",
                "division": "Overall",
                "pokemon": "Demeteros-T",
                "pokemon_normalized": "demeteros t",
                "trainer": "",
                "team_name": "Scherzkekse",
                "appearances": "23",
                "kills": "19",
                "source_urls": "s9-overall",
            },
            {
                "season_id": "season_009",
                "division": "Singles",
                "pokemon": "Demeteros-T",
                "pokemon_normalized": "demeteros t",
                "trainer": "Dauni Daunstar",
                "team_name": "Scherzkekse",
                "appearances": "13",
                "kills": "12",
                "source_urls": "s9-singles",
            },
            {
                "season_id": "season_009",
                "division": "Doubles",
                "pokemon": "Demeteros-T",
                "pokemon_normalized": "demeteros t",
                "trainer": "Hydronic",
                "team_name": "Scherzkekse",
                "appearances": "10",
                "kills": "7",
                "source_urls": "s9-doubles",
            },
            {
                "season_id": "season_010",
                "division": "Playoffs",
                "pokemon": "Demeteros-T",
                "pokemon_normalized": "demeteros t",
                "trainer": "PresentLP",
                "team_name": "",
                "appearances": "12",
                "kills": "14",
                "source_urls": "s10-playoffs",
            },
            {
                "season_id": "season_010",
                "division": "Regular Season",
                "pokemon": "Demeteros-T",
                "pokemon_normalized": "demeteros t",
                "trainer": "PresentLP",
                "team_name": "Prekani",
                "appearances": "10",
                "kills": "11",
                "source_urls": "s10-regular",
            },
            {
                "season_id": "season_010",
                "division": "Regular Season",
                "pokemon": "Glurak",
                "pokemon_normalized": "glurak",
                "trainer": "PresentLP",
                "team_name": "Prekani",
                "appearances": "10",
                "kills": "5",
                "source_urls": "s10-regular-only",
            },
        ],
        [],
    )

    by_pokemon = {row["pokemon_normalized"]: row for row in rows}
    assert by_pokemon["demeteros t"]["kills"] == "33"
    assert by_pokemon["demeteros t"]["appearances"] == "35"
    assert "deaths" not in by_pokemon["demeteros t"]
    assert "differential" not in by_pokemon["demeteros t"]
    assert by_pokemon["demeteros t"]["source_urls"] == "s10-playoffs;s9-overall"
    assert by_pokemon["glurak"]["kills"] == "5"


def test_pokemon_all_time_rows_merges_draft_history_for_display_seasons():
    rows = pokemon_all_time_rows(
        [
            {
                "season_id": "season_002",
                "division": "Regular Season",
                "pokemon": "Stalobor",
                "pokemon_normalized": "stalobor",
                "trainer": "Scherany",
                "team_name": "",
                "kills": "5",
                "source_urls": "s2-kills",
            },
        ],
        [],
        [
            {
                "pokemon": "Stalobor",
                "pokemon_normalized": "stalobor",
                "picked_status": "picked",
                "season_list": "S1, S2",
                "title_seasons": "S1",
                "source_urls": "draft-history",
            },
            {
                "pokemon": "Arkani",
                "pokemon_normalized": "arkani",
                "picked_status": "picked",
                "season_list": "S1",
                "title_seasons": "S1",
                "source_urls": "draft-only",
            },
        ],
    )

    by_pokemon = {row["pokemon_normalized"]: row for row in rows}
    assert by_pokemon["stalobor"]["kills"] == "5"
    assert by_pokemon["stalobor"]["seasons"] == 2
    assert by_pokemon["stalobor"]["season_list"] == "S1, S2"
    assert by_pokemon["stalobor"]["titles"] == 1
    assert by_pokemon["stalobor"]["title_seasons"] == "S1"
    assert by_pokemon["stalobor"]["source_urls"] == "draft-history;s2-kills"
    assert "arkani" not in by_pokemon


def test_build_and_write_aggregates_uses_normalized_person_aliases(tmp_path):
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "people.csv",
        [
            {
                "person_id": "person_daumenkino",
                "person_name": "DaumenkinoLP",
            },
            {
                "person_id": "person_art_n_gaming",
                "person_name": "Art'n'Gaming",
            },
        ],
    )
    _write_csv(
        normalized / "person_stints.csv",
        [
            {
                "season_id": "season_001",
                "person_id": "person_daumenkino",
                "person_name": "DaumenkinoLP",
                "matches": "1",
                "wins": "1",
                "losses": "0",
                "draws": "0",
            }
        ],
    )
    _write_csv(normalized / "champions.csv", [])
    _write_csv(
        normalized / "matches.csv",
        [
            {
                "season_id": "season_001",
                "match_id": "m1",
                "player_a": "TheHerbertLP",
                "player_b": "TJLH100",
                "winner": "TheHerbertLP",
                "source_urls": "https://sheet.test/m1",
            }
        ],
    )
    _write_csv(normalized / "pokemon_killlists.csv", [])
    _write_csv(normalized / "team_rosters.csv", [])
    _write_csv(normalized / "pokemon_draft_overview.csv", [])
    _write_csv(normalized / "data_quality.csv", [])
    _write_csv(normalized / "video_archive.csv", [])

    build_and_write_aggregates(tmp_path)

    person_rows = _read_csv(normalized / "person_all_time.csv")
    matchup_rows = _read_csv(normalized / "matchup_summary.csv")
    assert {row["person_id"] for row in person_rows} == {"person_daumenkino", "person_art_n_gaming"}
    assert any(row["person_id"] == "person_daumenkino" and row["person_name"] == "DaumenkinoLP" for row in person_rows)
    assert any(row["person_id"] == "person_art_n_gaming" and row["person_name"] == "Art'n'Gaming" for row in person_rows)
    assert {row["person_id"] for row in matchup_rows} == {"person_daumenkino", "person_art_n_gaming"}
    assert {row["opponent_id"] for row in matchup_rows} == {"person_daumenkino", "person_art_n_gaming"}


def test_person_all_time_counts_match_only_players_without_standings():
    rows = person_all_time_rows(
        people=[
            {"person_id": "person_burakio", "person_name": "Burakio"},
            {"person_id": "person_killuasan", "person_name": "KilluaSan"},
            {"person_id": "person_standing_player", "person_name": "Standing Player"},
        ],
        stints=[
            {
                "season_id": "season_003",
                "person_id": "person_standing_player",
                "person_name": "Standing Player",
                "rank": "1",
                "matches": "2",
                "wins": "2",
                "losses": "0",
                "draws": "0",
                "source_urls": "standing-source",
            }
        ],
        champions=[],
        matches=[
            {
                "season_id": "season_003",
                "match_id": "m1",
                "player_a": "Burakio",
                "player_b": "KilluaSan",
                "winner": "Burakio",
                "score_a": "3",
                "score_b": "0",
                "source_urls": "match-source-1",
            },
            {
                "season_id": "season_003",
                "match_id": "m2",
                "player_a": "Standing Player",
                "player_b": "Burakio",
                "winner": "Standing Player",
                "score_a": "2",
                "score_b": "0",
                "source_urls": "match-source-2",
            },
        ],
    )

    by_id = {row["person_id"]: row for row in rows}
    assert by_id["person_burakio"]["matches"] == "2"
    assert by_id["person_burakio"]["wins"] == "1"
    assert by_id["person_burakio"]["losses"] == "1"
    assert by_id["person_burakio"]["season_list"] == "S3"
    assert by_id["person_killuasan"]["matches"] == "1"
    assert by_id["person_killuasan"]["losses"] == "1"
    assert by_id["person_standing_player"]["matches"] == "2"


def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    fields = sorted({key for row in rows for key in row}) or ["data_status"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))
