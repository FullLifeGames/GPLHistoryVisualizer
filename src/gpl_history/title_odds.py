"""Retro title odds via a seeded Monte-Carlo over the real schedule.

Deliberately outside the check-generated drift chain: simulation is costly, so
``gpl-history title-odds`` regenerates ``data/normalized/title_odds.csv`` on
demand and the CSV is committed like the other normalized files. Semantics
(documented in docs/known-limitations.md): 3/1/0 points, winner-less decided
rows are draws, win probabilities come from career Elo frozen at the
checkpoint matchday, simulated matches never draw, ranking ties break
uniformly at random per simulation. ``p_first`` is the probability of
finishing rank 1 of the division's regular season; ``p_playoffs`` uses the
number of this division's players that actually appear in playoff matches.
Every checkpoint seeds its own ``random.Random`` with a stable string, so the
output is deterministic for a given (matches, sims, seed).
"""

from __future__ import annotations

import random
from collections import defaultdict
from pathlib import Path
from typing import Any

from .aggregates import (
    _add_urls,
    _elo_by_person,
    _join_urls,
    _person_id,
    _read_csv,
    _season_sort,
    _week_sort,
    _write_csv,
)

TITLE_ODDS_FIELDS = [
    "season_id",
    "division",
    "week",
    "person_id",
    "person_name",
    "p_first",
    "p_playoffs",
    "sims",
    "seed",
    "source_urls",
]

_SKIPPED_STATUSES = {"not_available", "source_video_only"}
_POINTS_WIN = 3
_POINTS_DRAW = 1


def _simulatable(row: dict[str, str]) -> bool:
    if row.get("data_status") in _SKIPPED_STATUSES:
        return False
    if row.get("result_basis") == "unresolved":
        return False
    if row.get("stage") != "regular_season":
        return False
    return bool(row.get("player_a")) and bool(row.get("player_b"))


def _elo_snapshots(matches: list[dict[str, str]]) -> dict[tuple[str, int], dict[str, float]]:
    """Ratings after each (season, week-order) block of the global replay."""
    running: dict[str, float] = {}
    snapshots: dict[tuple[str, int], dict[str, float]] = {}

    def on_match(row: dict[str, str], details: dict[str, Any]) -> None:
        running[details["left_key"]] = details["left_after"]
        running[details["right_key"]] = details["right_after"]
        key = (row.get("season_id") or "", _week_sort(row.get("week"), row.get("stage")))
        # Overwritten by every match of the block; the last write leaves the
        # ratings state after the block, which is exactly the checkpoint value.
        snapshots[key] = dict(running)

    _elo_by_person(matches, on_match=on_match)
    return snapshots


def _ratings_at(snapshots: dict[tuple[str, int], dict[str, float]], season_id: str, week: int) -> dict[str, float]:
    best: tuple[int, dict[str, float]] | None = None
    for (snap_season, snap_week), ratings in snapshots.items():
        if snap_season != season_id or snap_week > week:
            continue
        if best is None or snap_week > best[0]:
            best = (snap_week, ratings)
    return best[1] if best else {}


def _playoff_participants(matches: list[dict[str, str]]) -> dict[str, set[str]]:
    participants: dict[str, set[str]] = defaultdict(set)
    for row in matches:
        if row.get("stage") != "playoffs" or row.get("data_status") in _SKIPPED_STATUSES:
            continue
        for player in (row.get("player_a"), row.get("player_b")):
            if player:
                participants[row.get("season_id") or ""].add(_person_id(player))
    return participants


def _playoff_matches(matches: list[dict[str, str]], season_id: str) -> list[dict[str, Any]]:
    """The season's playoff matches with bracket sources, in round order.

    Each participant slot is traced to the latest earlier playoff match the
    actual player appeared in ("winner" or "loser" of it) — that is the
    bracket wiring. Players without an earlier playoff match are fixed seeds
    (S6 seeds four players straight into the Viertelfinale, S10 seeds
    Minetube into the Halbfinale).
    """
    rows = [
        row
        for row in matches
        if row.get("season_id") == season_id
        and row.get("stage") == "playoffs"
        and row.get("data_status") not in _SKIPPED_STATUSES
        and row.get("result_basis") != "unresolved"
        and row.get("player_a")
        and row.get("player_b")
    ]
    rows.sort(key=lambda row: (_week_sort(row.get("week"), row.get("stage")), row.get("match_id") or ""))
    entries: list[dict[str, Any]] = []
    last_match_of: dict[str, int] = {}
    for row in rows:
        order = _week_sort(row.get("week"), row.get("stage"))
        slots = []
        for player in (row.get("player_a"), row.get("player_b")):
            key = _person_id(player)
            source_index = last_match_of.get(key)
            if source_index is None:
                slots.append(("seed", key))
            else:
                source = entries[source_index]
                role = "winner" if source["winner"] == key else "loser"
                slots.append(("from", source_index, role))
        winner = _person_id(row.get("winner"))
        loser_key = _person_id(row.get("player_b")) if winner == _person_id(row.get("player_a")) else _person_id(row.get("player_a"))
        entries.append({"order": order, "slots": slots, "winner": winner, "loser": loser_key})
        for player in (row.get("player_a"), row.get("player_b")):
            last_match_of[_person_id(player)] = len(entries) - 1
    return entries


def _simulate_title(entries: list[dict[str, Any]], known_through: int, ratings: dict[str, float], rng: random.Random) -> str:
    """One tournament walk; returns the champion's person id.

    Matches through ``known_through`` keep their real outcome; later matches
    take their participants from the simulated bracket wiring and are decided
    by frozen-Elo win probability. The champion is the winner of the last
    round's match (the Platz-3 match never decides the title).
    """
    outcomes: list[tuple[str, str]] = []
    champion = ""
    final_order = max(entry["order"] for entry in entries)
    for entry in entries:
        participants = []
        for slot in entry["slots"]:
            if slot[0] == "seed":
                participants.append(slot[1])
            else:
                _, source_index, role = slot
                outcome = outcomes[source_index]
                participants.append(outcome[0] if role == "winner" else outcome[1])
        if entry["order"] <= known_through:
            outcomes.append((entry["winner"], entry["loser"]))
        else:
            key_a, key_b = participants
            if rng.random() < _win_probability(ratings, key_a, key_b):
                outcomes.append((key_a, key_b))
            else:
                outcomes.append((key_b, key_a))
        if entry["order"] == final_order:
            champion = outcomes[-1][0]
    return champion


def _win_probability(ratings: dict[str, float], key_a: str, key_b: str) -> float:
    rating_a = ratings.get(key_a, 1500.0)
    rating_b = ratings.get(key_b, 1500.0)
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def title_odds_rows(matches: list[dict[str, str]], *, sims: int = 1000, seed: int = 42) -> list[dict[str, Any]]:
    valid = [row for row in matches if _simulatable(row)]
    snapshots = _elo_snapshots(matches)
    playoff_people = _playoff_participants(matches)

    by_division: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in valid:
        by_division[(row.get("season_id") or "", row.get("division") or "")].append(row)

    rows: list[dict[str, Any]] = []
    for (season_id, division) in sorted(by_division, key=lambda key: (_season_sort(key[0]), key[1])):
        division_rows = by_division[(season_id, division)]
        weeks = sorted({_week_sort(row.get("week"), row.get("stage")) for row in division_rows})
        weeks = [week for week in weeks if week < 100]
        if not weeks:
            continue

        players: dict[str, str] = {}
        urls: set[str] = set()
        for row in division_rows:
            for player in (row.get("player_a"), row.get("player_b")):
                players.setdefault(_person_id(player), player)
            _add_urls(urls, row.get("source_urls"))
        source_urls = _join_urls(urls)
        ids = sorted(players)
        spots = len(playoff_people.get(season_id, set()) & set(ids))

        for week in weeks:
            ratings = _ratings_at(snapshots, season_id, week)
            base_points: dict[str, float] = defaultdict(float)
            base_diff: dict[str, float] = defaultdict(float)
            future: list[tuple[str, str, float]] = []
            for row in division_rows:
                order = _week_sort(row.get("week"), row.get("stage"))
                key_a = _person_id(row.get("player_a"))
                key_b = _person_id(row.get("player_b"))
                if order <= week:
                    winner = _person_id(row.get("winner"))
                    if winner == key_a:
                        base_points[key_a] += _POINTS_WIN
                    elif winner == key_b:
                        base_points[key_b] += _POINTS_WIN
                    else:
                        base_points[key_a] += _POINTS_DRAW
                        base_points[key_b] += _POINTS_DRAW
                    score_diff = _score_number(row.get("score_a")) - _score_number(row.get("score_b"))
                    base_diff[key_a] += score_diff
                    base_diff[key_b] -= score_diff
                else:
                    future.append((key_a, key_b, _win_probability(ratings, key_a, key_b)))

            rng = random.Random(f"{seed}:{season_id}:{division}:{week}")
            first_counts: dict[str, int] = defaultdict(int)
            qualified_counts: dict[str, int] = defaultdict(int)
            for _ in range(sims):
                points = dict(base_points)
                for key_a, key_b, probability in future:
                    if rng.random() < probability:
                        points[key_a] = points.get(key_a, 0.0) + _POINTS_WIN
                    else:
                        points[key_b] = points.get(key_b, 0.0) + _POINTS_WIN
                # Ties break like the official tables where possible: points,
                # then the kill differential accumulated from known results;
                # only what remains tied falls to chance. At the last matchday
                # this reproduces the official ranking.
                ranked = sorted(ids, key=lambda pid: (-points.get(pid, 0.0), -base_diff.get(pid, 0.0), rng.random()))
                first_counts[ranked[0]] += 1
                if spots:
                    for pid in ranked[:spots]:
                        qualified_counts[pid] += 1

            for pid in ids:
                rows.append(
                    {
                        "season_id": season_id,
                        "division": division,
                        "week": str(week),
                        "person_id": pid,
                        "person_name": players[pid],
                        "p_first": f"{first_counts[pid] / sims:.4f}" if sims else "",
                        "p_playoffs": f"{qualified_counts[pid] / sims:.4f}" if spots and sims else "",
                        "sims": sims,
                        "seed": seed,
                        "source_urls": source_urls,
                    }
                )

        # Playoff seasons continue the title race through the bracket: one
        # checkpoint after each round (the Platz-3 round never affects the
        # title and gets none), with the champion decided over the real
        # bracket wiring and frozen-Elo probabilities for unplayed rounds.
        if spots:
            bracket = _playoff_matches(matches, season_id)
            rounds = sorted({entry["order"] for entry in bracket if entry["order"] != 130})
            for round_order in rounds:
                ratings = _ratings_at(snapshots, season_id, round_order)
                rng = random.Random(f"{seed}:{season_id}:{division}:playoffs:{round_order}")
                title_counts: dict[str, int] = defaultdict(int)
                for _ in range(sims):
                    title_counts[_simulate_title(bracket, round_order, ratings, rng)] += 1
                for pid in ids:
                    rows.append(
                        {
                            "season_id": season_id,
                            "division": division,
                            "week": str(round_order),
                            "person_id": pid,
                            "person_name": players[pid],
                            "p_first": f"{title_counts[pid] / sims:.4f}" if sims else "",
                            "p_playoffs": "",
                            "sims": sims,
                            "seed": seed,
                            "source_urls": source_urls,
                        }
                    )
    return rows


def _score_number(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def build_and_write_title_odds(data_dir: Path, *, sims: int = 1000, seed: int = 42) -> int:
    normalized_dir = data_dir / "normalized"
    matches = _read_csv(normalized_dir / "matches.csv")
    rows = title_odds_rows(matches, sims=sims, seed=seed)
    _write_csv(normalized_dir / "title_odds.csv", TITLE_ODDS_FIELDS, rows)
    return len(rows)
