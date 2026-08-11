import test from "node:test";
import assert from "node:assert/strict";
import { teamDuelRosters, teamDuelSheet, eloAtSeasonEnd, teamDuelOutcome } from "../web/team_duel.js";
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
