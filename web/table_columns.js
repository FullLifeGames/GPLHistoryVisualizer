export const RECORD_COLUMNS = ["matches", "win_pct", "wins", "losses", "draws"];

function withRecordColumns(prefix, suffix = []) {
  return [...prefix, ...RECORD_COLUMNS, ...suffix];
}

export const ALL_TIME_COLUMNS = withRecordColumns(
  ["rank", "name", "seasons_won", "title_seasons", "rating", "seasons", "season_list"],
  ["points", "kills", "best_rank", "elo"],
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
  "kill_rate",
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
  "roster_phase",
  "variants",
  "person",
  "team",
  "roster_score",
  "performance_score",
  "balance_score",
  "history_score",
  "confidence_score",
  "pokemon_count",
  "avg_tier_rank",
  "top_pokemon",
  "appearances",
  "kills",
  "kill_rate",
  "roster_flags",
  "source",
];

export const TEAM_ROSTER_POKEMON_COLUMNS = [
  "rank",
  "pokemon",
  "pokemon_score",
  "performance_score",
  "history_score",
  "confidence_score",
  "appearances",
  "kills",
  "kill_rate",
  "title_count",
  "draft_count",
  "tier",
  "tier_rank",
  "season",
  "division",
  "roster_phase",
  "person",
  "team",
  "slot",
  "source",
];

export const TABLE_HISTORY_COLUMNS = withRecordColumns(
  ["season", "division", "rank", "person", "team"],
  ["points", "kills", "source"],
);

export const SEASON_STANDINGS_COLUMNS = withRecordColumns(
  ["division", "rank", "person", "team"],
  ["points", "kills", "status", "source"],
);

export const PERSON_SEASON_COLUMNS = withRecordColumns(
  ["person", "season", "division", "team", "start_week", "end_week", "rank"],
  ["points", "source"],
);

export const MATCHUP_COLUMNS = ["opponent", ...RECORD_COLUMNS];

export const MATCH_HIGHLIGHT_COLUMNS = [
  "rank",
  "season",
  "division",
  "stage",
  "week",
  "player_a",
  "player_b",
  "score",
  "winner",
  "highlight_score",
  "highlight_reasons",
  "view_peak",
  "view_total",
  "view_median",
  "view_multiplier_peak",
  "views_percentile_peak",
  "views_z_score_peak",
  "view_expected_total",
  "view_trend_multiplier_match",
  "views_trend_percentile_match",
  "views_trend_z_score_match",
  "views_total_percentile_match",
  "view_expected_peak",
  "view_trend_multiplier_peak",
  "views_trend_percentile_peak",
  "views_trend_z_score_peak",
  "like_peak",
  "comment_peak",
  "engagement_rate_peak",
  "engagement_multiplier_peak",
  "engagement_percentile_peak",
  "engagement_z_score_peak",
  "peak_perspective",
  "both_sides_spiked",
  "close_match",
  "playoff_match",
  "video_count",
  "videos",
  "source",
];

export const VIDEO_ARCHIVE_COLUMNS = [
  "season",
  "title",
  "division",
  "video_type",
  "stage",
  "detected_week",
  "published_at",
  "perspective_person",
  "opponent",
  "channel",
  "match_status",
  "confidence",
  "confidence_tier",
  "match_basis",
  "confidence_explanation",
  "match_id",
  "view_count",
  "views_trend_multiplier",
  "views_expected",
  "views_week_factor",
  "views_trend_percentile",
  "views_trend_z_score",
  "views_trend_highlight_reasons",
  "views_multiplier",
  "views_percentile",
  "views_z_score",
  "video_highlight_reasons",
  "like_count",
  "comment_count",
  "duration_seconds",
  "stats_fetched_at",
];

export const COLUMN_PROFILE_KEYS = ["compact", "full"];

const COMPACT_COLUMNS = new Set([
  "rank",
  "name",
  "person",
  "pokemon",
  "season",
  "division",
  "roster_phase",
  "variants",
  "video_type",
  "stage",
  "detected_week",
  "published_at",
  "week",
  "player_a",
  "player_b",
  "score",
  "winner",
  "opponent",
  "perspective_person",
  "trainer",
  "trainers",
  "team",
  "teams",
  "title",
  "videos",
  "champion",
  "queue",
  "subject",
  "claim_type",
  "claim_subject",
  "review_file",
  "review_key",
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
  "kill_rate",
  "status",
  "match_status",
  "quality_score",
  "roster_score",
  "pokemon_score",
  "pokemon_count",
  "roster_gaps",
  "missing_slots",
  "matches_without_videos",
  "video_count",
  "highlight_score",
  "highlight_reasons",
  "view_peak",
  "view_trend_multiplier_match",
  "view_trend_multiplier_peak",
  "view_count",
  "view_multiplier_peak",
  "views_multiplier",
  "peak_perspective",
  "close_match",
  "playoff_match",
  "video_coverage",
  "missing_perspectives",
  "roster_flags",
]);

const PROFILE_COLUMNS = {
  compact: COMPACT_COLUMNS,
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
  const pokemonMetricTable = columns.includes("pokemon") || columns.includes("trainer") || columns.includes("trainers");
  if (normalized === "compact" && !pokemonMetricTable) {
    selected = selected.filter((column) => !["appearances", "kills", "kill_rate"].includes(column));
  }
  if (selected.length) {
    return selected;
  }
  return columns.slice(0, Math.min(columns.length, 8));
}
