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

## Zeitreise View

The Zeitreise view replays the archive over a single timeline of 192 ticks: one per matchday, plus a trailing tick for each playoff round. Only seasons 6 and 10 played playoffs. Season 7's `stage=playoffs` row records a title, not a match — it has a winner but no opponent — and is therefore excluded, along with the 514 `video_source` rows that carry a video id but no players.

Three points where the view interprets rather than reports:

- **A missing match winner is scored as a draw**, matching the 0.5 that `eloRatings` already assigns. The data cannot distinguish a true draw from a result that was never captured: in seasons 4 to 6 the winner-less matches line up exactly with the official draw counts, in seasons 1, 3 and 10 they do not.
- **Points are reconstructed as three per win and one per draw.** Point deductions recorded in `standings.csv` (ten rows across seasons 2, 3, 4 and 6) cannot be derived from match rows, so the reconstructed table drifts from the official one wherever a deduction applied.
- **The killlist leader race is cumulative and interpolated.** Killlists are aggregated per season, so the race sums kills from season 1 through the running season; positions inside a season are evenly projected between the measured season totals (user-approved smoothing), and the view says so. The board runs on a season axis, is unaffected by matchdays, and respects the data-basis filter (all / without Liga 2 / Liga 2 only), which also rebuilds the Elo and replay tracks on the chosen slice.
- **Ties in the reconstructed tables break on differential.** In a 6v6 played to elimination the kill differential of a match equals ±(the winner's surviving Pokémon), which is what the score columns record; S7 reproduces 13 of 14 official differentials exactly. Point deductions still cannot be derived.
- **Season 3's replay table is filtered to Liga 1.** All S3 matches carry the division "Regular Season" although two leagues played, and only Liga 1 has an official table. The replay keeps matches between official Liga-1 members (plus inferred controller stand-ins such as LucarioLP); Liga-2-only pairings have no official table to validate against and are not shown as a league table.
- **Elo is zero-sum, so a champion season can still flatten or dip.** A highly rated player wins little (+4 to +9) against a weaker field and loses a lot (−25 or more) on an upset. Season 9 is the canonical example: Bene goes 11-3 in the Doubles bracket — exactly matching the official standings — yet ends the season two points below where he started, because 79% wins is almost exactly what Elo expected of him.

At the end of each regular season the reconstructed table is compared against `standings.csv` and any drift is labelled rather than smoothed away. Season 8 (both leagues), season 7, season 6's Sun Conference and season 4's Liga 2 reconstruct exactly. Season 10 shows a uniform surplus of one battle per person because its 13th matchday does not feed into the official table; season 1 is genuinely incomplete. During playoff ticks (seasons 6 and 10) the replay switches from the league table to the knockout rounds. Season 7 has no playoff rows at all: the previously synthesized S7 playoff standings/match rows were removed from the pipeline after participant confirmation that no playoffs were played.
