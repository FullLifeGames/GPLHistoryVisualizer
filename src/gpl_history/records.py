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
    _elo_by_person,
    _join_urls,
    _match_chronology,
    _number,
    _person_id,
    _season_sort,
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

RECORDS_PROGRESSION_FIELDS = [
    "record_key",
    "holder_person_id",
    "holder_name",
    "holder_pokemon",
    "value",
    "season_id",
    "week",
    "match_id",
    "video_url",
    "superseded",
    "source_urls",
]

_RECORD_KEYS = [
    "highest_elo",
    "longest_win_streak",
    "longest_unbeaten",
    "most_career_wins",
    "most_career_matches",
    "most_career_kills",
    "most_season_kills_person",
    "most_season_kills_pokemon",
    "most_career_kills_pokemon",
    "most_seasons_played",
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


class _Progression:
    """Collects a record's hand-off rows; emits only on strict improvement."""

    def __init__(self, record_key: str) -> None:
        self.record_key = record_key
        self.best: float | None = None
        self.rows: list[dict[str, Any]] = []

    def offer(self, value: float, holder_id: str, holder_name: str, holder_pokemon: str, context: dict[str, str], sources: str) -> None:
        if self.best is not None and value <= self.best:
            return
        self.best = value
        urls: set[str] = set()
        _add_urls(urls, sources)
        self.rows.append(
            {
                "record_key": self.record_key,
                "holder_person_id": holder_id,
                "holder_name": holder_name,
                "holder_pokemon": holder_pokemon,
                "value": _int_if_whole(value),
                "season_id": context.get("season_id", ""),
                "week": context.get("week", ""),
                "match_id": context.get("match_id", ""),
                "video_url": context.get("video_url", ""),
                "superseded": 1,
                "source_urls": _join_urls(urls),
            }
        )


def _int_if_whole(value: float) -> Any:
    number = float(value)
    return int(number) if number.is_integer() else number


def records_progression_rows(
    matches: list[dict[str, str]],
    stints: list[dict[str, str]],
    killlists: list[dict[str, str]],
) -> list[dict[str, Any]]:
    progressions = {key: _Progression(key) for key in _RECORD_KEYS}

    # Match-grain records advance inside a single Elo walk.
    wins: dict[str, int] = defaultdict(int)
    games: dict[str, int] = defaultdict(int)
    win_run: dict[str, int] = defaultdict(int)
    unbeaten_run: dict[str, int] = defaultdict(int)

    def on_match(row: dict[str, str], details: dict[str, Any]) -> None:
        context = {
            "season_id": row.get("season_id") or "",
            "week": row.get("week") or "",
            "match_id": row.get("match_id") or "",
            "video_url": row.get("video_url") or "",
        }
        sources = row.get("source_urls") or ""
        winner_key = _person_id(row.get("winner"))
        sides = (
            (details["left_key"], row.get("player_a") or "", details["left_after"]),
            (details["right_key"], row.get("player_b") or "", details["right_after"]),
        )
        for key, name, rating_after in sides:
            games[key] += 1
            progressions["most_career_matches"].offer(games[key], key, name, "", context, sources)
            if winner_key == key:
                wins[key] += 1
                win_run[key] += 1
                unbeaten_run[key] += 1
                progressions["most_career_wins"].offer(wins[key], key, name, "", context, sources)
                progressions["longest_win_streak"].offer(win_run[key], key, name, "", context, sources)
                progressions["longest_unbeaten"].offer(unbeaten_run[key], key, name, "", context, sources)
            elif not winner_key:
                win_run[key] = 0
                unbeaten_run[key] += 1
                progressions["longest_unbeaten"].offer(unbeaten_run[key], key, name, "", context, sources)
            else:
                win_run[key] = 0
                unbeaten_run[key] = 0
            progressions["highest_elo"].offer(round(rating_after), key, name, "", context, sources)

    _elo_by_person(matches, on_match=on_match)

    # Season-grain records accumulate across seasons in season-sort order.
    stints_by_season: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in stints:
        if row.get("data_status") == "not_available":
            continue
        season_id = row.get("season_id") or ""
        if season_id:
            stints_by_season[season_id].append(row)
    killlists_by_season: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in killlists:
        if row.get("data_status") == "not_available":
            continue
        season_id = row.get("season_id") or ""
        if season_id and row.get("pokemon"):
            killlists_by_season[season_id].append(row)

    career_kills: dict[str, float] = defaultdict(float)
    career_seasons: dict[str, set[str]] = defaultdict(set)
    career_pokemon_kills: dict[str, float] = defaultdict(float)
    person_names: dict[str, str] = {}
    pokemon_names: dict[str, str] = {}

    for season_id in sorted(set(stints_by_season) | set(killlists_by_season), key=_season_sort):
        season_context = {"season_id": season_id, "week": "", "match_id": "", "video_url": ""}

        season_kills: dict[str, float] = defaultdict(float)
        season_sources: dict[str, set[str]] = defaultdict(set)
        for row in stints_by_season.get(season_id, []):
            name = row.get("person_name") or ""
            key = row.get("person_id") or _person_id(name)
            if not key:
                continue
            person_names.setdefault(key, name)
            season_kills[key] += _number(row.get("kills"))
            _add_urls(season_sources[key], row.get("source_urls"))
            career_seasons[key].add(season_id)
        # Values within one season are simultaneous end-of-season states, so
        # candidates are offered best-first: lesser values must never emit a
        # phantom hand-off just because their holder sorts earlier by name.
        for key in sorted(season_kills, key=lambda k: (-season_kills[k], k)):
            sources = ";".join(sorted(season_sources[key]))
            progressions["most_season_kills_person"].offer(season_kills[key], key, person_names.get(key, ""), "", season_context, sources)
        for key in season_kills:
            career_kills[key] += season_kills[key]
        for key in sorted(season_kills, key=lambda k: (-career_kills[k], k)):
            sources = ";".join(sorted(season_sources[key]))
            progressions["most_career_kills"].offer(career_kills[key], key, person_names.get(key, ""), "", season_context, sources)
        season_people = [key for key in career_seasons if season_id in career_seasons[key]]
        for key in sorted(season_people, key=lambda k: (-len(career_seasons[k]), k)):
            progressions["most_seasons_played"].offer(len(career_seasons[key]), key, person_names.get(key, ""), "", season_context, "")

        pokemon_kills: dict[str, float] = defaultdict(float)
        pokemon_sources: dict[str, set[str]] = defaultdict(set)
        for row in killlists_by_season.get(season_id, []):
            pokemon = row.get("pokemon") or ""
            key = _person_id(pokemon)
            pokemon_names.setdefault(key, pokemon)
            pokemon_kills[key] += _number(row.get("kills"))
            _add_urls(pokemon_sources[key], row.get("source_urls"))
        for key in sorted(pokemon_kills, key=lambda k: (-pokemon_kills[k], k)):
            sources = ";".join(sorted(pokemon_sources[key]))
            progressions["most_season_kills_pokemon"].offer(pokemon_kills[key], "", "", pokemon_names.get(key, ""), season_context, sources)
        for key in pokemon_kills:
            career_pokemon_kills[key] += pokemon_kills[key]
        for key in sorted(pokemon_kills, key=lambda k: (-career_pokemon_kills[k], k)):
            sources = ";".join(sorted(pokemon_sources[key]))
            progressions["most_career_kills_pokemon"].offer(career_pokemon_kills[key], "", "", pokemon_names.get(key, ""), season_context, sources)

    rows: list[dict[str, Any]] = []
    for key in _RECORD_KEYS:
        emitted = progressions[key].rows
        if emitted:
            emitted[-1]["superseded"] = 0
        rows.extend(emitted)
    return rows


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
