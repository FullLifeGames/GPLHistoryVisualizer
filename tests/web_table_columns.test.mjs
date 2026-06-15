import assert from "node:assert/strict";
import {
  ALL_TIME_COLUMNS,
  MATCHUP_COLUMNS,
  PERSON_SEASON_COLUMNS,
  PERSON_SUMMARY_COLUMNS,
  POKEMON_DETAIL_SUMMARY_COLUMNS,
  POKEMON_DRAFT_COLUMNS,
  POKEMON_KILLLIST_COLUMNS,
  SEASON_STANDINGS_COLUMNS,
  TABLE_HISTORY_COLUMNS,
} from "../web/table_columns.js";

function recordWindow(columns) {
  const index = columns.indexOf("matches");
  return columns.slice(index, index + 5);
}

assert.equal(ALL_TIME_COLUMNS.includes("teams"), false);
assert.deepEqual(recordWindow(ALL_TIME_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);

assert.equal(POKEMON_DRAFT_COLUMNS.includes("team_count"), false);
assert.deepEqual(
  POKEMON_DRAFT_COLUMNS.slice(POKEMON_DRAFT_COLUMNS.indexOf("season_list") + 1, POKEMON_DRAFT_COLUMNS.indexOf("season_list") + 3),
  ["title_count", "title_seasons"],
);

assert.deepEqual(
  POKEMON_KILLLIST_COLUMNS.slice(POKEMON_KILLLIST_COLUMNS.indexOf("season_list") + 1, POKEMON_KILLLIST_COLUMNS.indexOf("season_list") + 3),
  ["titles", "title_seasons"],
);

assert.deepEqual(
  POKEMON_DETAIL_SUMMARY_COLUMNS.slice(POKEMON_DETAIL_SUMMARY_COLUMNS.indexOf("season_list") + 1, POKEMON_DETAIL_SUMMARY_COLUMNS.indexOf("season_list") + 3),
  ["titles", "title_seasons"],
);

assert.equal(PERSON_SUMMARY_COLUMNS.includes("teams"), false);
assert.deepEqual(recordWindow(PERSON_SUMMARY_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);

assert.deepEqual(recordWindow(TABLE_HISTORY_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);
assert.deepEqual(recordWindow(SEASON_STANDINGS_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);
assert.deepEqual(recordWindow(PERSON_SEASON_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);
assert.deepEqual(MATCHUP_COLUMNS, ["opponent", "matches", "win_pct", "wins", "losses", "draws"]);
