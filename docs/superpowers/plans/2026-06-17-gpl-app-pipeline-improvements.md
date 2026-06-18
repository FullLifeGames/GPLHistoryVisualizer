# GPL App Pipeline Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce frontend load and maintenance risk by moving core aggregates into the Python pipeline, widening CI coverage, and preparing cleaner boundaries for views, review workflows, and season adapters.

**Architecture:** Keep normalized CSVs as the source of truth. Add deterministic aggregate CSVs built from existing normalized rows, consume those where useful in the static app, and keep fallback calculations in `web/stats.js` while migration is incremental. Adapter extraction starts with a registry boundary instead of moving every season parser at once.

**Tech Stack:** Python 3.11 CSV pipeline, static ES modules, Tabulator tables, Node test runner, pytest.

---

### Task 1: CI And Baseline Guardrails

**Files:**
- Modify: `.github/workflows/ci.yml`
- Add: `tests/test_ci_config.py`

- [ ] Add a failing test that asserts CI runs every `tests/*.mjs` file through `node --test tests/*.mjs`.
- [ ] Update CI to run the full web unit test suite.
- [ ] Verify with `python -m pytest -q --basetemp .tmp\pytest -p no:cacheprovider tests/test_ci_config.py`.

### Task 2: Pipeline Aggregate CSVs

**Files:**
- Add: `src/gpl_history/aggregates.py`
- Modify: `src/gpl_history/cli.py`
- Modify: `src/gpl_history/data_quality.py`
- Add: `tests/test_aggregates.py`

- [ ] Add tests for `person_all_time.csv`, `pokemon_all_time.csv`, `matchup_summary.csv`, `roster_scores.csv`, and `season_storylines.csv`.
- [ ] Implement aggregate builders using only existing normalized CSV input.
- [ ] Wire aggregate generation into `normalize`, `data-quality`, and `check-generated`.
- [ ] Generate the new tracked CSVs under `data/normalized/`.

### Task 3: Frontend Aggregate Consumption

**Files:**
- Modify: `web/app.js`
- Modify: `tests/web_loading.test.mjs`
- Add or modify focused web tests where necessary.

- [ ] Load aggregate CSVs lazily for relevant views.
- [ ] Prefer aggregate rows for heavy summary tables when present.
- [ ] Keep existing JS aggregation as fallback if aggregate CSVs are missing.

### Task 4: Review And Audit Workflow Upgrade

**Files:**
- Modify: `web/app.js`
- Modify: `web/table_columns.js`
- Modify: `web/i18n.js`
- Modify or add web tests.

- [ ] Add one actionable review export table that combines review queues into correction-oriented rows.
- [ ] Surface severity, correction target, and source link consistently.
- [ ] Keep exports CSV-friendly.

### Task 5: Adapter Boundary

**Files:**
- Add: `src/gpl_history/adapters/__init__.py`
- Modify: `src/gpl_history/normalize.py`
- Add: `tests/test_season_adapters.py`

- [ ] Introduce an adapter registry with season IDs and labels.
- [ ] Route `_adapt_season` through the registry while preserving existing parser functions.
- [ ] Add regression tests proving all ten seasons have registered adapters.

### Task 6: Verification

**Commands:**
- `python -m pytest -q --basetemp .tmp\pytest -p no:cacheprovider`
- `node --test tests/*.mjs`
- `gpl-history validate --data-dir data --strict`
- `gpl-history check-generated --data-dir data`

