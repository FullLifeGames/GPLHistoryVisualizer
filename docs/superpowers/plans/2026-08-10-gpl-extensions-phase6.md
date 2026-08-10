# GPL Extensions Phase 6 (Saison-Erzählungen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three Phase 6 features from `docs/superpowers/specs/2026-08-10-gpl-extensions-design.md`: retro title odds (`title_odds.csv` + Titelrennen chart in table-history), the Season Story scrollytelling detail view, and GPL Wrapped cards (DOM deck + optional Pillow PNG export).

**Architecture:** A new pipeline module `title_odds.py` runs a seeded Monte-Carlo over the real schedule (frozen-Elo win probabilities, 3/1/0 points, random tiebreaks) and writes `data/normalized/title_odds.csv` via a dedicated `gpl-history title-odds` command — deliberately outside the check-generated drift chain. The frontend gets three pure node-tested modules (`web/title_race.js`, `web/season_story.js`, `web/wrapped.js`) plus renderers in `app.js`; Season Story reuses `standingsHistory` from `timeline.js` with an IntersectionObserver sticky layout. Wrapped PNGs come from `gpl-history wrapped-cards` (Pillow optional extra) into `web/assets/wrapped/` with a manifest the frontend probes lazily.

**Tech Stack:** Python 3.11 stdlib (`random.Random` string-seeded), Pillow (optional `[wrapped]` extra), d3 v7 via existing `charts.js`, static ES modules, node `--test` + pytest.

## Global Constraints

- No build step, no new frameworks; the site stays static ES modules + CDN globals (spec Non-Goals).
- No simulated value may ever be displayed without a Simulation label; simulated elements get dashed styling + badge + i18n explainer (spec Risks).
- Every claim shows source URLs; computed vs sourced clearly labeled; bilingual de/en with i18n key parity (test-enforced).
- `title_odds.csv` is committed like other normalized CSVs but NOT registered in `GENERATED_ARTIFACTS` / check-generated (simulation cost); README documents regeneration.
- Wrapped PNGs are not drift-checked (Pillow bytes not stable across versions); Career Wrapped is DOM-only, no PNG export in v1.
- Aggregates discipline for CSV writing: fields end in `source_urls`, sorted rows, sorted URL joins, `lineterminator="\n"` (use existing `_write_csv`).
- View ids never change; new views: detail views `season-story` and `season-wrapped` in the `seasons` group (detail views don't appear in the subnav).
- New CSV loads register as `optional: true` lazy datasets.
- PowerShell 5.1 dev environment: no `&&`, never bulk-edit UTF-8 files with Get/Set-Content.

## Locked design decisions (from data analysis)

- **Points model:** 3 per win, 1 per draw, 0 per loss. Verified against `standings.csv` final tables: 204/215 rows match exactly; the 11 mismatches are point deductions/uncaptured results (already documented behavior of `reconcileStandings`). Winner-less decided rows count as draws (records.py convention).
- **Simulation model:** per (season, division): checkpoints are the division's regular-season matchdays (`_week_sort < 100`). At checkpoint `w`, matches with order ≤ `w` contribute their real points; matches with order > `w` are simulated win/loss (no simulated draws) with probability from Elo ratings **frozen at the checkpoint** (no in-sim Elo updates). Final ranking per sim: points desc, ties broken uniformly at random. `p_first` = share of sims finishing rank 1 of the division's regular season (for S6/S10 this means winning the Conference/Regular Season, not the playoff title — noted in i18n explainer + known-limitations). `p_playoffs` = share of sims finishing in the top `K` where `K` = number of this division's players who actually appear in that season's `stage == "playoffs"` matches; empty when `K == 0`.
- **Elo at checkpoints:** one global chronological replay via `_elo_by_person(on_match=...)`; snapshot the running ratings map after every match keyed by `(season_id, week_order)` — the last write per block wins, so each key holds ratings after that block. Checkpoint lookup takes the greatest key ≤ `w` for that season; unknown players default to 1500.
- **Determinism:** each checkpoint gets `random.Random(f"{seed}:{season_id}:{division}:{week}")` — string seeding is SHA-512-based and version-stable; partial data changes only reshuffle affected checkpoints. Defaults `--sims 1000 --seed 42`; both recorded per row.
- **`week` field** holds the numeric matchday order (e.g. `"5"`), not the long sheet label — the chart x-axis is the matchday number.
- **Row `source_urls`:** sorted union of the division's regular-season match `source_urls` (a handful of sheet URLs).
- **Routes:** `#/saison-story/<season_id>` → `season-story`; `#/wrapped/<season_id>` → `season-wrapped` (season mode); `#/wrapped/person/<personKey>` → `season-wrapped` (career mode, DOM-only).
- **Wrapped PNGs:** German-only in v1, 1080×1080, background = season roster art (same mapping as `ROSTER_BACKGROUND_BY_SEASON`) with dark overlay, else a two-color gradient; font resolution tries Segoe UI/Arial/DejaVu then Pillow default. Output `web/assets/wrapped/<season_id>-<card_key>.png` + `web/assets/wrapped/manifest.json`; frontend shows download buttons only for manifest-listed cards.

## File map

| File | Responsibility |
|---|---|
| `src/gpl_history/title_odds.py` (new) | `TITLE_ODDS_FIELDS`, pure `title_odds_rows(matches, *, sims, seed)`, `build_and_write_title_odds(data_dir, *, sims, seed)` |
| `src/gpl_history/wrapped_cards.py` (new) | pure `wrapped_card_texts(...)`, `render_wrapped_cards(data_dir, web_dir)` (lazy Pillow) |
| `src/gpl_history/cli.py` | `title-odds` and `wrapped-cards` subcommands |
| `pyproject.toml` | `wrapped = ["Pillow>=10.0.0"]` optional extra |
| `web/title_race.js` (new) | pure: `titleRaceDivisions`, `titleRaceSeries` |
| `web/season_story.js` (new) | pure: `seasonStoryBeats`, `storyFrameForWeek` |
| `web/wrapped.js` (new) | pure: `wrappedCards`, `careerWrappedCards` |
| `web/view_config.js` | seasons group gains `detailViews: ["season-story", "season-wrapped"]` |
| `web/router.js` | new routes + `seasonStoryRouteHash`, `wrappedRouteHash`, `careerWrappedRouteHash` |
| `web/app.js` | `titleOdds` lazy dataset, VIEW_DATASETS, Titelrennen block in `renderTableHistory`, `renderSeasonStory`, `renderSeasonWrapped`, entry buttons, TOOLBAR_HIDDEN_VIEWS |
| `web/index.html` | Titelrennen block in table-history section; `season-story` + `season-wrapped` sections |
| `web/i18n.js` | `titleRace.*`, `seasonStory.*`, `wrapped.*` namespaces de+en |
| `web/styles.css` | `.simulation-badge`, dashed sim lines, story scrollytelling layout, wrapped deck |
| `tests/test_title_odds.py`, `tests/test_wrapped_cards.py` (new) | pytest |
| `tests/web_title_race.test.mjs`, `tests/web_season_story.test.mjs`, `tests/web_wrapped.test.mjs` (new) | node tests |
| `tests/web_router.test.mjs`, `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`, `tests/web_loading.test.mjs` | updated |
| `README.md`, `docs/known-limitations.md` | regeneration flow + simulation semantics |

---

### Task 1: Title-odds simulation builder (`title_odds.py`)

**Files:**
- Create: `src/gpl_history/title_odds.py`
- Test: `tests/test_title_odds.py`

**Interfaces:**
- Consumes: `_elo_by_person`, `_join_urls`, `_add_urls`, `_person_id`, `_season_sort`, `_week_sort`, `_read_csv`, `_write_csv` from `gpl_history.aggregates`.
- Produces: `TITLE_ODDS_FIELDS: list[str]`, `title_odds_rows(matches: list[dict], *, sims: int = 1000, seed: int = 42) -> list[dict]`, `build_and_write_title_odds(data_dir: Path, *, sims: int = 1000, seed: int = 42) -> int` (row count). Task 2 wires the CLI; Task 3+ consumes the CSV.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_title_odds.py`:

```python
from gpl_history.title_odds import TITLE_ODDS_FIELDS, title_odds_rows


def _match(season, division, week, a, b, winner, match_id, stage="regular_season", status="sheet_extracted"):
    return {
        "season_id": season,
        "division": division,
        "stage": stage,
        "week": week,
        "player_a": a,
        "player_b": b,
        "winner": winner,
        "match_id": match_id,
        "data_status": status,
        "result_basis": "",
        "source_urls": f"https://example.com/{season}",
    }


FIXTURE = [
    # Round-robin of three players over three matchdays; Alice wins everything.
    _match("season_001", "Liga 1", "1. Spieltag", "Alice", "Bob", "Alice", "m1"),
    _match("season_001", "Liga 1", "2. Spieltag", "Alice", "Carol", "Alice", "m2"),
    _match("season_001", "Liga 1", "3. Spieltag", "Bob", "Carol", "Bob", "m3"),
]


def test_fields_end_with_source_urls():
    assert TITLE_ODDS_FIELDS[-1] == "source_urls"


def test_rows_cover_every_matchday_and_player():
    rows = title_odds_rows(FIXTURE, sims=50, seed=1)
    keys = {(row["week"], row["person_id"]) for row in rows}
    assert keys == {(w, p) for w in ("1", "2", "3") for p in ("person_alice", "person_bob", "person_carol")}
    assert all(row["season_id"] == "season_001" and row["division"] == "Liga 1" for row in rows)
    assert all(row["sims"] == 50 and row["seed"] == 1 for row in rows)


def test_probabilities_sum_to_one_per_checkpoint():
    rows = title_odds_rows(FIXTURE, sims=200, seed=1)
    for week in ("1", "2", "3"):
        total = sum(float(row["p_first"]) for row in rows if row["week"] == week)
        assert abs(total - 1.0) < 1e-6


def test_last_matchday_is_certain():
    rows = title_odds_rows(FIXTURE, sims=50, seed=1)
    final = {row["person_id"]: float(row["p_first"]) for row in rows if row["week"] == "3"}
    # 2 wins for Alice, 1 for Bob, 0 for Carol -> no simulation left, no ties.
    assert final["person_alice"] == 1.0
    assert final["person_bob"] == 0.0
    assert final["person_carol"] == 0.0


def test_deterministic_for_same_seed_and_independent_of_sims_order():
    a = title_odds_rows(FIXTURE, sims=100, seed=7)
    b = title_odds_rows(FIXTURE, sims=100, seed=7)
    assert a == b
    c = title_odds_rows(FIXTURE, sims=100, seed=8)
    assert a != c  # different seed shifts at least one mid-season probability


def test_playoff_spots_from_playoff_matches():
    fixture = FIXTURE + [
        _match("season_001", "Playoffs", "Finale", "Alice", "Bob", "Alice", "p1", stage="playoffs"),
    ]
    rows = title_odds_rows(fixture, sims=100, seed=1)
    league = [row for row in rows if row["division"] == "Liga 1" and row["week"] == "3"]
    by_person = {row["person_id"]: row for row in league}
    # Two of the three players reached the playoffs -> K == 2, certainty at the last matchday.
    assert by_person["person_alice"]["p_playoffs"] == "1.0000"
    assert by_person["person_bob"]["p_playoffs"] == "1.0000"
    assert by_person["person_carol"]["p_playoffs"] == "0.0000"
    # Playoff matches never get their own odds rows.
    assert not [row for row in rows if row["division"] == "Playoffs"]


def test_skips_invalid_rows():
    fixture = FIXTURE + [
        _match("season_001", "Liga 1", "4. Spieltag", "Alice", "Bob", "", "m4", status="source_video_only"),
        {**_match("season_001", "Liga 1", "5. Spieltag", "Alice", "Bob", "", "m5"), "result_basis": "unresolved"},
    ]
    rows = title_odds_rows(fixture, sims=20, seed=1)
    assert {row["week"] for row in rows} == {"1", "2", "3"}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_title_odds.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'gpl_history.title_odds'`

- [ ] **Step 3: Implement `src/gpl_history/title_odds.py`**

```python
"""Retro title odds via a seeded Monte-Carlo over the real schedule.

Deliberately outside the check-generated drift chain: simulation is costly, so
``gpl-history title-odds`` regenerates ``data/normalized/title_odds.csv`` on
demand and the CSV is committed like the other normalized files. Semantics
(documented in docs/known-limitations.md): 3/1/0 points, winner-less decided
rows are draws, win probabilities come from career Elo frozen at the
checkpoint matchday, simulated matches never draw, ranking ties break
uniformly at random per simulation. ``p_first`` is the probability of
finishing rank 1 of the division's regular season; ``p_playoffs`` uses the
number of this division's players that actually appear in playoff matches.
Every checkpoint seeds its own ``random.Random`` with a stable string, so the
output is deterministic for a given (matches, sims, seed).
"""

from __future__ import annotations

import random
from collections import defaultdict
from pathlib import Path
from typing import Any

from .aggregates import (
    _add_urls,
    _elo_by_person,
    _join_urls,
    _person_id,
    _read_csv,
    _season_sort,
    _week_sort,
    _write_csv,
)

TITLE_ODDS_FIELDS = [
    "season_id",
    "division",
    "week",
    "person_id",
    "person_name",
    "p_first",
    "p_playoffs",
    "sims",
    "seed",
    "source_urls",
]

_SKIPPED_STATUSES = {"not_available", "source_video_only"}
_POINTS_WIN = 3
_POINTS_DRAW = 1


def _simulatable(row: dict[str, str]) -> bool:
    if row.get("data_status") in _SKIPPED_STATUSES:
        return False
    if row.get("result_basis") == "unresolved":
        return False
    if row.get("stage") != "regular_season":
        return False
    return bool(row.get("player_a")) and bool(row.get("player_b"))


def _elo_snapshots(matches: list[dict[str, str]]) -> dict[tuple[str, int], dict[str, float]]:
    """Ratings after each (season, week-order) block of the global replay."""
    running: dict[str, float] = {}
    snapshots: dict[tuple[str, int], dict[str, float]] = {}

    def on_match(row: dict[str, str], details: dict[str, Any]) -> None:
        running[details["left_key"]] = details["left_after"]
        running[details["right_key"]] = details["right_after"]
        key = (row.get("season_id") or "", _week_sort(row.get("week"), row.get("stage")))
        # Overwritten by every match of the block; the last write leaves the
        # ratings state after the block, which is exactly the checkpoint value.
        snapshots[key] = dict(running)

    _elo_by_person(matches, on_match=on_match)
    return snapshots


def _ratings_at(snapshots: dict[tuple[str, int], dict[str, float]], season_id: str, week: int) -> dict[str, float]:
    best: tuple[int, dict[str, float]] | None = None
    for (snap_season, snap_week), ratings in snapshots.items():
        if snap_season != season_id or snap_week > week:
            continue
        if best is None or snap_week > best[0]:
            best = (snap_week, ratings)
    return best[1] if best else {}


def _playoff_participants(matches: list[dict[str, str]]) -> dict[str, set[str]]:
    participants: dict[str, set[str]] = defaultdict(set)
    for row in matches:
        if row.get("stage") != "playoffs" or row.get("data_status") in _SKIPPED_STATUSES:
            continue
        for player in (row.get("player_a"), row.get("player_b")):
            if player:
                participants[row.get("season_id") or ""].add(_person_id(player))
    return participants


def _win_probability(ratings: dict[str, float], key_a: str, key_b: str) -> float:
    rating_a = ratings.get(key_a, 1500.0)
    rating_b = ratings.get(key_b, 1500.0)
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def title_odds_rows(matches: list[dict[str, str]], *, sims: int = 1000, seed: int = 42) -> list[dict[str, Any]]:
    valid = [row for row in matches if _simulatable(row)]
    snapshots = _elo_snapshots(matches)
    playoff_people = _playoff_participants(matches)

    by_division: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in valid:
        by_division[(row.get("season_id") or "", row.get("division") or "")].append(row)

    rows: list[dict[str, Any]] = []
    for (season_id, division) in sorted(by_division, key=lambda key: (_season_sort(key[0]), key[1])):
        division_rows = by_division[(season_id, division)]
        weeks = sorted({_week_sort(row.get("week"), row.get("stage")) for row in division_rows})
        weeks = [week for week in weeks if week < 100]
        if not weeks:
            continue

        players: dict[str, str] = {}
        urls: set[str] = set()
        for row in division_rows:
            for player in (row.get("player_a"), row.get("player_b")):
                players.setdefault(_person_id(player), player)
            _add_urls(urls, row.get("source_urls"))
        source_urls = _join_urls(urls)
        ids = sorted(players)
        spots = len(playoff_people.get(season_id, set()) & set(ids))

        for week in weeks:
            ratings = _ratings_at(snapshots, season_id, week)
            base_points: dict[str, float] = defaultdict(float)
            future: list[tuple[str, str, float]] = []
            for row in division_rows:
                order = _week_sort(row.get("week"), row.get("stage"))
                key_a = _person_id(row.get("player_a"))
                key_b = _person_id(row.get("player_b"))
                if order <= week:
                    winner = _person_id(row.get("winner"))
                    if winner == key_a:
                        base_points[key_a] += _POINTS_WIN
                    elif winner == key_b:
                        base_points[key_b] += _POINTS_WIN
                    else:
                        base_points[key_a] += _POINTS_DRAW
                        base_points[key_b] += _POINTS_DRAW
                else:
                    future.append((key_a, key_b, _win_probability(ratings, key_a, key_b)))

            rng = random.Random(f"{seed}:{season_id}:{division}:{week}")
            first_counts: dict[str, int] = defaultdict(int)
            qualified_counts: dict[str, int] = defaultdict(int)
            for _ in range(sims):
                points = dict(base_points)
                for key_a, key_b, probability in future:
                    if rng.random() < probability:
                        points[key_a] = points.get(key_a, 0.0) + _POINTS_WIN
                    else:
                        points[key_b] = points.get(key_b, 0.0) + _POINTS_WIN
                ranked = sorted(ids, key=lambda pid: (-points.get(pid, 0.0), rng.random()))
                first_counts[ranked[0]] += 1
                if spots:
                    for pid in ranked[:spots]:
                        qualified_counts[pid] += 1

            for pid in ids:
                rows.append(
                    {
                        "season_id": season_id,
                        "division": division,
                        "week": str(week),
                        "person_id": pid,
                        "person_name": players[pid],
                        "p_first": f"{first_counts[pid] / sims:.4f}" if sims else "",
                        "p_playoffs": f"{qualified_counts[pid] / sims:.4f}" if spots and sims else "",
                        "sims": sims,
                        "seed": seed,
                        "source_urls": source_urls,
                    }
                )
    return rows


def build_and_write_title_odds(data_dir: Path, *, sims: int = 1000, seed: int = 42) -> int:
    normalized_dir = data_dir / "normalized"
    matches = _read_csv(normalized_dir / "matches.csv")
    rows = title_odds_rows(matches, sims=sims, seed=seed)
    _write_csv(normalized_dir / "title_odds.csv", TITLE_ODDS_FIELDS, rows)
    return len(rows)
```

Note for the fixture assertion `final["person_alice"] == 1.0`: with no future matches the sort has no random component for rank 1 (Alice leads on points alone), so `p_first` parses to exactly 1.0. The `test_deterministic` check `a != c` holds because matchdays 1 and 2 still simulate future matches whose outcomes depend on the seed; if it ever flakes with tiny fixtures, raise `sims`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_title_odds.py -q`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full pytest suite**

Run: `python -m pytest -q`
Expected: 214 passed (207 existing + 7 new)

- [ ] **Step 6: Commit**

```bash
git add src/gpl_history/title_odds.py tests/test_title_odds.py
git commit -m "feat: add seeded Monte-Carlo title odds builder"
```

---

### Task 2: `gpl-history title-odds` command + generated CSV + README

**Files:**
- Modify: `src/gpl_history/cli.py` (subparser block near line 108, dispatch block near line 143)
- Modify: `README.md` (regeneration flow section)
- Create (generated): `data/normalized/title_odds.csv`

**Interfaces:**
- Consumes: `build_and_write_title_odds` from Task 1.
- Produces: committed `data/normalized/title_odds.csv` with columns `season_id,division,week,person_id,person_name,p_first,p_playoffs,sims,seed,source_urls`; frontend tasks load it lazily at `../data/normalized/title_odds.csv`.

- [ ] **Step 1: Add the subcommand**

In `src/gpl_history/cli.py`, next to the other subparsers (after the `team-graphic-slots` block):

```python
    title_odds = subparsers.add_parser("title-odds", help="Simulate retro per-matchday title odds (seeded Monte-Carlo).")
    title_odds.add_argument("--data-dir", default="data")
    title_odds.add_argument("--sims", type=int, default=1000)
    title_odds.add_argument("--seed", type=int, default=42)
```

In the dispatch chain (e.g. after the `aggregates` branch):

```python
    if args.command == "title-odds":
        from .title_odds import build_and_write_title_odds

        count = build_and_write_title_odds(Path(args.data_dir), sims=args.sims, seed=args.seed)
        print(f"title_odds: {count}")
        return 0
```

(Local import keeps CLI startup unchanged; module-level import is also acceptable if it matches the file's existing style — check how other commands import and mirror it.)

- [ ] **Step 2: Generate the CSV**

Run: `python -m gpl_history.cli title-odds --data-dir data`
Expected: prints `title_odds: <N>` with N in the low thousands; takes on the order of a minute. Spot-check: `python -c "import csv; rows=list(csv.DictReader(open('data/normalized/title_odds.csv', encoding='utf-8'))); print(len(rows), rows[0])"`

- [ ] **Step 3: Sanity-check season 10**

Run a quick check that the S10 Regular Season last matchday shows the real champion near 1.0 for `p_playoffs` and a plausible `p_first` leader:

```powershell
python -c "
import csv
rows = [r for r in csv.DictReader(open('data/normalized/title_odds.csv', encoding='utf-8')) if r['season_id']=='season_010']
last = max(int(r['week']) for r in rows)
for r in sorted(rows, key=lambda r: -float(r['p_first'])):
    if int(r['week']) == last: print(r['person_name'], r['p_first'], r['p_playoffs'])
"
```

Expected: the top of the final regular-season table has `p_first` near 1; playoff participants show `p_playoffs = 1.0000`.

- [ ] **Step 4: Verify check-generated is untouched**

Run: `npm run check:generated`
Expected: `Generated artifacts are up to date.` (title_odds.csv is intentionally NOT in `GENERATED_ARTIFACTS` — do not add it to `data_quality.py`.)

- [ ] **Step 5: Document in README**

In `README.md`, find the regeneration/pipeline commands section and add after the aggregates command:

```markdown
- `python -m gpl_history.cli title-odds --data-dir data [--sims N --seed S]` — regenerates `data/normalized/title_odds.csv` (retro Titelrennen probabilities, seeded Monte-Carlo). Not part of `check-generated` because simulation is expensive; rerun after match data changes.
```

- [ ] **Step 6: Commit**

```bash
git add src/gpl_history/cli.py README.md data/normalized/title_odds.csv
git commit -m "feat: add gpl-history title-odds command and generated CSV"
```

---

### Task 3: `web/title_race.js` pure series module

**Files:**
- Create: `web/title_race.js`
- Test: `tests/web_title_race.test.mjs`

**Interfaces:**
- Consumes: raw `title_odds.csv` row dicts (strings).
- Produces: `titleRaceDivisions(rows, seasonId) -> string[]`; `titleRaceSeries(rows, {seasonId, division, topN = 8}) -> { weeks: number[], series: [{personId, name, points: [{x, y, source}], final}], playoffSeries: same-shape[]|null, decidedWeek: number|null, decidedName: string|null, sims: number, seed: string }`. Task 4's renderer feeds `series` straight into `lineChart`.

- [ ] **Step 1: Write the failing tests**

Create `tests/web_title_race.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { titleRaceDivisions, titleRaceSeries } from "../web/title_race.js";

function row(week, personId, name, pFirst, pPlayoffs = "", division = "Liga 1") {
  return {
    season_id: "season_001",
    division,
    week: String(week),
    person_id: personId,
    person_name: name,
    p_first: pFirst,
    p_playoffs: pPlayoffs,
    sims: "100",
    seed: "42",
    source_urls: "https://example.com",
  };
}

const ROWS = [
  row(1, "person_a", "Alice", "0.6000"),
  row(1, "person_b", "Bob", "0.4000"),
  row(2, "person_a", "Alice", "0.9600"),
  row(2, "person_b", "Bob", "0.0400"),
  row(1, "person_c", "Carol", "1.0000", "", "Liga 2"),
];

test("titleRaceDivisions lists divisions of the season in order", () => {
  assert.deepEqual(titleRaceDivisions(ROWS, "season_001"), ["Liga 1", "Liga 2"]);
  assert.deepEqual(titleRaceDivisions(ROWS, "season_999"), []);
});

test("titleRaceSeries builds per-person point series over weeks", () => {
  const result = titleRaceSeries(ROWS, { seasonId: "season_001", division: "Liga 1" });
  assert.deepEqual(result.weeks, [1, 2]);
  assert.equal(result.series.length, 2);
  const alice = result.series.find((entry) => entry.personId === "person_a");
  assert.deepEqual(alice.points.map((point) => [point.x, point.y]), [[1, 0.6], [2, 0.96]]);
  assert.equal(alice.final, 0.96);
  assert.equal(result.sims, 100);
  assert.equal(result.playoffSeries, null);
});

test("series are ranked by final probability and capped at topN", () => {
  const many = [];
  for (let index = 0; index < 12; index += 1) {
    many.push(row(1, `person_${index}`, `P${index}`, (index / 100).toFixed(4)));
  }
  const result = titleRaceSeries(many, { seasonId: "season_001", division: "Liga 1", topN: 5 });
  assert.equal(result.series.length, 5);
  assert.equal(result.series[0].personId, "person_11");
});

test("decidedWeek is the first week a probability reaches 0.95", () => {
  const result = titleRaceSeries(ROWS, { seasonId: "season_001", division: "Liga 1" });
  assert.equal(result.decidedWeek, 2);
  assert.equal(result.decidedName, "Alice");
  const open = titleRaceSeries(ROWS.filter((entry) => entry.week === "1"), { seasonId: "season_001", division: "Liga 1" });
  assert.equal(open.decidedWeek, null);
});

test("playoffSeries appears when p_playoffs is populated", () => {
  const rows = [
    row(1, "person_a", "Alice", "0.6000", "0.9000"),
    row(1, "person_b", "Bob", "0.4000", "0.8000"),
  ];
  const result = titleRaceSeries(rows, { seasonId: "season_001", division: "Liga 1" });
  assert.equal(result.playoffSeries.length, 2);
  assert.deepEqual(result.playoffSeries[0].points.map((point) => point.y), [0.9]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_title_race.test.mjs`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `web/title_race.js`**

```js
// Pure parsing of title_odds.csv for the Titelrennen chart. Everything here
// is a SIMULATION readout — renderers must keep the Simulation labeling that
// app.js attaches. No DOM access; node-tested.

const DECIDED_THRESHOLD = 0.95;

function seasonRows(rows, seasonId) {
  return (rows ?? []).filter((row) => row.season_id === seasonId);
}

export function titleRaceDivisions(rows, seasonId) {
  return [...new Set(seasonRows(rows, seasonId).map((row) => row.division || ""))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
}

function buildSeriesMap(rows, field) {
  const byPerson = new Map();
  for (const row of rows) {
    const value = Number.parseFloat(row[field]);
    if (!Number.isFinite(value)) continue;
    if (!byPerson.has(row.person_id)) {
      byPerson.set(row.person_id, { personId: row.person_id, name: row.person_name, points: [] });
    }
    byPerson.get(row.person_id).points.push({ x: Number(row.week), y: value, source: row });
  }
  const series = [...byPerson.values()];
  for (const entry of series) {
    entry.points.sort((a, b) => a.x - b.x);
    entry.final = entry.points.length ? entry.points[entry.points.length - 1].y : 0;
  }
  series.sort((a, b) => b.final - a.final || a.name.localeCompare(b.name, "de"));
  return series;
}

export function titleRaceSeries(rows, { seasonId, division, topN = 8 } = {}) {
  const divisionRows = seasonRows(rows, seasonId).filter((row) => (row.division || "") === division);
  const weeks = [...new Set(divisionRows.map((row) => Number(row.week)))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const series = buildSeriesMap(divisionRows, "p_first").slice(0, topN);
  const playoffAll = buildSeriesMap(divisionRows, "p_playoffs");
  const playoffSeries = playoffAll.length ? playoffAll.slice(0, topN) : null;

  let decidedWeek = null;
  let decidedName = null;
  for (const week of weeks) {
    for (const entry of buildSeriesMap(divisionRows, "p_first")) {
      const point = entry.points.find((candidate) => candidate.x === week);
      if (point && point.y >= DECIDED_THRESHOLD) {
        decidedWeek = week;
        decidedName = entry.name;
        break;
      }
    }
    if (decidedWeek !== null) break;
  }

  const sample = divisionRows[0];
  return {
    weeks,
    series,
    playoffSeries,
    decidedWeek,
    decidedName,
    sims: sample ? Number(sample.sims) : 0,
    seed: sample ? String(sample.seed) : "",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_title_race.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add web/title_race.js tests/web_title_race.test.mjs
git commit -m "feat: add title race series parsing module"
```

---

### Task 4: Titelrennen chart inside table-history

**Files:**
- Modify: `web/app.js` (`LAZY_DATASETS` ~line 134, `VIEW_DATASETS` "table-history" ~line 167, imports, `renderTableHistory` ~line 2910)
- Modify: `web/index.html` (table-history section)
- Modify: `web/i18n.js` (`titleRace.*` de+en)
- Modify: `web/styles.css` (`.simulation-badge`, `.title-race-line`)
- Test: `tests/web_loading.test.mjs`, `tests/web_shell.test.mjs`, `tests/web_i18n.test.mjs` (parity is automatic — just keep both languages complete)

**Interfaces:**
- Consumes: `titleRaceDivisions`, `titleRaceSeries` from Task 3; `lineChart` from `web/charts.js`; existing helpers `t`, `escapeHtml`, `escapeAttr`, `formatMessage`, `seasonDisplay`, `personLink`, `personIdForName`.
- Produces: `state.titleRace = { division: "" }` session state; `#title-race-chart` block rendered by `renderTableHistory`.

- [ ] **Step 1: Register the dataset**

In `web/app.js` `LAZY_DATASETS` add:

```js
  titleOdds: { url: "../data/normalized/title_odds.csv", optional: true },
```

Change `VIEW_DATASETS`'s `"table-history": []` to `"table-history": ["titleOdds"]`.

- [ ] **Step 2: Update the loading test**

In `tests/web_loading.test.mjs`, mirror the existing pattern that asserts lazy dataset registration/view mapping (find the assertions for `streaks`/`recordsProgression` and add equivalents):

```js
assert.ok(appSource.includes('titleOdds: { url: "../data/normalized/title_odds.csv", optional: true }'));
assert.ok(appSource.includes('"table-history": ["titleOdds"]'));
```

Run: `node --test tests/web_loading.test.mjs` — expected FAIL before the app.js edit, PASS after (Step 1 already applied → PASS now).

- [ ] **Step 3: Add markup**

In `web/index.html`, inside the table-history section before its table container, add:

```html
        <div class="section-subhead title-race-head">
          <h3 data-i18n="titleRace.title">Titelrennen</h3>
          <span class="simulation-badge" data-i18n="titleRace.simBadge">Simulation</span>
        </div>
        <p class="section-note" id="title-race-note"></p>
        <div class="audience-controls title-race-controls">
          <label for="title-race-division"><span data-i18n="titleRace.division">Liga</span>
            <select id="title-race-division"></select>
          </label>
        </div>
        <div id="title-race-chart"></div>
        <div id="title-race-legend" class="audience-legend"></div>
        <div class="section-subhead title-race-playoffs-head" id="title-race-playoffs-head" hidden>
          <h3 data-i18n="titleRace.playoffsTitle">Playoff-Chancen</h3>
          <span class="simulation-badge" data-i18n="titleRace.simBadge">Simulation</span>
        </div>
        <div id="title-race-playoffs-chart"></div>
```

- [ ] **Step 4: i18n keys (de + en, keep parity)**

In `web/i18n.js` add a `titleRace` namespace to both languages:

```js
    titleRace: {
      title: "Titelrennen",
      simBadge: "Simulation",
      division: "Liga",
      note: "Monte-Carlo-Simulation ({sims} Durchläufe, Seed {seed}): Wahrscheinlichkeit, die reguläre Saison der Liga auf Platz 1 abzuschließen — eingefrorene Elo-Werte je Spieltag, 3/1/0-Punkte, Gleichstände zufällig. Berechnet, nicht offiziell.",
      decided: "rechnerisch entschieden",
      decidedNote: "{name} ist ab Spieltag {week} rechnerisch kaum noch einzuholen (≥ 95 %).",
      playoffsTitle: "Playoff-Chancen",
      chooseSeason: "Saison wählen, um das Titelrennen zu sehen.",
      empty: "Keine Titelrennen-Daten für diese Saison. `gpl-history title-odds` erzeugt data/normalized/title_odds.csv.",
      tooltip: "{name} · Spieltag {week}: {value} Titelwahrscheinlichkeit",
    },
```

English mirror:

```js
    titleRace: {
      title: "Title race",
      simBadge: "Simulation",
      division: "Division",
      note: "Monte-Carlo simulation ({sims} runs, seed {seed}): probability of finishing the division's regular season in first place — Elo frozen per matchday, 3/1/0 points, ties broken at random. Computed, not official.",
      decided: "mathematically decided",
      decidedNote: "{name} is practically uncatchable from matchday {week} on (≥ 95%).",
      playoffsTitle: "Playoff odds",
      chooseSeason: "Pick a season to see the title race.",
      empty: "No title odds for this season. `gpl-history title-odds` generates data/normalized/title_odds.csv.",
      tooltip: "{name} · matchday {week}: {value} title probability",
    },
```

- [ ] **Step 5: Renderer**

In `web/app.js`: import `{ titleRaceDivisions, titleRaceSeries } from "./title_race.js";` (alphabetized into the import block). Add to the state init `titleRace: { division: "" },`. Add the render function near `renderTableHistory` and call it at the top of `renderTableHistory()`:

```js
function renderTitleRace() {
  const note = document.querySelector("#title-race-note");
  const chart = document.querySelector("#title-race-chart");
  const legend = document.querySelector("#title-race-legend");
  const controls = document.querySelector(".title-race-controls");
  const playoffHead = document.querySelector("#title-race-playoffs-head");
  const playoffChart = document.querySelector("#title-race-playoffs-chart");
  if (!chart) return;
  playoffHead.hidden = true;
  playoffChart.replaceChildren();
  legend.innerHTML = "";

  const rows = state.data.titleOdds ?? [];
  if (state.season === "all") {
    controls.hidden = true;
    chart.replaceChildren();
    note.textContent = t(state.language, "titleRace.chooseSeason");
    return;
  }
  const divisions = titleRaceDivisions(rows, state.season);
  if (!divisions.length) {
    controls.hidden = true;
    chart.replaceChildren();
    note.textContent = t(state.language, "titleRace.empty");
    return;
  }
  controls.hidden = divisions.length < 2;
  if (!divisions.includes(state.titleRace.division)) state.titleRace.division = divisions[0];
  const select = document.querySelector("#title-race-division");
  select.innerHTML = divisions
    .map((division) => `<option value="${escapeAttr(division)}"${division === state.titleRace.division ? " selected" : ""}>${escapeHtml(divisionDisplay(division, "regular_season"))}</option>`)
    .join("");
  select.onchange = () => {
    state.titleRace.division = select.value;
    renderTitleRace();
  };

  const race = titleRaceSeries(rows, { seasonId: state.season, division: state.titleRace.division });
  note.textContent = formatMessage(t(state.language, "titleRace.note"), { sims: race.sims, seed: race.seed });

  const percent = (value) => `${Math.round(value * 100)} %`;
  const chartSeries = race.series.map((entry, index) => ({
    className: `viz-series-${(index % 12) + 1} title-race-line`,
    points: entry.points,
    name: entry.name,
  }));
  const markers = [];
  if (race.decidedWeek !== null) {
    markers.push({
      x: race.decidedWeek,
      y: 0.95,
      label: t(state.language, "titleRace.decided"),
      labelAt: "top",
      className: "title-race-decided",
    });
  }
  lineChart(chart, {
    series: chartSeries,
    markers,
    height: 280,
    yDomain: [0, 1.02],
    formatX: (value) => (Number.isInteger(value) ? String(value) : ""),
    formatY: percent,
    tooltip: (source) =>
      formatMessage(t(state.language, "titleRace.tooltip"), {
        name: source.person_name,
        week: source.week,
        value: percent(Number.parseFloat(source.p_first)),
      }),
    fallbackText: t(state.language, "titleRace.empty"),
  });
  legend.innerHTML = race.series
    .map(
      (entry, index) =>
        `<span class="audience-legend-item"><span class="audience-legend-swatch viz-series-${(index % 12) + 1}"></span>${personLink(personIdForName(entry.name), entry.name)} · ${percent(entry.final)}</span>`,
    )
    .join("");
  if (race.decidedWeek !== null) {
    note.textContent += ` ${formatMessage(t(state.language, "titleRace.decidedNote"), { name: race.decidedName, week: race.decidedWeek })}`;
  }

  if (race.playoffSeries) {
    playoffHead.hidden = false;
    lineChart(playoffChart, {
      series: race.playoffSeries.map((entry, index) => ({
        className: `viz-series-${(index % 12) + 1} title-race-line`,
        points: entry.points,
        name: entry.name,
      })),
      height: 220,
      yDomain: [0, 1.02],
      formatX: (value) => (Number.isInteger(value) ? String(value) : ""),
      formatY: percent,
      tooltip: (source) =>
        formatMessage(t(state.language, "titleRace.tooltip"), {
          name: source.person_name,
          week: source.week,
          value: percent(Number.parseFloat(source.p_playoffs)),
        }),
      fallbackText: "",
    });
  }
}
```

Adjust helper names to what exists while implementing (`divisionDisplay(division, stage)` exists; check `formatMessage` argument style used by zeitstrahl and match it).

- [ ] **Step 6: Simulation styling**

In `web/styles.css` (near the existing chart styles) add:

```css
.simulation-badge {
  border: 1px dashed var(--muted);
  border-radius: 999px;
  color: var(--muted);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  padding: 2px 10px;
  text-transform: uppercase;
}

.chart-line.title-race-line {
  stroke-dasharray: 6 4;
}

.chart-marker.title-race-decided circle {
  fill: none;
  stroke: var(--muted);
  stroke-dasharray: 3 3;
}

.title-race-head,
.title-race-playoffs-head {
  align-items: center;
  display: flex;
  gap: 12px;
}
```

- [ ] **Step 7: Shell test**

In `tests/web_shell.test.mjs`, follow the existing pattern asserting section internals and add checks that the table-history section contains `id="title-race-chart"` and `data-i18n="titleRace.simBadge"`.

Run: `node --test tests/web_shell.test.mjs tests/web_loading.test.mjs tests/web_i18n.test.mjs`
Expected: PASS

- [ ] **Step 8: Browser check**

With `python scripts/serve.py 8010` running, open `http://localhost:8010/web/#/table-history`, pick Saison 4: dashed probability lines appear above the standings table with Simulation badge, legend, decided marker (S4 should decide late), Liga select for two-division seasons, playoff charts on S6/S10, EN toggle + dark mode sane. Reload the page after each edit (hash navigation does not reload ES modules).

- [ ] **Step 9: Commit**

```bash
git add web/app.js web/index.html web/i18n.js web/styles.css tests/web_shell.test.mjs tests/web_loading.test.mjs
git commit -m "feat: render Titelrennen simulation chart in table-history"
```

---

### Task 5: `web/season_story.js` beat builder

**Files:**
- Create: `web/season_story.js`
- Test: `tests/web_season_story.test.mjs`

**Interfaces:**
- Consumes: plain row dicts; week ordering helper passed in from app.js (`weekSortValue`-like) to avoid importing app internals — the module defines its own `storyWeekOrder` mirroring `_week_sort`.
- Produces:
  - `storyWeekOrder(week, stage) -> number` (numeric matchday, 110/120/130/140 playoff phases, 999 fallback)
  - `storyFrameForWeek(weeks, week) -> number` (index of the last frame ≤ week; frames align with the division's matchday list)
  - `seasonStoryBeats({ seasonId, division, weeks, matches, champions, highlights, titleOdds, playoffMatches, topHighlights = 3 }) -> beats[]` where each beat is `{ kind: "intro"|"race"|"highlight"|"decided"|"playoff"|"champion", week, frameIndex, ...payload }`, sorted chronologically with `intro` first and `champion` last.

- [ ] **Step 1: Write the failing tests**

Create `tests/web_season_story.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { seasonStoryBeats, storyFrameForWeek, storyWeekOrder } from "../web/season_story.js";

test("storyWeekOrder mirrors the pipeline week ordering", () => {
  assert.equal(storyWeekOrder("5. Spieltag - Sonntag", "regular_season"), 5);
  assert.equal(storyWeekOrder("Halbfinale", "playoffs"), 120);
  assert.equal(storyWeekOrder("Finale", "playoffs"), 140);
  assert.equal(storyWeekOrder("", "playoffs"), 150);
});

test("storyFrameForWeek finds the last frame at or before the week", () => {
  assert.equal(storyFrameForWeek([1, 2, 3, 4], 3), 2);
  assert.equal(storyFrameForWeek([1, 2, 3, 4], 99), 3);
  assert.equal(storyFrameForWeek([1, 2, 3, 4], 0), 0);
});

const MATCHES = [1, 2, 3, 4].flatMap((week) => [
  {
    season_id: "season_001",
    division: "Liga 1",
    stage: "regular_season",
    week: `${week}. Spieltag`,
    player_a: "Alice",
    player_b: "Bob",
    winner: "Alice",
    match_id: `m${week}`,
    data_status: "sheet_extracted",
    source_urls: "https://example.com/sheet",
  },
]);

const BASE = {
  seasonId: "season_001",
  division: "Liga 1",
  weeks: [1, 2, 3, 4],
  matches: MATCHES,
  champions: [{ season_id: "season_001", champion_name: "Alice", champion_team: "Team A", source_urls: "https://example.com/c" }],
  highlights: [
    { season_id: "season_001", match_id: "m2", division: "Liga 1", week: "2. Spieltag", player_a: "Alice", player_b: "Bob", score: "6 - 4", highlight_score: "80", video_urls: "https://youtube.com/watch?v=x", source_urls: "https://example.com/h" },
  ],
  titleOdds: [
    { season_id: "season_001", division: "Liga 1", week: "3", person_id: "person_alice", person_name: "Alice", p_first: "0.9700", p_playoffs: "", sims: "100", seed: "42", source_urls: "https://example.com" },
  ],
  playoffMatches: [],
};

test("beats start with intro and end with champion", () => {
  const beats = seasonStoryBeats(BASE);
  assert.equal(beats[0].kind, "intro");
  assert.equal(beats[beats.length - 1].kind, "champion");
  assert.equal(beats[beats.length - 1].name, "Alice");
});

test("intro counts players and matchdays", () => {
  const intro = seasonStoryBeats(BASE)[0];
  assert.equal(intro.playerCount, 2);
  assert.equal(intro.matchdayCount, 4);
  assert.equal(intro.frameIndex, 0);
});

test("highlight beats carry match info and land on their week frame", () => {
  const highlight = seasonStoryBeats(BASE).find((beat) => beat.kind === "highlight");
  assert.equal(highlight.matchId, "m2");
  assert.equal(highlight.frameIndex, 1);
  assert.equal(highlight.videoUrl, "https://youtube.com/watch?v=x");
});

test("decided beat comes from title odds crossing 0.95", () => {
  const decided = seasonStoryBeats(BASE).find((beat) => beat.kind === "decided");
  assert.equal(decided.week, 3);
  assert.equal(decided.name, "Alice");
  const withoutOdds = seasonStoryBeats({ ...BASE, titleOdds: [] });
  assert.equal(withoutOdds.find((beat) => beat.kind === "decided"), undefined);
});

test("race beats appear at mid-race checkpoints", () => {
  const race = seasonStoryBeats(BASE).filter((beat) => beat.kind === "race");
  assert.ok(race.length >= 1);
  assert.ok(race.every((beat) => beat.frameIndex >= 0 && beat.frameIndex <= 3));
});

test("playoff beats are emitted in bracket order", () => {
  const playoffs = [
    { season_id: "season_001", division: "Playoffs", stage: "playoffs", week: "Finale", player_a: "Alice", player_b: "Bob", winner: "Alice", score_a: "4", score_b: "2", match_id: "p2", data_status: "sheet_extracted", source_urls: "https://example.com/f" },
    { season_id: "season_001", division: "Playoffs", stage: "playoffs", week: "Halbfinale", player_a: "Bob", player_b: "Carol", winner: "Bob", score_a: "3", score_b: "1", match_id: "p1", data_status: "sheet_extracted", source_urls: "https://example.com/hf" },
  ];
  const beats = seasonStoryBeats({ ...BASE, playoffMatches: playoffs });
  const playoffBeats = beats.filter((beat) => beat.kind === "playoff");
  assert.deepEqual(playoffBeats.map((beat) => beat.matchId), ["p1", "p2"]);
  const championIndex = beats.findIndex((beat) => beat.kind === "champion");
  assert.ok(beats.findIndex((beat) => beat.matchId === "p2") < championIndex);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_season_story.test.mjs`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `web/season_story.js`**

```js
// Pure beat building for the Season Story scrollytelling view. Beats are
// data-derived narration units; the actual German/English sentences live in
// i18n templates so every claim stays sourced and bilingual. No DOM access.

const PHASE_ORDER = [
  ["vorrunde", 100],
  ["viertel", 110],
  ["halb", 120],
  ["platz 3", 130],
  ["final", 140],
];

export function storyWeekOrder(week, stage) {
  const match = /(\d+)/.exec(String(week ?? ""));
  const folded = String(week ?? "").toLowerCase();
  if (match && !PHASE_ORDER.some(([needle]) => folded.includes(needle))) return Number(match[1]);
  for (const [needle, order] of PHASE_ORDER) {
    if (folded.includes(needle)) return order;
  }
  return stage === "playoffs" ? 150 : 999;
}

export function storyFrameForWeek(weeks, week) {
  let frame = 0;
  for (let index = 0; index < (weeks ?? []).length; index += 1) {
    if (weeks[index] <= week) frame = index;
  }
  return frame;
}

const DECIDED_THRESHOLD = 0.95;

export function seasonStoryBeats({
  seasonId,
  division,
  weeks = [],
  matches = [],
  champions = [],
  highlights = [],
  titleOdds = [],
  playoffMatches = [],
  topHighlights = 3,
} = {}) {
  const beats = [];
  const divisionMatches = matches.filter(
    (row) => row.season_id === seasonId && (row.division || "") === division && row.stage === "regular_season",
  );
  const players = new Set(
    divisionMatches.flatMap((row) => [row.player_a, row.player_b]).filter(Boolean),
  );

  beats.push({
    kind: "intro",
    week: weeks[0] ?? 0,
    frameIndex: 0,
    playerCount: players.size,
    matchdayCount: weeks.length,
    sourceUrls: divisionMatches[0]?.source_urls ?? "",
  });

  // Race checkpoints at one and two thirds of the season keep the sticky
  // table moving even in seasons without notable highlight matches.
  for (const ratio of [1 / 3, 2 / 3]) {
    if (weeks.length < 3) break;
    const index = Math.max(1, Math.round(weeks.length * ratio) - 1);
    beats.push({ kind: "race", week: weeks[index], frameIndex: index });
  }

  const topMatches = highlights
    .filter((row) => row.season_id === seasonId)
    .map((row) => ({ row, score: Number.parseFloat(row.highlight_score) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, topHighlights);
  for (const entry of topMatches) {
    const week = storyWeekOrder(entry.row.week, entry.row.stage);
    beats.push({
      kind: "highlight",
      week,
      frameIndex: storyFrameForWeek(weeks, week),
      matchId: entry.row.match_id,
      playerA: entry.row.player_a,
      playerB: entry.row.player_b,
      score: entry.row.score ?? "",
      highlightScore: entry.score,
      videoUrl: String(entry.row.video_urls ?? "").split(";")[0] ?? "",
      sourceUrls: entry.row.source_urls ?? "",
    });
  }

  const oddsRows = titleOdds
    .filter((row) => row.season_id === seasonId && (row.division || "") === division)
    .map((row) => ({ week: Number(row.week), name: row.person_name, p: Number.parseFloat(row.p_first) }))
    .filter((entry) => Number.isFinite(entry.week) && Number.isFinite(entry.p))
    .sort((a, b) => a.week - b.week || b.p - a.p);
  const decided = oddsRows.find((entry) => entry.p >= DECIDED_THRESHOLD);
  if (decided) {
    beats.push({
      kind: "decided",
      week: decided.week,
      frameIndex: storyFrameForWeek(weeks, decided.week),
      name: decided.name,
      probability: decided.p,
    });
  }

  const playoffBeats = playoffMatches
    .filter((row) => row.season_id === seasonId)
    .map((row) => ({ row, order: storyWeekOrder(row.week, row.stage) }))
    .sort((a, b) => a.order - b.order || String(a.row.match_id).localeCompare(String(b.row.match_id), "en"));
  for (const entry of playoffBeats) {
    beats.push({
      kind: "playoff",
      week: entry.order,
      frameIndex: weeks.length ? weeks.length - 1 : 0,
      matchId: entry.row.match_id,
      weekLabel: entry.row.week ?? "",
      playerA: entry.row.player_a,
      playerB: entry.row.player_b,
      score: entry.row.score_a || entry.row.score_b ? `${entry.row.score_a || "?"} - ${entry.row.score_b || "?"}` : "",
      winner: entry.row.winner ?? "",
      sourceUrls: entry.row.source_urls ?? "",
    });
  }

  const championRow = champions.find((row) => row.season_id === seasonId);
  beats.push({
    kind: "champion",
    week: Number.POSITIVE_INFINITY,
    frameIndex: weeks.length ? weeks.length - 1 : 0,
    name: championRow?.champion_name ?? "",
    team: championRow?.champion_team ?? "",
    sourceUrls: championRow?.source_urls ?? "",
  });

  const rank = { intro: 0, race: 1, highlight: 1, decided: 1, playoff: 2, champion: 3 };
  beats.sort((a, b) => rank[a.kind] - rank[b.kind] || a.week - b.week);
  return beats;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_season_story.test.mjs`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add web/season_story.js tests/web_season_story.test.mjs
git commit -m "feat: add season story beat builder"
```

---

### Task 6: Season Story view (route, shell, renderer, scrollytelling)

**Files:**
- Modify: `web/view_config.js` (seasons group gains `detailViews: ["season-story", "season-wrapped"]` — add both ids now so Task 8 only wires the renderer)
- Modify: `web/router.js` (routes + hash helpers)
- Modify: `web/index.html` (season-story section; season-wrapped placeholder section added in Task 8)
- Modify: `web/i18n.js` (`seasonStory.*` de+en, `sections.seasonStory.*`)
- Modify: `web/app.js` (route handling, renderer, VIEW_DATASETS, TOOLBAR_HIDDEN_VIEWS, entry buttons in season-detail + zeitreise)
- Modify: `web/styles.css`
- Test: `tests/web_router.test.mjs`, `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`, `tests/web_i18n.test.mjs`

**Interfaces:**
- Consumes: `seasonStoryBeats`, `storyFrameForWeek`, `storyWeekOrder` (Task 5); `buildTimeline`, `standingsHistory` from `web/timeline.js`; `titleRaceSeries` (Task 3) is NOT needed — beats read titleOdds rows directly.
- Produces: route `#/saison-story/<season_id>` and helpers `seasonStoryRouteHash(seasonId)`; renderer `renderSeasonStory`; `state.story = { division: "" }`. Task 8 links the champion beat to Wrapped via `wrappedRouteHash`.

- [ ] **Step 1: Routing + view config + failing tests**

`web/view_config.js` seasons group:

```js
  {
    id: "seasons",
    labelKey: "navGroups.seasons",
    defaultView: "battle-history",
    views: ["battle-history", "match-highlights", "season-detail", "table-history", "match-plan", "zeitreise"],
    detailViews: ["season-story", "season-wrapped"],
  },
```

`web/router.js` — inside `parseRouteHash` before the group-id fallback:

```js
  if (parts[0] === "saison-story" && parts[1]) {
    return { view: "season-story", personKey: null, seasonId: parts[1], storyRoute: true };
  }
  if (parts[0] === "wrapped" && parts[1] === "person" && parts[2]) {
    return { view: "season-wrapped", personKey: null, wrappedPersonKey: parts[2] };
  }
  if (parts[0] === "wrapped" && parts[1]) {
    return { view: "season-wrapped", personKey: null, seasonId: parts[1], wrappedRoute: true };
  }
```

And helpers at the bottom:

```js
export function seasonStoryRouteHash(seasonId) {
  return `#/saison-story/${encodeURIComponent(seasonId)}`;
}

export function wrappedRouteHash(seasonId) {
  return `#/wrapped/${encodeURIComponent(seasonId)}`;
}

export function careerWrappedRouteHash(personKey) {
  return `#/wrapped/person/${encodeURIComponent(personKey)}`;
}
```

Update `tests/web_router.test.mjs` following its existing assertion style:

```js
assert.deepEqual(parseRouteHash("#/saison-story/season_004"), { view: "season-story", personKey: null, seasonId: "season_004", storyRoute: true });
assert.deepEqual(parseRouteHash("#/wrapped/season_004"), { view: "season-wrapped", personKey: null, seasonId: "season_004", wrappedRoute: true });
assert.deepEqual(parseRouteHash("#/wrapped/person/bene"), { view: "season-wrapped", personKey: null, wrappedPersonKey: "bene" });
assert.equal(seasonStoryRouteHash("season_004"), "#/saison-story/season_004");
assert.equal(wrappedRouteHash("season_004"), "#/wrapped/season_004");
assert.equal(careerWrappedRouteHash("bene"), "#/wrapped/person/bene");
```

Update `tests/web_view_config.test.mjs` where detail views are asserted (mirror the people/duels assertions) to expect the seasons group `detailViews`.

Run: `node --test tests/web_router.test.mjs tests/web_view_config.test.mjs`
Expected: PASS after the edits above (write tests first, watch them fail, then edit).

- [ ] **Step 2: Route handling in app.js**

In `applyRouteFromHash` (~line 736), the existing `else if (route.seasonId)` branch handles season-detail; the parse result for the new routes also carries `route.view`, so extend the chain BEFORE that branch:

```js
  } else if (route.storyRoute) {
    state.season = route.seasonId;
    // fall through to the shared view switch with view "season-story"
  } else if (route.wrappedRoute || route.wrappedPersonKey) {
    if (route.seasonId) state.season = route.seasonId;
    state.wrappedFocus = route.wrappedPersonKey ? { personKey: route.wrappedPersonKey } : null;
  } else if (route.seasonId) {
```

Follow the surrounding code's structure exactly (it sets `state.view`/selects — replicate what the `route.rivalryKey` branch does for its view, including any `setActiveView` call). Add `"season-story"` and `"season-wrapped"` to `TOOLBAR_HIDDEN_VIEWS` (~line 872). Add VIEW_DATASETS:

```js
  "season-story": ["matchHighlights", "matchVideos", "titleOdds", "seasonStorylines"],
  "season-wrapped": ["awards", "matchHighlights", "videos", "matchVideos", "personAllTime"],
```

Register renderers in `VIEW_RENDERERS`: `"season-story": renderSeasonStory,` and (Task 8) `"season-wrapped": renderSeasonWrapped,` — for now point season-wrapped at a stub `function renderSeasonWrapped() {}` so the app doesn't crash on the route (Task 8 replaces it).

- [ ] **Step 3: Section markup + i18n**

`web/index.html`, after the season-detail section:

```html
      <section class="view" id="season-story" hidden>
        <div class="section-head">
          <h2 data-i18n="sections.seasonStory.title">Season Story</h2>
          <p data-i18n="sections.seasonStory.description"></p>
        </div>
        <p class="section-note" id="story-note"></p>
        <div class="audience-controls story-controls">
          <label for="story-division"><span data-i18n="seasonStory.division">Liga</span>
            <select id="story-division"></select>
          </label>
        </div>
        <div class="story-layout">
          <aside class="story-sticky">
            <h3 id="story-sticky-title"></h3>
            <div id="story-standings"></div>
          </aside>
          <div class="story-beats" id="story-beats"></div>
        </div>
      </section>
```

i18n de:

```js
    seasonStory: {
      division: "Liga",
      standingsAfter: "Tabelle nach Spieltag {week}",
      standingsStart: "Tabelle zum Saisonstart",
      intro: "{players} Trainer, {matchdays} Spieltage: So lief die Saison.",
      race: "Nach Spieltag {week} führt {leader} mit {points} Punkten{gap}.",
      raceGap: " — {chaser} liegt {points} Punkte dahinter",
      highlight: "Highlight an Spieltag: {playerA} gegen {playerB} ({score}).",
      decided: "Simulation: Ab Spieltag {week} ist {name} rechnerisch kaum noch einzuholen (≥ 95 %).",
      playoff: "{week}: {playerA} gegen {playerB} ({score}) – Sieger: {winner}.",
      champion: "Champion: {name} ({team}).",
      watch: "Video ansehen",
      toWrapped: "Zum GPL Wrapped",
      empty: "Keine Story-Daten für diese Saison.",
      chooseSeason: "Saison wählen.",
      simNote: "Simulation",
    },
```

en mirror (translate the values; keep identical keys). Add `sections.seasonStory` (title/description) in both languages, mirroring how other sections do it.

- [ ] **Step 4: Renderer with IntersectionObserver**

In `web/app.js` (imports: `buildTimeline`, `standingsHistory` may already be imported for zeitreise — check and extend the existing import from `./timeline.js`; import beats functions from `./season_story.js`):

```js
let storyObserver = null;

function renderSeasonStory() {
  const note = document.querySelector("#story-note");
  const beatsHost = document.querySelector("#story-beats");
  const standingsHost = document.querySelector("#story-standings");
  const stickyTitle = document.querySelector("#story-sticky-title");
  const controls = document.querySelector(".story-controls");
  if (storyObserver) {
    storyObserver.disconnect();
    storyObserver = null;
  }
  beatsHost.innerHTML = "";
  standingsHost.innerHTML = "";
  if (state.season === "all") {
    controls.hidden = true;
    note.textContent = t(state.language, "seasonStory.chooseSeason");
    return;
  }

  const seasonMatches = (state.data.matches ?? []).filter((row) => row.season_id === state.season);
  const timeline = buildTimeline(seasonMatches);
  const history = standingsHistory(timeline).get(state.season);
  const divisions = history ? [...history.keys()].filter(Boolean) : [];
  if (!divisions.length) {
    controls.hidden = true;
    note.textContent = t(state.language, "seasonStory.empty");
    return;
  }
  controls.hidden = divisions.length < 2;
  if (!divisions.includes(state.story.division)) state.story.division = divisions[0];
  const select = document.querySelector("#story-division");
  select.innerHTML = divisions
    .map((division) => `<option value="${escapeAttr(division)}"${division === state.story.division ? " selected" : ""}>${escapeHtml(divisionDisplay(division, "regular_season"))}</option>`)
    .join("");
  select.onchange = () => {
    state.story.division = select.value;
    renderSeasonStory();
  };
  note.textContent = "";

  const frames = history.get(state.story.division) ?? [];
  const divisionTicks = timeline.ticks
    .filter((tick) => tick.matches.some((row) => (row.division || "") === state.story.division))
    .map((tick) => tick.weekNumber ?? tick.order);
  const weeks = divisionTicks.filter((order) => order < 100);
  const beats = seasonStoryBeats({
    seasonId: state.season,
    division: state.story.division,
    weeks,
    matches: state.data.matches ?? [],
    champions: state.data.champions ?? [],
    highlights: state.data.matchHighlights ?? [],
    titleOdds: state.data.titleOdds ?? [],
    playoffMatches: (state.data.matches ?? []).filter((row) => row.season_id === state.season && row.stage === "playoffs"),
  });

  beatsHost.innerHTML = beats.map((beat, index) => storyBeatHtml(beat, index, frames, weeks)).join("");
  renderStoryStandings(standingsHost, stickyTitle, frames, weeks, 0);
  storyObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const frameIndex = Number(entry.target.dataset.frame);
        document.querySelectorAll(".story-beat.is-active").forEach((el) => el.classList.remove("is-active"));
        entry.target.classList.add("is-active");
        renderStoryStandings(standingsHost, stickyTitle, frames, weeks, frameIndex);
      }
    },
    { rootMargin: "-40% 0px -50% 0px" },
  );
  document.querySelectorAll(".story-beat").forEach((el) => storyObserver.observe(el));
}
```

`renderStoryStandings(host, titleEl, frames, weeks, frameIndex)` renders the frame's top 10 as a compact table (rank, personLink, points, kills-diff), sets the title via `formatMessage(t(..., "seasonStory.standingsAfter"), { week: weeks[frameIndex] })` (or `standingsStart` for index 0 when nothing is played yet). `standingsHistory` frames are arrays from `rankedRows(table)` — inspect one frame in the browser/`timeline.js` (`rankedRows`) while implementing to use its exact property names (they carry `key`, `name`?, `points`, `wins`… — mirror what zeitreise's standings renderer reads; find it via `standingsHistory(` usage in app.js).

`storyBeatHtml(beat, index, frames, weeks)` returns `<article class="story-beat" data-frame="${beat.frameIndex}">…</article>` with per-kind content:
- intro → `seasonStory.intro` template;
- race → read leader/chaser from `frames[beat.frameIndex]` (rows [0] and [1]) into `seasonStory.race` + `raceGap`;
- highlight → players, score, `videoLinksForMatch(beat.matchId)` or `beat.videoUrl` link labeled `seasonStory.watch`, thumbnail via the i.ytimg pattern used by the cinema/upset views (grep `i.ytimg` in app.js and reuse the helper);
- decided → `seasonStory.decided` + `.simulation-badge` span;
- playoff → `seasonStory.playoff`;
- champion → `seasonStory.champion` + `personLink`, sources via `sourceLinks(beat.sourceUrls)`, plus a link `wrappedRouteHash(state.season)` labeled `seasonStory.toWrapped` (import from router.js).
Every beat with `sourceUrls` appends `sourceLinks(...)`.

- [ ] **Step 5: Entry links**

- `renderSeasonDetail` (~line 5338): in the summary card block add a links row under the metric cards:
  ```js
  `<p class="story-entry"><a class="link-button" href="${escapeAttr(seasonStoryRouteHash(state.season))}">${escapeHtml(t(state.language, "sections.seasonStory.title"))}</a> <a class="link-button" href="${escapeAttr(wrappedRouteHash(state.season))}">GPL Wrapped</a></p>`
  ```
- Zeitreise: find the zeitreise section head render and add the same season-story link when `state.season !== "all"` (skip if the zeitreise UI has no obvious host — the season-detail entry is the primary one; note the decision in the commit message if skipped).

- [ ] **Step 6: CSS**

```css
.story-layout {
  align-items: start;
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
}

.story-sticky {
  position: sticky;
  top: 76px;
}

.story-sticky table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.story-sticky td, .story-sticky th { padding: 4px 8px; border-bottom: 1px solid var(--border); }

.story-beats { display: flex; flex-direction: column; gap: 40vh; padding: 20vh 0 40vh; }

.story-beat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  opacity: 0.55;
  padding: 18px 20px;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.story-beat.is-active { opacity: 1; transform: translateY(-2px); }

.story-beat img { border-radius: 8px; max-width: 100%; }

@media (max-width: 800px) {
  .story-layout { grid-template-columns: 1fr; }
  .story-sticky { position: static; }
  .story-beats { gap: 24px; padding: 0; }
}
```

- [ ] **Step 7: Shell/i18n tests + full node suite**

Update `tests/web_shell.test.mjs` for the new section (`id="season-story"`, `sections.seasonStory.title`). Run: `node --test tests/*.mjs` — expected all pass.

- [ ] **Step 8: Browser check**

`http://localhost:8010/web/#/saison-story/season_004` (reload!): sticky standings advance while scrolling beats; division select works; decided beat shows Simulation badge; champion beat links to Wrapped (stub view for now); entry buttons visible on season-detail; toolbar hidden; EN + dark mode fine; 360px width collapses to single column.

- [ ] **Step 9: Commit**

```bash
git add web/view_config.js web/router.js web/app.js web/index.html web/i18n.js web/styles.css tests/web_router.test.mjs tests/web_view_config.test.mjs tests/web_shell.test.mjs
git commit -m "feat: add Season Story scrollytelling view"
```

---

### Task 7: `web/wrapped.js` card builders

**Files:**
- Create: `web/wrapped.js`
- Test: `tests/web_wrapped.test.mjs`

**Interfaces:**
- Consumes: raw CSV row dicts.
- Produces:
  - `wrappedCards({ seasonId, awards, champions, highlights, videos }) -> card[]` with `card = { key, icon, name, personId, value, detail, sourceUrls, computed }` where `key ∈ champion|upset|mvp|kill_leader|top_video|closest|spoon` (cards with no data are omitted; `computed` true for award-derived cards);
  - `careerWrappedCards({ personRow, awards, champions }) -> card[]` with `key ∈ titles|matches|kills|elo|awards|spoons`.
  - Task 8 renders these; Task 9's Python mirrors `wrappedCards` semantics.

- [ ] **Step 1: Write the failing tests**

Create `tests/web_wrapped.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { careerWrappedCards, wrappedCards } from "../web/wrapped.js";

const AWARDS = [
  { award_key: "mvp", scope: "season", season_id: "season_004", person_id: "person_a", person_name: "Alice", value: "88.1", source_urls: "https://example.com/mvp" },
  { award_key: "kill_leader", scope: "season", season_id: "season_004", person_id: "person_b", person_name: "Bob", value: "61", source_urls: "https://example.com/kills" },
  { award_key: "upset_of_season", scope: "season", season_id: "season_004", person_id: "person_c", person_name: "Carol", value: "0.12", source_urls: "https://example.com/upset" },
  { award_key: "holzloeffel", scope: "season", season_id: "season_004", person_id: "person_d", person_name: "Dave", value: "14", source_urls: "https://example.com/spoon" },
  { award_key: "mvp", scope: "season", season_id: "season_005", person_id: "person_x", person_name: "Xavier", value: "90", source_urls: "https://example.com/other" },
];

const CHAMPIONS = [
  { season_id: "season_004", champion_name: "Alice", champion_person_id: "person_a", champion_team: "Team A", source_urls: "https://example.com/champ" },
];

const HIGHLIGHTS = [
  { season_id: "season_004", match_id: "m1", player_a: "Alice", player_b: "Bob", score: "6 - 5", close_match: "1", highlight_score: "70", video_urls: "https://youtube.com/watch?v=a", source_urls: "https://example.com/h1" },
  { season_id: "season_004", match_id: "m2", player_a: "Carol", player_b: "Dave", score: "6 - 0", close_match: "0", highlight_score: "90", video_urls: "", source_urls: "https://example.com/h2" },
];

const VIDEOS = [
  { video_id: "a", title: "Big Final", channel_title: "Present", detected_season_id: "season_004", view_count: "50000", video_url: "https://youtube.com/watch?v=a", source_urls: "https://example.com/v" },
  { video_id: "b", title: "Other Season", channel_title: "Raizor", detected_season_id: "season_005", view_count: "99999", video_url: "https://youtube.com/watch?v=b", source_urls: "https://example.com/v2" },
];

test("season cards cover all data-backed keys in deck order", () => {
  const cards = wrappedCards({ seasonId: "season_004", awards: AWARDS, champions: CHAMPIONS, highlights: HIGHLIGHTS, videos: VIDEOS });
  assert.deepEqual(cards.map((card) => card.key), ["champion", "upset", "mvp", "kill_leader", "top_video", "closest", "spoon"]);
  const champion = cards[0];
  assert.equal(champion.name, "Alice");
  assert.equal(champion.computed, false);
  const mvp = cards.find((card) => card.key === "mvp");
  assert.equal(mvp.computed, true);
  assert.equal(mvp.personId, "person_a");
});

test("top video only counts videos of the season", () => {
  const card = wrappedCards({ seasonId: "season_004", awards: [], champions: [], highlights: [], videos: VIDEOS }).find(
    (entry) => entry.key === "top_video",
  );
  assert.equal(card.name, "Big Final");
  assert.equal(card.value, 50000);
});

test("closest match prefers close_match rows by highlight score", () => {
  const card = wrappedCards({ seasonId: "season_004", awards: [], champions: [], highlights: HIGHLIGHTS, videos: [] }).find(
    (entry) => entry.key === "closest",
  );
  assert.equal(card.detail, "6 - 5");
});

test("cards without data are omitted", () => {
  const cards = wrappedCards({ seasonId: "season_009", awards: AWARDS, champions: CHAMPIONS, highlights: HIGHLIGHTS, videos: VIDEOS });
  assert.deepEqual(cards, []);
});

test("career cards read person_all_time and count awards", () => {
  const personRow = { person_id: "person_a", person_name: "Alice", seasons: "5", seasons_won: "2", title_seasons: "S4, S6", matches: "120", wins: "80", losses: "38", draws: "2", win_pct: "66.7", elo: "1642", kills: "400" };
  const cards = careerWrappedCards({ personRow, awards: AWARDS, champions: CHAMPIONS });
  assert.deepEqual(cards.map((card) => card.key), ["titles", "matches", "kills", "elo", "awards"]);
  const titles = cards[0];
  assert.equal(titles.value, 2);
  assert.equal(titles.detail, "S4, S6");
  const awardsCard = cards.find((card) => card.key === "awards");
  assert.equal(awardsCard.value, 1); // one season award for person_a
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_wrapped.test.mjs`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `web/wrapped.js`**

```js
// Pure card building for GPL Wrapped. Award-derived cards are computed, not
// official — renderers must show the computed label; champion cards come from
// sourced champions.csv rows. No DOM access; node-tested.

const CARD_ORDER = ["champion", "upset", "mvp", "kill_leader", "top_video", "closest", "spoon"];

const CARD_ICONS = {
  champion: "🏆",
  upset: "⚡",
  mvp: "🌟",
  kill_leader: "🎯",
  top_video: "📺",
  closest: "🔥",
  spoon: "🥄",
  titles: "🏆",
  matches: "⚔️",
  kills: "🎯",
  elo: "📈",
  awards: "🎖️",
  spoons: "🥄",
};

function seasonAward(awards, seasonId, key) {
  return (awards ?? []).find((row) => row.scope === "season" && row.season_id === seasonId && row.award_key === key);
}

function awardCard(awards, seasonId, awardKey, cardKey) {
  const row = seasonAward(awards, seasonId, awardKey);
  if (!row) return null;
  return {
    key: cardKey,
    icon: CARD_ICONS[cardKey],
    name: row.person_name,
    personId: row.person_id,
    value: Number.parseFloat(row.value),
    detail: "",
    sourceUrls: row.source_urls ?? "",
    computed: true,
  };
}

export function wrappedCards({ seasonId, awards = [], champions = [], highlights = [], videos = [] } = {}) {
  const cards = [];

  const championRow = champions.find((row) => row.season_id === seasonId);
  if (championRow) {
    cards.push({
      key: "champion",
      icon: CARD_ICONS.champion,
      name: championRow.champion_name,
      personId: championRow.champion_person_id,
      value: null,
      detail: championRow.champion_team ?? "",
      sourceUrls: championRow.source_urls ?? "",
      computed: false,
    });
  }

  const byKey = {
    upset: awardCard(awards, seasonId, "upset_of_season", "upset"),
    mvp: awardCard(awards, seasonId, "mvp", "mvp"),
    kill_leader: awardCard(awards, seasonId, "kill_leader", "kill_leader"),
    spoon: awardCard(awards, seasonId, "holzloeffel", "spoon"),
  };

  const seasonVideos = videos
    .filter((row) => row.detected_season_id === seasonId)
    .map((row) => ({ row, views: Number.parseFloat(row.view_count) }))
    .filter((entry) => Number.isFinite(entry.views))
    .sort((a, b) => b.views - a.views);
  if (seasonVideos.length) {
    const top = seasonVideos[0];
    byKey.top_video = {
      key: "top_video",
      icon: CARD_ICONS.top_video,
      name: top.row.title,
      personId: "",
      value: top.views,
      detail: top.row.channel_title ?? "",
      videoUrl: top.row.video_url ?? "",
      sourceUrls: top.row.source_urls ?? "",
      computed: true,
    };
  }

  const close = highlights
    .filter((row) => row.season_id === seasonId && String(row.close_match) === "1")
    .map((row) => ({ row, score: Number.parseFloat(row.highlight_score) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);
  if (close.length) {
    const top = close[0].row;
    byKey.closest = {
      key: "closest",
      icon: CARD_ICONS.closest,
      name: `${top.player_a} vs ${top.player_b}`,
      personId: "",
      value: close[0].score,
      detail: top.score ?? "",
      videoUrl: String(top.video_urls ?? "").split(";")[0] ?? "",
      sourceUrls: top.source_urls ?? "",
      computed: true,
    };
  }

  for (const key of CARD_ORDER) {
    if (key === "champion") continue;
    if (byKey[key]) cards.push(byKey[key]);
  }
  return cards;
}

export function careerWrappedCards({ personRow, awards = [], champions = [] } = {}) {
  if (!personRow) return [];
  const cards = [];
  const number = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const titles = number(personRow.seasons_won);
  if (titles > 0) {
    cards.push({ key: "titles", icon: CARD_ICONS.titles, name: personRow.person_name, personId: personRow.person_id, value: titles, detail: personRow.title_seasons ?? "", sourceUrls: personRow.source_urls ?? "", computed: false });
  }
  if (number(personRow.matches) > 0) {
    cards.push({ key: "matches", icon: CARD_ICONS.matches, name: personRow.person_name, personId: personRow.person_id, value: number(personRow.matches), detail: `${personRow.wins}-${personRow.losses}-${personRow.draws} · ${personRow.win_pct}%`, sourceUrls: personRow.source_urls ?? "", computed: true });
  }
  if (number(personRow.kills) > 0) {
    cards.push({ key: "kills", icon: CARD_ICONS.kills, name: personRow.person_name, personId: personRow.person_id, value: number(personRow.kills), detail: "", sourceUrls: personRow.source_urls ?? "", computed: true });
  }
  if (number(personRow.elo) > 0) {
    cards.push({ key: "elo", icon: CARD_ICONS.elo, name: personRow.person_name, personId: personRow.person_id, value: number(personRow.elo), detail: "", sourceUrls: personRow.source_urls ?? "", computed: true });
  }
  const seasonAwards = awards.filter((row) => row.scope === "season" && row.person_id === personRow.person_id && row.award_key !== "holzloeffel");
  if (seasonAwards.length) {
    cards.push({ key: "awards", icon: CARD_ICONS.awards, name: personRow.person_name, personId: personRow.person_id, value: seasonAwards.length, detail: [...new Set(seasonAwards.map((row) => row.award_key))].join(", "), sourceUrls: seasonAwards[0].source_urls ?? "", computed: true });
  }
  const spoons = awards.filter((row) => row.scope === "season" && row.person_id === personRow.person_id && row.award_key === "holzloeffel");
  if (spoons.length) {
    cards.push({ key: "spoons", icon: CARD_ICONS.spoons, name: personRow.person_name, personId: personRow.person_id, value: spoons.length, detail: "", sourceUrls: spoons[0].source_urls ?? "", computed: true });
  }
  return cards;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_wrapped.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add web/wrapped.js tests/web_wrapped.test.mjs
git commit -m "feat: add wrapped card builders"
```

---

### Task 8: GPL Wrapped view (deck UI, routes already exist)

**Files:**
- Modify: `web/app.js` (replace the `renderSeasonWrapped` stub)
- Modify: `web/index.html` (season-wrapped section)
- Modify: `web/i18n.js` (`wrapped.*`, `sections.seasonWrapped.*` de+en)
- Modify: `web/styles.css`
- Test: `tests/web_shell.test.mjs`

**Interfaces:**
- Consumes: `wrappedCards`, `careerWrappedCards` (Task 7); routes/`state.wrappedFocus` (Task 6); `ROSTER_BACKGROUND_BY_SEASON` (app.js ~line 199); `careerWrappedRouteHash` for the person-details entry.
- Produces: full Wrapped deck UI; `state.wrapped = { index: 0 }`; manifest download wiring point for Task 9 (`state.wrappedManifest`).

- [ ] **Step 1: Section markup**

```html
      <section class="view" id="season-wrapped" hidden>
        <div class="section-head">
          <h2 data-i18n="sections.seasonWrapped.title">GPL Wrapped</h2>
          <p data-i18n="sections.seasonWrapped.description"></p>
        </div>
        <p class="section-note" id="wrapped-note"></p>
        <div class="wrapped-deck">
          <button type="button" class="wrapped-nav" id="wrapped-prev" aria-label="previous">‹</button>
          <div id="wrapped-card"></div>
          <button type="button" class="wrapped-nav" id="wrapped-next" aria-label="next">›</button>
        </div>
        <div class="wrapped-dots" id="wrapped-dots"></div>
      </section>
```

- [ ] **Step 2: i18n**

de:

```js
    wrapped: {
      computedNote: "Berechnet, nicht offiziell.",
      championTitle: "Champion",
      upsetTitle: "Upset der Saison",
      mvpTitle: "MVP",
      killLeaderTitle: "Kill-Leader",
      topVideoTitle: "Meistgesehenes Video",
      closestTitle: "Engstes Match",
      spoonTitle: "Holzlöffel",
      titlesTitle: "Titel",
      matchesTitle: "Karriere-Matches",
      killsTitle: "Karriere-Kills",
      eloTitle: "Elo",
      awardsTitle: "Auszeichnungen",
      spoonsTitle: "Holzlöffel",
      views: "{count} Aufrufe",
      download: "Als Bild speichern",
      empty: "Keine Wrapped-Daten für diese Auswahl.",
      seasonHeading: "GPL Wrapped · {season}",
      careerHeading: "Karriere-Wrapped · {name}",
      counter: "{current} / {total}",
    },
```

en mirror with the same keys. Card title lookup: `t(state.language, "wrapped." + CARD_TITLE_KEYS[card.key])` with

```js
const CARD_TITLE_KEYS = { champion: "championTitle", upset: "upsetTitle", mvp: "mvpTitle", kill_leader: "killLeaderTitle", top_video: "topVideoTitle", closest: "closestTitle", spoon: "spoonTitle", titles: "titlesTitle", matches: "matchesTitle", kills: "killsTitle", elo: "eloTitle", awards: "awardsTitle", spoons: "spoonsTitle" };
```

- [ ] **Step 3: Renderer**

```js
function renderSeasonWrapped() {
  const note = document.querySelector("#wrapped-note");
  const cardHost = document.querySelector("#wrapped-card");
  const dots = document.querySelector("#wrapped-dots");
  const personKey = state.wrappedFocus?.personKey ?? null;

  let cards = [];
  let heading = "";
  if (personKey) {
    const personRow = (state.data.personAllTime ?? []).find((row) => row.person_id === personKey || normalizedKey(row.person_name) === normalizedKey(personKey));
    cards = careerWrappedCards({ personRow, awards: state.data.awards ?? [], champions: state.data.champions ?? [] });
    heading = formatMessage(t(state.language, "wrapped.careerHeading"), { name: personRow?.person_name ?? personKey });
  } else if (state.season !== "all") {
    cards = wrappedCards({ seasonId: state.season, awards: state.data.awards ?? [], champions: state.data.champions ?? [], highlights: state.data.matchHighlights ?? [], videos: state.data.videos ?? [] });
    heading = formatMessage(t(state.language, "wrapped.seasonHeading"), { season: seasonDisplay(state.season) });
  }

  if (!cards.length) {
    note.textContent = t(state.language, "wrapped.empty");
    cardHost.innerHTML = "";
    dots.innerHTML = "";
    return;
  }
  note.textContent = heading;
  if (state.wrapped.index >= cards.length) state.wrapped.index = 0;

  const show = (index) => {
    state.wrapped.index = (index + cards.length) % cards.length;
    const card = cards[state.wrapped.index];
    cardHost.innerHTML = wrappedCardHtml(card, personKey);
    dots.innerHTML = cards
      .map((_, dot) => `<button type="button" class="wrapped-dot${dot === state.wrapped.index ? " is-active" : ""}" data-index="${dot}"></button>`)
      .join("");
    dots.querySelectorAll(".wrapped-dot").forEach((el) => {
      el.onclick = () => show(Number(el.dataset.index));
    });
  };
  document.querySelector("#wrapped-prev").onclick = () => show(state.wrapped.index - 1);
  document.querySelector("#wrapped-next").onclick = () => show(state.wrapped.index + 1);
  show(state.wrapped.index);
}
```

`wrappedCardHtml(card, personKey)`:

```js
function wrappedCardHtml(card, personKey) {
  const background = !personKey ? ROSTER_BACKGROUND_BY_SEASON[state.season] : null;
  const style = background ? ` style="background-image: url('${escapeAttr(background)}')"` : "";
  const title = t(state.language, `wrapped.${CARD_TITLE_KEYS[card.key]}`);
  const valueLine =
    card.key === "top_video"
      ? formatMessage(t(state.language, "wrapped.views"), { count: displayNumber(card.value) })
      : card.value !== null && card.value !== undefined && card.value !== ""
        ? displayNumber(card.value)
        : "";
  return `
    <article class="wrapped-card${background ? " has-art" : ""}"${style}>
      <div class="wrapped-card-scrim">
        <span class="wrapped-card-icon">${card.icon}</span>
        <h3>${escapeHtml(title)}</h3>
        <p class="wrapped-card-name">${card.personId ? personLink(canonicalPersonRouteKey(card.personId), card.name) : escapeHtml(card.name)}</p>
        ${valueLine ? `<p class="wrapped-card-value">${escapeHtml(String(valueLine))}</p>` : ""}
        ${card.detail ? `<p class="wrapped-card-detail">${escapeHtml(card.detail)}</p>` : ""}
        ${card.videoUrl ? `<p><a class="link-button" href="${escapeAttr(card.videoUrl)}" target="_blank" rel="noopener">▶</a></p>` : ""}
        ${card.computed ? `<p class="wrapped-card-note">${escapeHtml(t(state.language, "wrapped.computedNote"))}</p>` : ""}
        ${card.sourceUrls ? `<p class="wrapped-card-sources">${sourceLinks(card.sourceUrls)}</p>` : ""}
        <span class="wrapped-download-slot" data-card="${escapeAttr(card.key)}"></span>
      </div>
    </article>`;
}
```

(Adapt helper names — `displayNumber`, `canonicalPersonRouteKey`, `sourceLinks` — to what app.js actually exports; grep before use. The `wrapped-download-slot` span is filled by Task 9.)

Entry point on person-details: in the trophy-shelf block of `renderPersonDetails`, append a link `careerWrappedRouteHash(<current person key>)` labeled "Wrapped". Keyboard: add an `onkeydown` on the section for ArrowLeft/ArrowRight calling the prev/next buttons (wire inside `renderSeasonWrapped`).

- [ ] **Step 4: CSS**

```css
.wrapped-deck {
  align-items: center;
  display: grid;
  gap: 16px;
  grid-template-columns: auto minmax(0, 420px) auto;
  justify-content: center;
}

.wrapped-card {
  aspect-ratio: 1 / 1;
  background: linear-gradient(160deg, var(--viz-1), var(--viz-5));
  background-size: cover;
  background-position: center;
  border-radius: 18px;
  overflow: hidden;
}

.wrapped-card-scrim {
  background: rgba(10, 12, 20, 0.55);
  color: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.wrapped-card-scrim a { color: inherit; }
.wrapped-card-icon { font-size: 3rem; }
.wrapped-card-name { font-size: 1.5rem; font-weight: 700; }
.wrapped-card-value { font-size: 2rem; font-weight: 700; }
.wrapped-card-note { font-size: 0.75rem; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.05em; }
.wrapped-nav { background: var(--surface); border: 1px solid var(--border); border-radius: 50%; cursor: pointer; font-size: 1.4rem; height: 44px; width: 44px; }
.wrapped-dots { display: flex; gap: 8px; justify-content: center; margin-top: 14px; }
.wrapped-dot { background: var(--border); border: none; border-radius: 50%; cursor: pointer; height: 10px; width: 10px; }
.wrapped-dot.is-active { background: var(--accent); }
```

(Use the theme's actual accent variable name — grep `--accent` in styles.css and substitute what exists.)

- [ ] **Step 5: Tests + browser check**

Update `tests/web_shell.test.mjs` for the `season-wrapped` section. Run `node --test tests/*.mjs` — all pass. Browser: `#/wrapped/season_004` shows deck with roster art background, prev/next/dots/arrow keys cycle, champion card first, computed labels present, sources linked; `#/wrapped/person/person_bene` shows career cards; Season Story finale links here; season-detail buttons work; EN + dark fine.

- [ ] **Step 6: Commit**

```bash
git add web/app.js web/index.html web/i18n.js web/styles.css tests/web_shell.test.mjs
git commit -m "feat: add GPL Wrapped card deck view"
```

---

### Task 9: Wrapped PNG export (`wrapped_cards.py` + CLI + manifest + download buttons)

**Files:**
- Create: `src/gpl_history/wrapped_cards.py`
- Modify: `src/gpl_history/cli.py`, `pyproject.toml`
- Modify: `web/app.js` (manifest fetch + download slots)
- Test: `tests/test_wrapped_cards.py`
- Create (generated): `web/assets/wrapped/*.png`, `web/assets/wrapped/manifest.json`

**Interfaces:**
- Consumes: `_read_csv` from aggregates; card semantics mirroring `wrappedCards` (Task 7).
- Produces: `wrapped_card_texts(awards, champions, highlights, videos) -> list[dict]` with keys `season_id, card_key, title, name, value_line, detail`; `render_wrapped_cards(data_dir: Path, web_dir: Path) -> int` (cards written); CLI `gpl-history wrapped-cards --data-dir data --web-dir web`; manifest schema `{"cards": [{"season_id": ..., "card_key": ..., "file": "season_004-champion.png"}]}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_wrapped_cards.py`:

```python
import json

import pytest

from gpl_history.wrapped_cards import wrapped_card_texts

AWARDS = [
    {"award_key": "mvp", "scope": "season", "season_id": "season_004", "person_id": "person_a", "person_name": "Alice", "value": "88.1", "source_urls": "u"},
    {"award_key": "holzloeffel", "scope": "season", "season_id": "season_004", "person_id": "person_d", "person_name": "Dave", "value": "14", "source_urls": "u"},
]
CHAMPIONS = [{"season_id": "season_004", "champion_name": "Alice", "champion_person_id": "person_a", "champion_team": "Team A", "source_urls": "u"}]
HIGHLIGHTS = [{"season_id": "season_004", "match_id": "m1", "player_a": "Alice", "player_b": "Bob", "score": "6 - 5", "close_match": "1", "highlight_score": "70", "video_urls": "", "source_urls": "u"}]
VIDEOS = [{"video_id": "a", "title": "Big Final", "channel_title": "Present", "detected_season_id": "season_004", "view_count": "50000", "video_url": "", "source_urls": "u"}]


def test_card_texts_mirror_frontend_semantics():
    cards = wrapped_card_texts(AWARDS, CHAMPIONS, HIGHLIGHTS, VIDEOS)
    keys = [(card["season_id"], card["card_key"]) for card in cards]
    assert ("season_004", "champion") in keys
    assert ("season_004", "mvp") in keys
    assert ("season_004", "top_video") in keys
    assert ("season_004", "closest") in keys
    assert ("season_004", "spoon") in keys
    champion = next(card for card in cards if card["card_key"] == "champion")
    assert champion["name"] == "Alice"
    assert champion["title"] == "Champion"


def test_seasons_without_data_get_no_cards():
    cards = wrapped_card_texts([], [], [], [])
    assert cards == []


def test_render_writes_pngs_and_manifest(tmp_path):
    pytest.importorskip("PIL")
    from gpl_history.wrapped_cards import render_wrapped_cards

    normalized = tmp_path / "data" / "normalized"
    normalized.mkdir(parents=True)
    import csv

    def write(name, fieldnames, rows):
        with open(normalized / name, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    write("awards.csv", list(AWARDS[0]), AWARDS)
    write("champions.csv", list(CHAMPIONS[0]), CHAMPIONS)
    write("match_highlights.csv", list(HIGHLIGHTS[0]), HIGHLIGHTS)
    write("video_archive.csv", list(VIDEOS[0]), VIDEOS)

    web_dir = tmp_path / "web"
    count = render_wrapped_cards(tmp_path / "data", web_dir)
    assert count >= 5
    manifest = json.loads((web_dir / "assets" / "wrapped" / "manifest.json").read_text(encoding="utf-8"))
    assert len(manifest["cards"]) == count
    for card in manifest["cards"]:
        assert (web_dir / "assets" / "wrapped" / card["file"]).exists()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_wrapped_cards.py -q`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/gpl_history/wrapped_cards.py`**

```python
"""Shareable GPL Wrapped PNG cards (Pillow optional extra ``[wrapped]``).

Card semantics mirror web/wrapped.js: champion (sourced), upset/mvp/
kill-leader/spoon awards (computed), most-watched video, closest match.
German-only in v1; PNG bytes are not drift-checked because Pillow output is
not stable across versions. Backgrounds reuse the season roster art the web
app uses (web/assets/roster-backgrounds/) with a dark scrim.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .aggregates import _read_csv

CARD_SIZE = 1080

_CARD_TITLES = {
    "champion": "Champion",
    "upset": "Upset der Saison",
    "mvp": "MVP",
    "kill_leader": "Kill-Leader",
    "top_video": "Meistgesehenes Video",
    "closest": "Engstes Match",
    "spoon": "Holzlöffel",
}

_ROSTER_BACKGROUNDS = {
    "season_003": "gpl-s3-background.png",
    "season_004": "gpl-s4-background.png",
    "season_005": "gpl-s5-background.png",
    "season_007": "gpl-s7-background.png",
    "season_008": "gpl-s8-background.png",
    "season_009": "gpl-s9-background-pink-blau.png",
    "season_010": "gpl-s10-background.png",
}

_COMPUTED_NOTE = "Berechnet, nicht offiziell · GPL-Archiv"
_SOURCED_NOTE = "GPL-Archiv"


def _season_number(season_id: str) -> str:
    digits = "".join(char for char in season_id if char.isdigit())
    return f"Saison {int(digits)}" if digits else season_id


def _award_text(awards: list[dict[str, str]], season_id: str, award_key: str, card_key: str) -> dict[str, Any] | None:
    row = next(
        (entry for entry in awards if entry.get("scope") == "season" and entry.get("season_id") == season_id and entry.get("award_key") == award_key),
        None,
    )
    if not row:
        return None
    return {
        "season_id": season_id,
        "card_key": card_key,
        "title": _CARD_TITLES[card_key],
        "name": row.get("person_name") or "",
        "value_line": row.get("value") or "",
        "detail": "",
        "computed": True,
    }


def wrapped_card_texts(
    awards: list[dict[str, str]],
    champions: list[dict[str, str]],
    highlights: list[dict[str, str]],
    videos: list[dict[str, str]],
) -> list[dict[str, Any]]:
    season_ids = sorted(
        {row.get("season_id") or "" for row in champions}
        | {row.get("season_id") or "" for row in awards if row.get("scope") == "season"}
    )
    cards: list[dict[str, Any]] = []
    for season_id in season_ids:
        if not season_id:
            continue
        champion = next((row for row in champions if row.get("season_id") == season_id), None)
        if champion:
            cards.append(
                {
                    "season_id": season_id,
                    "card_key": "champion",
                    "title": _CARD_TITLES["champion"],
                    "name": champion.get("champion_name") or "",
                    "value_line": champion.get("champion_team") or "",
                    "detail": _season_number(season_id),
                    "computed": False,
                }
            )
        for award_key, card_key in (("upset_of_season", "upset"), ("mvp", "mvp"), ("kill_leader", "kill_leader")):
            card = _award_text(awards, season_id, award_key, card_key)
            if card:
                cards.append(card)

        season_videos = [
            (float(row.get("view_count") or 0), row)
            for row in videos
            if row.get("detected_season_id") == season_id and (row.get("view_count") or "").strip()
        ]
        if season_videos:
            views, top = max(season_videos, key=lambda entry: entry[0])
            cards.append(
                {
                    "season_id": season_id,
                    "card_key": "top_video",
                    "title": _CARD_TITLES["top_video"],
                    "name": top.get("title") or "",
                    "value_line": f"{int(views):,} Aufrufe".replace(",", "."),
                    "detail": top.get("channel_title") or "",
                    "computed": True,
                }
            )

        close = [
            (float(row.get("highlight_score") or 0), row)
            for row in highlights
            if row.get("season_id") == season_id and str(row.get("close_match")) == "1"
        ]
        if close:
            _, top = max(close, key=lambda entry: entry[0])
            cards.append(
                {
                    "season_id": season_id,
                    "card_key": "closest",
                    "title": _CARD_TITLES["closest"],
                    "name": f"{top.get('player_a')} vs {top.get('player_b')}",
                    "value_line": top.get("score") or "",
                    "detail": "",
                    "computed": True,
                }
            )

        spoon = _award_text(awards, season_id, "holzloeffel", "spoon")
        if spoon:
            cards.append(spoon)
    return cards


def _load_font(size: int):
    from PIL import ImageFont

    for name in ("segoeuib.ttf", "segoeui.ttf", "arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _wrap_text(text: str, limit: int = 24) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > limit and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:3]


def render_wrapped_cards(data_dir: Path, web_dir: Path) -> int:
    try:
        from PIL import Image, ImageDraw
    except ImportError as error:  # pragma: no cover - exercised only without Pillow
        raise SystemExit("Pillow is required: pip install .[wrapped]") from error

    normalized = data_dir / "normalized"
    cards = wrapped_card_texts(
        _read_csv(normalized / "awards.csv"),
        _read_csv(normalized / "champions.csv"),
        _read_csv(normalized / "match_highlights.csv"),
        _read_csv(normalized / "video_archive.csv"),
    )
    out_dir = web_dir / "assets" / "wrapped"
    out_dir.mkdir(parents=True, exist_ok=True)
    backgrounds_dir = web_dir / "assets" / "roster-backgrounds"

    title_font = _load_font(64)
    name_font = _load_font(96)
    detail_font = _load_font(48)
    note_font = _load_font(30)

    manifest: list[dict[str, str]] = []
    for card in cards:
        image = Image.new("RGB", (CARD_SIZE, CARD_SIZE), (24, 28, 44))
        art_name = _ROSTER_BACKGROUNDS.get(card["season_id"])
        art_path = backgrounds_dir / art_name if art_name else None
        if art_path and art_path.exists():
            art = Image.open(art_path).convert("RGB")
            scale = max(CARD_SIZE / art.width, CARD_SIZE / art.height)
            art = art.resize((round(art.width * scale), round(art.height * scale)))
            image.paste(art, ((CARD_SIZE - art.width) // 2, (CARD_SIZE - art.height) // 2))
        scrim = Image.new("RGBA", (CARD_SIZE, CARD_SIZE), (10, 12, 20, 165))
        image = Image.alpha_composite(image.convert("RGBA"), scrim).convert("RGB")

        draw = ImageDraw.Draw(image)
        y = 260
        for text, font, gap in (
            (f"GPL Wrapped · {_season_number(card['season_id'])}", note_font, 70),
            (card["title"], title_font, 130),
        ):
            draw.text((CARD_SIZE / 2, y), text, font=font, fill=(255, 255, 255), anchor="mm")
            y += gap
        for line in _wrap_text(card["name"]):
            draw.text((CARD_SIZE / 2, y), line, font=name_font, fill=(255, 255, 255), anchor="mm")
            y += 110
        if card["value_line"]:
            draw.text((CARD_SIZE / 2, y + 20), str(card["value_line"]), font=detail_font, fill=(230, 230, 240), anchor="mm")
            y += 90
        if card["detail"]:
            draw.text((CARD_SIZE / 2, y + 20), str(card["detail"]), font=detail_font, fill=(200, 205, 220), anchor="mm")
        note = _COMPUTED_NOTE if card["computed"] else _SOURCED_NOTE
        draw.text((CARD_SIZE / 2, CARD_SIZE - 70), note, font=note_font, fill=(180, 185, 200), anchor="mm")

        file_name = f"{card['season_id']}-{card['card_key']}.png"
        image.save(out_dir / file_name)
        manifest.append({"season_id": card["season_id"], "card_key": card["card_key"], "file": file_name})

    (out_dir / "manifest.json").write_text(json.dumps({"cards": manifest}, indent=2) + "\n", encoding="utf-8")
    return len(manifest)
```

- [ ] **Step 4: CLI + pyproject**

`pyproject.toml` optional-dependencies:

```toml
wrapped = [
  "Pillow>=10.0.0",
]
```

`cli.py` subparser:

```python
    wrapped = subparsers.add_parser("wrapped-cards", help="Render shareable GPL Wrapped PNG cards (requires Pillow, pip install .[wrapped]).")
    wrapped.add_argument("--data-dir", default="data")
    wrapped.add_argument("--web-dir", default="web")
```

Dispatch:

```python
    if args.command == "wrapped-cards":
        from .wrapped_cards import render_wrapped_cards

        count = render_wrapped_cards(Path(args.data_dir), Path(args.web_dir))
        print(f"wrapped_cards: {count}")
        return 0
```

- [ ] **Step 5: Run tests**

Run: `python -m pytest tests/test_wrapped_cards.py -q` — expected PASS (PNG test auto-skips without Pillow; `pip install Pillow` locally so it actually runs once).
Then: `pip install Pillow` (if missing) and `python -m gpl_history.cli wrapped-cards --data-dir data --web-dir web` — expected `wrapped_cards: <N>` (~50-60 cards), files under `web/assets/wrapped/`.

- [ ] **Step 6: Frontend download buttons**

In `renderSeasonWrapped` (Task 8), before building cards, lazily fetch the manifest once:

```js
async function loadWrappedManifest() {
  if (state.wrappedManifest !== undefined) return state.wrappedManifest;
  try {
    const response = await fetch("assets/wrapped/manifest.json", { cache: "no-store" });
    state.wrappedManifest = response.ok ? await response.json() : null;
  } catch {
    state.wrappedManifest = null;
  }
  return state.wrappedManifest;
}
```

After `show(state.wrapped.index)`, call `loadWrappedManifest().then(...)` and, when a manifest entry matches `{season_id: state.season, card_key: card.key}` (season mode only), fill `.wrapped-download-slot` with:

```js
`<a class="link-button" href="assets/wrapped/${escapeAttr(entry.file)}" download>${escapeHtml(t(state.language, "wrapped.download"))}</a>`
```

Re-run the slot fill inside `show()` so navigation keeps buttons in sync (guard: manifest already cached after first fetch).

- [ ] **Step 7: README + browser check**

README regeneration flow:

```markdown
- `python -m gpl_history.cli wrapped-cards --data-dir data --web-dir web` — renders shareable GPL Wrapped PNGs into `web/assets/wrapped/` (optional dependency: `pip install .[wrapped]`). Not drift-checked; PNGs are German-only.
```

Browser: `#/wrapped/season_004` now shows "Als Bild speichern" buttons; the PNG downloads and looks sane (open one from disk). Career mode shows no download buttons.

- [ ] **Step 8: Commit**

```bash
git add src/gpl_history/wrapped_cards.py src/gpl_history/cli.py pyproject.toml tests/test_wrapped_cards.py web/app.js README.md web/assets/wrapped/
git commit -m "feat: add wrapped-cards PNG export with manifest-driven downloads"
```

---

### Task 10: Docs, known-limitations, full gates

**Files:**
- Modify: `docs/known-limitations.md`, `README.md` (feature list), `docs/superpowers/specs/2026-08-10-gpl-extensions-design.md` (progress note if the spec carries one)

- [ ] **Step 1: known-limitations**

Add a "Saison-Erzählungen (Phase 6)" section:

```markdown
## Saison-Erzählungen (Phase 6, computed/simulated)

- **Titelrennen ist eine Simulation.** `title_odds.csv` kommt aus einem Monte-Carlo (`gpl-history title-odds`, Standard 1000 Sims, Seed 42, pro Zeile dokumentiert): 3/1/0-Punkte (ohne Punktabzüge der Ligen — 11 von 215 offiziellen Tabellenzeilen weichen real ab), Sieg-Wahrscheinlichkeiten aus zum Spieltag eingefrorenen Karriere-Elo-Werten, simulierte Spiele kennen kein Unentschieden, Gleichstände werden pro Simulation zufällig sortiert. `p_first` heißt: Platz 1 der regulären Saison der Liga — bei S6/S10 also Conference-/Hauptrundensieg, nicht der Playoff-Titel; dafür gibt es `p_playoffs` (Playoff-Teilnehmerzahl aus den echten Playoff-Spielen abgeleitet). Nicht Teil von check-generated (Simulationskosten); Regenerieren nach Datenänderungen per README-Kommando.
- **Season Story erzählt aus Daten, nicht aus Prosa.** Alle Sätze sind i18n-Templates über matches/standings/match_highlights/title_odds; der "rechnerisch entschieden"-Beat ist als Simulation gebadged.
- **GPL Wrapped:** Auszeichnungs-Karten sind berechnet, nicht offiziell (awards.csv-Regeln). PNG-Export (`gpl-history wrapped-cards`, Pillow optional) ist deutsch, nicht drift-geprüft und nutzt die Roster-Hintergrundbilder; Karriere-Wrapped ist DOM-only ohne PNG.
```

- [ ] **Step 2: README feature list**

Add a bullet to the features/views list describing Titelrennen (in table-history), Season Story (`#/saison-story/<season>`), GPL Wrapped (`#/wrapped/<season>`, career `#/wrapped/person/<person>`).

- [ ] **Step 3: Full gates**

```powershell
python -m pytest -q          # expect ~217 passed
node --test tests/*.mjs      # expect all pass (~95+)
npm run validate
npm run check:generated      # "Generated artifacts are up to date."
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add docs/known-limitations.md README.md
git commit -m "docs: document Phase 6 simulation semantics and commands"
```

- [ ] **Step 5: Finish**

Use superpowers:finishing-a-development-branch (base branch: `main`).

---

## Self-review checklist (done at plan time)

- **Spec coverage:** title_odds.csv fields/command/seed semantics → Tasks 1-2; Titelrennen chart with dashed styling, Simulation badge, ≥95% annotation, p_playoffs charts for S6/S10 → Task 4; Season Story sticky standings + beats (intro, top highlight matches, decided moment, playoff beats, champion reveal), template narration, IntersectionObserver only → Tasks 5-6; Wrapped cards (champion, upset, MVP, most-watched, closest, Holzlöffel), roster-background art, PNG share via pipeline command + Pillow extra, career variant DOM-only → Tasks 7-9; README regeneration + known-limitations → Tasks 2, 9, 10. Deviations from spec, both deliberate: MVP-Pokémon card became the mvp/kill_leader award pair (no per-season Pokémon MVP exists in awards.csv), and `p_first` means regular-season rank 1 (no bracket simulation) — both documented in known-limitations.
- **Placeholder scan:** clean — every code step carries the actual code; renderers reference existing helpers with the instruction to verify exact names by grep before use (they exist: `divisionDisplay`, `sourceLinks`, `personLink`, `formatMessage`, `displayNumber`).
- **Type consistency:** `titleRaceSeries` output consumed by Task 4 matches Task 3's shape; `seasonStoryBeats` payloads consumed by `storyBeatHtml` match Task 5's fields; `wrappedCards` card shape matches `wrappedCardHtml`; manifest schema in Task 9 Step 3 matches the fetch in Step 6; route objects in router tests match `parseRouteHash` implementation.
