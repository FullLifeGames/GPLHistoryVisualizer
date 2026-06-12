# GPL Archive Improvements Design

Date: 2026-06-12

## Context

The project already has a working Python collection/normalization pipeline, normalized CSVs, review queues, a bilingual static WebApp, person and Pokemon detail pages, a video archive, and validation tests. The next improvements should increase trust in the reconstructed GPL history, make known gaps reviewable, and deepen navigation without rewriting the existing architecture.

The user explicitly requested this spec, an implementation plan, and implementation without additional intervention. That request is treated as pre-approval to proceed after writing these documents unless a hard blocker appears.

## Goals

1. Make data confidence visible per season and per claim.
2. Preserve source URLs in a structured claim/provenance table, not only in individual normalized rows.
3. Turn historical gaps into explicit review artifacts.
4. Strengthen review workflow outputs so low-confidence videos, missing killlists, missing appearances, and unsourced claims are easy to find.
5. Improve the video archive around categories, matching confidence, unmatched GPL videos, and exports.
6. Add deeper person and Pokemon analytics using the normalized CSVs already present.
7. Add generated-artifact checks to CI so derived files do not drift.
8. Make the static build deployable through GitHub Pages.

## Non-Goals

- Do not infer champions, placements, matches, kills, appearances, or video pairings without source evidence.
- Do not replace the existing CSV-first static app architecture.
- Do not require a backend server for the WebApp.
- Do not make private or unavailable source data appear complete.

## Data Model Additions

### `data/normalized/source_claims.csv`

One row per sourced claim extracted from normalized tables.

Fields:

- `claim_id`: stable ID built from table, season, subject, field, and row index.
- `season_id`: season identifier when available.
- `table_name`: normalized source table.
- `claim_type`: one of `season`, `team`, `standing`, `person_stint`, `match`, `champion`, `pokemon_killlist`, `video`.
- `claim_subject`: human-readable subject such as `Bene`, `season_010_schedule_0001`, or `UHaFniR / Bene`.
- `claim_field`: field represented by the claim.
- `claim_value`: value in the normalized CSV.
- `evidence_status`: value from `data_status`.
- `confidence`: optional confidence for video claims.
- `source_urls`: preserved semicolon-separated URLs.
- `notes`: compact context for unclear or unavailable rows.

### `data/normalized/data_quality.csv`

One row per season with counts and status flags for data coverage.

Fields:

- `season_id`
- `season_label`
- `coverage_status`
- `standings_rows`
- `match_rows`
- `playoff_match_rows`
- `champion_rows`
- `killlist_rows`
- `killlist_rows_missing_appearances`
- `unavailable_killlist_rows`
- `video_rows`
- `matched_video_rows`
- `unmatched_game_video_rows`
- `low_confidence_video_rows`
- `missing_categories`
- `review_flags`
- `source_urls`

### `data/review/review_index.csv`

A compact index of generated review queues.

Fields:

- `review_file`
- `row_count`
- `severity`
- `review_reason`
- `description`

## Pipeline Behavior

- `gpl-history review-queue` writes the existing review CSVs plus `review_index.csv`.
- A new `gpl-history data-quality` command generates `source_claims.csv` and `data_quality.csv`.
- `gpl-history normalize` and `gpl-history collect` call data-quality generation after normalized CSVs are written.
- A new `gpl-history check-generated` command regenerates data quality and review outputs, then fails if tracked generated artifacts would change.

## WebApp Behavior

### Data Coverage

The Data Coverage page loads `data_quality.csv` and `source_claims.csv` when present. It displays richer season status columns, review flags, low-confidence video counts, and source links. Existing computed fallback behavior remains available if the optional files are absent.

### Review Workflow

The WebApp gets a review-focused table from `review_index.csv` and optional claim rows from `source_claims.csv`. This does not edit data; it helps a maintainer see where manual review is needed.

### Video Archive

The Video Archive keeps all videos in the main table, uses numeric week ordering, shows categories, keeps source explanations, and retains CSV plus URL-list exports. Unmatched game videos and low-confidence matches are counted in data quality outputs.

### Person Details

Person detail pages show:

- existing team/stint/results history,
- Pokemon usage and kill/death/differential summary,
- strongest Pokemon by kills and differential,
- matchup summary,
- videos related to the person,
- missing killlist rows relevant to that person when known.

### Pokemon Details

Pokemon detail pages show:

- all-time summary,
- top trainers,
- per-season usage timeline,
- source links,
- appearances, kills, deaths, and differential.

## Testing Strategy

- Python unit tests cover source claim generation, data quality rows, review index creation, and generated-artifact drift command behavior.
- Existing URL, Sheets, normalization, Pokemon name, video archive, and validation tests remain green.
- Web unit tests cover new stats helpers and route/table behavior.
- CI runs Python tests, JavaScript syntax checks, Web unit tests, validation, review generation, and generated-artifact drift checks.

## Deployment

A GitHub Pages workflow publishes the static WebApp plus `data/normalized`, `data/review`, logo asset, and docs on pushes to the default branch. The deployment remains static and does not expose API keys.

## Risks

- Some gaps cannot be filled from existing public CSVs. Those must stay visible as review rows instead of being guessed.
- The current working tree already contains uncommitted changes. Implementation must preserve those changes and avoid resets.
- Optional WebApp data loads must not break local file/static usage when new generated files are absent.
