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

## Result Semantics (`result_basis` in matches.csv)

Special results are encoded explicitly instead of living in gaps (added July 2026, participant-confirmed by Bene):

- `two_sided_score` (7 rows, S1/S2): both sides' surviving Pokémon are recorded instead of the usual "winner's survivors : 0" convention.
- `draw` (12 rows): winner-less matches covered by the official draw counts — they match season by season (S1 Spieltag 5, S2, S3 Liga 2, S4, S5's real 1:1, S6).
- `forfeit` (6 rows, S1): Morbolth forfeited his remaining matches from Spieltag 15 on; the official table counts them as losses (his row reads 4-17-1), so the opponent carries the win. The score stays 0:0 because nothing was played. Elo counts these wins like the league did.
- `unresolved` (2 rows, S1): the manually sourced Spieltage 21/22 rows have no confirmable result; reconstructions skip them entirely, like the uncaptured matchdays around them.

Two further participant-confirmed winner corrections (S10): Domji won the 0:0 Spieltag-4 match against Blocki, Blocki won the 0:0 Spieltag-12 match against Snomnie.

Season 10's final table folds in the fully sourced Spieltag 13, which the official sheet stopped counting (all rows are marked `sheet_extracted_with_user_correction`). Kills and deaths for those matches follow the elimination convention (winner 6 kills / 6−score deaths); ranks re-sort by points but keep the official order as tiebreak, preserving the Minetube/PresentLP direct-comparison decision. Playoff seeding keeps the official Spieltag-12 state.

Three final-table rows keep a flagged internal contradiction (kills − deaths ≠ differential) because the match scores support neither candidate value: S3 SurskitTV, S4 Dauni, S5 BraveBird. Three others (S4 Scoutley, S5 Bene, S5 CrowdController) were corrected via match-score arbitration.

## Killlist Coverage

`data_quality.csv` carries `killlist_kill_coverage`: canonical killlist kills ÷ final-table kills per season, as a whole percent. Row counts hide how partial the old killlists are — S1 covers 37% of the kills, S2 64%, and S3–S5 sit near 50% because their killlists only cover Liga 1. Values above 100 are possible where the killlist counts more scope than the tables (S10's canonical list includes the playoffs). Seasons below 90% carry the `killlist_coverage_low` review flag.

The `missing_killlist_appearances` review queue (S2–S6) has no matchday-level source to fill it from: the Kader-sheet matchday grids only exist for S9/S10, and those killlists already carry complete appearance counts.

`data/review/unfetched_sheets.csv` lists every Google-Sheets workbook that appears in archived video descriptions but was never fetched (sheet discovery only mined the season playlists). The 2026 triage found 142 still reachable — almost all belong to other leagues; the only GPL data recovered this way was the Season 3 Liga 2 final table, which is now part of the raw data.

## Web App Notes

Aggregated tables expose both a season count and a season list where the data spans multiple seasons. Person detail pages keep one canonical Pokemon/kills table; the top story cards surface the strongest highlights without duplicating the same Pokemon rows as a second table.

## Elo-Derived Views (Upset-Index, Karriere-Kurve, Elo-Kontoauszug)

These views compute Elo (K=32, start 1500) from the match chronology at runtime; the numbers match the `elo` column in `person_all_time.csv` by construction (enforced by `tests/web_elo_consistency.test.mjs`). They inherit the Zeitreise result semantics below: forfeit wins count like the league counted them, winner-less rows score 0.5, `unresolved` rows stay out. Pregame win probabilities and the upset ranking are computed, not sourced claims; each row still links its match video and source URLs. The season filter narrows which matches are displayed, but ratings always accumulate over the full chronology of the selected data basis.

## Computed Awards and Records

`streaks.csv`, `records_progression.csv`, and `awards.csv` are generated aggregates, not sourced claims: the GPL never awarded an official MVP or kept a record book. Every award row carries a `formula` id whose exact definition is shown in the web app, and every row keeps the `source_urls` of the underlying data. Kill-based awards and person kill records use the standings kill columns (complete per season); Pokémon kill records use the killlists and therefore inherit the coverage limits described under Killlist Coverage — early-season Pokémon records undercount. Streaks and Elo-based records follow the result semantics above (forfeit wins count like the league counted them, winner-less rows are draws, `unresolved` rows are skipped).

## Rivalitäten and Orakel (computed)

The rivalry ranking is computed, not sourced: score = meetings × (0.2 + closeness) × (1 + log10(1 + pair video views)), with closeness = 1 − |wins difference| / meetings, over `matchup_summary.csv` pairs with at least 3 meetings; the formula is printed in the view. Rivalry detail pages and their Elo-gap chart run on the full-archive client Elo chronology (K=32, start 1500) and inherit the result semantics above; the toolbar is hidden on these views because they are career-scope. The former matchup checker merged into the rivalry pair pages: the index carries pair pickers for any two people, and old `#/matchup` links redirect to the rivalry index.

The Orakel finds chains of transitive wins ("A beat B, B beat C") over a directed winner-to-loser graph. Only matches that were actually played and decided are edges: `forfeit` rows (never played), `unresolved` rows, and draws are excluded — so a forfeit win counts for the league table and Elo, but never for a win chain. The dominance leaderboard counts how many players someone beats directly and via chains; the share is over all archive players who appear in that graph.

## Spiele (computed)

All four games are generated from the normalized CSVs — nothing is hand-authored and nothing is official. The daily Kader-Raten puzzle is seeded by the visitor's local date, so users in different time zones can see the day roll over at different moments; rosters need at least six known Pokémon to qualify, so seasons with thin roster coverage never appear, and the free-play mode draws session-seeded rosters that never touch the daily streak. The Tipp-Spiel only offers matches that were actually played, decided, and fully scored (the same forfeit/unresolved exclusions as the Orakel), and its Elo forecast comes from the client-side full-archive chronology (K=32, start 1500) — computed, not official; both sides render as team panels over the season's roster background, and players without recorded rosters show the panel without sprites. Quiz questions are built from champions, primary final tables, killlists (only trainers whose top killer is unambiguous), and head-to-heads with at least 5 meetings and a clear leader; in the "Alle" category the draw is weighted by the square root of each pool's size, so small pools like champions still appear but proportionally less often, and every reveal cites the source rows it was generated from. Only the daily Kader-Raten progress and streak persist in localStorage (`gpl-game-kader-raten-*`); every other score — Tipp-Spiel tally, Klick-Duell streaks, all quiz modes (Endlos, Blitz, Sudden Death) — is session-only and resets on reload. Klick-Duell thumbnails load from `i.ytimg.com` and degrade to text when offline.

## Zeitreise View

The Zeitreise view replays the archive over a single timeline of 192 ticks: one per matchday, plus a trailing tick for each playoff round. Only seasons 6 and 10 played playoffs. Season 7's `stage=playoffs` row records a title, not a match — it has a winner but no opponent — and is therefore excluded, along with the 514 `video_source` rows that carry a video id but no players.

Points where the view interprets rather than reports:

- **Winner-less matches count as draws** — since `result_basis` landed, every remaining winner-less row is covered by the official draw counts; `unresolved` rows (S1 Spieltage 21/22) stay out of the reconstruction entirely. Elo still scores winner-less rows 0.5.
- **Points are reconstructed as three per win and one per draw.** Point deductions recorded in `standings.csv` (ten rows across seasons 2, 3, 4 and 6) cannot be derived from match rows, so the reconstructed table drifts from the official one wherever a deduction applied (Lauris' S3 3-strikes deduction shows as a +1 points drift).
- **The killlist leader race is cumulative and interpolated.** Killlists are aggregated per season, so the race sums kills from season 1 through the running season; positions inside a season are evenly projected between the measured season totals (user-approved smoothing), and the view says so. The board runs on a season axis, is unaffected by matchdays, and respects the data-basis filter (all / without Liga 2 / Liga 2 only), which also rebuilds the Elo and replay tracks on the chosen slice.
- **Ties in the reconstructed tables break on differential.** In a 6v6 played to elimination the kill differential of a match equals ±(the winner's surviving Pokémon), which is what the score columns record; S7 reproduces 13 of 14 official differentials exactly. Point deductions still cannot be derived.
- **Season 3 replays as two leagues.** Matches and final tables carry proper Liga 1 / Liga 2 divisions since the split (the Liga 2 table was provided by Bene). Liga 1 reconstructs exactly apart from Lauris' deduction and the LucarioLP→Bene controller split. Liga 2's official table is team-based with six mid-season controller switches, so only full-season players reproduce their official rows; slot predecessors (WolvX, KilluaSan, …) and Liga-1 guests (Lauris, Shiro) appear as unofficial person rows.
- **Elo is zero-sum, so a champion season can still flatten or dip.** A highly rated player wins little (+4 to +9) against a weaker field and loses a lot (−25 or more) on an upset. Season 9 is the canonical example: Bene goes 11-3 in the Doubles bracket — exactly matching the official standings — yet ends the season two points below where he started, because 79% wins is almost exactly what Elo expected of him.

At the end of each regular season the reconstructed table is compared against `standings.csv` and any drift is labelled rather than smoothed away. Season 8 (both leagues), season 7, season 6's Sun Conference, season 4's Liga 2 and season 10 reconstruct exactly (S10 since Spieltag 13 was folded into the official table); season 1 keeps a uniform two-match gap for the uncaptured Spieltage 21/22. During playoff ticks (seasons 6 and 10) the replay switches from the league table to the knockout rounds. Season 7 has no playoff rows at all: the previously synthesized S7 playoff standings/match rows were removed from the pipeline after participant confirmation that no playoffs were played.
