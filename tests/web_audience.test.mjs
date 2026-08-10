import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionStripPoints,
  engagementAnomalies,
  monthKey,
  monthRangeKeys,
  monthlyChannelStacks,
  seasonMonthBands,
  shortSeasonLabel,
  stripSeasonIds,
} from "../web/audience.js";

const VIDEO_ROWS = [
  { published_at: "2014-09-14T10:00:06Z", channel_title: "SurskitTV", view_count: "5553" },
  { published_at: "2014-09-20T10:00:00Z", channel_title: "SurskitTV", view_count: "2000" },
  { published_at: "2014-09-21T10:00:00Z", channel_title: "DaumenkinoLP", view_count: "3661" },
  // gap month 2014-10 on purpose
  { published_at: "2014-11-02T10:00:00Z", channel_title: "PresentLP", view_count: "900" },
  { published_at: "2014-12-24T10:00:00Z", channel_title: "SurskitTV", view_count: "" },
  { published_at: "", channel_title: "Ignored", view_count: "1" },
];

test("monthKey parses ISO timestamps and rejects blanks", () => {
  assert.equal(monthKey("2014-09-14T10:00:06Z"), "2014-09");
  assert.equal(monthKey("2015-02-01"), "2015-02");
  assert.equal(monthKey(""), null);
  assert.equal(monthKey(undefined), null);
});

test("monthRangeKeys spans a contiguous range across year borders", () => {
  assert.deepEqual(monthRangeKeys("2014-11", "2015-02"), ["2014-11", "2014-12", "2015-01", "2015-02"]);
  assert.deepEqual(monthRangeKeys("2014-09", "2014-09"), ["2014-09"]);
});

test("monthlyChannelStacks counts uploads per month with gap months zeroed", () => {
  const stacks = monthlyChannelStacks(VIDEO_ROWS, { metric: "uploads", topChannels: 6, otherLabel: "Andere" });
  assert.deepEqual(stacks.months, ["2014-09", "2014-10", "2014-11", "2014-12"]);
  // SurskitTV has the most uploads, so it leads the channel order.
  assert.equal(stacks.channels[0], "SurskitTV");
  assert.deepEqual([...stacks.channels].sort(), ["DaumenkinoLP", "PresentLP", "SurskitTV"]);
  // No remainder beyond the top channels -> no "Andere" bucket.
  assert.ok(!stacks.channels.includes("Andere"));
  const gapRow = stacks.rows[1];
  assert.equal(gapRow.month, "2014-10");
  assert.equal(gapRow.total, 0);
  assert.deepEqual(gapRow.values, [0, 0, 0]);
  const september = stacks.rows[0];
  assert.equal(september.total, 3);
  assert.equal(september.values[stacks.channels.indexOf("SurskitTV")], 2);
  assert.equal(september.monthIndex, 0);
});

test("monthlyChannelStacks folds overflow channels into the other bucket", () => {
  const stacks = monthlyChannelStacks(VIDEO_ROWS, { metric: "uploads", topChannels: 1, otherLabel: "Andere" });
  assert.deepEqual(stacks.channels, ["SurskitTV", "Andere"]);
  const september = stacks.rows[0];
  assert.equal(september.values[0], 2);
  assert.equal(september.values[1], 1); // DaumenkinoLP folded
  assert.equal(stacks.rows[2].values[1], 1); // PresentLP folded
});

test("monthlyChannelStacks sums views and skips non-numeric view counts", () => {
  const stacks = monthlyChannelStacks(VIDEO_ROWS, { metric: "views", topChannels: 6, otherLabel: "Andere" });
  const surskit = stacks.channels.indexOf("SurskitTV");
  assert.equal(stacks.rows[0].values[surskit], 7553);
  assert.equal(stacks.rows[0].total, 7553 + 3661);
  // December upload has an empty view_count -> contributes 0, month still present.
  assert.equal(stacks.rows[3].total, 0);
  // Views ranking puts SurskitTV first again (7553 vs 3661 vs 900).
  assert.equal(stacks.channels[0], "SurskitTV");
});

test("monthlyChannelStacks groups by alternative dimensions", () => {
  const rows = [
    { published_at: "2020-01-05T10:00:00Z", channel_title: "A", video_type: "game", detected_season_id: "season_007", perspective_person: "Alice", view_count: "10" },
    { published_at: "2020-01-09T10:00:00Z", channel_title: "A", video_type: "draft_analysis", detected_season_id: "season_007", perspective_person: "", view_count: "20" },
    { published_at: "2020-01-12T10:00:00Z", channel_title: "B", video_type: "game", detected_season_id: "", perspective_person: "Bob", view_count: "30" },
  ];
  const byType = monthlyChannelStacks(rows, { groupBy: "type", topChannels: 5, otherLabel: "Andere" });
  assert.deepEqual([...byType.channels].sort(), ["draft_analysis", "game"]);
  assert.equal(byType.rows[0].values[byType.channels.indexOf("game")], 2);
  const bySeason = monthlyChannelStacks(rows, { groupBy: "season", topChannels: 5, otherLabel: "Andere" });
  assert.ok(bySeason.channels.includes("season_007"));
  assert.ok(bySeason.channels.includes("?")); // missing season stays visible as its own bucket
  const byPerson = monthlyChannelStacks(rows, { groupBy: "person", topChannels: 5, otherLabel: "Andere" });
  assert.deepEqual([...byPerson.channels].sort(), ["?", "Alice", "Bob"]);
});

test("monthlyChannelStacks sums likes and comments as metrics", () => {
  const rows = [
    { published_at: "2020-01-05T10:00:00Z", channel_title: "A", view_count: "100", like_count: "10", comment_count: "2" },
    { published_at: "2020-01-09T10:00:00Z", channel_title: "A", view_count: "100", like_count: "", comment_count: "3" },
  ];
  const likes = monthlyChannelStacks(rows, { metric: "likes", topChannels: 3, otherLabel: "Andere" });
  assert.equal(likes.rows[0].total, 10); // empty like_count contributes 0
  const comments = monthlyChannelStacks(rows, { metric: "comments", topChannels: 3, otherLabel: "Andere" });
  assert.equal(comments.rows[0].total, 5);
});

const ANOMALY_ROWS = [
  // Channel "Big" has 5 qualifying videos; median rate = 0.02.
  { video_url: "https://youtu.be/b1", title: "B1", channel_title: "Big", published_at: "2020-01-01T10:00:00Z", view_count: "1000", like_count: "18", comment_count: "2" },
  { video_url: "https://youtu.be/b2", title: "B2", channel_title: "Big", published_at: "2020-01-02T10:00:00Z", view_count: "1000", like_count: "19", comment_count: "1" },
  { video_url: "https://youtu.be/b3", title: "B3", channel_title: "Big", published_at: "2020-01-03T10:00:00Z", view_count: "1000", like_count: "15", comment_count: "5" },
  // Outlier high: rate 0.10 -> factor 5.
  { video_url: "https://youtu.be/hot", title: "Hot", channel_title: "Big", published_at: "2020-01-04T10:00:00Z", view_count: "1000", like_count: "80", comment_count: "20" },
  // Outlier low: rate 0.002 -> factor 0.1.
  { video_url: "https://youtu.be/cold", title: "Cold", channel_title: "Big", published_at: "2020-01-05T10:00:00Z", view_count: "1000", like_count: "2", comment_count: "0" },
  // Below the view floor -> ignored.
  { video_url: "https://youtu.be/tiny", title: "Tiny", channel_title: "Big", published_at: "2020-01-06T10:00:00Z", view_count: "50", like_count: "40", comment_count: "9" },
  // No stats fetched at all -> ignored.
  { video_url: "https://youtu.be/nostats", title: "NoStats", channel_title: "Big", published_at: "2020-01-07T10:00:00Z", view_count: "1000", like_count: "", comment_count: "" },
  // Channel with too few videos -> ignored entirely.
  { video_url: "https://youtu.be/s1", title: "S1", channel_title: "Small", published_at: "2020-01-08T10:00:00Z", view_count: "1000", like_count: "500", comment_count: "0" },
];

test("engagementAnomalies compares each video to its channel median", () => {
  const { high, low } = engagementAnomalies(ANOMALY_ROWS, { minViews: 500, minChannelVideos: 5, top: 2 });
  assert.equal(high[0].title, "Hot");
  assert.ok(Math.abs(high[0].factor - 5) < 0.01);
  assert.equal(high[0].channel, "Big");
  assert.ok(Math.abs(high[0].channelMedianRate - 0.02) < 0.001);
  assert.ok(Math.abs(high[0].rate - 0.1) < 0.001);
  assert.equal(low[0].title, "Cold");
  assert.ok(Math.abs(low[0].factor - 0.1) < 0.01);
  const titles = [...high, ...low].map((entry) => entry.title);
  assert.ok(!titles.includes("Tiny"));
  assert.ok(!titles.includes("NoStats"));
  assert.ok(!titles.includes("S1"));
});

test("engagementAnomalies supports views, likes, and comments metrics", () => {
  const { high: viewHigh } = engagementAnomalies(ANOMALY_ROWS, { metric: "views", minViews: 500, minChannelVideos: 5, top: 1 });
  // All qualifying "Big" videos have 1000 views -> factor 1 for everyone.
  assert.ok(Math.abs(viewHigh[0].factor - 1) < 0.001);
  assert.equal(viewHigh[0].rate, 1000);
  const { high: likeHigh } = engagementAnomalies(ANOMALY_ROWS, { metric: "likes", minViews: 500, minChannelVideos: 5, top: 1 });
  assert.equal(likeHigh[0].title, "Hot"); // 80/1000 vs median 0.018
  const rows = [
    ...ANOMALY_ROWS,
    // like_count empty -> excluded from the likes metric but kept for comments
    { video_url: "https://youtu.be/x", title: "X", channel_title: "Big", published_at: "2020-01-09T10:00:00Z", view_count: "1000", like_count: "", comment_count: "4" },
  ];
  const { high, low } = engagementAnomalies(rows, { metric: "likes", minViews: 500, minChannelVideos: 5, top: 10 });
  assert.ok([...high, ...low].every((entry) => entry.title !== "X"));
});

test("attentionStripPoints reads engagement z-scores in engagement mode", () => {
  const rows = [
    { season_id: "s1", week: "1. Spieltag", player_a: "A", player_b: "B", score: "6 - 0", engagement_z_score_peak: "2.5", views_trend_z_score_peak: "9", views_z_score_peak: "9", video_urls: "" },
    { season_id: "s1", week: "2. Spieltag", player_a: "C", player_b: "D", score: "6 - 0", engagement_z_score_peak: "", views_trend_z_score_peak: "1", views_z_score_peak: "1", video_urls: "" },
  ];
  const points = attentionStripPoints(rows, "s1", { mode: "engagement" });
  assert.equal(points.length, 1); // the engagement-less row is dropped
  assert.equal(points[0].z, 2.5);
  const viewPoints = attentionStripPoints(rows, "s1");
  assert.equal(viewPoints.length, 2); // default mode still uses view z-scores
});

test("engagementAnomalies keeps high and low lists disjoint on small pools", () => {
  const { high, low } = engagementAnomalies(ANOMALY_ROWS, { minViews: 500, minChannelVideos: 5, top: 10 });
  const highTitles = new Set(high.map((entry) => entry.title));
  assert.ok(low.every((entry) => !highTitles.has(entry.title)));
});

test("shortSeasonLabel compresses season ids", () => {
  assert.equal(shortSeasonLabel("season_001"), "S1");
  assert.equal(shortSeasonLabel("season_010"), "S10");
  assert.equal(shortSeasonLabel(""), "");
});

const SEASON_ROWS = [
  { season_id: "season_001", season_label: "Season 1", start_date: "2014-09-14T10:00:06Z", end_date: "2014-12-15T15:00:01Z" },
  { season_id: "season_002", season_label: "Season 2", start_date: "", end_date: "2015-06-01T10:00:00Z" },
];
const CHAMPION_ROWS = [{ season_id: "season_001", champion_name: "PresentLP" }];

test("seasonMonthBands maps seasons to month-index bands with champion labels", () => {
  const months = ["2014-09", "2014-10", "2014-11", "2014-12"];
  const bands = seasonMonthBands(SEASON_ROWS, months, CHAMPION_ROWS);
  assert.equal(bands.length, 1); // season_002 lacks a start date
  const band = bands[0];
  assert.equal(band.seasonId, "season_001");
  assert.equal(band.fromX, -0.5);
  assert.equal(band.toX, 3.5);
  assert.equal(band.label, "S1 · 🏆 PresentLP");
  assert.equal(band.shortLabel, "S1");
});

test("seasonMonthBands honors season end overrides", () => {
  const months = ["2014-09", "2014-10", "2014-11", "2014-12"];
  const bands = seasonMonthBands(SEASON_ROWS, months, [], { season_001: "2014-10-20" });
  assert.equal(bands[0].toX, 1.5); // override pulls the band end to October
});

test("seasonMonthBands clamps bands to the charted month range", () => {
  const months = ["2014-10", "2014-11"];
  const bands = seasonMonthBands(SEASON_ROWS, months, []);
  assert.equal(bands.length, 1);
  assert.equal(bands[0].fromX, -0.5); // season started before the range
  assert.equal(bands[0].toX, 1.5); // and ends after it
  assert.equal(bands[0].label, "S1"); // no champion row -> plain label
});

const HIGHLIGHT_ROWS = [
  {
    season_id: "season_001",
    stage: "playoff",
    match_id: "season_001_schedule_0090",
    week: "Spiel um Platz 3",
    player_a: "Epsilon",
    player_b: "Zeta",
    score: "6 - 2",
    views_trend_z_score_peak: "0.9",
    views_z_score_peak: "0.9",
    video_urls: "",
  },
  {
    season_id: "season_001",
    stage: "playoff",
    match_id: "season_001_schedule_0091",
    week: "Finale",
    player_a: "Eta",
    player_b: "Theta",
    score: "6 - 4",
    views_trend_z_score_peak: "3.5",
    views_z_score_peak: "3.5",
    video_urls: "",
  },
  {
    season_id: "season_001",
    week: "3. Spieltag",
    player_a: "Alpha",
    player_b: "Beta",
    score: "6 - 0",
    views_trend_z_score_peak: "2.4",
    views_z_score_peak: "9",
    video_urls: "https://youtu.be/a;https://youtu.be/b",
  },
  {
    season_id: "season_001",
    week: "1. Spieltag",
    player_a: "Gamma",
    player_b: "Delta",
    score: "4 - 2",
    views_trend_z_score_peak: "",
    views_z_score_peak: "1.1",
    video_urls: "https://youtu.be/c",
  },
  {
    season_id: "season_001",
    week: "2. Spieltag",
    player_a: "Alpha",
    player_b: "Delta",
    score: "0 - 6",
    views_trend_z_score_peak: "",
    views_z_score_peak: "",
    video_urls: "",
  },
  {
    season_id: "season_002",
    week: "1. Spieltag",
    player_a: "Someone",
    player_b: "Else",
    score: "6 - 0",
    views_trend_z_score_peak: "0.5",
    views_z_score_peak: "0.5",
    video_urls: "",
  },
];

test("attentionStripPoints sorts by week and falls back to the plain z-score", () => {
  const points = attentionStripPoints(HIGHLIGHT_ROWS, "season_001");
  assert.equal(points.length, 4); // the z-less week 2 row is dropped
  assert.deepEqual(
    points.map((point) => point.weekLabel),
    ["1. Spieltag", "3. Spieltag", "Spiel um Platz 3", "Finale"],
  );
  assert.deepEqual(points.map((point) => point.x), [0, 1, 2, 3]);
  assert.equal(points[0].z, 1.1); // trend z missing -> plain z fallback
  assert.equal(points[1].z, 2.4);
  assert.equal(points[1].matchLabel, "Alpha 6 - 0 Beta");
  assert.deepEqual(points[1].videoUrls, ["https://youtu.be/a", "https://youtu.be/b"]);
  assert.deepEqual(points[0].videoUrls, ["https://youtu.be/c"]);
});

test("stripSeasonIds lists distinct seasons in order", () => {
  assert.deepEqual(stripSeasonIds(HIGHLIGHT_ROWS), ["season_001", "season_002"]);
});
