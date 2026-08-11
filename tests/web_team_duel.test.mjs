import test from "node:test";
import assert from "node:assert/strict";
import { teamDuelRosters, teamDuelSheet, eloAtSeasonEnd, teamDuelOutcome, hypotheticalSix, teamDuelActualOutcome } from "../web/team_duel.js";
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

test("teamDuelRosters keeps roster phases apart — Hin- and Rückrunde are different teams", () => {
  const rosters = teamDuelRosters(ROSTER_ROWS);
  assert.equal(rosters.length, 3);
  const [steve, beneHin, beneRueck] = rosters;
  assert.equal(steve.seasonId, "season_002");
  assert.equal(steve.personName, "SteveParker");
  assert.equal(steve.phase, "");
  assert.deepEqual(steve.pokemon, ["Panzaeron", "Latios"]);
  assert.equal(beneHin.phase, "hinrunde");
  assert.deepEqual(beneHin.pokemon, ["Roserade"]);
  assert.equal(beneRueck.phase, "rueckrunde");
  assert.deepEqual(beneRueck.pokemon, ["Roserade", "Zeraora"]);
  assert.equal(new Set([steve.key, beneHin.key, beneRueck.key]).size, 3);
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
  skarmory: { name: "Skarmory", types: ["Steel", "Flying"], baseStats: { hp: 65, atk: 80, def: 140, spa: 40, spd: 70, spe: 70 }, abilities: ["Sturdy", "Keen Eye"] },
  latios: { name: "Latios", types: ["Dragon", "Psychic"], baseStats: { hp: 80, atk: 90, def: 80, spa: 130, spd: 110, spe: 110 }, abilities: ["Levitate"] },
  roserade: { name: "Roserade", types: ["Grass", "Poison"], baseStats: { hp: 60, atk: 70, def: 65, spa: 125, spd: 105, spe: 90 }, abilities: ["Natural Cure", "Poison Point"] },
  rotomwash: { name: "Rotom-Wash", types: ["Electric", "Water"], baseStats: { hp: 50, atk: 65, def: 107, spa: 105, spd: 107, spe: 86 }, abilities: ["Levitate"] },
  bronzong: { name: "Bronzong", types: ["Steel", "Psychic"], baseStats: { hp: 67, atk: 89, def: 116, spa: 79, spd: 116, spe: 33 }, abilities: ["Levitate", "Heatproof"] },
  hariyama: { name: "Hariyama", types: ["Fighting"], baseStats: { hp: 144, atk: 120, def: 60, spa: 40, spd: 60, spe: 50 }, abilities: ["Thick Fat", "Guts"] },
  miltank: { name: "Miltank", types: ["Normal"], baseStats: { hp: 95, atk: 80, def: 105, spa: 40, spd: 70, spe: 100 }, abilities: ["Thick Fat"] },
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
const ROSTER_B = { key: "b", seasonId: "season_008", division: "Liga 1", teamName: "Victini Bottom", personName: "Bene", pokemon: ["Roserade", "Fantexemplar", "Rotom-Wasch", "Bronzong", "Hariyama", "Miltank"], sourceUrls: "sheet-b" };

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
  // Skarmory: 2 * 0 = 0 -> immune by typing; Latios: Levitate -> immune.
  assert.deepEqual(ground, { type: "Ground", weak: 0, resist: 0, immune: 2 });
  const fire = sheet.typeMatrix.a.find((row) => row.type === "Fire");
  // Skarmory: Steel 2x -> weak; Latios: Dragon 0.5 -> resist.
  assert.deepEqual(fire, { type: "Fire", weak: 1, resist: 1, immune: 0 });
});

test("teamDuelSheet folds ability effects straight into the counts", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: FIXTURE_GEN, genB: FIXTURE_GEN });
  const ground = sheet.typeMatrix.b.find((row) => row.type === "Ground");
  // Roserade: Poison 2x -> weak. Rotom-Wash AND Bronzong: Levitate -> immune
  // (any ability the species can have counts). Hariyama/Miltank: neutral.
  assert.deepEqual(ground, { type: "Ground", weak: 1, resist: 0, immune: 2 });
  const fire = sheet.typeMatrix.b.find((row) => row.type === "Fire");
  // Roserade: Grass 2x -> weak. Bronzong: Steel 2x halved by Heatproof ->
  // neutral. Hariyama and Miltank: Thick Fat halves -> resist.
  assert.deepEqual(fire, { type: "Fire", weak: 1, resist: 2, immune: 0 });
});

test("teamDuelSheet interleaves speed tiers across both sides", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: FIXTURE_GEN, genB: FIXTURE_GEN });
  assert.deepEqual(
    sheet.speedTiers.map((entry) => [entry.side, entry.speed]),
    [["a", 110], ["b", 100], ["b", 90], ["b", 86], ["a", 70], ["b", 50], ["b", 33]],
  );
});

test("teamDuelSheet degrades without adapters: names kept, no stats or matrix", () => {
  const sheet = teamDuelSheet({ rosterA: ROSTER_A, rosterB: ROSTER_B, genA: null, genB: null });
  assert.equal(sheet.degraded, true);
  assert.equal(sheet.typeMatrix.a, null);
  assert.equal(sheet.speedTiers.length, 0);
  assert.equal(sheet.a.mons.length, 2);
  assert.equal(sheet.b.mons.length, 6);
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

const NO_EFFECTS = { immune: new Set(), resist: new Set() };
const sixMon = (name, types, bst) => ({
  name,
  english: name,
  types,
  baseStats: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 50 },
  bst,
  abilityEffects: NO_EFFECTS,
});

test("hypotheticalSix picks by contribution, not raw BST", () => {
  // FIXTURE_GEN types: Fire (hits Steel/Grass, resisted by Dragon) and
  // Ground (hits Steel/Poison, blanked by Flying).
  const side = {
    mons: [
      sixMon("Steel1", ["Steel"], 600),
      sixMon("Steel2", ["Steel"], 590),
      sixMon("Dragon", ["Dragon"], 400),
      sixMon("Bird", ["Flying"], 380),
      sixMon("Grass", ["Grass"], 610),
      sixMon("Normal", ["Normal"], 650),
      sixMon("Steel3", ["Steel"], 585),
    ],
  };
  const result = hypotheticalSix(side, FIXTURE_GEN);
  assert.equal(result.picks.length, 6);
  // The Fire-resisting Dragon leads despite the lowest BST on the roster —
  // it offers a resistance and a fresh type, which outweighs raw stats.
  assert.equal(result.picks[0].mon.name, "Dragon");
  assert.ok(result.picks[0].resists.includes("Fire"));
  // The stacked-weakness penalty pushes the third Steel out entirely.
  assert.ok(!result.picks.some((pick) => pick.mon.name === "Steel3"));
});

test("hypotheticalSix covers open weaknesses of earlier picks", () => {
  const side = {
    mons: [sixMon("Anchor", ["Steel"], 900), sixMon("Dragon", ["Dragon"], 400), sixMon("Bird", ["Flying"], 380)],
  };
  const result = hypotheticalSix(side, FIXTURE_GEN);
  // The huge Steel anchor goes first and is weak to Fire and Ground; the
  // next picks are chosen because they cover those open weaknesses.
  assert.equal(result.picks[0].mon.name, "Anchor");
  assert.ok(result.picks[1].covers.length > 0);
  assert.deepEqual(result.openWeaknesses, []);
});

test("hypotheticalSix reports weaknesses nobody covers", () => {
  const side = { mons: [sixMon("Steel1", ["Steel"], 600)] };
  const result = hypotheticalSix(side, FIXTURE_GEN);
  assert.deepEqual(result.openWeaknesses, ["Fire", "Ground"]);
});

test("hypotheticalSix returns what it can for small or degraded sides", () => {
  assert.deepEqual(hypotheticalSix(null, FIXTURE_GEN), { picks: [], openWeaknesses: [] });
  const side = { mons: [{ name: "X", english: "", types: [], baseStats: null, bst: null, abilityEffects: NO_EFFECTS }] };
  assert.deepEqual(hypotheticalSix(side, FIXTURE_GEN), { picks: [], openWeaknesses: [] });
});

test("teamDuelActualOutcome finds real meetings, season-scoped for same-season pairs", () => {
  const matches = [
    { season_id: "season_008", week: "Spieltag 5", stage: "regular_season", player_a: "Bene", player_b: "Dauni", score_a: "2", score_b: "1", winner: "Bene", source_urls: "u1" },
    { season_id: "season_009", week: "Spieltag 2", stage: "regular_season", player_a: "Dauni", player_b: "Bene", score_a: "0", score_b: "3", winner: "Bene", source_urls: "u2" },
    { season_id: "season_008", week: "Spieltag 9", stage: "regular_season", player_a: "Other", player_b: "Bene", score_a: "1", score_b: "2", winner: "Bene", source_urls: "u3" },
    { season_id: "season_008", week: "Spieltag 11", stage: "regular_season", player_a: "Bene", player_b: "Dauni", score_a: "1", score_b: "1", winner: "", source_urls: "u4" },
  ];
  const norm = (value) => String(value).toLowerCase();
  const sameSeason = teamDuelActualOutcome(matches, "bene", "dauni", "season_008", "season_008", norm);
  assert.equal(sameSeason.scope, "season");
  assert.equal(sameSeason.meetings.length, 2);
  assert.equal(sameSeason.winsA, 1);
  assert.equal(sameSeason.draws, 1);
  assert.equal(sameSeason.meetings[1].scoreA, "1");
  const career = teamDuelActualOutcome(matches, "bene", "dauni", "season_008", "season_009", norm);
  assert.equal(career.scope, "career");
  assert.equal(career.meetings.length, 3);
  assert.equal(career.winsA, 2);
  assert.equal(career.meetings[1].scoreA, "3");
  assert.equal(teamDuelActualOutcome(matches, "bene", "nobody", "season_008", "season_008", norm), null);
});

test("hypotheticalSix builds against the opposing roster", () => {
  const side = { mons: [sixMon("Flame", ["Fire"], 500), sixMon("Norm", ["Normal"], 650)] };
  const opponent = { mons: [sixMon("S1", ["Steel"], 500), sixMon("S2", ["Steel"], 500), sixMon("S3", ["Steel"], 500)] };
  const result = hypotheticalSix(side, FIXTURE_GEN, opponent);
  // Fire hits all three Steel foes super-effectively, which beats the
  // Normal type's 150 extra BST.
  assert.equal(result.picks[0].mon.name, "Flame");
  assert.equal(result.picks[0].threatens, 3);
  // Without an opponent the ordering flips back to the neutral heuristic.
  const solo = hypotheticalSix(side, FIXTURE_GEN);
  assert.equal(solo.picks[0].mon.name, "Norm");
});
