import assert from "node:assert/strict";
import test from "node:test";

import { seasonStoryBeats, storyFrameForWeek, storyWeekOrder } from "../web/season_story.js";

test("storyWeekOrder mirrors the pipeline week ordering", () => {
  assert.equal(storyWeekOrder("5. Spieltag - Sonntag", "regular_season"), 5);
  assert.equal(storyWeekOrder("Halbfinale", "playoffs"), 120);
  assert.equal(storyWeekOrder("Finale", "playoffs"), 140);
  assert.equal(storyWeekOrder("", "playoffs"), 150);
});

test("storyFrameForWeek finds the last frame at or before the week", () => {
  assert.equal(storyFrameForWeek([1, 2, 3, 4], 3), 2);
  assert.equal(storyFrameForWeek([1, 2, 3, 4], 99), 3);
  assert.equal(storyFrameForWeek([1, 2, 3, 4], 0), 0);
});

const MATCHES = [1, 2, 3, 4].map((week) => ({
  season_id: "season_001",
  division: "Liga 1",
  stage: "regular_season",
  week: `${week}. Spieltag`,
  player_a: "Alice",
  player_b: "Bob",
  winner: "Alice",
  match_id: `m${week}`,
  data_status: "sheet_extracted",
  source_urls: "https://example.com/sheet",
}));

const BASE = {
  seasonId: "season_001",
  division: "Liga 1",
  weeks: [1, 2, 3, 4],
  matches: MATCHES,
  champions: [{ season_id: "season_001", champion_name: "Alice", champion_team: "Team A", source_urls: "https://example.com/c" }],
  highlights: [
    {
      season_id: "season_001",
      match_id: "m2",
      division: "Liga 1",
      week: "2. Spieltag",
      player_a: "Alice",
      player_b: "Bob",
      score: "6 - 4",
      highlight_score: "80",
      video_urls: "https://youtube.com/watch?v=x",
      source_urls: "https://example.com/h",
    },
  ],
  titleOdds: [
    {
      season_id: "season_001",
      division: "Liga 1",
      week: "3",
      person_id: "person_alice",
      person_name: "Alice",
      p_first: "0.9700",
      p_playoffs: "",
      sims: "100",
      seed: "42",
      source_urls: "https://example.com",
    },
  ],
  playoffMatches: [],
};

test("beats start with intro and end with champion", () => {
  const beats = seasonStoryBeats(BASE);
  assert.equal(beats[0].kind, "intro");
  assert.equal(beats[beats.length - 1].kind, "champion");
  assert.equal(beats[beats.length - 1].name, "Alice");
});

test("intro counts players, matches, and matchdays", () => {
  const intro = seasonStoryBeats(BASE)[0];
  assert.equal(intro.playerCount, 2);
  assert.equal(intro.matchCount, 4);
  assert.equal(intro.matchdayCount, 4);
  assert.equal(intro.frameIndex, 0);
  assert.equal(intro.defendingChampion, "");
});

test("intro names the defending champion from the previous season", () => {
  const champions = [
    ...BASE.champions,
    { season_id: "season_000", champion_name: "Zed", champion_team: "Team Z", source_urls: "u" },
  ];
  const intro = seasonStoryBeats({ ...BASE, champions })[0];
  assert.equal(intro.defendingChampion, "Zed");
});

test("award beats appear for the division before the champion", () => {
  const awards = [
    { award_key: "mvp", scope: "season", season_id: "season_001", division: "Liga 1", person_id: "person_alice", person_name: "Alice", value: "91", source_urls: "u1" },
    { award_key: "holzloeffel", scope: "season", season_id: "season_001", division: "Liga 1", person_id: "person_carol", person_name: "Carol", value: "3", source_urls: "u2" },
    { award_key: "best_newcomer", scope: "season", season_id: "season_001", division: "", person_id: "person_bob", person_name: "Bob", value: "70", source_urls: "u3" },
    { award_key: "mvp", scope: "season", season_id: "season_001", division: "Liga 2", person_id: "person_x", person_name: "Xavier", value: "80", source_urls: "u4" },
  ];
  const beats = seasonStoryBeats({ ...BASE, awards });
  const awardBeats = beats.filter((beat) => beat.kind === "award");
  assert.deepEqual(awardBeats.map((beat) => beat.awardKey), ["best_newcomer", "mvp", "holzloeffel"]);
  const championIndex = beats.findIndex((beat) => beat.kind === "champion");
  assert.ok(beats.findIndex((beat) => beat.awardKey === "holzloeffel") < championIndex);
});

test("highlight beats carry match info and land on their week frame", () => {
  const highlight = seasonStoryBeats(BASE).find((beat) => beat.kind === "highlight");
  assert.equal(highlight.matchId, "m2");
  assert.equal(highlight.frameIndex, 1);
  assert.equal(highlight.videoUrl, "https://youtube.com/watch?v=x");
});

test("decided beat comes from title odds crossing 0.95", () => {
  const decided = seasonStoryBeats(BASE).find((beat) => beat.kind === "decided");
  assert.equal(decided.week, 3);
  assert.equal(decided.name, "Alice");
  const withoutOdds = seasonStoryBeats({ ...BASE, titleOdds: [] });
  assert.equal(withoutOdds.find((beat) => beat.kind === "decided"), undefined);
});

test("race beats appear at mid-race checkpoints", () => {
  const race = seasonStoryBeats(BASE).filter((beat) => beat.kind === "race");
  assert.ok(race.length >= 1);
  assert.ok(race.every((beat) => beat.frameIndex >= 0 && beat.frameIndex <= 3));
});

test("playoff beats are emitted in bracket order before the champion", () => {
  const playoffs = [
    {
      season_id: "season_001",
      division: "Playoffs",
      stage: "playoffs",
      week: "Finale",
      player_a: "Alice",
      player_b: "Bob",
      winner: "Alice",
      score_a: "4",
      score_b: "2",
      match_id: "p2",
      data_status: "sheet_extracted",
      source_urls: "https://example.com/f",
    },
    {
      season_id: "season_001",
      division: "Playoffs",
      stage: "playoffs",
      week: "Halbfinale",
      player_a: "Bob",
      player_b: "Carol",
      winner: "Bob",
      score_a: "3",
      score_b: "1",
      match_id: "p1",
      data_status: "sheet_extracted",
      source_urls: "https://example.com/hf",
    },
  ];
  const beats = seasonStoryBeats({ ...BASE, playoffMatches: playoffs });
  const playoffBeats = beats.filter((beat) => beat.kind === "playoff");
  assert.deepEqual(playoffBeats.map((beat) => beat.matchId), ["p1", "p2"]);
  const championIndex = beats.findIndex((beat) => beat.kind === "champion");
  assert.ok(beats.findIndex((beat) => beat.matchId === "p2") < championIndex);
});
