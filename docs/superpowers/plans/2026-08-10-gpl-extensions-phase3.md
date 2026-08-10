# GPL Extensions Phase 3 (Duelle: Rivalitäten + Orakel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Phase 3 features of the extensions spec (`docs/superpowers/specs/2026-08-10-gpl-extensions-design.md`): a Rivalitäten index + rivalry detail route and the Orakel (six-degrees) view, both in the existing `duels` nav group.

**Architecture:** Pure computation lives in two new ES modules (`web/rivalries.js`, `web/oracle.js`) with node `--test` coverage; `web/app.js` only wires state, rendering, and routing. No pipeline change: rivalry pairs come from the existing `matchup_summary.csv` aggregate; meetings/Elo-gap come from the client-side Elo chronology (`web/elo_history.js`); the oracle BFS runs over `matches.csv` (core dataset, always loaded). A new hash route `#/rivalitaet/<aKey>__<bKey>` maps to the detail view `rivalry-detail`.

**Tech Stack:** Static ES modules, d3 v7 via `web/charts.js` (`lineChart`), Tabulator via `renderTable`, node:test + assert for JS tests.

## Global Constraints

- No build step, no new dependencies, no server; ES modules only.
- Bilingual: every user-visible string goes through `t(state.language, key)`; German is the source of truth in `web/i18n.js` `TRANSLATIONS.de`, English mirrors every key (parity is test-enforced by `tests/web_i18n.test.mjs`).
- Computed values are labeled computed: rivalry score and oracle chains get an explainer (`score-explainer` details block) stating the formula/semantics.
- Result semantics: `result_basis` `forfeit` and `unresolved` rows are **excluded** from oracle edges and connectedness (never played / unconfirmable); the rivalry meeting ledger is chronology-driven, so it inherits the Elo walk's semantics (forfeits rated as the league counted them, unresolved skipped).
- These views are career-scope over the full archive: the toolbar (Datenbasis/Saison/Liga/Suche) is hidden on `rivalries`, `rivalry-detail`, and `oracle` via the existing `is-cinema-hidden` mechanism (same decision as record-book/hall-of-fame, user-approved 2026-08-10).
- View ids never change; new views register in all 5 touch points: `web/view_config.js`, `web/index.html` (subnav button + `view-<id>` section), `web/app.js` (`VIEW_RENDERERS` + `VIEW_DATASETS`), `web/i18n.js` (de + en).
- Person links always canonicalize through `canonicalPersonRouteKey` / `personLink` (person_id form is canonical, e.g. `person_bene`, never `bene`).
- Verification gate at phase end: `python -m pytest -q` (207), `node --test tests/*.mjs` (all files), `npm run validate`, `npm run check:generated`, `git diff --check`.
- Work on branch `feature/gpl-extensions-phase3` off `main`.

## Verified data facts (checked 2026-08-10)

- `matchup_summary.csv` fields: `person_id, person_name, opponent_id, opponent_name, matches, wins, losses, draws, win_pct, source_urls` — **directed** (each pair appears twice).
- No `person_id` in `people.csv` contains `__`, so `__` is a safe pair separator.
- `matches.csv` has no dates; oracle hops and rivalry meetings are labeled by season/week only.
- `matches` and `personStints` are CORE_DATASETS (always loaded); `matchupSummary`, `matchHighlights`, `matchVideos` are lazy.

---

### Task 1: Route + view config for the three new views

**Files:**
- Modify: `web/router.js`
- Modify: `web/view_config.js`
- Test: `tests/web_router.test.mjs`, `tests/web_view_config.test.mjs`

**Interfaces:**
- Produces: `rivalryRouteHash(aKey, bKey)` → `"#/rivalitaet/<a>__<b>"` (URI-encoded keys); `parseRouteHash` returns `{ view: "rivalry-detail", personKey: null, rivalryKey: { aKey, bKey } }` for that hash and `{ view: "rivalries", personKey: null }` for a malformed pair segment; view ids `rivalries`, `oracle` (subnav) and `rivalry-detail` (detail) valid in the `duels` group.

- [ ] **Step 1: Write the failing tests** — append to `tests/web_router.test.mjs`:

```js
assert.deepEqual(parseRouteHash("#/rivalitaet/person_bene__person_pokgalaxy"), {
  view: "rivalry-detail",
  personKey: null,
  rivalryKey: { aKey: "person_bene", bKey: "person_pokgalaxy" },
});
assert.deepEqual(parseRouteHash("#/rivalitaet/broken"), { view: "rivalries", personKey: null });
assert.equal(rivalryRouteHash("person_bene", "person_pokgalaxy"), "#/rivalitaet/person_bene__person_pokgalaxy");
assert.equal(parseRouteHash(rivalryRouteHash("a b", "c d")).rivalryKey.aKey, "a b");
```

(add `rivalryRouteHash` to the import at the top). Append to `tests/web_view_config.test.mjs`, inside/alongside the existing group assertions:

```js
const duels = VIEW_GROUPS.find((group) => group.id === "duels");
assert.deepEqual(duels.views, ["matchup", "rivalries", "oracle"]);
assert.deepEqual(duels.detailViews, ["rivalry-detail"]);
assert.equal(viewGroupForView("rivalry-detail"), "duels");
assert.equal(isValidView("oracle"), true);
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/web_router.test.mjs tests/web_view_config.test.mjs`
Expected: FAIL (`rivalryRouteHash` not exported; duels views mismatch).

- [ ] **Step 3: Implement** — in `web/router.js` add before the `GROUP_IDS.has` check in `parseRouteHash`:

```js
if (parts[0] === "rivalitaet" && parts[1]) {
  const pair = parts[1].split("__");
  if (pair.length === 2 && pair[0] && pair[1]) {
    return { view: "rivalry-detail", personKey: null, rivalryKey: { aKey: pair[0], bKey: pair[1] } };
  }
  return { view: "rivalries", personKey: null };
}
```

and export:

```js
export function rivalryRouteHash(aKey, bKey) {
  return `#/rivalitaet/${encodeURIComponent(aKey)}__${encodeURIComponent(bKey)}`;
}
```

In `web/view_config.js` change the `duels` group to:

```js
{
  id: "duels",
  labelKey: "navGroups.duels",
  defaultView: "matchup",
  views: ["matchup", "rivalries", "oracle"],
  detailViews: ["rivalry-detail"],
},
```

- [ ] **Step 4: Run tests to verify pass** — `node --test tests/web_router.test.mjs tests/web_view_config.test.mjs` → PASS.
- [ ] **Step 5: Commit** — `git add web/router.js web/view_config.js tests/web_router.test.mjs tests/web_view_config.test.mjs && git commit -m "Add rivalry route and duels-group views for Phase 3"`

---

### Task 2: Shell skeleton — sections, i18n, renderer stubs, state, toolbar hiding

**Files:**
- Modify: `web/index.html` (duels subnav + 3 sections)
- Modify: `web/i18n.js` (de + en)
- Modify: `web/app.js` (state, route handling, VIEW_RENDERERS/VIEW_DATASETS, toolbar set)
- Test: `tests/web_loading.test.mjs` (dataset lists)

**Interfaces:**
- Produces: `state.rivalryFocus = { aKey, bKey } | null`; empty renderers `renderRivalries()`, `renderRivalryDetail()`, `renderOracle()` that later tasks fill; section ids `view-rivalries`, `view-rivalry-detail`, `view-oracle`; container ids listed below (later tasks query them).

- [ ] **Step 1: Failing test** — append to `tests/web_loading.test.mjs` (same style as the existing VIEW_DATASETS regex asserts):

```js
assert.match(appJs, /rivalries:\s*\["matchupSummary", "matchHighlights", "matchVideos"\]/);
assert.match(appJs, /"rivalry-detail":\s*\["matchupSummary", "matchHighlights", "matchVideos"\]/);
assert.match(appJs, /oracle:\s*\["matchVideos"\]/);
```

Run `node --test tests/web_loading.test.mjs` → FAIL.

- [ ] **Step 2: index.html** — in the duels subnav (next to the `data-view="matchup"` button) add:

```html
<button class="tab" data-view="rivalries" data-i18n="nav.rivalries">Rivalitäten</button>
<button class="tab" data-view="oracle" data-i18n="nav.oracle">Orakel</button>
```

After the `view-matchup` section add three sections (structure mirrors `view-upset-index` / detail sections):

```html
<section id="view-rivalries" class="view-section" hidden>
  <h2 data-i18n="sections.rivalries">Rivalitäten</h2>
  <p class="muted" data-i18n="sections.rivalriesDescription">Die meistgespielten, engsten und meistgesehenen Duelle der GPL-Geschichte.</p>
  <details class="score-explainer">
    <summary data-i18n="rivalries.scoreFormulaTitle">Wie wird der Rivalitäts-Score berechnet?</summary>
    <p data-i18n="rivalries.scoreFormula">Score = Duelle × (0,2 + Ausgeglichenheit) × (1 + log10(1 + Videoaufrufe)). Ausgeglichenheit = 1 − |Siege A − Siege B| / Duelle. Berechnet, nicht offiziell.</p>
  </details>
  <div id="rivalry-cards" class="hof-grid"></div>
  <div id="rivalry-show-more"></div>
  <div id="rivalry-table" class="table-host"></div>
</section>

<section id="view-rivalry-detail" class="view-section" hidden>
  <h2 id="rivalry-detail-title"></h2>
  <div id="rivalry-summary" class="summary-grid"></div>
  <div id="rivalry-gap-block">
    <h3 data-i18n="rivalries.eloGapTitle">Elo-Abstand über die Duelle</h3>
    <div id="rivalry-gap-chart"></div>
  </div>
  <div id="rivalry-most-watched"></div>
  <h3 data-i18n="rivalries.meetingsTitle">Alle Duelle</h3>
  <div id="rivalry-meetings"></div>
</section>

<section id="view-oracle" class="view-section" hidden>
  <h2 data-i18n="sections.oracle">Orakel der GPL</h2>
  <p class="muted" data-i18n="sections.oracleDescription">Wie viele Duelle liegen zwischen zwei Personen? Kürzeste Kette über gespielte Kämpfe.</p>
  <form id="oracle-form" class="matchup-form">
    <select id="oracle-a"></select>
    <select id="oracle-b"></select>
    <label class="oracle-toggle"><input type="checkbox" id="oracle-include-stints" /> <span data-i18n="oracle.includeStints">Auch gemeinsame Saisons zählen</span></label>
    <button type="submit" data-i18n="oracle.search">Verbinden</button>
  </form>
  <div id="oracle-result"></div>
  <h3 data-i18n="oracle.leaderboardTitle">Vernetzungs-Rangliste</h3>
  <p class="muted" data-i18n="oracle.leaderboardNote">Anzahl verschiedener Gegner über die gesamte Archiv-Historie (ohne Forfeits und ungeklärte Kämpfe).</p>
  <div id="oracle-leaderboard" class="table-host"></div>
</section>
```

(If `view-matchup`'s form uses a different class than `matchup-form`, reuse whatever class that form has so styling matches.)

- [ ] **Step 3: i18n** — add to `TRANSLATIONS.de` (and mirrored English in `en`):

```js
// nav
rivalries: "Rivalitäten",            // en: "Rivalries"
oracle: "Orakel",                    // en: "Oracle"
// sections
rivalries: "Rivalitäten",            // en: "Rivalries"
rivalriesDescription: "Die meistgespielten, engsten und meistgesehenen Duelle der GPL-Geschichte.",
  // en: "The most played, closest, and most watched head-to-heads in GPL history."
oracle: "Orakel der GPL",            // en: "Oracle of the GPL"
oracleDescription: "Wie viele Duelle liegen zwischen zwei Personen? Kürzeste Kette über gespielte Kämpfe.",
  // en: "How many matches connect two people? Shortest chain over played matches."
// rivalries namespace
rivalries: {
  scoreFormulaTitle: "Wie wird der Rivalitäts-Score berechnet?",
  scoreFormula: "Score = Duelle × (0,2 + Ausgeglichenheit) × (1 + log10(1 + Videoaufrufe)). Ausgeglichenheit = 1 − |Siege A − Siege B| / Duelle. Berechnet, nicht offiziell.",
  minMeetingsNote: "Nur Paarungen mit mindestens 3 Duellen.",
  empty: "Keine Rivalitäten in den geladenen Daten.",
  record: "Bilanz",
  meetings: "Duelle",
  currentStreak: "Aktuelle Serie",
  biggestWin: "Höchster Sieg",
  mostWatchedTitle: "Meistgesehenes Duell",
  eloGapTitle: "Elo-Abstand über die Duelle",
  eloGapHint: "Positiv = {a} lag vor dem Duell vorn, negativ = {b}.",
  meetingsTitle: "Alle Duelle",
  toMatchup: "Im Head-to-Head öffnen",
  detailNote: "Datenbasis: gesamtes Archiv. Elo-Werte aus der Client-Chronologie (K=32, Start 1500).",
  showAll: "Alle Rivalitäten",
},
// oracle namespace
oracle: {
  search: "Verbinden",
  includeStints: "Auch gemeinsame Saisons zählen",
  pickTwo: "Bitte zwei Personen wählen.",
  samePerson: "Das sind dieselbe Person.",
  connected: "{a} und {b} sind über {n} Duell(e) verbunden.",
  connectedStints: "{a} und {b} sind über {n} Schritt(e) verbunden (inkl. gemeinsamer Saisons).",
  noPath: "Keine Verbindung gefunden.",
  viaMatch: "{season} · {week}",
  viaStint: "Gemeinsame Saison: {season} ({division})",
  leaderboardTitle: "Vernetzungs-Rangliste",
  leaderboardNote: "Anzahl verschiedener Gegner über die gesamte Archiv-Historie (ohne Forfeits und ungeklärte Kämpfe).",
},
// columns additions
closeness: "Ausgeglichenheit",       // en: "Closeness"
rivalry_score: "Rivalitäts-Score",   // en: "Rivalry score"
pair: "Paarung",                     // en: "Pairing"
meetings: "Duelle",                  // en: "Meetings"
elo_gap: "Elo-Abstand",              // en: "Elo gap"
opponents: "Gegner",                 // en: "Opponents"
```

Use `{placeholders}` with the existing template-fill helper the app uses for such strings (search `replace("{` in app.js — e.g. the pattern used by `hof`/`awards.computedNote`); if plain `.replace()` chains are the local idiom, use those.

- [ ] **Step 4: app.js wiring** —
  1. `VIEW_DATASETS` additions (exact strings the test expects): `rivalries: ["matchupSummary", "matchHighlights", "matchVideos"],` `"rivalry-detail": ["matchupSummary", "matchHighlights", "matchVideos"],` `oracle: ["matchVideos"],`
  2. `VIEW_RENDERERS` additions: `rivalries: renderRivalries, "rivalry-detail": renderRivalryDetail, oracle: renderOracle,` with stub functions `function renderRivalries() {}` etc. (filled in Tasks 4/5/7).
  3. `state` gains `rivalryFocus: null` and `rivalryCardLimit: null`.
  4. `applyRouteFromHash`: add a `route.rivalryKey` branch (mirroring the `route.rosterKey` branch: clear person/pokemon/roster focus, set `state.rivalryFocus = { aKey: route.rivalryKey.aKey, bKey: route.rivalryKey.bKey }`, reset season/division/search + their selects) and add `state.rivalryFocus = null;` to every other branch of that if/else chain.
  5. Toolbar hiding: extend the `setActiveView` view set that toggles `is-cinema-hidden` on `.toolbar` with `"rivalries"`, `"rivalry-detail"`, `"oracle"`.
  6. Reset `state.rivalryCardLimit = null` where sibling views reset their card limits on view change (same place `upsetCardLimit` resets, if it does — otherwise leave persistent like upsets).

- [ ] **Step 5: Verify** — `node --test tests/web_loading.test.mjs tests/web_router.test.mjs tests/web_view_config.test.mjs tests/web_i18n.test.mjs tests/web_shell.test.mjs` → PASS. Then a Playwright smoke: `npm run serve` (port 8000), navigate `http://localhost:8000/web/#/rivalries`, `#/oracle`, `#/rivalitaet/person_bene__person_pokgalaxy` — sections show (empty), toolbar hidden, no console errors.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "Register Rivalitäten, Rivalitäts-Detail und Orakel view shells"`

---

### Task 3: `web/rivalries.js` — `rivalryPairs`

**Files:**
- Create: `web/rivalries.js`
- Test: `tests/web_rivalries.test.mjs`

**Interfaces:**
- Consumes: `matchup_summary.csv` rows, `match_highlights.csv` rows, `normalizedKey` (passed as `normalizeKey`).
- Produces: `rivalryPairs(matchupRows, highlightRows, normalizeKey, minMeetings = 3)` → array sorted by `rivalry_score` desc of `{ a_id, a_name, b_id, b_name, matches, wins_a, wins_b, draws, closeness, view_total, rivalry_score, source_urls }`.

Semantics (fixed here, shown in the UI explainer):
- Undirected dedupe: keep the directed row whose `person_id` sorts before `opponent_id` (string `<`); `wins_a` = that row's `wins`, `wins_b` = its `losses`.
- `closeness = 1 − |wins_a − wins_b| / matches` (2 decimals at render, raw in data).
- `view_total` = sum of `view_total` over `match_highlights` rows whose normalized `{player_a, player_b}` pair equals the normalized `{person_name, opponent_name}` pair (0 when highlights are absent — lazy dataset).
- `rivalry_score = matches * (0.2 + closeness) * (1 + Math.log10(1 + view_total))`.
- Filter `matches >= minMeetings`; sort by score desc, then matches desc, then `a_name` asc.

- [ ] **Step 1: Failing tests** — create `tests/web_rivalries.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { rivalryPairs } from "../web/rivalries.js";

const norm = (value) => String(value ?? "").trim().toLowerCase();

const summary = [
  { person_id: "person_a", person_name: "Alba", opponent_id: "person_b", opponent_name: "Bruno", matches: "4", wins: "2", losses: "2", draws: "0", source_urls: "u1" },
  { person_id: "person_b", person_name: "Bruno", opponent_id: "person_a", opponent_name: "Alba", matches: "4", wins: "2", losses: "2", draws: "0", source_urls: "u1" },
  { person_id: "person_a", person_name: "Alba", opponent_id: "person_c", opponent_name: "Cora", matches: "2", wins: "2", losses: "0", draws: "0", source_urls: "u2" },
  { person_id: "person_c", person_name: "Cora", opponent_id: "person_a", opponent_name: "Alba", matches: "2", wins: "0", losses: "2", draws: "0", source_urls: "u2" },
  { person_id: "person_b", person_name: "Bruno", opponent_id: "person_c", opponent_name: "Cora", matches: "5", wins: "5", losses: "0", draws: "0", source_urls: "u3" },
  { person_id: "person_c", person_name: "Cora", opponent_id: "person_b", opponent_name: "Bruno", matches: "5", wins: "0", losses: "5", draws: "0", source_urls: "u3" },
];
const highlights = [
  { player_a: "Bruno", player_b: "Alba", view_total: "1000" },
  { player_a: "Alba", player_b: "Bruno", view_total: "500" },
  { player_a: "Cora", player_b: "Bruno", view_total: "90000" },
];

test("dedupes directed pairs, applies min meetings, joins views", () => {
  const rows = rivalryPairs(summary, highlights, norm);
  assert.equal(rows.length, 2); // a-c has only 2 meetings
  const ab = rows.find((row) => row.a_id === "person_a" && row.b_id === "person_b");
  assert.equal(ab.matches, 4);
  assert.equal(ab.wins_a, 2);
  assert.equal(ab.wins_b, 2);
  assert.equal(ab.closeness, 1);
  assert.equal(ab.view_total, 1500);
});

test("score ranks even pairs above one-sided pairs of similar size", () => {
  const rows = rivalryPairs(summary, highlights, norm);
  const ab = rows.find((row) => row.a_id === "person_a");
  // 4 * (0.2 + 1) * (1 + log10(1501))
  assert.ok(Math.abs(ab.rivalry_score - 4 * 1.2 * (1 + Math.log10(1501))) < 1e-9);
  const bc = rows.find((row) => row.a_id === "person_b");
  assert.equal(bc.closeness, 0); // 5:0
  assert.ok(Math.abs(bc.rivalry_score - 5 * 0.2 * (1 + Math.log10(90001))) < 1e-9);
});

test("empty highlights degrade to zero views", () => {
  const rows = rivalryPairs(summary, [], norm);
  assert.equal(rows.find((row) => row.a_id === "person_a").view_total, 0);
});
```

- [ ] **Step 2: Run** — `node --test tests/web_rivalries.test.mjs` → FAIL (module missing).
- [ ] **Step 3: Implement** `web/rivalries.js`:

```js
// Rivalry ranking and per-pair meeting history. Rankings come from the
// pipeline matchup summary; meetings come from the client-side Elo
// chronology so pregame ratings match the published Elo by construction.

const pairKeyOf = (left, right, normalizeKey) => {
  const keys = [normalizeKey(left), normalizeKey(right)].sort();
  return keys[0] && keys[1] ? keys.join("__") : "";
};

export function rivalryPairs(matchupRows = [], highlightRows = [], normalizeKey, minMeetings = 3) {
  const viewsByPair = new Map();
  for (const row of highlightRows) {
    const key = pairKeyOf(row.player_a, row.player_b, normalizeKey);
    if (!key) continue;
    viewsByPair.set(key, (viewsByPair.get(key) || 0) + (Number(row.view_total) || 0));
  }
  const rows = [];
  for (const row of matchupRows) {
    if (!row.person_id || !row.opponent_id || row.person_id >= row.opponent_id) continue;
    const matches = Number(row.matches) || 0;
    if (matches < minMeetings) continue;
    const winsA = Number(row.wins) || 0;
    const winsB = Number(row.losses) || 0;
    const closeness = 1 - Math.abs(winsA - winsB) / matches;
    const viewTotal = viewsByPair.get(pairKeyOf(row.person_name, row.opponent_name, normalizeKey)) || 0;
    rows.push({
      a_id: row.person_id,
      a_name: row.person_name,
      b_id: row.opponent_id,
      b_name: row.opponent_name,
      matches,
      wins_a: winsA,
      wins_b: winsB,
      draws: Number(row.draws) || 0,
      closeness,
      view_total: viewTotal,
      rivalry_score: matches * (0.2 + closeness) * (1 + Math.log10(1 + viewTotal)),
      source_urls: row.source_urls || "",
    });
  }
  return rows.sort(
    (a, b) => b.rivalry_score - a.rivalry_score || b.matches - a.matches || a.a_name.localeCompare(b.a_name),
  );
}
```

- [ ] **Step 4: Run** — `node --test tests/web_rivalries.test.mjs` → PASS.
- [ ] **Step 5: Commit** — `git add web/rivalries.js tests/web_rivalries.test.mjs && git commit -m "Add rivalryPairs ranking helper"`

---

### Task 4: `rivalryMeetings` + Rivalitäten index render

**Files:**
- Modify: `web/rivalries.js`, `tests/web_rivalries.test.mjs`
- Modify: `web/app.js` (fill `renderRivalries`), `web/table_columns.js`, `web/styles.css`

**Interfaces:**
- Consumes: `eloChronology` result shape (`{ perMatch: Map, perPerson: Map, order: [] }` — `perMatch` entries carry `aKey,bKey,aName,bName,eloPreA,eloPreB,seasonId,week,stage`), match rows, highlight rows.
- Produces: `rivalryMeetings(aKey, bKey, chronology, matches, highlightRows, normalizeKey)` → `{ meetings, summary, gapPoints }` where
  - `meetings`: chronological `{ match_id, season_id, division, stage, week, score, winner ("a"|"b"|"draw"), elo_pre_a, elo_pre_b, elo_gap, video_url, view_total, source_urls }` — score and gap oriented a-first;
  - `summary`: `{ matches, wins_a, wins_b, draws, streak: { side: "a"|"b"|"", length }, biggest: meeting|null, mostWatched: meeting|null }` (streak = trailing run of one winner, broken by draws; biggest = decided meeting with max score margin, first on tie; mostWatched = max `view_total` > 0, else null);
  - `gapPoints`: `[{ x: 1-based meeting index, y: elo_gap, source: meeting }]`.

- [ ] **Step 1: Failing tests** — append to `tests/web_rivalries.test.mjs` a fixture with a hand-built chronology (build it by importing `eloChronology` from `../web/elo_history.js` over 4 literal match rows between "Alba"/"Bruno" plus one Alba–Cora row: Alba wins m1 4:0, Bruno wins m2 2:1 (row stored Bruno-as-player_a to test orientation), draw m3 (`winner: ""`, `result_basis: "draw"`), Bruno wins m4 1:0). Assert: meetings length 4 and excludes the Alba–Cora match; m2 `score === "1:2"` and `winner === "b"`; `summary.wins_a === 1`, `summary.draws === 1`, `summary.streak` `{ side: "b", length: 1 }` (draw at m3 broke the run); `summary.biggest.match_id === "m1"`; `gapPoints[0].x === 1` and `gapPoints[0].y === 0` (both start 1500); `mostWatched === null` without highlights and picks the right match with a highlights fixture.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** in `web/rivalries.js`:

```js
export function rivalryMeetings(aKey, bKey, chronology, matches = [], highlightRows = [], normalizeKey) {
  const matchById = new Map(matches.map((row) => [String(row.match_id || ""), row]));
  const viewsByMatch = new Map(highlightRows.map((row) => [String(row.match_id || ""), Number(row.view_total) || 0]));
  const meetings = [];
  for (const matchId of chronology.order) {
    const entry = chronology.perMatch.get(matchId);
    if (!entry) continue;
    const pairMatches =
      (entry.aKey === aKey && entry.bKey === bKey) || (entry.aKey === bKey && entry.bKey === aKey);
    if (!pairMatches) continue;
    const aIsLeft = entry.aKey === aKey;
    const source = matchById.get(matchId) || {};
    const winnerKey = normalizeKey(source.winner);
    const scoreParts = [source.score_a, source.score_b].filter((v) => v !== undefined && v !== "");
    const score = scoreParts.length < 2 ? scoreParts.join(":") : aIsLeft ? `${source.score_a}:${source.score_b}` : `${source.score_b}:${source.score_a}`;
    meetings.push({
      match_id: matchId,
      season_id: entry.seasonId,
      division: source.division || "",
      stage: entry.stage,
      week: entry.week,
      score,
      winner: winnerKey === aKey ? "a" : winnerKey === bKey ? "b" : "draw",
      elo_pre_a: aIsLeft ? entry.eloPreA : entry.eloPreB,
      elo_pre_b: aIsLeft ? entry.eloPreB : entry.eloPreA,
      elo_gap: aIsLeft ? entry.eloPreA - entry.eloPreB : entry.eloPreB - entry.eloPreA,
      video_url: source.video_url || "",
      view_total: viewsByMatch.get(matchId) || 0,
      source_urls: source.source_urls || "",
    });
  }
  const summary = { matches: meetings.length, wins_a: 0, wins_b: 0, draws: 0, streak: { side: "", length: 0 }, biggest: null, mostWatched: null };
  let biggestMargin = -1;
  for (const meeting of meetings) {
    if (meeting.winner === "a") summary.wins_a += 1;
    else if (meeting.winner === "b") summary.wins_b += 1;
    else summary.draws += 1;
    if (meeting.winner !== "draw") {
      const [left, right] = meeting.score.split(":").map(Number);
      const margin = Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) : 0;
      if (margin > biggestMargin) {
        biggestMargin = margin;
        summary.biggest = meeting;
      }
    }
    if (meeting.view_total > 0 && meeting.view_total > (summary.mostWatched?.view_total || 0)) {
      summary.mostWatched = meeting;
    }
  }
  for (let i = meetings.length - 1; i >= 0; i -= 1) {
    const winner = meetings[i].winner;
    if (winner === "draw") break;
    if (!summary.streak.side) summary.streak.side = winner;
    if (summary.streak.side !== winner) break;
    summary.streak.length += 1;
  }
  const gapPoints = meetings.map((meeting, index) => ({ x: index + 1, y: meeting.elo_gap, source: meeting }));
  return { meetings, summary, gapPoints };
}
```

- [ ] **Step 4: Run** — `node --test tests/web_rivalries.test.mjs` → PASS.
- [ ] **Step 5: Index render** — in `web/table_columns.js` add:

```js
export const RIVALRY_COLUMNS = ["rank", "pair", "meetings", "record", "closeness", "view_total", "rivalry_score", "source"];
```

and add `"meetings"`, `"closeness"`, `"rivalry_score"`, `"elo_gap"`, `"opponents"` to `NUMERIC_COLUMNS` (skip any already present, e.g. `view_total`). In `web/app.js` import `rivalryPairs, rivalryMeetings` from `./rivalries.js`, `rivalryRouteHash` from `./router.js`, `RIVALRY_COLUMNS` from `./table_columns.js`, add `const DEFAULT_RIVALRY_CARD_LIMIT = 8;`, a link helper next to `personLink`:

```js
function rivalryLink(aId, bId, label, className = "link-button") {
  const a = canonicalPersonRouteKey(aId);
  const b = canonicalPersonRouteKey(bId);
  return `<a class="${escapeAttr(className)}" href="${escapeAttr(rivalryRouteHash(a, b))}">${escapeHtml(label)}</a>`;
}
```

and fill `renderRivalries()`: compute `const pairs = rivalryPairs(state.data.matchupSummary ?? [], state.data.matchHighlights ?? [], normalizedKey);`; if empty render `rivalries.empty` into `#rivalry-cards`; otherwise render the top `state.rivalryCardLimit ?? DEFAULT_RIVALRY_CARD_LIMIT` pairs as `.hof-card.rivalry-card` cards (rank badge, `rivalryLink(a_id, b_id, "A vs B")` title, record line `wins_a:draws:wins_b` labeled with `rivalries.record`, meetings count, score `rivalry_score.toFixed(1)`), a `data-show-more-rivalries` button (exact pattern of `data-show-more-upsets`: bump the limit by 8, re-render; hide when exhausted) and the full Tabulator via `renderTable("#rivalry-table", tableRows, columnsForProfile(RIVALRY_COLUMNS, state.columnProfile), ["pair", "source"])` where `tableRows` map pairs to `{ rank, pair: rivalryLink(...), meetings: row.matches, record: \`${row.wins_a}-${row.draws}-${row.wins_b}\`, closeness: row.closeness.toFixed(2), view_total: row.view_total, rivalry_score: row.rivalry_score.toFixed(1), source: sourceLink(row.source_urls) }`. Register the delegated click for `[data-show-more-rivalries]` next to `[data-show-more-upsets]`. Add `.rivalry-card` CSS only if `.hof-card` needs adjustment (reuse tokens; no new colors).
- [ ] **Step 6: Verify in browser** — Playwright: `#/rivalries` shows cards + table, "Mehr anzeigen" works, pair link navigates to `#/rivalitaet/person_x__person_y`. `node --test tests/*.mjs` all green.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "Add rivalryMeetings and Rivalitäten index view"`

---

### Task 5: Rivalry detail view

**Files:**
- Modify: `web/app.js` (fill `renderRivalryDetail`, add `cachedFullEloChronology`)
- Modify: `web/styles.css`

**Interfaces:**
- Consumes: `state.rivalryFocus`, `rivalryMeetings` (Task 4), `chronologyKeyForPerson(chronology, focusKey)` (exists, app.js:3233), `lineChart` from `./charts.js`, `videoLinksForMatch`, `metricCard`, `tableHtml`, `personLink`.
- Produces: `cachedFullEloChronology()` — full-archive chronology memo (used again by the oracle task for names).

- [ ] **Step 1: Add the full-archive chronology memo** near `cachedEloChronology` (rivalry pages are career-scope with hidden toolbar, so they must NOT depend on `state.dataMode`):

```js
let fullEloChronologyCache = null;

function cachedFullEloChronology() {
  const matches = state.data.matches ?? [];
  if (fullEloChronologyCache && fullEloChronologyCache.source === matches) {
    return fullEloChronologyCache.value;
  }
  fullEloChronologyCache = { source: matches, value: eloChronology(matches, normalizedKey) };
  return fullEloChronologyCache.value;
}
```

- [ ] **Step 2: Fill `renderRivalryDetail()`**:
  - Guard: `if (!state.rivalryFocus) return;` and empty-state text when either key resolves to nothing.
  - `const chronology = cachedFullEloChronology();` `const aKey = chronologyKeyForPerson(chronology, state.rivalryFocus.aKey);` same for `bKey`; display names from `chronology.perPerson.get(aKey)?.name`.
  - `const { meetings, summary, gapPoints } = rivalryMeetings(aKey, bKey, chronology, state.data.matches ?? [], state.data.matchHighlights ?? [], normalizedKey);`
  - Title `#rivalry-detail-title`: `${personLink(state.rivalryFocus.aKey, aName)} <span class="highlight-vs">vs</span> ${personLink(state.rivalryFocus.bKey, bName)}` plus a `matchup` cross-link button (`rivalries.toMatchup`) that calls the existing `selectMatchupParticipant` flow via `data-matchup-select="${bChronoKey}" data-matchup-slot="b" data-matchup-primary="${aChronoKey}"` (exact attribute names used by the existing delegated handler, app.js:456).
  - `#rivalry-summary`: `metricCard` row — meetings, `A wins`, `B wins` (labels are the two names, not generic strings), draws, `rivalries.currentStreak` (`${name} · ${length}` or "—"), `rivalries.biggestWin` (`${name} ${score}, ${seasonShortDisplay(season_id)}` or "—"). Below the grid a `<p class="muted">` with `rivalries.detailNote`.
  - Gap chart: `lineChart(document.querySelector("#rivalry-gap-chart"), { series: [{ id: "gap", points: gapPoints }], yDomain: paddedDomain([...gapPoints.map(p => p.y), 0]), formatX: (v) => \`#${Math.round(v)}\`, tooltip: (meeting) => \`${seasonShortDisplay(meeting.season_id)} ${meeting.week} · ${Math.round(meeting.elo_gap)}\` })` (import `paddedDomain` from `./charts.js`); under it the `rivalries.eloGapHint` note with `{a}`/`{b}` filled. Skip the whole block (`hidden`) when `meetings.length < 2`.
  - `#rivalry-most-watched`: when `summary.mostWatched`, a small card (`rivalries.mostWatchedTitle`, score, season/week, view count via `displayNumber`, `videoLinksForMatch(match_id)`).
  - `#rivalry-meetings`: `tableHtml` in `.table-wrap` (meeting counts are small — no Tabulator): columns `["season", "week", "score", "winner", "elo_gap", "videos", "source"]` with rows `{ season: seasonShortDisplay(m.season_id), week: m.week, score: m.score, winner: m.winner === "draw" ? t(state.language, "values.draw") : escapeHtml(m.winner === "a" ? aName : bName), elo_gap: Math.round(m.elo_gap), videos: videoLinksForMatch(m.match_id, { compact: true }), source: sourceLink(m.source_urls) }`, html columns `["winner", "videos", "source"]`.
- [ ] **Step 3: CSS** — reuse existing tokens; add only `.rivalry-detail` spacing rules if needed (e.g. `#rivalry-gap-chart { min-height: 260px; }`).
- [ ] **Step 4: Verify** — Playwright: open the top rivalry from the index; check title links canonicalize (`#/person/person_...`), score orientation matches winner names on at least one known match (e.g. any Pokgalaxy vs Bene meeting), gap chart renders, "Im Head-to-Head öffnen" lands on matchup with both slots filled. `node --test tests/*.mjs` green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add rivalry detail view with meeting ledger and Elo-gap chart"`

---

### Task 6: `web/oracle.js` — graph, BFS, connectedness

**Files:**
- Create: `web/oracle.js`
- Test: `tests/web_oracle.test.mjs`

**Interfaces:**
- Consumes: `matches.csv` rows, `person_stints.csv` rows, `normalizeKey`.
- Produces:
  - `oracleGraph(matches, stints, options, normalizeKey)` → `{ nodes: Map<key, { name }>, edges: Map<key, Map<neighborKey, via>> }` with `via = { type: "match", matchId, seasonId, week, division, videoUrl } | { type: "stint", seasonId, division }`; `options = { includeStints = false }`.
  - `oraclePath(graph, aKey, bKey)` → `[{ key, name, via }]` (first element `via: null`) or `null`.
  - `connectednessRows(matches, normalizeKey)` → `[{ key, name, opponents, matches }]` sorted by opponents desc, matches desc, name asc.

Semantics (fixed): match edges skip rows missing either player and rows with `result_basis` `"forfeit"` or `"unresolved"` (never played / unconfirmable — same rule as the upset index); the stored `via` for a pair is the first meeting, upgraded once if a later meeting has a `video_url` and the stored one does not; stint edges connect all pairs sharing (season_id, division) and never overwrite a match edge; BFS visits neighbors in sorted key order for deterministic paths.

- [ ] **Step 1: Failing tests** — create `tests/web_oracle.test.mjs` with literal fixtures:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { connectednessRows, oracleGraph, oraclePath } from "../web/oracle.js";

const norm = (value) => String(value ?? "").trim().toLowerCase();
const matches = [
  { match_id: "m1", season_id: "season_001", week: "1", division: "L1", player_a: "Alba", player_b: "Bruno", winner: "Alba", result_basis: "" },
  { match_id: "m2", season_id: "season_001", week: "2", division: "L1", player_a: "Bruno", player_b: "Cora", winner: "Cora", result_basis: "", video_url: "https://v/2" },
  { match_id: "m3", season_id: "season_002", week: "1", division: "L1", player_a: "Alba", player_b: "Bruno", winner: "Bruno", result_basis: "", video_url: "https://v/3" },
  { match_id: "m4", season_id: "season_001", week: "3", division: "L1", player_a: "Cora", player_b: "Dino", winner: "", result_basis: "forfeit" },
  { match_id: "m5", season_id: "season_001", week: "4", division: "L1", player_a: "", player_b: "Dino", winner: "", result_basis: "" },
];
const stints = [
  { season_id: "season_003", division: "Liga 1", person_name: "Dino" },
  { season_id: "season_003", division: "Liga 1", person_name: "Cora" },
];

test("match edges skip forfeits and player-less rows, upgrade to video via", () => {
  const graph = oracleGraph(matches, [], {}, norm);
  assert.equal(graph.edges.has("dino"), false);
  assert.equal(graph.edges.get("alba").get("bruno").videoUrl, "https://v/3"); // m1 upgraded by m3
  assert.equal(graph.edges.get("alba").get("bruno").matchId, "m3");
});

test("BFS finds the shortest chain with via metadata", () => {
  const graph = oracleGraph(matches, [], {}, norm);
  const path = oraclePath(graph, "alba", "cora");
  assert.deepEqual(path.map((hop) => hop.key), ["alba", "bruno", "cora"]);
  assert.equal(path[1].via.type, "match");
  assert.equal(path[2].via.matchId, "m2");
  assert.equal(oraclePath(graph, "alba", "dino"), null);
});

test("stint edges only appear with the toggle and never shadow match edges", () => {
  const withStints = oracleGraph(matches, stints, { includeStints: true }, norm);
  assert.equal(withStints.edges.get("cora").get("dino").type, "stint");
  assert.equal(withStints.edges.get("alba").get("bruno").type, "match");
  const path = oraclePath(withStints, "alba", "dino");
  assert.equal(path.length, 4);
});

test("connectedness counts distinct opponents over played matches", () => {
  const rows = connectednessRows(matches, norm);
  assert.deepEqual(rows[0], { key: "bruno", name: "Bruno", opponents: 2, matches: 3 });
  assert.equal(rows.find((row) => row.key === "dino"), undefined);
});
```

- [ ] **Step 2: Run** → FAIL (module missing).
- [ ] **Step 3: Implement** `web/oracle.js`:

```js
// Six-degrees graph over played matches. Forfeits and unresolved rows are
// not edges: a chain hop must be a match that actually happened.

const SKIPPED_BASIS = new Set(["forfeit", "unresolved"]);

function playedMatchRows(matches) {
  return matches.filter(
    (row) => row.player_a && row.player_b && !SKIPPED_BASIS.has(row.result_basis || ""),
  );
}

export function oracleGraph(matches = [], stints = [], { includeStints = false } = {}, normalizeKey) {
  const nodes = new Map();
  const edges = new Map();
  const touch = (key, name) => {
    if (!nodes.has(key)) nodes.set(key, { name });
    if (!edges.has(key)) edges.set(key, new Map());
  };
  const connect = (aKey, bKey, via, { overwriteForVideo = false } = {}) => {
    const existing = edges.get(aKey).get(bKey);
    if (!existing) {
      edges.get(aKey).set(bKey, via);
    } else if (overwriteForVideo && existing.type === "match" && !existing.videoUrl && via.videoUrl) {
      edges.get(aKey).set(bKey, via);
    }
  };
  for (const row of playedMatchRows(matches)) {
    const aKey = normalizeKey(row.player_a);
    const bKey = normalizeKey(row.player_b);
    if (!aKey || !bKey || aKey === bKey) continue;
    touch(aKey, row.player_a);
    touch(bKey, row.player_b);
    const via = {
      type: "match",
      matchId: String(row.match_id || ""),
      seasonId: row.season_id || "",
      week: row.week || "",
      division: row.division || "",
      videoUrl: row.video_url || "",
    };
    connect(aKey, bKey, via, { overwriteForVideo: true });
    connect(bKey, aKey, via, { overwriteForVideo: true });
  }
  if (includeStints) {
    const bySeasonDivision = new Map();
    for (const row of stints) {
      const key = normalizeKey(row.person_name);
      if (!key) continue;
      const groupKey = `${row.season_id}::${row.division}`;
      if (!bySeasonDivision.has(groupKey)) bySeasonDivision.set(groupKey, new Map());
      bySeasonDivision.get(groupKey).set(key, row.person_name);
    }
    for (const [groupKey, members] of bySeasonDivision) {
      const [seasonId, division] = groupKey.split("::");
      const entries = [...members.entries()];
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const [aKey, aName] = entries[i];
          const [bKey, bName] = entries[j];
          touch(aKey, aName);
          touch(bKey, bName);
          const via = { type: "stint", seasonId, division };
          connect(aKey, bKey, via);
          connect(bKey, aKey, via);
        }
      }
    }
  }
  return { nodes, edges };
}

export function oraclePath(graph, aKey, bKey) {
  if (!graph.edges.has(aKey) || !graph.edges.has(bKey)) return null;
  if (aKey === bKey) return [{ key: aKey, name: graph.nodes.get(aKey)?.name || aKey, via: null }];
  const cameFrom = new Map([[aKey, null]]);
  const queue = [aKey];
  while (queue.length) {
    const current = queue.shift();
    const neighbors = [...graph.edges.get(current).keys()].sort();
    for (const neighbor of neighbors) {
      if (cameFrom.has(neighbor)) continue;
      cameFrom.set(neighbor, current);
      if (neighbor === bKey) {
        const path = [];
        let step = neighbor;
        while (step) {
          const previous = cameFrom.get(step);
          path.unshift({
            key: step,
            name: graph.nodes.get(step)?.name || step,
            via: previous ? graph.edges.get(previous).get(step) : null,
          });
          step = previous;
        }
        return path;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

export function connectednessRows(matches = [], normalizeKey) {
  const byPerson = new Map();
  for (const row of playedMatchRows(matches)) {
    const aKey = normalizeKey(row.player_a);
    const bKey = normalizeKey(row.player_b);
    if (!aKey || !bKey || aKey === bKey) continue;
    const track = (key, name, opponent) => {
      if (!byPerson.has(key)) byPerson.set(key, { key, name, opponents: new Set(), matches: 0 });
      const entry = byPerson.get(key);
      entry.opponents.add(opponent);
      entry.matches += 1;
    };
    track(aKey, row.player_a, bKey);
    track(bKey, row.player_b, aKey);
  }
  return [...byPerson.values()]
    .map((entry) => ({ key: entry.key, name: entry.name, opponents: entry.opponents.size, matches: entry.matches }))
    .sort((a, b) => b.opponents - a.opponents || b.matches - a.matches || a.name.localeCompare(b.name));
}
```

- [ ] **Step 4: Run** — `node --test tests/web_oracle.test.mjs` → PASS.
- [ ] **Step 5: Commit** — `git add web/oracle.js tests/web_oracle.test.mjs && git commit -m "Add oracle graph, BFS path, and connectedness helpers"`

---

### Task 7: Orakel view render

**Files:**
- Modify: `web/app.js` (fill `renderOracle`, option population, form binding, graph memo)
- Modify: `web/table_columns.js` (`CONNECTEDNESS_COLUMNS`)
- Modify: `web/styles.css` (`.oracle-chain`, `.oracle-hop`, `.oracle-toggle`)

**Interfaces:**
- Consumes: `oracleGraph`, `oraclePath`, `connectednessRows` (Task 6), section ids from Task 2, `videoLinksForMatch`, `personLink`, `seasonShortDisplay`.

- [ ] **Step 1: Columns** — in `web/table_columns.js`: `export const CONNECTEDNESS_COLUMNS = ["rank", "person", "opponents", "matches"];`
- [ ] **Step 2: app.js** —
  - Imports: `connectednessRows, oracleGraph, oraclePath` from `./oracle.js`; `CONNECTEDNESS_COLUMNS` from `./table_columns.js`.
  - `state.oracle = { aKey: "", bKey: "", includeStints: false };`
  - Graph memo keyed on `(matches identity, stints identity, includeStints)`:

```js
let oracleGraphCache = null;

function cachedOracleGraph() {
  const matches = state.data.matches ?? [];
  const stints = state.data.personStints ?? [];
  const include = state.oracle.includeStints;
  if (oracleGraphCache && oracleGraphCache.matches === matches && oracleGraphCache.stints === stints && oracleGraphCache.include === include) {
    return oracleGraphCache.value;
  }
  oracleGraphCache = { matches, stints, include, value: oracleGraph(matches, stints, { includeStints: include }, normalizedKey) };
  return oracleGraphCache.value;
}
```

  - `populateOracleOptions()`: fill `#oracle-a` / `#oracle-b` from `[...cachedOracleGraph().nodes.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name))` with a leading placeholder option reusing `t(state.language, "matchup.placeholder")`; preserve current selections like `populateMatchupOptions` does. Call it wherever `populateMatchupOptions()` is called after data load and on language change (mirror those call sites) — but NOT on season/division/search changes (oracle ignores the toolbar).
  - Form binding in the same init block that binds `#matchup-form`: submit → `state.oracle.aKey/bKey` from selects, `renderOracle()`; `#oracle-include-stints` change → set flag, `renderOracle()`.
  - `renderOracle()`: guard on missing container; if either key empty → `oracle.pickTwo` muted text in `#oracle-result`; if equal → `oracle.samePerson`; else `const path = oraclePath(cachedOracleGraph(), state.oracle.aKey, state.oracle.bKey);` — `null` → `oracle.noPath`; otherwise render a headline (fill `oracle.connected` or `oracle.connectedStints` with names and `path.length - 1`) and a `.oracle-chain` of hop cards: each element `i > 0` renders `<div class="oracle-hop"><span class="oracle-hop-via">…via text…</span></div>` between person chips built with `personLink(hop.key, hop.name)`; via text: match hops fill `oracle.viaMatch` with `seasonShortDisplay(via.seasonId)` and `via.week` plus `videoLinksForMatch(via.matchId, { compact: true })`; stint hops fill `oracle.viaStint`. Always render the leaderboard: `renderTable("#oracle-leaderboard", rows, CONNECTEDNESS_COLUMNS, ["person"])` with `rows = connectednessRows(state.data.matches ?? [], normalizedKey).map((row, index) => ({ rank: index + 1, person: personLink(row.key, row.name), opponents: row.opponents, matches: row.matches }))`.
- [ ] **Step 3: CSS** — `.oracle-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }`, `.oracle-hop { display: flex; flex-direction: column; align-items: center; font-size: 12px; color: var(--muted); }`, `.oracle-hop::before { content: "→"; }` (flip via flex order if it reads better), `.oracle-toggle { display: inline-flex; align-items: center; gap: 6px; }` — tokens only, no literal colors.
- [ ] **Step 4: Verify** — Playwright: pick two distant players (e.g. an S1-only vs an S10-only player) → chain renders with video links; toggle stints → chain may shorten and via text switches to "Gemeinsame Saison…"; leaderboard sorts numerically. `node --test tests/*.mjs` green. Real-data sanity: PresentLP should top the connectedness leaderboard (10 seasons).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Add Orakel view with chain cards and connectedness leaderboard"`

---

### Task 8: Docs, full gate, wrap-up

**Files:**
- Modify: `docs/known-limitations.md`, `README.md` (view list if it enumerates views)

- [ ] **Step 1: Docs** — append to `docs/known-limitations.md` after the "Computed Awards and Records" section:

```markdown
## Rivalitäten and Orakel (computed)

The rivalry ranking is computed, not sourced: score = meetings × (0.2 + closeness) × (1 + log10(1 + pair video views)), closeness = 1 − |wins difference| / meetings, over `matchup_summary.csv` pairs with at least 3 meetings; the formula is printed in the view. Rivalry detail pages and their Elo-gap chart run on the full-archive client Elo chronology (K=32, start 1500) and inherit the result semantics above. The Orakel builds its chains only from matches that were actually played: `forfeit` and `unresolved` rows are not edges. The optional "shared season" toggle adds same-season-and-division edges from `person_stints.csv` and labels those hops accordingly.
```

Update README's feature/view enumeration if it lists nav views (it gained a line in Phase 2 — follow that precedent).
- [ ] **Step 2: Full gate** — `python -m pytest -q` (207), `node --test tests/*.mjs` (now 20 files), `npm run validate`, `npm run check:generated`, `git diff --check`. All green.
- [ ] **Step 3: Playwright regression sweep** — `#/matchup` still works (options, select buttons), `#/rivalries` → detail → back via subnav tab, `#/oracle`, person pages unaffected, toolbar hidden exactly on cinema/zeitreise/record-book/hall-of-fame/rivalries/rivalry-detail/oracle.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "Document Phase 3 rivalry and oracle semantics"`

## Self-Review Notes

- Spec coverage: Rivalitäten index (≥3 meetings, meetings × closeness × views ranking) → Tasks 3–4; detail route `#/rivalitaet/<a>__<b>` with ledger, dominance summary, rivalry streak, Elo-gap line, most-watched meeting → Tasks 1, 4, 5; matchup-picker reuse → matchup cross-link (Task 5) + `data-matchup-select` handler; Orakel BFS with stint toggle, chain cards citing match + video, connectedness leaderboard → Tasks 6–7; group exists since Phase 0 → only subnav additions.
- Deviation from spec, intentional: pair selection on the index is via ranked cards/table links rather than duplicated pickers; the detail page links into the existing matchup pickers instead (spec's "reuses matchup pickers" honored in the other direction). Toolbar hiding on all three views follows the user's Phase 2 Datenbasis-filter decision, which postdates the spec.
- Type consistency: `rivalryKey` is `{ aKey, bKey }` in router and app; `rivalryMeetings` consumes chronology keys (normalized names) while `rivalryPairs`/links carry person_ids — the boundary is `chronologyKeyForPerson`/`canonicalPersonRouteKey` in Task 5, stated explicitly there.
