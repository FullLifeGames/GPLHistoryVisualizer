import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionStripPoints,
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
