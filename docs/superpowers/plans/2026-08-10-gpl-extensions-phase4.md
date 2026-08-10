# GPL Extensions Phase 4 (Spiele) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Spiele group: a games hub plus four data-driven mini-games (Kader-Raten, Tipp-Spiel, Klick-Duell, GPL-Quizshow) that share seeded-RNG, localStorage and reveal-with-source utilities.

**Architecture:** New pure-logic module `web/games.js` (seeded RNG, daily puzzle selection, round pickers, quiz question generators — all node-testable), new view group `games` with hub view `games` and routed detail view `game` (`#/spiel/<gameId>`), renderers in `web/app.js` following the existing hub/detail pattern (rivalries/rivalry-detail). No pipeline changes; every game reads already-loaded CSVs and always reveals the source row/URL after each round.

**Tech Stack:** Static ES modules, no build step. d3/Tabulator untouched. `@pkmn/img` sprites via the existing `pokemonSprite()` helper. YouTube thumbnails via the existing `i.ytimg.com` pattern.

## Global Constraints

- Static site, ES modules, no build step, no new dependencies (spec Non-Goals).
- Bilingual de/en: every new i18n key exists in both languages; `tests/web_i18n.test.mjs` enforces parity.
- Source URLs on every claim: each game reveal shows the source row's `source_urls` via the existing `sourceLinks()` formatter (spec: "reveal card pattern that always shows the source row/URL after each round").
- Computed content is labeled "berechnet, nicht offiziell"-style where it could be read as official.
- Seeded RNG = mulberry32 over a string seed; localStorage keys follow `gpl-game-<id>-*` (spec WebApp Behavior, Phase 4).
- `i.ytimg.com` thumbnails degrade gracefully offline (text badge fallback, same rule as sprites).
- No `table-host` class for new tables; explainer boxes use `<details class="score-explainer">` + `.score-explainer-grid`; standalone cards outside grids get `.standalone-card`.
- Never bulk-edit UTF-8 sources with PowerShell `Get-Content`/`Set-Content` — use the Edit tool (PS 5.1 mojibake pitfall).
- Gates at the end of every task: the tests named in the task. Final gate: `python -m pytest -q`, `node --test tests/*.mjs`, `npm run validate`, `npm run check:generated`, `git diff --check`.

## File Structure

- `web/games.js` (new) — all pure game logic: seeded RNG, shuffle, daily-streak bookkeeping, Kader-Raten pools + daily selection + hints, Tipp-Spiel candidates + round picker, Klick-Duell candidates + next picker, Quizshow question generators.
- `web/app.js` — renderers `renderGames` (hub) and `renderGame` (dispatch to per-game renderers), route/state plumbing (`state.gameFocus`, `state.games`), storage helpers.
- `web/router.js` — `#/spiel/<gameId>` parsing + `gameRouteHash(gameId)`.
- `web/view_config.js` — new `games` group + exported `GAME_IDS`.
- `web/index.html` — subnav entries + `view-games` / `view-game` sections.
- `web/i18n.js` — `games.*` namespace, nav/section strings (de + en).
- `web/styles.css` — `.game-card`, `.game-reveal`, `.game-sprite-row`, `.klick-duel` styles.
- `tests/web_games.test.mjs` (new) + updates to `tests/web_router.test.mjs`, `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`, `tests/web_loading.test.mjs`, `tests/web_i18n.test.mjs`.
- Docs: `README.md`, `docs/known-limitations.md`.

Data sources (all already loaded or lazily loadable, header names verified):

- `team_rosters.csv` → dataset key `teamRosters`: `season_id, division, roster_phase, team_name, person_name, person_name_normalized, pokemon, slot, source_urls` (Kader-Raten, Tipp-Spiel sprites).
- `matches.csv` (core): `match_id, season_id, division, stage, week, player_a, player_b, score_a, score_b, winner, result_basis, source_urls` (Tipp-Spiel).
- `video_archive.csv` → `videos`: `video_id, title, channel_title, published_at, view_count, source_urls` (Klick-Duell).
- `champions.csv` (core), `standings.csv` (core), `pokemon_killlists.csv` (core, key `killlists`), `matchup_summary.csv` → `matchupSummary` (Quizshow).
- `match_videos.csv` → `matchVideos` (Tipp-Spiel reveal video links via existing `videoLinksForMatch(matchId)`).

---

### Task 1: Route, view config, nav + section shells, i18n scaffolding

**Files:**
- Modify: `web/view_config.js` (new group after `duels`, export `GAME_IDS`)
- Modify: `web/router.js` (spiel route + `gameRouteHash`)
- Modify: `web/index.html` (nav group button, subnav tab, two `<section>` shells)
- Modify: `web/i18n.js` (nav/section strings de+en)
- Test: `tests/web_router.test.mjs`, `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`, `tests/web_i18n.test.mjs`

**Interfaces:**
- Consumes: existing `VIEW_GROUPS`, `isValidView`, `defaultViewForGroup`.
- Produces: `GAME_IDS` (array of `"kader-raten" | "tipp-spiel" | "klick-duell" | "quizshow"`), `gameRouteHash(gameId) => "#/spiel/<id>"`, route result `{ view: "game", personKey: null, gameKey: "<id>" }`, view ids `games` (hub) and `game` (detail).

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_router.test.mjs` (follow the existing rivalitaet test style in that file):

```js
test("parseRouteHash resolves game routes", () => {
  assert.deepEqual(parseRouteHash("#/spiel/kader-raten"), {
    view: "game",
    personKey: null,
    gameKey: "kader-raten",
  });
  assert.deepEqual(parseRouteHash(gameRouteHash("quizshow")), {
    view: "game",
    personKey: null,
    gameKey: "quizshow",
  });
  // Unknown game ids land on the hub instead of a broken detail page.
  assert.deepEqual(parseRouteHash("#/spiel/poker"), { view: "games", personKey: null });
  assert.deepEqual(parseRouteHash("#/spiel"), { view: "games", personKey: null });
});
```

Add `gameRouteHash` to the router import at the top of the file.

Append to `tests/web_view_config.test.mjs`:

```js
test("games group exposes hub and routed game detail", () => {
  const games = VIEW_GROUPS.find((group) => group.id === "games");
  assert.ok(games, "games group missing");
  assert.deepEqual(games.views, ["games"]);
  assert.deepEqual(games.detailViews, ["game"]);
  assert.equal(games.defaultView, "games");
  assert.deepEqual(GAME_IDS, ["kader-raten", "tipp-spiel", "klick-duell", "quizshow"]);
  assert.ok(isValidView("games"));
  assert.ok(isValidView("game"));
});
```

Add `GAME_IDS` to the view_config import at the top of the file.

Append to `tests/web_shell.test.mjs` (it reads `web/index.html` as text into a variable — reuse the existing variable name used there, e.g. `html`):

```js
test("index.html ships the games hub and game detail shells", () => {
  assert.ok(html.includes('data-view-group="games"'));
  assert.ok(html.includes('data-view="games"'));
  assert.ok(html.includes('id="view-games"'));
  assert.ok(html.includes('id="view-game"'));
  assert.ok(html.includes('id="games-cards"'));
  assert.ok(html.includes('id="game-body"'));
});
```

Append to `tests/web_i18n.test.mjs` (next to the rivalries/oracle description asserts):

```js
assert.ok(MESSAGES.de.sections.gamesTitle);
assert.ok(MESSAGES.en.sections.gamesDescription);
assert.ok(MESSAGES.de.games.kader.title);
```

(If the file asserts via `t(...)` instead of a `MESSAGES` object, follow its existing pattern for `sections.rivalriesDescription`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_router.test.mjs tests/web_view_config.test.mjs tests/web_shell.test.mjs tests/web_i18n.test.mjs`
Expected: FAIL (`gameRouteHash` not exported, games group missing, markup missing, i18n keys missing).

- [ ] **Step 3: Implement view_config.js**

Insert after the `duels` group in `VIEW_GROUPS`:

```js
  {
    id: "games",
    labelKey: "navGroups.games",
    defaultView: "games",
    views: ["games"],
    detailViews: ["game"],
  },
```

And export next to the other exports:

```js
export const GAME_IDS = ["kader-raten", "tipp-spiel", "klick-duell", "quizshow"];
```

- [ ] **Step 4: Implement router.js**

Import `GAME_IDS` (extend the existing import from `./view_config.js`). Insert after the `rivalitaet` block in `parseRouteHash`:

```js
  if (parts[0] === "spiel") {
    if (parts[1] && GAME_IDS.includes(parts[1])) {
      return { view: "game", personKey: null, gameKey: parts[1] };
    }
    return { view: "games", personKey: null };
  }
```

Append below `rivalryRouteHash`:

```js
export function gameRouteHash(gameId) {
  return `#/spiel/${encodeURIComponent(gameId)}`;
}
```

- [ ] **Step 5: Implement index.html shells**

Nav group button after the `duels` button:

```html
        <button class="nav-group-tab" type="button" data-view-group="games" data-i18n="navGroups.games">Spiele</button>
```

Subnav tab after the `oracle` tab:

```html
        <button class="tab" data-view-group="games" data-view="games" data-i18n="nav.games">Spiele</button>
```

Sections after `view-oracle` (`</section>`):

```html
      <section id="view-games" class="view">
        <div class="section-head">
          <h2 data-i18n="sections.gamesTitle">Spiele</h2>
          <p data-i18n="sections.gamesDescription">Vier kleine Spiele über die GPL-Geschichte. Alle Fragen und Auflösungen stammen aus den Archivdaten – jede Runde nennt ihre Quelle.</p>
        </div>
        <div id="games-cards" class="hof-grid"></div>
      </section>

      <section id="view-game" class="view">
        <p class="rivalry-back"><a class="link-button" href="#/games" data-i18n="games.backToHub">← Zur Spiele-Übersicht</a></p>
        <div class="section-head">
          <h2 id="game-title"></h2>
          <p id="game-description"></p>
        </div>
        <div id="game-body"></div>
      </section>
```

(`.rivalry-back` is the existing back-link style; reusing it keeps detail views consistent.)

- [ ] **Step 6: Implement i18n.js strings**

In the `de` tree (mirror every key in `en`; en values in parentheses):

- `navGroups.games`: `"Spiele"` (en `"Games"`)
- `nav.games`: `"Spiele"` (`"Games"`)
- `sections.gamesTitle`: `"Spiele"` (`"Games"`)
- `sections.gamesDescription`: `"Vier kleine Spiele über die GPL-Geschichte. Alle Fragen und Auflösungen stammen aus den Archivdaten – jede Runde nennt ihre Quelle."` (`"Four small games about GPL history. Every question and reveal comes from the archive data – each round cites its source."`)
- `games.backToHub`: `"← Zur Spiele-Übersicht"` (`"← Back to games"`)
- `games.play`: `"Spielen"` (`"Play"`)
- `games.sourceTitle`: `"Quelle"` (`"Source"`)
- `games.correct`: `"Richtig!"` (`"Correct!"`)
- `games.wrong`: `"Falsch!"` (`"Wrong!"`)
- `games.next`: `"Nächste Runde"` (`"Next round"`)
- `games.kader.title`: `"Kader-Raten"` (`"Roster Riddle"`)
- `games.kader.description`: `"Jeden Tag ein Kader – errate die Person hinter dem Team, Sprite für Sprite."` (`"One roster per day – guess the person behind the team, sprite by sprite."`)
- `games.tipp.title`: `"Tipp-Spiel"` (`"Prediction Game"`)
- `games.tipp.description`: `"Tippe historische Matches und schlage die Elo-Prognose."` (`"Predict historic matches and beat the Elo forecast."`)
- `games.klick.title`: `"Klick-Duell"` (`"Click Battle"`)
- `games.klick.description`: `"Welches Video hat mehr Aufrufe? Höher oder tiefer."` (`"Which video has more views? Higher or lower."`)
- `games.quiz.title`: `"GPL-Quizshow"` (`"GPL Quiz Show"`)
- `games.quiz.description`: `"Multiple Choice quer durch Champions, Tabellen, Killlisten und Duelle."` (`"Multiple choice across champions, standings, kill lists and head-to-heads."`)

(Game-specific strings beyond the hub cards are added in Tasks 4–7 with their features.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/web_router.test.mjs tests/web_view_config.test.mjs tests/web_shell.test.mjs tests/web_i18n.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/view_config.js web/router.js web/index.html web/i18n.js tests/web_router.test.mjs tests/web_view_config.test.mjs tests/web_shell.test.mjs tests/web_i18n.test.mjs
git commit -m "Add games group with hub and routed game detail shells"
```

---

### Task 2: `web/games.js` core utilities (seeded RNG, shuffle, daily streak)

**Files:**
- Create: `web/games.js`
- Test: `tests/web_games.test.mjs`

**Interfaces:**
- Produces: `seededRandom(seedString) => () => number` (deterministic, [0,1)), `pickIndex(rng, length) => number`, `shuffled(items, rng) => any[]` (new array, input untouched), `dateSeedString(date = new Date()) => "YYYY-MM-DD"` (local time), `updateDailyStreak(prev, dateString, solved) => { streak, best, lastDate }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/web_games.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
  dateSeedString,
  pickIndex,
  seededRandom,
  shuffled,
  updateDailyStreak,
} from "../web/games.js";

test("seededRandom is deterministic per seed and differs across seeds", () => {
  const a1 = seededRandom("2026-08-10");
  const a2 = seededRandom("2026-08-10");
  const b = seededRandom("2026-08-11");
  const seqA1 = [a1(), a1(), a1()];
  const seqA2 = [a2(), a2(), a2()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA1, seqA2);
  assert.notDeepEqual(seqA1, seqB);
  for (const value of seqA1) {
    assert.ok(value >= 0 && value < 1);
  }
});

test("pickIndex stays in range and shuffled permutes without mutating", () => {
  const rng = seededRandom("pick");
  for (let i = 0; i < 50; i += 1) {
    const index = pickIndex(rng, 7);
    assert.ok(Number.isInteger(index) && index >= 0 && index < 7);
  }
  const input = ["a", "b", "c", "d", "e"];
  const result = shuffled(input, seededRandom("shuffle"));
  assert.deepEqual(input, ["a", "b", "c", "d", "e"]);
  assert.deepEqual([...result].sort(), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(result, shuffled(input, seededRandom("shuffle")));
});

test("dateSeedString formats a local YYYY-MM-DD", () => {
  assert.equal(dateSeedString(new Date(2026, 7, 10, 23, 59)), "2026-08-10");
  assert.equal(dateSeedString(new Date(2026, 0, 5)), "2026-01-05");
});

test("updateDailyStreak increments on consecutive days and resets on gaps or losses", () => {
  const start = updateDailyStreak(null, "2026-08-10", true);
  assert.deepEqual(start, { streak: 1, best: 1, lastDate: "2026-08-10" });
  const next = updateDailyStreak(start, "2026-08-11", true);
  assert.deepEqual(next, { streak: 2, best: 2, lastDate: "2026-08-11" });
  // Same day again: no double counting.
  assert.deepEqual(updateDailyStreak(next, "2026-08-11", true), next);
  // A gap starts over at 1 but keeps the best.
  assert.deepEqual(updateDailyStreak(next, "2026-08-14", true), { streak: 1, best: 2, lastDate: "2026-08-14" });
  // A loss zeroes the streak and keeps the best.
  assert.deepEqual(updateDailyStreak(next, "2026-08-12", false), { streak: 0, best: 2, lastDate: "2026-08-12" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_games.test.mjs`
Expected: FAIL (`Cannot find module '../web/games.js'`).

- [ ] **Step 3: Implement `web/games.js`**

```js
// Shared game utilities: deterministic daily puzzles need a seedable RNG
// (mulberry32 over a string hash) so every visitor sees the same puzzle on
// the same day, and streaks survive reloads via plain serializable state.

export function seededRandom(seedString) {
  const text = String(seedString ?? "");
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(rng, length) {
  if (!length) return -1;
  return Math.min(length - 1, Math.floor(rng() * length));
}

export function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function dateSeedString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function previousDateString(dateString) {
  const parsed = Date.parse(`${dateString}T00:00:00Z`);
  return new Date(parsed - DAY_MS).toISOString().slice(0, 10);
}

export function updateDailyStreak(prev, dateString, solved) {
  const state = prev && typeof prev === "object" ? prev : { streak: 0, best: 0, lastDate: "" };
  if (state.lastDate === dateString) {
    return state;
  }
  if (!solved) {
    return { streak: 0, best: state.best || 0, lastDate: dateString };
  }
  const streak = state.lastDate === previousDateString(dateString) ? (state.streak || 0) + 1 : 1;
  return { streak, best: Math.max(state.best || 0, streak), lastDate: dateString };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_games.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/games.js tests/web_games.test.mjs
git commit -m "Add seeded RNG, shuffle, and daily streak game utilities"
```

---

### Task 3: Games hub renderer + game dispatch plumbing in app.js

**Files:**
- Modify: `web/app.js` (imports, `VIEW_DATASETS`, `VIEW_RENDERERS`, `state`, `applyRouteFromHash`, `TOOLBAR_HIDDEN_VIEWS`, hub + dispatch renderers, storage helpers)
- Modify: `web/styles.css` (`.game-card`, `.game-reveal`)
- Test: `tests/web_shell.test.mjs`, `tests/web_loading.test.mjs`

**Interfaces:**
- Consumes: `gameRouteHash` (router), `GAME_IDS` (view_config), Task 2 utilities.
- Produces: `renderGames()`, `renderGame()` registered in `VIEW_RENDERERS`; `state.gameFocus = { key } | null`; `state.games = {}` (per-game session state, keyed by game id, survives re-renders within the session); `readGameJson(key, fallback)` / `saveGameJson(key, value)` storage helpers; `gameRevealCard({ title, bodyHtml, sourceUrls })` shared reveal HTML; per-game renderer registry `GAME_RENDERERS` (filled by Tasks 4–7, starts with placeholders rendering an empty note is NOT allowed — this task registers the four functions as stubs that Tasks 4–7 replace; the stubs render the hub-card description so the page is never blank).

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_shell.test.mjs` (the file asserts against `web/app.js` source text; reuse its source variable, e.g. `appSource`):

```js
test("app.js registers the games hub and game dispatch", () => {
  assert.ok(appSource.includes("games: renderGames"));
  assert.ok(appSource.includes('"game": renderGame') || appSource.includes("game: renderGame"));
  assert.ok(appSource.includes("state.gameFocus"));
  assert.ok(appSource.includes("gameRevealCard"));
  assert.ok(appSource.includes('"games", "game"') || /TOOLBAR_HIDDEN_VIEWS = new Set\(\[[^\]]*"game"/.test(appSource));
});
```

Append to `tests/web_loading.test.mjs` (follow its existing per-view dataset asserts):

```js
assert.deepEqual(VIEW_DATASETS.games, []);
assert.deepEqual(VIEW_DATASETS.game, ["teamRosters", "videos", "matchupSummary", "matchVideos"]);
```

(If `VIEW_DATASETS` is not exported, follow the file's existing technique for the rivalries/oracle asserts — it reads app.js source text; then assert the literal lines `games: [],` and `game: ["teamRosters", "videos", "matchupSummary", "matchVideos"],` appear.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_shell.test.mjs tests/web_loading.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement app.js plumbing**

1. Extend the router import with `gameRouteHash`; extend the view_config import with `GAME_IDS`. Add:

```js
import { dateSeedString, pickIndex, seededRandom, shuffled, updateDailyStreak } from "./games.js";
```

(Later tasks extend this import list; keep it one alphabetized import.)

2. `VIEW_DATASETS` additions:

```js
  games: [],
  game: ["teamRosters", "videos", "matchupSummary", "matchVideos"],
```

3. `state` additions (near `rivalryFocus` / `oracle`):

```js
  gameFocus: null,
  games: {},
```

4. `applyRouteFromHash`: add a `route.gameKey` branch after the `route.rivalryKey` branch, and add `state.gameFocus = null;` to every other focus branch (person, season, pokemon, roster, rivalry, final else):

```js
  } else if (route.gameKey) {
    state.personFocus = null;
    state.pokemonFocus = null;
    state.rosterFocus = null;
    state.rivalryFocus = null;
    state.gameFocus = { key: route.gameKey };
    state.season = "all";
    state.autoSeasonDefault = false;
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  }
```

5. `TOOLBAR_HIDDEN_VIEWS`: add `"games", "game"` (games ignore the global season/data-mode toolbar) and extend the comment above it with: games manage their own per-round state.

6. `VIEW_RENDERERS` additions:

```js
  games: renderGames,
  game: renderGame,
```

7. Storage helpers next to `readPreference`/`savePreference`:

```js
function readGameJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveGameJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is optional; streaks just reset in private browsing.
  }
}
```

8. Shared reveal card + hub/dispatch renderers (place near `renderRivalries`):

```js
const GAME_HUB_CARDS = [
  { id: "kader-raten", i18nKey: "kader" },
  { id: "tipp-spiel", i18nKey: "tipp" },
  { id: "klick-duell", i18nKey: "klick" },
  { id: "quizshow", i18nKey: "quiz" },
];

function gameRevealCard({ title, bodyHtml, sourceUrls }) {
  const sources = sourceUrls
    ? `<p class="game-reveal-sources"><strong>${escapeHtml(t(state.language, "games.sourceTitle"))}:</strong> ${sourceLinks(sourceUrls)}</p>`
    : "";
  return `
    <div class="game-reveal standalone-card">
      <h4>${escapeHtml(title)}</h4>
      ${bodyHtml}
      ${sources}
    </div>`;
}

function renderGames() {
  const container = document.querySelector("#games-cards");
  if (!container) return;
  container.innerHTML = GAME_HUB_CARDS.map(
    (card) => `
      <article class="hof-card game-card">
        <div class="highlight-card-head">
          <h3>${escapeHtml(t(state.language, `games.${card.i18nKey}.title`))}</h3>
        </div>
        <p>${escapeHtml(t(state.language, `games.${card.i18nKey}.description`))}</p>
        <p><a class="link-button" href="${escapeAttr(gameRouteHash(card.id))}">${escapeHtml(t(state.language, "games.play"))}</a></p>
      </article>`,
  ).join("");
}

const GAME_RENDERERS = {
  "kader-raten": renderKaderRaten,
  "tipp-spiel": renderTippSpiel,
  "klick-duell": renderKlickDuell,
  quizshow: renderQuizshow,
};

const GAME_I18N_BY_ID = {
  "kader-raten": "kader",
  "tipp-spiel": "tipp",
  "klick-duell": "klick",
  quizshow: "quiz",
};

function renderGame() {
  const gameId = state.gameFocus?.key || "";
  const renderer = GAME_RENDERERS[gameId];
  const body = document.querySelector("#game-body");
  if (!renderer || !body) {
    navigateToView("games");
    return;
  }
  const i18nKey = GAME_I18N_BY_ID[gameId];
  document.querySelector("#game-title").textContent = t(state.language, `games.${i18nKey}.title`);
  document.querySelector("#game-description").textContent = t(state.language, `games.${i18nKey}.description`);
  renderer(body);
}
```

For this task, add the four per-game renderers as stubs that Tasks 4–7 replace with real implementations:

```js
function renderKaderRaten(body) {
  body.innerHTML = `<p class="empty-note">${escapeHtml(t(state.language, "games.kader.description"))}</p>`;
}
```

(and the analogous three; `empty-note` is the existing empty-state class — if the codebase uses a different class for empty notes, e.g. `muted-note`, match the class used by `renderRivalries`' empty state.)

9. `styles.css` additions (near the `.rivalry-card` rules):

```css
.game-card p {
  margin: 8px 0;
}

.game-reveal h4 {
  margin: 0 0 8px;
}

.game-reveal-sources {
  margin: 10px 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_shell.test.mjs tests/web_loading.test.mjs tests/web_router.test.mjs`
Expected: PASS.

- [ ] **Step 5: Smoke-test in the browser**

With `python scripts/serve.py 8010` running: open `http://localhost:8010/web/#/games` — hub shows four cards; clicking "Spielen" routes to `#/spiel/<id>` showing title + description stub; toolbar filters are hidden; back link returns to the hub. (After hash-only navigation in an existing tab, force `window.location.reload()` to pick up new modules.)

- [ ] **Step 6: Commit**

```bash
git add web/app.js web/styles.css tests/web_shell.test.mjs tests/web_loading.test.mjs
git commit -m "Wire games hub view and routed game dispatch"
```

---

### Task 4: Kader-Raten (daily roster puzzle)

**Files:**
- Modify: `web/games.js` (pools, daily selection, hints)
- Modify: `web/app.js` (`renderKaderRaten` real implementation)
- Modify: `web/i18n.js`, `web/styles.css`
- Test: `tests/web_games.test.mjs`

**Interfaces:**
- Consumes: `seededRandom`, `pickIndex`, `shuffled`, `dateSeedString`, `updateDailyStreak` (Task 2); app.js helpers `pokemonSprite(name)`, `rosterGroupKeyFromRow(row)`, `rosterRouteHash(key)`, `seasonDisplay(seasonId)`, `normalizedKey` (app.js' normalize helper used with chronology — the same one passed to `rivalryPairs`).
- Produces (games.js): `kaderPools(rosterRows, normalizeKey, minPokemon = 6) => [{ poolKey, seasonId, division, personName, personKey, teamName, pokemon: string[], sourceUrls, sampleRow }]` sorted by `poolKey`; `dailyKader(pools, dateString) => { pool, revealOrder: number[] } | null`; `kaderHintValues(pool, standingsRows, normalizeKey) => { division, rank, seasonId }`.
- localStorage: `gpl-game-kader-raten-day` = `{ date, wrongGuesses, guessedKeys: string[], solved, failed }`, `gpl-game-kader-raten-streak` = `{ streak, best, lastDate }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_games.test.mjs`:

```js
import { dailyKader, kaderHintValues, kaderPools } from "../web/games.js";

const norm = (value) => String(value ?? "").toLowerCase().trim();

const ROSTER_ROWS = [
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Glurak", slot: "1", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Bisaflor", slot: "2", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Turtok", slot: "3", source_urls: "https://sheet/b" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Relaxo", slot: "4", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Dragoran", slot: "5", source_urls: "" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Gengar", slot: "6", source_urls: "" },
  // Duplicate pokemon from a second roster phase must dedupe.
  { season_id: "season_009", division: "Singles", person_name: "Bene", pokemon: "Glurak", slot: "1", source_urls: "" },
  // Too-small roster is excluded.
  { season_id: "season_009", division: "Singles", person_name: "Mini", pokemon: "Pikachu", slot: "1", source_urls: "" },
  // Rows without a pokemon or person are skipped.
  { season_id: "season_009", division: "Singles", person_name: "", pokemon: "Ditto", slot: "1", source_urls: "" },
];

test("kaderPools groups, dedupes, and filters small rosters", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  assert.equal(pools.length, 1);
  const pool = pools[0];
  assert.equal(pool.personName, "Bene");
  assert.equal(pool.personKey, "bene");
  assert.equal(pool.seasonId, "season_009");
  assert.deepEqual(pool.pokemon, ["Glurak", "Bisaflor", "Turtok", "Relaxo", "Dragoran", "Gengar"]);
  assert.ok(pool.sourceUrls.includes("https://sheet/a"));
  assert.ok(pool.sourceUrls.includes("https://sheet/b"));
  assert.ok(pool.sampleRow);
});

test("dailyKader picks deterministically per date and permutes the reveal order", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  const one = dailyKader(pools, "2026-08-10");
  const two = dailyKader(pools, "2026-08-10");
  assert.deepEqual(one, two);
  assert.equal(one.pool.poolKey, pools[0].poolKey);
  assert.deepEqual([...one.revealOrder].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(dailyKader([], "2026-08-10"), null);
});

test("kaderHintValues resolves division, final rank and season", () => {
  const standings = [
    { season_id: "season_009", division: "Singles", stage: "final_table", is_primary: "true", rank: "3", player_name: "Bene" },
    { season_id: "season_009", division: "Singles", stage: "regular_season", is_primary: "true", rank: "5", player_name: "Bene" },
  ];
  const pool = kaderPools(ROSTER_ROWS, norm)[0];
  assert.deepEqual(kaderHintValues(pool, standings, norm), { division: "Singles", rank: "3", seasonId: "season_009" });
  assert.deepEqual(kaderHintValues(pool, [], norm), { division: "Singles", rank: "", seasonId: "season_009" });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_games.test.mjs`
Expected: FAIL (`kaderPools` not exported).

- [ ] **Step 3: Implement the pure functions in games.js**

```js
// Kader-Raten: one deterministic daily puzzle. Pools are sorted by key so
// the seeded pick is stable across visitors regardless of CSV row order.
export function kaderPools(rosterRows = [], normalizeKey, minPokemon = 6) {
  const byKey = new Map();
  for (const row of rosterRows) {
    const personKey = normalizeKey(row.person_name);
    const pokemon = String(row.pokemon || "").trim();
    if (!personKey || !pokemon || !row.season_id) continue;
    const poolKey = `${row.season_id}__${row.division || ""}__${personKey}`;
    let pool = byKey.get(poolKey);
    if (!pool) {
      pool = {
        poolKey,
        seasonId: row.season_id,
        division: row.division || "",
        personName: row.person_name,
        personKey,
        teamName: row.team_name || "",
        pokemon: [],
        pokemonKeys: new Set(),
        sourceUrls: new Set(),
        sampleRow: row,
      };
      byKey.set(poolKey, pool);
    }
    const pokemonKey = normalizeKey(pokemon);
    if (!pool.pokemonKeys.has(pokemonKey)) {
      pool.pokemonKeys.add(pokemonKey);
      pool.pokemon.push(pokemon);
    }
    for (const url of String(row.source_urls || "").split(";")) {
      if (url.trim()) pool.sourceUrls.add(url.trim());
    }
  }
  return [...byKey.values()]
    .filter((pool) => pool.pokemon.length >= minPokemon)
    .map(({ pokemonKeys, sourceUrls, ...pool }) => ({ ...pool, sourceUrls: [...sourceUrls].join(";") }))
    .sort((a, b) => a.poolKey.localeCompare(b.poolKey));
}

export function dailyKader(pools, dateString) {
  if (!pools.length) return null;
  const rng = seededRandom(`kader-${dateString}`);
  const pool = pools[pickIndex(rng, pools.length)];
  const revealOrder = shuffled(pool.pokemon.map((_, index) => index), rng);
  return { pool, revealOrder };
}

export function kaderHintValues(pool, standingsRows = [], normalizeKey) {
  const finalRow = standingsRows.find(
    (row) =>
      row.season_id === pool.seasonId &&
      (row.division || "") === pool.division &&
      String(row.is_primary) === "true" &&
      row.stage === "final_table" &&
      normalizeKey(row.player_name) === pool.personKey,
  );
  return { division: pool.division, rank: finalRow ? String(finalRow.rank ?? "") : "", seasonId: pool.seasonId };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_games.test.mjs`
Expected: PASS.

- [ ] **Step 5: Implement `renderKaderRaten` in app.js**

Replace the Task 3 stub. Game rules (fixed here): sprite 1 is visible from the start; each wrong guess reveals the next sprite in `revealOrder` and unlocks hints in order division → rank → season (wrong guess 1/2/3); the game ends in defeat after 6 wrong guesses (or when the roster runs out of unrevealed sprites, whichever is later never applies — cap stays 6); solving or failing writes the daily streak.

```js
function renderKaderRaten(body) {
  const rosterRows = state.data.teamRosters || [];
  const pools = cachedKaderPools(rosterRows);
  const today = dateSeedString();
  const daily = dailyKader(pools, today);
  if (!daily) {
    body.innerHTML = `<p class="empty-note">${escapeHtml(t(state.language, "games.kader.empty"))}</p>`;
    return;
  }
  let day = readGameJson("gpl-game-kader-raten-day", null);
  if (!day || day.date !== today) {
    day = { date: today, wrongGuesses: 0, guessedKeys: [], solved: false, failed: false };
  }
  const streak = readGameJson("gpl-game-kader-raten-streak", { streak: 0, best: 0, lastDate: "" });
  const finished = day.solved || day.failed;
  const revealCount = finished ? daily.pool.pokemon.length : Math.min(day.wrongGuesses + 1, daily.pool.pokemon.length);
  const hints = kaderHintValues(daily.pool, state.data.standings || [], normalizedKey);
  const hintItems = [
    day.wrongGuesses >= 1 || finished ? formatMessage(t(state.language, "games.kader.hintDivision"), { division: hints.division }) : "",
    (day.wrongGuesses >= 2 || finished) && hints.rank ? formatMessage(t(state.language, "games.kader.hintRank"), { rank: hints.rank }) : "",
    day.wrongGuesses >= 3 || finished ? formatMessage(t(state.language, "games.kader.hintSeason"), { season: seasonDisplay(hints.seasonId) }) : "",
  ].filter(Boolean);
  const options = [...new Set(pools.map((pool) => pool.personName))].sort((a, b) => a.localeCompare(b));
  const sprites = daily.revealOrder
    .map((pokemonIndex, position) =>
      position < revealCount
        ? `<span class="game-kader-slot">${pokemonSprite(daily.pool.pokemon[pokemonIndex])}</span>`
        : `<span class="game-kader-slot game-kader-hidden" aria-hidden="true">?</span>`,
    )
    .join("");
  const solutionCard = finished
    ? gameRevealCard({
        title: day.solved
          ? formatMessage(t(state.language, "games.kader.solved"), { n: day.wrongGuesses + 1 })
          : formatMessage(t(state.language, "games.kader.failed"), { name: daily.pool.personName }),
        bodyHtml: `<p>${personLink(canonicalPersonRouteKey(daily.pool.personName), daily.pool.personName)} · ${escapeHtml(daily.pool.teamName)} · ${escapeHtml(seasonDisplay(daily.pool.seasonId))}</p>
          <p><a class="link-button" href="${escapeAttr(rosterRouteHash(rosterGroupKeyFromRow(daily.pool.sampleRow)))}">${escapeHtml(t(state.language, "games.kader.rosterLink"))}</a></p>`,
        sourceUrls: daily.pool.sourceUrls,
      })
    : "";
  body.innerHTML = `
    <p>${escapeHtml(t(state.language, "games.kader.prompt"))}</p>
    <div class="game-sprite-row">${sprites}</div>
    ${hintItems.length ? `<ul class="game-hints">${hintItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    ${
      finished
        ? solutionCard
        : `<form id="kader-form" class="game-form">
            <select id="kader-guess">
              <option value="">${escapeHtml(t(state.language, "games.kader.placeholder"))}</option>
              ${options.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`).join("")}
            </select>
            <button class="link-button" type="submit">${escapeHtml(t(state.language, "games.kader.guess"))}</button>
          </form>
          <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.kader.tries"), { used: day.wrongGuesses, max: 6 }))}</p>`
    }
    <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.kader.streak"), { streak: streak.streak, best: streak.best }))}</p>`;
  document.querySelector("#kader-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const guess = document.querySelector("#kader-guess")?.value || "";
    if (!guess) return;
    const guessKey = normalizedKey(guess);
    if (day.guessedKeys.includes(guessKey)) return;
    day.guessedKeys.push(guessKey);
    if (guessKey === daily.pool.personKey) {
      day.solved = true;
      saveGameJson("gpl-game-kader-raten-streak", updateDailyStreak(streak, today, true));
    } else {
      day.wrongGuesses += 1;
      if (day.wrongGuesses >= 6) {
        day.failed = true;
        saveGameJson("gpl-game-kader-raten-streak", updateDailyStreak(streak, today, false));
      }
    }
    saveGameJson("gpl-game-kader-raten-day", day);
    renderGame();
  });
}
```

Add a memo (next to the other `cached*` helpers):

```js
let kaderPoolsCache = null;
function cachedKaderPools(rosterRows) {
  if (!kaderPoolsCache || kaderPoolsCache.rows !== rosterRows) {
    kaderPoolsCache = { rows: rosterRows, pools: kaderPools(rosterRows, normalizedKey) };
  }
  return kaderPoolsCache.pools;
}
```

Extend the games.js import in app.js with `dailyKader, kaderHintValues, kaderPools`. `normalizedKey` is app.js' existing normalize helper (the one already passed to `rivalryPairs`/`winChainGraph` — reuse exactly that identifier).

i18n additions (de, with en mirrors):

- `games.kader.prompt`: `"Wessen Kader ist das? Jeden Tag ein neues Rätsel."` (`"Whose roster is this? A new riddle every day."`)
- `games.kader.placeholder`: `"Person auswählen"` (`"Pick a person"`)
- `games.kader.guess`: `"Raten"` (`"Guess"`)
- `games.kader.tries`: `"Fehlversuche: {used} / {max}"` (`"Wrong guesses: {used} / {max}"`)
- `games.kader.hintDivision`: `"Liga: {division}"` (`"Division: {division}"`)
- `games.kader.hintRank`: `"Endplatzierung: {rank}"` (`"Final rank: {rank}"`)
- `games.kader.hintSeason`: `"Saison: {season}"` (`"Season: {season}"`)
- `games.kader.solved`: `"Gelöst mit Versuch {n}!"` (`"Solved on try {n}!"`)
- `games.kader.failed`: `"Verloren – das war der Kader von {name}."` (`"Out of guesses – that was {name}'s roster."`)
- `games.kader.rosterLink`: `"Zum Kader"` (`"View roster"`)
- `games.kader.streak`: `"Tages-Serie: {streak} · Rekord: {best}"` (`"Daily streak: {streak} · Best: {best}"`)
- `games.kader.empty`: `"Keine Kaderdaten geladen."` (`"No roster data loaded."`)

styles.css:

```css
.game-sprite-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.game-kader-slot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  min-height: 56px;
}

.game-kader-hidden {
  border: 1px dashed var(--muted);
  border-radius: 8px;
  color: var(--muted);
  font-size: 1.4rem;
}

.game-form {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 12px 0;
  flex-wrap: wrap;
}

.game-hints {
  margin: 8px 0;
  padding-left: 20px;
}

.game-status {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 6px 0;
}
```

- [ ] **Step 6: Run tests and verify in the browser**

Run: `node --test tests/web_games.test.mjs tests/web_shell.test.mjs tests/web_i18n.test.mjs`
Expected: PASS.

Browser (`#/spiel/kader-raten`, reload): one sprite visible + hidden slots; a wrong guess reveals sprite 2 and the division hint; solving shows the reveal card with person link, roster link and sources; reloading keeps today's finished state; localStorage shows `gpl-game-kader-raten-day` and `-streak` keys.

- [ ] **Step 7: Commit**

```bash
git add web/games.js web/app.js web/i18n.js web/styles.css tests/web_games.test.mjs
git commit -m "Add Kader-Raten daily roster puzzle"
```

---

### Task 5: Tipp-Spiel (you vs. Elo)

**Files:**
- Modify: `web/games.js` (candidates + round picker)
- Modify: `web/app.js` (`renderTippSpiel`)
- Modify: `web/i18n.js`, `web/styles.css` (only if a new element needs it — prefer existing classes)
- Test: `tests/web_games.test.mjs`

**Interfaces:**
- Consumes: `cachedFullEloChronology()` (app.js, full-archive Elo; `perMatch.get(matchId).winProbA`), `videoLinksForMatch(matchId)`, `pokemonSprite`, `personLink`, `canonicalPersonRouteKey`, `seasonShortDisplay`.
- Produces (games.js): `tippCandidates(matches, normalizeKey) => rows` (decided, scored, non-forfeit matches), `pickTippRound(candidates, rng) => row | null`.
- localStorage: `gpl-game-tipp-spiel-score` = `{ you: number, elo: number, rounds: number }`.
- Session state: `state.games["tipp-spiel"] = { matchId, picked: "a" | "b" | "" }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_games.test.mjs`:

```js
import { pickTippRound, tippCandidates } from "../web/games.js";

test("tippCandidates keeps only decided, scored, non-forfeit matches", () => {
  const matches = [
    { match_id: "m1", player_a: "A", player_b: "B", score_a: "4", score_b: "2", winner: "A", result_basis: "two_sided_score" },
    // Forfeits and unresolved results are not guessable games.
    { match_id: "m2", player_a: "A", player_b: "B", score_a: "6", score_b: "0", winner: "A", result_basis: "forfeit_win" },
    { match_id: "m3", player_a: "A", player_b: "B", score_a: "", score_b: "", winner: "A", result_basis: "unresolved_conflict" },
    // Draws have no winner to pick.
    { match_id: "m4", player_a: "A", player_b: "B", score_a: "3", score_b: "3", winner: "", result_basis: "two_sided_score" },
    // Missing scores make the reveal empty.
    { match_id: "m5", player_a: "A", player_b: "B", score_a: "", score_b: "2", winner: "B", result_basis: "one_sided_score" },
    { match_id: "m6", player_a: "A", player_b: "", score_a: "4", score_b: "2", winner: "A", result_basis: "two_sided_score" },
  ];
  const candidates = tippCandidates(matches, norm);
  assert.deepEqual(candidates.map((row) => row.match_id), ["m1"]);
});

test("pickTippRound picks deterministically with a seeded rng", () => {
  const candidates = [{ match_id: "m1" }, { match_id: "m2" }, { match_id: "m3" }];
  const first = pickTippRound(candidates, seededRandom("round-1"));
  assert.ok(candidates.includes(first));
  assert.equal(pickTippRound(candidates, seededRandom("round-1")), first);
  assert.equal(pickTippRound([], seededRandom("x")), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_games.test.mjs`
Expected: FAIL (`tippCandidates` not exported).

- [ ] **Step 3: Implement the pure functions in games.js**

```js
// Tipp-Spiel: forfeits and unresolved results are excluded the same way the
// oracle skips them — there was no playable game to predict.
const TIPP_SKIPPED_BASIS = /forfeit|unresolved/;

export function tippCandidates(matches = [], normalizeKey) {
  return matches.filter((row) => {
    if (!row.player_a || !row.player_b) return false;
    if (TIPP_SKIPPED_BASIS.test(String(row.result_basis || ""))) return false;
    if (String(row.score_a ?? "") === "" || String(row.score_b ?? "") === "") return false;
    const winnerKey = normalizeKey(row.winner);
    return winnerKey === normalizeKey(row.player_a) || winnerKey === normalizeKey(row.player_b);
  });
}

export function pickTippRound(candidates = [], rng) {
  if (!candidates.length) return null;
  return candidates[pickIndex(rng, candidates.length)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_games.test.mjs`
Expected: PASS.

- [ ] **Step 5: Implement `renderTippSpiel` in app.js**

Replace the stub. Behavior: each round shows season/matchday/division and the two players with up to six roster sprites each (from `teamRosters` rows matching `season_id` + normalized person name, slot-sorted); score and winner stay hidden until the user picks a side; the reveal card shows the actual score, the winner, the Elo forecast ("Elo-Prognose: X %"), whether the user and Elo were right, video links, and the match's `source_urls`; a running you-vs-Elo tally persists in localStorage. Rounds are seeded by `dateSeedString() + round counter` so a session is reproducible but each "Nächste Runde" differs.

```js
function renderTippSpiel(body) {
  const chronology = cachedFullEloChronology();
  const candidates = cachedTippCandidates().filter((row) => chronology.perMatch.has(row.match_id));
  if (!candidates.length) {
    body.innerHTML = `<p class="empty-note">${escapeHtml(t(state.language, "games.tipp.empty"))}</p>`;
    return;
  }
  const tally = readGameJson("gpl-game-tipp-spiel-score", { you: 0, elo: 0, rounds: 0 });
  let round = state.games["tipp-spiel"];
  if (!round || !candidates.some((row) => row.match_id === round.matchId)) {
    const rng = seededRandom(`tipp-${dateSeedString()}-${tally.rounds}`);
    round = { matchId: pickTippRound(candidates, rng).match_id, picked: "" };
    state.games["tipp-spiel"] = round;
  }
  const match = candidates.find((row) => row.match_id === round.matchId);
  const entry = chronology.perMatch.get(match.match_id);
  const winnerIsA = normalizedKey(match.winner) === normalizedKey(match.player_a);
  const eloPickA = entry.winProbA >= 0.5;
  const spriteRow = (personName) => {
    const rows = (state.data.teamRosters || [])
      .filter((row) => row.season_id === match.season_id && normalizedKey(row.person_name) === normalizedKey(personName))
      .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
    const seen = new Set();
    const sprites = [];
    for (const row of rows) {
      const key = normalizedKey(row.pokemon);
      if (!row.pokemon || seen.has(key)) continue;
      seen.add(key);
      sprites.push(pokemonSprite(row.pokemon));
      if (sprites.length >= 6) break;
    }
    return sprites.length ? `<div class="game-sprite-row">${sprites.join("")}</div>` : "";
  };
  const header = `<p>${escapeHtml(seasonShortDisplay(match.season_id))} · ${escapeHtml(match.week || "")} · ${escapeHtml(match.division || "")}</p>`;
  if (!round.picked) {
    body.innerHTML = `
      ${header}
      <p>${escapeHtml(t(state.language, "games.tipp.prompt"))}</p>
      <div class="game-tipp-choices">
        <button class="link-button" type="button" data-tipp-pick="a">${escapeHtml(match.player_a)}</button>
        <span class="game-tipp-vs">vs.</span>
        <button class="link-button" type="button" data-tipp-pick="b">${escapeHtml(match.player_b)}</button>
      </div>
      ${spriteRow(match.player_a)}
      ${spriteRow(match.player_b)}
      <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.tipp.tally"), { you: tally.you, elo: tally.elo, rounds: tally.rounds }))}</p>`;
    body.querySelectorAll("[data-tipp-pick]").forEach((button) => {
      button.addEventListener("click", () => {
        round.picked = button.dataset.tippPick;
        const youRight = (round.picked === "a") === winnerIsA;
        const eloRight = eloPickA === winnerIsA;
        saveGameJson("gpl-game-tipp-spiel-score", {
          you: tally.you + (youRight ? 1 : 0),
          elo: tally.elo + (eloRight ? 1 : 0),
          rounds: tally.rounds + 1,
        });
        renderGame();
      });
    });
    return;
  }
  const youPickName = round.picked === "a" ? match.player_a : match.player_b;
  const eloPickName = eloPickA ? match.player_a : match.player_b;
  const eloPct = Math.round((eloPickA ? entry.winProbA : 1 - entry.winProbA) * 100);
  const youRight = (round.picked === "a") === winnerIsA;
  const newTally = readGameJson("gpl-game-tipp-spiel-score", tally);
  body.innerHTML = `
    ${header}
    ${gameRevealCard({
      title: youRight ? t(state.language, "games.correct") : t(state.language, "games.wrong"),
      bodyHtml: `
        <p>${escapeHtml(formatMessage(t(state.language, "games.tipp.result"), { score: `${match.score_a}:${match.score_b}`, name: match.winner }))}</p>
        <p>${escapeHtml(formatMessage(t(state.language, "games.tipp.eloSays"), { name: eloPickName, pct: eloPct }))}</p>
        <p>${escapeHtml(formatMessage(t(state.language, "games.tipp.youPicked"), { name: youPickName }))}</p>
        <p>${videoLinksForMatch(match.match_id)}</p>`,
      sourceUrls: match.source_urls,
    })}
    <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.tipp.tally"), { you: newTally.you, elo: newTally.elo, rounds: newTally.rounds }))}</p>
    <button id="tipp-next" class="link-button" type="button">${escapeHtml(t(state.language, "games.next"))}</button>`;
  body.querySelector("#tipp-next")?.addEventListener("click", () => {
    state.games["tipp-spiel"] = null;
    renderGame();
  });
}
```

Add a memo `cachedTippCandidates()` following the `cachedKaderPools` pattern (memo on `state.data.matches` identity, calling `tippCandidates(state.data.matches || [], normalizedKey)`). Extend the games.js import with `pickTippRound, tippCandidates`. Check `videoLinksForMatch`'s actual return shape at implementation time (app.js:4973) — if it returns HTML, embed as above; if it returns an array, join with `" · "` the way the ledger table does.

i18n additions (de / en):

- `games.tipp.prompt`: `"Wer gewinnt dieses Match?"` (`"Who wins this match?"`)
- `games.tipp.result`: `"Ergebnis: {score} – Sieger: {name}"` (`"Result: {score} – winner: {name}"`)
- `games.tipp.eloSays`: `"Elo-Prognose: {name} ({pct} %)"` (`"Elo forecast: {name} ({pct} %)"`)
- `games.tipp.youPicked`: `"Dein Tipp: {name}"` (`"Your pick: {name}"`)
- `games.tipp.tally`: `"Du {you} : {elo} Elo · {rounds} Runden"` (`"You {you} : {elo} Elo · {rounds} rounds"`)
- `games.tipp.empty`: `"Keine tippbaren Matches geladen."` (`"No predictable matches loaded."`)

styles.css:

```css
.game-tipp-choices {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
  flex-wrap: wrap;
}

.game-tipp-vs {
  color: var(--muted);
}
```

- [ ] **Step 6: Run tests and verify in the browser**

Run: `node --test tests/web_games.test.mjs tests/web_i18n.test.mjs tests/web_shell.test.mjs`
Expected: PASS.

Browser (`#/spiel/tipp-spiel`): no score/winner visible before picking; after picking, reveal card shows score, winner, Elo forecast with percent, video links and sources; tally increments and survives reload; "Nächste Runde" shows a different match.

- [ ] **Step 7: Commit**

```bash
git add web/games.js web/app.js web/i18n.js web/styles.css tests/web_games.test.mjs
git commit -m "Add Tipp-Spiel with Elo forecast reveal and running tally"
```

---

### Task 6: Klick-Duell (higher/lower on video views)

**Files:**
- Modify: `web/games.js` (candidates + next picker)
- Modify: `web/app.js` (`renderKlickDuell`)
- Modify: `web/i18n.js`, `web/styles.css`
- Test: `tests/web_games.test.mjs`

**Interfaces:**
- Consumes: `videos` dataset rows (`video_id`, `title`, `channel_title`, `view_count`, `source_urls`), `displayNumber` (stats.js, already imported in app.js) for formatted view counts.
- Produces (games.js): `klickCandidates(videoRows) => rows` (has `video_id`, `title`, numeric `view_count > 0`), `nextKlickIndex(candidates, currentIndex, rng) => number` (index with a different `view_count` than `candidates[currentIndex]`, or `-1`).
- localStorage: `gpl-game-klick-duell-best` = `{ best: number }`.
- Session state: `state.games["klick-duell"] = { currentIndex, nextIndex, score, revealed, over }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_games.test.mjs`:

```js
import { klickCandidates, nextKlickIndex } from "../web/games.js";

test("klickCandidates requires id, title and a positive view count", () => {
  const rows = [
    { video_id: "v1", title: "A", view_count: "1000" },
    { video_id: "v2", title: "B", view_count: "0" },
    { video_id: "", title: "C", view_count: "500" },
    { video_id: "v4", title: "", view_count: "500" },
    { video_id: "v5", title: "E", view_count: "abc" },
    { video_id: "v6", title: "F", view_count: "2000" },
  ];
  assert.deepEqual(klickCandidates(rows).map((row) => row.video_id), ["v1", "v6"]);
});

test("nextKlickIndex avoids the current video and equal view counts", () => {
  const candidates = [
    { video_id: "v1", view_count: "1000" },
    { video_id: "v2", view_count: "1000" },
    { video_id: "v3", view_count: "2000" },
  ];
  const rng = seededRandom("klick");
  for (let i = 0; i < 20; i += 1) {
    const next = nextKlickIndex(candidates, 0, rng);
    assert.equal(next, 2, "only v3 has a different view count than v1");
  }
  // No valid opponent -> -1.
  assert.equal(nextKlickIndex([{ view_count: "5" }, { view_count: "5" }], 0, seededRandom("x")), -1);
  assert.equal(nextKlickIndex([], 0, seededRandom("x")), -1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_games.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement the pure functions in games.js**

```js
// Klick-Duell: equal view counts have no right answer, so the next video
// must differ in count — resolved purely so the pick stays testable.
export function klickCandidates(videoRows = []) {
  return videoRows.filter((row) => row.video_id && row.title && Number(row.view_count) > 0);
}

export function nextKlickIndex(candidates = [], currentIndex, rng) {
  const currentCount = Number(candidates[currentIndex]?.view_count);
  const valid = candidates
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => index !== currentIndex && Number(row.view_count) !== currentCount);
  if (!valid.length) return -1;
  return valid[pickIndex(rng, valid.length)].index;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_games.test.mjs`
Expected: PASS.

- [ ] **Step 5: Implement `renderKlickDuell` in app.js**

Replace the stub. Two cards: left video with visible view count, right video with hidden count and "Mehr Aufrufe" / "Weniger Aufrufe" buttons. Correct → brief reveal state (both counts shown, "Weiter" button), then the right video becomes the left; wrong → game-over card with final streak, best-streak update, restart button. Thumbnails `https://i.ytimg.com/vi/<id>/mqdefault.jpg` with `onerror="this.hidden=true"` (text stays as fallback). Each reveal shows the winning row's `source_urls`.

```js
function renderKlickDuell(body) {
  const candidates = klickCandidates(state.data.videos || []);
  if (candidates.length < 2) {
    body.innerHTML = `<p class="empty-note">${escapeHtml(t(state.language, "games.klick.empty"))}</p>`;
    return;
  }
  let game = state.games["klick-duell"];
  if (!game) {
    const rng = seededRandom(`klick-${dateSeedString()}-${Date.now() % 100000}`);
    const currentIndex = pickIndex(rng, candidates.length);
    game = { currentIndex, nextIndex: nextKlickIndex(candidates, currentIndex, rng), score: 0, revealed: false, over: false };
    state.games["klick-duell"] = game;
  }
  const best = readGameJson("gpl-game-klick-duell-best", { best: 0 });
  const current = candidates[game.currentIndex];
  const next = candidates[game.nextIndex];
  const card = (row, showCount) => `
    <article class="game-klick-card">
      <a href="https://www.youtube.com/watch?v=${escapeAttr(row.video_id)}" target="_blank" rel="noreferrer">
        <img class="game-klick-thumb" src="https://i.ytimg.com/vi/${escapeAttr(row.video_id)}/mqdefault.jpg" alt="" loading="lazy" onerror="this.hidden=true" />
      </a>
      <h4>${escapeHtml(row.title)}</h4>
      <p class="game-status">${escapeHtml(row.channel_title || "")}</p>
      <p class="game-klick-count">${
        showCount
          ? escapeHtml(formatMessage(t(state.language, "games.klick.views"), { views: displayNumber(Number(row.view_count)) }))
          : "???"
      }</p>
    </article>`;
  if (game.over) {
    body.innerHTML = `
      ${gameRevealCard({
        title: formatMessage(t(state.language, "games.klick.gameOver"), { score: game.score }),
        bodyHtml: `<div class="game-klick-row">${card(current, true)}${card(next, true)}</div>`,
        sourceUrls: next.source_urls,
      })}
      <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.klick.best"), { best: best.best }))}</p>
      <button id="klick-restart" class="link-button" type="button">${escapeHtml(t(state.language, "games.klick.restart"))}</button>`;
    body.querySelector("#klick-restart")?.addEventListener("click", () => {
      state.games["klick-duell"] = null;
      renderGame();
    });
    return;
  }
  body.innerHTML = `
    <p>${escapeHtml(t(state.language, "games.klick.prompt"))}</p>
    <div class="game-klick-row">
      ${card(current, true)}
      ${card(next, game.revealed)}
    </div>
    ${
      game.revealed
        ? `<button id="klick-continue" class="link-button" type="button">${escapeHtml(t(state.language, "games.next"))}</button>`
        : `<div class="game-tipp-choices">
            <button class="link-button" type="button" data-klick="higher">${escapeHtml(t(state.language, "games.klick.higher"))}</button>
            <button class="link-button" type="button" data-klick="lower">${escapeHtml(t(state.language, "games.klick.lower"))}</button>
          </div>`
    }
    <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.klick.score"), { score: game.score }))} · ${escapeHtml(formatMessage(t(state.language, "games.klick.best"), { best: best.best }))}</p>`;
  body.querySelectorAll("[data-klick]").forEach((button) => {
    button.addEventListener("click", () => {
      const guessHigher = button.dataset.klick === "higher";
      const isHigher = Number(next.view_count) > Number(current.view_count);
      if (guessHigher === isHigher) {
        game.score += 1;
        game.revealed = true;
        if (game.score > best.best) {
          saveGameJson("gpl-game-klick-duell-best", { best: game.score });
        }
      } else {
        game.over = true;
        game.revealed = true;
      }
      renderGame();
    });
  });
  body.querySelector("#klick-continue")?.addEventListener("click", () => {
    const rng = seededRandom(`klick-${dateSeedString()}-${game.score}-${game.nextIndex}`);
    game.currentIndex = game.nextIndex;
    game.nextIndex = nextKlickIndex(candidates, game.currentIndex, rng);
    game.revealed = false;
    if (game.nextIndex < 0) game.over = true;
    renderGame();
  });
}
```

Note: `Date.now()` here only seeds a fresh session round (no determinism requirement across visitors for Klick-Duell — only the daily Kader-Raten must be shared); this is browser code, not a Workflow script.

Extend the games.js import with `klickCandidates, nextKlickIndex`.

i18n additions (de / en):

- `games.klick.prompt`: `"Hat das rechte Video mehr oder weniger Aufrufe?"` (`"Does the right video have more or fewer views?"`)
- `games.klick.higher`: `"Mehr Aufrufe"` (`"More views"`)
- `games.klick.lower`: `"Weniger Aufrufe"` (`"Fewer views"`)
- `games.klick.views`: `"{views} Aufrufe"` (`"{views} views"`)
- `games.klick.score`: `"Serie: {score}"` (`"Streak: {score}"`)
- `games.klick.best`: `"Rekord: {best}"` (`"Best: {best}"`)
- `games.klick.gameOver`: `"Vorbei! {score} richtige Antworten in Folge."` (`"Game over! {score} correct in a row."`)
- `games.klick.restart`: `"Neue Runde"` (`"New run"`)
- `games.klick.empty`: `"Keine Videodaten geladen."` (`"No video data loaded."`)

styles.css:

```css
.game-klick-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin: 12px 0;
  max-width: 720px;
}

.game-klick-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  background: var(--card-bg, transparent);
}

.game-klick-card h4 {
  margin: 8px 0 4px;
  font-size: 0.95rem;
}

.game-klick-thumb {
  width: 100%;
  border-radius: 8px;
}

.game-klick-count {
  font-weight: 600;
  margin: 4px 0 0;
}
```

(Use the existing card border/background variable names from `.hof-card` in styles.css — check and match at implementation time instead of inventing `--card-bg` if the codebase uses a different token.)

- [ ] **Step 6: Run tests and verify in the browser**

Run: `node --test tests/web_games.test.mjs tests/web_i18n.test.mjs`
Expected: PASS.

Browser (`#/spiel/klick-duell`): thumbnails render; right count hidden until answered; correct advances with count revealed; wrong ends the run showing both counts, the source links and the best streak; restart works.

- [ ] **Step 7: Commit**

```bash
git add web/games.js web/app.js web/i18n.js web/styles.css tests/web_games.test.mjs
git commit -m "Add Klick-Duell higher-lower view count game"
```

---

### Task 7: GPL-Quizshow (template multiple choice)

**Files:**
- Modify: `web/games.js` (question generators)
- Modify: `web/app.js` (`renderQuizshow`)
- Modify: `web/i18n.js`, `web/styles.css`
- Test: `tests/web_games.test.mjs`

**Interfaces:**
- Consumes: core datasets `champions`, `standings`, `killlists`, lazy `matchupSummary`; app.js `seasonDisplay`.
- Produces (games.js): `QUIZ_CATEGORIES = ["champions", "standings", "killlists", "matchups"]`; `quizQuestion(sources, category, rng) => { category, params, options: [{ label, correct }], sourceUrls } | null` where `sources = { champions, standings, killlists, matchups }`, `category` is one of `QUIZ_CATEGORIES` or `"all"`, `params` are the placeholder values for the i18n template `games.quiz.q.<category>`, and `options` are already shuffled.
- localStorage: `gpl-game-quizshow-score` = `{ correct: number, total: number }`.
- Session state: `state.games.quizshow = { question, answered: number | null, category }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_games.test.mjs`:

```js
import { QUIZ_CATEGORIES, quizQuestion } from "../web/games.js";

const QUIZ_SOURCES = {
  champions: [
    { season_id: "season_001", champion_name: "PresentLP", source_urls: "https://sheet/c1" },
    { season_id: "season_002", champion_name: "Raizor", source_urls: "https://sheet/c2" },
    { season_id: "season_003", champion_name: "Morbolth", source_urls: "https://sheet/c3" },
    { season_id: "season_004", champion_name: "Bene", source_urls: "https://sheet/c4" },
  ],
  standings: [
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "1", player_name: "PresentLP", source_urls: "https://sheet/s1" },
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "2", player_name: "Raizor", source_urls: "https://sheet/s1" },
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "3", player_name: "Morbolth", source_urls: "https://sheet/s1" },
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "4", player_name: "Bene", source_urls: "https://sheet/s1" },
  ],
  killlists: [
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Knakrack", kills: "20", source_urls: "https://sheet/k1" },
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Scherox", kills: "12", source_urls: "https://sheet/k1" },
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Rotom", kills: "8", source_urls: "https://sheet/k1" },
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Despotar", kills: "5", source_urls: "https://sheet/k1" },
  ],
  matchups: [
    { person_id: "person_a", person_name: "PresentLP", opponent_id: "person_b", opponent_name: "Raizor", matches: "11", wins: "6", losses: "5", source_urls: "https://sheet/m1" },
  ],
};

test("quizQuestion builds a champions question with one correct option", () => {
  const question = quizQuestion(QUIZ_SOURCES, "champions", seededRandom("quiz-champ"));
  assert.equal(question.category, "champions");
  assert.ok(question.params.season);
  assert.equal(question.options.length, 4);
  assert.equal(question.options.filter((option) => option.correct).length, 1);
  const labels = question.options.map((option) => option.label);
  assert.equal(new Set(labels).size, 4);
  assert.ok(question.sourceUrls);
  // Deterministic for the same seed.
  assert.deepEqual(question, quizQuestion(QUIZ_SOURCES, "champions", seededRandom("quiz-champ")));
});

test("quizQuestion standings names the player at the drawn rank", () => {
  const question = quizQuestion(QUIZ_SOURCES, "standings", seededRandom("quiz-standings"));
  assert.equal(question.category, "standings");
  const correct = question.options.find((option) => option.correct);
  const expected = QUIZ_SOURCES.standings.find((row) => row.rank === String(question.params.rank));
  assert.equal(correct.label, expected.player_name);
});

test("quizQuestion killlists picks the top killer as the correct answer", () => {
  const question = quizQuestion(QUIZ_SOURCES, "killlists", seededRandom("quiz-kills"));
  const correct = question.options.find((option) => option.correct);
  assert.equal(correct.label, "Knakrack");
  assert.equal(question.params.trainer, "PresentLP");
});

test("quizQuestion matchups names the head-to-head leader", () => {
  const question = quizQuestion(QUIZ_SOURCES, "matchups", seededRandom("quiz-matchups"));
  assert.equal(question.options.length, 2);
  const correct = question.options.find((option) => option.correct);
  assert.equal(correct.label, "PresentLP");
});

test("quizQuestion falls back across categories and returns null when empty", () => {
  const onlyChampions = { champions: QUIZ_SOURCES.champions, standings: [], killlists: [], matchups: [] };
  const question = quizQuestion(onlyChampions, "all", seededRandom("quiz-all"));
  assert.equal(question.category, "champions");
  assert.equal(quizQuestion({ champions: [], standings: [], killlists: [], matchups: [] }, "all", seededRandom("x")), null);
  assert.deepEqual(QUIZ_CATEGORIES, ["champions", "standings", "killlists", "matchups"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_games.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement the generators in games.js**

```js
// Quizshow: every question is generated from archive rows and carries the
// source_urls of the row(s) it was built from — the reveal always cites them.
export const QUIZ_CATEGORIES = ["champions", "standings", "killlists", "matchups"];

function championsQuestion(rows, rng) {
  const candidates = rows.filter((row) => row.champion_name && row.season_id);
  const names = [...new Set(candidates.map((row) => row.champion_name))];
  if (candidates.length < 1 || names.length < 4) return null;
  const row = candidates[pickIndex(rng, candidates.length)];
  const distractors = shuffled(names.filter((name) => name !== row.champion_name), rng).slice(0, 3);
  return {
    category: "champions",
    params: { season: row.season_id },
    options: shuffled(
      [{ label: row.champion_name, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

function standingsQuestion(rows, rng) {
  const finals = rows.filter((row) => String(row.is_primary) === "true" && row.stage === "final_table" && row.player_name);
  const tables = new Map();
  for (const row of finals) {
    const key = `${row.season_id}__${row.division}`;
    if (!tables.has(key)) tables.set(key, []);
    tables.get(key).push(row);
  }
  const bigTables = [...tables.values()].filter((table) => table.length >= 4).sort((a, b) => a[0].season_id.localeCompare(b[0].season_id) || a[0].division.localeCompare(b[0].division));
  if (!bigTables.length) return null;
  const table = bigTables[pickIndex(rng, bigTables.length)];
  const topRows = table.filter((row) => Number(row.rank) >= 1 && Number(row.rank) <= 3);
  if (!topRows.length) return null;
  const row = topRows[pickIndex(rng, topRows.length)];
  const distractors = shuffled(table.filter((other) => other !== row).map((other) => other.player_name), rng).slice(0, 3);
  if (distractors.length < 3) return null;
  return {
    category: "standings",
    params: { rank: Number(row.rank), season: row.season_id, division: row.division },
    options: shuffled(
      [{ label: row.player_name, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

function killlistsQuestion(rows, rng) {
  const byTrainer = new Map();
  for (const row of rows) {
    if (!row.trainer || !row.pokemon || !Number.isFinite(Number(row.kills))) continue;
    const key = `${row.season_id}__${row.trainer}`;
    if (!byTrainer.has(key)) byTrainer.set(key, []);
    byTrainer.get(key).push(row);
  }
  const groups = [...byTrainer.values()]
    .filter((group) => group.length >= 4)
    .map((group) => [...group].sort((a, b) => Number(b.kills) - Number(a.kills)))
    .filter((group) => Number(group[0].kills) > Number(group[1].kills))
    .sort((a, b) => `${a[0].season_id}${a[0].trainer}`.localeCompare(`${b[0].season_id}${b[0].trainer}`));
  if (!groups.length) return null;
  const group = groups[pickIndex(rng, groups.length)];
  const top = group[0];
  const distractors = shuffled(group.slice(1).map((row) => row.pokemon), rng).slice(0, 3);
  return {
    category: "killlists",
    params: { trainer: top.trainer, season: top.season_id },
    options: shuffled(
      [{ label: top.pokemon, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: top.source_urls || "",
  };
}

function matchupsQuestion(rows, rng) {
  const decisive = rows.filter(
    (row) => row.person_id < row.opponent_id && Number(row.matches) >= 5 && Number(row.wins) !== Number(row.losses),
  );
  if (!decisive.length) return null;
  const row = decisive[pickIndex(rng, decisive.length)];
  const leader = Number(row.wins) > Number(row.losses) ? row.person_name : row.opponent_name;
  return {
    category: "matchups",
    params: { a: row.person_name, b: row.opponent_name, matches: Number(row.matches) },
    options: shuffled(
      [
        { label: row.person_name, correct: row.person_name === leader },
        { label: row.opponent_name, correct: row.opponent_name === leader },
      ],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

const QUIZ_GENERATORS = {
  champions: championsQuestion,
  standings: standingsQuestion,
  killlists: killlistsQuestion,
  matchups: matchupsQuestion,
};

export function quizQuestion(sources, category, rng) {
  const order = category === "all" ? shuffled(QUIZ_CATEGORIES, rng) : [category];
  for (const key of order) {
    const question = QUIZ_GENERATORS[key]?.((sources[key] || []), rng);
    if (question) return question;
  }
  return null;
}
```

Note for the test fixture: `killlists` rows in the real CSV use `trainer` (not `person_name`) — verified against `pokemon_killlists.csv` headers. The matchups question deliberately has two options; the renderer handles 2 or 4 options identically.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_games.test.mjs`
Expected: PASS.

- [ ] **Step 5: Implement `renderQuizshow` in app.js**

Replace the stub. Category select (Alle + 4 categories), question text from `games.quiz.q.<category>` template (seasons rendered via `seasonDisplay(params.season)`), option buttons; answering marks right/wrong, shows the reveal card with the correct answer + sources, updates `gpl-game-quizshow-score`, and offers "Nächste Frage".

```js
function renderQuizshow(body) {
  const sources = {
    champions: state.data.champions || [],
    standings: state.data.standings || [],
    killlists: state.data.killlists || [],
    matchups: state.data.matchupSummary || [],
  };
  const score = readGameJson("gpl-game-quizshow-score", { correct: 0, total: 0 });
  let game = state.games.quizshow;
  if (!game || !game.question) {
    const category = game?.category || "all";
    const rng = seededRandom(`quiz-${dateSeedString()}-${score.total}-${category}`);
    game = { question: quizQuestion(sources, category, rng), answered: null, category };
    state.games.quizshow = game;
  }
  if (!game.question) {
    body.innerHTML = `<p class="empty-note">${escapeHtml(t(state.language, "games.quiz.empty"))}</p>`;
    return;
  }
  const question = game.question;
  const params = { ...question.params };
  if (params.season) params.season = seasonDisplay(params.season);
  const questionText = formatMessage(t(state.language, `games.quiz.q.${question.category}`), params);
  const categoryOptions = ["all", ...QUIZ_CATEGORIES]
    .map(
      (key) =>
        `<option value="${escapeAttr(key)}"${key === game.category ? " selected" : ""}>${escapeHtml(
          t(state.language, key === "all" ? "games.quiz.categoryAll" : `games.quiz.categories.${key}`),
        )}</option>`,
    )
    .join("");
  const answered = game.answered !== null;
  body.innerHTML = `
    <div class="game-form">
      <label for="quiz-category">${escapeHtml(t(state.language, "games.quiz.category"))}</label>
      <select id="quiz-category">${categoryOptions}</select>
    </div>
    <h4 class="game-quiz-question">${escapeHtml(questionText)}</h4>
    <div class="game-quiz-options">
      ${question.options
        .map(
          (option, index) => `
            <button class="link-button game-quiz-option${
              answered ? (option.correct ? " is-correct" : index === game.answered ? " is-wrong" : "") : ""
            }" type="button" data-quiz-option="${index}" ${answered ? "disabled" : ""}>${escapeHtml(option.label)}</button>`,
        )
        .join("")}
    </div>
    ${
      answered
        ? `${gameRevealCard({
            title: question.options[game.answered]?.correct ? t(state.language, "games.correct") : t(state.language, "games.wrong"),
            bodyHtml: `<p>${escapeHtml(question.options.find((option) => option.correct)?.label || "")}</p>`,
            sourceUrls: question.sourceUrls,
          })}
          <button id="quiz-next" class="link-button" type="button">${escapeHtml(t(state.language, "games.next"))}</button>`
        : ""
    }
    <p class="game-status">${escapeHtml(formatMessage(t(state.language, "games.quiz.score"), { correct: score.correct, total: score.total }))}</p>`;
  document.querySelector("#quiz-category")?.addEventListener("change", (event) => {
    state.games.quizshow = { question: null, answered: null, category: event.target.value };
    renderGame();
  });
  if (!answered) {
    body.querySelectorAll("[data-quiz-option]").forEach((button) => {
      button.addEventListener("click", () => {
        game.answered = Number(button.dataset.quizOption);
        const right = Boolean(question.options[game.answered]?.correct);
        saveGameJson("gpl-game-quizshow-score", { correct: score.correct + (right ? 1 : 0), total: score.total + 1 });
        renderGame();
      });
    });
  }
  document.querySelector("#quiz-next")?.addEventListener("click", () => {
    state.games.quizshow = { question: null, answered: null, category: game.category };
    renderGame();
  });
}
```

Extend the games.js import with `QUIZ_CATEGORIES, quizQuestion`.

i18n additions (de / en):

- `games.quiz.category`: `"Kategorie"` (`"Category"`)
- `games.quiz.categoryAll`: `"Alle"` (`"All"`)
- `games.quiz.categories.champions`: `"Champions"` (`"Champions"`)
- `games.quiz.categories.standings`: `"Tabellen"` (`"Standings"`)
- `games.quiz.categories.killlists`: `"Killlisten"` (`"Kill lists"`)
- `games.quiz.categories.matchups`: `"Duelle"` (`"Head-to-heads"`)
- `games.quiz.q.champions`: `"Wer wurde Champion von {season}?"` (`"Who became champion of {season}?"`)
- `games.quiz.q.standings`: `"Wer belegte Platz {rank} in {division}, {season}?"` (`"Who finished rank {rank} in {division}, {season}?"`)
- `games.quiz.q.killlists`: `"Welches Pokémon holte die meisten Kills für {trainer} in {season}?"` (`"Which Pokémon scored the most kills for {trainer} in {season}?"`)
- `games.quiz.q.matchups`: `"Wer führt das direkte Duell {a} vs. {b} an ({matches} Spiele)?"` (`"Who leads the head-to-head {a} vs. {b} ({matches} games)?"`)
- `games.quiz.score`: `"Punktestand: {correct} / {total}"` (`"Score: {correct} / {total}"`)
- `games.quiz.empty`: `"Keine Quizdaten geladen."` (`"No quiz data loaded."`)

styles.css:

```css
.game-quiz-question {
  margin: 12px 0 8px;
}

.game-quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 420px;
  margin: 8px 0 12px;
}

.game-quiz-option.is-correct {
  border-color: var(--viz-2);
  color: var(--viz-2);
}

.game-quiz-option.is-wrong {
  border-color: var(--viz-1);
  color: var(--viz-1);
}
```

(Check the actual success/danger color tokens in styles.css at implementation time — the Elo ledger's ±delta colors are the precedent; use those variables instead of `--viz-*` if they exist, e.g. a `--positive`/`--negative` pair.)

- [ ] **Step 6: Run tests and verify in the browser**

Run: `node --test tests/web_games.test.mjs tests/web_i18n.test.mjs`
Expected: PASS.

Browser (`#/spiel/quizshow`): question renders with 4 options (2 for Duelle), answer marks correct/wrong, reveal card cites sources, score persists across reload, category filter switches question pools.

- [ ] **Step 7: Commit**

```bash
git add web/games.js web/app.js web/i18n.js web/styles.css tests/web_games.test.mjs
git commit -m "Add GPL-Quizshow with sourced multiple-choice questions"
```

---

### Task 8: Docs, full gates, end-to-end browser verification

**Files:**
- Modify: `README.md` (view list: Spiele group with the four games)
- Modify: `docs/known-limitations.md` (new "Spiele (computed)" section)
- Modify: `docs/superpowers/specs/2026-08-10-gpl-extensions-design.md` (only if implementation deviated from the spec — add a change note paragraph below the menu table, never inside it)

**Interfaces:** none (documentation + verification).

- [ ] **Step 1: Update README.md**

Add to the view list (matching the existing bullet style): a "Spiele" bullet describing the hub and the four games in one or two sentences, mentioning that every reveal cites its source rows and that scores/streaks are stored locally in the browser.

- [ ] **Step 2: Update docs/known-limitations.md**

New section "Spiele (computed)" documenting: all questions/puzzles are generated from the normalized CSVs (nothing hand-authored, nothing official); the daily Kader-Raten puzzle is seeded by the visitor's local date, so users in different time zones can see the day roll over at different moments; scores, streaks and daily progress live only in the visitor's localStorage (`gpl-game-<id>-*`) and reset in private browsing; Klick-Duell thumbnails come from `i.ytimg.com` and degrade to text offline; Tipp-Spiel forecasts use the client-side full-archive Elo (same computation as Rivalitäten) and are computed, not official.

- [ ] **Step 3: Run the full gates**

```bash
python -m pytest -q
node --test tests/*.mjs
npm run validate
npm run check:generated
git diff --check
```

Expected: all green (207+ pytest, all node tests including web_games).

- [ ] **Step 4: End-to-end browser pass**

With the dev server running, walk all four games at `http://localhost:8010/web/` (fresh reload): hub → each game → play at least two rounds each; verify toolbar stays hidden, back link works, language toggle re-renders every game without losing the current round, dark mode renders the new cards correctly, and `#/spiel/unbekannt` lands on the hub.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/known-limitations.md
git commit -m "Document the Spiele group and its computed, local-only nature"
```

- [ ] **Step 6: Finish the branch**

Use superpowers:finishing-a-development-branch (full test suite, then present the merge/PR/keep menu).

---

## Self-Review Notes

- Spec coverage: hub + `#/spiel/<id>` routing (Task 1/3), `seededRandom` mulberry32 + `gpl-game-<id>-*` keys + reveal-with-source pattern (Tasks 2/3), Kader-Raten with date seed, sprite-by-sprite reveal, division→rank→season hints, roster-detail solution link (Task 4), Tipp-Spiel with roster sprites, winner pick, score + Elo probability reveal, running you-vs-Elo tally (Task 5), Klick-Duell higher/lower on `view_count` with i.ytimg thumbnails (Task 6), Quizshow templates over champions/standings/killlists/matchup summaries with category filter and source receipts (Task 7). Menu table in the spec already lists `games` for Phase 4 — no spec edit needed unless implementation deviates.
- The `game` view intentionally loads the union of all four games' lazy datasets (`teamRosters`, `videos`, `matchupSummary`, `matchVideos`); all are `optional: true`, so partial deployments degrade to per-game empty notes.
- Type consistency: `normalizeKey` parameters in games.js take app.js' `normalizedKey`; `state.games` keys are the game ids except `quizshow` (valid identifier, used consistently); pool/candidate shapes match between generator tests and renderers.
