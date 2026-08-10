from gpl_history.aggregates import _elo_by_person


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
