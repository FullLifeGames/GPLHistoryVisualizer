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
