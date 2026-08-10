import assert from "node:assert/strict";
import test from "node:test";
import { rivalryPairs } from "../web/rivalries.js";

const norm = (value) => String(value ?? "").trim().toLowerCase();

const summary = [
  { person_id: "person_a", person_name: "Alba", opponent_id: "person_b", opponent_name: "Bruno", matches: "4", wins: "2", losses: "2", draws: "0", source_urls: "u1" },
  { person_id: "person_b", person_name: "Bruno", opponent_id: "person_a", opponent_name: "Alba", matches: "4", wins: "2", losses: "2", draws: "0", source_urls: "u1" },
  { person_id: "person_a", person_name: "Alba", opponent_id: "person_c", opponent_name: "Cora", matches: "2", wins: "2", losses: "0", draws: "0", source_urls: "u2" },
  { person_id: "person_c", person_name: "Cora", opponent_id: "person_a", opponent_name: "Alba", matches: "2", wins: "0", losses: "2", draws: "0", source_urls: "u2" },
  { person_id: "person_b", person_name: "Bruno", opponent_id: "person_c", opponent_name: "Cora", matches: "5", wins: "5", losses: "0", draws: "0", source_urls: "u3" },
  { person_id: "person_c", person_name: "Cora", opponent_id: "person_b", opponent_name: "Bruno", matches: "5", wins: "0", losses: "5", draws: "0", source_urls: "u3" },
];
const highlights = [
  { player_a: "Bruno", player_b: "Alba", view_total: "1000" },
  { player_a: "Alba", player_b: "Bruno", view_total: "500" },
  { player_a: "Cora", player_b: "Bruno", view_total: "90000" },
];

test("dedupes directed pairs, applies min meetings, joins views", () => {
  const rows = rivalryPairs(summary, highlights, norm);
  assert.equal(rows.length, 2); // a-c has only 2 meetings
  const ab = rows.find((row) => row.a_id === "person_a" && row.b_id === "person_b");
  assert.equal(ab.matches, 4);
  assert.equal(ab.wins_a, 2);
  assert.equal(ab.wins_b, 2);
  assert.equal(ab.closeness, 1);
  assert.equal(ab.view_total, 1500);
  assert.equal(ab.a_name, "Alba");
  assert.equal(ab.b_name, "Bruno");
});

test("score ranks even pairs above one-sided pairs of similar size", () => {
  const rows = rivalryPairs(summary, highlights, norm);
  const ab = rows.find((row) => row.a_id === "person_a");
  // 4 * (0.2 + 1) * (1 + log10(1501))
  assert.ok(Math.abs(ab.rivalry_score - 4 * 1.2 * (1 + Math.log10(1501))) < 1e-9);
  const bc = rows.find((row) => row.a_id === "person_b");
  assert.equal(bc.closeness, 0); // 5:0
  assert.ok(Math.abs(bc.rivalry_score - 5 * 0.2 * (1 + Math.log10(90001))) < 1e-9);
});

test("empty highlights degrade to zero views", () => {
  const rows = rivalryPairs(summary, [], norm);
  assert.equal(rows.find((row) => row.a_id === "person_a").view_total, 0);
});
