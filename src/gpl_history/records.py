"""Streak, record-progression, and award builders for the aggregates chain.

All builders are pure: they take already-read CSV row dicts and return sorted
row dicts whose fields end in ``source_urls``. Semantics follow the Elo/result
conventions documented in docs/known-limitations.md: rows with ``data_status``
in {not_available, source_video_only} never count, ``result_basis ==
"unresolved"`` rows are skipped entirely, forfeit wins count like the league
counted them, and winner-less rows are draws.

To avoid an import cycle, aggregates.py imports this module lazily inside its
build functions while this module imports aggregates' helpers at module level.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from .aggregates import (
    _add_urls,
    _join_urls,
    _match_chronology,
    _person_id,
)

STREAK_FIELDS = [
    "person_id",
    "person_name",
    "streak_type",
    "length",
    "start_season_id",
    "start_week",
    "end_season_id",
    "end_week",
    "start_match_id",
    "end_match_id",
    "active",
    "source_urls",
]

RESULT_WIN = "win"
RESULT_LOSS = "loss"
RESULT_DRAW = "draw"

_STREAK_THRESHOLDS = {"win": 3, "loss": 3, "unbeaten": 4, "sweep": 2}

_STREAK_PREDICATES = {
    "win": lambda entry: entry["result"] == RESULT_WIN,
    "loss": lambda entry: entry["result"] == RESULT_LOSS,
    "unbeaten": lambda entry: entry["result"] in {RESULT_WIN, RESULT_DRAW},
    "sweep": lambda entry: entry["is_sweep"],
}


def streak_rows(matches: list[dict[str, str]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for person_id, entries in sorted(_person_results(matches).items()):
        for streak_type in sorted(_STREAK_PREDICATES):
            predicate = _STREAK_PREDICATES[streak_type]
            threshold = _STREAK_THRESHOLDS[streak_type]
            run_start = None
            for index, entry in enumerate(entries):
                if predicate(entry):
                    if run_start is None:
                        run_start = index
                    continue
                if run_start is not None:
                    rows.extend(_streak_row(person_id, entries, streak_type, threshold, run_start, index - 1, False))
                    run_start = None
            if run_start is not None:
                rows.extend(_streak_row(person_id, entries, streak_type, threshold, run_start, len(entries) - 1, True))
    return rows


def _streak_row(
    person_id: str,
    entries: list[dict[str, Any]],
    streak_type: str,
    threshold: int,
    start: int,
    end: int,
    active: bool,
) -> list[dict[str, Any]]:
    length = end - start + 1
    if length < threshold:
        return []
    members = entries[start : end + 1]
    sources: set[str] = set()
    for entry in members:
        _add_urls(sources, entry["source_urls"])
    return [
        {
            "person_id": person_id,
            "person_name": members[0]["name"],
            "streak_type": streak_type,
            "length": length,
            "start_season_id": members[0]["season_id"],
            "start_week": members[0]["week"],
            "end_season_id": members[-1]["season_id"],
            "end_week": members[-1]["week"],
            "start_match_id": members[0]["match_id"],
            "end_match_id": members[-1]["match_id"],
            "active": 1 if active else 0,
            "source_urls": _join_urls(sources),
        }
    ]


def _person_results(matches: list[dict[str, str]]) -> dict[str, list[dict[str, Any]]]:
    """person_id -> chronological result entries for every rated match."""
    by_person: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in sorted(matches, key=_match_chronology):
        if row.get("data_status") in {"not_available", "source_video_only"}:
            continue
        if (row.get("result_basis") or "") == "unresolved":
            continue
        left = row.get("player_a") or ""
        right = row.get("player_b") or ""
        if not left or not right:
            continue
        winner_key = _person_id(row.get("winner"))
        for name, own_score in ((left, row.get("score_a")), (right, row.get("score_b"))):
            key = _person_id(name)
            if winner_key == key:
                result = RESULT_WIN
            elif winner_key and winner_key in {_person_id(left), _person_id(right)}:
                result = RESULT_LOSS
            else:
                result = RESULT_DRAW
            by_person[key].append(
                {
                    "result": result,
                    "is_sweep": result == RESULT_WIN and str(own_score or "").strip() == "6",
                    "season_id": row.get("season_id") or "",
                    "week": row.get("week") or "",
                    "match_id": row.get("match_id") or "",
                    "source_urls": row.get("source_urls") or "",
                    "name": name,
                }
            )
    return dict(by_person)
