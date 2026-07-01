from __future__ import annotations

import csv
import math
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .normalize import _display_name as _normalized_display_name
from .normalize import _person_id as _normalized_person_id

PERSON_ALL_TIME_FIELDS = [
    "person_id",
    "person_name",
    "seasons",
    "season_list",
    "seasons_won",
    "title_seasons",
    "matches",
    "wins",
    "losses",
    "draws",
    "win_pct",
    "weighted_rating",
    "elo",
    "points",
    "kills",
    "deaths",
    "differential",
    "best_rank",
    "source_urls",
]

POKEMON_ALL_TIME_FIELDS = [
    "pokemon",
    "pokemon_normalized",
    "appearances",
    "kills",
    "deaths",
    "differential",
    "seasons",
    "season_list",
    "titles",
    "title_seasons",
    "trainers",
    "teams",
    "source_urls",
]

MATCHUP_SUMMARY_FIELDS = [
    "person_id",
    "person_name",
    "opponent_id",
    "opponent_name",
    "matches",
    "wins",
    "losses",
    "draws",
    "win_pct",
    "source_urls",
]

ROSTER_SCORE_FIELDS = [
    "season_id",
    "division",
    "roster_phase",
    "person_name",
    "team_name",
    "pokemon_count",
    "roster_score",
    "history_score",
    "coverage_score",
    "top_pokemon",
    "source_urls",
]

ROSTER_SCORE_WEIGHTS = {
    "history": 0.25,
    "coverage": 0.20,
}

BAYES_PRIOR_RATE = 0.5
BAYES_PRIOR_GAMES = 12
BAYES_UNCERTAINTY_WEIGHT = 1.0

SEASON_STORYLINE_FIELDS = [
    "season_id",
    "season_label",
    "champion_name",
    "champion_team",
    "quality_score",
    "match_rows",
    "killlist_rows",
    "video_rows",
    "top_pokemon",
    "top_trainer",
    "review_flags",
    "source_urls",
]


def build_and_write_aggregates(data_dir: Path) -> dict[str, int]:
    normalized_dir = data_dir / "normalized"
    rows = build_aggregate_rows(normalized_dir)
    _write_csv(normalized_dir / "person_all_time.csv", PERSON_ALL_TIME_FIELDS, rows["person_all_time"])
    _write_csv(normalized_dir / "pokemon_all_time.csv", POKEMON_ALL_TIME_FIELDS, rows["pokemon_all_time"])
    _write_csv(normalized_dir / "matchup_summary.csv", MATCHUP_SUMMARY_FIELDS, rows["matchup_summary"])
    _write_csv(normalized_dir / "roster_scores.csv", ROSTER_SCORE_FIELDS, rows["roster_scores"])
    _write_csv(normalized_dir / "season_storylines.csv", SEASON_STORYLINE_FIELDS, rows["season_storylines"])
    return {key: len(value) for key, value in rows.items()}


def build_aggregate_rows(normalized_dir: Path) -> dict[str, list[dict[str, Any]]]:
    people = _read_csv(normalized_dir / "people.csv")
    stints = _read_csv(normalized_dir / "person_stints.csv")
    champions = _read_csv(normalized_dir / "champions.csv")
    matches = _read_csv(normalized_dir / "matches.csv")
    killlists = _read_csv(normalized_dir / "pokemon_killlists.csv")
    rosters = _read_csv(normalized_dir / "team_rosters.csv")
    drafts = _read_csv(normalized_dir / "pokemon_draft_overview.csv")
    data_quality = _read_csv(normalized_dir / "data_quality.csv")
    videos = _read_csv(normalized_dir / "video_archive.csv")

    return {
        "person_all_time": person_all_time_rows(people, stints, champions, matches),
        "pokemon_all_time": pokemon_all_time_rows(killlists, champions, drafts),
        "matchup_summary": matchup_summary_rows(matches),
        "roster_scores": roster_score_rows(rosters, drafts),
        "season_storylines": season_storyline_rows(champions, data_quality, killlists, videos),
    }


@dataclass
class PersonAccumulator:
    person_id: str
    person_name: str
    seasons: set[str] = field(default_factory=set)
    title_seasons: set[str] = field(default_factory=set)
    matches: float = 0
    wins: float = 0
    losses: float = 0
    draws: float = 0
    points: float = 0
    kills: float = 0
    deaths: float = 0
    differential: float = 0
    best_rank: float | None = None
    source_urls: set[str] = field(default_factory=set)


def person_all_time_rows(
    people: list[dict[str, str]],
    stints: list[dict[str, str]],
    champions: list[dict[str, str]],
    matches: list[dict[str, str]],
) -> list[dict[str, Any]]:
    names_by_id = {row.get("person_id") or _person_id(row.get("person_name")): row.get("person_name") or "" for row in people}
    accumulators: dict[str, PersonAccumulator] = {}
    represented_person_seasons: set[tuple[str, str]] = set()

    for row in stints:
        person_name = row.get("person_name") or ""
        person_id = row.get("person_id") or _person_id(person_name)
        if not person_id or not person_name:
            continue
        season_id = row.get("season_id") or ""
        if season_id:
            represented_person_seasons.add((person_id, season_id))
        current = accumulators.setdefault(person_id, PersonAccumulator(person_id, names_by_id.get(person_id) or person_name))
        current.person_name = current.person_name or person_name
        _add_nonempty(current.seasons, season_id)
        current.matches += _number(row.get("matches"))
        current.wins += _number(row.get("wins"))
        current.losses += _number(row.get("losses"))
        current.draws += _number(row.get("draws"))
        current.points += _number(row.get("points"))
        current.kills += _number(row.get("kills"))
        current.deaths += _number(row.get("deaths"))
        differential = _number(row.get("differential"))
        current.differential += differential if row.get("differential") not in {None, ""} else _number(row.get("kills")) - _number(row.get("deaths"))
        rank = _number(row.get("rank"))
        if rank:
            current.best_rank = rank if current.best_rank is None else min(current.best_rank, rank)
        _add_urls(current.source_urls, row.get("source_urls"))

    for row in champions:
        person_name = row.get("champion_name") or ""
        person_id = row.get("champion_person_id") or _person_id(person_name)
        if not person_id or not person_name:
            continue
        current = accumulators.setdefault(person_id, PersonAccumulator(person_id, names_by_id.get(person_id) or person_name))
        current.person_name = current.person_name or person_name
        _add_nonempty(current.title_seasons, row.get("season_id"))
        _add_nonempty(current.seasons, row.get("season_id"))
        _add_urls(current.source_urls, row.get("source_urls"))

    for person_id, stats in _match_stats_by_person(matches, represented_person_seasons).items():
        current = accumulators.setdefault(person_id, PersonAccumulator(person_id, names_by_id.get(person_id) or _display_from_id(person_id)))
        current.seasons.update(stats["seasons"])
        current.matches += stats["matches"]
        current.wins += stats["wins"]
        current.losses += stats["losses"]
        current.draws += stats["draws"]
        current.points += stats["wins"] * 3 + stats["draws"]
        current.source_urls.update(stats["source_urls"])

    elo_by_person = _elo_by_person(matches)
    match_sources = _match_sources_by_person(matches)
    for key, sources in match_sources.items():
        current = accumulators.setdefault(key, PersonAccumulator(key, names_by_id.get(key) or _display_from_id(key)))
        current.source_urls.update(sources)

    rows = []
    for person_id, row in accumulators.items():
        seasons = sorted(row.seasons, key=_season_sort)
        title_seasons = sorted(row.title_seasons, key=_season_sort)
        rows.append(
            {
                "person_id": person_id,
                "person_name": row.person_name,
                "seasons": len(seasons),
                "season_list": _format_season_list(seasons),
                "seasons_won": len(title_seasons),
                "title_seasons": _format_season_list(title_seasons),
                "matches": _format_number(row.matches),
                "wins": _format_number(row.wins),
                "losses": _format_number(row.losses),
                "draws": _format_number(row.draws),
                "win_pct": _percent(row.wins, row.losses, row.draws),
                "weighted_rating": _weighted_rating(row.wins, row.losses, row.draws),
                "elo": _format_number(round(elo_by_person.get(person_id, 1500))),
                "points": _format_number(row.points),
                "kills": _format_number(row.kills),
                "deaths": _format_number(row.deaths),
                "differential": _format_number(row.differential),
                "best_rank": _format_number(row.best_rank),
                "source_urls": _join_urls(row.source_urls),
            }
        )

    return sorted(
        rows,
        key=lambda item: (
            -_number(item.get("seasons_won")),
            -_number(item.get("weighted_rating")),
            -_number(item.get("matches")),
            str(item.get("person_name")),
        ),
    )


def _match_stats_by_person(matches: list[dict[str, str]], represented_person_seasons: set[tuple[str, str]]) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    for row in matches:
        if not _has_played_match_result(row):
            continue
        season_id = row.get("season_id") or ""
        left = row.get("player_a") or ""
        right = row.get("player_b") or ""
        left_id = _person_id(left)
        right_id = _person_id(right)
        winner_id = _person_id(row.get("winner"))
        if not season_id or not left_id or not right_id:
            continue
        for person_id, opponent_id in ((left_id, right_id), (right_id, left_id)):
            if (person_id, season_id) in represented_person_seasons:
                continue
            current = stats.setdefault(
                person_id,
                {"seasons": set(), "matches": 0, "wins": 0, "losses": 0, "draws": 0, "source_urls": set()},
            )
            current["seasons"].add(season_id)
            current["matches"] += 1
            if winner_id == person_id:
                current["wins"] += 1
            elif winner_id == opponent_id:
                current["losses"] += 1
            else:
                current["draws"] += 1
            _add_urls(current["source_urls"], row.get("source_urls"))
    return stats


def _has_played_match_result(row: dict[str, str]) -> bool:
    if row.get("data_status") in {"not_available", "source_video_only"}:
        return False
    if not row.get("player_a") or not row.get("player_b"):
        return False
    if row.get("winner"):
        return True
    return _number_or_none(row.get("score_a")) is not None and _number_or_none(row.get("score_b")) is not None


@dataclass
class PokemonAccumulator:
    pokemon: str
    pokemon_normalized: str
    appearances: float = 0
    kills: float = 0
    deaths: float = 0
    differential: float = 0
    seasons: set[str] = field(default_factory=set)
    title_seasons: set[str] = field(default_factory=set)
    trainers: set[str] = field(default_factory=set)
    teams: set[str] = field(default_factory=set)
    source_urls: set[str] = field(default_factory=set)


def pokemon_all_time_rows(
    killlists: list[dict[str, str]],
    champions: list[dict[str, str]],
    draft_rows: list[dict[str, str]] | None = None,
) -> list[dict[str, Any]]:
    champion_teams_by_season = defaultdict(set)
    champion_sources_by_season = defaultdict(set)
    for row in champions:
        season_id = row.get("season_id") or ""
        if not season_id:
            continue
        _add_nonempty(champion_teams_by_season[season_id], row.get("champion_team"))
        _add_urls(champion_sources_by_season[season_id], row.get("source_urls"))

    accumulators: dict[str, PokemonAccumulator] = {}
    for row in _canonical_pokemon_killlist_rows(killlists):
        if row.get("data_status") == "not_available":
            continue
        pokemon = row.get("pokemon") or ""
        pokemon_key = row.get("pokemon_normalized") or _name_key(pokemon)
        if not pokemon or not pokemon_key:
            continue
        current = accumulators.setdefault(pokemon_key, PokemonAccumulator(pokemon, pokemon_key))
        current.pokemon = current.pokemon or pokemon
        current.appearances += _number(row.get("appearances"))
        current.kills += _number(row.get("kills"))
        current.deaths += _number(row.get("deaths"))
        current.differential += _number(row.get("differential")) if row.get("differential") not in {None, ""} else _number(row.get("kills")) - _number(row.get("deaths"))
        _add_nonempty(current.seasons, row.get("season_id"))
        _add_nonempty(current.trainers, row.get("trainer"))
        _add_nonempty(current.teams, row.get("team_name"))
        _add_urls(current.source_urls, row.get("source_urls"))
        if row.get("team_name") and row.get("team_name") in champion_teams_by_season[row.get("season_id") or ""]:
            _add_nonempty(current.title_seasons, row.get("season_id"))
            current.source_urls.update(champion_sources_by_season[row.get("season_id") or ""])

    for row in draft_rows or []:
        if row.get("picked_status") == "never_picked":
            continue
        pokemon = row.get("pokemon") or ""
        pokemon_key = row.get("pokemon_normalized") or _name_key(pokemon)
        if not pokemon_key or pokemon_key not in accumulators:
            continue
        current = accumulators[pokemon_key]
        current.pokemon = current.pokemon or pokemon
        current.seasons.update(_season_ids_from_list(row.get("season_list")))
        current.title_seasons.update(_season_ids_from_list(row.get("title_seasons")))
        _add_urls(current.source_urls, row.get("source_urls"))

    rows = []
    for item in accumulators.values():
        rows.append(
            {
                "pokemon": item.pokemon,
                "pokemon_normalized": item.pokemon_normalized,
                "appearances": _format_number(item.appearances),
                "kills": _format_number(item.kills),
                "deaths": _format_number(item.deaths),
                "differential": _format_number(item.differential),
                "seasons": len(item.seasons),
                "season_list": _format_season_list(sorted(item.seasons, key=_season_sort)),
                "titles": len(item.title_seasons),
                "title_seasons": _format_season_list(sorted(item.title_seasons, key=_season_sort)),
                "trainers": "; ".join(sorted(item.trainers)),
                "teams": "; ".join(sorted(item.teams)),
                "source_urls": _join_urls(item.source_urls),
            }
        )
    return sorted(rows, key=lambda item: (-_number(item.get("kills")), -_number(item.get("differential")), str(item.get("pokemon"))))


def _canonical_pokemon_killlist_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    by_season: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_season[row.get("season_id") or ""].append(row)

    canonical: list[dict[str, str]] = []
    for season_id, season_rows in by_season.items():
        if season_id == "season_009":
            overall_rows = [row for row in season_rows if row.get("division") == "Overall"]
            if overall_rows:
                canonical.extend(overall_rows)
                continue
        playoff_rows = [row for row in season_rows if row.get("division") == "Playoffs"]
        if season_id == "season_010" and playoff_rows:
            canonical.extend(playoff_rows)
            canonical.extend(_regular_only_killlist_rows(playoff_rows, season_rows))
            continue
        canonical.extend(season_rows)
    return canonical


def _regular_only_killlist_rows(canonical_rows: list[dict[str, str]], season_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    canonical_pokemon = {
        row.get("pokemon_normalized") or _name_key(row.get("pokemon") or "")
        for row in canonical_rows
        if row.get("pokemon_normalized") or row.get("pokemon")
    }
    return [
        row
        for row in season_rows
        if row.get("division") == "Regular Season"
        and (row.get("pokemon_normalized") or _name_key(row.get("pokemon") or "")) not in canonical_pokemon
    ]


def matchup_summary_rows(matches: list[dict[str, str]]) -> list[dict[str, Any]]:
    accumulators: dict[tuple[str, str], dict[str, Any]] = {}
    for row in matches:
        if row.get("data_status") in {"not_available", "source_video_only"}:
            continue
        left = row.get("player_a") or ""
        right = row.get("player_b") or ""
        if not left or not right:
            continue
        winner_id = _person_id(row.get("winner"))
        for person, opponent in [(left, right), (right, left)]:
            key = (_person_id(person), _person_id(opponent))
            current = accumulators.setdefault(
                key,
                {
                    "person_id": key[0],
                    "person_name": _normalized_display_name(person),
                    "opponent_id": key[1],
                    "opponent_name": _normalized_display_name(opponent),
                    "matches": 0,
                    "wins": 0,
                    "losses": 0,
                    "draws": 0,
                    "source_urls": set(),
                },
            )
            current["matches"] += 1
            if winner_id == key[0]:
                current["wins"] += 1
            elif winner_id == key[1]:
                current["losses"] += 1
            else:
                current["draws"] += 1
            _add_urls(current["source_urls"], row.get("source_urls"))

    rows = []
    for row in accumulators.values():
        rows.append(
            {
                "person_id": row["person_id"],
                "person_name": row["person_name"],
                "opponent_id": row["opponent_id"],
                "opponent_name": row["opponent_name"],
                "matches": row["matches"],
                "wins": row["wins"],
                "losses": row["losses"],
                "draws": row["draws"],
                "win_pct": _percent(row["wins"], row["losses"], row["draws"]),
                "source_urls": _join_urls(row["source_urls"]),
            }
        )
    return sorted(rows, key=lambda item: (str(item.get("person_name")), str(item.get("opponent_name"))))


def roster_score_rows(rosters: list[dict[str, str]], drafts: list[dict[str, str]]) -> list[dict[str, Any]]:
    draft_by_key = {row.get("pokemon_normalized") or _name_key(row.get("pokemon")): row for row in drafts}
    grouped: dict[tuple[str, str, str, str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rosters:
        if row.get("data_status") == "not_available":
            continue
        key = (
            row.get("season_id") or "",
            row.get("division") or "",
            row.get("roster_phase") or "",
            row.get("person_name") or "",
            row.get("team_name") or "",
        )
        if key[0] and key[3] and key[4]:
            grouped[key].append(row)

    rows = []
    for (season_id, division, roster_phase, person_name, team_name), items in grouped.items():
        pokemon_items = []
        sources: set[str] = set()
        for row in items:
            pokemon_key = row.get("pokemon_normalized") or _name_key(row.get("pokemon"))
            draft = draft_by_key.get(pokemon_key, {})
            history = min(100, _number(draft.get("draft_count")) * 10 + _number(draft.get("title_count")) * 20)
            pokemon_items.append((history, row.get("pokemon") or pokemon_key))
            _add_urls(sources, row.get("source_urls"))
            _add_urls(sources, draft.get("source_urls"))
        count = len(pokemon_items)
        history_score = round(sum(min(100, item[0]) for item in pokemon_items) / count, 1) if count else 0
        coverage_score = 100 if count >= 11 else round(count / 11 * 100, 1)
        roster_score = round(
            history_score * ROSTER_SCORE_WEIGHTS["history"]
            + coverage_score * ROSTER_SCORE_WEIGHTS["coverage"],
            1,
        )
        top_pokemon = ", ".join(name for _, name in sorted(pokemon_items, reverse=True)[:6])
        rows.append(
            {
                "season_id": season_id,
                "division": division,
                "roster_phase": roster_phase,
                "person_name": person_name,
                "team_name": team_name,
                "pokemon_count": count,
                "roster_score": roster_score,
                "history_score": history_score,
                "coverage_score": coverage_score,
                "top_pokemon": top_pokemon,
                "source_urls": _join_urls(sources),
            }
        )
    return sorted(rows, key=lambda item: (-_number(item.get("roster_score")), _season_sort(str(item.get("season_id"))), str(item.get("person_name"))))


def season_storyline_rows(
    champions: list[dict[str, str]],
    data_quality: list[dict[str, str]],
    killlists: list[dict[str, str]],
    videos: list[dict[str, str]],
) -> list[dict[str, Any]]:
    champions_by_season = {row.get("season_id") or "": row for row in champions if row.get("season_id")}
    quality_by_season = {row.get("season_id") or "": row for row in data_quality if row.get("season_id")}
    kills_by_season = defaultdict(list)
    videos_by_season = defaultdict(list)
    for row in killlists:
        if row.get("data_status") != "not_available":
            kills_by_season[row.get("season_id") or ""].append(row)
    for row in videos:
        videos_by_season[row.get("detected_season_id") or row.get("season_id") or ""].append(row)

    storyline_season_ids = set(champions_by_season) | set(quality_by_season) | set(kills_by_season) | set(videos_by_season)
    season_ids = sorted((season_id for season_id in storyline_season_ids if season_id), key=_season_sort)
    rows = []
    for season_id in season_ids:
        champion = champions_by_season.get(season_id, {})
        quality = quality_by_season.get(season_id, {})
        kill_rows = kills_by_season.get(season_id, [])
        top_pokemon = max(kill_rows, key=lambda row: (_number(row.get("kills")), row.get("pokemon") or ""), default={})
        top_trainer = max(kill_rows, key=lambda row: (_number(row.get("kills")), row.get("trainer") or ""), default={})
        sources: set[str] = set()
        for row in [champion, quality, top_pokemon, top_trainer, *videos_by_season.get(season_id, [])[:10]]:
            _add_urls(sources, row.get("source_urls"))
        rows.append(
            {
                "season_id": season_id,
                "season_label": quality.get("season_label") or _season_label(season_id),
                "champion_name": champion.get("champion_name") or "",
                "champion_team": champion.get("champion_team") or "",
                "quality_score": quality.get("quality_score") or "",
                "match_rows": quality.get("match_rows") or "",
                "killlist_rows": quality.get("killlist_rows") or "",
                "video_rows": quality.get("video_rows") or str(len(videos_by_season.get(season_id, []))),
                "top_pokemon": top_pokemon.get("pokemon") or "",
                "top_trainer": top_trainer.get("trainer") or "",
                "review_flags": quality.get("review_flags") or "",
                "source_urls": _join_urls(sources),
            }
        )
    return rows


def _elo_by_person(matches: list[dict[str, str]], initial_rating: float = 1500, k_factor: float = 32) -> dict[str, float]:
    ratings: dict[str, float] = defaultdict(lambda: initial_rating)
    for row in sorted(matches, key=lambda item: (_season_sort(item.get("season_id") or ""), _week_sort(item.get("week") or ""), item.get("match_id") or "")):
        if row.get("data_status") in {"not_available", "source_video_only"}:
            continue
        left = row.get("player_a") or ""
        right = row.get("player_b") or ""
        if not left or not right:
            continue
        left_key = _person_id(left)
        right_key = _person_id(right)
        winner_key = _person_id(row.get("winner"))
        left_score = 1 if winner_key == left_key else 0 if winner_key == right_key else 0.5
        right_score = 1 - left_score
        left_rating = ratings[left_key]
        right_rating = ratings[right_key]
        left_expected = 1 / (1 + 10 ** ((right_rating - left_rating) / 400))
        right_expected = 1 / (1 + 10 ** ((left_rating - right_rating) / 400))
        ratings[left_key] = left_rating + k_factor * (left_score - left_expected)
        ratings[right_key] = right_rating + k_factor * (right_score - right_expected)
    return dict(ratings)


def _match_sources_by_person(matches: list[dict[str, str]]) -> dict[str, set[str]]:
    sources: dict[str, set[str]] = defaultdict(set)
    for row in matches:
        if row.get("data_status") in {"not_available", "source_video_only"}:
            continue
        for value in [row.get("player_a"), row.get("player_b")]:
            if value:
                _add_urls(sources[_person_id(value)], row.get("source_urls"))
    return sources


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})


def _number(value: Any) -> float:
    if value is None:
        return 0
    text = str(value).strip().replace(",", ".")
    if not text:
        return 0
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?[0-9]+(?:\.[0-9]+)?", text)
        return float(match.group(0)) if match else 0


def _number_or_none(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", ".")
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?[0-9]+(?:\.[0-9]+)?", text)
        return float(match.group(0)) if match else None


def _format_number(value: Any) -> str:
    if value is None:
        return ""
    number = _number(value)
    if math.isclose(number, round(number)):
        return str(int(round(number)))
    return f"{number:.1f}"


def _percent(wins: float, losses: float, draws: float) -> str:
    total = wins + losses + draws
    if not total:
        return ""
    return f"{((wins + draws * 0.5) / total * 100):.1f}"


def _weighted_rating(
    wins: float,
    losses: float,
    draws: float,
    prior_rate: float = BAYES_PRIOR_RATE,
    prior_games: float = BAYES_PRIOR_GAMES,
) -> str:
    value = _bayes_rating_value(wins, losses, draws, prior_rate, prior_games)
    return "" if value is None else f"{value:.1f}"


def _bayes_rating_value(
    wins: float,
    losses: float,
    draws: float,
    prior_rate: float = BAYES_PRIOR_RATE,
    prior_games: float = BAYES_PRIOR_GAMES,
    uncertainty_weight: float = BAYES_UNCERTAINTY_WEIGHT,
) -> float | None:
    games = wins + losses + draws
    if not games:
        return None
    successes = wins + draws * 0.5
    failures = losses + draws * 0.5
    alpha = prior_rate * prior_games + successes
    beta = (1 - prior_rate) * prior_games + failures
    total = alpha + beta
    if total <= 0:
        return None
    mean = alpha / total
    variance = (alpha * beta) / ((total**2) * (total + 1))
    value = (mean - uncertainty_weight * math.sqrt(max(0, variance))) * 100
    return max(0, min(100, value))


def _person_id(value: str | None) -> str:
    return _normalized_person_id(value)


def _display_from_id(value: str) -> str:
    return value.removeprefix("person_").replace("_", " ").title()


def _name_key(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "_", ascii_text.lower()).strip("_")


def _season_sort(value: str | None) -> tuple[int, str]:
    match = re.search(r"([0-9]+)", str(value or ""))
    return (int(match.group(1)) if match else 999, str(value or ""))


def _week_sort(value: str | None) -> tuple[int, str]:
    text = str(value or "")
    match = re.search(r"([0-9]+)", text)
    if match:
        return (int(match.group(1)), text)
    if "final" in text.lower() or "finale" in text.lower():
        return (999, text)
    return (900, text)


def _season_label(value: str | None) -> str:
    match = re.search(r"([0-9]+)", str(value or ""))
    return f"S{int(match.group(1))}" if match else str(value or "")


def _format_season_list(season_ids: list[str]) -> str:
    return ", ".join(_season_label(season_id) for season_id in season_ids)


def _season_ids_from_list(value: str | None) -> set[str]:
    return {f"season_{int(match.group(1)):03d}" for match in re.finditer(r"([0-9]+)", str(value or ""))}


def _add_nonempty(values: set[str], value: str | None) -> None:
    text = str(value or "").strip()
    if text:
        values.add(text)


def _add_urls(urls: set[str], value: str | None) -> None:
    for item in str(value or "").split(";"):
        item = item.strip()
        if item:
            urls.add(item)


def _join_urls(urls: set[str]) -> str:
    return ";".join(sorted(urls))
