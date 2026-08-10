import assert from "node:assert/strict";
import { eloChronology, eloLedgerRows, personEloSeries, upsetRows } from "../web/elo_history.js";

const fixture = [
  { season_id: "season_001", match_id: "m1", week: "1", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "Anna", data_status: "available" },
  { season_id: "season_001", match_id: "m2", week: "2", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "Anna", data_status: "available" },
  { season_id: "season_001", match_id: "m3", week: "3", stage: "Regular Season", player_a: "Ben", player_b: "Anna", winner: "Ben", data_status: "available" },
];
const chrono = eloChronology(fixture);

const m1 = chrono.perMatch.get("m1");
assert.equal(m1.eloPreA, 1500);
assert.equal(m1.winProbA, 0.5);
assert.equal(Math.round(m1.eloAfterA), 1516);
assert.equal(Math.round(m1.eloAfterB), 1484);
assert.ok(m1.deltaA > 0 && m1.deltaB < 0);

const m2 = chrono.perMatch.get("m2");
assert.equal(Math.round(m2.eloPreA), 1516);
assert.ok(Math.abs(m2.winProbA - 0.5459) < 0.001); // 1/(1+10^((1484-1516)/400))

assert.deepEqual(chrono.order, ["m1", "m2", "m3"]);

const anna = chrono.perPerson.get("anna");
assert.equal(anna.name, "Anna");
assert.equal(anna.points.length, 3);
assert.deepEqual(anna.points.map((p) => p.seq), [0, 1, 2]);
assert.equal(anna.peak.matchId, "m2"); // peaks after second win, dips after m3

// final ratings agree with eloRatings' rounded output
const annaFinal = chrono.finalRows.find((row) => row.key === "anna");
assert.equal(annaFinal.elo, String(Math.round(anna.points[2].rating)));

// rows without both players or with excluded data_status never enter the chronology
const withSkipped = fixture.concat([
  { season_id: "season_001", match_id: "m9", week: "9", stage: "Regular Season", player_a: "Anna", player_b: "", winner: "", data_status: "available" },
  { season_id: "season_001", match_id: "m10", week: "10", stage: "video", player_a: "Anna", player_b: "Ben", winner: "", data_status: "source_video_only" },
]);
const chronoSkipped = eloChronology(withSkipped);
assert.equal(chronoSkipped.perMatch.has("m9"), false);
assert.equal(chronoSkipped.perMatch.has("m10"), false);
assert.deepEqual(chronoSkipped.order, ["m1", "m2", "m3"]);

// --- upsetRows ---
// Anna beats Ben twice (m1, m2), then Ben wins m3 as the underdog.
const upsets = upsetRows(fixture, chrono);
assert.equal(upsets[0].match_id, "m3"); // the only underdog win ranks first
assert.ok(upsets[0].win_prob_winner < 0.5);
assert.equal(upsets[0].winner_name, "Ben");
assert.equal(upsets[0].loser_name, "Anna");
assert.ok(upsets[0].elo_pre_winner < upsets[0].elo_pre_loser);
assert.equal(upsets.length, 3);
assert.ok(upsets[0].upset_score > upsets[1].upset_score);

// draws and special results are excluded
const withDraw = fixture.concat([
  { season_id: "season_001", match_id: "m4", week: "4", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "", result_basis: "draw", data_status: "available" },
  { season_id: "season_001", match_id: "m5", week: "5", stage: "Regular Season", player_a: "Anna", player_b: "Ben", winner: "Anna", result_basis: "forfeit", data_status: "available" },
]);
const chronoWithDraw = eloChronology(withDraw);
const upsetsWithDraw = upsetRows(withDraw, chronoWithDraw);
assert.ok(!upsetsWithDraw.some((row) => row.match_id === "m4"));
assert.ok(!upsetsWithDraw.some((row) => row.match_id === "m5"));

// view z-scores join by match id when highlights are provided
const highlighted = upsetRows(fixture, chrono, [{ match_id: "m3", views_z_score_peak: "3.2" }]);
assert.equal(highlighted[0].views_z_score, "3.2");
assert.equal(highlighted[1].views_z_score, "");

// the score is displayed winner-first, matching the winner-vs-loser layout
const sideFixture = [
  { season_id: "season_001", match_id: "s1", week: "1", stage: "Regular Season", player_a: "Carla", player_b: "Dana", winner: "Dana", score_a: "0", score_b: "4", data_status: "available" },
  { season_id: "season_001", match_id: "s2", week: "2", stage: "Regular Season", player_a: "Dana", player_b: "Carla", winner: "Dana", score_a: "2", score_b: "0", data_status: "available" },
];
const sideChrono = eloChronology(sideFixture);
const sideUpsets = upsetRows(sideFixture, sideChrono);
const s1 = sideUpsets.find((row) => row.match_id === "s1");
const s2 = sideUpsets.find((row) => row.match_id === "s2");
assert.equal(s1.winner_name, "Dana");
assert.equal(s1.score, "4:0"); // stored as 0:4 for player_a Carla, shown winner-first
assert.equal(s2.score, "2:0"); // winner already was player_a, unchanged

// --- personEloSeries ---
const stints = [
  { season_id: "season_001", person_name: "Anna", team_name: "Team A", division: "Liga 1" },
];
const champs = [{ season_id: "season_001", champion_name: "Anna" }];
const series = personEloSeries("anna", chrono, stints, champs);
assert.equal(series.points.length, 3);
assert.equal(series.bands.length, 1);
assert.ok(series.bands[0].label.includes("Team A"));
assert.equal(series.bands[0].shortLabel, "S1"); // fallback when the full label does not fit the band
assert.equal(series.bands[0].fromSeq, 0);
assert.equal(series.bands[0].toSeq, 2);
assert.equal(series.markers.length, 1);
assert.equal(series.markers[0].seq, 2); // title marker at last match of the title season
assert.equal(series.peak.matchId, "m2");
assert.ok(Math.round(series.peak.rating) === 1531);

// unknown person yields an empty series instead of throwing
const empty = personEloSeries("nobody", chrono, stints, champs);
assert.deepEqual(empty.points, []);
assert.deepEqual(empty.bands, []);
assert.deepEqual(empty.markers, []);

// --- eloLedgerRows ---
const ledger = eloLedgerRows("anna", chrono, fixture);
assert.equal(ledger.length, 3);
assert.equal(ledger[0].opponent_name, "Ben");
assert.equal(ledger[0].result, "win");
assert.ok(ledger[0].elo_delta > 0 && ledger[2].elo_delta < 0);
assert.equal(ledger[2].result, "loss");
assert.equal(Math.round(ledger[1].elo_after), 1531);
assert.equal(ledger[0].match_id, "m1");
assert.equal(ledger[0].season_id, "season_001");
assert.deepEqual(eloLedgerRows("nobody", chrono, fixture), []);

// a draw shows result "draw" even though the favorite loses rating points
const drawLedger = eloLedgerRows("anna", chronoWithDraw, withDraw);
const drawRow = drawLedger.find((row) => row.match_id === "m4");
assert.equal(drawRow.result, "draw");
assert.ok(drawRow.elo_delta < 0); // Anna is rated higher, so the draw costs points

// ledger scores read from the focused person's perspective
const danaLedger = eloLedgerRows("dana", sideChrono, sideFixture);
assert.equal(danaLedger[0].score, "4:0"); // Dana was player_b in s1 (0:4)
assert.equal(danaLedger[1].score, "2:0"); // Dana was player_a in s2
const carlaLedger = eloLedgerRows("carla", sideChrono, sideFixture);
assert.equal(carlaLedger[0].score, "0:4");
assert.equal(carlaLedger[1].score, "0:2");
