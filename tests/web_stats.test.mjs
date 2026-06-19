import assert from "node:assert/strict";
import {
  aggregatePersonStats,
  canonicalKilllistRows,
  detailRowsWithDraftInstances,
  displayNumber,
  eloRatings,
  filterSourceClaims,
  formatSeasonList,
  isAnalysisSourceVideo,
  mergeSeasonLists,
  matchupOverview,
  missingDataRows,
  personStorySummary,
  personPokemonHighlights,
  personOptionsFromAllTimeRows,
  pokemonDraftOverviewRows,
  pokemonTitleIndex,
  pokemonStorySummary,
  pokemonTimelineRows,
  personDetailKilllistRows,
  primaryCompetitionRows,
  qualityRowsFromData,
  reviewWorkflowRows,
  rosterKilllistRows,
  seasonCoverageRows,
  seasonCountFromList,
  sourceClaimsForSeason,
  summarizePokemonDetail,
  summarizeTrainerPokemon,
  summarizeKilllists,
  teamRosterDisplayGroups,
  teamRosterOverviewRows,
  teamRosterPokemonRows,
  titleInfoWithinSeasonList,
  textMatchesSearch,
  weightedRating,
  weightedRatingValue,
  killDifferential,
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

assert.equal(textMatchesSearch("Bene Saison 4 Ritter der Tapukokosnuss", "bene s4"), true);
assert.equal(textMatchesSearch("Bene season_004 Ritter der Tapukokosnuss", "bene s4"), true);
assert.equal(textMatchesSearch("Bene S4 Ritter der Tapukokosnuss", "bene s4"), true);
assert.equal(textMatchesSearch("RegiBang S4 Flexing Masskito", "bene s4, regibang s4"), true);
assert.equal(textMatchesSearch("RegiBang S5 Flexing Masskito", "bene s4, regibang s4"), false);

assert.equal(isAnalysisSourceVideo({ video_title: "Analyse: @RegiBang vs @Bene | Flinch-Spektakel | GPL [S4]" }), true);
assert.equal(isAnalysisSourceVideo({ video_title: "GPL [S4] - Spieltag 08 - vs. Flexing Masskito: Kampf um Platz 1!" }), false);

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_008",
          division: "Liga 1",
          roster_phase: "hinrunde",
          team_name: "Victini Bottom",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          slot: "1",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_008",
          division: "Liga 1",
          roster_phase: "rueckrunde",
          team_name: "Victini Bottom",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          slot: "1",
          data_status: "sheet_extracted",
        },
      ],
      killlists: [
        {
          season_id: "season_008",
          division: "Liga 1",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          appearances: "9",
          kills: "8",
          deaths: "3",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_008",
          division: "Overall",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "Pikachu",
          pokemon_normalized: "pikachu",
          appearances: "1",
          kills: "6",
          deaths: "0",
          data_status: "sheet_extracted",
        },
      ],
      pokemonDraftOverview: [{ pokemon: "UHaFnir", pokemon_normalized: "uhafnir", tier: "B", tier_rank: "7", draft_count: "2", title_count: "1" }],
    },
    normalizeTestKey,
  );

  assert.deepEqual(
    rosterPokemon.map((row) => ({ phase: row.roster_phase, appearances: row.appearances, kills: row.kills, deaths: row.deaths })),
    [
      { phase: "hinrunde", appearances: 9, kills: 8, deaths: 3 },
      { phase: "rueckrunde", appearances: 9, kills: 8, deaths: 3 },
    ],
  );
  assert.equal(rosterPokemon.some((row) => row.pokemon === "Pikachu"), false);
  assert.deepEqual(
    teamRosterOverviewRows(rosterPokemon).map((row) => row.roster_phase).sort(),
    ["hinrunde", "rueckrunde"],
  );
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Alpha",
          person_name: "Bene",
          pokemon: "Quajutsu",
          pokemon_normalized: "quajutsu",
          slot: "1",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_010",
          division: "Regular Season",
          team_name: "Prekani",
          person_name: "PresentLP",
          pokemon: "Demeteros-I",
          pokemon_normalized: "demeteros i",
          slot: "1",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Beta",
          person_name: "B",
          pokemon: "Samplemon",
          pokemon_normalized: "samplemon",
          slot: "1",
          data_status: "sheet_extracted",
        },
      ],
      pokemonDraftOverview: [
        {
          pokemon: "Quajutsu",
          pokemon_normalized: "quajutsu",
          asset_id: "greninja",
          tier: "UUBL",
          tier_rank: "4",
          gen6_tier: "Uber",
          gen6_tier_rank: "2",
          gen9_tier: "UU",
          gen9_tier_rank: "5",
          draft_count: "2",
          title_count: "0",
        },
        {
          pokemon: "Demeteros-I",
          pokemon_normalized: "demeteros i",
          asset_id: "landorus",
          tier: "Uber",
          tier_rank: "2",
          gen9_tier: "Uber",
          gen9_tier_rank: "2",
          draft_count: "2",
          title_count: "0",
        },
        {
          pokemon: "Samplemon",
          pokemon_normalized: "samplemon",
          asset_id: "samplemon",
          tier: "RU",
          tier_rank: "7",
          gen6_tier: "OU",
          gen6_tier_rank: "3",
          draft_count: "1",
          title_count: "0",
        },
      ],
    },
    normalizeTestKey,
  );

  const byPokemon = Object.fromEntries(rosterPokemon.map((row) => [row.pokemon, row]));
  assert.equal(byPokemon["Samplemon"].tier, "OU");
  assert.equal(byPokemon["Samplemon"].tier_rank, 3);
  assert.equal(byPokemon["Quajutsu"].tier, "UU");
  assert.equal(byPokemon["Quajutsu"].tier_rank, 5);
  assert.match(byPokemon["Quajutsu"].notes, /Quajutsu ab S2/);
  assert.equal(byPokemon["Demeteros-I"].tier, "OU");
  assert.equal(byPokemon["Demeteros-I"].tier_rank, 3);
  assert.match(byPokemon["Demeteros-I"].notes, /Demeteros-I ohne Rohe Gewalt/);
}

{
  const rows = rosterKilllistRows([
    { season_id: "season_009", division: "Overall", pokemon: "UHaFnir", kills: "6" },
    { season_id: "season_009", division: "Doubles", pokemon: "UHaFnir", trainer: "Bene", kills: "3" },
    { season_id: "season_010", division: "Regular Season", pokemon: "UHaFnir", trainer: "Bene", kills: "4" },
    { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", trainer: "Bene", kills: "9" },
  ]);

  assert.deepEqual(
    rows.map((row) => `${row.season_id}:${row.division}:${row.kills}`),
    ["season_009:Doubles:3", "season_010:Regular Season:4", "season_010:Playoffs:9"],
  );
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const killlists = rosterKilllistRows([
    {
      season_id: "season_009",
      division: "Overall",
      team_name: "Victory Instinct",
      trainer: "",
      pokemon: "UHaFnir",
      pokemon_normalized: "uhafnir",
      appearances: "14",
      kills: "6",
      data_status: "sheet_extracted",
    },
    {
      season_id: "season_009",
      division: "Doubles",
      team_name: "Victory Instinct",
      trainer: "Bene",
      pokemon: "UHaFnir",
      pokemon_normalized: "uhafnir",
      appearances: "8",
      kills: "3",
      data_status: "sheet_extracted",
    },
  ]);
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_009",
          division: "Doubles",
          roster_phase: "hinrunde",
          team_name: "Victory Instinct",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_009",
          division: "Doubles",
          roster_phase: "rueckrunde",
          team_name: "Victory Instinct",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          data_status: "sheet_extracted",
        },
      ],
      killlists,
    },
    normalizeTestKey,
  );

  assert.deepEqual(
    rosterPokemon.map((row) => ({ phase: row.roster_phase, appearances: row.appearances, kills: row.kills })),
    [
      { phase: "hinrunde", appearances: 8, kills: 3 },
      { phase: "rueckrunde", appearances: 8, kills: 3 },
    ],
  );
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_010",
          division: "Regular Season",
          roster_phase: "regular",
          team_name: "Wackel Backel",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_010",
          division: "Playoffs",
          roster_phase: "playoffs",
          team_name: "Wackel Backel",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          data_status: "sheet_extracted",
        },
      ],
      killlists: rosterKilllistRows([
        {
          season_id: "season_010",
          division: "Regular Season",
          team_name: "Wackel Backel",
          trainer: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          appearances: "7",
          kills: "4",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_010",
          division: "Playoffs",
          team_name: "",
          trainer: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          appearances: "9",
          kills: "9",
          deaths: "8",
          data_status: "sheet_extracted",
        },
      ]),
    },
    normalizeTestKey,
  );

  const regular = rosterPokemon.find((row) => row.division === "Regular Season");
  const playoffs = rosterPokemon.find((row) => row.division === "Playoffs");
  assert.equal(regular.appearances, 7);
  assert.equal(regular.kills, 4);
  assert.equal(playoffs.appearances, 9);
  assert.equal(playoffs.kills, 9);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_008",
          division: "Liga 1",
          roster_phase: "hinrunde",
          team_name: "Victini Bottom",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_008",
          division: "Liga 1",
          roster_phase: "rueckrunde",
          team_name: "Victini Bottom",
          person_name: "Bene",
          pokemon: "Zeraora",
          pokemon_normalized: "zeraora",
          data_status: "sheet_extracted",
        },
      ],
      killlists: [
        {
          season_id: "season_008",
          division: "Liga 1",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "Zeraora",
          pokemon_normalized: "zeraora",
          appearances: "7",
          kills: "13",
          deaths: "2",
          data_status: "sheet_extracted",
        },
      ],
    },
    normalizeTestKey,
  );

  assert.deepEqual(
    rosterPokemon.map((row) => ({ pokemon: row.pokemon, phase: row.roster_phase, appearances: row.appearances, kills: row.kills })),
    [
      { pokemon: "UHaFnir", phase: "hinrunde", appearances: 0, kills: 0 },
      { pokemon: "Zeraora", phase: "rueckrunde", appearances: 7, kills: 13 },
    ],
  );
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_004",
          division: "Regular Season",
          roster_phase: "hinrunde",
          team_name: "Ritter der Tapukokosnuss",
          person_name: "Bene",
          pokemon: "Jirachi",
          pokemon_normalized: "jirachi",
          source_table: "Manual team graphics",
          notes: "Manuelle Teamgrafik-Zuordnung als Hinrunden-Snapshot",
          data_status: "manual_override",
        },
      ],
      killlists: [
        {
          season_id: "season_004",
          division: "Regular Season",
          team_name: "Ritter der Tapukokosnuss",
          trainer: "Bene",
          pokemon: "Karippas",
          pokemon_normalized: "karippas",
          appearances: "4",
          kills: "3",
          deaths: "",
          data_status: "manual_override",
        },
        {
          season_id: "season_004",
          division: "Regular Season",
          team_name: "Ritter der Tapukokosnuss",
          trainer: "Bene",
          pokemon: "Hariyama",
          pokemon_normalized: "hariyama",
          appearances: "6",
          kills: "7",
          deaths: "",
          data_status: "manual_override",
        },
      ],
    },
    normalizeTestKey,
  );

  assert.deepEqual(
    rosterPokemon.map((row) => row.pokemon).sort(),
    ["Hariyama", "Jirachi", "Karippas"],
  );
  assert.deepEqual(
    rosterPokemon.filter((row) => row.pokemon !== "Jirachi").map((row) => row.roster_phase),
    ["hinrunde", "hinrunde"],
  );
  assert.match(rosterPokemon.find((row) => row.pokemon === "Karippas").notes, /Killlisten-Ergaenzung/);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_010",
          division: "Regular Season",
          roster_phase: "regular",
          team_name: "Wackel Backel",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          source_table: "Kader",
          data_status: "sheet_extracted",
        },
      ],
      killlists: [
        {
          season_id: "season_010",
          division: "Regular Season",
          team_name: "Wackel Backel",
          trainer: "Bene",
          pokemon: "Granforgita",
          pokemon_normalized: "granforgita",
          appearances: "7",
          kills: "7",
          deaths: "6",
          data_status: "sheet_extracted",
        },
      ],
    },
    normalizeTestKey,
  );

  assert.deepEqual(rosterPokemon.map((row) => row.pokemon), ["UHaFnir"]);
}

{
  const normalizeTestKey = (value) => {
    const key = String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return key === "presentlp" ? "present" : key;
  };
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Prekani",
          person_name: "PresentLP",
          pokemon: "Boreos-T",
          pokemon_normalized: "boreost",
          slot: "1",
          data_status: "manual_override",
        },
      ],
      pokemonDraftOverview: [{ pokemon: "Boreos-T", pokemon_normalized: "boreost", tier: "OU", tier_rank: "3", draft_count: "1", title_count: "1" }],
    },
    normalizeTestKey,
  );
  const overview = teamRosterOverviewRows(rosterPokemon);
  const grouped = teamRosterDisplayGroups(overview, rosterPokemon);

  assert.equal(grouped.groups.length, 1);
  assert.equal(grouped.groups[0].pokemonRows.length, 1);
  assert.equal(grouped.groups[0].pokemonRows[0].pokemon, "Boreos-T");
}

assert.equal(weightedRatingValue(4, 4, 0), 50);
assert.equal(weightedRating(4, 4, 0), "50.0");

assert.ok(weightedRatingValue(10, 0, 0) > weightedRatingValue(1, 0, 0));
assert.equal(weightedRating(10, 0, 0), "72.7");

assert.equal(displayNumber(0), 0);
assert.equal(displayNumber("0"), 0);
assert.equal(displayNumber(""), "");
assert.equal(killDifferential("20", "8"), 12);
assert.equal(killDifferential("20", ""), 20);
assert.equal(formatSeasonList(["season_010", "season_001", "season_002"]), "S1, S2, S10");

assert.deepEqual(
  eloRatings(
    [
      { season_id: "season_001", week: "1. Spieltag", player_a: "Bene", player_b: "PresentLP", winner: "Bene", data_status: "sheet_extracted" },
      { season_id: "season_001", week: "2. Spieltag", player_a: "Bene", player_b: "Nestfloh", winner: "Nestfloh", data_status: "sheet_extracted" },
      { season_id: "season_002", week: "1. Spieltag", player_a: "Bene", player_b: "PresentLP", winner: "", data_status: "sheet_extracted" },
      { season_id: "season_002", week: "2. Spieltag", player_a: "Bene", player_b: "", winner: "Bene", data_status: "sheet_extracted" },
    ],
    (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  ).map((row) => ({
    name: row.name,
    matches: row.matches,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    win_pct: row.win_pct,
    elo: row.elo,
  })),
  [
    { name: "Nestfloh", matches: 1, wins: 1, losses: 0, draws: 0, win_pct: "100.0%", elo: "1517" },
    { name: "Bene", matches: 3, wins: 1, losses: 1, draws: 1, win_pct: "33.3%", elo: "1499" },
    { name: "PresentLP", matches: 2, wins: 0, losses: 1, draws: 1, win_pct: "0.0%", elo: "1485" },
  ],
);

assert.deepEqual(
  summarizeKilllists([
    { season_id: "season_001", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "A", team_name: "Alpha", appearances: "1", kills: "2", deaths: "1", differential: "1", data_status: "sheet_extracted" },
    { season_id: "season_002", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "B", team_name: "Beta", appearances: "2", kills: "3", deaths: "0", differential: "3", data_status: "sheet_extracted" },
    { season_id: "season_001", pokemon: "Evoli", pokemon_normalized: "evoli", trainer: "A", team_name: "Alpha", appearances: "", kills: "1", deaths: "4", differential: "-3", data_status: "sheet_extracted" },
  ]),
  [
    { rank: 1, pokemon: "Pikachu", appearances: 3, kills: 5, deaths: 1, differential: 4, seasons: 2, season_list: "S1, S2", trainers: 2, teams: 2 },
    { rank: 2, pokemon: "Evoli", appearances: 0, kills: 1, deaths: 4, differential: -3, seasons: 1, season_list: "S1", trainers: 1, teams: 1 },
  ],
);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      { rank: "1", pokemon: "Pikachu", asset_id: "pikachu", tier: "ZU", tier_rank: "13", draft_count: "2", picked_status: "picked", season_list: "S1, S2" },
      { rank: "2", pokemon: "Mega-Glurak X", asset_id: "charizardmegax", tier: "Uber", tier_rank: "2", draft_count: "0", picked_status: "never_picked", season_list: "" },
      { rank: "3", pokemon: "Miraidon", asset_id: "miraidon", tier: "AG", tier_rank: "1", draft_count: "0", picked_status: "never_picked", season_list: "" },
      { rank: "4", pokemon: "Bisasam", asset_id: "bulbasaur", tier: "LC", tier_rank: "15", draft_count: "0", picked_status: "never_picked", season_list: "" },
    ],
    { pickedStatus: "never_picked" },
  ).map((row) => `${row.pokemon}:${row.draft_count}:${row.picked_status}`),
  ["Miraidon:0:never_picked", "Mega-Glurak X:0:never_picked", "Bisasam:0:never_picked"],
);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      { pokemon: "Pikachu", tier: "ZU", tier_rank: "13", draft_count: "2", picked_status: "picked" },
      { pokemon: "Mega-Glurak X", tier: "Uber", tier_rank: "2", draft_count: "0", picked_status: "never_picked" },
      { pokemon: "Miraidon", tier: "AG", tier_rank: "1", draft_count: "0", picked_status: "never_picked" },
      { pokemon: "Bisasam", tier: "LC", tier_rank: "15", draft_count: "0", picked_status: "never_picked" },
    ],
    { pickedStatus: "never_picked", excludedTiers: ["AG", "Uber"] },
  ).map((row) => `${row.pokemon}:${row.tier}`),
  ["Bisasam:LC"],
);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      { pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", english: "Clefable", tier: "UU", tier_rank: "5", draft_count: "19", picked_status: "picked", source_urls: "overview" },
      { pokemon: "Evoli", pokemon_normalized: "evoli", asset_id: "eevee", english: "Eevee", tier: "PU", tier_rank: "11", draft_count: "0", picked_status: "never_picked", source_urls: "pokedex" },
    ],
    {
      draftInstances: [
        { season_id: "season_001", division: "Regular Season", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "Morbolth", person_name_normalized: "morbolth", team_name: "Mortox", team_name_normalized: "mortox", source_urls: "s1" },
        { season_id: "season_002", division: "Regular Season", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "SteveParker", person_name_normalized: "steveparker", team_name: "ToxicBlast", team_name_normalized: "toxicblast", source_urls: "s2" },
        { season_id: "season_006", division: "Moon Conference", roster_phase: "regular", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "ElektechN9ne", person_name_normalized: "elektechn9ne", team_name: "Elekids Club", team_name_normalized: "elekidsclub", source_urls: "s6-regular" },
        { season_id: "season_006", division: "Playoffs", roster_phase: "playoffs", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "ElektechN9ne", person_name_normalized: "elektechn9ne", team_name: "Elekids Club", team_name_normalized: "elekidsclub", source_urls: "s6-playoffs" },
      ],
    },
  ).map((row) => ({
    pokemon: row.pokemon,
    draft_count: row.draft_count,
    season_count: row.season_count,
    season_list: row.season_list,
    trainer_count: row.trainer_count,
    team_count: row.team_count,
    picked_status: row.picked_status,
  })),
  [
    { pokemon: "Pixi", draft_count: 3, season_count: 3, season_list: "S1, S2, S6", trainer_count: 3, team_count: 3, picked_status: "picked" },
    { pokemon: "Evoli", draft_count: 0, season_count: 0, season_list: "", trainer_count: 0, team_count: 0, picked_status: "never_picked" },
  ],
);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      { pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", english: "Clefable", tier: "UU", tier_rank: "5", draft_count: "13", picked_status: "picked" },
    ],
    {
      draftInstances: [
        { season_id: "season_008", division: "Liga 2", roster_phase: "hinrunde", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "Pokgalaxy", person_name_normalized: "pokgalaxy", team_name: "Issotop", team_name_normalized: "issotop" },
        { season_id: "season_008", division: "Liga 2", roster_phase: "rueckrunde", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "Pokgalaxy", person_name_normalized: "pokgalaxy", team_name: "Issotop", team_name_normalized: "issotop" },
        { season_id: "season_002", division: "Liga 2", pokemon: "Pixi", pokemon_normalized: "pixi", asset_id: "clefable", person_name: "CaptainCrinch", person_name_normalized: "captaincrinch" },
      ],
    },
  ).map((row) => `${row.pokemon}:${row.draft_count}:${row.season_list}:${row.trainer_count}`),
  ["Pixi:2:S2, S8:2"],
);

assert.deepEqual(
  titleInfoWithinSeasonList({ titles: 1, title_seasons: "S1" }, "S2, S3, S10"),
  { titles: 0, title_count: 0, title_seasons: "" },
);

assert.deepEqual(
  titleInfoWithinSeasonList({ titles: 2, title_seasons: "Season 1, S10" }, "S1, S2, S10"),
  { titles: 2, title_count: 2, title_seasons: "S1, S10" },
);

assert.equal(mergeSeasonLists("S2, S10", "Season 1, S2"), "S1, S2, S10");
assert.equal(seasonCountFromList("S1, S2, S10"), 3);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      {
        pokemon: "Stalobor",
        pokemon_normalized: "stalobor",
        asset_id: "excadrill",
        english: "Excadrill",
        tier: "UU",
        tier_rank: "5",
        draft_count: "10",
        picked_status: "picked",
        title_count: "1",
        title_seasons: "S1",
      },
    ],
    {
      draftInstances: [
        {
          season_id: "season_008",
          division: "Liga 2",
          pokemon: "Stalobor",
          pokemon_normalized: "stalobor",
          asset_id: "excadrill",
          person_name: "KingBlex",
          person_name_normalized: "kingblex",
          team_name: "End Level Hydreigon",
          team_name_normalized: "endlevelhydreigon",
        },
      ],
    },
  ).map((row) => ({
    pokemon: row.pokemon,
    draft_count: row.draft_count,
    season_list: row.season_list,
    title_count: row.title_count,
    title_seasons: row.title_seasons,
  })),
  [{ pokemon: "Stalobor", draft_count: 1, season_list: "S8", title_count: 0, title_seasons: "" }],
);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      { pokemon: "Arceus", english: "Arceus", asset_id: "arceus", tier: "Uber", tier_rank: "2", draft_count: "0", picked_status: "never_picked" },
      { pokemon: "Giratina", english: "Giratina", asset_id: "giratina", tier: "Uber", tier_rank: "2", draft_count: "0", picked_status: "never_picked" },
      { pokemon: "Lusardin", english: "Wishiwashi", asset_id: "wishiwashi", tier: "RU", tier_rank: "7", draft_count: "0", picked_status: "never_picked" },
    ],
    { search: "wishiwashi" },
  ).map((row) => row.pokemon),
  ["Lusardin"],
);

assert.deepEqual(
  pokemonDraftOverviewRows(
    [
      { pokemon: "Pikachu", tier: "ZU", tier_rank: "13", draft_count: "2", title_count: "1", picked_status: "picked", title_seasons: "S9" },
      { pokemon: "Bisasam", tier: "LC", tier_rank: "15", draft_count: "0", title_count: "", picked_status: "never_picked", title_seasons: "" },
    ],
  ).map((row) => ({ pokemon: row.pokemon, title_count: row.title_count, title_seasons: row.title_seasons })),
  [
    { pokemon: "Pikachu", title_count: 1, title_seasons: "S9" },
    { pokemon: "Bisasam", title_count: 0, title_seasons: "" },
  ],
);

assert.deepEqual(
  pokemonTitleIndex(
    [
      { pokemon: "Demeteros-I", pokemon_normalized: "demeteros i", title_count: "2", title_seasons: "S9, S10" },
      { pokemon: "Bisasam", pokemon_normalized: "bisasam", title_count: "", title_seasons: "" },
    ],
    (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  ).get("demeteros i"),
  { titles: 2, title_seasons: "S9, S10" },
);

assert.deepEqual(
  summarizePokemonDetail(
    [
      { season_id: "season_008", division: "Liga 1", pokemon: "UHaFniR", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Victini Bottom", appearances: "9", kills: "8", deaths: "3", differential: "5", source_urls: "https://example.test/s8", data_status: "sheet_extracted" },
      { season_id: "season_009", division: "Doubles", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "", trainer_normalized: "", team_name: "Victory Instinct", appearances: "3", kills: "3", deaths: "2", differential: "1", source_urls: "https://example.test/s9", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Wackel Backel", appearances: "6", kills: "9", deaths: "8", differential: "1", source_urls: "https://example.test/s10", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "Ramoth", pokemon_normalized: "ramoth", trainer: "Bene", trainer_normalized: "bene", team_name: "Wackel Backel", appearances: "2", kills: "5", deaths: "2", differential: "3", source_urls: "https://example.test/s10", data_status: "sheet_extracted" },
    ],
    "uhafnir",
    (value) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
    [{ season_id: "season_009", division: "Doubles", team_name: "Victory Instinct", person_name: "Bene", data_status: "sheet_extracted" }],
  ),
  {
    summary: {
      pokemon: "UHaFniR",
      appearances: 18,
      kills: 20,
      deaths: 13,
      differential: 7,
      seasons: 3,
      trainers: 1,
      teams: 3,
      source_urls: "https://example.test/s8;https://example.test/s9;https://example.test/s10",
    },
    trainerRows: [{ trainer: "Bene", appearances: 18, kills: 20, deaths: 13, differential: 7, seasons: 3, season_list: "S8, S9, S10", teams: 3, performance_rows: 3, draft_rows: 0 }],
    seasonRows: [
      { season_id: "season_008", division: "Liga 1", trainer: "Bene", team_name: "Victini Bottom", appearances: 9, kills: 8, deaths: 3, differential: 5, performance_rows: 1, draft_only: false, data_status: "sheet_extracted", source_urls: "https://example.test/s8" },
      { season_id: "season_009", division: "Doubles", trainer: "Bene", team_name: "Victory Instinct", appearances: 3, kills: 3, deaths: 2, differential: 1, performance_rows: 1, draft_only: false, data_status: "sheet_extracted", source_urls: "https://example.test/s9" },
      { season_id: "season_010", division: "Playoffs", trainer: "Bene", team_name: "Wackel Backel", appearances: 6, kills: 9, deaths: 8, differential: 1, performance_rows: 1, draft_only: false, data_status: "sheet_extracted", source_urls: "https://example.test/s10" },
    ],
  },
);

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rows = detailRowsWithDraftInstances(
    [
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Latios",
        pokemon_normalized: "latios",
        trainer: "SteveParker",
        trainer_normalized: "steveparker",
        team_name: "ToxicBlast",
        kills: "18",
        data_status: "sheet_extracted",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Mega Gewaldro",
        pokemon_normalized: "mega gewaldro",
        trainer: "Cabgolord",
        trainer_normalized: "fnupa",
        team_name: "",
        kills: "2",
        data_status: "sheet_extracted",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Rotom-Wasch",
        pokemon_normalized: "rotom wasch",
        trainer: "Cabgolord",
        trainer_normalized: "fnupa",
        team_name: "",
        kills: "6",
        data_status: "sheet_extracted",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Flampivian",
        pokemon_normalized: "flampivian",
        trainer: "Cabgolord",
        trainer_normalized: "fnupa",
        team_name: "",
        kills: "8",
        data_status: "sheet_extracted",
      },
    ],
    [
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Mega-Latios",
        pokemon_normalized: "megalatios",
        asset_id: "latiosmega",
        person_name: "Cabgolord",
        person_name_normalized: "fnupa",
        team_name: "Doomforce",
        team_name_normalized: "doomforce",
        data_status: "old_project_team_note",
        source_urls: "old-project;team-source",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Latios",
        pokemon_normalized: "latios",
        asset_id: "latios",
        person_name: "SteveParker",
        person_name_normalized: "steveparker",
        team_name: "ToxicBlast",
        team_name_normalized: "toxicblast",
        data_status: "old_project_team_note",
        source_urls: "old-project",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Mega-Gewaldro",
        pokemon_normalized: "megagewaldro",
        asset_id: "sceptilemega",
        person_name: "Cabgolord",
        person_name_normalized: "fnupa",
        team_name: "Doomforce",
        team_name_normalized: "doomforce",
        data_status: "old_project_team_note",
        source_urls: "old-project",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Rotom-W",
        pokemon_normalized: "rotomw",
        asset_id: "rotomwash",
        person_name: "Cabgolord",
        person_name_normalized: "fnupa",
        team_name: "Doomforce",
        team_name_normalized: "doomforce",
        data_status: "old_project_team_note",
        source_urls: "old-project",
      },
      {
        season_id: "season_002",
        division: "Regular Season",
        pokemon: "Flampivian-Normal",
        pokemon_normalized: "flampiviannormal",
        asset_id: "darmanitan",
        person_name: "Cabgolord",
        person_name_normalized: "fnupa",
        team_name: "Doomforce",
        team_name_normalized: "doomforce",
        data_status: "old_project_team_note",
        source_urls: "old-project",
      },
    ],
    normalizeTestKey,
  );

  assert.deepEqual(
    rows.map((row) => ({ pokemon: row.pokemon, trainer: row.trainer, trainer_normalized: row.trainer_normalized, draft_only: row.draft_only || "", kills: row.kills })),
    [
      { pokemon: "Latios", trainer: "SteveParker", trainer_normalized: "steveparker", draft_only: "", kills: "18" },
      { pokemon: "Mega Gewaldro", trainer: "Cabgolord", trainer_normalized: "fnupa", draft_only: "", kills: "2" },
      { pokemon: "Rotom-Wasch", trainer: "Cabgolord", trainer_normalized: "fnupa", draft_only: "", kills: "6" },
      { pokemon: "Flampivian", trainer: "Cabgolord", trainer_normalized: "fnupa", draft_only: "", kills: "8" },
      { pokemon: "Mega-Latios", trainer: "Cabgolord", trainer_normalized: "fnupa", draft_only: "true", kills: "" },
    ],
  );

  assert.deepEqual(
    summarizeTrainerPokemon(rows, "person_fnupa", normalizeTestKey).map((row) => ({
      trainer: row.trainer,
      pokemon: row.pokemon,
      seasons: row.seasons,
      season_list: row.season_list,
      teams: row.teams,
      performance_rows: row.performance_rows,
      draft_rows: row.draft_rows,
      source_urls: row.source_urls,
    })),
    [
      {
        trainer: "Cabgolord",
        pokemon: "Flampivian",
        seasons: 1,
        season_list: "S2",
        teams: 0,
        performance_rows: 1,
        draft_rows: 0,
        source_urls: "",
      },
      {
        trainer: "Cabgolord",
        pokemon: "Rotom-Wasch",
        seasons: 1,
        season_list: "S2",
        teams: 0,
        performance_rows: 1,
        draft_rows: 0,
        source_urls: "",
      },
      {
        trainer: "Cabgolord",
        pokemon: "Mega Gewaldro",
        seasons: 1,
        season_list: "S2",
        teams: 0,
        performance_rows: 1,
        draft_rows: 0,
        source_urls: "",
      },
      {
        trainer: "Cabgolord",
        pokemon: "Mega-Latios",
        seasons: 1,
        season_list: "S2",
        teams: 1,
        performance_rows: 0,
        draft_rows: 1,
        source_urls: "old-project;team-source",
      },
    ],
  );
}

assert.deepEqual(
  canonicalKilllistRows(
    [
      { season_id: "season_009", division: "Overall", pokemon: "Pikachu" },
      { season_id: "season_009", division: "Singles", pokemon: "Pikachu" },
      { season_id: "season_009", division: "Doubles", pokemon: "Pikachu" },
      { season_id: "season_010", division: "Regular Season", pokemon: "Ramoth" },
      { season_id: "season_010", division: "Playoffs", pokemon: "Ramoth" },
      { season_id: "season_010", division: "Regular Season", pokemon: "Riesenzahn", pokemon_normalized: "riesenzahn" },
      { season_id: "season_008", division: "Liga 1", pokemon: "Evoli" },
      { season_id: "season_008", division: "Liga 2", pokemon: "Relaxo" },
    ],
    "all",
  ).map((row) => `${row.season_id}:${row.division}:${row.pokemon}`),
  [
    "season_009:Overall:Pikachu",
    "season_010:Playoffs:Ramoth",
    "season_010:Regular Season:Riesenzahn",
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
        { season_id: "season_009", division: "Overall", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "Bene", trainer_normalized: "bene", team_name: "Team Gelb", appearances: "12", kills: "5", deaths: "2", differential: "3", source_urls: "https://example.test/s9-overall", data_status: "sheet_extracted" },
        { season_id: "season_009", division: "Singles", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "Bene", trainer_normalized: "bene", team_name: "Team Gelb", appearances: "14", kills: "99", deaths: "0", differential: "99", source_urls: "https://example.test/s9-singles", data_status: "sheet_extracted" },
        { season_id: "season_010", division: "Playoffs", pokemon: "Pikachu", pokemon_normalized: "pikachu", trainer: "Bene", trainer_normalized: "bene", team_name: "Team Blau", appearances: "4", kills: "4", deaths: "1", differential: "3", source_urls: "https://example.test/s10-playoffs", data_status: "sheet_extracted" },
        { season_id: "season_010", division: "Playoffs", pokemon: "Ramoth", pokemon_normalized: "ramoth", trainer: "Minetube", trainer_normalized: "minetube", team_name: "Team Rot", appearances: "3", kills: "3", deaths: "1", differential: "2", source_urls: "https://example.test/s10-other", data_status: "sheet_extracted" },
      ],
      "all",
    ),
    "person_bene",
  ).map((row) => ({
    trainer: row.trainer,
    pokemon: row.pokemon,
    appearances: row.appearances,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    seasons: row.seasons,
    season_list: row.season_list,
    divisions: row.divisions,
    teams: row.teams,
    source_urls: row.source_urls,
  })),
  [
    {
      trainer: "Bene",
      pokemon: "Pikachu",
      appearances: 16,
      kills: 9,
      deaths: 3,
      differential: 6,
      seasons: 2,
      season_list: "S9, S10",
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
      { season_id: "season_008", division: "Liga 1", pokemon: "UHaFniR", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Victini Bottom", appearances: "9", kills: "8", deaths: "", differential: "", source_urls: "https://example.test/s8", data_status: "sheet_extracted" },
      { season_id: "season_009", division: "Overall", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "", trainer_normalized: "", team_name: "Victory Instinct", appearances: "6", kills: "6", deaths: "", differential: "", source_urls: "https://example.test/s9-overall", data_status: "sheet_extracted" },
      { season_id: "season_009", division: "Doubles", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "", trainer_normalized: "", team_name: "Victory Instinct", appearances: "3", kills: "3", deaths: "", differential: "", source_urls: "https://example.test/s9-doubles", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Wackel Backel", appearances: "6", kills: "9", deaths: "8", differential: "1", source_urls: "https://example.test/s10", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Regular Season", pokemon: "Riesenzahn", pokemon_normalized: "riesenzahn", trainer: "Sirazoa", trainer_normalized: "sirazoa", team_name: "Eon Engine", appearances: "10", kills: "9", deaths: "", differential: "", source_urls: "https://example.test/s10-regular", data_status: "sheet_extracted" },
    ],
    "all",
  );

  assert.deepEqual(
    rows.map((row) => `${row.season_id}:${row.division}:${row.kills}`),
    ["season_008:Liga 1:8", "season_009:Doubles:3", "season_010:Playoffs:9", "season_010:Regular Season:9"],
  );

  assert.deepEqual(
    summarizeTrainerPokemon(rows, "person_bene", normalizeTestKey, [
      { season_id: "season_009", division: "Doubles", team_name: "Victory Instinct", person_id: "person_bene", person_name: "Bene", data_status: "sheet_extracted" },
    ]).map((row) => ({
      trainer: row.trainer,
      pokemon: row.pokemon,
      appearances: row.appearances,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      seasons: row.seasons,
      season_list: row.season_list,
      divisions: row.divisions,
      teams: row.teams,
    })),
    [
      {
        trainer: "Bene",
        pokemon: "UHaFniR",
        appearances: 18,
        kills: 20,
        deaths: 8,
        differential: 12,
        seasons: 3,
        season_list: "S8, S9, S10",
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
  primaryCompetitionRows(
    [
      { season_id: "season_002", division: "Regular Season", person_name: "A" },
      { season_id: "season_002", division: "Liga 2", person_name: "B" },
      { season_id: "season_003", division: "Regular Season", person_name: "C" },
      { season_id: "season_004", division: "Regular Season", person_name: "D" },
      { season_id: "season_005", division: "Liga 1", person_name: "E" },
      { season_id: "season_008", division: "Liga 1", person_name: "F" },
    ],
    "Liga 1",
  ).map((row) => `${row.season_id}:${row.division}:${row.person_name}`),
  [
    "season_002:Regular Season:A",
    "season_003:Regular Season:C",
    "season_004:Regular Season:D",
    "season_005:Liga 1:E",
    "season_008:Liga 1:F",
  ],
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
    { opponent_key: "nestfloh", opponent: "Nestfloh", matches: 1, wins: 1, losses: 0, draws: 0, win_pct: "100.0%" },
    { opponent_key: "presentlp", opponent: "PresentLP", matches: 2, wins: 1, losses: 1, draws: 0, win_pct: "50.0%" },
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
  personOptionsFromAllTimeRows(
    [
      { season_id: "season_010", person_id: "person_bene", person_name: "Bene", team_name: "Victini Bottom", wins: "10", losses: "2" },
      { season_id: "season_010", person_id: "person_nestfloh", person_name: "Nestfloh", team_name: "Rotom Rally", wins: "9", losses: "3" },
    ],
    [{ season_id: "season_010", champion_person_id: "person_bene", champion_name: "Bene", champion_team: "Victini Bottom" }],
    (value) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim(),
  ),
  [
    { value: "bene", label: "Bene" },
    { value: "nestfloh", label: "Nestfloh" },
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

assert.deepEqual(
  qualityRowsFromData({
    dataQuality: [
      {
        season_id: "season_010",
        coverage_status: "complete_with_review_flags",
        standings_rows: "10",
      },
    ],
    seasons: [{ season_id: "season_001" }],
  }),
  [
    {
      season_id: "season_010",
      coverage_status: "complete_with_review_flags",
      standings_rows: "10",
    },
  ],
);

assert.deepEqual(
  filterSourceClaims(
    [
      { season_id: "season_010", claim_type: "champion", claim_subject: "Bene", claim_value: "Bene" },
      { season_id: "season_009", claim_type: "champion", claim_subject: "Bene + El Scizor", claim_value: "Bene + El Scizor" },
      { season_id: "season_010", claim_type: "video", claim_subject: "abc", claim_value: "GPL S10 Finale" },
    ],
    { season: "season_010", claimType: "champion", search: "bene" },
  ),
  [{ season_id: "season_010", claim_type: "champion", claim_subject: "Bene", claim_value: "Bene" }],
);

assert.deepEqual(
  reviewWorkflowRows({
    reviewIndex: [
      {
        review_file: "ambiguous_matches.csv",
        severity: "high",
        review_reason: "unmatched_game_video",
        correction_file: "data/manual/matches.csv",
        suggested_action: "Map the video.",
      },
    ],
    ambiguousMatches: [
      {
        video_id: "abc",
        title: "GPL S10 Spieltag 2 vs Bene",
        detected_season_id: "season_010",
        detected_week: "2",
        source_urls: "https://youtube.test/watch?v=abc",
      },
    ],
  }),
  [
    {
      review_key: "ambiguous_matches:season_010:1",
      queue: "ambiguous_matches.csv",
      severity: "high",
      review_reason: "unmatched_game_video",
      correction_file: "data/manual/matches.csv",
      correction_target: "data/manual/matches.csv -> season_010 / GPL S10 Spieltag 2 vs Bene",
      suggested_action: "Map the video.",
      season_id: "season_010",
      subject: "GPL S10 Spieltag 2 vs Bene",
      detail: "Spieltag 2",
      confidence: "",
      confidence_tier: "",
      source_urls: "https://youtube.test/watch?v=abc",
    },
  ],
);

assert.deepEqual(
  sourceClaimsForSeason(
    [
      { season_id: "season_010", claim_type: "champion", claim_value: "Bene" },
      { season_id: "season_009", claim_type: "champion", claim_value: "Bene + El Scizor" },
    ],
    "season_010",
  ),
  [{ season_id: "season_010", claim_type: "champion", claim_value: "Bene" }],
);

assert.deepEqual(
  personPokemonHighlights(
    [
      { season_id: "season_008", division: "Liga 1", pokemon: "UHaFniR", pokemon_normalized: "uhafnir", trainer: "Bene", trainer_normalized: "bene", team_name: "Victini Bottom", appearances: "9", kills: "8", deaths: "3", source_urls: "https://example.test/s8", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "Ramoth", pokemon_normalized: "ramoth", trainer: "Bene", trainer_normalized: "bene", team_name: "Wackel Backel", appearances: "4", kills: "6", deaths: "1", source_urls: "https://example.test/s10", data_status: "sheet_extracted" },
    ],
    "person_bene",
    (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
  ).map((row) => ({
    pokemon: row.pokemon,
    appearances: row.appearances,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    seasons: row.seasons,
    season_list: row.season_list,
  })),
  [
    { pokemon: "UHaFniR", appearances: 9, kills: 8, deaths: 3, differential: 5, seasons: 1, season_list: "S8" },
    { pokemon: "Ramoth", appearances: 4, kills: 6, deaths: 1, differential: 5, seasons: 1, season_list: "S10" },
  ],
);

assert.deepEqual(
  pokemonTimelineRows(
    [
      { season_id: "season_008", division: "Liga 1", pokemon: "UHaFniR", pokemon_normalized: "uhafnir", trainer: "Bene", appearances: "9", kills: "8", deaths: "3", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "Bene", appearances: "6", kills: "9", deaths: "8", data_status: "sheet_extracted" },
    ],
    "uhafnir",
    (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    new Map([["uhafnir", { titles: 2, title_seasons: "S8, S10" }]]),
  ),
  [
    { season_id: "season_008", divisions: "Liga 1", appearances: 9, kills: 8, deaths: 3, differential: 5, trainers: 1, teams: 0, performance_rows: 1, draft_rows: 0 },
    { season_id: "season_010", divisions: "Playoffs", appearances: 6, kills: 9, deaths: 8, differential: 1, trainers: 1, teams: 0, performance_rows: 1, draft_rows: 0 },
  ],
);

assert.deepEqual(
  personStorySummary(
    [
      { season_id: "season_008", person_id: "person_bene", person_name: "Bene", team_name: "Victini Bottom", wins: "9", losses: "3", draws: "0", points: "27", kills: "60", deaths: "40", differential: "20", data_status: "sheet_extracted" },
      { season_id: "season_010", person_id: "person_bene", person_name: "Bene", team_name: "Wackel Backel", wins: "10", losses: "1", draws: "0", points: "30", kills: "70", deaths: "30", differential: "40", data_status: "sheet_extracted" },
    ],
    [{ season_id: "season_010", champion_person_id: "person_bene", champion_name: "Bene", champion_team: "Wackel Backel", data_status: "source_evidenced" }],
    [
      { trainer: "Bene", pokemon: "UHaFniR", appearances: 12, kills: 15, deaths: 4, differential: 11, seasons: 2 },
      { trainer: "Bene", pokemon: "Ramoth", appearances: 5, kills: 8, deaths: 2, differential: 6, seasons: 1 },
    ],
    "person_bene",
  ),
  {
    person: "Bene",
    seasons: 2,
    season_list: "S8, S10",
    title_seasons: "S10",
    best_season: "S10",
    best_record: "10-1-0",
    best_rating: "69.6",
    signature_pokemon: "UHaFniR",
  },
);

assert.deepEqual(
  pokemonStorySummary(
    [
      { season_id: "season_008", division: "Liga 1", pokemon: "UHaFniR", pokemon_normalized: "uhafnir", trainer: "Bene", team_name: "Victini Bottom", appearances: "9", kills: "8", deaths: "3", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "Bene", team_name: "Wackel Backel", appearances: "6", kills: "9", deaths: "8", data_status: "sheet_extracted" },
      { season_id: "season_010", division: "Playoffs", pokemon: "UHaFnir", pokemon_normalized: "uhafnir", trainer: "Minetube", team_name: "Backel Gefackel", appearances: "4", kills: "7", deaths: "2", data_status: "sheet_extracted" },
    ],
    "uhafnir",
    (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(),
    new Map([["uhafnir", { titles: 2, title_seasons: "S8, S10" }]]),
  ),
  {
    pokemon: "UHaFniR",
    seasons: 2,
    season_list: "S8, S10",
    titles: 2,
    title_seasons: "S8, S10",
    best_trainer: "Bene",
    best_season: "S10",
    top_team: "Wackel Backel",
  },
);

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Prekani",
          person_name: "PresentLP",
          pokemon: "Pikachu",
          pokemon_normalized: "pikachu",
          slot: "1",
          source_urls: "manual-graphic",
          data_status: "manual_override",
        },
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Prekani",
          person_name: "PresentLP",
          pokemon: "Evoli",
          pokemon_normalized: "evoli",
          slot: "2",
          source_urls: "manual-graphic",
          data_status: "manual_override",
        },
      ],
      killlists: [
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Prekani",
          trainer: "PresentLP",
          pokemon: "Pikachu",
          pokemon_normalized: "pikachu",
          appearances: "7",
          kills: "8",
          deaths: "3",
          source_urls: "https://example.test/kills",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_003",
          division: "Regular Season",
          team_name: "Crinchilla",
          trainer: "CaptainCrinch",
          pokemon: "Bisasam",
          pokemon_normalized: "bisasam",
          appearances: "2",
          kills: "1",
          deaths: "5",
          source_urls: "https://example.test/other",
          data_status: "sheet_extracted",
        },
      ],
      pokemonDraftOverview: [
        { pokemon: "Pikachu", pokemon_normalized: "pikachu", tier: "OU", tier_rank: "3", draft_count: "4", title_count: "1" },
        { pokemon: "Evoli", pokemon_normalized: "evoli", tier: "NU", tier_rank: "9", draft_count: "1", title_count: "0" },
        { pokemon: "Bisasam", pokemon_normalized: "bisasam", tier: "LC", tier_rank: "15", draft_count: "0", title_count: "0" },
      ],
    },
    normalizeTestKey,
  );

  assert.deepEqual(
    rosterPokemon.map((row) => ({
      season_id: row.season_id,
      team: row.team,
      person: row.person,
      pokemon: row.pokemon,
      appearances: row.appearances,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      tier: row.tier,
      draft_count: row.draft_count,
      pokemon_score: row.pokemon_score,
    })),
    [
      {
        season_id: "season_003",
        team: "Crinchilla",
        person: "CaptainCrinch",
        pokemon: "Bisasam",
        appearances: 2,
        kills: 1,
        deaths: 5,
        differential: -4,
        tier: "LC",
        draft_count: 0,
        pokemon_score: 25.8,
      },
      {
        season_id: "season_003",
        team: "Prekani",
        person: "PresentLP",
        pokemon: "Pikachu",
        appearances: 7,
        kills: 8,
        deaths: 3,
        differential: 5,
        tier: "OU",
        draft_count: 4,
        pokemon_score: 38.9,
      },
      {
        season_id: "season_003",
        team: "Prekani",
        person: "PresentLP",
        pokemon: "Evoli",
        appearances: 0,
        kills: 0,
        deaths: 0,
        differential: 0,
        tier: "NU",
        draft_count: 1,
        pokemon_score: 27.5,
      },
    ],
  );

  const overview = teamRosterOverviewRows(rosterPokemon);
  assert.equal(overview[0].team, "Prekani");
  assert.equal(overview[0].pokemon_count, 2);
  assert.equal(overview[0].kills, 8);
  assert.equal(overview[0].deaths, 3);
  assert.equal(overview[0].differential, 5);
  assert.equal(overview[0].roster_flags, "unter 11 Pokémon");
  assert.ok(Number(overview[0].roster_score) > Number(overview[1].roster_score));
  assert.match(overview[0].top_pokemon, /Pikachu/);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      killlists: [
        {
          season_id: "season_007",
          division: "Regular Season",
          team_name: "Elekid's Club",
          trainer: "ElektechN9ne",
          pokemon: "Viridium",
          pokemon_normalized: "viridium",
          appearances: "2",
          kills: "9",
          deaths: "",
          data_status: "sheet_extracted",
        },
      ],
      pokemonDraftOverview: [{ pokemon: "Viridium", pokemon_normalized: "viridium", tier: "OU", tier_rank: "3", draft_count: "1", title_count: "0" }],
    },
    normalizeTestKey,
  );

  assert.equal(rosterPokemon[0].deaths_estimated, true);
  assert.equal(rosterPokemon[0].deaths, 1.8);
  assert.equal(rosterPokemon[0].differential, 7.2);
  assert.equal(rosterPokemon[0].missing_deaths, true);
  assert.equal(rosterPokemon[0].pokemon_score, 42);

  const overview = teamRosterOverviewRows(rosterPokemon)[0];
  assert.equal(overview.differential, 7.2);
  assert.match(overview.roster_flags, /Todesdaten geschätzt: 1/);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      killlists: [
        {
          season_id: "season_010",
          division: "Regular Season",
          team_name: "Baseline",
          trainer: "Known",
          pokemon: "Heatran",
          pokemon_normalized: "heatran",
          appearances: "10",
          kills: "10",
          deaths: "9",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_007",
          division: "Regular Season",
          team_name: "Elekid's Club",
          trainer: "ElektechN9ne",
          pokemon: "Viridium",
          pokemon_normalized: "viridium",
          appearances: "10",
          kills: "15",
          deaths: "",
          data_status: "sheet_extracted",
        },
      ],
      pokemonDraftOverview: [
        { pokemon: "Heatran", pokemon_normalized: "heatran", tier: "OU", tier_rank: "3", draft_count: "4", title_count: "0" },
        { pokemon: "Viridium", pokemon_normalized: "viridium", tier: "OU", tier_rank: "3", draft_count: "1", title_count: "0" },
      ],
    },
    normalizeTestKey,
  );

  const viridium = rosterPokemon.find((row) => row.pokemon === "Viridium");
  assert.equal(viridium.missing_deaths, true);
  assert.equal(viridium.deaths_estimated, true);
  assert.equal(viridium.deaths, 9);
  assert.equal(viridium.differential, 6);
  assert.ok(viridium.performance_score > 50);
  assert.ok(viridium.confidence_score < 100);

  const overview = teamRosterOverviewRows(rosterPokemon).find((row) => row.person === "ElektechN9ne");
  assert.equal(overview.deaths, 9);
  assert.equal(overview.differential, 6);
  assert.match(overview.roster_flags, /Todesdaten geschätzt: 1/);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      killlists: [
        {
          season_id: "season_005",
          division: "Liga 1",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "Snibunna",
          pokemon_normalized: "snibunna",
          appearances: "",
          kills: "24",
          deaths: "",
          data_status: "manual_override",
        },
        {
          season_id: "season_005",
          division: "Liga 1",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "Rotom-Schneide",
          pokemon_normalized: "rotom schneide",
          appearances: "",
          kills: "9",
          deaths: "",
          data_status: "manual_override",
        },
        {
          season_id: "season_005",
          division: "Liga 1",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "Rotom-Wasch",
          pokemon_normalized: "rotom wasch",
          appearances: "",
          kills: "12",
          deaths: "",
          data_status: "manual_override",
        },
        {
          season_id: "season_005",
          division: "Liga 1",
          team_name: "Victini Bottom",
          trainer: "Bene",
          pokemon: "Zygarde-50",
          pokemon_normalized: "zygarde 50",
          appearances: "",
          kills: "20",
          deaths: "",
          data_status: "manual_override",
        },
      ],
      pokemonDraftOverview: [
        { pokemon: "Snibunna", pokemon_normalized: "snibunna", tier: "UUBL", tier_rank: "4", draft_count: "14", title_count: "0" },
        { pokemon: "Rotom-W", pokemon_normalized: "rotomw", asset_id: "rotomwash", english: "rotom-wash", tier: "UU", tier_rank: "5", draft_count: "12", title_count: "2" },
        { pokemon: "Rotom-Mow", pokemon_normalized: "rotommow", asset_id: "rotommow", english: "rotom-mow", tier: "RU", tier_rank: "7", draft_count: "8", title_count: "1" },
        { pokemon: "Zygarde", pokemon_normalized: "zygarde", asset_id: "zygarde", tier: "Uber", tier_rank: "2", draft_count: "3", title_count: "0" },
      ],
    },
    normalizeTestKey,
  );

  const snibunna = rosterPokemon.find((row) => row.pokemon === "Snibunna");
  const rotomWash = rosterPokemon.find((row) => row.pokemon === "Rotom-Wasch");
  const rotomMow = rosterPokemon.find((row) => row.pokemon === "Rotom-Schneide");
  const zygarde = rosterPokemon.find((row) => row.pokemon === "Zygarde-50");

  assert.equal(rotomWash.tier, "UU");
  assert.equal(rotomWash.tier_rank, 5);
  assert.equal(rotomWash.draft_count, 12);
  assert.equal(rotomWash.title_count, 2);
  assert.equal(rotomWash.history_score, 82);
  assert.equal(rotomWash.pokemon_score, 43.2);

  assert.equal(rotomMow.tier, "RU");
  assert.equal(rotomMow.tier_rank, 7);
  assert.equal(rotomMow.draft_count, 8);
  assert.equal(rotomMow.title_count, 1);
  assert.equal(rotomMow.history_score, 62);
  assert.equal(rotomMow.pokemon_score, 39.7);

  assert.equal(zygarde.tier, "Uber");
  assert.equal(zygarde.tier_rank, 2);
  assert.equal(zygarde.draft_count, 3);
  assert.equal(zygarde.history_score, 21);
  assert.ok(zygarde.performance_score > 45);
  assert.ok(snibunna.performance_score > zygarde.performance_score);
  assert.equal(snibunna.pokemon_score, 46.3);
  assert.equal(zygarde.pokemon_score, 38.9);
}

{
  const rows = [
    { season_id: "season_010", division: "Playoffs", person: "Bene", team: "Wackel Backel", pokemon: "A", pokemon_score: 90, power_score: 80, performance_score: 70, history_score: 60, confidence_score: 100, appearances: 4, kills: 6, deaths: 3, differential: 3, tier_rank: 3 },
    { season_id: "season_010", division: "Playoffs", person: "Bene", team: "Wackel Backel", pokemon: "B", pokemon_score: 80, power_score: 60, performance_score: 90, history_score: 20, confidence_score: 90, appearances: 4, kills: 8, deaths: 2, differential: 6, tier_rank: 7 },
    { season_id: "season_010", division: "Playoffs", person: "Bene", team: "Wackel Backel", pokemon: "C", pokemon_score: 70, power_score: 40, performance_score: 50, history_score: 10, confidence_score: 80, appearances: 4, kills: 4, deaths: 4, differential: 0, tier_rank: 11 },
  ];
  const overview = teamRosterOverviewRows(rows)[0];
  const expected = Math.round(
    (overview.performance_score * 0.4 +
      overview.balance_score * 0.15 +
      overview.history_score * 0.1 +
      overview.confidence_score * 0.05) *
      10,
  ) / 10;

  assert.equal(overview.roster_score, expected);
  assert.equal("power_score" in overview, false);
  assert.equal(overview.performance_score, 70);
  assert.equal(overview.history_score, 30);
  assert.equal(overview.confidence_score, 90);
  assert.ok(overview.balance_score > 0);
  assert.ok(overview.balance_score <= 100);
}

{
  const strongDepth = Array.from({ length: 11 }, (_, index) => ({
    season_id: "season_009",
    division: "Doubles",
    person: "Bene",
    team: "Victory Instinct",
    pokemon: `Strong ${index + 1}`,
    pokemon_score: 70,
    power_score: 70,
    performance_score: 70,
    history_score: 70,
    confidence_score: 90,
    tier_rank: index < 4 ? 3 : 5,
  }));
  const lowerTierSpread = Array.from({ length: 11 }, (_, index) => ({
    season_id: "season_009",
    division: "Singles",
    person: "Dauni Daunstar",
    team: "Scherzkekse",
    pokemon: `Spread ${index + 1}`,
    pokemon_score: index < 6 ? 70 : 35,
    power_score: index < 6 ? 70 : 35,
    performance_score: index < 6 ? 70 : 35,
    history_score: 70,
    confidence_score: 90,
    tier_rank: index < 6 ? 3 : 13,
  }));
  const overview = teamRosterOverviewRows([...strongDepth, ...lowerTierSpread]);
  const strong = overview.find((row) => row.team === "Victory Instinct");
  const spread = overview.find((row) => row.team === "Scherzkekse");

  assert.ok(strong.balance_score > spread.balance_score);
}

{
  const rows = [
    { season_id: "season_009", division: "Overall", person: "", team: "Victory Instinct", pokemon: "A", pokemon_score: 80, power_score: 80, performance_score: 60, history_score: 70, confidence_score: 70, appearances: 20, kills: 18, deaths: 22, differential: -4, tier_rank: 3, missing_deaths: true },
    { season_id: "season_009", division: "Overall", person: "", team: "Victory Instinct", pokemon: "B", pokemon_score: 75, power_score: 75, performance_score: 58, history_score: 65, confidence_score: 70, appearances: 20, kills: 16, deaths: 21, differential: -5, tier_rank: 5, missing_deaths: true },
  ];
  const overview = teamRosterOverviewRows(rows, [
    {
      season_id: "season_009",
      division: "Overall Tag Team",
      player_name: "El Scizor & Bene",
      team_name: "Victory Instinct",
      wins: "22",
      losses: "6",
      draws: "0",
      kills: "154",
      deaths: "89",
      differential: "65",
    },
  ])[0];

  assert.equal(overview.kills, 154);
  assert.equal(overview.deaths, 89);
  assert.equal(overview.differential, 65);
  assert.match(overview.roster_flags, /Team-Tabellenwerte genutzt/);
}

{
  const sharedPokemon = {
    pokemon: "A",
    pokemon_score: 80,
    power_score: 80,
    performance_score: 70,
    history_score: 60,
    confidence_score: 90,
    appearances: 8,
    kills: 14,
    deaths: 6,
    differential: 8,
    tier_rank: 3,
  };
  const rows = [
    { ...sharedPokemon, season_id: "season_010", division: "Regular Season", person: "Minetube", team: "Throes Mad" },
    { ...sharedPokemon, season_id: "season_010", division: "Playoffs", person: "Minetube", team: "Throes Mad", roster_phase: "playoffs" },
  ];
  const overview = teamRosterOverviewRows(rows, [
    { season_id: "season_010", division: "Regular Season", player_name: "Minetube", team_name: "Throes Mad", wins: "9", losses: "3", draws: "0", kills: "72", deaths: "57", differential: "15" },
    { season_id: "season_010", division: "Playoffs", player_name: "Minetube", team_name: "Throes Mad", wins: "0", losses: "1", draws: "0", kills: "", deaths: "", differential: "" },
  ]);
  const regular = overview.find((row) => row.division === "Regular Season");
  const playoffs = overview.find((row) => row.division === "Playoffs");

  assert.ok(playoffs.performance_score < regular.performance_score);
  assert.ok(playoffs.roster_score < regular.roster_score);
}

{
  const overview = [
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 70,
      kills: 69,
      deaths: 60,
      differential: 9,
      appearances: 77,
      wins: 9,
      losses: 3,
    },
    {
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 80,
      kills: 76,
      deaths: 59,
      differential: 17,
      appearances: 62,
      wins: 2,
      losses: 1,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, []);

  assert.equal(grouped.overviewRows[0].kills, 76);
  assert.equal(grouped.overviewRows[0].deaths, 59);
  assert.equal(grouped.overviewRows[0].differential, 17);
  assert.equal(grouped.overviewRows[0].appearances, 62);
  assert.equal(grouped.overviewRows[0].wins, 11);
  assert.equal(grouped.overviewRows[0].losses, 4);
}

{
  const rows = [
    {
      season_id: "season_010",
      division: "Regular Season",
      person: "Minetube",
      team: "Throes Mad",
      pokemon: "Stalobor",
      pokemon_score: 60,
      power_score: 60,
      performance_score: 60,
      history_score: 60,
      confidence_score: 80,
      tier_rank: 4,
      kills: 20,
      deaths: 12,
    },
    {
      season_id: "season_010",
      division: "Regular Season",
      person: "PresentLP",
      team: "Prekani",
      pokemon: "Demeteros-T",
      pokemon_score: 60,
      power_score: 60,
      performance_score: 60,
      history_score: 60,
      confidence_score: 80,
      tier_rank: 4,
      kills: 24,
      deaths: 10,
    },
  ];
  const overview = teamRosterOverviewRows(rows, [
    {
      season_id: "season_010",
      division: "Regular Season",
      rank: "1",
      player_name: "Minetube",
      team_name: "Throes Mad",
      wins: "9",
      losses: "3",
      draws: "0",
      kills: "72",
      deaths: "57",
      differential: "15",
      data_status: "sheet_extracted",
    },
    {
      season_id: "season_010",
      division: "Regular Season",
      rank: "2",
      player_name: "PresentLP",
      team_name: "Prekani",
      wins: "9",
      losses: "3",
      draws: "0",
      kills: "81",
      deaths: "52",
      differential: "29",
      data_status: "sheet_extracted",
    },
  ]);
  const minetube = overview.find((row) => row.person === "Minetube");
  const present = overview.find((row) => row.person === "PresentLP");

  assert.ok(minetube.result_score > present.result_score);
  assert.equal(minetube.standing_rank, 1);
  assert.equal(present.standing_rank, 2);
}

{
  const basePokemon = {
    season_id: "season_004",
    division: "Regular Season",
    person: "PresentLP",
    team: "Prekani",
    pokemon: "Magearna",
    pokemon_score: 70,
    power_score: 85,
    performance_score: 60,
    history_score: 55,
    confidence_score: 80,
    tier_rank: 2,
    kills: 23,
    deaths: 0,
    differential: 23,
  };
  const standings = [
    {
      season_id: "season_004",
      division: "Regular Season",
      stage: "final_table",
      rank: "1",
      player_name: "PresentLP",
      team_name: "Prekani",
      wins: "20",
      losses: "2",
      draws: "0",
      kills: "130",
      deaths: "60",
      differential: "70",
      data_status: "sheet_extracted",
    },
  ];
  const exact = teamRosterOverviewRows([{ ...basePokemon, roster_phase: "regular" }], standings)[0];
  const snapshot = teamRosterOverviewRows(
    [
      {
        ...basePokemon,
        roster_phase: "hinrunde",
        notes: "Manuelle Teamgrafik-Zuordnung als Hinrunden-Snapshot; Killlisten-Ergaenzung zu unvollstaendigem Kader-Snapshot",
      },
    ],
    standings,
  )[0];

  assert.equal(exact.result_weight, 0.45);
  assert.equal(snapshot.result_weight, 0.18);
  assert.ok(snapshot.performance_score < exact.performance_score);
  assert.match(snapshot.roster_flags, /Snapshot-Kader nur 40% gewichtet/);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      killlists: [
        {
          season_id: "season_002",
          division: "Regular Season",
          team_name: "ToxicBlast",
          trainer: "SteveParker",
          pokemon: "Latios",
          pokemon_normalized: "latios",
          kills: "18",
          deaths: "",
          data_status: "sheet_extracted",
        },
      ],
    },
    normalizeTestKey,
  );
  const overview = teamRosterOverviewRows(rosterPokemon, [
    {
      season_id: "season_002",
      division: "Regular Season",
      stage: "final_table",
      rank: "1",
      player_name: "SteveParker",
      team_name: "ToxicBlast",
      wins: "18",
      losses: "6",
      draws: "2",
      kills: "138",
      deaths: "84",
      differential: "54",
      data_status: "sheet_extracted",
    },
  ])[0];

  assert.match(rosterPokemon[0].notes, /Fruehe Saison/);
  assert.equal(overview.result_weight, 0.18);
  assert.match(overview.roster_flags, /Fruehe Saison/);
  assert.match(overview.roster_flags, /Snapshot-Kader nur 40% gewichtet/);
}

{
  const overview = [
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 55,
      wins: 8,
      losses: 4,
      kills: 69,
      deaths: 60,
      differential: 9,
      standing_rank: 4,
      standing_field_size: 14,
    },
    {
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 65,
      wins: 3,
      losses: 0,
      kills: 76,
      deaths: 59,
      differential: 17,
      standing_rank: 1,
      standing_field_size: 7,
    },
  ];
  const pokemonRows = [
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      pokemon: "Granforgita",
      pokemon_score: 95,
      power_score: 95,
      performance_score: 95,
      history_score: 95,
      confidence_score: 100,
      tier_rank: 1,
    },
    {
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      pokemon: "Caesurio",
      pokemon_score: 95,
      power_score: 95,
      performance_score: 95,
      history_score: 95,
      confidence_score: 100,
      tier_rank: 1,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, pokemonRows);

  assert.equal(grouped.overviewRows[0].roster_score, 59.6);
  assert.equal(grouped.overviewRows[0].standing_rank, 1);
}

{
  const overview = [
    {
      season_id: "season_009",
      division: "Doubles",
      roster_phase: "hinrunde",
      person: "Bene",
      team: "Victory Instinct",
      roster_score: 70,
      kills: 76,
      deaths: 43,
      differential: 33,
      appearances: 78,
    },
    {
      season_id: "season_009",
      division: "Doubles",
      roster_phase: "rueckrunde",
      person: "Bene",
      team: "Victory Instinct",
      roster_score: 80,
      kills: 76,
      deaths: 43,
      differential: 33,
      appearances: 80,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, []);

  assert.equal(grouped.overviewRows[0].kills, 76);
  assert.equal(grouped.overviewRows[0].deaths, 43);
  assert.equal(grouped.overviewRows[0].differential, 33);
  assert.equal(grouped.overviewRows[0].appearances, 80);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      teamUsage: [
        {
          season_id: "season_010",
          division: "Playoffs",
          team_name: "Wackel Backel",
          person_name: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          slot: "6",
          data_status: "sheet_extracted",
          source_urls: "playoff-kader",
        },
      ],
      killlists: [
        {
          season_id: "season_010",
          division: "Playoffs",
          team_name: "",
          trainer: "Bene",
          pokemon: "UHaFnir",
          pokemon_normalized: "uhafnir",
          appearances: "9",
          kills: "9",
          deaths: "8",
          data_status: "sheet_extracted",
          source_urls: "playoff-killlist",
        },
        {
          season_id: "season_010",
          division: "Playoffs",
          team_name: "",
          trainer: "Bene",
          pokemon: "Granforgita",
          pokemon_normalized: "granforgita",
          appearances: "7",
          kills: "7",
          deaths: "6",
          data_status: "sheet_extracted",
          source_urls: "playoff-killlist",
        },
      ],
      pokemonDraftOverview: [{ pokemon: "UHaFnir", pokemon_normalized: "uhafnir", tier: "B", tier_rank: "7", draft_count: "2", title_count: "1" }],
    },
    normalizeTestKey,
  );

  assert.equal(rosterPokemon.length, 1);
  assert.equal(rosterPokemon[0].team, "Wackel Backel");
  assert.equal(rosterPokemon[0].person, "Bene");
  assert.equal(rosterPokemon[0].kills, 9);
  assert.match(rosterPokemon[0].source_urls, /playoff-kader/);
  assert.match(rosterPokemon[0].source_urls, /playoff-killlist/);
}

{
  const overview = [
    {
      rank: 1,
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 73,
      kills: 50,
    },
    {
      rank: 2,
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 83,
      kills: 24,
    },
    {
      rank: 3,
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "PresentLP",
      team: "Prekani",
      roster_score: 60,
      kills: 40,
    },
  ];
  const pokemonRows = [
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      pokemon: "Granforgita",
      pokemon_score: 60,
      power_score: 60,
      performance_score: 60,
      history_score: 60,
      confidence_score: 100,
      tier_rank: 5,
    },
    {
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      pokemon: "Caesurio",
      pokemon_score: 80,
      power_score: 80,
      performance_score: 80,
      history_score: 80,
      confidence_score: 100,
      tier_rank: 3,
    },
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "PresentLP",
      team: "Prekani",
      pokemon: "Arkani",
      pokemon_score: 40,
      power_score: 40,
      performance_score: 40,
      history_score: 40,
      confidence_score: 80,
      tier_rank: 8,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, pokemonRows);
  const beneGroup = grouped.groups.find((group) => group.overview.person === "Bene");

  assert.equal(grouped.overviewRows.length, 2);
  assert.equal(beneGroup.overview.division, "Playoffs");
  assert.equal(beneGroup.overview.roster_phase, "playoffs");
  assert.equal(beneGroup.overview.roster_score, 50.1);
  assert.equal(beneGroup.overview.kills, 24);
  assert.equal(beneGroup.overview.variant_count, 2);
  assert.deepEqual(beneGroup.pokemonRows.map((row) => row.pokemon), ["Caesurio"]);

  const regularKey = beneGroup.overview.roster_variant_options.find((option) => option.division === "Regular Season").key;
  const selected = teamRosterDisplayGroups(overview, pokemonRows, { [beneGroup.overview.roster_group_key]: regularKey });
  const selectedBeneGroup = selected.groups.find((group) => group.overview.person === "Bene");
  assert.equal(selectedBeneGroup.overview.rank, beneGroup.overview.rank);
  assert.equal(selectedBeneGroup.overview.division, "Regular Season");
  assert.equal(selectedBeneGroup.overview.roster_score, 50.1);
  assert.equal(selectedBeneGroup.overview.kills, 24);
  assert.deepEqual(selectedBeneGroup.pokemonRows.map((row) => row.pokemon), ["Granforgita"]);
}

{
  const overview = [
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 50,
    },
    {
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      roster_score: 60,
    },
  ];
  const pokemonRows = [
    {
      season_id: "season_010",
      division: "Regular Season",
      roster_phase: "regular",
      person: "Bene",
      team: "Wackel Backel",
      pokemon: "A",
      pokemon_score: 90,
      power_score: 90,
      performance_score: 90,
      history_score: 90,
      confidence_score: 100,
      tier_rank: 3,
    },
    {
      season_id: "season_010",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Wackel Backel",
      pokemon: "B",
      pokemon_score: 90,
      power_score: 90,
      performance_score: 90,
      history_score: 90,
      confidence_score: 100,
      tier_rank: 3,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, pokemonRows);

  assert.ok(grouped.groups[0].overview.roster_score > 60);
}

{
  const overview = [
    {
      season_id: "season_006",
      division: "Moon Conference",
      roster_phase: "regular",
      person: "Bene",
      team: "Kleinsteins;Gate",
      roster_score: 70,
      kills: 60,
      pokemon_count: 11,
    },
    {
      season_id: "season_006",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Kleinsteins;Gate",
      roster_score: 80,
      kills: 24,
      pokemon_count: 11,
    },
  ];
  const pokemonRows = [
    {
      season_id: "season_006",
      division: "Moon Conference",
      roster_phase: "regular",
      person: "Bene",
      team: "Kleinsteins;Gate",
      pokemon: "Heatran",
      pokemon_score: 70,
      power_score: 70,
      performance_score: 70,
      history_score: 70,
      confidence_score: 100,
      tier_rank: 4,
    },
    {
      season_id: "season_006",
      division: "Playoffs",
      roster_phase: "playoffs",
      person: "Bene",
      team: "Kleinsteins;Gate",
      pokemon: "Zapdos",
      pokemon_score: 80,
      power_score: 80,
      performance_score: 80,
      history_score: 80,
      confidence_score: 100,
      tier_rank: 3,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, pokemonRows);
  const group = grouped.groups[0];

  assert.equal(grouped.groups.length, 1);
  assert.equal(group.overview.division, "Playoffs");
  assert.equal(group.overview.variant_count, 2);
  assert.deepEqual(group.pokemonRows.map((row) => row.pokemon), ["Zapdos"]);

  const conferenceKey = group.overview.roster_variant_options.find((option) => option.division === "Moon Conference").key;
  const selected = teamRosterDisplayGroups(overview, pokemonRows, { [group.overview.roster_group_key]: conferenceKey });
  assert.equal(selected.groups[0].overview.division, "Moon Conference");
  assert.deepEqual(selected.groups[0].pokemonRows.map((row) => row.pokemon), ["Heatran"]);
}

{
  const overview = [
    {
      season_id: "season_008",
      division: "Liga 1",
      roster_phase: "hinrunde",
      person: "Bene",
      team: "Victini Bottom",
      roster_score: 70,
      kills: 80,
      deaths: 41,
      differential: 39,
      pokemon_count: 11,
    },
    {
      season_id: "season_008",
      division: "Liga 1",
      roster_phase: "rueckrunde",
      person: "Bene",
      team: "Victini Bottom",
      roster_score: 80,
      kills: 80,
      deaths: 41,
      differential: 39,
      pokemon_count: 11,
    },
  ];
  const pokemonRows = [
    {
      season_id: "season_008",
      division: "Liga 1",
      roster_phase: "hinrunde",
      person: "Bene",
      team: "Victini Bottom",
      pokemon: "Pixi",
      pokemon_score: 60,
      power_score: 60,
      performance_score: 60,
      history_score: 60,
      confidence_score: 100,
      tier_rank: 5,
    },
    {
      season_id: "season_008",
      division: "Liga 1",
      roster_phase: "rueckrunde",
      person: "Bene",
      team: "Victini Bottom",
      pokemon: "Zeraora",
      pokemon_score: 80,
      power_score: 80,
      performance_score: 80,
      history_score: 80,
      confidence_score: 100,
      tier_rank: 3,
    },
  ];
  const grouped = teamRosterDisplayGroups(overview, pokemonRows);

  assert.equal(grouped.overviewRows[0].roster_score, 50.1);
  assert.equal(grouped.overviewRows[0].kills, 80);
  assert.equal(grouped.overviewRows[0].deaths, 41);
  assert.equal(grouped.overviewRows[0].differential, 39);
  assert.equal(grouped.overviewRows[0].pokemon_count, 2);
  assert.equal(grouped.overviewRows[0].roster_phase, "rueckrunde");
  assert.deepEqual(grouped.groups[0].pokemonRows.map((row) => row.pokemon), ["Zeraora"]);
}

{
  const normalizeTestKey = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const rosterPokemon = teamRosterPokemonRows(
    {
      killlists: [
        {
          season_id: "season_009",
          division: "Overall",
          team_name: "Alpha",
          trainer: "A",
          pokemon: "Pikachu",
          pokemon_normalized: "pikachu",
          appearances: "12",
          kills: "12",
          deaths: "12",
          data_status: "sheet_extracted",
        },
        {
          season_id: "season_009",
          division: "Overall",
          team_name: "Beta",
          trainer: "B",
          pokemon: "Pikachu",
          pokemon_normalized: "pikachu",
          appearances: "24",
          kills: "24",
          deaths: "24",
          data_status: "sheet_extracted",
        },
      ],
      pokemonDraftOverview: [{ pokemon: "Pikachu", pokemon_normalized: "pikachu", tier: "OU", tier_rank: "3", draft_count: "4", title_count: "0" }],
    },
    normalizeTestKey,
  );

  assert.equal(rosterPokemon[0].pokemon_score, rosterPokemon[1].pokemon_score);
}

{
  const elevenPokemon = Array.from({ length: 11 }, (_, index) => ({
    season_id: "season_010",
    division: "Playoffs",
    person: "Bene",
    team: "Wackel Backel",
    pokemon: `Pokemon ${index + 1}`,
    pokemon_score: 80,
    appearances: 4,
    kills: 10,
    deaths: 2,
    differential: 8,
    tier_rank: 5,
  }));
  const twentyTwoPokemon = [
    ...elevenPokemon,
    ...elevenPokemon.map((row, index) => ({
      ...row,
      pokemon: `Extra Pokemon ${index + 1}`,
    })),
  ];

  const baseline = teamRosterOverviewRows(elevenPokemon)[0];
  const scaled = teamRosterOverviewRows(twentyTwoPokemon)[0];

  assert.equal(scaled.pokemon_count, 22);
  assert.equal(scaled.appearances, baseline.appearances);
  assert.equal(scaled.kills, baseline.kills);
  assert.equal(scaled.deaths, baseline.deaths);
  assert.equal(scaled.differential, baseline.differential);
  assert.equal(scaled.roster_score, baseline.roster_score);
  assert.match(scaled.roster_flags, /auf 11 Pokémon skaliert/);
}
