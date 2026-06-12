# GPL Archive Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured data quality/provenance outputs, review workflow improvements, deeper WebApp analytics, generated-artifact checks, and static deployment support.

**Architecture:** Keep the existing CSV-first Python pipeline and static WebApp. Add focused Python modules for data quality/provenance generation, optional WebApp dataset loading, and small stats helpers rather than rewriting existing adapters.

**Tech Stack:** Python 3.11, pytest, CSV files, static ES modules, Tabulator, Node 20 tests, GitHub Actions.

---

## File Structure

- Create `src/gpl_history/data_quality.py`: builds `source_claims.csv` and `data_quality.csv` from normalized CSVs and optional video archive rows.
- Modify `src/gpl_history/cli.py`: add `data-quality` and `check-generated`; run data-quality after normalize/collect/build-video-archive where appropriate.
- Modify `src/gpl_history/review.py`: add `review_index.csv` output.
- Modify `src/gpl_history/validate.py`: include new normalized files in schema validation.
- Modify `src/gpl_history/report.py`: mention source claims and data quality summaries.
- Modify `tests/test_data_quality.py`: unit tests for source claims, quality rows, and generated drift helper behavior.
- Modify `tests/test_review_queue.py`: assert review index output.
- Modify `web/app.js`: load optional quality/review/claims CSVs, render richer Data Coverage/Season Detail/Person/Pokemon tables, expose useful exports.
- Modify `web/stats.js`: add helpers for quality rows, source claim filtering, person Pokemon highlights, and Pokemon timeline aggregation.
- Modify `web/i18n.js`: add bilingual labels.
- Modify `tests/web_stats.test.mjs`: cover new stats helpers.
- Modify `.github/workflows/ci.yml`: run generated-artifact check.
- Create `.github/workflows/pages.yml`: deploy static WebApp artifacts.
- Modify `README.md` and `docs/data-strategy.md`: document generated quality/provenance workflow.

## Task 1: Data Quality and Source Claims

**Files:**
- Create: `src/gpl_history/data_quality.py`
- Test: `tests/test_data_quality.py`
- Modify: `src/gpl_history/normalize.py`
- Modify: `src/gpl_history/cli.py`
- Modify: `src/gpl_history/validate.py`

- [ ] **Step 1: Write failing tests for claim and quality generation**

Add tests that create minimal normalized CSVs and assert:

```python
from pathlib import Path

from gpl_history.data_quality import generate_data_quality


def test_generate_data_quality_writes_source_claims_and_quality_rows(tmp_path):
    # Create normalized CSVs for seasons, standings, matches, champions, pokemon_killlists, and video_archive.
    # Call generate_data_quality(tmp_path).
    # Assert source_claims.csv contains champion and match claims with source URLs.
    # Assert data_quality.csv counts missing appearances, playoff matches, unmatched games, and low confidence videos.
```

Run: `python -m pytest tests/test_data_quality.py -q`

Expected: FAIL because `gpl_history.data_quality` does not exist.

- [ ] **Step 2: Implement `data_quality.py`**

Implement:

```python
DATA_QUALITY_FIELDS = [...]
SOURCE_CLAIM_FIELDS = [...]
generate_data_quality(data_dir: Path) -> dict[str, int]
```

Use `csv.DictReader`/`DictWriter`, preserve every URL, write deterministic row order, and treat blank values as null-like by skipping empty claim values except for `not_available` rows.

- [ ] **Step 3: Wire CLI and schemas**

Add:

- `gpl-history data-quality --data-dir data`
- `gpl-history check-generated --data-dir data`
- `source_claims` and `data_quality` to `NORMALIZED_FIELDS`
- optional generation after `normalize_all(data_dir)` and `build_video_archive(data_dir)`

- [ ] **Step 4: Run focused tests**

Run: `python -m pytest tests/test_data_quality.py tests/test_validate.py -q`

Expected: PASS.

## Task 2: Review Queue Index

**Files:**
- Modify: `src/gpl_history/review.py`
- Modify: `tests/test_review_queue.py`

- [ ] **Step 1: Extend the failing review test**

Assert `data/review/review_index.csv` contains one row per generated queue with row counts and severity.

Run: `python -m pytest tests/test_review_queue.py -q`

Expected: FAIL because the index file is not written.

- [ ] **Step 2: Implement review index generation**

Add `REVIEW_INDEX_FIELDS` and write rows for:

- `missing_killlists.csv` severity `high`
- `missing_killlist_appearances.csv` severity `medium`
- `low_confidence_videos.csv` severity `medium`
- `ambiguous_matches.csv` severity `high`

- [ ] **Step 3: Run focused tests**

Run: `python -m pytest tests/test_review_queue.py -q`

Expected: PASS.

## Task 3: Web Stats Helpers

**Files:**
- Modify: `web/stats.js`
- Modify: `tests/web_stats.test.mjs`

- [ ] **Step 1: Write failing JS tests**

Add assertions for:

- `qualityRowsFromData` preferring generated `dataQuality` over computed fallback.
- `sourceClaimsForSeason` filtering by `season_id`.
- `personPokemonHighlights` returning top Pokemon by kills and differential.
- `pokemonTimelineRows` aggregating appearances/kills/deaths/differential by season.

Run: `node --test tests/web_stats.test.mjs`

Expected: FAIL because helpers do not exist.

- [ ] **Step 2: Implement helpers**

Export deterministic functions from `web/stats.js` and keep them data-only with no DOM dependencies.

- [ ] **Step 3: Run focused JS test**

Run: `node --test tests/web_stats.test.mjs`

Expected: PASS.

## Task 4: WebApp Data Loading and Tables

**Files:**
- Modify: `web/app.js`
- Modify: `web/index.html`
- Modify: `web/i18n.js`
- Modify: `web/styles.css`

- [ ] **Step 1: Load optional CSVs**

Add optional datasets:

- `dataQuality`
- `sourceClaims`
- `reviewIndex`

Keep the app functional when any optional file returns 404.

- [ ] **Step 2: Render richer coverage and review workflow**

Update Data Coverage to use generated quality rows when present and add a Review Queues table from `reviewIndex`.

- [ ] **Step 3: Render season claim/source table**

Update Season Detail with a `source_claims` table filtered to the selected season.

- [ ] **Step 4: Deepen person and Pokemon detail tables**

Add person Pokemon highlights and Pokemon timeline rows using the new stats helpers.

- [ ] **Step 5: Run syntax and web tests**

Run:

```powershell
node --check web/app.js
node --check web/i18n.js
node --check web/router.js
node --check web/stats.js
node --test tests/web_i18n.test.mjs tests/web_pokemon_names.test.mjs tests/web_router.test.mjs tests/web_stats.test.mjs
```

Expected: PASS.

## Task 5: Generated Artifact Checks and CI

**Files:**
- Modify: `src/gpl_history/cli.py`
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Add drift helper test**

Add a Python test that mutates a generated file in a tmp data dir and verifies the drift detector reports it.

- [ ] **Step 2: Implement deterministic drift check**

For `check-generated`, snapshot relevant generated files, regenerate data quality and review queues, compare contents, print changed files, and return exit code `1` on drift.

- [ ] **Step 3: Update CI**

Add:

```yaml
- name: Check generated artifacts
  run: gpl-history check-generated --data-dir data
```

- [ ] **Step 4: Add Pages workflow**

Publish `web`, `data/normalized`, `data/review`, `docs`, and `GPL_Season_10_Logo.png` as a static artifact without secrets.

## Task 6: Documentation and Regeneration

**Files:**
- Modify: `README.md`
- Modify: `docs/data-strategy.md`
- Modify: `docs/gpl-history.md` through report generation
- Generated: `data/normalized/source_claims.csv`
- Generated: `data/normalized/data_quality.csv`
- Generated: `data/review/review_index.csv`

- [ ] **Step 1: Document commands**

Add commands for:

```powershell
gpl-history normalize --data-dir data
gpl-history data-quality --data-dir data
gpl-history review-queue --data-dir data
gpl-history check-generated --data-dir data
```

- [ ] **Step 2: Regenerate artifacts**

Run:

```powershell
$env:PYTHONPATH='src'
python -m gpl_history.cli data-quality --data-dir data
python -m gpl_history.cli review-queue --data-dir data
python -m gpl_history.cli report --data-dir data --out docs/gpl-history.md
```

- [ ] **Step 3: Full verification**

Run:

```powershell
python -m pytest -q
node --check web/app.js
node --check web/i18n.js
node --check web/pokemon_names.js
node --check web/router.js
node --check web/stats.js
node --test tests/web_i18n.test.mjs tests/web_pokemon_names.test.mjs tests/web_router.test.mjs tests/web_stats.test.mjs
$env:PYTHONPATH='src'; python -m gpl_history.cli validate --data-dir data --strict
$env:PYTHONPATH='src'; python -m gpl_history.cli check-generated --data-dir data
git diff --check
```

Expected: all commands pass except `git diff --check` may report existing CRLF warnings only.

## Self-Review

- Spec coverage: all eight requested improvement themes are covered by Tasks 1 through 6.
- Placeholder scan: no task depends on undefined future behavior; each generated file has explicit fields.
- Type consistency: CSV dataset names use `dataQuality`, `sourceClaims`, and `reviewIndex` in WebApp code; Python files use snake_case filenames.
