import csv
from pathlib import Path

from gpl_history.aggregates import _elo_by_person, build_and_write_aggregates
from gpl_history.records import (
    AWARD_FIELDS,
    RECORDS_PROGRESSION_FIELDS,
    STREAK_FIELDS,
    award_rows,
    records_progression_rows,
    streak_rows,
)


def _write_csv(path: Path, rows: list[dict]) -> None:
    fields = sorted({key for row in rows for key in row})
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _read_header(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return next(csv.reader(handle))


def _match(mid, week, a, b, winner, **extra):
    row = {
        "season_id": "season_001",
        "match_id": mid,
        "week": week,
        "stage": "Regular Season",
        "player_a": a,
        "player_b": b,
        "winner": winner,
        "data_status": "available",
    }
    row.update(extra)
    return row


def test_elo_on_match_reports_pregame_and_postgame_values():
    seen = []
    _elo_by_person(
        [_match("m1", "1", "Anna", "Ben", "Anna"), _match("m2", "2", "Anna", "Ben", "Anna")],
        on_match=lambda row, details: seen.append((row["match_id"], details)),
    )
    assert [mid for mid, _ in seen] == ["m1", "m2"]
    first = seen[0][1]
    assert first["left_before"] == 1500 and first["left_expected"] == 0.5
    assert round(first["left_after"]) == 1516
    assert first["left_key"] and first["right_key"]
    assert round(seen[1][1]["left_before"]) == 1516


def test_elo_on_match_skips_unrated_rows():
    seen = []
    _elo_by_person(
        [
            _match("m1", "1", "Anna", "", "Anna"),
            _match("m2", "2", "Anna", "Ben", "Anna", data_status="source_video_only"),
        ],
        on_match=lambda row, details: seen.append(row["match_id"]),
    )
    assert seen == []


def test_streak_rows_emits_win_unbeaten_and_sweep_streaks():
    matches = [
        _match("m1", "1", "Anna", "Ben", "Anna", score_a="6", score_b="0", source_urls="u1"),
        _match("m2", "2", "Anna", "Cid", "Anna", score_a="6", score_b="0", source_urls="u2"),
        _match("m3", "3", "Anna", "Ben", "Anna", score_a="2", score_b="0", source_urls="u3"),
        _match("m4", "4", "Anna", "Cid", "", result_basis="draw"),
        _match("m5", "5", "Anna", "Ben", "Ben", score_a="0", score_b="1"),
    ]
    rows = streak_rows(matches)
    win = [r for r in rows if r["person_name"] == "Anna" and r["streak_type"] == "win"]
    assert len(win) == 1 and win[0]["length"] == 3
    assert win[0]["start_match_id"] == "m1" and win[0]["end_match_id"] == "m3"
    assert win[0]["start_week"] == "1" and win[0]["end_week"] == "3"
    assert win[0]["active"] == 0
    assert "u1" in win[0]["source_urls"] and "u3" in win[0]["source_urls"]
    unbeaten = [r for r in rows if r["person_name"] == "Anna" and r["streak_type"] == "unbeaten"]
    assert len(unbeaten) == 1 and unbeaten[0]["length"] == 4  # three wins + draw
    sweeps = [r for r in rows if r["streak_type"] == "sweep"]
    assert len(sweeps) == 1 and sweeps[0]["length"] == 2  # m1+m2 were 6:0
    assert sweeps[0]["person_name"] == "Anna"


def test_streak_rows_marks_running_streaks_active():
    rows = streak_rows([_match(f"m{i}", str(i), "Anna", "Ben", "Ben") for i in range(1, 5)])
    loss = [r for r in rows if r["streak_type"] == "loss" and r["person_name"] == "Anna"]
    assert loss and loss[0]["length"] == 4 and loss[0]["active"] == 1
    win = [r for r in rows if r["streak_type"] == "win" and r["person_name"] == "Ben"]
    assert win and win[0]["active"] == 1


def test_streak_rows_skips_unresolved_and_short_runs():
    rows = streak_rows(
        [
            _match("m1", "1", "Anna", "Ben", "Anna"),
            _match("m2", "2", "Anna", "Ben", "Anna"),
            _match("m3", "3", "Anna", "Ben", "", result_basis="unresolved"),
        ]
    )
    assert [r for r in rows if r["streak_type"] == "win"] == []  # only 2 wins, below threshold
    assert [r for r in rows if r["streak_type"] == "unbeaten"] == []  # 2 results below threshold 4


def test_highest_elo_progression_tracks_hand_offs():
    matches = [
        _match("m1", "1", "Anna", "Ben", "Anna", video_url="v1", source_urls="u1"),
        _match("m2", "2", "Cid", "Dora", "Cid"),
        _match("m3", "3", "Anna", "Cid", "Cid"),
    ]
    rows = [r for r in records_progression_rows(matches, [], []) if r["record_key"] == "highest_elo"]
    assert rows[0]["holder_name"] == "Anna" and rows[0]["value"] == 1516
    assert rows[0]["match_id"] == "m1" and rows[0]["video_url"] == "v1"
    assert rows[-1]["holder_name"] == "Cid" and rows[-1]["superseded"] == 0
    assert all(r["superseded"] == 1 for r in rows[:-1])


def test_win_and_match_count_records_progress():
    matches = [
        _match("m1", "1", "Anna", "Ben", "Anna"),
        _match("m2", "2", "Anna", "Ben", "Ben"),
        _match("m3", "3", "Anna", "Ben", "Anna"),
    ]
    rows = records_progression_rows(matches, [], [])
    wins = [r for r in rows if r["record_key"] == "most_career_wins"]
    assert [(r["holder_name"], r["value"]) for r in wins] == [("Anna", 1), ("Anna", 2)]
    games = [r for r in rows if r["record_key"] == "most_career_matches"]
    assert games[0]["value"] == 1 and games[-1]["value"] == 3
    streak = [r for r in rows if r["record_key"] == "longest_win_streak"]
    assert streak and streak[0]["value"] == 1  # opened by the first win


def test_pokemon_and_person_kill_records_use_season_grain():
    stints = [
        {"season_id": "season_001", "person_id": "", "person_name": "Anna", "kills": "30", "matches": "10", "wins": "8", "losses": "2", "draws": "0", "data_status": "available", "source_urls": "s1"},
        {"season_id": "season_002", "person_id": "", "person_name": "Anna", "kills": "20", "matches": "10", "wins": "6", "losses": "4", "draws": "0", "data_status": "available", "source_urls": "s2"},
        {"season_id": "season_002", "person_id": "", "person_name": "Ben", "kills": "40", "matches": "10", "wins": "7", "losses": "3", "draws": "0", "data_status": "available", "source_urls": "s3"},
    ]
    killlists = [
        {"season_id": "season_001", "pokemon": "Gengar", "trainer": "Anna", "kills": "10", "appearances": "5", "data_status": "available", "source_urls": "u1"},
        {"season_id": "season_002", "pokemon": "Mew", "trainer": "Ben", "kills": "14", "appearances": "6", "data_status": "available", "source_urls": "u2"},
        {"season_id": "season_002", "pokemon": "Gengar", "trainer": "Cid", "kills": "3", "appearances": "2", "data_status": "available", "source_urls": "u3"},
    ]
    rows = records_progression_rows([], stints, killlists)
    season_kills = [r for r in rows if r["record_key"] == "most_season_kills_person"]
    assert [(r["holder_name"], r["value"]) for r in season_kills] == [("Anna", 30), ("Ben", 40)]
    career_kills = [r for r in rows if r["record_key"] == "most_career_kills"]
    assert career_kills[-1]["holder_name"] == "Anna" and career_kills[-1]["value"] == 50
    poke_season = [r for r in rows if r["record_key"] == "most_season_kills_pokemon"]
    assert [(r["holder_pokemon"], r["value"]) for r in poke_season] == [("Gengar", 10), ("Mew", 14)]
    poke_career = [r for r in rows if r["record_key"] == "most_career_kills_pokemon"]
    assert [(r["holder_pokemon"], r["value"]) for r in poke_career] == [("Gengar", 10), ("Mew", 14)]
    seasons_played = [r for r in rows if r["record_key"] == "most_seasons_played"]
    assert seasons_played[-1]["value"] == 2 and seasons_played[-1]["holder_name"] == "Anna"


def _standing(season, person, rank, wins, losses, kills, division="Liga 1", stage="final_table"):
    return {
        "season_id": season,
        "division": division,
        "stage": stage,
        "is_primary": "true",
        "rank": rank,
        "person_id": "",
        "player_name": person,
        "wins": wins,
        "losses": losses,
        "draws": "0",
        "kills": kills,
        "deaths": "0",
        "data_status": "available",
        "source_urls": "u",
    }


def test_award_rows_mvp_kill_leader_and_spoon():
    standings = [
        _standing("season_001", "Anna", "1", "10", "2", "50"),
        _standing("season_001", "Ben", "2", "8", "4", "60"),
        _standing("season_001", "Cid", "3", "1", "11", "10"),
    ]
    rows = award_rows([], [], standings, [], [])
    by_key = {row["award_key"]: row for row in rows}
    assert by_key["mvp"]["person_name"] == "Anna" and by_key["mvp"]["formula"] == "weighted_rating_min5"
    assert by_key["kill_leader"]["person_name"] == "Ben" and by_key["kill_leader"]["value"] == 60
    assert by_key["holzloeffel"]["person_name"] == "Cid" and by_key["holzloeffel"]["division"] == "Liga 1"
    assert all(row["scope"] == "season" for row in rows)


def test_award_rows_redemption_and_champion():
    standings = [_standing("season_001", "Cid", "3", "1", "11", "10")]
    champions = [
        {"season_id": "season_002", "champion_name": "Cid", "champion_person_id": "", "champion_team": "", "evidence_type": "sheet", "data_status": "source_evidenced", "notes": "", "source_urls": "c"}
    ]
    rows = award_rows([], [], standings, champions, [])
    champion = [r for r in rows if r["award_key"] == "champion"]
    assert len(champion) == 1 and champion[0]["person_name"] == "Cid" and champion[0]["season_id"] == "season_002"
    redemption = [r for r in rows if r["award_key"] == "holzloeffel_redemption"]
    assert len(redemption) == 1 and redemption[0]["value"] == "S1→S2" and redemption[0]["scope"] == "career"


def test_award_rows_newcomer_upset_and_iron_man():
    stints = [
        {"season_id": "season_001", "person_id": "", "person_name": "Anna", "kills": "0", "matches": "10", "wins": "8", "losses": "2", "draws": "0", "data_status": "available", "source_urls": "s"},
        {"season_id": "season_002", "person_id": "", "person_name": "Anna", "kills": "0", "matches": "10", "wins": "6", "losses": "4", "draws": "0", "data_status": "available", "source_urls": "s"},
        {"season_id": "season_002", "person_id": "", "person_name": "Neo", "kills": "0", "matches": "8", "wins": "7", "losses": "1", "draws": "0", "data_status": "available", "source_urls": "s"},
    ]
    matches = [
        _match("m1", "1", "Anna", "Ben", "Anna"),
        _match("m2", "2", "Anna", "Ben", "Anna"),
        _match("m3", "3", "Anna", "Ben", "Ben"),  # Ben beats the favorite => season upset + giant slayer
    ]
    rows = award_rows(matches, stints, [], [], [])
    newcomers = [r for r in rows if r["award_key"] == "best_newcomer"]
    assert [(r["season_id"], r["person_name"]) for r in newcomers if r["season_id"] == "season_002"] == [("season_002", "Neo")]
    upset = [r for r in rows if r["award_key"] == "upset_of_season"]
    assert upset and upset[0]["person_name"] == "Ben" and 0 < upset[0]["value"] < 50
    slayer = [r for r in rows if r["award_key"] == "giant_slayer"]
    assert slayer and slayer[0]["person_name"] == "Ben" and slayer[0]["value"] == 1531  # Anna's pregame Elo in m3
    iron = [r for r in rows if r["award_key"] == "iron_man"]
    assert iron and iron[0]["person_name"] == "Anna" and iron[0]["value"] == 2


def test_build_and_write_aggregates_includes_records_outputs(tmp_path):
    normalized = tmp_path / "normalized"
    _write_csv(normalized / "matches.csv", [
        _match("m1", "1", "Anna", "Ben", "Anna", score_a="6", score_b="0"),
        _match("m2", "2", "Anna", "Ben", "Anna", score_a="6", score_b="0"),
        _match("m3", "3", "Anna", "Ben", "Anna", score_a="2", score_b="0"),
    ])
    _write_csv(normalized / "standings.csv", [_standing("season_001", "Anna", "1", "3", "0", "14")])
    _write_csv(normalized / "person_stints.csv", [
        {"season_id": "season_001", "person_id": "", "person_name": "Anna", "kills": "14", "matches": "3", "wins": "3", "losses": "0", "draws": "0", "data_status": "available", "source_urls": "s"},
    ])
    _write_csv(normalized / "people.csv", [{"person_id": "person_anna", "person_name": "Anna", "person_name_normalized": "anna", "aliases": "", "data_status": "x", "source_urls": ""}])
    _write_csv(normalized / "champions.csv", [{"season_id": "season_001", "champion_name": "Anna", "champion_person_id": "", "champion_team": "", "evidence_type": "sheet", "data_status": "source_evidenced", "notes": "", "source_urls": "c"}])
    _write_csv(normalized / "pokemon_killlists.csv", [{"season_id": "season_001", "division": "", "stage": "", "pokemon": "Gengar", "pokemon_normalized": "gengar", "trainer": "Anna", "trainer_normalized": "anna", "team_name": "", "appearances": "3", "kills": "9", "data_status": "available", "source_urls": "k"}])

    counts = build_and_write_aggregates(tmp_path)
    assert counts["streaks"] >= 1
    assert counts["records_progression"] >= 3
    assert counts["awards"] >= 2
    assert _read_header(normalized / "streaks.csv") == STREAK_FIELDS
    assert _read_header(normalized / "records_progression.csv") == RECORDS_PROGRESSION_FIELDS
    assert _read_header(normalized / "awards.csv") == AWARD_FIELDS
