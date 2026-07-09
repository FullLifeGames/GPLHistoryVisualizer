import assert from "node:assert/strict";

import { eloRatings } from "../web/stats.js";
import {
  buildTimeline,
  eloHistory,
  isTimelineMatch,
  killlistLeaderSeries,
  reconcileStandings,
  sampleLeaderValues,
  standingsHistory,
} from "../web/timeline.js";
import { readNormalizedCsv } from "./helpers/csv.mjs";

const match = (overrides) => ({
  season_id: "season_001",
  division: "Regular Season",
  stage: "regular_season",
  week: "1. Spieltag",
  match_id: "m1",
  player_a: "Bene",
  player_b: "PresentLP",
  winner: "Bene",
  data_status: "sheet_extracted",
  ...overrides,
});

// --- isTimelineMatch -------------------------------------------------------

// video_source rows carry a video id but no players: they are not battles.
assert.equal(isTimelineMatch(match({ data_status: "source_video_only", player_a: "", player_b: "" })), false);
assert.equal(isTimelineMatch(match({ data_status: "not_available" })), false);
// Season 7's "Playoffs" row records a title, not a match: it has no opponent.
assert.equal(isTimelineMatch(match({ stage: "playoffs", week: "Playoffs", player_b: "", winner: "Nestfloh" })), false);
assert.equal(isTimelineMatch(match({})), true);
assert.equal(isTimelineMatch(match({ player_a: "", team_a: "Alpha" })), true);

// --- buildTimeline ---------------------------------------------------------

const fixture = [
  match({ match_id: "s1_w2", week: "2. Spieltag", player_a: "Bene", player_b: "Lauris", winner: "Lauris" }),
  match({ match_id: "s1_w1", week: "1. Spieltag" }),
  match({ match_id: "s2_w1", season_id: "season_002", week: "Spieltag 1", player_a: "Bene", player_b: "Lauris", winner: "Bene" }),
  match({ match_id: "s2_final", season_id: "season_002", stage: "playoffs", week: "Playoffs - Finale", player_a: "Bene", player_b: "Lauris", winner: "Bene" }),
  match({ match_id: "s2_semi", season_id: "season_002", stage: "playoffs", week: "Halbfinale", player_a: "Bene", player_b: "PresentLP", winner: "Bene" }),
  match({ match_id: "ignored", data_status: "source_video_only", player_a: "", player_b: "" }),
];

const timeline = buildTimeline(fixture);

// Ticks are chronological regardless of row order, and playoff rounds trail the
// matchdays of their own season in the order they are played.
assert.deepEqual(
  timeline.ticks.map((tick) => `${tick.seasonId}/${tick.kind}/${tick.weekNumber ?? tick.phase}`),
  ["season_001/matchday/1", "season_001/matchday/2", "season_002/matchday/1", "season_002/playoff/halbfinale", "season_002/playoff/finale"],
);
assert.deepEqual(timeline.ticks.map((tick) => tick.index), [0, 1, 2, 3, 4]);
assert.equal(timeline.ticks.reduce((total, tick) => total + tick.matches.length, 0), 5);

assert.deepEqual(
  timeline.seasons.map((season) => [season.seasonId, season.index, season.firstTick, season.lastTick, season.tickCount]),
  [
    ["season_001", 0, 0, 1, 2],
    ["season_002", 1, 2, 4, 3],
  ],
);

// --- eloHistory ------------------------------------------------------------

const history = eloHistory(fixture, timeline);
assert.equal(history.frames.length, timeline.ticks.length);
assert.ok(history.frames.every((frame) => frame instanceof Map));

// The last frame must reproduce eloRatings exactly, or the animation would end
// on a different number than the all-time table shows.
const finalRows = eloRatings(fixture.filter(isTimelineMatch));
const lastFrame = history.frames[history.frames.length - 1];
for (const row of finalRows) {
  assert.equal(String(Math.round(lastFrame.get(row.key))), row.elo, `final Elo frame differs for ${row.name}`);
}

// Ratings only move once a player has played: Lauris is absent from tick 0.
assert.equal(history.frames[0].has("lauris"), false);
assert.equal(history.frames[1].has("lauris"), true);

// --- standingsHistory ------------------------------------------------------

const tables = standingsHistory(timeline);
const season1 = tables.get("season_001").get("Regular Season");
assert.equal(season1.length, 2);

assert.deepEqual(
  season1[0].map((row) => [row.name, row.wins, row.losses, row.draws, row.points, row.rank]),
  [
    ["Bene", 1, 0, 0, 3, 1],
    ["PresentLP", 0, 1, 0, 0, 2],
  ],
);
// After matchday 2 Bene has lost to Lauris. Both sit on 3 points and one win,
// so the fewer-losses tiebreak puts Lauris ahead.
assert.deepEqual(
  season1[1].map((row) => [row.name, row.wins, row.losses, row.points, row.rank]),
  [
    ["Lauris", 1, 0, 3, 1],
    ["Bene", 1, 1, 3, 2],
    ["PresentLP", 0, 1, 0, 3],
  ],
);

// A missing winner is scored as a draw, worth one point to each side.
const drawTimeline = buildTimeline([match({ match_id: "d1", winner: "" })]);
assert.deepEqual(
  standingsHistory(drawTimeline).get("season_001").get("Regular Season")[0].map((row) => [row.name, row.draws, row.points]),
  [
    ["Bene", 1, 1],
    ["PresentLP", 1, 1],
  ],
);

// --- reconcileStandings ----------------------------------------------------

const reconciled = reconcileStandings(season1[1], [
  { season_id: "season_001", stage: "final_table", division: "Regular Season", player_name: "Bene", wins: "2", losses: "1", draws: "0", points: "6", rank: "1" },
  { season_id: "season_001", stage: "playoffs", division: "Playoffs", player_name: "Bene", wins: "9", losses: "9", draws: "9", points: "99", rank: "9" },
], { seasonId: "season_001", division: "Regular Season" });

const bene = reconciled.find((row) => row.name === "Bene");
assert.equal(bene.official.points, 6);
assert.equal(bene.pointsDelta, -3);
assert.equal(bene.matchesDelta, -1);
// Players without an official row report null deltas rather than a fake zero.
assert.equal(reconciled.find((row) => row.name === "Lauris").official, null);
assert.equal(reconciled.find((row) => row.name === "Lauris").pointsDelta, null);

// --- killlistLeaderSeries / sampleLeaderValues -------------------------------

const killlists = [
  { season_id: "season_001", division: "Overall", pokemon: "Knakrack", pokemon_normalized: "knakrack", kills: "6", data_status: "sheet_extracted" },
  { season_id: "season_001", division: "Overall", pokemon: "Rotom", pokemon_normalized: "rotom", kills: "6", data_status: "sheet_extracted" },
  { season_id: "season_001", division: "Overall", pokemon: "Pikachu", pokemon_normalized: "pikachu", kills: "1", data_status: "sheet_extracted" },
  { season_id: "season_002", division: "Overall", pokemon: "Rotom", pokemon_normalized: "rotom", kills: "8", data_status: "sheet_extracted" },
];
const series = killlistLeaderSeries(killlists, ["season_001", "season_002"], { topN: 2 });

// The union holds every Pokemon that ever reached a season's cumulative top 2;
// Pikachu never does and stays out entirely.
assert.deepEqual(series.pokemon.map((entry) => entry.key).sort(), ["knakrack", "rotom"]);
assert.equal(series.pokemon.find((entry) => entry.key === "rotom").name, "Rotom");

// Cumulative boundary values: after S1 both sit at 6; after S2 Rotom carries 14.
assert.equal(series.cumulativeBySeason[0].get("knakrack"), 6);
assert.equal(series.cumulativeBySeason[1].get("rotom"), 14);
assert.deepEqual(series.totals, [13, 21]);

// Interpolation runs from the cumulative total BEFORE a season to the one
// including it: position 1.5 = halfway through season 2.
const midSeason2 = sampleLeaderValues(series, 1.5);
assert.equal(midSeason2.values.get("rotom"), 6 + (14 - 6) * 0.5);
assert.equal(midSeason2.values.get("knakrack"), 6);
assert.equal(midSeason2.total, 13 + (21 - 13) * 0.5);

// The ends clamp: position 0 is the season-1 start (nothing yet), position 2 the final totals.
assert.equal(sampleLeaderValues(series, 0).values.get("rotom"), 0);
assert.equal(sampleLeaderValues(series, 99).values.get("rotom"), 14);
assert.equal(sampleLeaderValues(series, 99).total, 21);

// --- regression anchors against the real data ------------------------------

const realMatches = readNormalizedCsv("matches.csv");
const realStandings = readNormalizedCsv("standings.csv");
const realTimeline = buildTimeline(realMatches);

assert.equal(realTimeline.seasons.length, 10);
assert.equal(realTimeline.ticks.filter((tick) => tick.kind === "matchday").length, 183);
// Only seasons 6 and 10 played playoffs. Season 7's playoff row is a title
// record with no opponent and must not produce a tick.
assert.deepEqual(
  [...new Set(realTimeline.ticks.filter((tick) => tick.kind === "playoff").map((tick) => tick.seasonId))],
  ["season_006", "season_010"],
);

const realHistory = eloHistory(realMatches, realTimeline);
const realFinal = eloRatings(realMatches.filter(isTimelineMatch));
const realLastFrame = realHistory.frames[realHistory.frames.length - 1];
assert.ok(realFinal.length >= 60);
for (const row of realFinal) {
  assert.equal(String(Math.round(realLastFrame.get(row.key))), row.elo, `final Elo frame differs for ${row.name}`);
}

// These five (season, division) tables reconstruct exactly from the match rows.
// If a change breaks one of them, the cumulative standings logic regressed.
const realTables = standingsHistory(realTimeline, realStandings);
for (const [seasonId, division] of [
  ["season_004", "Liga 2"],
  ["season_006", "Sun Conference"],
  ["season_007", "Regular Season"],
  ["season_008", "Liga 1"],
  ["season_008", "Liga 2"],
]) {
  const frames = realTables.get(seasonId).get(division);
  const reconciledRows = reconcileStandings(frames[frames.length - 1], realStandings, { seasonId, division });
  const withOfficial = reconciledRows.filter((row) => row.official);
  assert.ok(withOfficial.length > 0, `${seasonId}/${division} has no official rows`);
  for (const row of withOfficial) {
    assert.equal(row.pointsDelta, 0, `${seasonId}/${division}: ${row.name} points drift`);
    assert.equal(row.matchesDelta, 0, `${seasonId}/${division}: ${row.name} match count drift`);
  }
}

// Season 10 plays a 13th matchday that the official table does not count, so
// every player shows exactly one extra match rather than a scattered gap.
const season10Frames = realTables.get("season_010").get("Regular Season");
const season10 = reconcileStandings(season10Frames[season10Frames.length - 1], realStandings, {
  seasonId: "season_010",
  division: "Regular Season",
}).filter((row) => row.official);
assert.equal(season10.length, 14);
assert.deepEqual([...new Set(season10.map((row) => row.matchesDelta))], [1]);

// Season 3 merges two leagues under one "Regular Season" label; the member
// filter must recover Liga 1: the 14 official players plus LucarioLP (who led
// Bene's slot early on), and Lauris capped at his 26 Liga-1 games instead of
// carrying his 13 Liga-2 guest matches into the table.
const season3Frames = realTables.get("season_003").get("Regular Season");
const season3 = season3Frames[season3Frames.length - 1];
assert.equal(season3.length, 15);
assert.equal(season3.find((row) => row.key === "lauris").matches, 26);
assert.ok(season3.some((row) => row.key === "lucariolp"));
assert.equal(season3[0].name, "PresentLP");

// Ties break on differential like the official tables: S7 ends with Nestfloh
// and Dauni both at 11-2/33 points, and Nestfloh takes rank 1 on +30.
const season7Frames = realTables.get("season_007").get("Regular Season");
const season7 = season7Frames[season7Frames.length - 1];
assert.deepEqual(
  season7.slice(0, 2).map((row) => [row.rank, row.name, row.points, row.diff]),
  [
    [1, "Nestfloh", 33, 30],
    [2, "Dauni", 33, 25],
  ],
);

// Killlist leader anchors against the real data: totals only grow, the race
// starts with S1's leader and ends on the all-time top killer.
const realSeries = killlistLeaderSeries(readNormalizedCsv("pokemon_killlists.csv"), realTimeline.seasons.map((season) => season.seasonId));
assert.equal(realSeries.cumulativeBySeason.length, 10);
for (let index = 1; index < realSeries.totals.length; index += 1) {
  assert.ok(realSeries.totals[index] >= realSeries.totals[index - 1], "cumulative total shrank");
}
const atSeason1 = sampleLeaderValues(realSeries, 1);
const s1Top = [...atSeason1.values.entries()].sort((a, b) => b[1] - a[1])[0];
assert.deepEqual(s1Top, ["quajutsu", 44]);
const atEnd = sampleLeaderValues(realSeries, 10);
const endTop = [...atEnd.values.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
assert.deepEqual(endTop, ["azumarill", 148]);
// More than eight series race: the union across ten seasons exceeds one board.
assert.ok(realSeries.pokemon.length > 12, `union too small: ${realSeries.pokemon.length}`);
