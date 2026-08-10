import assert from "node:assert/strict";
import test from "node:test";
import { rivalryMeetings, rivalryPairs } from "../web/rivalries.js";
import { eloChronology } from "../web/elo_history.js";

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

const meetingMatches = [
  { match_id: "m1", season_id: "season_001", week: "1. Spieltag", player_a: "Alba", player_b: "Bruno", score_a: "4", score_b: "0", winner: "Alba", division: "Liga 1", result_basis: "", source_urls: "s1" },
  { match_id: "mx", season_id: "season_001", week: "2. Spieltag", player_a: "Alba", player_b: "Cora", score_a: "2", score_b: "0", winner: "Alba", division: "Liga 1", result_basis: "", source_urls: "sx" },
  { match_id: "m2", season_id: "season_001", week: "3. Spieltag", player_a: "Bruno", player_b: "Alba", score_a: "2", score_b: "1", winner: "Bruno", division: "Liga 1", result_basis: "", source_urls: "s2" },
  { match_id: "m3", season_id: "season_002", week: "1. Spieltag", player_a: "Alba", player_b: "Bruno", score_a: "1", score_b: "1", winner: "", division: "Liga 1", result_basis: "draw", source_urls: "s3" },
  { match_id: "m4", season_id: "season_002", week: "2. Spieltag", player_a: "Alba", player_b: "Bruno", score_a: "0", score_b: "1", winner: "Bruno", division: "Liga 1", result_basis: "", source_urls: "s4", video_url: "https://v/4" },
];

test("rivalryMeetings orients scores to the pair, tracks streaks and biggest win", () => {
  const chronology = eloChronology(meetingMatches, norm);
  const { meetings, summary: pairSummary, gapPoints } = rivalryMeetings("alba", "bruno", chronology, meetingMatches, [], norm);
  assert.equal(meetings.length, 4);
  assert.equal(meetings.some((meeting) => meeting.match_id === "mx"), false);
  const m2 = meetings.find((meeting) => meeting.match_id === "m2");
  assert.equal(m2.score, "1:2"); // stored Bruno-first, oriented Alba-first
  assert.equal(m2.winner, "b");
  assert.equal(pairSummary.wins_a, 1);
  assert.equal(pairSummary.wins_b, 2);
  assert.equal(pairSummary.draws, 1);
  assert.deepEqual({ side: pairSummary.streak.side, length: pairSummary.streak.length }, { side: "b", length: 1 }); // m3 draw broke Bruno's run
  assert.equal(pairSummary.biggest.match_id, "m1"); // 4:0 margin
  assert.equal(gapPoints[0].x, 1);
  assert.equal(gapPoints[0].y, 0); // both start at 1500
  assert.equal(pairSummary.mostWatched, null);
  assert.equal(meetings[0].win_prob_a, 0.5); // both at 1500 before m1
  assert.equal(meetings[0].against_odds, false); // 50:50 has no favorite to upset
  const m4 = meetings.find((meeting) => meeting.match_id === "m4");
  assert.ok(m4.win_prob_a > 0.5); // Alba ahead after 4:0 despite the m2 loss
  assert.equal(m4.against_odds, true); // Bruno won as the Elo underdog
});

test("rivalryMeetings picks the most watched meeting from highlights", () => {
  const chronology = eloChronology(meetingMatches, norm);
  const pairHighlights = [
    { match_id: "m1", view_total: "100" },
    { match_id: "m4", view_total: "5000" },
  ];
  const { summary: pairSummary } = rivalryMeetings("alba", "bruno", chronology, meetingMatches, pairHighlights, norm);
  assert.equal(pairSummary.mostWatched.match_id, "m4");
  assert.equal(pairSummary.mostWatched.view_total, 5000);
});
