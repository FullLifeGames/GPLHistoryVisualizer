import assert from "node:assert/strict";
import test from "node:test";

import {
  dailyKader,
  dateSeedString,
  kaderHintValues,
  kaderPools,
  kaderPuzzle,
  klickCandidates,
  nextKlickIndex,
  personRiddleCandidates,
  personRiddleHints,
  personRiddleRound,
  pickIndex,
  pickTippRound,
  QUIZ_CATEGORIES,
  quizPoolSizes,
  quizQuestion,
  seededRandom,
  STATS_DUEL_STATS,
  statsDuelCandidates,
  statsDuelRound,
  weightedQuizCategory,
  shuffled,
  tippCandidates,
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

const ROSTER_ROWS = [
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Glurak", slot: "1", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Bisaflor", slot: "2", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Turtok", slot: "3", source_urls: "https://sheet/b" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Relaxo", slot: "4", source_urls: "https://sheet/a" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Dragoran", slot: "5", source_urls: "" },
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Gengar", slot: "6", source_urls: "" },
  // Duplicate pokemon from a second roster phase must dedupe.
  { season_id: "season_009", division: "Singles", person_name: "Bene", team_name: "Wackel Backel", pokemon: "Glurak", slot: "1", source_urls: "" },
  // Too-small roster is excluded.
  { season_id: "season_009", division: "Singles", person_name: "Mini", team_name: "Minis", pokemon: "Pikachu", slot: "1", source_urls: "" },
  // Rows without a pokemon or person are skipped.
  { season_id: "season_009", division: "Singles", person_name: "", team_name: "", pokemon: "Ditto", slot: "1", source_urls: "" },
];

test("kaderPools groups, dedupes, and filters small rosters", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  assert.equal(pools.length, 1);
  const pool = pools[0];
  assert.equal(pool.personName, "Bene");
  assert.equal(pool.personKey, "bene");
  assert.equal(pool.seasonId, "season_009");
  assert.equal(pool.teamName, "Wackel Backel");
  assert.deepEqual(pool.pokemon, ["Glurak", "Bisaflor", "Turtok", "Relaxo", "Dragoran", "Gengar"]);
  assert.ok(pool.sourceUrls.includes("https://sheet/a"));
  assert.ok(pool.sourceUrls.includes("https://sheet/b"));
  assert.ok(pool.sampleRow);
});

test("dailyKader picks deterministically per date and permutes the reveal order", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  const one = dailyKader(pools, "2026-08-10");
  const two = dailyKader(pools, "2026-08-10");
  assert.deepEqual(one, two);
  assert.equal(one.pool.poolKey, pools[0].poolKey);
  assert.deepEqual([...one.revealOrder].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
  assert.equal(dailyKader([], "2026-08-10"), null);
});

test("kaderPuzzle is seed-stable and backs the daily puzzle", () => {
  const pools = kaderPools(ROSTER_ROWS, norm);
  // Free-play rounds reuse the same seeded picker with their own seed.
  assert.deepEqual(kaderPuzzle(pools, "free-1"), kaderPuzzle(pools, "free-1"));
  assert.deepEqual(kaderPuzzle(pools, "kader-2026-08-10"), dailyKader(pools, "2026-08-10"));
  assert.equal(kaderPuzzle([], "free-1"), null);
});

test("kaderHintValues resolves division, final rank and season", () => {
  const standings = [
    { season_id: "season_009", division: "Singles", stage: "final_table", is_primary: "true", rank: "3", player_name: "Bene" },
    { season_id: "season_009", division: "Singles", stage: "regular_season", is_primary: "true", rank: "5", player_name: "Bene" },
  ];
  const pool = kaderPools(ROSTER_ROWS, norm)[0];
  assert.deepEqual(kaderHintValues(pool, standings, norm), { division: "Singles", rank: "3", seasonId: "season_009" });
  assert.deepEqual(kaderHintValues(pool, [], norm), { division: "Singles", rank: "", seasonId: "season_009" });
});

test("tippCandidates keeps only decided, scored, non-forfeit matches", () => {
  const matches = [
    { match_id: "m1", player_a: "A", player_b: "B", score_a: "4", score_b: "2", winner: "A", result_basis: "two_sided_score" },
    // Forfeits and unresolved results are not guessable games.
    { match_id: "m2", player_a: "A", player_b: "B", score_a: "6", score_b: "0", winner: "A", result_basis: "forfeit_win" },
    { match_id: "m3", player_a: "A", player_b: "B", score_a: "", score_b: "", winner: "A", result_basis: "unresolved_conflict" },
    // Draws have no winner to pick.
    { match_id: "m4", player_a: "A", player_b: "B", score_a: "3", score_b: "3", winner: "", result_basis: "two_sided_score" },
    // Missing scores make the reveal empty.
    { match_id: "m5", player_a: "A", player_b: "B", score_a: "", score_b: "2", winner: "B", result_basis: "one_sided_score" },
    { match_id: "m6", player_a: "A", player_b: "", score_a: "4", score_b: "2", winner: "A", result_basis: "two_sided_score" },
  ];
  const candidates = tippCandidates(matches, norm);
  assert.deepEqual(candidates.map((row) => row.match_id), ["m1"]);
});

test("pickTippRound picks deterministically with a seeded rng", () => {
  const candidates = [{ match_id: "m1" }, { match_id: "m2" }, { match_id: "m3" }];
  const first = pickTippRound(candidates, seededRandom("round-1"));
  assert.ok(candidates.includes(first));
  assert.equal(pickTippRound(candidates, seededRandom("round-1")), first);
  assert.equal(pickTippRound([], seededRandom("x")), null);
});

test("klickCandidates requires id, title and a positive view count", () => {
  const rows = [
    { video_id: "v1", title: "A", view_count: "1000" },
    { video_id: "v2", title: "B", view_count: "0" },
    { video_id: "", title: "C", view_count: "500" },
    { video_id: "v4", title: "", view_count: "500" },
    { video_id: "v5", title: "E", view_count: "abc" },
    { video_id: "v6", title: "F", view_count: "2000" },
  ];
  assert.deepEqual(klickCandidates(rows).map((row) => row.video_id), ["v1", "v6"]);
});

const QUIZ_SOURCES = {
  champions: [
    { season_id: "season_001", champion_name: "PresentLP", source_urls: "https://sheet/c1" },
    { season_id: "season_002", champion_name: "Raizor", source_urls: "https://sheet/c2" },
    { season_id: "season_003", champion_name: "Morbolth", source_urls: "https://sheet/c3" },
    { season_id: "season_004", champion_name: "Bene", source_urls: "https://sheet/c4" },
  ],
  standings: [
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "1", player_name: "PresentLP", source_urls: "https://sheet/s1" },
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "2", player_name: "Raizor", source_urls: "https://sheet/s1" },
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "3", player_name: "Morbolth", source_urls: "https://sheet/s1" },
    { season_id: "season_001", division: "Liga 1", stage: "final_table", is_primary: "true", rank: "4", player_name: "Bene", source_urls: "https://sheet/s1" },
  ],
  killlists: [
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Knakrack", kills: "20", source_urls: "https://sheet/k1" },
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Scherox", kills: "12", source_urls: "https://sheet/k1" },
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Rotom", kills: "8", source_urls: "https://sheet/k1" },
    { season_id: "season_001", trainer: "PresentLP", pokemon: "Despotar", kills: "5", source_urls: "https://sheet/k1" },
  ],
  matchups: [
    { person_id: "person_a", person_name: "PresentLP", opponent_id: "person_b", opponent_name: "Raizor", matches: "11", wins: "6", losses: "5", source_urls: "https://sheet/m1" },
  ],
  drafts: [
    { season_id: "season_001", pokemon: "Arbok", person_name: "Art'n'Gaming", source_urls: "https://sheet/d1" },
    { season_id: "season_001", pokemon: "Knakrack", person_name: "PresentLP", source_urls: "https://sheet/d2" },
    { season_id: "season_001", pokemon: "Despotar", person_name: "Raizor", source_urls: "https://sheet/d3" },
    { season_id: "season_001", pokemon: "Rotom", person_name: "Morbolth", source_urls: "https://sheet/d4" },
  ],
};

test("quizQuestion builds a champions question with one correct option", () => {
  const question = quizQuestion(QUIZ_SOURCES, "champions", seededRandom("quiz-champ"));
  assert.equal(question.category, "champions");
  assert.ok(question.params.season);
  assert.equal(question.options.length, 4);
  assert.equal(question.options.filter((option) => option.correct).length, 1);
  const labels = question.options.map((option) => option.label);
  assert.equal(new Set(labels).size, 4);
  assert.ok(question.sourceUrls);
  // Deterministic for the same seed.
  assert.deepEqual(question, quizQuestion(QUIZ_SOURCES, "champions", seededRandom("quiz-champ")));
});

test("quizQuestion standings names the player at the drawn rank", () => {
  const question = quizQuestion(QUIZ_SOURCES, "standings", seededRandom("quiz-standings"));
  assert.equal(question.category, "standings");
  const correct = question.options.find((option) => option.correct);
  const expected = QUIZ_SOURCES.standings.find((row) => row.rank === String(question.params.rank));
  assert.equal(correct.label, expected.player_name);
});

test("quizQuestion killlists picks the top killer as the correct answer", () => {
  const question = quizQuestion(QUIZ_SOURCES, "killlists", seededRandom("quiz-kills"));
  const correct = question.options.find((option) => option.correct);
  assert.equal(correct.label, "Knakrack");
  assert.equal(question.params.trainer, "PresentLP");
});

test("quizQuestion matchups names the head-to-head leader", () => {
  const question = quizQuestion(QUIZ_SOURCES, "matchups", seededRandom("quiz-matchups"));
  assert.equal(question.options.length, 2);
  const correct = question.options.find((option) => option.correct);
  assert.equal(correct.label, "PresentLP");
});

test("quizPoolSizes counts eligible questions per category", () => {
  assert.deepEqual(quizPoolSizes(QUIZ_SOURCES), { champions: 4, standings: 3, killlists: 1, drafts: 4, matchups: 1 });
  assert.deepEqual(quizPoolSizes({}), { champions: 0, standings: 0, killlists: 0, drafts: 0, matchups: 0 });
});

test("quizQuestion drafts asks who drafted the pokemon", () => {
  const question = quizQuestion(QUIZ_SOURCES, "drafts", seededRandom("quiz-drafts"));
  assert.equal(question.category, "drafts");
  assert.ok(question.params.pokemon);
  assert.equal(question.options.length, 4);
  const correct = question.options.find((option) => option.correct);
  const expected = QUIZ_SOURCES.drafts.find((row) => row.pokemon === question.params.pokemon);
  assert.equal(correct.label, expected.person_name);
  assert.ok(question.sourceUrls);
  // Too few distinct trainers in the season -> no question.
  assert.equal(quizQuestion({ ...QUIZ_SOURCES, drafts: QUIZ_SOURCES.drafts.slice(0, 2) }, "drafts", seededRandom("x")), null);
});

test("weightedQuizCategory favors bigger pools but keeps small ones alive", () => {
  const killlists = [];
  for (let i = 0; i < 64; i += 1) {
    killlists.push(
      { season_id: "season_001", trainer: `T${i}`, pokemon: "A", kills: "9", source_urls: "u" },
      { season_id: "season_001", trainer: `T${i}`, pokemon: "B", kills: "5", source_urls: "u" },
      { season_id: "season_001", trainer: `T${i}`, pokemon: "C", kills: "3", source_urls: "u" },
      { season_id: "season_001", trainer: `T${i}`, pokemon: "D", kills: "1", source_urls: "u" },
    );
  }
  const sources = { champions: QUIZ_SOURCES.champions, standings: [], killlists, matchups: [] };
  const rng = seededRandom("weights");
  const counts = { champions: 0, killlists: 0 };
  for (let i = 0; i < 300; i += 1) {
    counts[weightedQuizCategory(sources, rng)] += 1;
  }
  // Champions has a far smaller pool: it must still appear, just clearly less often.
  assert.ok(counts.killlists > counts.champions, `killlists ${counts.killlists} <= champions ${counts.champions}`);
  assert.ok(counts.champions > 0);
  assert.equal(weightedQuizCategory({ champions: [], standings: [], killlists: [], matchups: [] }, seededRandom("x")), null);
});

test("quizQuestion falls back across categories and returns null when empty", () => {
  const onlyChampions = { champions: QUIZ_SOURCES.champions, standings: [], killlists: [], matchups: [] };
  const question = quizQuestion(onlyChampions, "all", seededRandom("quiz-all"));
  assert.equal(question.category, "champions");
  assert.equal(quizQuestion({ champions: [], standings: [], killlists: [], drafts: [], matchups: [] }, "all", seededRandom("x")), null);
  assert.deepEqual(QUIZ_CATEGORIES, ["champions", "standings", "killlists", "drafts", "matchups"]);
});

const ALL_TIME_ROWS = [
  { person_id: "person_bene", person_name: "Bene", seasons: "8", season_list: "S3, S4", seasons_won: "4", title_seasons: "S4, S8", matches: "128", wins: "95", losses: "32", kills: "589", elo: "1762", best_rank: "1", source_urls: "https://sheet/a1" },
  { person_id: "person_neu", person_name: "Neuling", seasons: "1", season_list: "S10", seasons_won: "0", title_seasons: "", matches: "22", wins: "8", losses: "14", kills: "40", elo: "1460", best_rank: "7", source_urls: "https://sheet/a2" },
  // Too few matches: excluded from the riddle pool.
  { person_id: "person_kurz", person_name: "Kurz", seasons: "1", season_list: "S1", seasons_won: "0", title_seasons: "", matches: "3", wins: "1", losses: "2", kills: "2", elo: "1502", best_rank: "9", source_urls: "" },
];

test("personRiddleCandidates filters short careers and picks deterministically", () => {
  const candidates = personRiddleCandidates(ALL_TIME_ROWS);
  assert.deepEqual(candidates.map((row) => row.person_name), ["Bene", "Neuling"]);
  const round = personRiddleRound(candidates, seededRandom("riddle-1"));
  assert.ok(candidates.includes(round));
  assert.equal(personRiddleRound(candidates, seededRandom("riddle-1")), round);
  assert.equal(personRiddleRound([], seededRandom("x")), null);
});

test("personRiddleHints builds staged hints from career data", () => {
  const stints = [
    { person_name: "Bene", team_name: "Wackel Backel" },
    { person_name: "Bene", team_name: "Team Zwei" },
    { person_name: "Bene", team_name: "Wackel Backel" },
    { person_name: "Andere", team_name: "Fremd" },
  ];
  const hints = personRiddleHints(ALL_TIME_ROWS[0], stints, norm);
  // Team lists identify a person almost uniquely, so they come second to last.
  assert.deepEqual(hints.map((hint) => hint.id), ["activity", "kills", "peak", "titles", "teams", "initial"]);
  assert.deepEqual(hints[0].params, { seasons: 8, matches: 128 });
  assert.deepEqual(hints[1].params, { kills: 589, wins: 95 });
  assert.deepEqual(hints[2].params, { elo: 1762, rank: "1" });
  assert.deepEqual(hints[3].params, { count: 4, seasons: "S4, S8" });
  assert.equal(hints[4].params.teams, "Wackel Backel, Team Zwei");
  assert.deepEqual(hints[5].params, { letter: "B" });
  // No teams on record -> the teams hint is skipped; no titles -> noTitles.
  const bare = personRiddleHints(ALL_TIME_ROWS[1], [], norm);
  assert.deepEqual(bare.map((hint) => hint.id), ["activity", "kills", "peak", "noTitles", "initial"]);
});

test("statsDuel builds deterministic pairs with differing values", () => {
  const rows = [
    { person_name: "A", kills: "100", wins: "50", matches: "80", seasons: "5" },
    { person_name: "B", kills: "60", wins: "30", matches: "70", seasons: "4" },
    { person_name: "C", kills: "10", wins: "5", matches: "12", seasons: "1" },
    // Missing numbers are excluded.
    { person_name: "D", kills: "", wins: "1", matches: "2", seasons: "1" },
    { person_name: "", kills: "9", wins: "1", matches: "2", seasons: "1" },
  ];
  const candidates = statsDuelCandidates(rows);
  assert.deepEqual(candidates.map((row) => row.person_name), ["A", "B", "C"]);
  const round = statsDuelRound(candidates, seededRandom("stats-1"));
  assert.ok(STATS_DUEL_STATS.includes(round.stat));
  assert.notEqual(round.a.person_name, round.b.person_name);
  assert.notEqual(Number(round.a[round.stat]), Number(round.b[round.stat]));
  assert.deepEqual(round, statsDuelRound(candidates, seededRandom("stats-1")));
  assert.equal(statsDuelRound([candidates[0]], seededRandom("x")), null);
  // All values equal on every stat -> no fair question exists.
  const twins = [
    { person_name: "X", kills: "5", wins: "5", matches: "5", seasons: "5" },
    { person_name: "Y", kills: "5", wins: "5", matches: "5", seasons: "5" },
  ];
  assert.equal(statsDuelRound(twins, seededRandom("x")), null);
});

test("nextKlickIndex avoids the current video and equal view counts", () => {
  const candidates = [
    { video_id: "v1", view_count: "1000" },
    { video_id: "v2", view_count: "1000" },
    { video_id: "v3", view_count: "2000" },
  ];
  const rng = seededRandom("klick");
  for (let i = 0; i < 20; i += 1) {
    const next = nextKlickIndex(candidates, 0, rng);
    assert.equal(next, 2, "only v3 has a different view count than v1");
  }
  // No valid opponent -> -1.
  assert.equal(nextKlickIndex([{ view_count: "5" }, { view_count: "5" }], 0, seededRandom("x")), -1);
  assert.equal(nextKlickIndex([], 0, seededRandom("x")), -1);
});
