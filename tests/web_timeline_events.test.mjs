import test from "node:test";
import assert from "node:assert/strict";
import { groupEventsByYear, onThisDayEvents, timelineEvents } from "../web/timeline_events.js";

const SEASONS = [
  {
    season_id: "season_001",
    season_label: "Season 1",
    start_date: "2014-09-14T10:00:06Z",
    end_date: "2015-02-15T15:00:01Z",
    source_urls: "https://example.com/s1",
  },
  {
    season_id: "season_002",
    season_label: "Season 2",
    start_date: "2015-03-15T12:00:00Z",
    end_date: "2015-09-20T17:00:00Z",
    source_urls: "https://example.com/s2",
  },
  { season_id: "season_003", season_label: "Season 3", start_date: "", end_date: "", source_urls: "" },
];

const CHAMPIONS = [
  { season_id: "season_001", champion_name: "PresentLP", champion_person_id: "person_present", source_urls: "https://example.com/champ1" },
];

const VIDEOS = [
  { video_id: "v1", video_url: "https://youtu.be/v1", title: "Erstes Video", channel_title: "SurskitTV", published_at: "2014-09-14T10:00:06Z", view_count: "5000", source_urls: "https://youtu.be/v1" },
  { video_id: "v2", video_url: "https://youtu.be/v2", title: "Kleines Video", channel_title: "SurskitTV", published_at: "2014-10-01T10:00:00Z", view_count: "100", source_urls: "https://youtu.be/v2" },
  { video_id: "v3", video_url: "https://youtu.be/v3", title: "Hit 2014", channel_title: "DaumenkinoLP", published_at: "2014-11-05T10:00:00Z", view_count: "9000", source_urls: "https://youtu.be/v3" },
  { video_id: "v4", video_url: "https://youtu.be/v4", title: "Hit 2015", channel_title: "PresentLP", published_at: "2015-04-10T10:00:00Z", view_count: "7000", source_urls: "https://youtu.be/v4" },
  { video_id: "v5", video_url: "https://youtu.be/v5", title: "Datumslos", channel_title: "PresentLP", published_at: "", view_count: "999999", source_urls: "" },
];

const PROGRESSION = [
  // First row per key: archive starting value, not a hand-off -> dropped.
  {
    record_key: "highest_elo",
    holder_person_id: "person_daumenkino",
    holder_name: "DaumenkinoLP",
    value: "1516",
    season_id: "season_001",
    week: "1. Spieltag",
    match_id: "season_001_schedule_0001",
    video_url: "",
    superseded: "1",
    source_urls: "https://example.com/elo",
  },
  // Same holder improving their own record -> dropped.
  {
    record_key: "highest_elo",
    holder_person_id: "person_daumenkino",
    holder_name: "DaumenkinoLP",
    value: "1530",
    season_id: "season_001",
    week: "2. Spieltag",
    match_id: "season_001_schedule_0001",
    video_url: "",
    superseded: "1",
    source_urls: "https://example.com/elo",
  },
  // Genuine hand-off with a resolvable match id -> kept.
  {
    record_key: "highest_elo",
    holder_person_id: "person_present",
    holder_name: "PresentLP",
    value: "1550",
    season_id: "season_001",
    week: "3. Spieltag",
    match_id: "season_001_schedule_0001",
    video_url: "",
    superseded: "0",
    source_urls: "https://example.com/elo2",
  },
  // Hand-off whose match id has no dated video -> dropped.
  {
    record_key: "most_career_kills",
    holder_person_id: "person_a",
    holder_name: "Founder",
    value: "10",
    season_id: "season_001",
    week: "1. Spieltag",
    match_id: "season_001_schedule_0001",
    video_url: "",
    superseded: "1",
    source_urls: "",
  },
  {
    record_key: "most_career_kills",
    holder_person_id: "person_x",
    holder_name: "Unresolvable",
    value: "40",
    season_id: "season_001",
    week: "2. Spieltag",
    match_id: "season_001_schedule_9999",
    video_url: "",
    superseded: "0",
    source_urls: "",
  },
];

const MATCH_VIDEOS = [
  { match_id: "season_001_schedule_0001", published_at: "2014-09-15T10:00:00Z", video_url: "https://youtu.be/late" },
  { match_id: "season_001_schedule_0001", published_at: "2014-09-14T10:00:06Z", video_url: "https://youtu.be/early" },
];

const SOURCES = {
  seasons: SEASONS,
  champions: CHAMPIONS,
  videos: VIDEOS,
  recordsProgression: PROGRESSION,
  matchVideos: MATCH_VIDEOS,
};

test("timelineEvents builds sorted, typed events", () => {
  const events = timelineEvents(SOURCES, { topVideosPerYear: 1, milestoneSteps: [1, 3] });
  assert.deepEqual(events.map((event) => event.date), [...events.map((event) => event.date)].sort());
  const types = events.map((event) => event.type);
  assert.ok(types.includes("season-start"));
  assert.ok(types.includes("season-end"));
  assert.ok(types.includes("top-video"));
  assert.ok(types.includes("record"));
  assert.ok(types.includes("milestone"));
  for (const event of events) {
    assert.equal(event.date.length, 10);
    assert.equal(event.year, Number(event.date.slice(0, 4)));
    assert.ok(Array.isArray(event.sourceUrls));
  }
});

test("season events attach the champion to the season end only", () => {
  const events = timelineEvents(SOURCES, {});
  const starts = events.filter((event) => event.type === "season-start");
  const ends = events.filter((event) => event.type === "season-end");
  assert.equal(starts.length, 2); // season_003 has no dates
  assert.equal(ends.length, 2);
  const s1End = ends.find((event) => event.seasonId === "season_001");
  assert.equal(s1End.date, "2015-02-15");
  assert.equal(s1End.champion, "PresentLP");
  assert.equal(s1End.championPersonId, "person_present");
  const s2End = ends.find((event) => event.seasonId === "season_002");
  assert.equal(s2End.champion, undefined);
  assert.equal(starts[0].seasonLabel, "Season 1");
});

test("top videos rank per calendar year and skip dateless rows", () => {
  const events = timelineEvents(SOURCES, { topVideosPerYear: 1, milestoneSteps: [] });
  const tops = events.filter((event) => event.type === "top-video");
  assert.deepEqual(tops.map((event) => event.title), ["Hit 2014", "Hit 2015"]);
  assert.equal(tops[0].viewCount, 9000);
  assert.equal(tops[0].channel, "DaumenkinoLP");
  assert.equal(tops[0].videoUrl, "https://youtu.be/v3");
});

test("record events keep only resolvable hand-offs, dated by the earliest match video", () => {
  const events = timelineEvents(SOURCES, { milestoneSteps: [] });
  const records = events.filter((event) => event.type === "record");
  assert.equal(records.length, 1); // firsts, self-improvements, and unresolvable rows are dropped
  assert.equal(records[0].date, "2014-09-14");
  assert.equal(records[0].recordKey, "highest_elo");
  assert.equal(records[0].holderName, "PresentLP");
  assert.equal(records[0].value, "1550");
  assert.equal(records[0].videoUrl, "https://youtu.be/early");
});

test("milestones pick the nth chronological upload", () => {
  const events = timelineEvents(SOURCES, { topVideosPerYear: 0, milestoneSteps: [1, 3, 100] });
  const milestones = events.filter((event) => event.type === "milestone");
  assert.deepEqual(milestones.map((event) => [event.n, event.title]), [
    [1, "Erstes Video"],
    [3, "Hit 2014"],
  ]);
});

test("groupEventsByYear lists newest years first with ascending events inside", () => {
  const groups = groupEventsByYear(timelineEvents(SOURCES, { topVideosPerYear: 1, milestoneSteps: [1] }));
  assert.deepEqual(groups.map((group) => group.year), [2015, 2014]);
  for (const group of groups) {
    const dates = group.events.map((event) => event.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.ok(group.events.every((event) => event.year === group.year));
  }
});

test("onThisDayEvents matches month-day in earlier years only", () => {
  const events = timelineEvents(SOURCES, { topVideosPerYear: 1, milestoneSteps: [1] });
  const hits = onThisDayEvents(events, "2020-09-14");
  assert.ok(hits.length >= 2); // season start + first-video milestone share 09-14
  assert.deepEqual(hits.map((event) => event.yearsAgo), [...hits.map((event) => event.yearsAgo)].sort((a, b) => a - b));
  assert.equal(hits[0].yearsAgo, 6);
  assert.ok(hits.every((event) => event.date.endsWith("-09-14")));
  // same-year "anniversaries" are excluded
  assert.equal(onThisDayEvents(events, "2014-09-14").length, 0);
  assert.deepEqual(onThisDayEvents(events, "2020-01-31"), []);
});
