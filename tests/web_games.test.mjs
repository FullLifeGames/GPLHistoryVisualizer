import assert from "node:assert/strict";
import test from "node:test";

import {
  dateSeedString,
  pickIndex,
  seededRandom,
  shuffled,
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
