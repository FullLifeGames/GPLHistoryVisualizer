# GPL Extensions Phase 2 (Rekorde & Ehrungen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the records-and-honors cluster: pipeline-computed `streaks.csv`, `records_progression.csv`, `awards.csv`, plus the Rekordbuch (with Finder and Streaks tabs), Auszeichnungen, and Hall of Fame (with Holzlöffel tab) views and a trophy shelf on person pages.

**Architecture:** New pipeline module `src/gpl_history/records.py` holds the three row builders and is wired into the existing aggregates chain (FIELDS constants ending in `source_urls`, byte-deterministic output, `GENERATED_ARTIFACTS` registration). `_elo_by_person` gains an optional `on_match` callback mirroring the JS hook. Frontend adds three views to the existing `records` nav group plus a pure module `web/records.js`; charts reuse `web/charts.js` (`stepChart`).

**Tech Stack:** Python 3.11 + pytest, CSV files, static ES modules, Tabulator 6.4, d3 v7, Node 20 `node --test`.

**Spec:** `docs/superpowers/specs/2026-08-10-gpl-extensions-design.md` (sections: Data Model Additions, Rekordbuch, Auszeichnungen + trophy shelf, Hall of Fame).

## Global Constraints

- Aggregate CSVs must be byte-deterministic: sorted rows, `_join_urls` (sorted `;`-join), `lineterminator="\n"` — `check-generated` re-runs the chain and byte-compares.
- Every output row carries `source_urls`; awards views label everything "berechnet, nicht offiziell" / "computed, not official".
- Match rows with `data_status` in {`not_available`, `source_video_only`} and `result_basis == "unresolved"` never count; `forfeit` wins count like the league counted them (matches existing Elo semantics).
- i18n keys always land in BOTH `de` and `en`; record/award display names resolve from keys (`recordBook.records.<record_key>`, `awards.names.<award_key>`, `awards.formulas.<formula>`).
- View section ids are `view-<viewName>`; the `records` group's `defaultView` stays `upset-index`.
- New CSVs register as `optional: true` lazy datasets in `web/app.js`.

## File Structure

- Create: `src/gpl_history/records.py` — streak/record/award builders (pure, testable)
- Modify: `src/gpl_history/aggregates.py` — `on_match` hook; read standings; register three new aggregates
- Modify: `src/gpl_history/data_quality.py:65-79` — `GENERATED_ARTIFACTS` additions
- Create: `web/records.js` — pure finder/HoF/shaping helpers
- Modify: `web/app.js`, `web/index.html`, `web/view_config.js`, `web/i18n.js`, `web/table_columns.js`, `web/styles.css`
- Test: `tests/test_records.py`, `tests/web_records.test.mjs`; update `tests/web_view_config.test.mjs`

---

### Task 1: `on_match` hook for the Python Elo walk

**Files:**
- Modify: `src/gpl_history/aggregates.py:566-586` (`_elo_by_person`)
- Test: `tests/test_records.py`

**Interfaces:**
- Produces: `_elo_by_person(matches, initial_rating=1500, k_factor=32, on_match=None)`; `on_match(row, details)` fires after each rated match with `details = {"left_key", "right_key", "left_before", "right_before", "left_expected", "left_after", "right_after"}` — the exact mirror of the JS hook in `web/stats.js`.

- [ ] **Step 1: Write the failing test** (`tests/test_records.py`; local `_match` helper builds dict rows like the fixtures in `tests/test_aggregates.py`):

```python
from gpl_history.aggregates import _elo_by_person


def _match(mid, week, a, b, winner, **extra):
    row = {
        "season_id": "season_001", "match_id": mid, "week": week, "stage": "Regular Season",
        "player_a": a, "player_b": b, "winner": winner, "data_status": "available",
    }
    row.update(extra)
    return row


def test_elo_on_match_reports_pregame_and_postgame_values():
    seen = []
    _elo_by_person(
        [_match("m1", "1", "Anna", "Ben", "Anna"), _match("m2", "2", "Anna", "Ben", "Anna")],
        on_match=lambda row, details: seen.append((row["match_id"], details)),
    )
    assert [mid for mid, _ in seen] == ["m1", "m2"]
    first = seen[0][1]
    assert first["left_before"] == 1500 and first["left_expected"] == 0.5
    assert round(first["left_after"]) == 1516
    assert round(seen[1][1]["left_before"]) == 1516
```

- [ ] **Step 2:** Run: `python -m pytest tests/test_records.py -q` — Expected: FAIL (`on_match` unexpected keyword).
- [ ] **Step 3: Implement** — capture `left_rating`/`right_rating` (already locals) and call the hook after the update:

```python
def _elo_by_person(matches, initial_rating: float = 1500, k_factor: float = 32, on_match=None) -> dict[str, float]:
    ...existing walk...
        ratings[left_key] = left_rating + k_factor * (left_score - left_expected)
        ratings[right_key] = right_rating + k_factor * (right_score - right_expected)
        if on_match:
            on_match(row, {
                "left_key": left_key, "right_key": right_key,
                "left_before": left_rating, "right_before": right_rating,
                "left_expected": left_expected,
                "left_after": ratings[left_key], "right_after": ratings[right_key],
            })
```

- [ ] **Step 4:** Run: `python -m pytest tests/test_records.py tests/test_aggregates.py -q` — Expected: PASS (existing aggregate tests prove backward compatibility).
- [ ] **Step 5:** Commit: `git add src/gpl_history/aggregates.py tests/test_records.py && git commit -m "Add on_match hook to the Python Elo walk"`

### Task 2: `streak_rows` builder

**Files:**
- Create: `src/gpl_history/records.py`
- Test: `tests/test_records.py`

**Interfaces:**
- Produces: `STREAK_FIELDS` = `["person_id", "person_name", "streak_type", "length", "start_season_id", "start_week", "end_season_id", "end_week", "start_match_id", "end_match_id", "active", "source_urls"]`; `streak_rows(matches) -> list[dict]`.
- Semantics: walk matches in `_match_chronology` order per person. `win`/`loss` streaks break on any other result; `unbeaten` = wins+draws; `sweep` = consecutive wins whose winner-side score is `6`. Emission thresholds: win ≥ 3, loss ≥ 3, unbeaten ≥ 4, sweep ≥ 2. `active` = `1` when the streak includes the person's final rated match, else `0`. Skip `result_basis == "unresolved"` rows entirely; draws (winner-less) count as draw results. `source_urls` = union of the member matches' `source_urls`. Deterministic sort: `(person_id, streak_type, start chronology)`.

- [ ] **Step 1: Failing tests** (append to `tests/test_records.py`):

```python
from gpl_history.records import streak_rows


def test_streak_rows_emits_win_and_unbeaten_streaks():
    matches = [
        _match("m1", "1", "Anna", "Ben", "Anna", score_a="6", score_b="0"),
        _match("m2", "2", "Anna", "Cid", "Anna", score_a="6", score_b="0"),
        _match("m3", "3", "Anna", "Ben", "Anna", score_a="2", score_b="0"),
        _match("m4", "4", "Anna", "Cid", "", result_basis="draw"),
        _match("m5", "5", "Anna", "Ben", "Ben", score_a="0", score_b="1"),
    ]
    rows = streak_rows(matches)
    win = [r for r in rows if r["person_name"] == "Anna" and r["streak_type"] == "win"]
    assert len(win) == 1 and win[0]["length"] == 3
    assert win[0]["start_match_id"] == "m1" and win[0]["end_match_id"] == "m3"
    assert win[0]["active"] == 0
    unbeaten = [r for r in rows if r["person_name"] == "Anna" and r["streak_type"] == "unbeaten"]
    assert len(unbeaten) == 1 and unbeaten[0]["length"] == 4  # three wins + draw
    sweeps = [r for r in rows if r["streak_type"] == "sweep"]
    assert len(sweeps) == 1 and sweeps[0]["length"] == 2  # m1+m2 were 6:0


def test_streak_rows_marks_running_streaks_active():
    rows = streak_rows([_match(f"m{i}", str(i), "Anna", "Ben", "Ben") for i in range(1, 5)])
    loss = [r for r in rows if r["streak_type"] == "loss"]
    assert loss and loss[0]["length"] == 4 and loss[0]["active"] == 1
```

- [ ] **Step 2:** Run: `python -m pytest tests/test_records.py -q` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `records.py` skeleton with a per-person result walk. Core shape:

```python
RESULT_WIN, RESULT_LOSS, RESULT_DRAW = "win", "loss", "draw"

def _person_results(matches):
    """person_id -> ordered list of {result, is_sweep, season_id, week, match_id, source_urls, name}."""
    by_person: dict[str, list[dict]] = defaultdict(list)
    for row in sorted(matches, key=_match_chronology):
        if row.get("data_status") in {"not_available", "source_video_only"}:
            continue
        if (row.get("result_basis") or "") == "unresolved":
            continue
        a, b = row.get("player_a") or "", row.get("player_b") or ""
        if not a or not b:
            continue
        winner = _person_id(row.get("winner"))
        for name, own_score in ((a, row.get("score_a")), (b, row.get("score_b"))):
            key = _person_id(name)
            result = RESULT_WIN if winner == key else RESULT_LOSS if winner else RESULT_DRAW
            if winner and winner != key and winner != _person_id(a) and winner != _person_id(b):
                continue  # winner name matches neither side: treat as unrated
            if winner and winner != key:
                result = RESULT_LOSS
            by_person[key].append({
                "result": result, "is_sweep": result == RESULT_WIN and str(own_score).strip() == "6",
                "season_id": row.get("season_id") or "", "week": row.get("week") or "",
                "match_id": row.get("match_id") or "", "source_urls": row.get("source_urls") or "",
                "name": name,
            })
    return by_person
```

then a generic run-collector per predicate (`win`, `loss`, `unbeaten`, `sweep`) with the thresholds above, emitting field-complete dicts.
- [ ] **Step 4:** Run: `python -m pytest tests/test_records.py -q` — Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/gpl_history/records.py tests/test_records.py && git commit -m "Add streak rows builder"`

### Task 3: `records_progression_rows` builder

**Files:**
- Modify: `src/gpl_history/records.py`
- Test: `tests/test_records.py`

**Interfaces:**
- Produces: `RECORDS_PROGRESSION_FIELDS` = `["record_key", "holder_person_id", "holder_name", "holder_pokemon", "value", "season_id", "week", "match_id", "video_url", "superseded", "source_urls"]`; `records_progression_rows(matches, stints, killlists) -> list[dict]`.
- Record catalog (one progression per key; a row is emitted every time the all-time record value strictly improves; ties do not emit; the last row per key has `superseded = 0`, all earlier rows `1`):
  - match-grain (season_id, week, match_id, video_url from the triggering match): `highest_elo` (via `_elo_by_person` `on_match`, value = rounded post-match rating), `longest_win_streak`, `longest_unbeaten` (running streak length surpassing the previous best, emitted at the surpassing match), `most_career_wins`, `most_career_matches`.
  - season-grain (season_id only; week/match_id/video_url empty): `most_career_kills` (person, cumulative standings-kills from stints), `most_season_kills_person` (best single-season kills from stints), `most_season_kills_pokemon` and `most_career_kills_pokemon` (from killlists, `holder_pokemon` set, summed over trainers per season), `most_seasons_played` (career season count from stints).
- Seed rule: the very first qualifying value opens each record (e.g. the first win sets `most_career_wins = 1`).

- [ ] **Step 1: Failing tests:**

```python
from gpl_history.records import records_progression_rows


def test_highest_elo_progression_tracks_hand_offs():
    matches = [
        _match("m1", "1", "Anna", "Ben", "Anna"),
        _match("m2", "2", "Cid", "Dora", "Cid"),
        _match("m3", "3", "Anna", "Cid", "Cid"),
    ]
    rows = [r for r in records_progression_rows(matches, [], []) if r["record_key"] == "highest_elo"]
    assert rows[0]["holder_name"] == "Anna" and rows[0]["value"] == 1516
    assert rows[-1]["holder_name"] == "Cid" and rows[-1]["superseded"] == 0
    assert all(r["superseded"] == 1 for r in rows[:-1])
    assert rows[0]["match_id"] == "m1"


def test_pokemon_season_kill_record_uses_killlists():
    killlists = [
        {"season_id": "season_001", "pokemon": "Gengar", "trainer": "Anna", "kills": "10", "appearances": "5", "data_status": "available", "source_urls": "u1"},
        {"season_id": "season_002", "pokemon": "Mew", "trainer": "Ben", "kills": "14", "appearances": "6", "data_status": "available", "source_urls": "u2"},
    ]
    rows = [r for r in records_progression_rows([], [], killlists) if r["record_key"] == "most_season_kills_pokemon"]
    assert [(r["holder_pokemon"], r["value"], r["superseded"]) for r in rows] == [("Gengar", 10, 1), ("Mew", 14, 0)]
```

- [ ] **Step 2:** Run: `python -m pytest tests/test_records.py -q` — Expected: FAIL.
- [ ] **Step 3: Implement.** One `_Progression` helper accumulates `(value, holder, context)` and appends on strict improvement; match-grain records advance inside a single `_elo_by_person(matches, on_match=...)` walk (the callback also feeds per-person win/match counters and running streak lengths); season-grain records iterate seasons via `_season_sort`. Final pass sets `superseded` and sorts by `(record_key, emission_index)`.
- [ ] **Step 4:** Run: `python -m pytest tests/test_records.py -q` — Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/gpl_history/records.py tests/test_records.py && git commit -m "Add records progression builder"`

### Task 4: `award_rows` builder

**Files:**
- Modify: `src/gpl_history/records.py`
- Test: `tests/test_records.py`

**Interfaces:**
- Produces: `AWARD_FIELDS` = `["award_key", "scope", "season_id", "division", "person_id", "person_name", "value", "formula", "source_urls"]`; `award_rows(matches, stints, standings, champions, killlists) -> list[dict]`.
- Award catalog (scope `season` unless noted; ties emit all tied rows, sorted by person_id):
  - `champion` — one row per `champions.csv` row (its source_urls), formula `sourced_title`.
  - `mvp` — per season: highest `_weighted_rating(wins, losses, draws)` among standings rows with `is_primary != "false"` and ≥ 5 matches; formula `weighted_rating_min5`.
  - `kill_leader` — per season: max `kills` among primary standings rows; formula `season_kills`.
  - `best_newcomer` — per season: best weighted rating among people whose FIRST season (from stints) is this season, ≥ 5 matches; formula `weighted_rating_debut_min5`.
  - `upset_of_season` — per season: the win with the lowest winner pregame expected score (from `_elo_by_person` `on_match`); value = expected score as percent (rounded, e.g. `14`); formula `min_pregame_win_chance`.
  - `giant_slayer` — per season: the winner who beat the highest pregame-rated opponent; value = rounded opponent pregame Elo; formula `beat_highest_rated`.
  - `holzloeffel` — per (season, division): the last `rank` in `stage == "final_table"` standings rows (fallback: `is_primary != "false"` rows when no final_table stage exists for that division); value = rank; formula `last_place`.
  - `holzloeffel_redemption` — scope `career`: every person with a `holzloeffel` row in season X and a `champion` row in a season > X; value = `"S<spoon>→S<title>"` (first spoon, first later title); formula `spoon_to_title`.
  - `iron_man` — scope `career`: longest run of consecutive season numbers from stints; value = run length; formula `consecutive_seasons`.

- [ ] **Step 1: Failing tests:**

```python
from gpl_history.records import award_rows


def _standing(season, person, rank, wins, losses, kills, division="Liga 1", stage="final_table"):
    return {
        "season_id": season, "division": division, "stage": stage, "is_primary": "true",
        "rank": rank, "person_id": "", "player_name": person, "wins": wins, "losses": losses,
        "draws": "0", "kills": kills, "deaths": "0", "data_status": "available", "source_urls": "u",
    }


def test_award_rows_mvp_kill_leader_and_spoon():
    standings = [
        _standing("season_001", "Anna", "1", "10", "2", "50"),
        _standing("season_001", "Ben", "2", "8", "4", "60"),
        _standing("season_001", "Cid", "3", "1", "11", "10"),
    ]
    rows = award_rows([], [], standings, [], [])
    by_key = {row["award_key"]: row for row in rows}
    assert by_key["mvp"]["person_name"] == "Anna"
    assert by_key["kill_leader"]["person_name"] == "Ben" and by_key["kill_leader"]["value"] == 60
    assert by_key["holzloeffel"]["person_name"] == "Cid"


def test_award_rows_redemption_needs_later_title():
    standings = [_standing("season_001", "Cid", "3", "1", "11", "10")]
    champions = [{"season_id": "season_002", "champion_name": "Cid", "champion_person_id": "", "data_status": "source_evidenced", "source_urls": "c"}]
    rows = award_rows([], [], standings, champions, [])
    redemption = [r for r in rows if r["award_key"] == "holzloeffel_redemption"]
    assert len(redemption) == 1 and redemption[0]["value"] == "S1→S2"
```

- [ ] **Step 2:** Run — Expected: FAIL. 
- [ ] **Step 3: Implement** (reuse `_weighted_rating`, `_season_sort`, `_person_id`, `_add_urls`/`_join_urls` from aggregates). Deterministic final sort: `(_season_sort(season_id), award_key, person_id)` with career rows (`season_id == ""`) last.
- [ ] **Step 4:** Run: `python -m pytest tests/test_records.py -q` — Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/gpl_history/records.py tests/test_records.py && git commit -m "Add award rows builder"`

### Task 5: Wire the three aggregates into the chain and regenerate

**Files:**
- Modify: `src/gpl_history/aggregates.py:104-132` (write + read standings + register)
- Modify: `src/gpl_history/data_quality.py:65-79` (`GENERATED_ARTIFACTS`)
- Test: `tests/test_records.py` (end-to-end tmp_path test in the `test_aggregates.py` style)

**Interfaces:**
- Consumes: builders from Tasks 2–4 (imported into aggregates: `from .records import award_rows, records_progression_rows, streak_rows, AWARD_FIELDS, RECORDS_PROGRESSION_FIELDS, STREAK_FIELDS`).
- Produces: `build_aggregate_rows` returns three new keys `streaks`, `records_progression`, `awards`; `build_and_write_aggregates` writes `data/normalized/streaks.csv`, `records_progression.csv`, `awards.csv`.

- [ ] **Step 1: Failing end-to-end test** — copy the `_write_csv`/`_read_csv` local-helper pattern from `tests/test_aggregates.py:472-486`, write minimal `matches.csv`/`standings.csv`/`person_stints.csv`/`champions.csv`/`pokemon_killlists.csv` into `tmp_path/"normalized"`, call `build_and_write_aggregates(tmp_path)`, assert the returned counts include `"streaks"`, `"records_progression"`, `"awards"` and the three files exist with the exact FIELDS headers.
- [ ] **Step 2:** Run — Expected: FAIL (keys missing).
- [ ] **Step 3: Wire** reads (`standings = _read_csv(normalized_dir / "standings.csv")`), registry entries, writes, and add the three `(Path, logical)` tuples to `GENERATED_ARTIFACTS`.
- [ ] **Step 4:** Regenerate + verify determinism:

```powershell
npm run aggregates
npm run check:generated
npm run validate
python -m pytest -q
```

Expected: aggregates prints the three new counts; check-generated clean on a second run; validate green; full pytest green.
- [ ] **Step 5:** Commit code + generated data: `git add src/gpl_history data/normalized/streaks.csv data/normalized/records_progression.csv data/normalized/awards.csv tests/test_records.py && git commit -m "Wire streaks, records progression, and awards into the aggregates chain"`

### Task 6: Frontend registration + pure helpers (`web/records.js`)

**Files:**
- Create: `web/records.js`
- Modify: `web/view_config.js` (records group views: `["upset-index", "record-book", "awards", "hall-of-fame"]`), `web/index.html` (3 subnav buttons + 3 sections), `web/app.js` (`LAZY_DATASETS` + `DATASET_LABELS` + `VIEW_DATASETS` + `VIEW_RENDERERS` stubs), `web/i18n.js`
- Test: `tests/web_view_config.test.mjs`, `tests/web_records.test.mjs`

**Interfaces:**
- Produces (in `web/records.js`, all pure, `normalizeKey` param defaulting to `normalizedStatsKey`):
  - `finderFilterRows(matches, rosterMatchdays, criteria) -> rows` — criteria `{season, division, stage, participant, opponent, pokemon, sweepsOnly}`; pokemon criterion joins rosterMatchdays on `(season_id, person_name_normalized, week)`.
  - `streakTableRows(streakRows, filters) -> rows`.
  - `hofInductees({personAllTime, champions, killlists, peaks}) -> [{personId, name, criteria: [...], signaturePokemon, stats}]` — inducted when: title count ≥ 1, OR seasons ≥ 8, OR career kills in top 10, OR peak Elo in top 10, OR (win_pct ≥ 60 AND matches ≥ 40). `peaks` = `Map<personKey, peakRating>` from `eloChronology(...).perPerson`.
  - `spoonRows(awards) -> rows` and `awardsBySeason(awards, seasonId) -> rows` shapers.
- Datasets: `streaks` → `../data/normalized/streaks.csv`, `recordsProgression` → `records_progression.csv`, `awards` → `awards.csv` (all `optional: true`); labels "Serien", "Rekordverlauf", "Auszeichnungen".
- `VIEW_DATASETS`: `"record-book": ["streaks", "recordsProgression", "matchVideos", "rosterMatchdays"]`, `"awards": ["awards", "personAllTime"]`, `"hall-of-fame": ["personAllTime", "matchVideos"]`, and `"person-details"` gains `"awards"`.

- [ ] **Step 1:** Extend `tests/web_view_config.test.mjs`: records views `["upset-index", "record-book", "awards", "hall-of-fame"]`, `viewGroupForView("record-book") === "records"`, default stays `upset-index`. New `tests/web_records.test.mjs` with fixture-based asserts for `finderFilterRows` (participant + sweep filter), `hofInductees` (title inductee, kills-top-10 inductee, non-inductee), `spoonRows`.
- [ ] **Step 2:** Run both test files — Expected: FAIL.
- [ ] **Step 3:** Implement `web/records.js` + all registrations; renderer stubs (`renderRecordBook`, `renderAwards`, `renderHallOfFame`) render their section skeletons. i18n: `nav.recordBook` "Rekordbuch"/"Record Book", `nav.awards` "Auszeichnungen"/"Awards", `nav.hallOfFame` "Hall of Fame" (both), `sections.*Title/Description` for all three (descriptions carry the computed-not-official sentence), plus `recordBook.records.<key>` display names for all 10 record keys and `awards.names.<key>` + `awards.formulas.<formula>` for all 9 award keys — in BOTH languages.
- [ ] **Step 4:** Run: `node --test tests/*.mjs` — Expected: PASS. Serve and click through the three (still skeletal) views.
- [ ] **Step 5:** Commit: `git add -A web tests && git commit -m "Register record-book, awards, and hall-of-fame views with pure helpers"`

### Task 7: Rekordbuch view (Rekorde | Finder | Serien tabs)

**Files:**
- Modify: `web/app.js` (`renderRecordBook` + tab handling in the delegated click handler), `web/index.html` (tab buttons + three tab panels inside `#view-record-book`), `web/table_columns.js` (`MATCH_FINDER_COLUMNS`, `STREAK_COLUMNS`, `RECORD_HOLDER_COLUMNS`), `web/i18n.js`, `web/styles.css`
- Test: `tests/web_records.test.mjs` (any new pure shaping helpers)

**Interfaces:**
- Consumes: `stepChart` from `web/charts.js`; `finderFilterRows`/`streakTableRows` from Task 6; `videoLinksForMatch`, `personLink`, `seasonLink`, `renderTable` from app.js.
- Tab state: `state.recordBookTab` (`"records" | "finder" | "streaks"`, default `"records"`); buttons `[data-record-tab="..."]` toggle panels (same pattern as `[data-show-more-upsets]` in the delegated handler) and re-render.

- [ ] **Step 1: Rekorde tab** — record selector (buttons per record_key, i18n names); for the selected record: current-holder headline card, `stepChart` of its progression rows (x = step index, y = value; markers clickable via `video_url`), and a hand-off Tabulator (`RECORD_HOLDER_COLUMNS = ["record", "holder", "holder_pokemon", "value", "season", "week", "videos", "source"]`, holder via `personLink`, superseded rows styled muted).
- [ ] **Step 2: Finder tab** — form (season/division/stage selects populated from loaded rows, participant + opponent inputs with a shared `<datalist>` of person names, Pokémon input with datalist from rosterMatchdays, sweeps-only checkbox) → `finderFilterRows` → Tabulator with `MATCH_FINDER_COLUMNS = ["season", "week", "division", "stage", "player_a", "player_b", "score", "winner", "videos", "source"]`. The form submits on input change; a result count line sits above the table.
- [ ] **Step 3: Serien tab** — streak-type filter chips + Tabulator with `STREAK_COLUMNS = ["person", "streak_type", "length", "start_season", "start_week", "end_season", "end_week", "active", "source"]` (person via `personLink`; `streak_type` and `active` values i18n-resolved).
- [ ] **Step 4:** Run: `node --test tests/*.mjs && node --check web/app.js` — Expected: PASS. Serve; verify all three tabs, record chart clicks open videos, Finder narrows correctly, language + dark mode.
- [ ] **Step 5:** Commit: `git add -A web tests && git commit -m "Add Rekordbuch view with record progressions, match finder, and streaks"`

### Task 8: Auszeichnungen view + trophy shelf on person pages

**Files:**
- Modify: `web/app.js` (`renderAwards`, `renderPersonTrophies` called from `renderPersonDetails`), `web/index.html` (awards section content + `#person-trophies` div under `#person-focus`), `web/table_columns.js` (`AWARD_COLUMNS`), `web/i18n.js`, `web/styles.css` (`.award-card`, `.trophy-shelf`, `.trophy-chip`)
- Test: `tests/web_records.test.mjs`

**Interfaces:**
- Consumes: `awardsBySeason` from Task 6; `state.data.awards`; `personComparableKey` for person matching.
- Produces: `renderPersonTrophies(focusKey)` — chip row: one 🏆 chip per title season (champions.csv), one chip per season award (icon per award_key: mvp 🥇, kill_leader ⚔️, best_newcomer 🌱, upset_of_season ⚡, giant_slayer 🗡️, holzloeffel 🥄, holzloeffel_redemption 🔁, iron_man 🛡️), each chip `title`-tooltips the formula explanation; hidden without focus.

- [ ] **Step 1: Awards view** — season selector honors the global season filter (`state.season`; "all" shows an all-time winners table instead: person, award counts by key, seasons list). Per-season: `.award-card` grid (award name, winner `personLink`, value, formula explainer from `awards.formulas.*`, source links) + Tabulator of all rows (`AWARD_COLUMNS = ["season", "award", "division", "person", "value", "formula", "source"]`).
- [ ] **Step 2: Trophy shelf** — `#person-trophies` chip row rendered from champions + awards filtered by `personComparableKey`; a muted "berechnet" note links to the Auszeichnungen view.
- [ ] **Step 3:** Run: `node --test tests/*.mjs && node --check web/app.js` — Expected: PASS. Serve; verify a multi-title person (e.g. `#/person/bene`) shows title chips + award chips, awards view renders per-season and all-time modes, en/de.
- [ ] **Step 4:** Commit: `git add -A web tests && git commit -m "Add Auszeichnungen view and person trophy shelf"`

### Task 9: Hall of Fame (+ Holzlöffel tab), docs, release gate

**Files:**
- Modify: `web/app.js` (`renderHallOfFame` + `state.hofTab` handling), `web/index.html` (two tab panels), `web/table_columns.js` (`SPOON_COLUMNS`), `web/i18n.js`, `web/styles.css` (`.hof-card`, `.hof-criteria`)
- Modify: `README.md`, `docs/known-limitations.md`
- Test: `tests/web_records.test.mjs`

**Interfaces:**
- Consumes: `hofInductees` + `spoonRows` (Task 6), `eloChronology` peaks via `cachedEloChronology()`, `pokemonSprite`, `personLink`.

- [ ] **Step 1: Ruhmeshalle tab** — the published criteria list rendered at the top (from i18n, one line per criterion with its exact threshold); inductee `.hof-card` grid sorted by titles desc → peak Elo desc: name (`personLink`), signature Pokémon sprite (top career kills from killlists), met-criteria chips, key stats line (seasons, W-L-D, win %, peak Elo, kills).
- [ ] **Step 2: Holzlöffel tab** — spoon lineage Tabulator (`SPOON_COLUMNS = ["season", "division", "person", "value", "source"]`), spoon-count leaderboard cards, redemption arcs list from `holzloeffel_redemption` awards ("S1 → S2: Cid").
- [ ] **Step 3: Docs** — README feature list gains the Phase 2 views + the three new aggregate CSVs; `docs/known-limitations.md` gains a "Computed Awards and Records" paragraph (computed retroactively, formulas published in-app, standings-kills basis for kill records, killlist-coverage caveat for old seasons per the existing Killlist Coverage section).
- [ ] **Step 4: Full gate:**

```powershell
python -m pytest -q
node --test tests/*.mjs
node --check web/app.js; node --check web/records.js; node --check web/charts.js
npm run validate
npm run check:generated
git diff --check
```

Expected: all PASS.
- [ ] **Step 5:** Commit: `git add -A && git commit -m "Add Hall of Fame with Holzlöffel tab and document Phase 2"`

## Self-Review

- Spec coverage: streaks/records/awards CSVs = Tasks 2–5; Rekordbuch with Finder tab per the user's menu decision = Task 7; Auszeichnungen + shelf = Task 8; Hall of Fame + Holzlöffel tab = Task 9; records group extension = Task 6. Wrapped/title-odds intentionally out (Phase 6).
- Type consistency: FIELDS names in Tasks 2–4 match the Task 5 wiring and the Task 6 dataset keys; `on_match` details dict keys match between Tasks 1 and 3; `hofInductees`/`finderFilterRows` signatures match between Tasks 6–9.
- Placeholders: none; every builder has semantics + tests, every view names its columns and i18n keys.
