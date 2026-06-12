# GPL Review and Story Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add actionable review workflow views, source claim drilldowns, data quality scoring, richer person/Pokemon story metrics, and season-list visibility in count columns.

**Architecture:** Extend the existing CSV-first pipeline and static WebApp. Python adds deterministic scoring and review metadata; JavaScript adds data-only aggregation helpers and renders new Tabulator-backed pages.

**Tech Stack:** Python 3.11, pytest, CSV files, static ES modules, Tabulator, Node tests.

---

## File Structure

- Modify `src/gpl_history/data_quality.py`: add quality scores, summaries, and priority gaps.
- Modify `src/gpl_history/review.py`: add correction file and suggested action to review index rows.
- Modify `src/gpl_history/normalize.py`: keep new data quality fields in normalized schema.
- Modify `tests/test_data_quality.py`: assert score fields.
- Modify `tests/test_review_queue.py`: assert workflow metadata.
- Modify `web/stats.js`: add review row composition, source claim filtering, season list formatting, person/Pokemon story helpers.
- Modify `tests/web_stats.test.mjs`: assert new helpers.
- Modify `web/app.js`: load review queues, add Review and Source Claims pages, render scoring/story columns.
- Modify `web/router.js`, `web/index.html`, `web/i18n.js`: add routes, nav, containers, labels.
- Create `docs/known-limitations.md`: public release limitations and correction guidance.
- Modify `README.md`, `docs/data-strategy.md`: link and document the workflow.
- Regenerate `data/normalized/data_quality.csv`, `data/normalized/source_claims.csv`, `data/review/review_index.csv`, and `docs/gpl-history.md`.

## Task 1: Python Scoring and Review Metadata

- [ ] Write failing tests for `data_quality.csv` score fields and `review_index.csv` workflow fields.
- [ ] Implement deterministic 0-100 scoring in `src/gpl_history/data_quality.py`.
- [ ] Add score fields to `NORMALIZED_FIELDS["data_quality"]`.
- [ ] Add `correction_file` and `suggested_action` to `REVIEW_INDEX_FIELDS`.
- [ ] Run `python -m pytest tests/test_data_quality.py tests/test_review_queue.py tests/test_validate.py -q`.

## Task 2: Web Stats Helpers

- [ ] Write failing tests for `formatSeasonList`, `reviewWorkflowRows`, `filterSourceClaims`, `personStorySummary`, and `pokemonStorySummary`.
- [ ] Implement helpers in `web/stats.js` with no DOM dependencies.
- [ ] Run `node --test tests/web_stats.test.mjs`.

## Task 3: WebApp Review and Source Claim Pages

- [ ] Add `review-workflow` and `source-claims` routes.
- [ ] Load review queue CSVs as optional datasets.
- [ ] Add nav buttons and view containers.
- [ ] Render a combined review workflow table with source links and correction targets.
- [ ] Render a source claims table with claim type, subject, value, evidence, confidence, and source links.
- [ ] Add bilingual labels.
- [ ] Run JS syntax and web unit tests.

## Task 4: Story Metrics and Season Lists

- [ ] Add season list fields to all-time rows and killlist summaries.
- [ ] Add title season lists and best season/signature Pokemon summaries to person details.
- [ ] Add best trainer/best season/season list summaries to Pokemon details.
- [ ] Ensure season count columns still sort numerically and season lists remain readable.
- [ ] Run web unit tests.

## Task 5: Public Release Polish and Regeneration

- [ ] Create `docs/known-limitations.md`.
- [ ] Link it from `README.md` and `docs/data-strategy.md`.
- [ ] Regenerate data quality, review queues, and report.
- [ ] Run full verification:

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

## Self-Review

- The plan covers all seven roadmap items plus the added season-list requirement.
- No backend/editor is introduced; corrections remain sourced manual CSV work.
- Tests are attached to every new behavior that can be checked without a browser.
