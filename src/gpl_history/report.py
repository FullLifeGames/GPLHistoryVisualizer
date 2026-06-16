from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


def generate_report(data_dir: Path, out_path: Path) -> None:
    normalized_dir = data_dir / "normalized"
    seasons = _read_csv(normalized_dir / "seasons.csv")
    teams = _read_csv(normalized_dir / "teams.csv")
    standings = _read_csv(normalized_dir / "standings.csv")
    person_stints = _read_csv(normalized_dir / "person_stints.csv")
    matches = _read_csv(normalized_dir / "matches.csv")
    champions = _read_csv(normalized_dir / "champions.csv")
    killlists = _read_csv(normalized_dir / "pokemon_killlists.csv")
    source_claims = _read_csv(normalized_dir / "source_claims.csv")
    data_quality = _read_csv(normalized_dir / "data_quality.csv")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# German Pokémon League History",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "This report is generated from the normalized CSV files. Champions are recorded from sourced adapter evidence where available. Rows marked `user_provided` are explicit corrections only; unavailable playoff winners remain null.",
        "",
        "## Data Files",
        "",
        "- `data/normalized/seasons.csv`",
        "- `data/normalized/people.csv`",
        "- `data/normalized/teams.csv`",
        "- `data/normalized/standings.csv`",
        "- `data/normalized/person_stints.csv`",
        "- `data/normalized/matches.csv`",
        "- `data/normalized/champions.csv`",
        "- `data/normalized/pokemon_killlists.csv`",
        "- `data/normalized/aliases_review.csv`",
        "- `data/normalized/source_claims.csv`",
        "- `data/normalized/data_quality.csv`",
        "",
        "## Coverage",
        "",
        f"- Source claim rows: {len(source_claims)}",
        f"- Data quality rows: {len(data_quality)}",
        "",
        f"- Seasons represented: {len(seasons)}",
        f"- Team rows: {_available_count(teams)} available, {_status_count(teams).get('not_available', 0)} not available",
        f"- Standing rows: {_available_count(standings)} available, {_status_count(standings).get('not_available', 0)} not available",
        f"- Person stint rows: {_available_count(person_stints)} available, {_status_count(person_stints).get('not_available', 0)} not available",
        f"- Match rows: {_available_count(matches)} available/source-video rows, {_status_count(matches).get('not_available', 0)} not available",
        f"- Champion rows with title evidence/corrections: {sum(1 for row in champions if row.get('data_status') in {'source_evidenced', 'user_provided'})}",
        f"- Pokémon killlist rows: {_available_count(killlists)} available, {_status_count(killlists).get('not_available', 0)} not available",
        "",
        "## Season CSV Source Index",
        "",
    ]

    by_season = _group_by_season(teams, standings, person_stints, matches, champions, killlists)
    for season in seasons:
        season_id = season.get("season_id")
        season_claims = by_season.get(season_id, {})
        lines.extend(
            [
                f"### {season_id}: {_clean_text(season.get('playlist_title') or season.get('season_label') or 'Untitled playlist')}",
                "",
                f"- Season source URLs: {season.get('playlist_url') or 'null'}",
                f"- Video count: {season.get('source_video_count') or '0'}",
                f"- Date range: {season.get('start_date') or 'null'} to {season.get('end_date') or 'null'}",
                f"- GPL-related heuristic: {season.get('is_gpl_related') or 'false'}",
                f"- Divisions/stages represented: {_division_summary(season_claims)}",
                "",
                "| Claim Type | Status | Source URLs |",
                "| --- | --- | --- |",
            ]
        )
        for claim_type, rows in season_claims.items():
            statuses = _status_count(rows)
            status_text = ", ".join(f"{key}: {value}" for key, value in sorted(statuses.items())) or "none"
            source_urls = _source_urls(rows) or "null"
            lines.append(f"| {claim_type} | {status_text} | {source_urls} |")
        lines.append("")

    lines.extend(
        [
            "## Data Gaps",
            "",
            "Rows marked `not_available` are intentional placeholders so missing historical data can be inserted later without changing the schema.",
            "Blank fields represent null/unknown values. They were not inferred.",
            "",
            "## Name Normalization",
            "",
            "Names are normalized conservatively by lowercasing, trimming whitespace, folding common German characters, and applying reviewed aliases. Current explicit aliases include `FullLifeGames -> Bene`, `Kaffecone/Kaffeecone -> Art'n'Gaming`, and `CabgoLord/Fnupa -> Cabgolord`. Possible additional merges are listed in `data/normalized/aliases_review.csv` for human review.",
            "",
        ]
    )

    out_path.write_text("\n".join(lines), encoding="utf-8")


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _status_count(rows: list[dict[str, str]]) -> Counter[str]:
    return Counter(row.get("data_status") or "unknown" for row in rows)


def _available_count(rows: list[dict[str, str]]) -> int:
    return sum(1 for row in rows if row.get("data_status") != "not_available")


def _group_by_season(*tables: list[dict[str, str]]) -> dict[str, dict[str, list[dict[str, str]]]]:
    names = ["teams", "standings", "person_stints", "matches", "champions", "pokemon_killlists"]
    grouped: dict[str, dict[str, list[dict[str, str]]]] = defaultdict(dict)
    for name, rows in zip(names, tables):
        season_rows: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in rows:
            season_rows[row.get("season_id", "")].append(row)
        for season_id, entries in season_rows.items():
            grouped[season_id][name] = entries
    return grouped


def _source_urls(rows: list[dict[str, str]]) -> str:
    urls: list[str] = []
    for row in rows:
        for url in (row.get("source_urls") or "").split(";"):
            if url and url not in urls:
                urls.append(url)
    return "<br>".join(urls[:8])


def _division_summary(claims: dict[str, list[dict[str, str]]]) -> str:
    counts: Counter[str] = Counter()
    for table in ("teams", "standings", "person_stints", "matches", "pokemon_killlists"):
        for row in claims.get(table, []):
            if row.get("data_status") == "not_available":
                continue
            division = (row.get("division") or row.get("stage") or "").rstrip(":").strip()
            if division:
                counts[division] += 1
    return ", ".join(f"{division}: {count}" for division, count in sorted(counts.items())) or "none"


def _clean_text(value: str) -> str:
    if "Ã" not in value and "Â" not in value:
        return value
    try:
        return value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value
