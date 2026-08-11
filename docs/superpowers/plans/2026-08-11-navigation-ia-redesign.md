# Navigation & IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Nav von 8 Gruppen / 30 Tabs auf 6 Gruppen / 17 Tabs umbauen: Saison-Hub mit Unter-Tabs, Umbenennungen + Tab-Tooltips, abgesetzter Werkstatt-Tab, neue Wegweiser-Übersicht.

**Architecture:** Reine Frontend-Änderung an der statischen ES-Modul-App (kein Build-Step). Alle View-IDs, Gruppen-IDs, Renderer und Deep-Links bleiben unverändert — nur `view_config.js` (Gruppenzuschnitt + neues generisches `stacks`-Konzept), `index.html` (Nav-Zeilen), `app.js` (Stack-/Werkstatt-/Wegweiser-Logik), `i18n.js` (Labels de+en) und `styles.css` ändern sich.

**Tech Stack:** Vanilla ES modules, node:test (`tests/*.mjs`), i18n-Paritätstest erzwingt de/en.

**Spec:** `docs/superpowers/specs/2026-08-11-navigation-ia-redesign-design.md`

## Global Constraints

- Arbeitssprache der UI: Deutsch; jeder neue i18n-Key braucht de **und** en (Paritätstest schlägt sonst fehl).
- **Alle View-IDs und Gruppen-IDs bleiben unverändert**; Deep-Links (`#/season-story`, `#/person/...`, `#/data-coverage`) müssen weiter funktionieren. `web/router.js` wird nicht angefasst.
- Startansicht bleibt `all-time` (Ewige Tabelle), jetzt erster Tab der ersten Gruppe `records`.
- Gates nach jedem Task: `node --test tests/*.mjs` (aktuell 119 Tests). Am Ende zusätzlich `python -m pytest -q` (218), `npm run validate`, `npm run check:generated`, `git diff --check`.
- Shell: PowerShell 5.1 — **kein `&&`**, Befehle mit `;` verketten.
- Branch: `feature/nav-ia-redesign` von `main` abzweigen (Schritt in Task 1).
- Nach ES-Modul-Änderungen im Browser: Cache-Buster-Query verwenden (`http://localhost:8010/web/index.html?v=nav1`).

## Dateistruktur

- `web/view_config.js` — Gruppen-/Stack-/Standalone-Registry + pure Helper (node-getestet)
- `web/index.html` — Gruppenzeile, Tab-Zeile, neue Stack-Tab-Zeile, Wegweiser-Link + -Section
- `web/app.js` — Klick-Handler, `setActiveView`, `applyViewDefaults`, Wegweiser-Renderer
- `web/i18n.js` — Umbenennungen + Namespaces `seasonHub`, `wegweiser`
- `web/styles.css` — `.stack-tabs`, `.nav-group-tab.is-tool`, `.wegweiser-*`
- `tests/web_view_config.test.mjs` — komplett neu geschrieben
- `tests/web_shell.test.mjs` — angepasste/neue Assertions

---

### Task 1: view_config.js — neue Gruppen, Stacks, Standalone-Views

**Files:**
- Modify: `web/view_config.js` (komplette `VIEW_GROUPS`-Liste + Helper)
- Test: `tests/web_view_config.test.mjs` (komplett ersetzen)

**Interfaces:**
- Produces (von Task 3/4 konsumiert): `stackForView(view) -> string|null`, `stackViews(stackId) -> string[]`, `stackDefaultView(stackId) -> string`, `isStandaloneView(view) -> boolean`, `STANDALONE_VIEWS: string[]`, Gruppen-Feld `tool: true`, Stack-Feld `stacks: [{id, labelKey, views}]`. Bestehende Exporte (`VIEW_GROUPS`, `GAME_IDS`, `VALID_VIEW_IDS`, `viewGroupForView`, `defaultViewForGroup`, `subviewsForGroup`, `isValidView`) behalten Signatur.

- [ ] **Step 1: Branch anlegen**

```powershell
git checkout main; git checkout -b feature/nav-ia-redesign
```

- [ ] **Step 2: Failing Test schreiben** — `tests/web_view_config.test.mjs` vollständig ersetzen durch:

```js
import assert from "node:assert/strict";
import {
  defaultViewForGroup,
  GAME_IDS,
  isStandaloneView,
  isValidView,
  STANDALONE_VIEWS,
  stackDefaultView,
  stackForView,
  stackViews,
  subviewsForGroup,
  viewGroupForView,
  VIEW_GROUPS,
} from "../web/view_config.js";

assert.deepEqual(
  VIEW_GROUPS.map((group) => group.id),
  ["records", "seasons", "duels", "pokemon", "videos", "games", "data"],
);

// Bestenlisten: Ewige Tabelle + Kaderübersichten + Rekord-Cluster.
assert.equal(defaultViewForGroup("records"), "all-time");
assert.deepEqual(subviewsForGroup("records"), ["all-time", "team-rosters", "record-book", "awards", "hall-of-fame", "upset-index"]);
for (const view of ["all-time", "team-rosters", "person-details", "roster-detail", "record-book", "awards", "hall-of-fame", "upset-index"]) {
  assert.equal(viewGroupForView(view), "records");
}

// Saisons: Hub-Stack + Chronik.
assert.equal(defaultViewForGroup("seasons"), "season-detail");
assert.deepEqual(subviewsForGroup("seasons"), ["season-detail", "match-plan", "battle-history", "table-history", "season-story", "season-wrapped", "zeitreise"]);
assert.deepEqual(stackViews("season-hub"), ["season-detail", "match-plan", "battle-history", "table-history", "season-story", "season-wrapped"]);
assert.equal(stackDefaultView("season-hub"), "season-detail");
for (const view of stackViews("season-hub")) {
  assert.equal(stackForView(view), "season-hub");
  assert.equal(viewGroupForView(view), "seasons");
}
assert.equal(stackForView("zeitreise"), null);
assert.equal(stackForView("all-time"), null);
assert.deepEqual(stackViews("unknown-stack"), []);

// Duelle / Pokémon unverändert.
assert.deepEqual(subviewsForGroup("duels"), ["rivalries", "oracle", "team-duel"]);
assert.equal(viewGroupForView("rivalry-detail"), "duels");
assert.deepEqual(subviewsForGroup("pokemon"), ["killlists", "pokemon-drafts"]);
assert.equal(viewGroupForView("pokemon-detail"), "pokemon");

// Videos übernimmt die Highlightkämpfe.
assert.deepEqual(subviewsForGroup("videos"), ["video-archive", "cinema", "match-highlights", "audience-history", "zeitstrahl"]);
assert.equal(viewGroupForView("match-highlights"), "videos");

// Spiele unverändert.
const gamesGroup = VIEW_GROUPS.find((group) => group.id === "games");
assert.deepEqual(gamesGroup.views, ["games"]);
assert.deepEqual(gamesGroup.detailViews, ["game"]);
assert.deepEqual(GAME_IDS, ["kader-raten", "tipp-spiel", "klick-duell", "quizshow", "wer-bin-ich"]);

// Werkstatt: als einzige Gruppe mit tool-Flag.
const dataGroup = VIEW_GROUPS.find((group) => group.id === "data");
assert.equal(dataGroup.tool, true);
assert.equal(VIEW_GROUPS.filter((group) => group.tool).length, 1);
assert.equal(defaultViewForGroup("data"), "data-coverage");
assert.deepEqual(subviewsForGroup("data"), [
  "data-coverage",
  "data-gaps",
  "roster-gaps",
  "appearance-gaps",
  "video-review",
  "match-video-coverage",
  "review-workflow",
  "source-claims",
]);

// Wegweiser: gruppenloser Standalone-View.
assert.deepEqual(STANDALONE_VIEWS, ["wegweiser"]);
assert.equal(isValidView("wegweiser"), true);
assert.equal(isStandaloneView("wegweiser"), true);
assert.equal(isStandaloneView("all-time"), false);

// Fallbacks: Standardgruppe ist jetzt records.
assert.equal(defaultViewForGroup("unknown"), "all-time");
assert.equal(viewGroupForView("missing"), "records");
assert.equal(isValidView("matchup"), false);
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

Run: `node --test tests/web_view_config.test.mjs`
Expected: FAIL (Gruppen-IDs beginnen mit "people"; `stackForView` nicht exportiert)

- [ ] **Step 4: `web/view_config.js` umbauen** — `VIEW_GROUPS` und die Ableitungen ersetzen (`GAME_IDS`-Zeile und die Funktionen `viewGroupForView`/`defaultViewForGroup`/`subviewsForGroup`/`isValidView` bleiben; neue Konstanten/Helper ergänzen):

```js
export const VIEW_GROUPS = [
  {
    id: "records",
    labelKey: "navGroups.records",
    defaultView: "all-time",
    views: ["all-time", "team-rosters", "record-book", "awards", "hall-of-fame", "upset-index"],
    detailViews: ["person-details", "roster-detail"],
  },
  {
    id: "seasons",
    labelKey: "navGroups.seasons",
    defaultView: "season-detail",
    views: ["season-detail", "match-plan", "battle-history", "table-history", "season-story", "season-wrapped", "zeitreise"],
    stacks: [
      {
        id: "season-hub",
        labelKey: "seasonHub.tab",
        views: ["season-detail", "match-plan", "battle-history", "table-history", "season-story", "season-wrapped"],
      },
    ],
  },
  {
    id: "duels",
    labelKey: "navGroups.duels",
    defaultView: "rivalries",
    views: ["rivalries", "oracle", "team-duel"],
    detailViews: ["rivalry-detail"],
  },
  {
    id: "pokemon",
    labelKey: "navGroups.pokemon",
    defaultView: "killlists",
    views: ["killlists", "pokemon-drafts"],
    detailViews: ["pokemon-detail"],
  },
  {
    id: "videos",
    labelKey: "navGroups.videos",
    defaultView: "video-archive",
    views: ["video-archive", "cinema", "match-highlights", "audience-history", "zeitstrahl"],
  },
  {
    id: "games",
    labelKey: "navGroups.games",
    defaultView: "games",
    views: ["games"],
    detailViews: ["game"],
  },
  {
    id: "data",
    labelKey: "navGroups.data",
    tool: true,
    defaultView: "data-coverage",
    views: [
      "data-coverage",
      "data-gaps",
      "roster-gaps",
      "appearance-gaps",
      "video-review",
      "match-video-coverage",
      "review-workflow",
      "source-claims",
    ],
  },
];

export const GAME_IDS = ["kader-raten", "tipp-spiel", "klick-duell", "quizshow", "wer-bin-ich"];

// Views ohne Gruppen-Tab (Header-Zugang): der Wegweiser.
export const STANDALONE_VIEWS = ["wegweiser"];

const DEFAULT_GROUP = VIEW_GROUPS[0].id;
const GROUP_BY_VIEW = new Map(VIEW_GROUPS.flatMap((group) => [...group.views, ...(group.detailViews || [])].map((view) => [view, group.id])));
const GROUP_BY_ID = new Map(VIEW_GROUPS.map((group) => [group.id, group]));
const STACK_BY_ID = new Map(VIEW_GROUPS.flatMap((group) => (group.stacks || []).map((stack) => [stack.id, stack])));
const STACK_ID_BY_VIEW = new Map(
  VIEW_GROUPS.flatMap((group) => (group.stacks || []).flatMap((stack) => stack.views.map((view) => [view, stack.id]))),
);

export const VALID_VIEW_IDS = new Set([
  ...VIEW_GROUPS.flatMap((group) => [...group.views, ...(group.detailViews || [])]),
  ...STANDALONE_VIEWS,
]);

export function stackForView(view) {
  return STACK_ID_BY_VIEW.get(view) || null;
}

export function stackViews(stackId) {
  return [...(STACK_BY_ID.get(stackId)?.views || [])];
}

export function stackDefaultView(stackId) {
  return STACK_BY_ID.get(stackId)?.views[0] || VIEW_GROUPS[0].defaultView;
}

export function isStandaloneView(view) {
  return STANDALONE_VIEWS.includes(view);
}
```

- [ ] **Step 5: Test laufen lassen — muss bestehen**

Run: `node --test tests/web_view_config.test.mjs`
Expected: PASS

- [ ] **Step 6: Gesamte Node-Suite laufen lassen**

Run: `node --test tests/*.mjs`
Expected: `web_shell.test.mjs` schlägt noch NICHT fehl (liest nur Dateitexte); falls andere Tests `viewGroupForView`-Annahmen haben, hier auffangen. Bekannt: keine — alles außer `web_view_config` muss grün sein.

- [ ] **Step 7: Commit**

```powershell
git add web/view_config.js tests/web_view_config.test.mjs; git commit -m "feat: regroup views, add stack and standalone concepts to view config"
```

---

### Task 2: i18n — Umbenennungen + neue Namespaces (de/en)

**Files:**
- Modify: `web/i18n.js`

**Interfaces:**
- Produces: Keys `seasonHub.{tab,overview,matchPlan,bracket,tableHistory,story,wrapped}`, `wegweiser.{seasonHub,workshopNote,workshopLink}`, `nav.wegweiser`, `sections.wegweiserTitle`, `sections.wegweiserDescription`; geänderte Werte für `navGroups.{records,seasons,data}`, `nav.{zeitreise,zeitstrahl}`, `sections.{zeitreiseTitle,zeitstrahlTitle}`. Task 3/4 referenzieren genau diese Key-Namen.

- [ ] **Step 1: Deutsche Werte ändern** (im `de`-Block von `web/i18n.js`):
  - `nav.zeitreise`: `"Zeitreise"` → `"Chronik"`
  - `nav.zeitstrahl`: `"Zeitstrahl"` → `"Meilensteine"`
  - `nav`-Objekt ergänzen: `wegweiser: "Wegweiser",`
  - `navGroups.seasons`: `"Saisons & Kämpfe"` → `"Saisons"`
  - `navGroups.records`: `"Rekorde"` → `"Bestenlisten"`
  - `navGroups.data`: `"Daten & Review"` → `"Werkstatt"`
  - `sections.zeitreiseTitle`: `"Zeitreise"` → `"Chronik"`
  - `sections.zeitstrahlTitle`: `"Zeitstrahl"` → `"Meilensteine"`
  - `sections`-Objekt ergänzen:

```js
      wegweiserTitle: "Wegweiser",
      wegweiserDescription: "Alle Bereiche der Seite im Überblick – jede Karte führt direkt zur Ansicht.",
```

- [ ] **Step 2: Deutsche Namespaces ergänzen** (Top-Level neben `sections`, z. B. direkt nach dem `sections`-Objekt):

```js
    seasonHub: {
      tab: "Saison",
      overview: "Akte",
      matchPlan: "Spielplan",
      bracket: "Spielbaum",
      tableHistory: "Tabellenverlauf",
      story: "Story",
      wrapped: "Wrapped",
    },
    wegweiser: {
      seasonHub: "Eine Saison in sechs Kapiteln: Akte, Spielplan, Spielbaum, Tabellenverlauf, Story und Wrapped.",
      workshopNote: "Werkstatt: Arbeitsansichten für Datenpflege und Review.",
      workshopLink: "Werkstatt öffnen",
    },
```

- [ ] **Step 3: Englische Werte spiegeln** (im `en`-Block, an denselben Stellen):
  - `nav.zeitreise`: `"Time Travel"` → `"Chronicle"`
  - `nav.zeitstrahl`: `"Timeline"` → `"Milestones"`
  - `nav`-Objekt ergänzen: `wegweiser: "Guide",`
  - `navGroups.seasons`: `"Seasons & Battles"` → `"Seasons"`
  - `navGroups.records`: `"Records"` → `"Leaderboards"`
  - `navGroups.data`: `"Data & Review"` → `"Workshop"`
  - `sections.zeitreiseTitle` → `"Chronicle"`, `sections.zeitstrahlTitle` → `"Milestones"`
  - `sections`-Objekt ergänzen:

```js
      wegweiserTitle: "Guide",
      wegweiserDescription: "Every area of the site at a glance – each card jumps straight to its view.",
```

  - Namespaces:

```js
    seasonHub: {
      tab: "Season",
      overview: "Overview",
      matchPlan: "Match Plan",
      bracket: "Bracket",
      tableHistory: "Table History",
      story: "Story",
      wrapped: "Wrapped",
    },
    wegweiser: {
      seasonHub: "One season in six chapters: overview, match plan, bracket, table history, story, and wrapped.",
      workshopNote: "Workshop: working views for data maintenance and review.",
      workshopLink: "Open the workshop",
    },
```

- [ ] **Step 4: Paritäts-/Node-Tests laufen lassen**

Run: `node --test tests/*.mjs`
Expected: PASS (der i18n-Paritätstest bestätigt de/en-Deckung; `web_shell` prüft keine der geänderten Labels)

- [ ] **Step 5: Commit**

```powershell
git add web/i18n.js; git commit -m "feat: rename nav labels and add season hub and guide i18n keys"
```

---

### Task 3: Nav-Umbau — Gruppenzeile, Saison-Hub, Werkstatt-Tab, Tooltips

**Files:**
- Modify: `web/index.html` (Zeilen 53–101: `.primary-tabs` + `.tabs.sub-tabs`), `web/app.js` (Import, `state`, Klick-Handler ~Z. 484–501, `applyViewDefaults` ~Z. 894, `ALL_SEASON_DEFAULT_VIEWS` Z. 232, `setActiveView` ~Z. 934), `web/styles.css` (nach dem `.sub-tabs .tab`-Block ~Z. 404)
- Test: `tests/web_shell.test.mjs`

**Interfaces:**
- Consumes: `stackForView`, `stackDefaultView`, `isStandaloneView` aus Task 1; i18n-Keys aus Task 2.
- Produces: `state.stackView` (Objekt Stack-ID → zuletzt aktiver View), DOM-Konventionen `data-view-stack="season-hub"` (Hub-Tab), `data-view-stack-member="season-hub"` (Unter-Tab), `.tabs.stack-tabs` (Unter-Tab-Zeile), `.nav-group-tab.is-tool` (Werkstatt). Task 4 baut darauf auf.

- [ ] **Step 1: Shell-Test anpassen (failing first)** — in `tests/web_shell.test.mjs`:
  - Zeile 32 ersetzen: `assert.equal(indexHtml.includes('data-view-group="people"'), false);`
  - Direkt darunter ergänzen:

```js
assert.equal(indexHtml.includes('data-view-group="records"'), true);
// Saison-Hub: ein Haupt-Tab, sechs Kapitel-Tabs in eigener Zeile.
assert.equal(indexHtml.includes('data-view-stack="season-hub"'), true);
assert.equal(indexHtml.includes('class="tabs stack-tabs"'), true);
assert.equal((indexHtml.match(/data-view-stack-member="season-hub"/g) || []).length, 6);
assert.equal(indexHtml.includes('data-view-stack-member="season-hub" data-view="season-detail"'), true);
assert.equal(indexHtml.includes('data-view-stack-member="season-hub" data-view="season-wrapped"'), true);
// Werkstatt: abgesetzter Tool-Tab statt gleichberechtigter Gruppe.
assert.equal(indexHtml.includes('class="nav-group-tab is-tool"'), true);
// Tab-Tooltips speisen sich aus den Sektionsbeschreibungen.
assert.equal(indexHtml.includes('data-i18n-title="sections.oracleDescription"'), true);
assert.equal(indexHtml.includes('data-i18n-title="sections.zeitreiseDescription"'), true);
assert.equal(appJs.includes("state.stackView"), true);
assert.equal(appJs.includes("stackDefaultView("), true);
assert.equal(stylesCss.includes(".stack-tabs"), true);
assert.equal(stylesCss.includes(".nav-group-tab.is-tool"), true);
```

  - Zeile 218 (`ALL_SEASON_DEFAULT_VIEWS`-Assertion) ersetzen durch: `assert.equal(appJs.includes("ALL_SEASON_DEFAULT_VIEWS"), false);`
  - Zeile 220 (Regex auf `ALL_SEASON_DEFAULT_VIEWS…`) ersetzen durch:

```js
assert.match(appJs, /function applyViewDefaults\(route, previousView\)[\s\S]*?currentGroup === "seasons" && !route\.seasonId && state\.season === "all"/);
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `node --test tests/web_shell.test.mjs`
Expected: FAIL (`data-view-group="people"` existiert noch, Stack-Markup fehlt)

- [ ] **Step 3: `web/index.html` Gruppenzeile ersetzen** (Zeilen 54–61) durch:

```html
        <button class="nav-group-tab is-active" type="button" data-view-group="records" data-i18n="navGroups.records">Bestenlisten</button>
        <button class="nav-group-tab" type="button" data-view-group="seasons" data-i18n="navGroups.seasons">Saisons</button>
        <button class="nav-group-tab" type="button" data-view-group="duels" data-i18n="navGroups.duels">Duelle</button>
        <button class="nav-group-tab" type="button" data-view-group="pokemon" data-i18n="navGroups.pokemon">Pokémon</button>
        <button class="nav-group-tab" type="button" data-view-group="videos" data-i18n="navGroups.videos">Videos</button>
        <button class="nav-group-tab" type="button" data-view-group="games" data-i18n="navGroups.games">Spiele</button>
        <button class="nav-group-tab is-tool" type="button" data-view-group="data" data-i18n="navGroups.data">Werkstatt</button>
```

- [ ] **Step 4: `web/index.html` View-Tab-Zeile neu ordnen** — innerhalb `<nav class="tabs sub-tabs">` (Zeilen 65–101) alle Buttons ersetzen. Reihenfolge = Anzeige-Reihenfolge pro Gruppe. Die sechs Saison-View-Buttons (`battle-history`, `match-highlights`, `season-detail`, `season-story`, `season-wrapped`, `table-history`, `match-plan`, `zeitreise`) verschwinden aus dieser Zeile; stattdessen Hub-Tab + Chronik. `match-highlights` wandert in die Videos-Gruppe. Jeder Tab erhält `data-i18n-title` mit seiner Sektionsbeschreibung:

```html
        <button class="tab is-active" data-view-group="records" data-view="all-time" data-i18n="nav.allTime" data-i18n-title="sections.allTimeDescription">Ewige Tabelle</button>
        <button class="tab" data-view-group="records" data-view="team-rosters" data-i18n="nav.teamRosters" data-i18n-title="sections.teamRostersDescription">Kaderübersichten</button>
        <button class="tab" data-view-group="records" data-view="record-book" data-i18n="nav.recordBook" data-i18n-title="sections.recordBookDescription">Rekordbuch</button>
        <button class="tab" data-view-group="records" data-view="awards" data-i18n="nav.awards" data-i18n-title="sections.awardsDescription">Auszeichnungen</button>
        <button class="tab" data-view-group="records" data-view="hall-of-fame" data-i18n="nav.hallOfFame" data-i18n-title="sections.hallOfFameDescription">Hall of Fame</button>
        <button class="tab" data-view-group="records" data-view="upset-index" data-i18n="nav.upsetIndex" data-i18n-title="sections.upsetIndexDescription">Upset-Index</button>
        <button class="tab" data-view-group="seasons" data-view-stack="season-hub" data-i18n="seasonHub.tab" data-i18n-title="sections.seasonDetailDescription">Saison</button>
        <button class="tab" data-view-group="seasons" data-view="zeitreise" data-i18n="nav.zeitreise" data-i18n-title="sections.zeitreiseDescription">Chronik</button>
        <button class="tab" data-view-group="duels" data-view="rivalries" data-i18n="nav.rivalries" data-i18n-title="sections.rivalriesDescription">Rivalitäten</button>
        <button class="tab" data-view-group="duels" data-view="oracle" data-i18n="nav.oracle" data-i18n-title="sections.oracleDescription">Orakel</button>
        <button class="tab" data-view-group="duels" data-view="team-duel" data-i18n="nav.teamDuel" data-i18n-title="sections.teamDuelDescription">Zeitmaschine</button>
        <button class="tab" data-view-group="pokemon" data-view="killlists" data-i18n="nav.killlists" data-i18n-title="sections.killlistsDescription">Pokémon-Killlisten</button>
        <button class="tab" data-view-group="pokemon" data-view="pokemon-drafts" data-i18n="nav.pokemonDrafts" data-i18n-title="sections.pokemonDraftsDescription">Pokémon-Drafts</button>
        <button class="tab" data-view-group="videos" data-view="video-archive" data-i18n="nav.videoArchive" data-i18n-title="sections.videoArchiveDescription">Video-Archiv</button>
        <button class="tab" data-view-group="videos" data-view="cinema" data-i18n="nav.cinema" data-i18n-title="sections.cinemaDescription">Kino-Modus</button>
        <button class="tab" data-view-group="videos" data-view="match-highlights" data-i18n="nav.matchHighlights" data-i18n-title="sections.matchHighlightsDescription">Highlightkämpfe</button>
        <button class="tab" data-view-group="videos" data-view="audience-history" data-i18n="nav.audienceHistory" data-i18n-title="sections.audienceHistoryDescription">Publikum</button>
        <button class="tab" data-view-group="videos" data-view="zeitstrahl" data-i18n="nav.zeitstrahl" data-i18n-title="sections.zeitstrahlDescription">Meilensteine</button>
        <button class="tab" data-view-group="games" data-view="games" data-i18n="nav.gamesOverview">Übersicht</button>
        <button class="tab" data-view-group="games" data-view="game" data-game-id="kader-raten" data-i18n="games.kader.title">Kader-Raten</button>
        <button class="tab" data-view-group="games" data-view="game" data-game-id="tipp-spiel" data-i18n="games.tipp.title">Tipp-Spiel</button>
        <button class="tab" data-view-group="games" data-view="game" data-game-id="klick-duell" data-i18n="games.klick.title">Klick-Duell</button>
        <button class="tab" data-view-group="games" data-view="game" data-game-id="quizshow" data-i18n="games.quiz.title">GPL-Quizshow</button>
        <button class="tab" data-view-group="games" data-view="game" data-game-id="wer-bin-ich" data-i18n="games.werbinich.title">Wer bin ich?</button>
        <button class="tab" data-view-group="data" data-view="data-coverage" data-i18n="nav.dataCoverage" data-i18n-title="sections.dataCoverageDescription">Datenlage</button>
        <button class="tab" data-view-group="data" data-view="data-gaps" data-i18n="nav.dataGaps" data-i18n-title="sections.dataGapsDescription">Lückenübersicht</button>
        <button class="tab" data-view-group="data" data-view="roster-gaps" data-i18n="nav.rosterGaps" data-i18n-title="sections.rosterGapsDescription">Kaderlücken</button>
        <button class="tab" data-view-group="data" data-view="appearance-gaps" data-i18n="nav.appearanceGaps" data-i18n-title="sections.appearanceGapsDescription">Einsatzlücken</button>
        <button class="tab" data-view-group="data" data-view="video-review" data-i18n="nav.videoReview" data-i18n-title="sections.videoReviewDescription">Video-Review</button>
        <button class="tab" data-view-group="data" data-view="match-video-coverage" data-i18n="nav.matchVideoCoverage" data-i18n-title="sections.matchVideoCoverageDescription">Kampfvideo-Abdeckung</button>
        <button class="tab" data-view-group="data" data-view="review-workflow" data-i18n="nav.reviewWorkflow" data-i18n-title="sections.reviewWorkflowDescription">Review</button>
        <button class="tab" data-view-group="data" data-view="source-claims" data-i18n="nav.sourceClaims" data-i18n-title="sections.sourceClaimsDescription">Quellenclaims</button>
```

Hinweis: `web_shell.test.mjs` prüft Reihenfolgen (`video-archive` vor `cinema` vor `audience-history` vor `zeitstrahl`) — die obige Reihenfolge erfüllt das.

- [ ] **Step 5: Stack-Tab-Zeile einfügen** — direkt NACH dem schließenden `</nav>` der `.tabs.sub-tabs`-Zeile:

```html
      <nav class="tabs stack-tabs" aria-label="Saison-Kapitel" hidden>
        <button class="tab" data-view-stack-member="season-hub" data-view="season-detail" data-i18n="seasonHub.overview" data-i18n-title="sections.seasonDetailDescription">Akte</button>
        <button class="tab" data-view-stack-member="season-hub" data-view="match-plan" data-i18n="seasonHub.matchPlan" data-i18n-title="sections.matchPlanDescription">Spielplan</button>
        <button class="tab" data-view-stack-member="season-hub" data-view="battle-history" data-i18n="seasonHub.bracket" data-i18n-title="sections.battleHistoryDescription">Spielbaum</button>
        <button class="tab" data-view-stack-member="season-hub" data-view="table-history" data-i18n="seasonHub.tableHistory" data-i18n-title="sections.tableHistoryDescription">Tabellenverlauf</button>
        <button class="tab" data-view-stack-member="season-hub" data-view="season-story" data-i18n="seasonHub.story" data-i18n-title="sections.seasonStoryDescription">Story</button>
        <button class="tab" data-view-stack-member="season-hub" data-view="season-wrapped" data-i18n="seasonHub.wrapped" data-i18n-title="sections.seasonWrappedDescription">Wrapped</button>
      </nav>
```

- [ ] **Step 6: `web/app.js` — Import + State erweitern**
  - Zeile 25 ersetzen durch:

```js
import { defaultViewForGroup, GAME_IDS, isStandaloneView, stackDefaultView, stackForView, VIEW_GROUPS, viewGroupForView } from "./view_config.js";
```

  - Im `state`-Objekt (Z. 280 ff.) nach `gameFocus: null,` einfügen:

```js
  stackView: {},
```

- [ ] **Step 7: `web/app.js` — Tab-Klick-Handler erweitern** (Z. 490–501). Am Anfang des Click-Callbacks vor `if (!button.dataset.view) return;` einfügen:

```js
      if (button.dataset.viewStack) {
        navigateToView(state.stackView[button.dataset.viewStack] || stackDefaultView(button.dataset.viewStack));
        return;
      }
```

- [ ] **Step 8: `web/app.js` — `setActiveView` ersetzen** (Z. 934–953) durch:

```js
function setActiveView(viewName) {
  state.view = viewName;
  const activeStack = stackForView(viewName);
  if (activeStack) {
    state.stackView[activeStack] = viewName;
  }
  // Der Wegweiser steht über den Gruppen: keine Gruppe ist aktiv.
  const activeGroup = isStandaloneView(viewName) ? null : viewGroupForView(viewName);
  document.querySelector(".toolbar")?.classList.toggle("is-cinema-hidden", TOOLBAR_HIDDEN_VIEWS.has(viewName));
  document.querySelector(".stack-tabs")?.toggleAttribute("hidden", !activeStack);
  document.querySelectorAll(".tab").forEach((item) => {
    if (item.dataset.viewStackMember) {
      const visible = item.dataset.viewStackMember === activeStack;
      item.hidden = !visible;
      item.setAttribute("aria-hidden", String(!visible));
      item.classList.toggle("is-active", item.dataset.view === viewName);
      return;
    }
    const inActiveGroup = item.dataset.viewGroup === activeGroup;
    item.hidden = !inActiveGroup;
    item.setAttribute("aria-hidden", String(!inActiveGroup));
    if (item.dataset.viewStack) {
      item.classList.toggle("is-active", item.dataset.viewStack === activeStack);
      return;
    }
    // Game tabs share the "game" view id, so the active one is resolved by
    // the focused game id instead.
    const gameTabActive = !item.dataset.gameId || item.dataset.gameId === (state.gameFocus?.key || "");
    item.classList.toggle("is-active", item.dataset.view === viewName && gameTabActive);
  });
  document.querySelectorAll(".nav-group-tab").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.viewGroup === activeGroup);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${viewName}`);
  });
}
```

(`VIEW_GROUPS` wird erst in Task 4 benutzt — der Import jetzt schon ist ok, ESLint gibt es hier nicht.)

- [ ] **Step 9: `web/app.js` — Saison-Default-Logik vereinfachen**
  - Zeile 232 löschen: `const ALL_SEASON_DEFAULT_VIEWS = new Set(["match-highlights"]);`
  - In `applyViewDefaults` (Z. 894–912) den ersten `if`-Zweig entfernen, sodass die Funktion so aussieht:

```js
function applyViewDefaults(route, previousView) {
  const previousGroup = viewGroupForView(previousView);
  const currentGroup = viewGroupForView(route.view);
  applyViewDataModeDefaults(route.view, previousView);
  if (previousGroup === "seasons" && currentGroup !== "seasons" && state.autoSeasonDefault) {
    state.season = "all";
    state.autoSeasonDefault = false;
  }
  if (currentGroup === "seasons" && !route.seasonId && state.season === "all") {
    state.season = "season_010";
    state.autoSeasonDefault = true;
  }
  seasonFilter.value = state.season;
}
```

Begründung: `match-highlights` liegt jetzt in `videos` — der Sonderfall "Saison-View, der auf 'alle Saisons' startet" ist leer. Beim Verlassen der Saisons-Gruppe setzt der erste Zweig die Saison wie bisher zurück.

- [ ] **Step 10: `web/styles.css` — Stack-Tabs + Werkstatt-Tab** — nach dem `.sub-tabs .tab`-Block (~Z. 404) einfügen:

```css
.stack-tabs {
  margin: -2px 0 10px;
  padding: 0 0 8px;
}

.stack-tabs[hidden] {
  display: none;
}

.stack-tabs .tab {
  min-height: 30px;
  padding: 6px 10px;
  font-size: 13px;
  border-radius: 999px;
}

.nav-group-tab.is-tool {
  margin-left: auto;
  min-height: 34px;
  align-self: center;
  padding: 7px 11px;
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  border-color: var(--line);
  background: var(--surface);
}

.nav-group-tab.is-tool::before {
  content: "🔧 ";
}

.nav-group-tab.is-tool.is-active {
  background:
    linear-gradient(135deg, var(--header-soft), #043d92 72%),
    var(--header-soft);
  border-color: var(--header-soft);
  color: #ffffff;
}
```

- [ ] **Step 11: Tests laufen lassen**

Run: `node --test tests/*.mjs`
Expected: PASS (inkl. angepasstem `web_shell.test.mjs`)

- [ ] **Step 12: Commit**

```powershell
git add web/index.html web/app.js web/styles.css tests/web_shell.test.mjs; git commit -m "feat: restructure nav into six groups with season hub and workshop tab"
```

---

### Task 4: Wegweiser-View

**Files:**
- Modify: `web/index.html` (Header-Actions ~Z. 22–35; neue Section vor `<section id="view-data-coverage">`), `web/app.js` (`VIEW_RENDERERS` ~Z. 375, `TOOLBAR_HIDDEN_VIEWS` Z. ~930, neuer Renderer), `web/styles.css`
- Test: `tests/web_shell.test.mjs`

**Interfaces:**
- Consumes: `VIEW_GROUPS`, `stackForView`, `stackDefaultView` (Import aus Task 3 vorhanden); i18n-Keys aus Task 2; `navigateToView`, `t`, `state.language` sowie die vorhandenen app.js-Helfer `escapeHtml` (app.js:8769) und `escapeAttr` (app.js:8778).
- Produces: View `wegweiser` (Section `#view-wegweiser`, Host `#wegweiser-groups`), Header-Link `#wegweiser-link`.

- [ ] **Step 1: Shell-Test erweitern (failing first)** — ans Ende von `tests/web_shell.test.mjs`:

```js
// Wegweiser: Header-Zugang + Kartenraster über alle Gruppen.
assert.equal(indexHtml.includes('id="wegweiser-link"'), true);
assert.equal(indexHtml.includes('href="#/wegweiser"'), true);
assert.equal(indexHtml.includes('id="view-wegweiser"'), true);
assert.equal(indexHtml.includes('id="wegweiser-groups"'), true);
assert.equal(appJs.includes("wegweiser: renderWegweiser"), true);
assert.equal(appJs.includes("WEGWEISER_SECTION_KEYS"), true);
assert.match(appJs, /TOOLBAR_HIDDEN_VIEWS = new Set\(\[[^\]]*"wegweiser"/);
assert.equal(stylesCss.includes(".wegweiser-card"), true);
assert.equal(stylesCss.includes(".wegweiser-grid"), true);
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `node --test tests/web_shell.test.mjs`
Expected: FAIL (`wegweiser-link` fehlt)

- [ ] **Step 3: `web/index.html` — Header-Link** — in `.header-actions` direkt nach dem `issue-link`-`</a>` einfügen:

```html
        <a class="header-button" id="wegweiser-link" href="#/wegweiser" data-i18n="nav.wegweiser">Wegweiser</a>
```

- [ ] **Step 4: `web/index.html` — Section** — direkt vor `<section id="view-data-coverage"` einfügen:

```html
      <section id="view-wegweiser" class="view">
        <div class="section-head">
          <h2 data-i18n="sections.wegweiserTitle">Wegweiser</h2>
          <p data-i18n="sections.wegweiserDescription">Alle Bereiche der Seite im Überblick – jede Karte führt direkt zur Ansicht.</p>
        </div>
        <div id="wegweiser-groups"></div>
      </section>
```

- [ ] **Step 5: `web/app.js` — Renderer** — z. B. direkt vor `function setActiveView(` einfügen (Escaper-Namen vorher gegen die Datei prüfen):

```js
// Karten speisen sich aus VIEW_GROUPS + den vorhandenen Sektionstexten, damit
// der Wegweiser ohne zweiten Pflegeort aktuell bleibt.
const WEGWEISER_SECTION_KEYS = {
  "all-time": "allTime",
  "team-rosters": "teamRosters",
  "record-book": "recordBook",
  awards: "awards",
  "hall-of-fame": "hallOfFame",
  "upset-index": "upsetIndex",
  zeitreise: "zeitreise",
  rivalries: "rivalries",
  oracle: "oracle",
  "team-duel": "teamDuel",
  killlists: "killlists",
  "pokemon-drafts": "pokemonDrafts",
  "video-archive": "videoArchive",
  cinema: "cinema",
  "match-highlights": "matchHighlights",
  "audience-history": "audienceHistory",
  zeitstrahl: "zeitstrahl",
  games: "games",
};

function wegweiserCardHtml(view, title, description) {
  return `<button type="button" class="wegweiser-card" data-wegweiser-view="${escapeAttr(view)}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </button>`;
}

function renderWegweiser() {
  const host = document.querySelector("#wegweiser-groups");
  if (!host) return;
  const lang = state.language;
  const groupsHtml = VIEW_GROUPS.filter((group) => !group.tool).map((group) => {
    const cards = [];
    const seenStacks = new Set();
    for (const view of group.views) {
      const stackId = stackForView(view);
      if (stackId) {
        if (seenStacks.has(stackId)) continue;
        seenStacks.add(stackId);
        cards.push(wegweiserCardHtml(stackDefaultView(stackId), t(lang, "seasonHub.tab"), t(lang, "wegweiser.seasonHub")));
        continue;
      }
      const sectionKey = WEGWEISER_SECTION_KEYS[view];
      if (!sectionKey) continue;
      cards.push(wegweiserCardHtml(view, t(lang, `sections.${sectionKey}Title`), t(lang, `sections.${sectionKey}Description`)));
    }
    return `<section class="wegweiser-group">
        <h3>${escapeHtml(t(lang, group.labelKey))}</h3>
        <div class="wegweiser-grid">${cards.join("")}</div>
      </section>`;
  });
  const workshop = `<p class="wegweiser-workshop">${escapeHtml(t(lang, "wegweiser.workshopNote"))}
      <button type="button" class="wegweiser-workshop-link" data-wegweiser-view="data-coverage">${escapeHtml(t(lang, "wegweiser.workshopLink"))}</button>
    </p>`;
  host.innerHTML = groupsHtml.join("") + workshop;
  host.querySelectorAll("[data-wegweiser-view]").forEach((button) => {
    button.addEventListener("click", () => navigateToView(button.dataset.wegweiserView));
  });
}
```

- [ ] **Step 6: `web/app.js` — Registrierung**
  - In `VIEW_RENDERERS` (Z. 375 ff.) ergänzen: `wegweiser: renderWegweiser,`
  - In `TOOLBAR_HIDDEN_VIEWS` (Z. ~932) `"wegweiser"` in die Set-Liste aufnehmen (die globalen Filter haben auf der Übersicht nichts zu filtern).
  - `VIEW_DATASETS` braucht KEINEN Eintrag (`ensureDatasetsForView` fällt auf `[]` zurück).

- [ ] **Step 7: `web/styles.css` — Wegweiser-Styles** (ans Datei-Ende bzw. zu den View-Blöcken):

```css
.wegweiser-group {
  margin-bottom: 24px;
}

.wegweiser-group h3 {
  margin: 0 0 10px;
}

.wegweiser-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
}

.wegweiser-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgb(6 35 65 / 6%);
}

.wegweiser-card:hover {
  border-color: rgb(17 191 243 / 55%);
  background: var(--surface-soft);
}

.wegweiser-card span {
  color: var(--muted);
  font-size: 13px;
}

.wegweiser-workshop {
  color: var(--muted);
  font-size: 13px;
  margin: 8px 0 0;
}

.wegweiser-workshop-link {
  border: 0;
  background: none;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  padding: 0;
  text-decoration: underline;
}
```

- [ ] **Step 8: Tests laufen lassen**

Run: `node --test tests/*.mjs`
Expected: PASS

- [ ] **Step 9: Commit**

```powershell
git add web/index.html web/app.js web/styles.css tests/web_shell.test.mjs; git commit -m "feat: add wegweiser overview page with header access"
```

---

### Task 5: Doku, Browser-Verifikation, Gates

**Files:**
- Modify: `README.md` (Zeile 12)
- Verify: alle Gates + Playwright

- [ ] **Step 1: README aktualisieren** — in Zeile 12 den Schluss `Navigation groups: Spieler, Duelle, Pokémon, Saisons, Videos, Rekorde, Daten.` ersetzen durch:

```
Navigation groups: Bestenlisten, Saisons, Duelle, Pokémon, Videos, Spiele, plus a tucked-away Werkstatt tab for data review. The six season views are bundled into one Saison hub with chapter sub-tabs (Akte, Spielplan, Spielbaum, Tabellenverlauf, Story, Wrapped), and a Wegweiser page (`#/wegweiser`, linked from the header) lists every area with one-line descriptions.
```

- [ ] **Step 2: Alle Gates**

Run (einzeln): `node --test tests/*.mjs` · `python -m pytest -q` · `npm run validate` · `npm run check:generated` · `git diff --check`
Expected: alles grün (Python/Daten sind unberührt; pytest/check:generated dürfen sich nicht ändern)

- [ ] **Step 3: Browser-Verifikation (Playwright)** — Dev-Server: `python scripts/serve.py 8010` (läuft evtl. schon); URL mit Cache-Buster `http://localhost:8010/web/index.html?v=nav1`. Prüfen:
  1. Start: Ewige Tabelle aktiv, Gruppe „Bestenlisten" markiert, 6 Tabs sichtbar, Werkstatt-Tab rechts abgesetzt mit 🔧.
  2. Gruppe „Saisons": Hub-Tab „Saison" + „Chronik"; Klick auf „Saison" → Akte + Unter-Tab-Zeile mit 6 Kapiteln; Kapitelwechsel (Story, Wrapped) hält die gewählte Saison; Wechsel zu „Duelle" und zurück → zuletzt offenes Kapitel wieder aktiv.
  3. Deep-Links: `#/season-story`, `#/wrapped/season_009`, `#/data-coverage` funktionieren; bei `#/wegweiser` ist keine Gruppe markiert.
  4. Tooltips: `title`-Attribut am „Orakel"-Tab entspricht der Beschreibung (Sprache wechseln → Tooltip wechselt).
  5. Wegweiser: Header-Link öffnet Kartenraster (6 Gruppen + Werkstatt-Zeile unten); Karten navigieren korrekt; en-Umschaltung übersetzt Karten.
  6. Screenshots nach Sichtung wieder löschen (landen im Repo-Root).

- [ ] **Step 4: Commit**

```powershell
git add README.md; git commit -m "docs: describe redesigned navigation in readme"
```

---

## Self-Review-Notizen (bereits eingearbeitet)

- Spec-Abdeckung: Gruppenzuschnitt (Task 1+3), Hub inkl. Merken des Unter-Tabs (Task 1+3), Umbenennungen + Tooltips (Task 2+3), Werkstatt (Task 3), Wegweiser inkl. `STANDALONE_VIEWS` und unterdrückter Gruppen-Markierung (Task 1+4), Doku (Task 5), known-limitations bleibt unverändert (Spec).
- `ALL_SEASON_DEFAULT_VIEWS` entfällt ersatzlos, weil `match-highlights` die Saisons-Gruppe verlässt; `web_shell`-Assertions dazu werden in Task 3 Step 1 ersetzt.
- In-View-Tab-Buttons (Rekordbuch etc.) durchlaufen `setActiveView` unverändert — die neue Logik ändert nur Verhalten für `data-view-stack`/`data-view-stack-member`-Buttons.
- `#/people`-Links (Gruppen-Route) fallen nach Wegfall der Gruppe auf `all-time` zurück — identisches Ziel wie vorher.
