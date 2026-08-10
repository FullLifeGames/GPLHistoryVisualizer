from gpl_history.aggregates import _elo_by_person
from gpl_history.records import streak_rows


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
