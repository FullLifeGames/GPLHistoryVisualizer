# GPL Review and Story Workflow Design

Date: 2026-06-12

## Context

The archive now has normalized data, generated source claims, data quality rows, review queues, a video archive, and detail pages. The next step is to turn that infrastructure into a practical workflow for improving historical accuracy and into richer story-oriented pages for users.

The user explicitly requested a spec, implementation plan, and implementation without additional intervention. That request is treated as pre-approval to proceed after writing these documents unless a hard blocker appears.

## Goals

1. Make review queues actionable in the WebApp.
2. Give source claims their own drilldown view, searchable by season, player, Pokemon, claim type, and evidence status.
3. Add data quality scoring per season and per data dimension.
4. Improve video review by exposing unmatched and low-confidence rows as first-class review items.
5. Improve player and Pokemon story pages with best seasons, signature Pokemon, title seasons, rival/head-to-head context, and usage timelines.
6. Polish the public release documentation with a clear limitations/review page.
7. For season count columns, show which seasons are included, not only the number.

## Non-Goals

- Do not claim missing data has been fixed unless it is sourced.
- Do not infer champions, match results, kills, appearances, or video matches.
- Do not build an editing backend; the project stays static and CSV-first.
- Do not scan new external sources in this pass.

## Data Model Changes

### `data/normalized/data_quality.csv`

Add scoring fields:

- `quality_score`
- `tables_score`
- `matches_score`
- `killlists_score`
- `videos_score`
- `claims_score`
- `quality_summary`
- `priority_gaps`

Scores are deterministic 0-100 values derived from existing counts and review flags. They are not historical facts.

### `data/review/review_index.csv`

Add workflow fields:

- `correction_file`
- `suggested_action`

These point maintainers toward the manual CSV file likely to receive a sourced correction.

## WebApp Changes

### Review Workflow Page

Add a `Review` page that loads all review CSVs when present and displays:

- queue name,
- severity,
- season,
- subject,
- reason,
- suggested action,
- correction file,
- source links,
- matching confidence details for videos.

The page remains read-only but supports filtering, sorting, and CSV export.

### Source Claims Page

Add a `Source Claims` page showing `source_claims.csv` with claim type, subject, field, value, evidence status, confidence, and source links. It uses existing global season/division/search filters where sensible and keeps all source URLs preserved.

### Data Coverage Page

Show new quality scores and priority gaps alongside counts. Keep existing counts visible.

### Person Details

Add story metrics:

- title seasons,
- seasons list,
- best season by rating and record,
- signature Pokemon,
- strongest rivals/head-to-head rows.

### Pokemon Details

Add story metrics:

- season list,
- best trainer,
- best season,
- top teams,
- timeline rows already sourced from killlists.

### Season Lists in Count Columns

Where a table displays a season count, also display a compact list of seasons:

- All-time table: seasons and title seasons.
- Pokemon killlists: seasons.
- Person/Pokemon detail summaries: season lists.

## Testing Strategy

- Python tests cover scoring fields and review index workflow metadata.
- Web stats tests cover season list aggregation, story metrics, source claim filters, and review row composition.
- Existing validation and generated-artifact checks stay green.
- Browser smoke test checks the new review/source-claims pages render from local CSVs.

## Public Release Polish

Add `docs/known-limitations.md` describing:

- data that is sourced,
- data that is unavailable,
- review queue meanings,
- how to add corrections,
- why uncertain values remain blank.

The README links to this file.

## Risks

- The review workflow may expose many rows. Tables must default to 100 rows and support filtering/export.
- Scores can be misunderstood as factual certainty. UI labels must frame them as archive coverage/review quality, not truth.
- Large source claim data can be heavy. Rendering should use existing Tabulator pagination and optional loading fallback.
