# Known Limitations and Review Workflow

This archive is CSV-first and source-first. Empty fields mean unknown values, not hidden assumptions.

## What Is Sourced

- Normalized standings, matches, champions, teams, person stints, Pokemon killlists, and videos preserve source URLs where available.
- `data/normalized/source_claims.csv` lists field-level claims generated from normalized rows.
- `data/normalized/data_quality.csv` summarizes season coverage and review-heavy areas.

## What Needs Review

Generated review queues live under `data/review/`:

- `missing_killlists.csv`: known killlist sources or placeholders that remain unavailable.
- `missing_killlist_appearances.csv`: killlist rows with kills but no sourced appearance count.
- `low_confidence_videos.csv`: video-to-match assignments that should be checked manually.
- `ambiguous_matches.csv`: game-like GPL videos that are not matched to a normalized match.
- `review_index.csv`: row counts, severity, correction target files, and suggested actions.

## Correction Rules

- Do not infer champions, kills, appearances, standings, or match winners.
- Add corrections only to `data/manual/*.csv`.
- Preserve the source URL that supports the correction.
- Leave uncertain fields blank.
- Run regeneration and validation after every correction:

```powershell
gpl-history normalize --data-dir data
gpl-history review-queue --data-dir data
gpl-history validate --data-dir data --strict
gpl-history check-generated --data-dir data
```

## Quality Scores

Quality scores are archive coverage scores. They are not claims that the historical record is perfect.

Scores combine available standings, matches, champions, killlists, video coverage, and review flags. A complete season can still have review flags if, for example, video matches are low-confidence or old killlists lack appearance counts.

## Web App Notes

Aggregated tables expose both a season count and a season list where the data spans multiple seasons. Person detail pages keep one canonical Pokemon/kills table; the top story cards surface the strongest highlights without duplicating the same Pokemon rows as a second table.
