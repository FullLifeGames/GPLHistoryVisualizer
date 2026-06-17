export const RECORD_COLUMNS = ["matches", "win_pct", "wins", "losses", "draws"];

function withRecordColumns(prefix, suffix = []) {
  return [...prefix, ...RECORD_COLUMNS, ...suffix];
}

export const ALL_TIME_COLUMNS = withRecordColumns(
  ["rank", "name", "seasons_won", "title_seasons", "rating", "seasons", "season_list"],
  ["points", "kills", "deaths", "differential", "best_rank", "elo"],
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

export const TEAM_ROSTER_COLUMNS = [
  "rank",
  "season",
  "division",
  "person",
  "team",
  "roster_score",
  "power_score",
  "performance_score",
  "balance_score",
  "history_score",
  "confidence_score",
  "pokemon_count",
  "avg_tier_rank",
  "top_pokemon",
  "appearances",
  "kills",
  "deaths",
  "differential",
  "roster_flags",
  "source",
];

export const TEAM_ROSTER_POKEMON_COLUMNS = [
  "rank",
  "season",
  "division",
  "person",
  "team",
  "slot",
  "pokemon",
  "pokemon_score",
  "power_score",
  "performance_score",
  "history_score",
  "confidence_score",
  "tier",
  "tier_rank",
  "draft_count",
  "title_count",
  "appearances",
  "kills",
  "deaths",
  "differential",
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

export const PERSON_SEASON_COLUMNS = withRecordColumns(
  ["person", "season", "division", "team", "start_week", "end_week", "rank"],
  ["points", "source"],
);

export const MATCHUP_COLUMNS = ["opponent", ...RECORD_COLUMNS];

export const COLUMN_PROFILE_KEYS = ["compact", "performance", "history", "sources", "full"];

const COMPACT_COLUMNS = new Set([
  "rank",
  "name",
  "person",
  "pokemon",
  "season",
  "division",
  "video_type",
  "detected_week",
  "week",
  "player_a",
  "player_b",
  "opponent",
  "perspective_person",
  "trainer",
  "team",
  "title",
  "videos",
  "champion",
  "queue",
  "subject",
  "claim_type",
  "claim_subject",
  "review_file",
  "seasons_won",
  "seasons",
  "season_count",
  "championships",
  "titles",
  "title_count",
  "draft_count",
  "rating",
  "elo",
  "matches",
  "win_pct",
  "points",
  "kills",
  "appearances",
  "status",
  "match_status",
  "quality_score",
  "roster_score",
  "pokemon_score",
  "pokemon_count",
  "roster_flags",
]);

const PERFORMANCE_COLUMNS = new Set([
  ...COMPACT_COLUMNS,
  "wins",
  "losses",
  "draws",
  "points",
  "deaths",
  "differential",
  "best_rank",
  "record",
  "score",
  "winner",
  "season_count",
  "trainer_count",
  "team_count",
  "tier",
  "tier_rank",
  "picked_status",
  "roster_score",
  "pokemon_score",
  "power_score",
  "performance_score",
  "balance_score",
  "history_score",
  "confidence_score",
  "pokemon_count",
  "avg_tier_rank",
  "roster_flags",
  "tables_score",
  "matches_score",
  "killlists_score",
  "videos_score",
  "standings",
  "playoff_matches",
  "champions",
  "killlists",
  "videos",
  "matched_videos",
]);

const HISTORY_COLUMNS = new Set([
  "rank",
  "name",
  "person",
  "pokemon",
  "season",
  "season_id",
  "division",
  "divisions",
  "stage",
  "week",
  "detected_week",
  "published_at",
  "start_week",
  "end_week",
  "team",
  "trainer",
  "opponent",
  "title",
  "champion",
  "seasons_won",
  "seasons",
  "season_list",
  "title_seasons",
  "championships",
  "titles",
  "title_count",
  "best_rank",
  "best_season",
  "signature_pokemon",
  "top_pokemon",
  "roster_flags",
]);

const SOURCE_COLUMNS = new Set([
  "rank",
  "name",
  "person",
  "pokemon",
  "season",
  "division",
  "video_type",
  "title",
  "queue",
  "subject",
  "claim_type",
  "claim_subject",
  "claim_field",
  "claim_value",
  "status",
  "evidence",
  "evidence_status",
  "match_status",
  "confidence",
  "confidence_tier",
  "match_basis",
  "confidence_explanation",
  "match_id",
  "videos",
  "source",
  "roster_flags",
  "notes",
  "review_file",
  "row_count",
  "severity",
  "review_reason",
  "correction_file",
  "suggested_action",
  "priority_gaps",
  "missing_data",
  "review_flags",
  "missing_appearances",
  "unavailable_killlists",
  "unmatched_game_videos",
  "low_confidence_videos",
]);

const PROFILE_COLUMNS = {
  compact: COMPACT_COLUMNS,
  performance: PERFORMANCE_COLUMNS,
  history: HISTORY_COLUMNS,
  sources: SOURCE_COLUMNS,
};

export function normalizeColumnProfile(profile) {
  return COLUMN_PROFILE_KEYS.includes(profile) ? profile : "full";
}

export function columnsForProfile(columns, profile = "full") {
  const normalized = normalizeColumnProfile(profile);
  if (normalized === "full") {
    return [...columns];
  }

  const allowed = PROFILE_COLUMNS[normalized] || COMPACT_COLUMNS;
  let selected = columns.filter((column) => allowed.has(column));
  if (normalized === "compact" && !columns.includes("pokemon")) {
    selected = selected.filter((column) => !["appearances", "kills"].includes(column));
  }
  if (selected.length) {
    return selected;
  }
  return columns.slice(0, Math.min(columns.length, 8));
}
