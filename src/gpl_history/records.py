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

import re

from .aggregates import (
    _add_urls,
    _bayes_rating_value,
    _elo_by_person,
    _join_urls,
    _match_chronology,
    _number,
    _person_id,
    _season_sort,
    _weighted_rating,
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


AWARD_FIELDS = [
    "award_key",
    "scope",
    "season_id",
    "division",
    "person_id",
    "person_name",
    "value",
    "formula",
    "detail",
    "source_urls",
]

_MIN_AWARD_MATCHES = 5


def award_rows(
    matches: list[dict[str, str]],
    stints: list[dict[str, str]],
    standings: list[dict[str, str]],
    champions: list[dict[str, str]],
    killlists: list[dict[str, str]],
) -> list[dict[str, Any]]:
    del killlists  # awards derive kill numbers from standings; killlists stay record-book territory
    rows: list[dict[str, Any]] = []

    for row in champions:
        name = row.get("champion_name") or ""
        if not name:
            continue
        rows.append(
            _award("champion", "season", row.get("season_id") or "", "", row.get("champion_person_id") or _person_id(name), name, "", "sourced_title", row.get("source_urls") or "")
        )

    spoon_by_person: dict[str, list[str]] = defaultdict(list)
    primary = [
        row
        for row in standings
        if row.get("data_status") != "not_available" and (row.get("is_primary") or "true").lower() != "false"
    ]
    standings_by_season: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in primary:
        season_id = row.get("season_id") or ""
        if season_id:
            standings_by_season[season_id].append(row)

    for season_id in sorted(standings_by_season, key=_season_sort):
        season_rows = standings_by_season[season_id]

        rated: list[tuple[float, str, str, dict[str, str]]] = []
        for row in season_rows:
            wins, losses, draws = _number(row.get("wins")), _number(row.get("losses")), _number(row.get("draws"))
            if wins + losses + draws < _MIN_AWARD_MATCHES:
                continue
            value = _bayes_rating_value(wins, losses, draws)
            if value is None:
                continue
            name = row.get("player_name") or row.get("person_name") or ""
            rated.append((value, row.get("person_id") or _person_id(name), name, row))
        if rated:
            best = max(value for value, *_ in rated)
            for value, person_id, name, row in sorted((r for r in rated if r[0] == best), key=lambda r: r[1]):
                rows.append(
                    _award("mvp", "season", season_id, row.get("division") or "", person_id, name, _weighted_rating(_number(row.get("wins")), _number(row.get("losses")), _number(row.get("draws"))), "weighted_rating_min5", row.get("source_urls") or "")
                )

        kills_by_row = [(_number(row.get("kills")), row) for row in season_rows if _number(row.get("kills")) > 0]
        if kills_by_row:
            best_kills = max(value for value, _ in kills_by_row)
            for value, row in sorted((entry for entry in kills_by_row if entry[0] == best_kills), key=lambda entry: entry[1].get("person_id") or _person_id(entry[1].get("player_name"))):
                name = row.get("player_name") or ""
                rows.append(
                    _award("kill_leader", "season", season_id, row.get("division") or "", row.get("person_id") or _person_id(name), name, _int_if_whole(value), "season_kills", row.get("source_urls") or "")
                )

        by_division: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in season_rows:
            by_division[row.get("division") or ""].append(row)
        for division in sorted(by_division):
            division_rows = [row for row in by_division[division] if (row.get("stage") or "") == "final_table"] or by_division[division]
            ranked = [(_number(row.get("rank")), row) for row in division_rows if _number(row.get("rank")) > 0]
            if not ranked:
                continue
            worst = max(rank for rank, _ in ranked)
            for rank, row in sorted((entry for entry in ranked if entry[0] == worst), key=lambda entry: entry[1].get("person_id") or _person_id(entry[1].get("player_name"))):
                name = row.get("player_name") or ""
                person_id = row.get("person_id") or _person_id(name)
                spoon_by_person[person_id].append(season_id)
                rows.append(
                    _award("holzloeffel", "season", season_id, division, person_id, name, _int_if_whole(rank), "last_place", row.get("source_urls") or "")
                )

    rows.extend(_newcomer_awards(stints))
    rows.extend(_elo_awards(matches))
    rows.extend(_iron_man_awards(stints))
    rows.extend(_redemption_awards(spoon_by_person, champions))

    def sort_key(row: dict[str, Any]) -> tuple:
        return (
            0 if row["scope"] == "season" else 1,
            _season_sort(row.get("season_id") or ""),
            row["award_key"],
            row.get("person_id") or "",
        )

    return sorted(rows, key=sort_key)


def _award(award_key: str, scope: str, season_id: str, division: str, person_id: str, person_name: str, value: Any, formula: str, source_urls: str, detail: str = "") -> dict[str, Any]:
    urls: set[str] = set()
    _add_urls(urls, source_urls)
    return {
        "award_key": award_key,
        "scope": scope,
        "season_id": season_id,
        "division": division,
        "person_id": person_id,
        "person_name": person_name,
        "value": value,
        "formula": formula,
        "detail": detail,
        "source_urls": _join_urls(urls),
    }


def _season_number_label(season_id: str) -> str:
    match = re.search(r"([0-9]+)", str(season_id or ""))
    return f"S{int(match.group(1))}" if match else str(season_id or "")


def _newcomer_awards(stints: list[dict[str, str]]) -> list[dict[str, Any]]:
    debut_season: dict[str, str] = {}
    totals: dict[tuple[str, str], dict[str, Any]] = {}
    for row in stints:
        if row.get("data_status") == "not_available":
            continue
        name = row.get("person_name") or ""
        person_id = row.get("person_id") or _person_id(name)
        season_id = row.get("season_id") or ""
        if not person_id or not season_id:
            continue
        if person_id not in debut_season or _season_sort(season_id) < _season_sort(debut_season[person_id]):
            debut_season[person_id] = season_id
        entry = totals.setdefault((person_id, season_id), {"name": name, "wins": 0.0, "losses": 0.0, "draws": 0.0, "sources": set()})
        entry["wins"] += _number(row.get("wins"))
        entry["losses"] += _number(row.get("losses"))
        entry["draws"] += _number(row.get("draws"))
        _add_urls(entry["sources"], row.get("source_urls"))

    by_season: dict[str, list[tuple[float, str, dict[str, Any]]]] = defaultdict(list)
    for (person_id, season_id), entry in totals.items():
        if debut_season.get(person_id) != season_id:
            continue
        if entry["wins"] + entry["losses"] + entry["draws"] < _MIN_AWARD_MATCHES:
            continue
        value = _bayes_rating_value(entry["wins"], entry["losses"], entry["draws"])
        if value is None:
            continue
        by_season[season_id].append((value, person_id, entry))

    rows: list[dict[str, Any]] = []
    for season_id in sorted(by_season, key=_season_sort):
        best = max(value for value, *_ in by_season[season_id])
        for value, person_id, entry in sorted((r for r in by_season[season_id] if r[0] == best), key=lambda r: r[1]):
            rows.append(
                _award("best_newcomer", "season", season_id, "", person_id, entry["name"], _weighted_rating(entry["wins"], entry["losses"], entry["draws"]), "weighted_rating_debut_min5", ";".join(sorted(entry["sources"])))
            )
    return rows


def _elo_awards(matches: list[dict[str, str]]) -> list[dict[str, Any]]:
    upsets: dict[str, dict[str, Any]] = {}
    slayers: dict[str, dict[str, Any]] = {}

    def on_match(row: dict[str, str], details: dict[str, Any]) -> None:
        winner_key = _person_id(row.get("winner"))
        if winner_key not in {details["left_key"], details["right_key"]}:
            return
        season_id = row.get("season_id") or ""
        winner_is_left = winner_key == details["left_key"]
        winner_name = (row.get("player_a") if winner_is_left else row.get("player_b")) or ""
        winner_expected = details["left_expected"] if winner_is_left else 1 - details["left_expected"]
        opponent_before = details["right_before"] if winner_is_left else details["left_before"]
        opponent_name = (row.get("player_b") if winner_is_left else row.get("player_a")) or ""
        context = {"division": row.get("division") or "", "sources": row.get("source_urls") or "", "opponent_name": opponent_name}
        current_upset = upsets.get(season_id)
        if current_upset is None or winner_expected < current_upset["expected"]:
            upsets[season_id] = {"expected": winner_expected, "person_id": winner_key, "name": winner_name, **context}
        current_slayer = slayers.get(season_id)
        if current_slayer is None or opponent_before > current_slayer["opponent"]:
            slayers[season_id] = {"opponent": opponent_before, "person_id": winner_key, "name": winner_name, **context}

    _elo_by_person(matches, on_match=on_match)

    rows: list[dict[str, Any]] = []
    for season_id in sorted(upsets, key=_season_sort):
        entry = upsets[season_id]
        rows.append(
            _award("upset_of_season", "season", season_id, entry["division"], entry["person_id"], entry["name"], round(entry["expected"] * 100), "min_pregame_win_chance", entry["sources"], detail=entry["opponent_name"])
        )
    for season_id in sorted(slayers, key=_season_sort):
        entry = slayers[season_id]
        rows.append(
            _award("giant_slayer", "season", season_id, entry["division"], entry["person_id"], entry["name"], round(entry["opponent"]), "beat_highest_rated", entry["sources"], detail=entry["opponent_name"])
        )
    return rows


def _iron_man_awards(stints: list[dict[str, str]]) -> list[dict[str, Any]]:
    seasons_by_person: dict[str, set[int]] = defaultdict(set)
    names: dict[str, str] = {}
    sources: dict[str, set[str]] = defaultdict(set)
    for row in stints:
        if row.get("data_status") == "not_available":
            continue
        name = row.get("person_name") or ""
        person_id = row.get("person_id") or _person_id(name)
        match = re.search(r"([0-9]+)", row.get("season_id") or "")
        if not person_id or not match:
            continue
        seasons_by_person[person_id].add(int(match.group(1)))
        names.setdefault(person_id, name)
        _add_urls(sources[person_id], row.get("source_urls"))

    best_run: dict[str, int] = {}
    for person_id, seasons in seasons_by_person.items():
        run = best = 0
        previous = None
        for number in sorted(seasons):
            run = run + 1 if previous is not None and number == previous + 1 else 1
            best = max(best, run)
            previous = number
        best_run[person_id] = best

    if not best_run:
        return []
    top = max(best_run.values())
    return [
        _award("iron_man", "career", "", "", person_id, names.get(person_id, ""), top, "consecutive_seasons", ";".join(sorted(sources[person_id])))
        for person_id in sorted(best_run)
        if best_run[person_id] == top
    ]


def _redemption_awards(spoon_by_person: dict[str, list[str]], champions: list[dict[str, str]]) -> list[dict[str, Any]]:
    titles_by_person: dict[str, list[str]] = defaultdict(list)
    names: dict[str, str] = {}
    sources: dict[str, set[str]] = defaultdict(set)
    for row in champions:
        name = row.get("champion_name") or ""
        person_id = row.get("champion_person_id") or _person_id(name)
        if not person_id or not row.get("season_id"):
            continue
        titles_by_person[person_id].append(row.get("season_id") or "")
        names.setdefault(person_id, name)
        _add_urls(sources[person_id], row.get("source_urls"))

    rows: list[dict[str, Any]] = []
    for person_id in sorted(spoon_by_person):
        spoons = sorted(spoon_by_person[person_id], key=_season_sort)
        titles = sorted(titles_by_person.get(person_id, []), key=_season_sort)
        arc = next(
            ((spoon, title) for spoon in spoons for title in titles if _season_sort(title) > _season_sort(spoon)),
            None,
        )
        if not arc:
            continue
        value = f"{_season_number_label(arc[0])}→{_season_number_label(arc[1])}"
        rows.append(
            _award("holzloeffel_redemption", "career", "", "", person_id, names.get(person_id, ""), value, "spoon_to_title", ";".join(sorted(sources[person_id])))
        )
    return rows


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
