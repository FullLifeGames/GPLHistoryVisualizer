# GPL Table Review

Review date: 2026-06-10

This review checks every recovered season table under `data/raw/season_X/sheets/` against the normalized CSV outputs. It focuses on divisions, killlists, standings, matches, and places where a source exists but should not be double-counted.

## Global Findings

- Technical aggregation fields such as `rows` are useful internally, but they should not be displayed as user-facing table columns.
- `data_status` remains in CSVs for traceability, but the WebApp now favors source links over a visible `Status` column in the main views.
- When a season has both overall and split killlists, the default killlist summary must use the canonical final list instead of summing overlapping lists.
- Liga 1 is the default all-time-table scope when both Liga 1 and Liga 2 are available. Liga 2 remains selectable through the division filter.

## Season Coverage

| Season | Standings | Matches | Killlists | Division Notes |
| --- | --- | --- | --- | --- |
| 1 | Final standard table present. | Scored schedule present. | One simple kill ranking present. | Single regular season only. |
| 2 | Final standard table present. | Scored schedule present. | One simple kill ranking present. | Single regular season only. |
| 3 | Final table present; participant list names Liga 1/Liga 2 people, but no separate Liga 2 final standings table is present. | Scored schedule tabs present and deduped. | Linked killlist source exists, but the target sheet is not available as usable CSV. | Do not invent Liga 2 standings from participant list alone. |
| 4 | `Gesamtübersicht` final table present. Weekly table snapshots are ignored for final standings. | Spoiler schedule with scores present. | Linked killlist is not available as usable CSV. | `Liga 1`/`Liga 2` raw tabs are tierlists, not standings. |
| 5 | `Liga 1 Tabelle` present. | `Liga 1 Spielplan` with scores present. | Linked killlist is not available as usable CSV. | No usable Liga 2 standings/schedule table in recovered raw data. |
| 6 | Sun and Moon conference final tables present. | Sun/Moon schedules include playoff rows. | Sun, Moon, and Playoffs killlists present. | Playoff match rows are normalized under `Playoffs` so the filter works. |
| 7 | Regular table present; champion row follows supplied season rule. | Spoiler schedule present plus playoff champion marker. | Killliste present. | No separate playoff bracket table found in recovered raw data. |
| 8 | `Tabelle L1` and `Tabelle L2` present. | `Spielplan L1` and `Spielplan L2` present. | `Killliste L1` and `Killliste L2` present. | Liga 1 is default priority; Liga 2 is selectable. |
| 9 | Overall tag-team table plus Singles/Doubles tables present. | Combined Singles/Doubles schedule present. | Overall, Singles, and Doubles killlists present. | Default killlist summary uses `Overall` to avoid double-counting Singles+Doubles. |
| 10 | Regular table present; playoff standings reconstructed from playoff evidence. | `Ergebnisse` contains regular and playoff rows; final reconstructed from semifinal winners plus `Playoffs Kader`. | `Playoffs Killliste` is canonical for Season 10. | Regular killlist is not summed into the displayed Season 10 kill summary. |

## Remaining Data Gaps

- S3 Liga 2 exists as a participant/source-list concept, but no separate final Liga 2 standings table is currently available.
- S4 and S5 have no usable Liga 2 result tables in the recovered raw CSVs.
- S3, S4, and S5 killlist links are known, but the target sheets currently return deleted/unavailable Google responses.
