export const RECORD_COLUMNS = ["matches", "win_pct", "wins", "losses", "draws"];

function withRecordColumns(prefix, suffix = []) {
  return [...prefix, ...RECORD_COLUMNS, ...suffix];
}

export const ALL_TIME_COLUMNS = withRecordColumns(
  ["rank", "name", "seasons_won", "title_seasons", "rating", "seasons", "season_list"],
  ["points", "kills", "deaths", "differential", "best_rank"],
);

export const POKEMON_DRAFT_COLUMNS = [
  "rank",
  "pokemon",
  "tier",
  "draft_count",
  "season_count",
  "season_list",
  "title_count",
  "title_seasons",
  "trainer_count",
  "picked_status",
  "source",
];

export const POKEMON_KILLLIST_COLUMNS = [
  "rank",
  "pokemon",
  "appearances",
  "kills",
  "deaths",
  "differential",
  "seasons",
  "season_list",
  "titles",
  "title_seasons",
  "trainers",
  "teams",
];

export const POKEMON_DETAIL_SUMMARY_COLUMNS = [
  "pokemon",
  "appearances",
  "kills",
  "deaths",
  "differential",
  "seasons",
  "season_list",
  "titles",
  "title_seasons",
  "trainers",
  "teams",
  "source",
];

export const TABLE_HISTORY_COLUMNS = withRecordColumns(
  ["season", "division", "rank", "person", "team"],
  ["points", "kills", "deaths", "differential", "source"],
);

export const SEASON_STANDINGS_COLUMNS = withRecordColumns(
  ["division", "rank", "person", "team"],
  ["points", "kills", "deaths", "differential", "status", "source"],
);

export const PERSON_SUMMARY_COLUMNS = withRecordColumns(
  ["person", "seasons", "season_list", "championships", "title_seasons"],
  ["points", "best_rank"],
);

export const PERSON_SEASON_COLUMNS = withRecordColumns(
  ["person", "season", "division", "team", "start_week", "end_week", "rank"],
  ["points", "source"],
);

export const MATCHUP_COLUMNS = ["opponent", ...RECORD_COLUMNS];
