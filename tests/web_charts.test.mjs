import assert from "node:assert/strict";
import { paddedDomain, buildSeries, stackSegments } from "../web/charts.js";

assert.deepEqual(paddedDomain([1500, 1500]), [1499, 1501]); // degenerate domain gets ±1
const [lo, hi] = paddedDomain([1400, 1600]);
assert.ok(lo < 1400 && hi > 1600);
assert.deepEqual(paddedDomain([]), [0, 1]); // empty input stays renderable

const series = buildSeries(
  [{ seq: 0, rating: 1500 }, { seq: 1, rating: 1516 }],
  (point) => point.seq,
  (point) => point.rating,
);
assert.deepEqual(series.xDomain, [0, 1]);
assert.deepEqual(series.points.map((point) => point.y), [1500, 1516]);
assert.deepEqual(series.points.map((point) => point.x), [0, 1]);
assert.ok(series.yDomain[0] < 1500 && series.yDomain[1] > 1516);
// original point objects stay reachable for hover resolution
assert.equal(series.points[1].source.rating, 1516);

// stacked segments accumulate upward; non-finite values contribute nothing
assert.deepEqual(stackSegments([2, 3, 1]), [
  { y0: 0, y1: 2 },
  { y0: 2, y1: 5 },
  { y0: 5, y1: 6 },
]);
assert.deepEqual(stackSegments([1, Number.NaN, 2]), [
  { y0: 0, y1: 1 },
  { y0: 1, y1: 1 },
  { y0: 1, y1: 3 },
]);
// negative values stack downward from the zero line
assert.deepEqual(stackSegments([-2, 3, -1]), [
  { y0: 0, y1: -2 },
  { y0: 0, y1: 3 },
  { y0: -2, y1: -3 },
]);
assert.deepEqual(stackSegments([]), []);
