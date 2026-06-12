# GPL Season Adapter Analysis

This document records how each season is converted from raw PresentLP playlist and sheet sources into normalized CSV rows. It is intentionally conservative: if a table is not present in the raw source set, the normalized row stays null or not_available.

## Global Rules

- Standings are taken only from final standings/table tabs, not from weekly snapshot tabs.
- Teams are person-centric: each standings row becomes a person-season team row, with the franchise/team name attached to that person.
- Preferred person aliases are applied during normalization. Current explicit merges include `FullLifeGames -> Bene` and `Kaffecone/Kaffeecone -> Art'n'Gaming`.
- Division/conference labels are preserved on every table that exposes them, so League 1, League 2, Sun/Moon conferences, Singles/Doubles, Overall, and Playoffs can be filtered separately in the web app.
- Match rows come from score-bearing schedules. Source-video-only rows are retained separately for traceability.
- Schedule notes such as `nach DC` are stripped from person labels before alias normalization.
- Champions are never guessed from video titles. The adapter accepts rank 1 in a final standings table only for seasons where the format makes first place decisive. Playoff seasons require a sourced playoff-final winner.
- Normalization prefers recovered per-tab CSV files from `data/raw/season_X/sheets/` when a current source URL is unavailable or when `sheets_index.json` has fallen back to a single tab.

## Division Split Rules

- S5 has sourced Liga 1 standings, schedule, and team rows in the current raw set. No Liga 2 final table is public in the recovered source set.
- S6 remains split into Sun Conference and Moon Conference for regular-season rows; playoff killlist/match rows keep `Playoffs`.
- S8 has explicit `Liga 1` and `Liga 2` standings, schedules, team rows, and killlists. The S8 champion comes only from Liga 1 rank 1.
- S9 has an overall tag-team table plus individual Singles and Doubles tables. Singles/Doubles are marked primary for all-time individual stats; the overall tag-team row is retained for champion evidence.
- S10 regular-season and playoff rows are split by stage where the source layout exposes playoffs. The playoff final is reconstructed from `Ergebnisse` plus `Playoffs Kader`, and `Playoffs Killliste` is treated as the canonical Season 10 killlist.

## Season Decisions

| Season | Standings Adapter | Match Adapter | Killlist Adapter | Champion Handling |
| --- | --- | --- | --- | --- |
| 1 | Standard `Team, Platz, Punkte, Kills, Deaths, Differenz, Siege, Niederlagen, Unentschieden, Kanal` table. | Bracket cells like `A [4 - 3] B`. | Simple `Pokémon, Kills, Platz, Kanal`. | Rank 1 final standings: PresentLP / Prekani. |
| 2 | Same standard table as S1. | Bracket cells like `A [3 - 0] B`. | Simple `Pokémon, Kills, Platz, Kanal`. | Rank 1 final standings: SteveParker / ToxicBlast. |
| 3 | Final table has a blank first header cell before `Platz`; the first column is the team. Participant list adds Liga 1/Liga 2 people without standings. | Two `Spielplan` tabs, both bracket-score schedules. | Killlist link is known, but the target sheet currently returns an unavailable Google response. | Rank 1 final standings: PresentLP / Prekani. |
| 4 | `Gesamtuebersicht` only; weekly `Spieltag` tabs are ignored for final standings. | `Spielplan [Mit Ergebnissen - Spoiler]`, row scores like `A, 6:0, B`. | Linked killlist is unavailable in current raw set. | Rank 1 final standings: Bene / Ritter der Tapukokosnuss. |
| 5 | `Liga 1 Tabelle`. | `Liga 1 Spielplan - [Mit Ergebnissen - Spoiler!]`, row scores like `A, 6:0, B`. | Linked killlist is unavailable in current raw set. | Rank 1 Liga 1 final standings: Lauris / Shockwaving Magearnas. |
| 6 | `Tabelle - Sun Con.` and `Tabelle - Moon Con.`. | Sun/Moon schedule tabs, including playoff rows. Duplicate playoff rows are deduped. | Sun, Moon, and Playoffs killlist tabs. | Sourced playoff final row: Barry D. Sin of Speed beats Dauni 3:0. |
| 7 | `Tabelle` regular-season standings plus a source-evidenced playoff champion row because the available table evidence has Nestfloh first under the season rule. | `Spielplan [Mit Spoilern]`, row scores, plus a source-evidenced playoff champion marker. | `Killliste`. | Source-evidenced rank 1 under the supplied season rule: Nestfloh / Flutschige Zäpfchen. |
| 8 | `Tabelle L1` and `Tabelle L2`. | `Spielplan L1` and `Spielplan L2`, row scores. | `Killliste L1` and `Killliste L2`. | Liga 1 rank 1: Bene / Victini Bottom. |
| 9 | `Tabelle` is the overall tag-team table; `Tabelle Singles` and `Tabelle Doubles` are primary individual standings. | `Spielplan (Singles & Doubles)`, split scores like `A, 0, :, 2, B`. | Overall, Singles, and Doubles kill tabs. Person detail rows use Singles/Doubles; Victory Instinct Doubles is Bene, while Victory Instinct Singles is split from week columns into BelmontGabriel (1-7) and El Scizor (8-14). | Overall tag-team rank 1: El Scizor & Bene / Victory Instinct. |
| 10 | Sorted final block inside `Tabelle`, beginning at the `Creator Teams` header; Minetube/PresentLP order follows direct-comparison correction. | `Ergebnisse`, including regular season and playoff rows, plus the final reconstructed from semifinal winners and `Playoffs Kader` Fin statuses. | `Playoffs Killliste` only; fixed columns expose kills, deaths, and differential. | Source-evidenced playoff final: Bene / Wackel Backel. |

## Follow-Up Data Gaps

- S3 appears to have two league schedules, but only one final standings table is public in the current source set.
- S3, S4, and S5 killlist links were found but currently return deleted/unavailable Google responses. The normalized killlist placeholders are scoped to Bene's affected teams, but Pokémon and kill values remain null.
- S4 and S5 expose Liga/Tier tabs beyond the main table, but no sourced Liga 2 standings/schedule tables are present in the recovered raw data.

Run `gpl-history review-queue --data-dir data` after rebuilding normalized data to refresh `data/review/missing_killlists.csv`, which currently tracks the S3, S4, and S5 unavailable killlist sources.
