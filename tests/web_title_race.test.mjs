import assert from "node:assert/strict";
import test from "node:test";

import { titleRaceDivisions, titleRaceSeries } from "../web/title_race.js";

function row(week, personId, name, pFirst, pPlayoffs = "", division = "Liga 1") {
  return {
    season_id: "season_001",
    division,
    week: String(week),
    person_id: personId,
    person_name: name,
    p_first: pFirst,
    p_playoffs: pPlayoffs,
    sims: "100",
    seed: "42",
    source_urls: "https://example.com",
  };
}

const ROWS = [
  row(1, "person_a", "Alice", "0.6000"),
  row(1, "person_b", "Bob", "0.4000"),
  row(2, "person_a", "Alice", "0.9600"),
  row(2, "person_b", "Bob", "0.0400"),
  row(1, "person_c", "Carol", "1.0000", "", "Liga 2"),
];

test("titleRaceDivisions lists divisions of the season in order", () => {
  assert.deepEqual(titleRaceDivisions(ROWS, "season_001"), ["Liga 1", "Liga 2"]);
  assert.deepEqual(titleRaceDivisions(ROWS, "season_999"), []);
});

test("titleRaceSeries builds per-person point series over weeks", () => {
  const result = titleRaceSeries(ROWS, { seasonId: "season_001", division: "Liga 1" });
  assert.deepEqual(result.weeks, [1, 2]);
  assert.equal(result.series.length, 2);
  const alice = result.series.find((entry) => entry.personId === "person_a");
  assert.deepEqual(alice.points.map((point) => [point.x, point.y]), [[1, 0.6], [2, 0.96]]);
  assert.equal(alice.final, 0.96);
  assert.equal(result.sims, 100);
  assert.equal(result.playoffSeries, null);
});

test("series are ranked by final probability and capped at topN", () => {
  const many = [];
  for (let index = 0; index < 12; index += 1) {
    many.push(row(1, `person_${index}`, `P${index}`, (index / 100).toFixed(4)));
  }
  const result = titleRaceSeries(many, { seasonId: "season_001", division: "Liga 1", topN: 5 });
  assert.equal(result.series.length, 5);
  assert.equal(result.series[0].personId, "person_11");
});

test("decidedWeek is the first week a probability reaches 0.95", () => {
  const result = titleRaceSeries(ROWS, { seasonId: "season_001", division: "Liga 1" });
  assert.equal(result.decidedWeek, 2);
  assert.equal(result.decidedName, "Alice");
  const open = titleRaceSeries(ROWS.filter((entry) => entry.week === "1"), { seasonId: "season_001", division: "Liga 1" });
  assert.equal(open.decidedWeek, null);
});

test("playoffSeries appears when p_playoffs is populated", () => {
  const rows = [
    row(1, "person_a", "Alice", "0.6000", "0.9000"),
    row(1, "person_b", "Bob", "0.4000", "0.8000"),
  ];
  const result = titleRaceSeries(rows, { seasonId: "season_001", division: "Liga 1" });
  assert.equal(result.playoffSeries.length, 2);
  assert.deepEqual(result.playoffSeries[0].points.map((point) => point.y), [0.9]);
});
