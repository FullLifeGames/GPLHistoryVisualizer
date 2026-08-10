import assert from "node:assert/strict";
import test from "node:test";

import {
  dailyKader,
  dateSeedString,
  kaderHintValues,
  kaderPools,
  klickCandidates,
  nextKlickIndex,
  pickIndex,
  pickTippRound,
  seededRandom,
  shuffled,
  tippCandidates,
  updateDailyStreak,
} from "../web/games.js";

const norm = (value) => String(value ?? "").trim().toLowerCase();

test("seededRandom is deterministic per seed and differs across seeds", () => {
  const a1 = seededRandom("2026-08-10");
  const a2 = seededRandom("2026-08-10");
  const b = seededRandom("2026-08-11");
  const seqA1 = [a1(), a1(), a1()];
  const seqA2 = [a2(), a2(), a2()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA1, seqA2);
  assert.notDeepEqual(seqA1, seqB);
  for (const value of seqA1) {
    assert.ok(value >= 0 && value < 1);
  }
});

test("pickIndex stays in range and shuffled permutes without mutating", () => {
  const rng = seededRandom("pick");
  for (let i = 0; i < 50; i += 1) {
    const index = pickIndex(rng, 7);
    assert.ok(Number.isInteger(index) && index >= 0 && index < 7);
  }
  const input = ["a", "b", "c", "d", "e"];
  const result = shuffled(input, seededRandom("shuffle"));
  assert.deepEqual(input, ["a", "b", "c", "d", "e"]);
  assert.deepEqual([...result].sort(), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(result, shuffled(input, seededRandom("shuffle")));
});

test("dateSeedString formats a local YYYY-MM-DD", () => {
  assert.equal(dateSeedString(new Date(2026, 7, 10, 23, 59)), "2026-08-10");
  assert.equal(dateSeedString(new Date(2026, 0, 5)), "2026-01-05");
});

test("updateDailyStreak increments on consecutive days and resets on gaps or losses", () => {
  const start = updateDailyStreak(null, "2026-08-10", true);
  assert.deepEqual(start, { streak: 1, best: 1, lastDate: "2026-08-10" });
  const next = updateDailyStreak(start, "2026-08-11", true);
  assert.deepEqual(next, { streak: 2, best: 2, lastDate: "2026-08-11" });
  // Same day again: no double counting.
  assert.deepEqual(updateDailyStreak(next, "2026-08-11", true), next);
  // A gap starts over at 1 but keeps the best.
  assert.deepEqual(updateDailyStreak(next, "2026-08-14", true), { streak: 1, best: 2, lastDate: "2026-08-14" });
  // A loss zeroes the streak and keeps the best.
  assert.deepEqual(updateDailyStreak(next, "2026-08-12", false), { streak: 0, best: 2, lastDate: "2026-08-12" });
});

const ROSTER_ROWS = [
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Glurak", slot: "1", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Bisaflor", slot: "2", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Turtok", slot: "3", source_urls: "https://sheet/b" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Relaxo", slot: "4", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Dragoran", slot: "5", source_urls: "" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Gengar", slot: "6", source_urls: "" },
  // Duplicate pokemon from a second roster phase must dedupe.
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Glurak", slot: "1", source_urls: "" },
  // Too-small roster is excluded.
  { season_id: "season_009", division: "Singles", person_name: "Mini", team_name: "Minis", pokemon: "Pikachu", slot: "1", source_urls: "" },
  // Rows without a pokemon or person are skipped.
  { season_id: "season_009", division: "Singles", person_name: "", team_name: "", pokemon: "Ditto", slot: "1", source_urls: "" },
];

test("kaderPools groups, dedupes, and filters small rosters", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  assert.equal(pools.length, 1);
  const pool = pools[0];
  assert.equal(pool.personName, "Bene");
  assert.equal(pool.personKey, "bene");
  assert.equal(pool.seasonId, "season_009");
  assert.equal(pool.teamName, "Wackel Backel");
  assert.deepEqual(pool.pokemon, ["Glurak", "Bisaflor", "Turtok", "Relaxo", "Dragoran", "Gengar"]);
  assert.ok(pool.sourceUrls.includes("https://sheet/a"));
  assert.ok(pool.sourceUrls.includes("https://sheet/b"));
  assert.ok(pool.sampleRow);
});

test("dailyKader picks deterministically per date and permutes the reveal order", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  const one = dailyKader(pools, "2026-08-10");
  const two = dailyKader(pools, "2026-08-10");
  assert.deepEqual(one, two);
  assert.equal(one.pool.poolKey, pools[0].poolKey);
  assert.deepEqual([...one.revealOrder].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(dailyKader([], "2026-08-10"), null);
});

test("kaderHintValues resolves division, final rank and season", () => {
  const standings = [
    { season_id: "season_009", division: "Singles", stage: "final_table", is_primary: "true", rank: "3", player_name: "Bene" },
    { season_id: "season_009", division: "Singles", stage: "regular_season", is_primary: "true", rank: "5", player_name: "Bene" },
  ];
  const pool = kaderPools(ROSTER_ROWS, norm)[0];
  assert.deepEqual(kaderHintValues(pool, standings, norm), { division: "Singles", rank: "3", seasonId: "season_009" });
  assert.deepEqual(kaderHintValues(pool, [], norm), { division: "Singles", rank: "", seasonId: "season_009" });
});

test("tippCandidates keeps only decided, scored, non-forfeit matches", () => {
  const matches = [
    { match_id: "m1", player_a: "A", player_b: "B", score_a: "4", score_b: "2", winner: "A", result_basis: "two_sided_score" },
    // Forfeits and unresolved results are not guessable games.
    { match_id: "m2", player_a: "A", player_b: "B", score_a: "6", score_b: "0", winner: "A", result_basis: "forfeit_win" },
    { match_id: "m3", player_a: "A", player_b: "B", score_a: "", score_b: "", winner: "A", result_basis: "unresolved_conflict" },
    // Draws have no winner to pick.
    { match_id: "m4", player_a: "A", player_b: "B", score_a: "3", score_b: "3", winner: "", result_basis: "two_sided_score" },
    // Missing scores make the reveal empty.
    { match_id: "m5", player_a: "A", player_b: "B", score_a: "", score_b: "2", winner: "B", result_basis: "one_sided_score" },
    { match_id: "m6", player_a: "A", player_b: "", score_a: "4", score_b: "2", winner: "A", result_basis: "two_sided_score" },
  ];
  const candidates = tippCandidates(matches, norm);
  assert.deepEqual(candidates.map((row) => row.match_id), ["m1"]);
});

test("pickTippRound picks deterministically with a seeded rng", () => {
  const candidates = [{ match_id: "m1" }, { match_id: "m2" }, { match_id: "m3" }];
  const first = pickTippRound(candidates, seededRandom("round-1"));
  assert.ok(candidates.includes(first));
  assert.equal(pickTippRound(candidates, seededRandom("round-1")), first);
  assert.equal(pickTippRound([], seededRandom("x")), null);
});

test("klickCandidates requires id, title and a positive view count", () => {
  const rows = [
    { video_id: "v1", title: "A", view_count: "1000" },
    { video_id: "v2", title: "B", view_count: "0" },
    { video_id: "", title: "C", view_count: "500" },
    { video_id: "v4", title: "", view_count: "500" },
    { video_id: "v5", title: "E", view_count: "abc" },
    { video_id: "v6", title: "F", view_count: "2000" },
  ];
  assert.deepEqual(klickCandidates(rows).map((row) => row.video_id), ["v1", "v6"]);
});

test("nextKlickIndex avoids the current video and equal view counts", () => {
  const candidates = [
    { video_id: "v1", view_count: "1000" },
    { video_id: "v2", view_count: "1000" },
    { video_id: "v3", view_count: "2000" },
  ];
  const rng = seededRandom("klick");
  for (let i = 0; i < 20; i += 1) {
    const next = nextKlickIndex(candidates, 0, rng);
    assert.equal(next, 2, "only v3 has a different view count than v1");
  }
  // No valid opponent -> -1.
  assert.equal(nextKlickIndex([{ view_count: "5" }, { view_count: "5" }], 0, seededRandom("x")), -1);
  assert.equal(nextKlickIndex([], 0, seededRandom("x")), -1);
});
