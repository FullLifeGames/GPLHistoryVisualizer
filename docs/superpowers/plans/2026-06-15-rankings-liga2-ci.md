# Rankings And Liga 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix generated CSV drift, correct Pokemon title counting for champion-person-only draft rows, add player Elo, and add a data-mode switch for Liga 1/Liga 2 focused views.

**Architecture:** Keep normalized CSV generation deterministic with LF output. Compute Pokemon titles in `src/gpl_history/pokemon_drafts.py` from draft rows keyed by both team and normalized person identity. Compute Elo client-side in `web/stats.js` from sourced match rows and apply the same division/data-mode filtering used by the UI.

**Tech Stack:** Python CSV generators and tests with pytest; vanilla JavaScript modules with Node tests; Tabulator for table display.

---

### Task 1: Generated CSV Line Endings

**Files:**
- Modify: `src/gpl_history/normalize.py`
- Modify: `src/gpl_history/pokemon_drafts.py`
- Modify: `src/gpl_history/data_quality.py`
- Modify: `src/gpl_history/review.py`
- Modify: `src/gpl_history/pokemon_names.py`
- Add/Modify: `.gitattributes`
- Test: `tests/test_normalize.py`
- Test: `tests/test_pokemon_drafts.py`

- [ ] **Step 1: Write failing tests**

Add byte-level assertions that generated CSV helpers write `\n` and not `\r\n`.

- [ ] **Step 2: Run targeted tests**

Run: `python -m pytest tests/test_normalize.py::test_write_csv_retries_transient_windows_invalid_argument tests/test_pokemon_drafts.py -q`

Expected before implementation: the new byte-level test fails because `csv.DictWriter` defaults to CRLF.

- [ ] **Step 3: Write minimal implementation**

Pass `lineterminator="\n"` to generated `csv.DictWriter` calls and constrain generated normalized/review CSV files with `.gitattributes`.

- [ ] **Step 4: Verify targeted tests pass**

Run: `python -m pytest tests/test_normalize.py::test_write_csv_retries_transient_windows_invalid_argument tests/test_pokemon_drafts.py -q`

Expected after implementation: all targeted tests pass.

### Task 2: Pokemon Title Counting

**Files:**
- Modify: `src/gpl_history/pokemon_drafts.py`
- Test: `tests/test_pokemon_drafts.py`

- [ ] **Step 1: Write failing test**

Add a test where a champion row has `champion_person_id=person_present`, the Pokemon draft row has `trainer=PresentLP`, `trainer_normalized=present`, and no team. Expected `title_count` is `1` and `title_seasons` is `S1`.

- [ ] **Step 2: Run targeted test**

Run: `python -m pytest tests/test_pokemon_drafts.py -q`

Expected before implementation: the new title test fails with `title_count == "0"`.

- [ ] **Step 3: Write minimal implementation**

Store `trainer_key` in draft instances from `trainer_normalized` when present, use it for dedupe and champion-person fallback title matching.

- [ ] **Step 4: Verify targeted test passes**

Run: `python -m pytest tests/test_pokemon_drafts.py -q`

Expected after implementation: all Pokemon draft tests pass.

### Task 3: Player Elo Ranking

**Files:**
- Modify: `web/stats.js`
- Modify: `web/app.js`
- Modify: `web/table_columns.js`
- Modify: `web/i18n.js`
- Test: `tests/web_stats.test.mjs`
- Test: `tests/web_table_columns.test.mjs`
- Test: `tests/web_i18n.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests for `eloRatings()` with sequential match rows and assert winner gains rating, loser loses rating, draws move ratings only by expectation, and returned rows include rank, matches, wins, losses, draws, and win percentage.

- [ ] **Step 2: Run targeted JS tests**

Run: `node --test tests/web_stats.test.mjs tests/web_table_columns.test.mjs tests/web_i18n.test.mjs`

Expected before implementation: import or assertion failure for `eloRatings` / missing `elo`.

- [ ] **Step 3: Write minimal implementation**

Export `eloRatings()` from `web/stats.js`, import it in `web/app.js`, compute the current filtered match Elo index in `renderAllTime()`, and add an `elo` column after weighted rating.

- [ ] **Step 4: Verify targeted JS tests pass**

Run: `node --test tests/web_stats.test.mjs tests/web_table_columns.test.mjs tests/web_i18n.test.mjs`

Expected after implementation: targeted JS tests pass.

### Task 4: Liga 2 Data Mode

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/i18n.js`
- Test: `tests/web_i18n.test.mjs`
- Test: `tests/web_shell.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that the shell contains a data-mode control, and translations expose Liga 1/Liga 2 mode labels.

- [ ] **Step 2: Run targeted tests**

Run: `node --test tests/web_i18n.test.mjs tests/web_shell.test.mjs`

Expected before implementation: missing shell control or translation assertions fail.

- [ ] **Step 3: Write minimal implementation**

Add a compact data-mode select with `primary`, `league1`, `league2`, and `all` options. Use it to filter `standings`, `personStints`, `matches`, `teams`, `killlists`, and `videos` before the regular season/division/search filters. Keep the existing division dropdown as a detailed override.

- [ ] **Step 4: Verify targeted tests pass**

Run: `node --test tests/web_i18n.test.mjs tests/web_shell.test.mjs`

Expected after implementation: targeted JS tests pass.

### Task 5: Regenerate And Verify

**Files:**
- Generated: `data/normalized/*.csv`
- Generated: `data/review/*.csv`
- Generated: `docs/gpl-history.md`

- [ ] **Step 1: Regenerate artifacts**

Run: `gpl-history normalize --data-dir data`
Run: `gpl-history report --data-dir data --out docs/gpl-history.md`

- [ ] **Step 2: Run full verification**

Run: `python -m pytest -q`
Run: `node --test tests/web_i18n.test.mjs tests/web_pokemon_names.test.mjs tests/web_router.test.mjs tests/web_stats.test.mjs tests/web_manual_killlist_entry.test.mjs tests/web_team_graphics_entry.test.mjs tests/web_table_filters.test.mjs tests/web_table_columns.test.mjs tests/web_shell.test.mjs`
Run: `node --check web/app.js`
Run: `gpl-history check-generated --data-dir data`
Run: `gpl-history validate --data-dir data --strict`
Run: `git diff --check`

- [ ] **Step 3: Commit and push**

Commit the focused fix and push `main` to `origin`.
