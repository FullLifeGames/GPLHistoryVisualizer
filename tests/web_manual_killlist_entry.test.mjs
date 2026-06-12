import assert from "node:assert/strict";
import {
  MANUAL_KILLLIST_FIELDS,
  buildManualKilllistRows,
  csvFromRows,
  playerOptionsForSeason,
  reviewableKilllistRows,
} from "../web/manual_killlist_entry.js";

const sourceUrl = "https://docs.google.com/spreadsheets/d/old/edit#gid=1";

assert.deepEqual(
  reviewableKilllistRows([
    {
      season_id: "season_003",
      division: "Regular Season",
      stage: "regular_season",
      pokemon: "Snibunna",
      pokemon_normalized: "snibunna",
      kills: "20",
      trainer: "",
      data_status: "sheet_extracted",
      source_urls: sourceUrl,
    },
    {
      season_id: "season_003",
      division: "Regular Season",
      stage: "regular_season",
      pokemon: "Snibunna",
      pokemon_normalized: "snibunna",
      kills: "20",
      trainer: "Bene",
      trainer_normalized: "bene",
      team_name: "Unlimited Blade Works",
      data_status: "manual_override",
      source_urls: `${sourceUrl};data/manual/pokemon_killlists.csv`,
    },
    {
      season_id: "season_006",
      division: "Regular Season",
      stage: "regular_season",
      pokemon: "Pikachu",
      pokemon_normalized: "pikachu",
      kills: "12",
      data_status: "sheet_extracted",
      source_urls: sourceUrl,
    },
  ]).map((row) => ({ pokemon: row.pokemon, trainer: row.trainer, status: row.data_status })),
  [{ pokemon: "Snibunna", trainer: "Bene", status: "manual_override" }],
);

assert.deepEqual(
  playerOptionsForSeason(
    "season_003",
    "Regular Season",
    [
      {
        season_id: "season_003",
        division: "Regular Season",
        person_id: "person_lucariolp",
        person_name: "LucarioLP",
        person_name_normalized: "lucariolp",
        team_name: "Unlimited Blade Works",
        start_week: "1",
        end_week: "10",
      },
      {
        season_id: "season_003",
        division: "Regular Season",
        person_id: "person_bene",
        person_name: "Bene",
        person_name_normalized: "bene",
        team_name: "Unlimited Blade Works",
        start_week: "11",
        end_week: "26",
      },
    ],
    [],
  ).map((option) => option.label),
  ["Bene - Unlimited Blade Works (ST 11-26)", "LucarioLP - Unlimited Blade Works (ST 1-10)"],
);

const rows = buildManualKilllistRows(
  [
    {
      season_id: "season_003",
      division: "Regular Season",
      stage: "regular_season",
      pokemon: "Snibunna",
      pokemon_normalized: "snibunna",
      appearances: "",
      kills: "20",
      deaths: "",
      differential: "",
      source_urls: sourceUrl,
    },
  ],
  new Map([
    [
      "season_003|Regular Season|regular_season|snibunna",
      {
        person_id: "person_bene",
        person_name: "Bene",
        person_name_normalized: "bene",
        team_name: "Unlimited Blade Works",
      },
    ],
  ]),
  "data/manual/pokemon_killlists.csv",
);

assert.deepEqual(rows, [
  {
    season_id: "season_003",
    division: "Regular Season",
    stage: "regular_season",
    pokemon: "Snibunna",
    pokemon_normalized: "snibunna",
    trainer: "Bene",
    trainer_normalized: "bene",
    team_name: "Unlimited Blade Works",
    appearances: "",
    kills: "20",
    deaths: "",
    differential: "",
    data_status: "manual_override",
    source_urls: `${sourceUrl};data/manual/pokemon_killlists.csv`,
  },
]);

assert.equal(
  csvFromRows(MANUAL_KILLLIST_FIELDS, rows),
  [
    "season_id,division,stage,pokemon,pokemon_normalized,trainer,trainer_normalized,team_name,appearances,kills,deaths,differential,data_status,source_urls",
    'season_003,Regular Season,regular_season,Snibunna,snibunna,Bene,bene,Unlimited Blade Works,,20,,,manual_override,https://docs.google.com/spreadsheets/d/old/edit#gid=1;data/manual/pokemon_killlists.csv',
    "",
  ].join("\n"),
);
