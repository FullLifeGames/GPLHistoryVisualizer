import assert from "node:assert/strict";
import test from "node:test";
import { dominanceRows, winChainGraph, winChainPath } from "../web/oracle.js";

const norm = (value) => String(value ?? "").trim().toLowerCase();
const matches = [
  { match_id: "m1", season_id: "season_001", week: "1", division: "L1", player_a: "Alba", player_b: "Bruno", winner: "Alba", result_basis: "" },
  { match_id: "m2", season_id: "season_001", week: "2", division: "L1", player_a: "Bruno", player_b: "Cora", winner: "Bruno", result_basis: "" },
  { match_id: "m3", season_id: "season_002", week: "1", division: "L1", player_a: "Bruno", player_b: "Cora", winner: "Bruno", result_basis: "", video_url: "https://v/3" },
  { match_id: "m4", season_id: "season_001", week: "3", division: "L1", player_a: "Cora", player_b: "Dino", winner: "Cora", result_basis: "" },
  { match_id: "m5", season_id: "season_001", week: "4", division: "L1", player_a: "Cora", player_b: "Ede", winner: "", result_basis: "draw" },
  { match_id: "m6", season_id: "season_001", week: "5", division: "L1", player_a: "Dino", player_b: "Ede", winner: "Dino", result_basis: "forfeit" },
  { match_id: "m7", season_id: "season_001", week: "6", division: "L1", player_a: "", player_b: "Ede", winner: "Ede", result_basis: "" },
];

test("win edges are directed and skip draws, forfeits, and player-less rows", () => {
  const graph = winChainGraph(matches, norm);
  assert.equal(graph.edges.get("alba").has("bruno"), true);
  assert.equal(graph.edges.get("bruno").has("alba"), false); // directed: loser has no edge back
  assert.equal(graph.edges.get("cora").has("ede"), false); // draw is not a win
  assert.equal(graph.edges.get("dino").has("ede"), false); // forfeit never played
  assert.equal(graph.nodes.has("ede"), true); // still a node via the draw
  assert.equal(graph.edges.get("bruno").get("cora").videoUrl, "https://v/3"); // m2 upgraded by m3
});

test("BFS finds the shortest directed win chain and respects direction", () => {
  const graph = winChainGraph(matches, norm);
  const path = winChainPath(graph, "alba", "dino");
  assert.deepEqual(path.map((hop) => hop.key), ["alba", "bruno", "cora", "dino"]);
  assert.equal(path[0].via, null);
  assert.equal(path[1].via.type, "match");
  assert.equal(path[3].via.matchId, "m4");
  assert.equal(winChainPath(graph, "dino", "alba"), null); // no wins flowing back up
  assert.equal(winChainPath(graph, "alba", "ede"), null); // ede was never beaten
});

test("dominance counts direct and transitive victims", () => {
  const graph = winChainGraph(matches, norm);
  const rows = dominanceRows(graph);
  const alba = rows.find((row) => row.key === "alba");
  assert.equal(alba.beats_direct, 1); // bruno
  assert.equal(alba.beats_transitive, 3); // bruno, cora, dino
  assert.equal(alba.share, 75); // 3 of the 4 other players (alba, bruno, cora, dino, ede)
  assert.equal(rows[0].key, "alba"); // most transitive victims first
});
