import assert from "node:assert/strict";
import {
  TEAM_POKEMON_USAGE_FIELDS,
  buildTeamPokemonUsageRows,
  candidateOptionsForSeason,
  csvFromRows,
  defaultSuggestionForSlot,
  groupSlots,
} from "../web/team_graphics_entry.js";

const killlists = [
  { season_id: "season_005", pokemon: "Snibunna", pokemon_normalized: "snibunna", kills: "24", data_status: "sheet_extracted" },
  { season_id: "season_005", pokemon: "Magearna", pokemon_normalized: "magearna", kills: "33", data_status: "sheet_extracted" },
  { season_id: "season_005", pokemon: "Magearna", pokemon_normalized: "magearna", kills: "33", data_status: "sheet_extracted" },
  { season_id: "season_004", pokemon: "Trikephalo", pokemon_normalized: "trikephalo", kills: "26", data_status: "sheet_extracted" },
];

assert.deepEqual(
  candidateOptionsForSeason(killlists, "season_005").map((row) => `${row.pokemon}:${row.kills}`),
  ["Magearna:33", "Snibunna:24"],
);

const slots = [
  {
    slot_id: "season_005_victini_bottom_01",
    season_id: "season_005",
    division: "Liga 1",
    graphic_group: "season_005_victini_bottom",
    graphic_row: "",
    slot_number: "1",
    team_name: "Victini Bottom",
    team_name_normalized: "victini bottom",
    person_name: "Bene",
    person_name_normalized: "bene",
    image_path: "../output/team-graphics/s5/Victini Bottom.png",
    source_file: "output/team-graphics/s5/Victini Bottom.png",
  },
  {
    slot_id: "season_005_victini_bottom_02",
    season_id: "season_005",
    division: "Liga 1",
    graphic_group: "season_005_victini_bottom",
    graphic_row: "",
    slot_number: "2",
    team_name: "Victini Bottom",
    team_name_normalized: "victini bottom",
    person_name: "Bene",
    person_name_normalized: "bene",
    image_path: "../output/team-graphics/s5/Victini Bottom.png",
    source_file: "output/team-graphics/s5/Victini Bottom.png",
  },
];

assert.equal(defaultSuggestionForSlot(slots[0], candidateOptionsForSeason(killlists, "season_005"), new Map()).pokemon, "Magearna");
assert.equal(
  defaultSuggestionForSlot(
    slots[1],
    candidateOptionsForSeason(killlists, "season_005"),
    new Map([[slots[0].slot_id, { pokemon_normalized: "magearna" }]]),
  ).pokemon,
  "Snibunna",
);

assert.deepEqual(
  groupSlots(slots).map((group) => ({ key: group.key, team: group.team_name, count: group.slots.length })),
  [{ key: "season_005_victini_bottom", team: "Victini Bottom", count: 2 }],
);

const rows = buildTeamPokemonUsageRows(
  slots,
  new Map([[slots[0].slot_id, { pokemon: "Magearna", pokemon_normalized: "magearna" }]]),
  new Map(),
  "data/manual/team_pokemon_usage.csv",
);

assert.deepEqual(rows, [
  {
    season_id: "season_005",
    division: "Liga 1",
    team_name: "Victini Bottom",
    team_name_normalized: "victini bottom",
    person_name: "Bene",
    person_name_normalized: "bene",
    pokemon: "Magearna",
    pokemon_normalized: "magearna",
    slot: "1",
    source_file: "output/team-graphics/s5/Victini Bottom.png",
    source_urls: "data/manual/team_pokemon_usage.csv",
    data_status: "manual_override",
  },
]);

assert.equal(
  csvFromRows(TEAM_POKEMON_USAGE_FIELDS, rows),
  [
    "season_id,division,team_name,team_name_normalized,person_name,person_name_normalized,pokemon,pokemon_normalized,slot,source_file,source_urls,data_status",
    "season_005,Liga 1,Victini Bottom,victini bottom,Bene,bene,Magearna,magearna,1,output/team-graphics/s5/Victini Bottom.png,data/manual/team_pokemon_usage.csv,manual_override",
    "",
  ].join("\n"),
);
