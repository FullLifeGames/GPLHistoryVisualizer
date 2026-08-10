import assert from "node:assert/strict";
import test from "node:test";
import { connectednessRows, oracleGraph, oraclePath } from "../web/oracle.js";

const norm = (value) => String(value ?? "").trim().toLowerCase();
const matches = [
  { match_id: "m1", season_id: "season_001", week: "1", division: "L1", player_a: "Alba", player_b: "Bruno", winner: "Alba", result_basis: "" },
  { match_id: "m2", season_id: "season_001", week: "2", division: "L1", player_a: "Bruno", player_b: "Cora", winner: "Cora", result_basis: "", video_url: "https://v/2" },
  { match_id: "m3", season_id: "season_002", week: "1", division: "L1", player_a: "Alba", player_b: "Bruno", winner: "Bruno", result_basis: "", video_url: "https://v/3" },
  { match_id: "m4", season_id: "season_001", week: "3", division: "L1", player_a: "Cora", player_b: "Dino", winner: "", result_basis: "forfeit" },
  { match_id: "m5", season_id: "season_001", week: "4", division: "L1", player_a: "", player_b: "Dino", winner: "", result_basis: "" },
];
const stints = [
  { season_id: "season_003", division: "Liga 1", person_name: "Dino" },
  { season_id: "season_003", division: "Liga 1", person_name: "Cora" },
];

test("match edges skip forfeits and player-less rows, upgrade to video via", () => {
  const graph = oracleGraph(matches, [], {}, norm);
  assert.equal(graph.edges.has("dino"), false);
  assert.equal(graph.edges.get("alba").get("bruno").videoUrl, "https://v/3"); // m1 upgraded by m3
  assert.equal(graph.edges.get("alba").get("bruno").matchId, "m3");
  assert.equal(graph.nodes.get("alba").name, "Alba");
});

test("BFS finds the shortest chain with via metadata", () => {
  const graph = oracleGraph(matches, [], {}, norm);
  const path = oraclePath(graph, "alba", "cora");
  assert.deepEqual(path.map((hop) => hop.key), ["alba", "bruno", "cora"]);
  assert.equal(path[0].via, null);
  assert.equal(path[1].via.type, "match");
  assert.equal(path[2].via.matchId, "m2");
  assert.equal(oraclePath(graph, "alba", "dino"), null);
});

test("stint edges only appear with the toggle and never shadow match edges", () => {
  const withStints = oracleGraph(matches, stints, { includeStints: true }, norm);
  assert.equal(withStints.edges.get("cora").get("dino").type, "stint");
  assert.equal(withStints.edges.get("alba").get("bruno").type, "match");
  const path = oraclePath(withStints, "alba", "dino");
  assert.equal(path.length, 4);
  assert.equal(path[3].via.type, "stint");
  assert.equal(path[3].via.seasonId, "season_003");
});

test("connectedness counts distinct opponents over played matches", () => {
  const rows = connectednessRows(matches, norm);
  assert.deepEqual(rows[0], { key: "bruno", name: "Bruno", opponents: 2, matches: 3 });
  assert.equal(rows.find((row) => row.key === "dino"), undefined);
});
