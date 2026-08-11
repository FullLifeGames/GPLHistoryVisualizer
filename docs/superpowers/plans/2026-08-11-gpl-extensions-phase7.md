# Phase 7: Zeitmaschinen-Duell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `team-duel` view in the Duelle group where two (season, roster) picks produce a gen-correct matchup sheet (BST/stat comparison, defensive type matrix, interleaved speed tiers) plus a clearly labeled Elo-based "hypothetical outcome" simulation line.

**Architecture:** All computation lives in a new pure module `web/team_duel.js` that never touches the DOM or the CDN globals directly — gen mechanics arrive through an injected adapter object, so node tests run on literal fixtures and the browser degrades to text badges when `@pkmn/dex`/`@pkmn/data` are unavailable (same fallback rule as `@pkmn/img`). `app.js` builds the adapter from `window.pkmn.dex.Dex` + `window.pkmn.data.Generations`, renders the sheet, and reuses the existing Elo chronology for the simulation block.

**Tech Stack:** Static ES modules, no build step. New CDN scripts: `@pkmn/dex@0.10.11` (`window.pkmn.dex`, ~1.8 MB, deferred) and `@pkmn/data@0.9.35` (`window.pkmn.data`). Existing: `pokemonAssetId` (German name → Showdown ID), `eloChronology`, `charts`-free plain tables.

## Global Constraints

- View id `team-duel`, group `duels` (spec: "Zeitmaschinen-Duell (Phase 7, `duels` group, view id `team-duel`)").
- Generation mapping comes from the existing `ROSTER_SEASON_GENERATION` in `web/stats.js` (S1–S3 gen6, S4–S6 gen7, S7–S9 gen8, S10 gen9).
- Graceful degradation to text badges when the CDN globals are missing — page must stay useful offline.
- The Elo outcome line is a SIMULATION: dashed styling / `.simulation-badge` + i18n explainer, visually separated from the factual sheet.
- Cross-era pairs (different gens) get an explicit "different generations" note.
- German is default language; every new i18n key exists in `de` AND `en` (parity is test-enforced).
- Working language of UI copy: German first, English translation second.
- Gates on every commit: `node --test tests/*.mjs`; final: `python -m pytest -q`, `npm run validate`, `npm run check:generated`, `git diff --check`.
- Windows PowerShell 5.1: no `&&` chaining; dev server `python scripts/serve.py 8010`.

## File Structure

- Create `web/team_duel.js` — pure: roster list building, sheet computation (stats/types/speed), Elo helpers.
- Create `tests/web_team_duel.test.mjs` — fixture-driven node tests.
- Modify `web/stats.js` — export `rosterSeasonGeneration(seasonId)` (numeric gen).
- Modify `web/view_config.js`, `web/index.html`, `web/app.js`, `web/i18n.js`, `web/styles.css` — view wiring + rendering.
- Modify `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs` (only if they assert view/section lists that change).
- Modify `README.md` (Duelle feature sentence), `docs/known-limitations.md` (CDN size/offline note).

Branch: `feature/gpl-extensions-phase7` from `main`.

---

### Task 1: Roster list + generation export (`teamDuelRosters`)

**Files:**
- Create: `web/team_duel.js`
- Modify: `web/stats.js` (export numeric gen helper next to `ROSTER_SEASON_GENERATION`, line ~37)
- Test: `tests/web_team_duel.test.mjs`

**Interfaces:**
- Consumes: `team_rosters.csv` rows `{season_id, division, roster_phase, team_name, team_name_normalized, person_name, person_name_normalized, pokemon, pokemon_normalized, slot, source_urls}`.
- Produces: `rosterSeasonGeneration(seasonId) -> number` (stats.js); `teamDuelRosters(teamRosters) -> [{key, seasonId, division, teamName, personName, pokemon: string[], sourceUrls}]` sorted season → division → person, Pokémon deduped across roster phases (Hinrunde/Rückrunde union), rosters without Pokémon dropped.

- [ ] **Step 1: Write the failing tests**

```js
// tests/web_team_duel.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { teamDuelRosters } from "../web/team_duel.js";
import { rosterSeasonGeneration } from "../web/stats.js";

const ROSTER_ROWS = [
  { season_id: "season_002", division: "Regular Season", roster_phase: "", team_name: "ToxicBlast", team_name_normalized: "toxicblast", person_name: "SteveParker", person_name_normalized: "steveparker", pokemon: "Panzaeron", pokemon_normalized: "panzaeron", slot: "1", source_urls: "sheet-a" },
  { season_id: "season_002", division: "Regular Season", roster_phase: "", team_name: "ToxicBlast", team_name_normalized: "toxicblast", person_name: "SteveParker", person_name_normalized: "steveparker", pokemon: "Latios", pokemon_normalized: "latios", slot: "2", source_urls: "sheet-a" },
  { season_id: "season_008", division: "Liga 1", roster_phase: "hinrunde", team_name: "Victini Bottom", team_name_normalized: "victini bottom", person_name: "Bene", person_name_normalized: "bene", pokemon: "Roserade", pokemon_normalized: "roserade", slot: "1", source_urls: "sheet-b" },
  { season_id: "season_008", division: "Liga 1", roster_phase: "rueckrunde", team_name: "Victini Bottom", team_name_normalized: "victini bottom", person_name: "Bene", person_name_normalized: "bene", pokemon: "Roserade", pokemon_normalized: "roserade", slot: "1", source_urls: "sheet-b" },
  { season_id: "season_008", division: "Liga 1", roster_phase: "rueckrunde", team_name: "Victini Bottom", team_name_normalized: "victini bottom", person_name: "Bene", person_name_normalized: "bene", pokemon: "Zeraora", pokemon_normalized: "zeraora", slot: "2", source_urls: "sheet-b" },
];

test("rosterSeasonGeneration maps seasons to numeric generations", () => {
  assert.equal(rosterSeasonGeneration("season_002"), 6);
  assert.equal(rosterSeasonGeneration("season_004"), 7);
  assert.equal(rosterSeasonGeneration("season_008"), 8);
  assert.equal(rosterSeasonGeneration("season_010"), 9);
  assert.equal(rosterSeasonGeneration("season_999"), 9);
});

test("teamDuelRosters groups by season/division/person and dedupes across phases", () => {
  const rosters = teamDuelRosters(ROSTER_ROWS);
  assert.equal(rosters.length, 2);
  const [steve, bene] = rosters;
  assert.equal(steve.seasonId, "season_002");
  assert.equal(steve.personName, "SteveParker");
  assert.deepEqual(steve.pokemon, ["Panzaeron", "Latios"]);
  assert.equal(bene.teamName, "Victini Bottom");
  assert.deepEqual(bene.pokemon, ["Roserade", "Zeraora"]);
  assert.ok(steve.key !== bene.key);
});

test("teamDuelRosters drops rows without pokemon or identity", () => {
  const rosters = teamDuelRosters([
    { season_id: "season_001", division: "", team_name: "", person_name: "", pokemon: "Pikachu", pokemon_normalized: "pikachu" },
    { season_id: "season_001", division: "", team_name: "A", person_name: "A", pokemon: "", pokemon_normalized: "" },
  ]);
  assert.equal(rosters.length, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_team_duel.test.mjs`
Expected: FAIL — `Cannot find module '.../web/team_duel.js'` (and `rosterSeasonGeneration` not exported).

- [ ] **Step 3: Implement**

In `web/stats.js`, directly below the `ROSTER_SEASON_GENERATION` map:

```js
export function rosterSeasonGeneration(seasonId) {
  const gen = ROSTER_SEASON_GENERATION[seasonId] || "gen9";
  return Number(gen.replace("gen", ""));
}
```

Create `web/team_duel.js`:

```js
// Pure matchup-sheet computation for the Zeitmaschinen-Duell view. All
// gen-mechanical lookups go through an injected adapter so node tests run
// on literal fixtures and the browser can degrade to text badges when the
// @pkmn CDN bundles are unavailable. No DOM access.
import { pokemonAssetId } from "./pokemon_names.js";
import { rosterSeasonGeneration } from "./stats.js";

export function teamDuelRosters(teamRosters = []) {
  const byKey = new Map();
  for (const row of teamRosters ?? []) {
    const seasonId = row.season_id || "";
    const personName = row.person_name || "";
    const teamName = row.team_name || "";
    if (!seasonId || (!personName && !teamName)) continue;
    const key = JSON.stringify([
      seasonId,
      row.division || "",
      row.person_name_normalized || personName.toLowerCase(),
      row.team_name_normalized || teamName.toLowerCase(),
    ]);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        seasonId,
        division: row.division || "",
        teamName,
        personName,
        pokemon: [],
        seen: new Set(),
        sourceUrls: row.source_urls || "",
      });
    }
    const entry = byKey.get(key);
    const mon = row.pokemon || "";
    const monKey = row.pokemon_normalized || mon.toLowerCase();
    if (!mon || entry.seen.has(monKey)) continue;
    entry.seen.add(monKey);
    entry.pokemon.push(mon);
  }
  const rosters = [...byKey.values()].filter((entry) => entry.pokemon.length);
  for (const entry of rosters) delete entry.seen;
  rosters.sort(
    (a, b) =>
      a.seasonId.localeCompare(b.seasonId, "en") ||
      a.division.localeCompare(b.division, "de") ||
      (a.personName || a.teamName).localeCompare(b.personName || b.teamName, "de"),
  );
  return rosters;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_team_duel.test.mjs`
Expected: PASS (3 tests). Also run `node --test tests/web_stats.test.mjs` — still green.

- [ ] **Step 5: Commit**

```powershell
git add web/team_duel.js web/stats.js tests/web_team_duel.test.mjs
git commit -m "feat: team-duel roster grouping and numeric generation helper"
```

---

### Task 2: Matchup sheet — stats, type matrix, speed tiers (`teamDuelSheet`)

**Files:**
- Modify: `web/team_duel.js`
- Test: `tests/web_team_duel.test.mjs`

**Interfaces:**
- Consumes: rosters from Task 1; a gen adapter `{num, typeNames: string[], species(id) -> {name, types, baseStats:{hp,atk,def,spa,spd,spe}} | null, effectiveness(attackType, defTypes) -> number}` or `null` (degraded mode). Species lookup id comes from `pokemonAssetId(germanName)` (Showdown ID, e.g. "Panzaeron" → "skarmory").
- Produces: `teamDuelSheet({rosterA, rosterB, genA, genB}) -> {a, b, differentGens, degraded, speedTiers, typeMatrix}` where each side is `{roster, gen, mons: [{name, english, types, baseStats, bst}], unresolved: string[], averages: {hp..spe} | null, avgBst: number | null}`; `speedTiers` is `[{side: "a"|"b", name, english, speed}]` sorted desc; `typeMatrix` is `{a, b}` each `[{type, weak, resist, immune}]` per attacking type or `null` when degraded.

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_team_duel.test.mjs`:

```js
import { teamDuelSheet } from "../web/team_duel.js";

// Minimal fixture gen: ids are what pokemonAssetId produces from the names used.
const FIXTURE_SPECIES = {
  skarmory: { name: "Skarmory", types: ["Steel", "Flying"], baseStats: { hp: 65, atk: 80, def: 140, spa: 40, spd: 70, spe: 70 } },
  latios: { name: "Latios", types: ["Dragon", "Psychic"], baseStats: { hp: 80, atk: 90, def: 80, spa: 130, spd: 110, spe: 110 } },
  roserade: { name: "Roserade", types: ["Grass", "Poison"], baseStats: { hp: 60, atk: 70, def: 65, spa: 125, spd: 105, spe: 90 } },
};
const FIXTURE_CHART = {
  Fire: { Steel: 2, Grass: 2, Dragon: 0.5 },
  Ground: { Steel: 2, Poison: 2, Flying: 0 },
};
const FIXTURE_GEN = {
  num: 6,
  typeNames: ["Fire", "Ground"],
  species: (id) => FIXTURE_SPECIES[id] ?? null,
  effectiveness: (attackType, defTypes) => defTypes.reduce((mult, def) => mult * (FIXTURE_CHART[attackType]?.[def] ?? 1), 1),
};
const ROSTER_A = { key: "a", seasonId: "season_002", division: "Regular Season", teamName: "ToxicBlast", personName: "SteveParker", pokemon: ["Panzaeron", "Latios"], sourceUrls: "sheet-a" };
const ROSTER_B = { key: "b", seasonId: "season_008", division: "Liga 1", teamName: "Victini Bottom", personName: "Bene", pokemon: ["Roserade", "Fantexemplar"], sourceUrls: "sheet-b" };

test("teamDuelSheet resolves species, averages and flags cross-era pairs", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: FIXTURE_GEN, genB: FIXTURE_GEN });
  assert.equal(sheet.differentGens, true);
  assert.equal(sheet.degraded, false);
  assert.equal(sheet.a.mons[0].english, "Latios");
  assert.equal(sheet.a.mons[0].bst, 600);
  assert.equal(sheet.a.avgBst, Math.round((600 + 465) / 2));
  assert.equal(sheet.a.averages.spe, Math.round((110 + 70) / 2));
  assert.deepEqual(sheet.b.unresolved, ["Fantexemplar"]);
});

test("teamDuelSheet builds the defensive type matrix per attacking type", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: FIXTURE_GEN, genB: FIXTURE_GEN });
  const ground = sheet.typeMatrix.a.find((row) => row.type === "Ground");
  // Skarmory: 2 * 0 = 0 -> immune; Latios: neutral.
  assert.deepEqual(ground, { type: "Ground", weak: 0, resist: 0, immune: 1 });
  const fire = sheet.typeMatrix.a.find((row) => row.type === "Fire");
  // Skarmory: Steel 2x -> weak; Latios: Dragon 0.5 -> resist.
  assert.deepEqual(fire, { type: "Fire", weak: 1, resist: 1, immune: 0 });
});

test("teamDuelSheet interleaves speed tiers across both sides", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: FIXTURE_GEN, genB: FIXTURE_GEN });
  assert.deepEqual(
    sheet.speedTiers.map((entry) => [entry.side, entry.speed]),
    [["a", 110], ["b", 90], ["a", 70]],
  );
});

test("teamDuelSheet degrades without adapters: names kept, no stats or matrix", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: null, genB: null });
  assert.equal(sheet.degraded, true);
  assert.equal(sheet.typeMatrix.a, null);
  assert.equal(sheet.speedTiers.length, 0);
  assert.equal(sheet.a.mons.length, 2);
  assert.equal(sheet.a.avgBst, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_team_duel.test.mjs`
Expected: FAIL — `teamDuelSheet` is not exported.

- [ ] **Step 3: Implement**

Append to `web/team_duel.js`:

```js
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

function resolveSide(roster, gen) {
  if (!roster) return null;
  const mons = [];
  const unresolved = [];
  for (const name of roster.pokemon) {
    const species = gen?.species?.(pokemonAssetId(name)) ?? null;
    if (!species) {
      unresolved.push(name);
      mons.push({ name, english: "", types: [], baseStats: null, bst: null });
      continue;
    }
    const bst = STAT_KEYS.reduce((sum, key) => sum + (species.baseStats[key] ?? 0), 0);
    mons.push({ name, english: species.name, types: [...species.types], baseStats: { ...species.baseStats }, bst });
  }
  const rated = mons.filter((mon) => mon.baseStats);
  const averages = rated.length
    ? Object.fromEntries(STAT_KEYS.map((key) => [key, Math.round(rated.reduce((sum, mon) => sum + mon.baseStats[key], 0) / rated.length)]))
    : null;
  const avgBst = rated.length ? Math.round(rated.reduce((sum, mon) => sum + mon.bst, 0) / rated.length) : null;
  mons.sort((a, b) => (b.bst ?? -1) - (a.bst ?? -1) || a.name.localeCompare(b.name, "de"));
  return { roster, gen: rosterSeasonGeneration(roster.seasonId), mons, unresolved, averages, avgBst };
}

function typeProfile(side, gen) {
  if (!side || !gen?.typeNames) return null;
  return gen.typeNames.map((type) => {
    let weak = 0;
    let resist = 0;
    let immune = 0;
    for (const mon of side.mons) {
      if (!mon.types.length) continue;
      const mult = gen.effectiveness(type, mon.types);
      if (mult === 0) immune += 1;
      else if (mult > 1) weak += 1;
      else if (mult < 1) resist += 1;
    }
    return { type, weak, resist, immune };
  });
}

function speedTierList(sideA, sideB) {
  const entries = [];
  for (const [side, data] of [["a", sideA], ["b", sideB]]) {
    for (const mon of data?.mons ?? []) {
      if (mon.baseStats) entries.push({ side, name: mon.name, english: mon.english, speed: mon.baseStats.spe });
    }
  }
  entries.sort((a, b) => b.speed - a.speed || a.name.localeCompare(b.name, "de"));
  return entries;
}

export function teamDuelSheet({ rosterA = null, rosterB = null, genA = null, genB = null } = {}) {
  const a = resolveSide(rosterA, genA);
  const b = resolveSide(rosterB, genB);
  return {
    a,
    b,
    differentGens:
      Boolean(rosterA && rosterB) && rosterSeasonGeneration(rosterA.seasonId) !== rosterSeasonGeneration(rosterB.seasonId),
    degraded: !genA || !genB,
    speedTiers: speedTierList(a, b),
    typeMatrix: { a: typeProfile(a, genA), b: typeProfile(b, genB) },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_team_duel.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```powershell
git add web/team_duel.js tests/web_team_duel.test.mjs
git commit -m "feat: team-duel matchup sheet with type matrix and speed tiers"
```

---

### Task 3: Elo simulation helpers (`eloAtSeasonEnd`, `teamDuelOutcome`)

**Files:**
- Modify: `web/team_duel.js`
- Test: `tests/web_team_duel.test.mjs`

**Interfaces:**
- Consumes: `eloChronology(matches)` result from `web/elo_history.js` — `chronology.perPerson: Map<personKey, {points: [{seq, matchId, seasonId, rating}]}>` (points chronological).
- Produces: `eloAtSeasonEnd(personKey, chronology, seasonId) -> number | null` (rating after the person's last match in or before that season — era-correct, not today's Elo); `teamDuelOutcome(eloA, eloB) -> {eloA, eloB, pA, pB} | null` via the standard logistic `1/(1+10^((eloB-eloA)/400))`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/web_team_duel.test.mjs`:

```js
import { eloAtSeasonEnd, teamDuelOutcome } from "../web/team_duel.js";

test("eloAtSeasonEnd returns the rating after the last match up to that season", () => {
  const chronology = {
    perPerson: new Map([
      [
        "bene",
        {
          points: [
            { seq: 0, matchId: "m1", seasonId: "season_002", rating: 1520 },
            { seq: 1, matchId: "m2", seasonId: "season_002", rating: 1540 },
            { seq: 2, matchId: "m3", seasonId: "season_008", rating: 1610 },
          ],
        },
      ],
    ]),
  };
  assert.equal(eloAtSeasonEnd("bene", chronology, "season_002"), 1540);
  assert.equal(eloAtSeasonEnd("bene", chronology, "season_005"), 1540);
  assert.equal(eloAtSeasonEnd("bene", chronology, "season_008"), 1610);
  assert.equal(eloAtSeasonEnd("bene", chronology, "season_001"), null);
  assert.equal(eloAtSeasonEnd("unknown", chronology, "season_002"), null);
});

test("teamDuelOutcome is a symmetric logistic on the Elo gap", () => {
  const outcome = teamDuelOutcome(1600, 1400);
  assert.ok(Math.abs(outcome.pA - 0.7597) < 0.001);
  assert.ok(Math.abs(outcome.pA + outcome.pB - 1) < 1e-9);
  const even = teamDuelOutcome(1500, 1500);
  assert.equal(even.pA, 0.5);
  assert.equal(teamDuelOutcome(null, 1500), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/web_team_duel.test.mjs`
Expected: FAIL — `eloAtSeasonEnd` is not exported.

- [ ] **Step 3: Implement**

Append to `web/team_duel.js`:

```js
// Era-correct rating: the person's Elo right after their last match in or
// before the chosen season — NOT today's all-time value. Season ids sort
// chronologically as strings (season_001 … season_010).
export function eloAtSeasonEnd(personKey, chronology, seasonId) {
  const person = chronology?.perPerson?.get?.(personKey);
  if (!person) return null;
  let rating = null;
  for (const point of person.points) {
    if ((point.seasonId || "").localeCompare(seasonId, "en") > 0) break;
    rating = point.rating;
  }
  return rating;
}

export function teamDuelOutcome(eloA, eloB) {
  if (!Number.isFinite(eloA) || !Number.isFinite(eloB)) return null;
  const pA = 1 / (1 + 10 ** ((eloB - eloA) / 400));
  return { eloA, eloB, pA, pB: 1 - pA };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/web_team_duel.test.mjs`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```powershell
git add web/team_duel.js tests/web_team_duel.test.mjs
git commit -m "feat: era-correct Elo lookup and hypothetical duel outcome"
```

---

### Task 4: View wiring — config, section, i18n, CDN scripts

**Files:**
- Modify: `web/view_config.js:13` (duels views), `web/index.html` (nav handled by config; new section after `#view-oracle`, line ~870; CDN scripts near line 891), `web/i18n.js` (both language blocks), `web/app.js` (state, `TOOLBAR_HIDDEN_VIEWS`, `VIEW_DATASETS`, `VIEW_RENDERERS`, adapter + renderer), `web/styles.css`
- Test: `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs` (update assertions), `tests/web_i18n.test.mjs` (parity is automatic)

**Interfaces:**
- Consumes: everything from Tasks 1–3; `pokemonSprite`/`pokemonIcon` helpers in app.js; `eloChronology` from elo_history.js; `normalizedStatsKey` for person keys.
- Produces: view id `team-duel` reachable from the Duelle tab; `state.teamDuel = {aKey: "", bKey: ""}`; adapter factory `pkmnGenerationAdapter(genNumber)` in app.js.

- [ ] **Step 1: Update view config and its test**

In `web/view_config.js` change the duels group to:

```js
    views: ["rivalries", "oracle", "team-duel"],
```

In `tests/web_view_config.test.mjs`, find the assertion listing the duels views and add `"team-duel"`. Run `node --test tests/web_view_config.test.mjs` — must pass after the edit, and fail before it (edit test first if following strict TDD ordering).

- [ ] **Step 2: Add the section markup**

In `web/index.html` insert after the closing `</section>` of `#view-oracle` (line ~870):

```html
      <section id="view-team-duel" class="view">
        <div class="section-head">
          <h2 data-i18n="sections.teamDuelTitle">Zeitmaschinen-Duell</h2>
          <p data-i18n="sections.teamDuelDescription">Zwei Kader aus beliebigen Saisons treten auf dem Papier gegeneinander an: Statuswerte, Typen-Matrix und Speed-Tiers – generationsgetreu berechnet.</p>
        </div>
        <form id="team-duel-form" class="matchup-form">
          <label>
            <span data-i18n="teamDuel.pickA">Kader A</span>
            <select id="team-duel-a"></select>
          </label>
          <label>
            <span data-i18n="teamDuel.pickB">Kader B</span>
            <select id="team-duel-b"></select>
          </label>
        </form>
        <div id="team-duel-notes"></div>
        <div id="team-duel-sheet"></div>
        <div id="team-duel-types"></div>
        <div id="team-duel-speed"></div>
        <div id="team-duel-sim"></div>
        <p id="team-duel-sources" class="muted"></p>
      </section>
```

And add the CDN bundles next to the existing `@pkmn/img` script (line ~891):

```html
    <script src="https://unpkg.com/@pkmn/dex@0.10.11/build/index.min.js" defer></script>
    <script src="https://unpkg.com/@pkmn/data@0.9.35/build/index.min.js" defer></script>
```

(Both attach to `window.pkmn.*` exactly like `@pkmn/img`; `defer` keeps the 1.8 MB dex bundle off the critical path. The renderer treats a missing global as degraded mode, so slow loads self-heal on the next render.)

- [ ] **Step 3: Add i18n keys (de + en)**

In `web/i18n.js`, German block: `nav: { teamDuel: "Zeitmaschine" }`, flat `sections.teamDuelTitle` / `sections.teamDuelDescription` (copy from the HTML above), and a `teamDuel` namespace:

```js
    teamDuel: {
      pickA: "Kader A",
      pickB: "Kader B",
      pickTwo: "Wähle zwei Kader aus – gerne aus verschiedenen Saisons.",
      samePick: "Bitte zwei unterschiedliche Kader wählen.",
      generation: "Gen {gen}",
      differentGens: "Achtung Zeitmaschine: Die Kader stammen aus verschiedenen Generationen (Gen {genA} vs. Gen {genB}). Beide Seiten werden mit den Regeln ihrer eigenen Generation berechnet.",
      degraded: "Die Pokémon-Datenbibliothek (@pkmn) konnte nicht geladen werden – es werden nur die Kadernamen ohne Statuswerte angezeigt.",
      unresolved: "Ohne Gen-Daten: {names}.",
      statsTitle: "Statuswerte im Vergleich",
      avgRow: "Ø Team",
      bst: "BST",
      statHp: "KP",
      statAtk: "Ang",
      statDef: "Vert",
      statSpa: "SpA",
      statSpd: "SpV",
      statSpe: "Init",
      typesTitle: "Defensive Typen-Matrix",
      typesNote: "Pro Angriffstyp: Wie viele Pokémon des Kaders sind schwach, resistent oder immun?",
      weak: "schwach",
      resist: "resistent",
      immune: "immun",
      speedTitle: "Speed-Tiers",
      speedNote: "Basis-Initiative beider Kader in einer Reihenfolge – wer überholt wen?",
      simTitle: "Hypothetischer Ausgang",
      simNote: "Simulation, keine Historie: Elo-Stand beider Trainer am Ende der jeweils gewählten Saison, umgerechnet in eine Siegwahrscheinlichkeit.",
      simLine: "{a} {pa} % — {pb} % {b}",
      simMissing: "Für mindestens eine Seite gibt es keinen Elo-Stand in der gewählten Saison.",
      sources: "Quellen",
    },
```

English block mirror (same keys): `nav.teamDuel: "Time Machine"`, `sections.teamDuelTitle: "Time-Machine Duel"`, `sections.teamDuelDescription: "Two rosters from any seasons face off on paper: base stats, type matrix and speed tiers — computed with each generation's own rules."`, `pickA: "Roster A"`, `pickB: "Roster B"`, `pickTwo: "Pick two rosters — mixing seasons is the point."`, `samePick: "Please pick two different rosters."`, `generation: "Gen {gen}"`, `differentGens: "Time machine alert: these rosters come from different generations (Gen {genA} vs. Gen {genB}). Each side is computed under its own generation's rules."`, `degraded: "The Pokémon data library (@pkmn) could not be loaded — showing roster names without stats."`, `unresolved: "No gen data for: {names}."`, `statsTitle: "Base stat comparison"`, `avgRow: "Team avg"`, `bst: "BST"`, `statHp: "HP"`, `statAtk: "Atk"`, `statDef: "Def"`, `statSpa: "SpA"`, `statSpd: "SpD"`, `statSpe: "Spe"`, `typesTitle: "Defensive type matrix"`, `typesNote: "Per attacking type: how many of the roster's Pokémon are weak, resistant or immune?"`, `weak: "weak"`, `resist: "resist"`, `immune: "immune"`, `speedTitle: "Speed tiers"`, `speedNote: "Both rosters' base speed in one ordering — who outruns whom?"`, `simTitle: "Hypothetical outcome"`, `simNote: "Simulation, not history: both trainers' Elo at the end of their chosen season, converted to a win probability."`, `simLine: "{a} {pa} % — {pb} % {b}"`, `simMissing: "At least one side has no Elo record in the chosen season."`, `sources: "Sources"`.

Run `node --test tests/web_i18n.test.mjs` — parity must hold.

- [ ] **Step 4: Wire app.js**

1. Imports: add `teamDuelRosters, teamDuelSheet, eloAtSeasonEnd, teamDuelOutcome` from `./team_duel.js`; ensure `eloChronology` import from `./elo_history.js` exists (it does for the Elo views — reuse the cached chronology helper if present, else `eloChronology(state.data.matches)` memoized in a module-level `let cachedDuelChronology`).
2. `state.teamDuel = { aKey: "", bKey: "" };` next to `state.oracle` (line ~298).
3. `TOOLBAR_HIDDEN_VIEWS` (line 917): add `"team-duel"`.
4. `VIEW_DATASETS`: `"team-duel": ["teamRosters"]`.
5. `VIEW_RENDERERS`: `"team-duel": renderTeamDuel` and add the view to the language-change rerender list beside `renderOracle()` (line ~542).
6. Adapter factory + renderer (place near `renderOracle`):

```js
let pkmnGenerationsCache;
function pkmnGenerationAdapter(genNumber) {
  const data = window.pkmn?.data;
  const dexSource = window.pkmn?.dex?.Dex;
  if (!data?.Generations || !dexSource) return null;
  if (pkmnGenerationsCache === undefined) {
    try {
      pkmnGenerationsCache = new data.Generations(dexSource);
    } catch {
      pkmnGenerationsCache = null;
    }
  }
  const gen = pkmnGenerationsCache?.get?.(genNumber);
  if (!gen) return null;
  return {
    num: genNumber,
    typeNames: [...gen.types].map((type) => type.name),
    species: (id) => {
      const species = gen.species.get(id);
      return species ? { name: species.name, types: [...species.types], baseStats: { ...species.baseStats } } : null;
    },
    effectiveness: (attackType, defTypes) => {
      const type = gen.types.get(attackType);
      if (!type) return 1;
      return defTypes.reduce((mult, def) => mult * (type.effectiveness[def] ?? 1), 1);
    },
  };
}
```

`renderTeamDuel()` responsibilities (follow `renderOracle`'s structure):
- `const rosters = teamDuelRosters(state.data.teamRosters ?? [])`; populate `#team-duel-a` / `#team-duel-b` with one `<optgroup>` per season (`label = seasonDisplay(seasonId)`), option label `"${division} · ${personName || teamName}${teamName && personName ? ` (${teamName})` : ""}"`, option value = roster `key`; keep current selection.
- `change` listeners (registered once in the central listener-setup section, like `#oracle-form`): write `state.teamDuel.aKey/bKey`, call `renderTeamDuel()`.
- No picks / same pick → `#team-duel-notes` shows `teamDuel.pickTwo` / `teamDuel.samePick` muted; clear the other containers.
- With both rosters: `genA = pkmnGenerationAdapter(rosterSeasonGeneration(rosterA.seasonId))` (import `rosterSeasonGeneration` from stats.js), same for B; `sheet = teamDuelSheet({rosterA, rosterB, genA, genB})`.
- Notes: `differentGens` → info box with genA/genB substitution; `degraded` → `teamDuel.degraded`; per-side `unresolved` → `teamDuel.unresolved`.
- `#team-duel-sheet`: two-column grid; per side a header (`personName`, `teamName`, `seasonDisplay`, `Gen {gen}` chip) and a table: one row per mon — `pokemonIcon(mon.name)`, name, type badges (plain `<span class="team-duel-type">`), six stats + BST; footer row `avgRow` with `averages` + `avgBst`. Degraded mode: same table with only icon + name columns.
- `#team-duel-types`: table with 18 rows (union of both sides' `typeNames`; when matrix side is null render "—"), columns `type | A weak/resist/immune | B weak/resist/immune`.
- `#team-duel-speed`: single list sorted by the returned order; each entry a row with side marker (A/B color dot), `pokemonIcon`, name, speed value.
- `#team-duel-sim`: `.simulation-badge` + `simNote`; `keyA = normalizedStatsKey(rosterA.personName || rosterA.teamName)`; chronology memoized; `outcome = teamDuelOutcome(eloAtSeasonEnd(keyA, chronology, rosterA.seasonId), eloAtSeasonEnd(keyB, chronology, rosterB.seasonId))`; render `simLine` with `Math.round(pA*100)` / rounded Elo values, or `simMissing`.
- `#team-duel-sources`: `teamDuel.sources` + up to 3 links per side from `roster.sourceUrls.split(";")` (follow the wrapped-card sources pattern).

- [ ] **Step 5: Styles**

In `web/styles.css` (near the oracle/matchup styles), add — using the existing `--line` variable, not `--border`:

```css
.team-duel-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 12px; }
.team-duel-side h3 { margin: 0 0 4px; }
.team-duel-gen { display: inline-block; padding: 1px 8px; border: 1px solid var(--line); border-radius: 999px; font-size: 0.8rem; margin-left: 6px; }
.team-duel-type { display: inline-block; padding: 0 6px; border: 1px solid var(--line); border-radius: 6px; font-size: 0.75rem; margin-right: 4px; }
.team-duel-speed-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; border-bottom: 1px solid var(--line); }
.team-duel-side-dot { width: 10px; height: 10px; border-radius: 50%; }
.team-duel-side-dot.side-a { background: var(--accent); }
.team-duel-side-dot.side-b { background: var(--muted); }
.team-duel-sim { border: 1px dashed var(--line); border-radius: 10px; padding: 12px 16px; margin-top: 16px; }
```

- [ ] **Step 6: Update shell test and run the suites**

Check `tests/web_shell.test.mjs` for assertions over section ids or nav entries; add `view-team-duel` where the pattern requires it. Then:

Run: `node --test tests/*.mjs`
Expected: all green (including i18n parity and view-config).

- [ ] **Step 7: Commit**

```powershell
git add web/view_config.js web/index.html web/i18n.js web/app.js web/styles.css tests/web_view_config.test.mjs tests/web_shell.test.mjs
git commit -m "feat: Zeitmaschinen-Duell view with gen-correct matchup sheet"
```

---

### Task 5: Browser verification + docs + gates

**Files:**
- Modify: `README.md:15` (Duelle sentence), `docs/known-limitations.md`

- [ ] **Step 1: Verify in the browser (Playwright)**

Dev server: `python scripts/serve.py 8010` (may already run in background). Open `http://localhost:8010/web/`, navigate Duelle → Zeitmaschine. Verify:
- Same-gen pair (two S8 rosters): stats table with plausible BST values, 18-row type matrix, interleaved speed list, simulation box with percentages and Elo values, no different-gens note.
- Cross-era pair (S2 vs S10): different-gens note appears with Gen 6 vs. Gen 9; both sides still render (each under its own gen); S2-era megas resolve in gen 6.
- Language toggle EN: all labels switch.
- Degradation: block `unpkg.com` via Playwright route (or evaluate `window.pkmn.dex = undefined` before render) → degraded note + name-only tables, no errors in console.
- Screenshots: view them, then delete the files from the repo root.

- [ ] **Step 2: Docs**

README line 15, extend the Duelle sentence with: "…win-chain dominance, and the Zeitmaschinen-Duell, which lets two rosters from any seasons face off on paper with generation-correct stats, type matrices, speed tiers, and a clearly labeled hypothetical Elo outcome."

`docs/known-limitations.md`: add a bullet — the Zeitmaschinen-Duell loads `@pkmn/dex` (~1.8 MB) + `@pkmn/data` from unpkg at runtime; offline or CDN-blocked sessions degrade to name-only rosters; the hypothetical outcome is an Elo simulation, not history; Pokémon that never got a Showdown-ID mapping appear under "Ohne Gen-Daten".

- [ ] **Step 3: Full gates**

```powershell
node --test tests/*.mjs
python -m pytest -q
npm run validate
npm run check:generated
git diff --check
```

Expected: all green (Python suite untouched by this phase — must stay at 218 passing).

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/known-limitations.md
git commit -m "docs: document Zeitmaschinen-Duell and its CDN dependency"
```

- [ ] **Step 5: Finish the branch**

Announce and use superpowers:finishing-a-development-branch (verify gates on the tip, then present merge/PR/keep options; base branch is `main`).
