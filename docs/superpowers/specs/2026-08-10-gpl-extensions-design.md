# GPL Extensions Program Design

Date: 2026-08-10

## Context

The archive currently ships 20+ views over normalized CSVs. A researched extension round (dashboards studied: Pokemon DraftZone, draft-league.nl, Pikalytics, Baseball-/Basketball-Reference, FBref, Transfermarkt, ClubElo, eloratings.net, FiveThirtyEight, HLTV, Liquipedia, speedrun.com, fantasy-league recap tools, NYT/Pudding interactives) produced 16 approved features. This document fixes their clustering, build order, menu placement, data model, and semantics. Implementation is split into per-phase plans under `docs/superpowers/plans/`; Phase 0+1 is planned in `2026-08-10-gpl-extensions-phase0-1.md`.

Approved by Bene on 2026-08-10 (feature list); this spec awaits review before implementation.

## Goals

1. Ship the 16 approved features in wow-per-effort order, clustered so shared infrastructure is built once.
2. Restructure the top navigation so new views get a fitting home without cluttering any group (current Seasons group already holds 8 views).
3. Keep every principle of the archive intact: source URLs on every claim, computed vs sourced clearly labeled, simulations visually quarantined, static site, bilingual de/en.
4. Keep JS/Python duplication minimal: Elo stays client-side where recomputation is cheap; pipeline CSVs only for content that must be deterministic and auditable (records, awards, streaks, title odds).

## Non-Goals

- Do not implement the unselected research ideas (Ewige Tabelle, xW/Luck/SoS columns, field-strength rating, as-of leaderboard time machine, similarity scores, percentile bars, Redraft, Elo-Labor).
- Do not add a build step, framework, or server; the site stays static ES modules + CDN globals.
- Do not collect new external data (no draft pick order, no new sheet fetching) in this program.
- Do not invent facts: no simulated value may ever be displayed without a simulation label.

## Feature Ordering (wow × ease)

Wow and ease on 1–5 (5 = highest wow / easiest). Order within phases is build order.

| # | Feature | Wow | Ease | Phase |
|---|---|---|---|---|
| 1 | Upset-Index | 5 | 4 | 1 |
| 2 | Karriere-Kurve + Elo-Kontoauszug | 5 | 3.5 | 1 |
| 3 | Rekordbuch + Match-/Streak-Finder (one view) | 5 | 2.5 | 2 |
| 4 | Retro awards + trophy case | 4 | 3 | 2 |
| 5 | Hall of Fame (+ Holzlöffel tab) | 3.5 | 3 | 2 |
| 6 | Rivalitäten-Seiten | 3.5 | 3.5 | 3 |
| 7 | Orakel der GPL (six degrees) | 3.5 | 4.5 | 3 |
| 8 | Kader-Raten (daily puzzle) | 4 | 4 | 4 |
| 9 | Tipp-Spiel (you vs. Elo) | 4 | 4 | 4 |
| 10 | Klick-Duell (higher/lower views) | 3 | 4.5 | 4 |
| 11 | GPL-Quizshow | 3 | 4 | 4 |
| 12 | Publikums-Geschichte | 3.5 | 3 | 5 |
| 13 | Zeitstrahl + An diesem Tag | 3.5 | 3.5 | 5 |
| 14 | Retro title odds ("Titelrennen") | 4 | 2 | 6 |
| 15 | Season Story scrollytelling | 5 | 2 | 6 |
| 16 | GPL Wrapped cards | 4.5 | 2.5 | 6 |
| 17 | Zeitmaschinen-Duell | 4.5 | 2 | 7 |

Phases 2–5 are mutually independent and may be reordered; 6 depends on 2 (awards feed Wrapped) and benefits from 5; 7 is independent but last because it needs a new CDN dependency (`@pkmn/data`).

## Phase Roadmap

- **Phase 0 — Foundations.** Menu restructure (new groups with existing views only); `web/elo_history.js` (client-side per-match Elo chronology: pregame ratings, win probability, delta, per-person timelines, peaks — via the existing `eloRatings` `onMatch` hook, stats.js:635); `web/charts.js` (generic d3 line/step chart helper themed on `--viz-*` CSS vars — zeitreise internals are a singleton and stay untouched; `timeline.js` remains the shared data layer).
- **Phase 1 — Elo sichtbar.** Upset-Index view (founds the Rekorde group); person-details gains Karriere-Kurve chart + Kontoauszug ledger. Pure frontend, no pipeline change.
- **Phase 2 — Rekorde & Ehrungen.** Pipeline emits `streaks.csv`, `records_progression.csv`, `awards.csv` (aggregates pattern); Rekordbuch view with Rekorde/Finder/Streaks tabs; Auszeichnungen gallery; Hall of Fame with Holzlöffel tab; trophy shelf on person-details.
- **Phase 3 — Duelle.** Rivalitäten index + rivalry detail route; Orakel view. Group already exists from Phase 0.
- **Phase 4 — Spiele.** Games hub + four games (Kader-Raten, Tipp-Spiel, Klick-Duell, Quizshow) sharing seeded-RNG/localStorage/reveal-with-source utilities.
- **Phase 5 — Videos & Zeit.** Publikums-Geschichte charts; Zeitstrahl calendar timeline with An-diesem-Tag widget.
- **Phase 6 — Saison-Erzählungen.** `title_odds.csv` (seeded Monte-Carlo); Titelrennen chart in table-history; Season Story scrollytelling; GPL Wrapped cards.
- **Phase 7 — Zeitmaschinen-Duell.** `@pkmn/data` CDN integration; team-vs-team matchup sheet in the Duelle group.

## Menu Restructure

Eight primary groups (currently four). View ids never change, so all existing `#/`-hash URLs keep working; moving a view between groups is transparent because routing derives the group from the view id (`viewGroupForView`). New groups are only created in the phase where their first view lands.

| Group id | Label de / en | Views (subnav) | Detail views |
|---|---|---|---|
| `people` | Spieler / People | all-time, team-rosters | person-details, roster-detail |
| `duels` (Phase 0) | Duelle / Head-to-Head | matchup, rivalries (P3), oracle (P3), team-duel (P7) | rivalry-detail (P3) |
| `pokemon` | Pokémon / Pokémon | killlists, pokemon-drafts | pokemon-detail |
| `seasons` | Saisons / Seasons | battle-history, match-highlights, season-detail, table-history, match-plan, zeitreise | season-story (P6) |
| `videos` (Phase 0) | Videos / Videos | video-archive, cinema, audience-history (P5), zeitstrahl (P5) | — |
| `records` (Phase 1) | Rekorde / Records | upset-index, record-book (P2), awards (P2), hall-of-fame (P2) | — |
| `games` (Phase 4) | Spiele / Games | games (hub) | game (routed `#/spiel/<gameId>`) |
| `data` | Daten / Data | unchanged (8 views) | — |

Per-feature placement decisions taken from the user's notes: Match-/Streak-Finder lives **inside** the Rekordbuch view as tabs, not as its own menu entry; Holzlöffel is a tab inside Hall of Fame; the four games are one menu entry (hub) with routed sub-pages; An diesem Tag is a widget at the top of Zeitstrahl (plus an optional small teaser chip on the default view, dismissible, added only if it stays visually quiet).

## Data Model Additions

All generated under `data/normalized/` via the aggregates pattern (FIELDS constant ending in `source_urls`, pure `*_rows()` builder, registration in `build_aggregate_rows`/`build_and_write_aggregates` + `GENERATED_ARTIFACTS`, byte-deterministic output) unless noted.

### `data/normalized/streaks.csv` (Phase 2)
One row per (person, streak type, streak instance) above a minimum length. Fields: `person_id`, `person_name`, `streak_type` (win/unbeaten/loss/sweep), `length`, `start_season_id`, `start_week`, `end_season_id`, `end_week`, `start_match_id`, `end_match_id`, `active` (ended by loss vs. by data end), `source_urls`.

### `data/normalized/records_progression.csv` (Phase 2)
One row per record hand-off: every time a tracked all-time record improved. Fields: `record_key` (longest_win_streak, most_match_kills, most_career_kills, highest_elo, biggest_blowout, most_sweeps, most_seasons, most_matches), `holder_person_id`, `holder_name`, `holder_pokemon` (for Pokémon records, else empty), `value`, `season_id`, `week`, `match_id`, `video_url`, `superseded` (0/1), `source_urls`. Elo records use the Python Elo replay (`_elo_by_person` extended with a per-match snapshot callback); "date" is never shown from this file — the frontend labels steps by season/matchday, optionally resolving upload dates from `match_videos.csv` with the video-upload-date caveat.

### `data/normalized/awards.csv` (Phase 2)
One row per (season × award) plus career badges. Fields: `award_key` (mvp, kill_leader, best_newcomer, upset_of_season, giant_slayer, iron_man, holzloeffel, holzloeffel_redemption, champion), `scope` (season/career), `season_id` (empty for career), `division`, `person_id`, `person_name`, `value`, `formula` (short formula id resolved to explanation text in i18n), `source_urls`. Every award view labels these "berechnet, nicht offiziell" / "computed, not official".

### `data/normalized/title_odds.csv` (Phase 6)
One row per (season, division, matchday, person). Fields: `season_id`, `division`, `week`, `person_id`, `person_name`, `p_first`, `p_playoffs` (empty when the season had no playoffs), `sims`, `seed`, `source_urls`. Produced by a dedicated command `gpl-history title-odds` (seeded `random.Random`, fixed seed recorded per row; Mersenne Twister is version-stable so output stays deterministic). Not part of the `check-generated` regeneration chain (simulation cost); documented in README regeneration flow instead. The frontend renders it only with a "Simulation" label and dashed styling.

### Wrapped card assets (Phase 6)
Per-season shareable PNGs generated by a dedicated command `gpl-history wrapped-cards` (Pillow, optional dependency) into `web/assets/wrapped/`; not drift-checked (PNG bytes are not stably reproducible across Pillow versions). Career Wrapped is DOM-only slides, no PNG export in v1. Superlative inputs come from `awards.csv`, `match_highlights.csv`, `champions.csv`, `video_archive.csv`.

No changes to any existing normalized CSV. New aggregate CSVs follow the existing precedent of aggregates: drift-checked (except `title_odds.csv`) but not schema-validated in `NORMALIZED_FIELDS`.

## WebApp Behavior

### Phase 0 foundations
- `web/elo_history.js` exports `eloChronology(matches, normalizeKey)` → `{ perMatch, perPerson, order }` where `perMatch: Map<match_id, {aKey, bKey, eloPreA, eloPreB, winProbA, eloAfterA, eloAfterB, deltaA}>`, `perPerson: Map<personKey, {name, points: [{seq, matchId, seasonId, week, order, rating}], peak: {rating, matchId}}>`. Win probability = the standard Elo expected score (400-divisor), identical to `eloRatings` internals. Computed once per (data-basis slice) and cached by the caller.
- `web/charts.js` exports `lineChart(container, config)` and `stepChart(container, config)`; d3 v7 SVG, colors only from `--viz-*` CSS vars, redraw on `data-theme` mutation and resize (same observer pattern as zeitreise), tooltip + marker support. Pure helpers (domain padding, tick building, series clipping) are exported for node tests; DOM assembly is untested, consistent with zeitreise.

### Upset-Index (Phase 1, `records` group)
Ranks all decided matches by the winner's pregame win probability ascending (`upset_score = 1 − winProb(winner)`). Excludes `result_basis` forfeit/unresolved rows and winner-less rows. Shows: top-10 cards (players with pregame Elos, probability "Elo gab ihm 18 %", score, season/matchday, video thumbnail link) and a full Tabulator (columns: season, week, players, pregame Elos, win prob, score, upset score, view z-score where `match_highlights.csv` has the match, video, sources). Respects the existing data-mode filter; recomputes chronology per slice.

### Karriere-Kurve + Kontoauszug (Phase 1, inside person-details)
New chart block between the summary cards and the timeline table: full-career Elo line (x = match sequence with season boundaries marked, y = rating), team-colored stint bands from `person_stints.csv`, champion markers from `champions.csv`, labeled career peak, hover resolves the underlying match. Below it a new collapsible "Elo-Kontoauszug" table: one row per match — season, matchday, opponent (link), score, signed ±Elo (green/red), rating after, video link (`videoLinksForMatch`), sources. Both driven by `eloChronology` on the current data-basis slice; no pipeline involvement.

### Rekordbuch (Phase 2, `records` group)
Three tabs in one view. **Rekorde:** current holders table + per-record staircase (`stepChart`) of `records_progression.csv`, every step clickable to its video. **Finder:** form-driven query over loaded matches (season, division, stage, margin, participant, Pokémon brought via `roster_matchdays.csv` join) rendering a match table; record rows deep-link into prefilled Finder states via hash params. **Streaks:** top streaks from `streaks.csv` with start/end match links.

### Auszeichnungen + trophy shelf (Phase 2)
Awards view: season selector → award cards (award, winner link, value, formula explainer) + all-time winners table. Person-details gains a trophy shelf chip row (titles from `champions.csv` + awards from `awards.csv`) directly under the person banner.

### Hall of Fame (Phase 2, `records` group)
Plaque cards for inductees under published criteria (championship count, career length, career kills, peak Elo, win% with ≥40-match qualifier — exact thresholds fixed in the Phase 2 plan and printed on the page). Tab 2 "Holzlöffel": last-place lineage per season/division from `standings.csv`, spoon counts, redemption arcs (spoon → later champion).

### Rivalitäten (Phase 3, `duels` group)
Index: pairs from `matchup_summary.csv` with ≥3 meetings ranked by meetings × closeness × combined video views. Detail route `#/rivalitaet/<aKey>__<bKey>`: chronological meeting ledger (scores, videos), dominance summary, streak within the rivalry, Elo-gap line over the meetings, most-watched meeting. Reuses matchup pickers for pair selection.

### Orakel (Phase 3, `duels` group)
Two person pickers → shortest played-against chain (BFS over `matches.csv` edges; optional toggle to include shared-division-season edges from `person_stints.csv`). Path rendered as chain cards, each hop citing its match + video. Side table: connectedness leaderboard (distinct opponents).

### Spiele (Phase 4, `games` group)
Hub view with four launch cards; each game routed `#/spiel/<id>`. Shared `web/games.js`: `seededRandom(dateString)` (mulberry32 over a date seed), localStorage keys `gpl-game-<id>-*` for streaks/bests, and a reveal card pattern that always shows the source row/URL after each round. Games: **Kader-Raten** (date-seeded roster of the day, sprite-by-sprite reveal, hints division→rank→season, solution links roster detail), **Tipp-Spiel** (random decided match, roster sprites, pick winner → reveal score, Elo pregame probability, running you-vs-Elo score), **Klick-Duell** (higher/lower on `view_count`, thumbnails via i.ytimg pattern), **Quizshow** (template-generated multiple choice from champions/standings/killlists/matchup summaries, category filter, source receipt on every reveal).

### Publikums-Geschichte (Phase 5, `videos` group, view id `audience-history`)
Charts over `video_archive.csv`: uploads and views per month across 2014–2025 (stacked by channel/perspective), season windows shaded from `seasons.csv`, champions annotated; per-season "attention strip" of weekly view z-scores from `match_highlights.csv`. All client-side via `charts.js`.

### Zeitstrahl + An diesem Tag (Phase 5, `videos` group)
Scrollable calendar timeline (not animated; deliberately distinct from Zeitreise): year sections with dated events — season start/end + champion, top-viewed uploads, record falls (from `records_progression.csv` once present, resolved to upload dates), milestone videos. Every date is labeled as video upload date where it comes from `published_at` (matches.csv has no dates — verified). Top widget "Heute vor X Jahren" with a date picker, defaulting to today.

### Titelrennen (Phase 6, inside table-history)
Adds a probability chart above the existing matchday standings: per-person `p_first` lines over matchdays from `title_odds.csv`, dashed + "Simulation" badge, annotation where `p_first` first exceeds 95 % ("rechnerisch entschieden"). Playoff seasons (S6, S10) additionally show `p_playoffs`.

### Season Story (Phase 6, detail view `season-story`, entered from season-detail and zeitreise)
Scroll-driven recap per season: sticky animated standings/bump chart (reusing `standingsHistory` from `timeline.js`) advancing with scroll; beats = intro (field + coverage note), top-N matches by existing `match_highlights.highlight_score` (embedded thumbnails → video links), the Titelrennen "decided" moment, playoff bracket beats where applicable, champion reveal. Narration text is template-generated from data (bilingual via i18n templates), not hand-authored prose, so it scales to all seasons and stays claim-safe; every beat cites sources. IntersectionObserver only, no new library.

### GPL Wrapped (Phase 6, entered from season-detail and Season Story finale)
Per-season swipeable card sequence (champion, biggest upset, MVP-Pokémon, most-watched video, closest match, Holzlöffel) rendered from `awards.csv` + `match_highlights.csv` + `champions.csv`; share = pipeline-generated PNG per card (see data model) with download buttons; career variant renders the same card layout DOM-only from `person_all_time.csv` + awards. No team-color data exists in the repo — cards use the season roster-background art (`web/assets/roster-backgrounds/`) plus the neutral viz palette instead.

### Zeitmaschinen-Duell (Phase 7, `duels` group, view id `team-duel`)
Pick two (season, team) rosters → matchup sheet: BST/stat comparison, defensive type matrix, interleaved speed tiers — computed gen-correctly via `@pkmn/data` (new CDN global with graceful degradation to text badges, matching the existing `@pkmn/img` fallback rule; generation mapping already exists as `ROSTER_SEASON_GENERATION` in stats.js). An optional Elo-based "hypothetical outcome" line is labeled Simulation and visually separated. Cross-era pairs get an explicit "different generations" note when the two seasons map to different gens.

## Pipeline Behavior

- Phase 2: `streaks`, `records_progression`, `awards` join `build_and_write_aggregates` and `GENERATED_ARTIFACTS`; regenerated by `gpl-history normalize` / `data-quality` / `aggregates` chains as today; checked by `gpl-history check-generated`.
- Phase 6: new commands `gpl-history title-odds --data-dir data [--sims N --seed S]` and `gpl-history wrapped-cards --data-dir data --web-dir web` (Pillow optional extra `[wrapped]`); both documented in README regeneration flow; `title_odds.csv` committed like other normalized CSVs so Pages publishes it.
- Elo win probabilities are NOT exported to CSV — the frontend computes them via `elo_history.js`; the existing `web_elo_consistency.test.mjs` parity guarantee (JS Elo equals the Python-written `person_all_time.elo`) already pins both implementations together. Python-side record/award computations that need per-match Elo extend `_elo_by_person` with an optional per-match callback, mirroring the JS `onMatch` hook.

## Testing Strategy

- Every new pure computation lives in an importable module (`web/elo_history.js`, `web/games.js`, additions to `web/stats.js`; Python `*_rows()` builders) and gets node `--test` / pytest coverage with literal fixtures, following `web_stats.test.mjs` and `test_aggregates.py` styles.
- `web_view_config.test.mjs`, `web_shell.test.mjs`, and `web_i18n.test.mjs` are updated in the same task as every menu/section/i18n change.
- New aggregate builders get an end-to-end `tmp_path` pytest asserting written headers + first rows, plus registration asserted in a `check_generated_artifacts` test.
- Title-odds simulation gets a fixed-seed determinism test (two runs, identical bytes) and a sanity test (probabilities sum to ~1 per matchday, decided seasons converge to 1).
- Existing suites remain green throughout; `npm run release:check` is the gate at the end of every phase.

## Deployment

No Pages workflow change: new CSVs live under `data/normalized/`, new assets under `web/assets/`, both already published. All new CSV loads register as `optional: true` lazy datasets so older deployments and partial data never break rendering.

## Risks

- **Plan size / drift:** eight phases will span sessions. Mitigation: this spec is the single source of truth; each phase gets its own plan derived from it; phases end release-checked and committable.
- **Menu width (8 primary groups):** could wrap on narrow screens. Mitigation: primary tabs already scroll/wrap per styles.css; verify at 360 px during Phase 0 and, if cramped, shorten labels (Rekorde, Spiele are short already).
- **Byte-determinism of new aggregates:** required by check-generated. Mitigation: sorted rows, sorted URL joins, `lineterminator="\n"` — same discipline as existing builders; title-odds kept out of the drift chain.
- **Zeitreise singleton temptation:** new charts must not import zeitreise internals. Mitigation: `charts.js` is written fresh against `timeline.js` data; zeitreise stays untouched until (if ever) it migrates to `charts.js` itself.
- **Simulation misread as fact:** title odds / hypothetical duels could be quoted as history. Mitigation: dashed styling + "Simulation" badge + i18n explainer on every simulated element; simulated values never appear in Tabulator exports without the label column.
- **Games' YouTube thumbnails:** i.ytimg.com is an external host; offline it degrades. Mitigation: same text-badge fallback rule as sprites.
