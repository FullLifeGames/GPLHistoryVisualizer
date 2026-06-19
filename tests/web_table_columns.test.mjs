import assert from "node:assert/strict";
import {
  ALL_TIME_COLUMNS,
  COLUMN_PROFILE_KEYS,
  MATCHUP_COLUMNS,
  PERSON_SEASON_COLUMNS,
  POKEMON_DRAFT_COLUMNS,
  POKEMON_KILLLIST_COLUMNS,
  SEASON_STANDINGS_COLUMNS,
  TABLE_HISTORY_COLUMNS,
  TEAM_ROSTER_COLUMNS,
  TEAM_ROSTER_POKEMON_COLUMNS,
  columnsForProfile,
} from "../web/table_columns.js";

function recordWindow(columns) {
  const index = columns.indexOf("matches");
  return columns.slice(index, index + 5);
}

assert.equal(ALL_TIME_COLUMNS.includes("teams"), false);
assert.equal(ALL_TIME_COLUMNS.includes("elo"), true);
assert.equal(ALL_TIME_COLUMNS.at(-1), "elo");
assert.ok(ALL_TIME_COLUMNS.indexOf("rating") < ALL_TIME_COLUMNS.indexOf("elo"));
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

assert.deepEqual(recordWindow(TABLE_HISTORY_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);
assert.deepEqual(recordWindow(SEASON_STANDINGS_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);
assert.deepEqual(recordWindow(PERSON_SEASON_COLUMNS), ["matches", "win_pct", "wins", "losses", "draws"]);
assert.deepEqual(MATCHUP_COLUMNS, ["opponent", "matches", "win_pct", "wins", "losses", "draws"]);

assert.deepEqual(COLUMN_PROFILE_KEYS, ["compact", "performance", "history", "sources", "full"]);
assert.deepEqual(columnsForProfile(ALL_TIME_COLUMNS, "compact"), ["rank", "name", "seasons_won", "rating", "seasons", "matches", "win_pct", "points", "elo"]);
assert.equal(columnsForProfile(POKEMON_KILLLIST_COLUMNS, "compact").includes("seasons"), true);
assert.equal(columnsForProfile(POKEMON_DRAFT_COLUMNS, "compact").includes("season_count"), true);
assert.deepEqual(columnsForProfile(ALL_TIME_COLUMNS), ALL_TIME_COLUMNS);
assert.deepEqual(TEAM_ROSTER_COLUMNS.slice(0, 12), [
  "rank",
  "season",
  "division",
  "roster_phase",
  "variants",
  "person",
  "team",
  "roster_score",
  "performance_score",
  "balance_score",
  "history_score",
  "confidence_score",
]);
assert.deepEqual(TEAM_ROSTER_POKEMON_COLUMNS.slice(0, 12), [
  "rank",
  "pokemon",
  "pokemon_score",
  "performance_score",
  "history_score",
  "confidence_score",
  "appearances",
  "kills",
  "deaths",
  "differential",
  "title_count",
  "draft_count",
]);
assert.deepEqual(TEAM_ROSTER_POKEMON_COLUMNS.slice(-7), [
  "season",
  "division",
  "roster_phase",
  "person",
  "team",
  "slot",
  "source",
]);
assert.deepEqual(columnsForProfile(TEAM_ROSTER_COLUMNS, "compact"), ["rank", "season", "division", "roster_phase", "variants", "person", "team", "roster_score", "pokemon_count", "roster_flags"]);
assert.equal(columnsForProfile(["season", "videos", "source"], "compact").includes("videos"), true);
assert.equal(columnsForProfile(["season", "videos", "source"], "sources").includes("videos"), true);
assert.deepEqual(columnsForProfile(ALL_TIME_COLUMNS, "performance"), [
  "rank",
  "name",
  "seasons_won",
  "rating",
  "seasons",
  "matches",
  "win_pct",
  "wins",
  "losses",
  "draws",
  "points",
  "kills",
  "deaths",
  "differential",
  "best_rank",
  "elo",
]);
assert.deepEqual(columnsForProfile(ALL_TIME_COLUMNS, "history"), ["rank", "name", "seasons_won", "title_seasons", "seasons", "season_list", "best_rank"]);
assert.deepEqual(columnsForProfile(ALL_TIME_COLUMNS, "full"), ALL_TIME_COLUMNS);

const videoColumns = [
  "season",
  "division",
  "video_type",
  "stage",
  "detected_week",
  "perspective_person",
  "opponent",
  "title",
  "channel",
  "match_status",
  "confidence",
  "confidence_tier",
  "match_basis",
  "confidence_explanation",
  "match_id",
  "published_at",
];
assert.deepEqual(columnsForProfile(videoColumns, "compact"), [
  "season",
  "division",
  "video_type",
  "detected_week",
  "perspective_person",
  "opponent",
  "title",
  "match_status",
]);
assert.deepEqual(columnsForProfile(videoColumns, "sources"), [
  "season",
  "division",
  "video_type",
  "title",
  "match_status",
  "confidence",
  "confidence_tier",
  "match_basis",
  "confidence_explanation",
  "match_id",
]);
