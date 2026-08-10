import assert from "node:assert/strict";
import { awardsBySeason, finderFilterRows, hofInductees, spoonRows } from "../web/records.js";

// --- finderFilterRows ---
const MATCHES = [
  { season_id: "season_001", division: "Liga 1", stage: "Regular Season", week: "1", player_a: "Anna", player_b: "Ben", winner: "Anna", score_a: "6", score_b: "0", data_status: "available", match_id: "m1" },
  { season_id: "season_001", division: "Liga 1", stage: "Regular Season", week: "2", player_a: "Anna", player_b: "Cid", winner: "Cid", score_a: "0", score_b: "2", data_status: "available", match_id: "m2" },
  { season_id: "season_002", division: "Liga 2", stage: "Regular Season", week: "1", player_a: "Ben", player_b: "Cid", winner: "Ben", score_a: "1", score_b: "0", data_status: "available", match_id: "m3" },
  { season_id: "season_001", division: "Liga 1", stage: "video", week: "", player_a: "", player_b: "", winner: "", data_status: "source_video_only", match_id: "m4" },
];
const MATCHDAYS = [
  { season_id: "season_001", person_name_normalized: "anna", week: "1", pokemon_normalized: "gengar", used: "1" },
  { season_id: "season_001", person_name_normalized: "ben", week: "1", pokemon_normalized: "mew", used: "1" },
];

assert.equal(finderFilterRows(MATCHES, [], {}).length, 3); // source_video_only never shows
assert.deepEqual(finderFilterRows(MATCHES, [], { participant: "Anna" }).map((r) => r.match_id), ["m1", "m2"]);
assert.deepEqual(finderFilterRows(MATCHES, [], { participant: "Anna", opponent: "Ben" }).map((r) => r.match_id), ["m1"]);
assert.deepEqual(finderFilterRows(MATCHES, [], { season: "season_002" }).map((r) => r.match_id), ["m3"]);
assert.deepEqual(finderFilterRows(MATCHES, [], { division: "Liga 2" }).map((r) => r.match_id), ["m3"]);
assert.deepEqual(finderFilterRows(MATCHES, [], { sweepsOnly: true }).map((r) => r.match_id), ["m1"]);
assert.deepEqual(finderFilterRows(MATCHES, MATCHDAYS, { pokemon: "Gengar" }).map((r) => r.match_id), ["m1"]);
assert.deepEqual(finderFilterRows(MATCHES, MATCHDAYS, { pokemon: "Mew" }).map((r) => r.match_id), ["m1"]); // Ben brought Mew in week 1

// --- hofInductees ---
const ALL_TIME = [
  { person_id: "person_anna", person_name: "Anna", seasons: "3", seasons_won: "1", title_seasons: "S1", matches: "50", wins: "35", losses: "15", draws: "0", win_pct: "70.0%", kills: "120", elo: "1700" },
  { person_id: "person_ben", person_name: "Ben", seasons: "9", seasons_won: "0", title_seasons: "", matches: "80", wins: "30", losses: "50", draws: "0", win_pct: "37.5%", kills: "300", elo: "1450" },
  { person_id: "person_cid", person_name: "Cid", seasons: "2", seasons_won: "0", title_seasons: "", matches: "10", wins: "6", losses: "4", draws: "0", win_pct: "60.0%", kills: "20", elo: "1520" },
];
const CHAMPIONS = [{ season_id: "season_001", champion_name: "Anna", data_status: "source_evidenced" }];
const KILLLISTS = [
  { season_id: "season_001", pokemon: "Gengar", trainer: "Anna", kills: "40", data_status: "available" },
  { season_id: "season_002", pokemon: "Mew", trainer: "Anna", kills: "10", data_status: "available" },
];
const PEAKS = new Map([["anna", 1750], ["ben", 1600], ["cid", 1530]]);

const inducted = hofInductees({ personAllTime: ALL_TIME, champions: CHAMPIONS, killlists: KILLLISTS, peaks: PEAKS });
const anna = inducted.find((row) => row.personId === "person_anna");
assert.ok(anna, "champion is inducted");
assert.ok(anna.criteria.includes("champion"));
assert.equal(anna.signaturePokemon, "Gengar");
const ben = inducted.find((row) => row.personId === "person_ben");
assert.ok(ben, "eight-plus seasons inducts");
assert.ok(ben.criteria.includes("seasons"));
const cid = inducted.find((row) => row.personId === "person_cid");
assert.equal(cid, undefined, "60% win rate below 40 matches does not induct");

// --- spoonRows / awardsBySeason ---
const AWARDS = [
  { award_key: "holzloeffel", scope: "season", season_id: "season_001", division: "Liga 1", person_id: "person_cid", person_name: "Cid", value: "12", formula: "last_place", source_urls: "u" },
  { award_key: "mvp", scope: "season", season_id: "season_001", division: "Liga 1", person_id: "person_anna", person_name: "Anna", value: "78.2", formula: "weighted_rating_min5", source_urls: "u" },
  { award_key: "iron_man", scope: "career", season_id: "", division: "", person_id: "person_ben", person_name: "Ben", value: "9", formula: "consecutive_seasons", source_urls: "u" },
];
assert.deepEqual(spoonRows(AWARDS).map((r) => r.person_name), ["Cid"]);
assert.deepEqual(awardsBySeason(AWARDS, "season_001").map((r) => r.award_key), ["holzloeffel", "mvp"]);
assert.deepEqual(awardsBySeason(AWARDS, "all").map((r) => r.award_key), ["holzloeffel", "mvp", "iron_man"]);
