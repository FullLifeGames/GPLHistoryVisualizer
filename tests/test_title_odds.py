from gpl_history.title_odds import TITLE_ODDS_FIELDS, title_odds_rows


def _match(season, division, week, a, b, winner, match_id, stage="regular_season", status="sheet_extracted"):
    return {
        "season_id": season,
        "division": division,
        "stage": stage,
        "week": week,
        "player_a": a,
        "player_b": b,
        "winner": winner,
        "match_id": match_id,
        "data_status": status,
        "result_basis": "",
        "source_urls": f"https://example.com/{season}",
    }


FIXTURE = [
    # Round-robin of three players over three matchdays; Alice wins everything.
    _match("season_001", "Liga 1", "1. Spieltag", "Alice", "Bob", "Alice", "m1"),
    _match("season_001", "Liga 1", "2. Spieltag", "Alice", "Carol", "Alice", "m2"),
    _match("season_001", "Liga 1", "3. Spieltag", "Bob", "Carol", "Bob", "m3"),
]


def test_fields_end_with_source_urls():
    assert TITLE_ODDS_FIELDS[-1] == "source_urls"


def test_rows_cover_every_matchday_and_player():
    rows = title_odds_rows(FIXTURE, sims=50, seed=1)
    keys = {(row["week"], row["person_id"]) for row in rows}
    assert keys == {(w, p) for w in ("1", "2", "3") for p in ("person_alice", "person_bob", "person_carol")}
    assert all(row["season_id"] == "season_001" and row["division"] == "Liga 1" for row in rows)
    assert all(row["sims"] == 50 and row["seed"] == 1 for row in rows)


def test_probabilities_sum_to_one_per_checkpoint():
    rows = title_odds_rows(FIXTURE, sims=200, seed=1)
    for week in ("1", "2", "3"):
        total = sum(float(row["p_first"]) for row in rows if row["week"] == week)
        assert abs(total - 1.0) < 1e-6


def test_last_matchday_is_certain():
    rows = title_odds_rows(FIXTURE, sims=50, seed=1)
    final = {row["person_id"]: float(row["p_first"]) for row in rows if row["week"] == "3"}
    # 2 wins for Alice, 1 for Bob, 0 for Carol -> no simulation left, no ties.
    assert final["person_alice"] == 1.0
    assert final["person_bob"] == 0.0
    assert final["person_carol"] == 0.0


def test_deterministic_for_same_seed_and_sensitive_to_seed():
    a = title_odds_rows(FIXTURE, sims=100, seed=7)
    b = title_odds_rows(FIXTURE, sims=100, seed=7)
    assert a == b
    c = title_odds_rows(FIXTURE, sims=100, seed=8)
    assert a != c  # different seed shifts at least one mid-season probability


def test_playoff_spots_from_playoff_matches():
    fixture = FIXTURE + [
        _match("season_001", "Playoffs", "Finale", "Alice", "Bob", "Alice", "p1", stage="playoffs"),
    ]
    rows = title_odds_rows(fixture, sims=100, seed=1)
    league = [row for row in rows if row["division"] == "Liga 1" and row["week"] == "3"]
    by_person = {row["person_id"]: row for row in league}
    # Two of the three players reached the playoffs -> K == 2, certainty at the last matchday.
    assert by_person["person_alice"]["p_playoffs"] == "1.0000"
    assert by_person["person_bob"]["p_playoffs"] == "1.0000"
    assert by_person["person_carol"]["p_playoffs"] == "0.0000"
    # Playoff matches never get their own odds rows.
    assert not [row for row in rows if row["division"] == "Playoffs"]


def test_skips_invalid_rows():
    fixture = FIXTURE + [
        _match("season_001", "Liga 1", "4. Spieltag", "Alice", "Bob", "", "m4", status="source_video_only"),
        {**_match("season_001", "Liga 1", "5. Spieltag", "Alice", "Bob", "", "m5"), "result_basis": "unresolved"},
    ]
    rows = title_odds_rows(fixture, sims=20, seed=1)
    assert {row["week"] for row in rows} == {"1", "2", "3"}
