# GPL Extensions Phase 0+1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the navigation into the new group layout and ship the first two extensions — the Upset-Index view and the Karriere-Kurve + Elo-Kontoauszug on person detail pages — entirely client-side.

**Architecture:** Keep the existing static shell (hash router, `VIEW_GROUPS`, `VIEW_RENDERERS`, Tabulator, d3 global). Add two new pure modules (`web/elo_history.js`, `web/charts.js`); extend `eloRatings`'s `onMatch` hook backward-compatibly to expose pregame ratings. No pipeline changes in this phase.

**Tech Stack:** Static ES modules, Tabulator 6.4 (CDN), d3 v7 (CDN), Node 20 `node --test`, pytest (untouched but run as gate).

**Spec:** `docs/superpowers/specs/2026-08-10-gpl-extensions-design.md`

## Global Constraints

- View section ids MUST be `view-<viewName>` (app.js:713 `setActiveView` depends on it).
- Every new i18n key goes into BOTH `de` and `en` blocks of `web/i18n.js` (parity is tested).
- All chart colors come from `--viz-*` CSS custom properties; never hardcode colors (dark mode).
- Computed values are labeled: the Upset view and Elo chart carry a `sections.*Description` explaining Elo is computed from match chronology, not an official ranking.
- Do not import anything from `web/zeitreise.js` (module singleton); `web/timeline.js` and `web/stats.js` are the shared layers.
- Existing view ids and hash routes must keep working unchanged.

## File Structure

- Modify: `web/view_config.js` — new `duels`, `videos`, `records` groups
- Modify: `web/index.html` — primary tabs, subnav buttons, new sections
- Modify: `web/app.js` — renderer + dataset registration, person-details additions
- Modify: `web/stats.js` — `eloRatings` onMatch third argument
- Modify: `web/i18n.js` — navGroups/nav/sections/columns keys (de + en)
- Modify: `web/table_columns.js` — `UPSET_COLUMNS`, `ELO_LEDGER_COLUMNS`
- Modify: `web/styles.css` — upset cards, chart block, ledger badges
- Create: `web/elo_history.js` — chronology, upsets, career series, ledger rows (pure)
- Create: `web/charts.js` — d3 line/step chart + pure scale helpers
- Test: `tests/web_elo_history.test.mjs`, `tests/web_charts.test.mjs`; update `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`

---

### Task 1: Menu restructure — `duels` and `videos` groups

**Files:**
- Modify: `web/view_config.js:1-37`
- Modify: `web/index.html` (primary tabs ~:53-58, subnav buttons ~:60-82)
- Modify: `web/i18n.js` (`navGroups` de ~:60-65 and en mirror)
- Test: `tests/web_view_config.test.mjs`

**Interfaces:**
- Produces: `VIEW_GROUPS` containing groups `people` (all-time, team-rosters), `duels` (matchup), `pokemon`, `seasons` (battle-history, match-highlights, season-detail, table-history, match-plan, zeitreise), `videos` (video-archive, cinema), `data`. Later tasks add the `records` group.

- [ ] **Step 1: Update the view-config test to the new group layout**

In `tests/web_view_config.test.mjs`, change the expected group ids and memberships:

```js
assert.deepEqual(VIEW_GROUPS.map((g) => g.id), ["people", "duels", "pokemon", "seasons", "videos", "data"]);
const byId = new Map(VIEW_GROUPS.map((g) => [g.id, g]));
assert.deepEqual(byId.get("duels").views, ["matchup"]);
assert.equal(byId.get("duels").defaultView, "matchup");
assert.deepEqual(byId.get("videos").views, ["video-archive", "cinema"]);
assert.equal(byId.get("videos").defaultView, "video-archive");
assert.ok(!byId.get("people").views.includes("matchup"));
assert.ok(!byId.get("seasons").views.includes("video-archive"));
assert.ok(!byId.get("seasons").views.includes("cinema"));
// route stability: moved views still resolve
assert.equal(viewGroupForView("matchup"), "duels");
assert.equal(viewGroupForView("cinema"), "videos");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/web_view_config.test.mjs`
Expected: FAIL (group list still `["people","pokemon","seasons","data"]`).

- [ ] **Step 3: Edit `web/view_config.js`**

Insert after the `people` group (which loses `"matchup"` from `views`):

```js
{
  id: "duels",
  labelKey: "navGroups.duels",
  defaultView: "matchup",
  views: ["matchup"],
},
```

and after `seasons` (which loses `"video-archive"` and `"cinema"`):

```js
{
  id: "videos",
  labelKey: "navGroups.videos",
  defaultView: "video-archive",
  views: ["video-archive", "cinema"],
},
```

- [ ] **Step 4: Update `web/index.html`**

Add primary tab buttons in `.primary-tabs` after the people tab and after the seasons tab:

```html
<button class="tab primary-tab" data-view-group="duels" data-i18n="navGroups.duels">Duelle</button>
<button class="tab primary-tab" data-view-group="videos" data-i18n="navGroups.videos">Videos</button>
```

Change the existing subnav buttons for `matchup`, `video-archive`, `cinema` to `data-view-group="duels"` / `data-view-group="videos"` respectively (attribute change only; ids and `data-view` values stay).

- [ ] **Step 5: Add i18n keys (both languages)**

`navGroups.duels`: de `"Duelle"`, en `"Head-to-Head"`. `navGroups.videos`: de `"Videos"`, en `"Videos"`.

- [ ] **Step 6: Run the full JS gate**

Run: `node --test tests/web_view_config.test.mjs tests/web_shell.test.mjs tests/web_router.test.mjs tests/web_i18n.test.mjs`
Expected: PASS. If `web_shell.test.mjs` greps for tab markup, update its expectations in this step.

- [ ] **Step 7: Manual smoke + commit**

Serve (`npm run serve`), verify: 6 primary tabs, matchup under Duelle, archive/cinema under Videos, deep links `#/matchup`, `#/cinema` land in the right group, language toggle translates the new tabs.

```bash
git add web/view_config.js web/index.html web/i18n.js tests/web_view_config.test.mjs tests/web_shell.test.mjs
git commit -m "Restructure navigation into Duelle and Videos groups"
```

### Task 2: `web/elo_history.js` — per-match Elo chronology

**Files:**
- Modify: `web/stats.js:635-690` (onMatch third argument)
- Create: `web/elo_history.js`
- Test: `tests/web_elo_history.test.mjs`

**Interfaces:**
- Consumes: `eloRatings`, `compareMatchChronology`, `matchWeekOrder`, `normalizedStatsKey` from `web/stats.js`.
- Produces: `eloChronology(matches, normalizeKey?) -> { perMatch, perPerson, order, finalRows }` where
  - `perMatch: Map<match_id, {aKey, bKey, aName, bName, eloPreA, eloPreB, winProbA, eloAfterA, eloAfterB, deltaA, deltaB, seasonId, week, stage}>`
  - `perPerson: Map<personKey, {name, points: Array<{seq, matchId, seasonId, rating}>, peak: {rating, matchId}}>` (rating = value AFTER that match, unrounded)
  - `order: string[]` (match ids in chronological order), `finalRows` = untouched `eloRatings` return value.

- [ ] **Step 1: Write failing tests**

`tests/web_elo_history.test.mjs` (top-level asserts, `node:assert/strict`):

```js
import assert from "node:assert/strict";
import { eloChronology } from "../web/elo_history.js";

const fixture = [
  { season_id: "season_001", match_id: "m1", week: "1", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "Anna", data_status: "available" },
  { season_id: "season_001", match_id: "m2", week: "2", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "Anna", data_status: "available" },
  { season_id: "season_001", match_id: "m3", week: "3", stage: "Regular Season", player_a: "Ben", player_b: "Anna", winner: "Ben", data_status: "available" },
];
const chrono = eloChronology(fixture);

const m1 = chrono.perMatch.get("m1");
assert.equal(m1.eloPreA, 1500);
assert.equal(m1.winProbA, 0.5);
assert.equal(Math.round(m1.eloAfterA), 1516);

const m2 = chrono.perMatch.get("m2");
assert.equal(Math.round(m2.eloPreA), 1516);
assert.ok(Math.abs(m2.winProbA - 0.5459) < 0.001); // 1/(1+10^((1484-1516)/400))

assert.deepEqual(chrono.order, ["m1", "m2", "m3"]);
const anna = chrono.perPerson.get("anna");
assert.equal(anna.points.length, 3);
assert.equal(anna.peak.matchId, "m2"); // peaks after second win, dips after m3
// final ratings agree with eloRatings' rounded output
const annaFinal = chrono.finalRows.find((r) => r.key === "anna");
assert.equal(annaFinal.elo, String(Math.round(anna.points[2].rating)));
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/web_elo_history.test.mjs`
Expected: FAIL — `web/elo_history.js` does not exist.

- [ ] **Step 3: Extend the `onMatch` hook in `web/stats.js`**

Inside `eloRatings`, capture pregame values before mutating and pass a details object as a third argument (existing two-arg callers like `timeline.js:90` are unaffected):

```js
const leftBefore = left.rating;
const rightBefore = right.rating;
// ... existing update logic unchanged ...
if (onMatch) {
  onMatch(row, ratings, {
    leftKey: left.key, rightKey: right.key,
    leftBefore, rightBefore,
    leftExpected, // pregame win probability of player_a
    leftAfter: left.rating, rightAfter: right.rating,
  });
}
```

- [ ] **Step 4: Implement `web/elo_history.js`**

```js
import { eloRatings, normalizedStatsKey } from "./stats.js";

export function eloChronology(matches = [], normalizeKey = normalizedStatsKey) {
  const perMatch = new Map();
  const perPerson = new Map();
  const order = [];

  const track = (key, name, matchId, seasonId, rating) => {
    if (!perPerson.has(key)) perPerson.set(key, { name, points: [], peak: { rating: -Infinity, matchId: "" } });
    const person = perPerson.get(key);
    person.points.push({ seq: person.points.length, matchId, seasonId: seasonId || "", rating });
    if (rating > person.peak.rating) person.peak = { rating, matchId };
  };

  const finalRows = eloRatings(matches, normalizeKey, {
    onMatch: (row, ratings, d) => {
      if (!d) return;
      const matchId = String(row.match_id || "");
      order.push(matchId);
      perMatch.set(matchId, {
        aKey: d.leftKey, bKey: d.rightKey,
        aName: row.player_a || row.team_a || "", bName: row.player_b || row.team_b || "",
        eloPreA: d.leftBefore, eloPreB: d.rightBefore,
        winProbA: d.leftExpected,
        eloAfterA: d.leftAfter, eloAfterB: d.rightAfter,
        deltaA: d.leftAfter - d.leftBefore, deltaB: d.rightAfter - d.rightBefore,
        seasonId: row.season_id || "", week: row.week || "", stage: row.stage || "",
      });
      track(d.leftKey, row.player_a || row.team_a || "", matchId, row.season_id, d.leftAfter);
      track(d.rightKey, row.player_b || row.team_b || "", matchId, row.season_id, d.rightAfter);
    },
  });

  return { perMatch, perPerson, order, finalRows };
}
```

- [ ] **Step 5: Run tests**

Run: `node --test tests/web_elo_history.test.mjs tests/web_elo_consistency.test.mjs tests/web_timeline.test.mjs tests/web_stats.test.mjs`
Expected: PASS — including the untouched Elo parity and timeline suites (proves the hook change is backward-compatible).

- [ ] **Step 6: Commit**

```bash
git add web/stats.js web/elo_history.js tests/web_elo_history.test.mjs
git commit -m "Add per-match Elo chronology module with pregame win probabilities"
```

### Task 3: `web/charts.js` — themed d3 line/step charts

**Files:**
- Create: `web/charts.js`
- Modify: `web/styles.css` (`.chart-block`, `.chart-tooltip`, `.chart-band`, `.chart-marker` classes)
- Test: `tests/web_charts.test.mjs`

**Interfaces:**
- Produces:
  - pure: `paddedDomain(values, padRatio = 0.06) -> [min, max]`, `buildSeries(points, xAccessor, yAccessor) -> {points, xDomain, yDomain}`.
  - DOM (untested, needs `window.d3`): `lineChart(container, {series, bands, markers, xLabel, yLabel, formatX, formatY, onHover})` and `stepChart(container, config)` — both clear the container, draw an SVG sized to the container width, use `.viz-series-N` classes / `--viz-*` vars only, re-render via a returned `redraw()` used by resize + `data-theme` observers.

- [ ] **Step 1: Write failing tests for the pure helpers**

```js
import assert from "node:assert/strict";
import { paddedDomain, buildSeries } from "../web/charts.js";

assert.deepEqual(paddedDomain([1500, 1500]), [1499, 1501]); // degenerate domain gets ±1
const [lo, hi] = paddedDomain([1400, 1600]);
assert.ok(lo < 1400 && hi > 1600);

const s = buildSeries([{ seq: 0, rating: 1500 }, { seq: 1, rating: 1516 }], (p) => p.seq, (p) => p.rating);
assert.deepEqual(s.xDomain, [0, 1]);
assert.deepEqual(s.points.map((p) => p.y), [1500, 1516]);
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/web_charts.test.mjs` → FAIL (module missing).

- [ ] **Step 3: Implement `web/charts.js`**

Pure helpers exactly as tested; `lineChart`/`stepChart` build one SVG with `d3.scaleLinear`, an x/y axis, optional shaded `bands` (`[{fromX, toX, label}]` — stint/season bands), optional `markers` (`[{x, y, label, href}]` — championships/peak), a hover overlay calling `onHover(nearestPoint)` and a `.chart-tooltip` div. Guard `if (!window.d3) { container.textContent = fallbackText; return { redraw() {} }; }` (CDN-fallback rule).

- [ ] **Step 4: Run tests + syntax check** — `node --test tests/web_charts.test.mjs && node --check web/charts.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add web/charts.js web/styles.css tests/web_charts.test.mjs
git commit -m "Add themed d3 chart helpers for line and step charts"
```

### Task 4: Upset computation

**Files:**
- Modify: `web/elo_history.js`
- Test: `tests/web_elo_history.test.mjs`

**Interfaces:**
- Consumes: `eloChronology` output, raw `matches` rows, `match_highlights` rows.
- Produces: `upsetRows(matches, chronology, highlightRows = []) -> Array<row>` sorted by `upset_score` desc, each row: `{match_id, season_id, division, stage, week, winner_name, winner_key, loser_name, elo_pre_winner, elo_pre_loser, win_prob_winner, upset_score, score, video_url, views_z_score, source_urls}`. `upset_score = 1 - win_prob_winner`, numbers unrounded (render rounds).

- [ ] **Step 1: Write failing tests**

Append to `tests/web_elo_history.test.mjs`:

```js
import { upsetRows } from "../web/elo_history.js";
// build a favorite: Anna beats Ben in m1/m2 (weeks 1-2), then Ben wins m3 as underdog
const upsets = upsetRows(fixture, chrono);
assert.equal(upsets[0].match_id, "m3"); // the only underdog win ranks first
assert.ok(upsets[0].win_prob_winner < 0.5);
assert.equal(upsets[0].winner_name, "Ben");
// draws and special results are excluded
const withDraw = fixture.concat([{ season_id: "season_001", match_id: "m4", week: "4", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "", result_basis: "draw", data_status: "available" }]);
const chrono2 = eloChronology(withDraw);
assert.ok(!upsetRows(withDraw, chrono2).some((r) => r.match_id === "m4"));
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/web_elo_history.test.mjs` → FAIL (`upsetRows` not exported).

- [ ] **Step 3: Implement `upsetRows` in `web/elo_history.js`**

```js
export function upsetRows(matches = [], chronology, highlightRows = [], normalizeKey = normalizedStatsKey) {
  const zByMatch = new Map(highlightRows.map((row) => [String(row.match_id || ""), row.views_z_score_peak ?? ""]));
  const rows = [];
  for (const row of matches) {
    if (["forfeit", "unresolved", "draw"].includes(row.result_basis || "")) continue;
    const entry = chronology.perMatch.get(String(row.match_id || ""));
    const winnerKey = normalizeKey(row.winner);
    if (!entry || !winnerKey || (winnerKey !== entry.aKey && winnerKey !== entry.bKey)) continue;
    const winnerIsA = winnerKey === entry.aKey;
    const winProb = winnerIsA ? entry.winProbA : 1 - entry.winProbA;
    rows.push({
      match_id: String(row.match_id || ""), season_id: row.season_id || "", division: row.division || "",
      stage: row.stage || "", week: row.week || "",
      winner_name: winnerIsA ? entry.aName : entry.bName, winner_key: winnerKey,
      loser_name: winnerIsA ? entry.bName : entry.aName,
      elo_pre_winner: winnerIsA ? entry.eloPreA : entry.eloPreB,
      elo_pre_loser: winnerIsA ? entry.eloPreB : entry.eloPreA,
      win_prob_winner: winProb, upset_score: 1 - winProb,
      score: [row.score_a, row.score_b].filter((v) => v !== undefined && v !== "").join(":"),
      video_url: row.video_url || "", views_z_score: zByMatch.get(String(row.match_id || "")) ?? "",
      source_urls: row.source_urls || "",
    });
  }
  return rows.sort((a, b) => b.upset_score - a.upset_score || String(a.match_id).localeCompare(String(b.match_id)));
}
```

- [ ] **Step 4: Run tests** — `node --test tests/web_elo_history.test.mjs` → PASS.

- [ ] **Step 5: Commit** — `git add web/elo_history.js tests/web_elo_history.test.mjs && git commit -m "Add upset ranking computation"`

### Task 5: Upset-Index view (founds the Rekorde group)

**Files:**
- Modify: `web/view_config.js` (new `records` group before `data`), `web/index.html` (primary tab, subnav button, `<section id="view-upset-index">`), `web/app.js` (`VIEW_RENDERERS`, `VIEW_DATASETS`), `web/i18n.js`, `web/table_columns.js` (`UPSET_COLUMNS`), `web/styles.css` (`.upset-card` grid)
- Test: `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`

**Interfaces:**
- Consumes: `eloChronology`, `upsetRows` (Task 2/4); `renderTable`, `metricCard`, `personLink`, `sourceCell`, `highlightMediaPreview` from app.js.
- Produces: view id `upset-index` in group `records` (`defaultView: "upset-index"` until the Rekordbuch lands in Phase 2); `navGroups.records`, `nav.upsetIndex`, `sections.upsetIndexTitle/Description` i18n keys.

- [ ] **Step 1: Extend view-config test** — group list `["people","duels","pokemon","seasons","videos","records","data"]`, `byId.get("records").views` = `["upset-index"]`, default `upset-index`. Run → FAIL.
- [ ] **Step 2: Register the group + view** — view_config entry, index.html primary tab (`data-view-group="records"`, `data-i18n="navGroups.records"` → de "Rekorde", en "Records"), subnav button, section skeleton:

```html
<section id="view-upset-index" class="view">
  <div class="section-head">
    <h2 data-i18n="sections.upsetIndexTitle">Die größten Überraschungen</h2>
    <p data-i18n="sections.upsetIndexDescription">…</p>
  </div>
  <div id="upset-summary" class="summary-grid"></div>
  <div id="upset-cards" class="highlight-card-grid"></div>
  <div id="upset-table" class="table-wrap"></div>
</section>
```

- [ ] **Step 3: Implement `renderUpsetIndex` in app.js**

Register `"upset-index": renderUpsetIndex` in `VIEW_RENDERERS` and `"upset-index": ["matchHighlights", "matchVideos"]` in `VIEW_DATASETS`. The renderer: `const chrono = eloChronology(availableMatchRows()); const rows = upsetRows(availableMatchRows(), chrono, state.data.matchHighlights ?? [])`, then (a) 4 `metricCard`s (biggest upset probability, upsets under 25 %, most upset wins by one person, most upset losses), (b) top-10 `.upset-card`s with pregame Elos, "Elo gab X nur N %" line (i18n template), thumbnail via `highlightMediaPreview`, video link, (c) `renderTable("#upset-table", shapedRows, UPSET_COLUMNS, ["winner","loser","video","sources"])` with percentage columns rendered as `Math.round(v*100) + " %"`. Season/data-mode filters apply through the existing `availableMatchRows()` slice — chronology must be computed on the same slice it ranks.

- [ ] **Step 4: i18n + columns** — `UPSET_COLUMNS = ["season","week","division","winner","elo_pre_winner","loser","elo_pre_loser","win_prob_winner","score","views_z_score","video","sources"]` in table_columns.js with `columns.*` titles (de: "Sieger-Elo davor", "Siegchance", …; en mirrors). Description text states: computed from match chronology Elo, not an official statistic.
- [ ] **Step 5: Gate + smoke** — `node --test tests/*.mjs && node --check web/app.js web/elo_history.js` → PASS; serve and check the view with data-mode switches (all / ohne Liga 2 / Liga 2), language toggle, dark mode.
- [ ] **Step 6: Commit** — `git add -A web tests && git commit -m "Add Upset-Index view founding the Rekorde group"`

### Task 6: Karriere-Kurve on person-details

**Files:**
- Modify: `web/elo_history.js` (`personEloSeries`), `web/index.html` (chart block between `#person-story-summary` and the timeline section, ~:405), `web/app.js` (`renderPersonDetails` extension), `web/i18n.js`, `web/styles.css`
- Test: `tests/web_elo_history.test.mjs`

**Interfaces:**
- Consumes: `eloChronology`, `charts.lineChart`; `person_stints` + `champions` rows from `state.data`.
- Produces: `personEloSeries(personKey, chronology, stints, champions) -> {points: [{seq, matchId, seasonId, rating}], bands: [{fromSeq, toSeq, label}], markers: [{seq, rating, label}], peak: {seq, rating, matchId}}` — bands = one per (season, team) stint (label "S3 · Teamname"), markers = championships at the last match of the title season.

- [ ] **Step 1: Write failing test**

```js
import { personEloSeries } from "../web/elo_history.js";
const stints = [{ season_id: "season_001", person_id: "anna", person_name: "Anna", team_name: "Team A", division: "Liga 1" }];
const champs = [{ season_id: "season_001", champion_name: "Anna" }];
const series = personEloSeries("anna", chrono, stints, champs);
assert.equal(series.points.length, 3);
assert.equal(series.bands.length, 1);
assert.equal(series.bands[0].label.includes("Team A"), true);
assert.equal(series.markers.length, 1);
assert.equal(series.peak.matchId, "m2");
```

- [ ] **Step 2: Run to verify failure** — FAIL (`personEloSeries` not exported).
- [ ] **Step 3: Implement** — points from `perPerson.get(key)`; bands by grouping the person's points by `seasonId` and joining stints on `(season_id, person)` via `normalizeKey(person_name)`; markers where a `champions.csv` row matches the person (`normalizeKey(champion_name) === key`), placed at that season's last point. Run → PASS.
- [ ] **Step 4: Wire into person-details** — index.html block:

```html
<div id="person-elo-block" class="chart-block">
  <h3 data-i18n="sections.personEloTitle">Karriere-Kurve (Elo)</h3>
  <p class="chart-note" data-i18n="sections.personEloDescription">…</p>
  <div id="person-elo-chart"></div>
</div>
```

In `renderPersonDetails`: compute chronology once per render slice (memoize on `state`), call `lineChart` with the series, peak label (`t(state.language, "personDetails.peakLabel")` → "Karrierehoch {rating}"), `onHover` showing season/matchday/opponent/±Elo, hidden when the person has < 2 rated matches. Description notes Elo is computed, matches without recorded winner count 0.5.
- [ ] **Step 5: Gate + smoke** — `node --test tests/*.mjs`; serve, open `#/person/bene`, check chart, dark mode, data-basis switch, en/de. → PASS.
- [ ] **Step 6: Commit** — `git add -A web tests && git commit -m "Add Elo career curve to person details"`

### Task 7: Elo-Kontoauszug ledger

**Files:**
- Modify: `web/elo_history.js` (`eloLedgerRows`), `web/index.html` (new `<details class="detail-table-section">` after the timeline section with `#person-elo-ledger-table`), `web/app.js`, `web/table_columns.js` (`ELO_LEDGER_COLUMNS`), `web/i18n.js`, `web/styles.css` (`.elo-delta-positive/-negative`)
- Test: `tests/web_elo_history.test.mjs`

**Interfaces:**
- Consumes: `eloChronology`, `videoLinksForMatch` (app.js:4075), `personLink`.
- Produces: `eloLedgerRows(personKey, chronology, matches) -> Array<{match_id, season_id, week, stage, opponent_name, opponent_key, score, result, elo_delta, elo_after, video_url, source_urls}>` in chronological order; `elo_delta` signed unrounded number.

- [ ] **Step 1: Write failing test**

```js
import { eloLedgerRows } from "../web/elo_history.js";
const ledger = eloLedgerRows("anna", chrono, fixture);
assert.equal(ledger.length, 3);
assert.equal(ledger[0].opponent_name, "Ben");
assert.ok(ledger[0].elo_delta > 0 && ledger[2].elo_delta < 0);
assert.equal(Math.round(ledger[1].elo_after), 1531);
```

- [ ] **Step 2: Run to verify failure** — FAIL. 
- [ ] **Step 3: Implement** — walk `chronology.order`, pick entries where the person is `aKey`/`bKey`, join the source match row by id for score/result/video/source fields; result de-keys `win/loss/draw` resolved via i18n at render. Run → PASS.
- [ ] **Step 4: Wire the table** — `ELO_LEDGER_COLUMNS = ["season","week","opponent","score","result","elo_delta","elo_after","video","sources"]`; renderer shapes rows (delta rendered `+12` / `−9` with `.elo-delta-*` classes via html column), `renderTable("#person-elo-ledger-table", …)`; section collapsible like the other five person sections, hidden without focus (`setDetailSections`).
- [ ] **Step 5: Gate + smoke** — `node --test tests/*.mjs && node --check web/app.js`; serve and verify ledger totals visually match the curve. → PASS.
- [ ] **Step 6: Commit** — `git add -A web tests && git commit -m "Add per-match Elo ledger to person details"`

### Task 8: Verification, docs, release gate

**Files:**
- Modify: `README.md` (web app feature list line: upset index, career curve, ledger, new nav groups), `docs/known-limitations.md` (one paragraph: Elo-derived views are computed, forfeit wins count as the league counted them, winner-less rows as 0.5 — mirroring the existing Zeitreise notes)

- [ ] **Step 1: Docs** — update the two files; keep the Zeitreise section as the semantics reference and link to it.
- [ ] **Step 2: Full gate**

```powershell
python -m pytest -q
node --check web/app.js; node --check web/stats.js; node --check web/elo_history.js; node --check web/charts.js; node --check web/view_config.js; node --check web/i18n.js; node --check web/table_columns.js
node --test tests/*.mjs
npm run validate
npm run check:generated
git diff --check
```

Expected: all PASS (pipeline untouched; check-generated trivially clean).
- [ ] **Step 3: Commit** — `git add README.md docs/known-limitations.md && git commit -m "Document Phase 0+1 extensions"`

## Self-Review

- Spec coverage: Phase 0 (menu, elo_history, charts) = Tasks 1–3; Phase 1 (Upset-Index, Karriere-Kurve, Kontoauszug) = Tasks 4–7; docs/gate = Task 8. Later phases intentionally out of scope (own plans).
- Type consistency: `eloChronology` return shape used identically in Tasks 4, 6, 7; `onMatch(row, ratings, details)` matches Task 2's stats.js change; column-id lists match the i18n `columns.*` keys named beside them.
- Placeholders: section description texts are marked `…` only in HTML sketches; the i18n steps name the actual copy to write. No TBDs.
