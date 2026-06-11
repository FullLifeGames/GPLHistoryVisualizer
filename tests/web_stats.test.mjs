import assert from "node:assert/strict";
import {
  aggregatePersonStats,
  canonicalKilllistRows,
  displayNumber,
  matchupOverview,
  missingDataRows,
  personDetailKilllistRows,
  primaryCompetitionRows,
  seasonCoverageRows,
  summarizeTrainerPokemon,
  summarizeKilllists,
  weightedRating,
  weightedRatingValue,
  winPercentage,
  winPercentageValue,
} from "../web/stats.js";

assert.equal(winPercentageValue(3, 1, 0), 75);
assert.equal(winPercentage(3, 1, 0), "75.0%");

assert.equal(winPercentageValue(1, 1, 2), 25);
assert.equal(winPercentage(1, 1, 2), "25.0%");

assert.equal(winPercentageValue(0, 0, 0), null);
assert.equal(winPercentage(0, 0, 0), "");

assert.equal(weightedRatingValue(0, 0, 0), null);
assert.equal(weightedRating(0, 0, 0), "");

assert.equal(weightedRatingValue(4, 4, 0), 50);
assert.equal(weightedRating(4, 4, 0), "50.0");

assert.ok(weightedRatingValue(10, 0, 0) > weightedRatingValue(1, 0, 0));
assert.equal(weightedRating(10, 0, 0), "72.7");

assert.equal(displayNumber(0), 0);
assert.equal(displayNumber("0"), 0);
assert.equal(displayNumber(""), "");

assert.deepEqual(
  summarizeKilllists([
    { season_id: "season_001", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "A", team_name: "Alpha", kills: "2", deaths: "1", differential: "1", data_status: "sheet_extracted" },
    { season_id: "season_002", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "B", team_name: "Beta", kills: "3", deaths: "0", differential: "3", data_status: "sheet_extracted" },
    { season_id: "season_001", pokemon: "Evoli", pokemon_normalized: "evoli", trainer: "A", team_name: "Alpha", kills: "1", deaths: "4", differential: "-3", data_status: "sheet_extracted" },
  ]),
  [
    { rank: 1, pokemon: "Pikachu", kills: 5, deaths: 1, differential: 4, seasons: 2, trainers: 2, teams: 2 },
    { rank: 2, pokemon: "Evoli", kills: 1, deaths: 4, differential: -3, seasons: 1, trainers: 1, teams: 1 },
  ],
);

assert.deepEqual(
  canonicalKilllistRows(
    [
      { season_id: "season_009", division: "Overall", pokemon: "Pikachu" },
      { season_id: "season_009", division: "Singles", pokemon: "Pikachu" },
      { season_id: "season_009", division: "Doubles", pokemon: "Pikachu" },
      { season_id: "season_010", division: "Regular Season", pokemon: "Ramoth" },
      { season_id: "season_010", division: "Playoffs", pokemon: "Ramoth" },
      { season_id: "season_008", division: "Liga 1", pokemon: "Evoli" },
      { season_id: "season_008", division: "Liga 2", pokemon: "Relaxo" },
    ],
    "all",
  ).map((row) => `${row.season_id}:${row.division}:${row.pokemon}`),
  [
    "season_009:Overall:Pikachu",
    "season_010:Playoffs:Ramoth",
    "season_008:Liga 1:Evoli",
    "season_008:Liga 2:Relaxo",
  ],
);

assert.deepEqual(
  canonicalKilllistRows(
    [
      { season_id: "season_009", division: "Overall", pokemon: "Pikachu" },
      { season_id: "season_009", division: "Singles", pokemon: "Pikachu" },
    ],
    "Singles",
  ).map((row) => row.division),
  ["Singles"],
);

assert.deepEqual(
  summarizeTrainerPokemon(
    canonicalKilllistRows(
      [
        { season_id: "season_009", division: "Overall", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "Bene", trainer_normalized: "bene", team_name: "Team Gelb", kills: "5", deaths: "2", differential: "3", source_urls: "https://example.test/s9-overall", data_status: "sheet_extracted" },
        { season_id: "season_009", division: "Singles", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "Bene", trainer_normalized: "bene", team_name: "Team Gelb", kills: "99", deaths: "0", differential: "99", source_urls: "https://example.test/s9-singles", data_status: "sheet_extracted" },
        { season_id: "season_010", division: "Playoffs", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "Bene", trainer_normalized: "bene", team_name: "Team Blau", kills: "4", deaths: "1", differential: "3", source_urls: "https://example.test/s10-playoffs", data_status: "sheet_extracted" },
        { season_id: "season_010", division: "Playoffs", pokemon: "Ramoth", pokemon_normalized: "ramoth", trainer: "Minetube", trainer_normalized: "minetube", team_name: "Team Rot", kills: "3", deaths: "1", differential: "2", source_urls: "https://example.test/s10-other", data_status: "sheet_extracted" },
      ],
      "all",
    ),
    "person_bene",
  ).map((row) => ({
    trainer: row.trainer,
    pokemon: row.pokemon,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    seasons: row.seasons,
    divisions: row.divisions,
    teams: row.teams,
    source_urls: row.source_urls,
  })),
  [
    {
      trainer: "Bene",
      pokemon: "Pikachu",
      kills: 9,
      deaths: 3,
      differential: 6,
      seasons: 2,
      divisions: 2,
      teams: 2,
      source_urls: "https://example.test/s9-overall;https://example.test/s10-playoffs",
    },
  ],
);

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rows = personDetailKilllistRows(
    [
      { season_id: "season_008", division: "Liga 1", pokemon: "UHaFniR", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Victini Bottom", kills: "8", deaths: "", differential: "", source_urls: "https://example.test/s8", data_status: "sheet_extracted" },
      { season_id: "season_009", division: "Overall", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "", trainer_normalized: "", team_name: "Victory Instinct", kills: "6", deaths: "", differential: "", source_urls: "https://example.test/s9-overall", data_status: "sheet_extracted" },
      { season_id: "season_009", division: "Doubles", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "", trainer_normalized: "", team_name: "Victory Instinct", kills: "3", deaths: "", differential: "", source_urls: "https://example.test/s9-doubles", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Wackel Backel", kills: "9", deaths: "8", differential: "1", source_urls: "https://example.test/s10", data_status: "sheet_extracted" },
    ],
    "all",
  );

  assert.deepEqual(
    rows.map((row) => `${row.season_id}:${row.division}:${row.kills}`),
    ["season_008:Liga 1:8", "season_009:Doubles:3", "season_010:Playoffs:9"],
  );

  assert.deepEqual(
    summarizeTrainerPokemon(rows, "person_bene", normalizeTestKey, [
      { season_id: "season_009", division: "Doubles", team_name: "Victory Instinct", person_id: "person_bene", person_name: "Bene", data_status: "sheet_extracted" },
    ]).map((row) => ({
      trainer: row.trainer,
      pokemon: row.pokemon,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      seasons: row.seasons,
      divisions: row.divisions,
      teams: row.teams,
    })),
    [
      {
        trainer: "Bene",
        pokemon: "UHaFniR",
        kills: 20,
        deaths: 8,
        differential: 1,
        seasons: 3,
        divisions: 3,
        teams: 3,
      },
    ],
  );
}

assert.deepEqual(
  primaryCompetitionRows(
    [
      { season_id: "season_006", division: "Sun Conference", person_name: "A" },
      { season_id: "season_006", division: "Moon Conference", person_name: "B" },
      { season_id: "season_008", division: "Liga 1", person_name: "C" },
      { season_id: "season_008", division: "Liga 2", person_name: "D" },
      { season_id: "season_010", division: "Regular Season", person_name: "E" },
      { season_id: "season_010", division: "Playoffs", person_name: "E" },
    ],
    "all",
  ).map((row) => `${row.season_id}:${row.division}:${row.person_name}`),
  [
    "season_006:Sun Conference:A",
    "season_006:Moon Conference:B",
    "season_008:Liga 1:C",
    "season_010:Regular Season:E",
    "season_010:Playoffs:E",
  ],
);

assert.deepEqual(
  primaryCompetitionRows(
    [
      { season_id: "season_008", division: "Liga 1", person_name: "C" },
      { season_id: "season_008", division: "Liga 2", person_name: "D" },
    ],
    "Liga 2",
  ).map((row) => row.person_name),
  ["D"],
);

assert.deepEqual(
  matchupOverview(
    [
      { player_a: "Bene", player_b: "PresentLP", winner: "Bene" },
      { player_a: "PresentLP", player_b: "Bene", winner: "PresentLP" },
      { player_a: "Bene", player_b: "Nestfloh", winner: "Bene" },
    ],
    "bene",
    (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, ""),
  ),
  [
    { opponent: "Nestfloh", matches: 1, wins: 1, losses: 0, draws: 0, win_pct: "100.0%" },
    { opponent: "PresentLP", matches: 2, wins: 1, losses: 1, draws: 0, win_pct: "50.0%" },
  ],
);

assert.deepEqual(
  aggregatePersonStats(
    [
      { season_id: "season_003", person_id: "person_lucariolp", person_name: "LucarioLP", team_name: "Unlimited Blade Works", wins: "3", losses: "7", draws: "0", points: "9", kills: "20", deaths: "35", differential: "-15", rank: "5" },
      { season_id: "season_003", person_id: "person_bene", person_name: "Bene", team_name: "Unlimited Blade Works", wins: "10", losses: "6", draws: "0", points: "30", kills: "106", deaths: "86", differential: "20", rank: "5" },
    ],
    [{ season_id: "season_003", champion_person_id: "person_bene", champion_name: "Bene", champion_team: "Unlimited Blade Works" }],
  ).map((row) => ({ name: row.name, matches: row.matches, wins: row.wins, losses: row.losses, seasons_won: row.seasons_won })),
  [
    { name: "Bene", matches: 16, wins: 10, losses: 6, seasons_won: 1 },
    { name: "LucarioLP", matches: 10, wins: 3, losses: 7, seasons_won: 0 },
  ],
);

assert.deepEqual(
  seasonCoverageRows({
    seasons: [
      { season_id: "season_001" },
      { season_id: "season_003" },
    ],
    standings: [
      { season_id: "season_001", data_status: "sheet_extracted" },
      { season_id: "season_003", data_status: "sheet_extracted" },
    ],
    matches: [{ season_id: "season_001", data_status: "sheet_extracted" }],
    champions: [{ season_id: "season_001", data_status: "source_evidenced", champion_name: "A" }],
    killlists: [
      { season_id: "season_001", data_status: "sheet_extracted" },
      { season_id: "season_003", data_status: "not_available", source_urls: "https://example.test/deleted-sheet" },
    ],
    videos: [
      { detected_season_id: "season_001", match_status: "matched" },
      { detected_season_id: "season_001", match_status: "unmatched" },
    ],
  }).map((row) => ({
    season_id: row.season_id,
    standings: row.standings,
    matches: row.matches,
    killlists: row.killlists,
    unavailable_killlists: row.unavailable_killlists,
    champions: row.champions,
    videos: row.videos,
    matched_videos: row.matched_videos,
    coverage_status: row.coverage_status,
    missing_data: row.missing_data,
    missing_source_urls: row.missing_source_urls,
  })),
  [
    {
      season_id: "season_001",
      standings: 1,
      matches: 1,
      killlists: 1,
      unavailable_killlists: 0,
      champions: 1,
      videos: 2,
      matched_videos: 1,
      coverage_status: "complete",
      missing_data: "",
      missing_source_urls: "",
    },
    {
      season_id: "season_003",
      standings: 1,
      matches: 0,
      killlists: 0,
      unavailable_killlists: 1,
      champions: 0,
      videos: 0,
      matched_videos: 0,
      coverage_status: "partial",
      missing_data: "matches, champions, killlists",
      missing_source_urls: "https://example.test/deleted-sheet",
    },
  ],
);

assert.deepEqual(
  missingDataRows({
    seasons: [{ season_id: "season_003" }],
    standings: [{ season_id: "season_003", data_status: "sheet_extracted" }],
    matches: [],
    champions: [],
    killlists: [{ season_id: "season_003", data_status: "not_available", source_urls: "https://example.test/deleted-sheet" }],
  }).map((row) => ({ season_id: row.season_id, missing_data: row.missing_data, source_urls: row.source_urls })),
  [{ season_id: "season_003", missing_data: "matches, champions, killlists", source_urls: "https://example.test/deleted-sheet" }],
);
