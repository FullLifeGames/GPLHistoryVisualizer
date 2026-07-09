import assert from "node:assert/strict";

import { eloRatings } from "../web/stats.js";
import { readNormalizedCsv } from "./helpers/csv.mjs";

// The Elo column in person_all_time.csv is produced by _elo_by_person in
// src/gpl_history/aggregates.py, while the web app recomputes Elo at runtime
// via eloRatings. Both walk the same matches in chronological order, so they
// must land on the same rating for every person. They once did not: the two
// languages disagreed on how to rank matchdays and playoff rounds, and 25 of
// 69 people carried different ratings depending on which side you asked.

const matches = readNormalizedCsv("matches.csv");
const personAllTime = readNormalizedCsv("person_all_time.csv");

assert.ok(personAllTime.length > 0, "person_all_time.csv is empty");

// Since the alias canonicalization pass, matches.csv and person_all_time.csv
// carry the same preferred display name ("PokéBree") — compare names exactly.
const computed = new Map(eloRatings(matches).map((row) => [row.name, row.elo]));

const mismatches = [];
let compared = 0;
for (const person of personAllTime) {
  if (!person.elo) continue;
  compared += 1;
  const actual = computed.get(person.person_name);
  if (actual === undefined) {
    mismatches.push(`${person.person_name}: missing from eloRatings()`);
  } else if (actual !== person.elo) {
    mismatches.push(`${person.person_name}: person_all_time.csv=${person.elo} eloRatings()=${actual}`);
  }
}

assert.equal(
  mismatches.length,
  0,
  `Elo drift between Python and JS for ${mismatches.length}/${compared} people. ` +
    `Check that matchWeekOrder (web/stats.js) and _week_sort (aggregates.py) still agree, ` +
    `then re-run "npm run aggregates".\n  ${mismatches.slice(0, 10).join("\n  ")}`,
);

assert.ok(compared >= 60, `expected to compare the full roster, only saw ${compared} people`);
