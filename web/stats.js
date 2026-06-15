export function numberValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function displayNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function killDifferential(kills, deaths) {
  return numberValue(kills) - numberValue(deaths);
}

export function winPercentageValue(wins, losses, draws) {
  const winCount = numberValue(wins);
  const total = winCount + numberValue(losses) + numberValue(draws);
  if (!total) {
    return null;
  }
  return (winCount / total) * 100;
}

export function winPercentage(wins, losses, draws) {
  const value = winPercentageValue(wins, losses, draws);
  return value === null ? "" : `${value.toFixed(1)}%`;
}

export function weightedRatingValue(wins, losses, draws, priorRate = 0.5, priorGames = 12) {
  const winCount = numberValue(wins);
  const drawCount = numberValue(draws);
  const total = winCount + numberValue(losses) + drawCount;
  if (!total) {
    return null;
  }
  return ((winCount + drawCount * 0.5 + priorRate * priorGames) / (total + priorGames)) * 100;
}

export function weightedRating(wins, losses, draws, priorRate = 0.5, priorGames = 12) {
  const value = weightedRatingValue(wins, losses, draws, priorRate, priorGames);
  return value === null ? "" : value.toFixed(1);
}

export function formatSeasonList(seasonIds = []) {
  return [...new Set(seasonIds.filter(Boolean))]
    .sort((a, b) => seasonNumber(a) - seasonNumber(b) || String(a).localeCompare(String(b)))
    .map((seasonId) => {
      const number = seasonNumber(seasonId);
      return Number.isFinite(number) && number < 999 ? `S${number}` : String(seasonId);
    })
    .join(", ");
}

export function aggregatePersonStats(statRows, championRows = []) {
  const aggregate = new Map();

  statRows
    .filter((row) => row.data_status !== "not_available")
    .forEach((row) => {
      const name = row.person_name || row.player_name || row.team_name || "Unknown";
      const key = row.person_id || normalizedStatsKey(name);
      if (!key) return;
      const current = aggregate.get(key) ?? {
        key,
        name,
        seasons: new Set(),
        teams: new Set(),
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        kills: 0,
        deaths: 0,
        differential: 0,
        bestRank: Number.POSITIVE_INFINITY,
        seasonsWon: new Set(),
        rows: 0,
      };
      current.name = current.name || name;
      if (row.season_id) current.seasons.add(row.season_id);
      if (row.team_name) current.teams.add(row.team_name);
      current.wins += numberValue(row.wins);
      current.losses += numberValue(row.losses);
      current.draws += numberValue(row.draws);
      current.points += numberValue(row.points);
      current.kills += numberValue(row.kills);
      current.deaths += numberValue(row.deaths);
      current.differential += numberValue(row.differential);
      current.bestRank = Math.min(current.bestRank, numberValue(row.rank) || Number.POSITIVE_INFINITY);
      current.rows += 1;
      aggregate.set(key, current);
    });

  championRows.forEach((row) => {
    const name = row.champion_name || "Unknown";
    const key = row.champion_person_id || normalizedStatsKey(name);
    if (!key) return;
    const current = aggregate.get(key) ?? {
      key,
      name,
      seasons: new Set(),
      teams: new Set(),
      wins: 0,
      losses: 0,
      draws: 0,
      points: 0,
      kills: 0,
      deaths: 0,
      differential: 0,
      bestRank: Number.POSITIVE_INFINITY,
      seasonsWon: new Set(),
      rows: 0,
    };
    if (row.season_id) {
      current.seasons.add(row.season_id);
      current.seasonsWon.add(row.season_id);
    }
    if (row.champion_team) current.teams.add(row.champion_team);
    aggregate.set(key, current);
  });

  return [...aggregate.values()]
    .sort(
      (a, b) =>
        b.seasonsWon.size - a.seasonsWon.size ||
        (weightedRatingValue(b.wins, b.losses, b.draws) ?? -1) - (weightedRatingValue(a.wins, a.losses, a.draws) ?? -1) ||
        b.points - a.points ||
        b.wins - a.wins ||
        a.name.localeCompare(b.name),
    )
    .map((row) => ({
      key: row.key,
      name: row.name,
      seasons_won: row.seasonsWon.size,
      title_seasons: formatSeasonList([...row.seasonsWon]),
      seasons: row.seasons.size,
      season_list: formatSeasonList([...row.seasons]),
      teams: row.teams.size,
      matches: row.wins + row.losses + row.draws,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      win_pct: winPercentage(row.wins, row.losses, row.draws),
      rating: weightedRating(row.wins, row.losses, row.draws),
      points: row.points,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      best_rank: Number.isFinite(row.bestRank) ? row.bestRank : "",
      rows: row.rows,
    }));
}

export function primaryCompetitionRows(rows, selectedDivision = "all") {
  if (selectedDivision !== "all") {
    return rows.filter((row) => row.division === selectedDivision);
  }
  const seasonsWithLeagueOne = new Set(rows.filter((row) => row.division === "Liga 1").map((row) => row.season_id));
  return rows.filter((row) => !(row.division === "Liga 2" && seasonsWithLeagueOne.has(row.season_id)));
}

export function seasonCoverageRows(data) {
  const seasons = data.seasons ?? [];
  return seasons.map((season) => {
    const seasonId = season.season_id;
    const standings = availableRows(data.standings, seasonId).length;
    const matches = availableRows(data.matches, seasonId).filter((row) => row.data_status !== "source_video_only").length;
    const championRows = availableRows(data.champions, seasonId).filter((row) => row.champion_name);
    const killlistRows = dataRows(data.killlists, seasonId);
    const availableKilllists = killlistRows.filter((row) => row.data_status !== "not_available").length;
    const unavailableKilllists = killlistRows.filter((row) => row.data_status === "not_available").length;
    const videos = (data.videos ?? []).filter((row) => row.detected_season_id === seasonId || row.season_id === seasonId);
    const matchedVideos = videos.filter((row) => row.match_status === "matched").length;
    const missing = [];
    if (!standings) missing.push("standings");
    if (!matches) missing.push("matches");
    if (!championRows.length) missing.push("champions");
    if (!availableKilllists) missing.push("killlists");
    const status = missing.length ? (standings || matches || championRows.length || availableKilllists || unavailableKilllists ? "partial" : "missing") : "complete";
    return {
      season_id: seasonId,
      season_label: season.season_label || seasonId,
      standings,
      matches,
      killlists: availableKilllists,
      unavailable_killlists: unavailableKilllists,
      champions: championRows.length,
      videos: videos.length,
      matched_videos: matchedVideos,
      coverage_status: status,
      missing_data: missing.join(", "),
      missing_source_urls: sourceUrls(killlistRows.filter((row) => row.data_status === "not_available")),
    };
  });
}

export function missingDataRows(data) {
  return seasonCoverageRows(data)
    .filter((row) => row.coverage_status !== "complete" || row.unavailable_killlists > 0)
    .map((row) => ({
      season_id: row.season_id,
      season_label: row.season_label,
      coverage_status: row.coverage_status,
      missing_data: row.missing_data,
      unavailable_killlists: row.unavailable_killlists,
      source_urls: row.missing_source_urls,
    }));
}

export function qualityRowsFromData(data) {
  if ((data.dataQuality ?? []).length) {
    return data.dataQuality;
  }
  return seasonCoverageRows(data);
}

export function sourceClaimsForSeason(rows = [], seasonId = "all") {
  return rows.filter((row) => seasonId === "all" || row.season_id === seasonId);
}

export function filterSourceClaims(rows = [], { season = "all", claimType = "all", search = "" } = {}) {
  const needle = String(search ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    const seasonOk = season === "all" || row.season_id === season;
    const typeOk = claimType === "all" || row.claim_type === claimType;
    const searchOk = !needle || Object.values(row).join(" ").toLowerCase().includes(needle);
    return seasonOk && typeOk && searchOk;
  });
}

const REVIEW_DATASET_BY_FILE = {
  "missing_killlists.csv": "missingKilllists",
  "missing_killlist_appearances.csv": "missingKilllistAppearances",
  "low_confidence_videos.csv": "lowConfidenceVideos",
  "ambiguous_matches.csv": "ambiguousMatches",
};

export function reviewWorkflowRows(data = {}) {
  return (data.reviewIndex ?? []).flatMap((queue) => {
    const rows = data[REVIEW_DATASET_BY_FILE[queue.review_file]] ?? [];
    return rows.map((row) => ({
      queue: queue.review_file,
      severity: queue.severity || "",
      review_reason: row.review_reason || queue.review_reason || "",
      correction_file: queue.correction_file || "",
      suggested_action: queue.suggested_action || "",
      season_id: row.season_id || row.detected_season_id || "",
      subject: row.title || row.pokemon || row.trainer || row.team_name || row.video_id || "",
      detail: row.detected_week ? `Spieltag ${row.detected_week}` : row.division || row.stage || row.match_basis || "",
      confidence: row.confidence || "",
      confidence_tier: row.confidence_tier || "",
      source_urls: row.source_urls || row.video_url || "",
    }));
  });
}

function dataRows(rows = [], seasonId) {
  return rows.filter((row) => row.season_id === seasonId);
}

function availableRows(rows = [], seasonId) {
  return dataRows(rows, seasonId).filter((row) => row.data_status !== "not_available");
}

function sourceUrls(rows) {
  const urls = new Set();
  rows.forEach((row) => addSourceUrls(urls, row.source_urls));
  return [...urls].join(";");
}

export function canonicalKilllistRows(rows, selectedDivision = "all") {
  if (selectedDivision !== "all") {
    return rows.filter((row) => row.division === selectedDivision);
  }

  const bySeason = new Map();
  rows.forEach((row) => {
    const season = row.season_id || "";
    const current = bySeason.get(season) ?? [];
    current.push(row);
    bySeason.set(season, current);
  });

  return [...bySeason.entries()].flatMap(([season, seasonRows]) => {
    const overallRows = seasonRows.filter((row) => row.division === "Overall");
    if (overallRows.length) {
      return overallRows;
    }
    const playoffRows = seasonRows.filter((row) => row.division === "Playoffs");
    if (season === "season_010" && playoffRows.length) {
      return [...playoffRows, ...regularOnlyKilllistRows(playoffRows, seasonRows)];
    }
    return seasonRows;
  });
}

export function personDetailKilllistRows(rows, selectedDivision = "all") {
  if (selectedDivision !== "all") {
    return rows.filter((row) => row.division === selectedDivision);
  }

  const bySeason = new Map();
  rows.forEach((row) => {
    const season = row.season_id || "";
    const current = bySeason.get(season) ?? [];
    current.push(row);
    bySeason.set(season, current);
  });

  return [...bySeason.entries()].flatMap(([season, seasonRows]) => {
    if (season === "season_009") {
      const splitRows = seasonRows.filter((row) => ["Singles", "Doubles"].includes(row.division));
      if (splitRows.length) {
        return splitRows;
      }
    }
    const playoffRows = seasonRows.filter((row) => row.division === "Playoffs");
    if (season === "season_010" && playoffRows.length) {
      return [...playoffRows, ...regularOnlyKilllistRows(playoffRows, seasonRows)];
    }
    return seasonRows;
  });
}

function regularOnlyKilllistRows(canonicalRows, seasonRows) {
  const canonicalPokemon = new Set(canonicalRows.map((row) => row.pokemon_normalized || normalizedStatsKey(row.pokemon)).filter(Boolean));
  return seasonRows.filter((row) => {
    if (row.division !== "Regular Season") return false;
    const key = row.pokemon_normalized || normalizedStatsKey(row.pokemon);
    return key && !canonicalPokemon.has(key);
  });
}

function normalizedStatsKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function seasonNumber(seasonId) {
  const match = String(seasonId ?? "").match(/season_0*(\d+)/);
  return match ? Number(match[1]) : 999;
}

function comparablePersonKey(value, normalizeKey = normalizedStatsKey) {
  const normalized = normalizeKey(value);
  return normalized.startsWith("person ") ? normalized.slice("person ".length) : normalized;
}

function addSourceUrls(target, value) {
  String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => target.add(item));
}

function addAggregate(target, key, row) {
  if (!key) return;
  const current = target.get(key) ?? { name: key, kills: 0, differential: 0 };
  current.kills += numberValue(row.kills);
  current.differential += killDifferential(row.kills, row.deaths);
  target.set(key, current);
}

function topAggregateName(target) {
  return (
    [...target.values()].sort((a, b) => b.kills - a.kills || b.differential - a.differential || a.name.localeCompare(b.name))[0]?.name || ""
  );
}

function teamOwnerIndex(rows, normalizeKey) {
  const index = new Map();
  rows
    .filter((row) => row.data_status !== "not_available")
    .forEach((row) => {
      const teamKey = normalizeKey(row.team_name);
      const personKey = comparablePersonKey(row.person_id || row.person_name, normalizeKey);
      if (!row.season_id || !row.division || !teamKey || !personKey) return;
      const key = `${row.season_id}\u0000${row.division}\u0000${teamKey}`;
      const current = index.get(key) ?? [];
      current.push({
        key: personKey,
        name: row.person_name || row.person_id || personKey,
      });
      index.set(key, current);
    });
  return index;
}

function rowOwners(row, ownersByTeam, normalizeKey) {
  const trainerKey = comparablePersonKey(row.trainer_normalized || row.trainer, normalizeKey);
  if (trainerKey) {
    return [{ key: trainerKey, name: row.trainer || row.trainer_normalized || trainerKey }];
  }
  const teamKey = normalizeKey(row.team_name);
  if (!row.season_id || !row.division || !teamKey) {
    return [];
  }
  return ownersByTeam.get(`${row.season_id}\u0000${row.division}\u0000${teamKey}`) ?? [];
}

export function summarizeKilllists(rows) {
  const aggregate = new Map();
  rows
    .filter((row) => row.data_status !== "not_available")
    .forEach((row) => {
      const key = row.pokemon_normalized || row.pokemon;
      if (!key) return;
      const current = aggregate.get(key) ?? {
        pokemon: row.pokemon,
        appearances: 0,
        kills: 0,
        deaths: 0,
        differential: 0,
        seasons: new Set(),
        trainers: new Set(),
        teams: new Set(),
      };
      current.appearances += numberValue(row.appearances);
      current.kills += numberValue(row.kills);
      current.deaths += numberValue(row.deaths);
      current.differential += killDifferential(row.kills, row.deaths);
      if (row.season_id) current.seasons.add(row.season_id);
      if (row.trainer) current.trainers.add(row.trainer);
      if (row.team_name) current.teams.add(row.team_name);
      aggregate.set(key, current);
    });

  return [...aggregate.values()]
    .sort((a, b) => b.kills - a.kills || b.differential - a.differential || a.pokemon.localeCompare(b.pokemon))
    .map((row, index) => ({
      rank: index + 1,
      pokemon: row.pokemon,
      appearances: row.appearances,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      seasons: row.seasons.size,
      season_list: formatSeasonList([...row.seasons]),
      trainers: row.trainers.size,
      teams: row.teams.size,
    }));
}

export function pokemonDraftOverviewRows(rows = [], { pickedStatus = "all", excludedTiers = [] } = {}) {
  const excludedTierValues = new Set(excludedTiers.map((tier) => String(tier ?? "").toLowerCase()));
  return rows
    .filter((row) => pickedStatus === "all" || row.picked_status === pickedStatus)
    .filter((row) => !excludedTierValues.has(String(row.tier ?? "").toLowerCase()))
    .map((row) => ({
      ...row,
      rank: numberValue(row.rank),
      tier_rank: numberValue(row.tier_rank),
      draft_count: numberValue(row.draft_count),
      season_count: numberValue(row.season_count),
      title_count: numberValue(row.title_count),
      trainer_count: numberValue(row.trainer_count),
      team_count: numberValue(row.team_count),
    }))
    .sort((a, b) => b.draft_count - a.draft_count || a.tier_rank - b.tier_rank || String(a.pokemon).localeCompare(String(b.pokemon)))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function pokemonTitleIndex(rows = [], normalizeKey = normalizedStatsKey) {
  const index = new Map();
  rows.forEach((row) => {
    const info = {
      titles: numberValue(row.title_count ?? row.titles),
      title_seasons: row.title_seasons || "",
    };
    [row.pokemon_normalized, row.pokemon, row.asset_id, row.english].forEach((value) => {
      addPokemonTitleAlias(index, value, info, normalizeKey);
    });
  });
  return index;
}

function addPokemonTitleAlias(index, value, info, normalizeKey) {
  const key = normalizeKey(value);
  if (!key) return;
  const compactKey = compactStatsKey(key);
  setPokemonTitleInfo(index, key, info);
  setPokemonTitleInfo(index, compactKey, info);
}

function setPokemonTitleInfo(index, key, info) {
  const current = index.get(key);
  if (!current || info.titles > current.titles || (!current.title_seasons && info.title_seasons)) {
    index.set(key, info);
  }
}

function pokemonTitleInfo(index, value, normalizeKey = normalizedStatsKey) {
  const key = normalizeKey(value);
  return index.get(key) || index.get(compactStatsKey(key)) || { titles: 0, title_seasons: "" };
}

function compactStatsKey(value) {
  return String(value ?? "").replace(/\s+/g, "");
}

export function summarizeTrainerPokemon(rows, selectedPersonKey = "", normalizeKey = normalizedStatsKey, ownershipRows = []) {
  const aggregate = new Map();
  const selectedKey = comparablePersonKey(selectedPersonKey, normalizeKey);
  const ownersByTeam = teamOwnerIndex(ownershipRows, normalizeKey);

  rows
    .filter((row) => row.data_status !== "not_available")
    .forEach((row) => {
      const pokemonKey = row.pokemon_normalized || normalizedStatsKey(row.pokemon);
      if (!pokemonKey) return;

      rowOwners(row, ownersByTeam, normalizeKey).forEach((owner) => {
        if (!owner.key || (selectedKey && owner.key !== selectedKey)) return;

        const key = `${owner.key}\u0000${pokemonKey}`;
        const current = aggregate.get(key) ?? {
          trainer: owner.name,
          pokemon: row.pokemon,
          appearances: 0,
          kills: 0,
          deaths: 0,
          differential: 0,
          seasons: new Set(),
          divisions: new Set(),
          teams: new Set(),
          sourceUrls: new Set(),
        };
        current.trainer = current.trainer || owner.name;
        current.pokemon = current.pokemon || row.pokemon || row.pokemon_normalized || "";
        current.appearances += numberValue(row.appearances);
        current.kills += numberValue(row.kills);
        current.deaths += numberValue(row.deaths);
        current.differential += killDifferential(row.kills, row.deaths);
        if (row.season_id) current.seasons.add(row.season_id);
        if (row.division) current.divisions.add(row.division);
        if (row.team_name) current.teams.add(row.team_name);
        addSourceUrls(current.sourceUrls, row.source_urls);
        aggregate.set(key, current);
      });
    });

  return [...aggregate.values()]
    .sort((a, b) => b.kills - a.kills || b.differential - a.differential || a.pokemon.localeCompare(b.pokemon))
    .map((row) => ({
      trainer: row.trainer,
      pokemon: row.pokemon,
      appearances: row.appearances,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      seasons: row.seasons.size,
      season_list: formatSeasonList([...row.seasons]),
      divisions: row.divisions.size,
      teams: row.teams.size,
      source_urls: [...row.sourceUrls].join(";"),
    }));
}

export function personPokemonHighlights(rows, selectedPersonKey = "", normalizeKey = normalizedStatsKey, ownershipRows = []) {
  return summarizeTrainerPokemon(rows, selectedPersonKey, normalizeKey, ownershipRows).slice(0, 12);
}

export function personStorySummary(statRows = [], championRows = [], pokemonRows = [], selectedPersonKey = "", normalizeKey = normalizedStatsKey) {
  const selectedKey = comparablePersonKey(selectedPersonKey, normalizeKey);
  const rows = statRows.filter((row) => comparablePersonKey(row.person_id || row.person_name || row.player_name, normalizeKey) === selectedKey);
  const titleRows = championRows.filter((row) => comparablePersonKey(row.champion_person_id || row.champion_name, normalizeKey) === selectedKey);
  const best = rows
    .map((row) => ({
      row,
      ratingValue: weightedRatingValue(row.wins, row.losses, row.draws) ?? -1,
    }))
    .sort((a, b) => b.ratingValue - a.ratingValue || numberValue(b.row.points) - numberValue(a.row.points))[0];
  const signature = [...pokemonRows].sort((a, b) => numberValue(b.kills) - numberValue(a.kills) || numberValue(b.differential) - numberValue(a.differential))[0];
  const person = rows[0]?.person_name || rows[0]?.player_name || titleRows[0]?.champion_name || "";
  return {
    person,
    seasons: new Set(rows.map((row) => row.season_id).filter(Boolean)).size,
    season_list: formatSeasonList(rows.map((row) => row.season_id)),
    title_seasons: formatSeasonList(titleRows.map((row) => row.season_id)),
    best_season: best?.row?.season_id ? formatSeasonList([best.row.season_id]) : "",
    best_record: best?.row ? `${numberValue(best.row.wins)}-${numberValue(best.row.losses)}-${numberValue(best.row.draws)}` : "",
    best_rating: best?.row ? weightedRating(best.row.wins, best.row.losses, best.row.draws) : "",
    signature_pokemon: signature?.pokemon || "",
  };
}

export function pokemonTimelineRows(rows, selectedPokemonKey, normalizeKey = normalizedStatsKey) {
  const selectedKey = normalizeKey(selectedPokemonKey);
  const aggregate = new Map();

  rows
    .filter((row) => row.data_status !== "not_available")
    .filter((row) => normalizeKey(row.pokemon_normalized || row.pokemon) === selectedKey)
    .forEach((row) => {
      const seasonId = row.season_id || "";
      if (!seasonId) return;
      const current = aggregate.get(seasonId) ?? {
        season_id: seasonId,
        divisions: new Set(),
        appearances: 0,
        kills: 0,
        deaths: 0,
        differential: 0,
        trainers: new Set(),
        teams: new Set(),
      };
      current.appearances += numberValue(row.appearances);
      current.kills += numberValue(row.kills);
      current.deaths += numberValue(row.deaths);
      current.differential += killDifferential(row.kills, row.deaths);
      if (row.division) current.divisions.add(row.division);
      if (row.trainer) current.trainers.add(row.trainer);
      if (row.team_name) current.teams.add(row.team_name);
      aggregate.set(seasonId, current);
    });

  return [...aggregate.values()]
    .sort((a, b) => String(a.season_id).localeCompare(String(b.season_id)))
    .map((row) => ({
      season_id: row.season_id,
      divisions: [...row.divisions].sort().join("; "),
      appearances: row.appearances,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      trainers: row.trainers.size,
      teams: row.teams.size,
    }));
}

export function pokemonStorySummary(rows = [], selectedPokemonKey, normalizeKey = normalizedStatsKey, titleIndex = new Map()) {
  const selectedKey = normalizeKey(selectedPokemonKey);
  const titles = pokemonTitleInfo(titleIndex, selectedKey, normalizeKey);
  const filtered = rows
    .filter((row) => row.data_status !== "not_available")
    .filter((row) => normalizeKey(row.pokemon_normalized || row.pokemon) === selectedKey);
  const trainers = new Map();
  const seasons = new Map();
  const teams = new Map();
  let pokemon = "";
  filtered.forEach((row) => {
    pokemon = pokemon || row.pokemon || row.pokemon_normalized || selectedPokemonKey;
    addAggregate(trainers, row.trainer || "", row);
    addAggregate(seasons, row.season_id || "", row);
    addAggregate(teams, row.team_name || "", row);
  });
  return {
    pokemon,
    seasons: new Set(filtered.map((row) => row.season_id).filter(Boolean)).size,
    season_list: formatSeasonList(filtered.map((row) => row.season_id)),
    titles: titles.titles,
    title_seasons: titles.title_seasons,
    best_trainer: topAggregateName(trainers),
    best_season: formatSeasonList([topAggregateName(seasons)]),
    top_team: topAggregateName(teams),
  };
}

export function summarizePokemonDetail(rows, selectedPokemonKey, normalizeKey = normalizedStatsKey, ownershipRows = []) {
  const selectedKey = normalizeKey(selectedPokemonKey);
  const ownersByTeam = teamOwnerIndex(ownershipRows, normalizeKey);
  const summary = {
    pokemon: "",
    appearances: 0,
    kills: 0,
    deaths: 0,
    differential: 0,
    seasons: new Set(),
    trainers: new Set(),
    teams: new Set(),
    sourceUrls: new Set(),
  };
  const trainers = new Map();
  const seasonRows = [];

  rows
    .filter((row) => row.data_status !== "not_available")
    .filter((row) => normalizeKey(row.pokemon_normalized || row.pokemon) === selectedKey)
    .forEach((row) => {
      const owners = rowOwners(row, ownersByTeam, normalizeKey);
      const ownerList = owners.length ? owners : [{ key: "", name: row.trainer || "" }];
      const kills = numberValue(row.kills);
      const appearances = numberValue(row.appearances);
      const deaths = numberValue(row.deaths);
      const differential = killDifferential(row.kills, row.deaths);
      summary.pokemon = summary.pokemon || row.pokemon || row.pokemon_normalized || selectedPokemonKey;
      summary.appearances += appearances;
      summary.kills += kills;
      summary.deaths += deaths;
      summary.differential += differential;
      if (row.season_id) summary.seasons.add(row.season_id);
      if (row.team_name) summary.teams.add(row.team_name);
      addSourceUrls(summary.sourceUrls, row.source_urls);

      ownerList.forEach((owner) => {
        if (owner.name) summary.trainers.add(owner.name);
        const trainerKey = owner.key || comparablePersonKey(owner.name, normalizeKey);
        if (!trainerKey) return;
        const current = trainers.get(trainerKey) ?? {
          trainer: owner.name,
          appearances: 0,
          kills: 0,
          deaths: 0,
          differential: 0,
          seasons: new Set(),
          teams: new Set(),
        };
        current.trainer = current.trainer || owner.name;
        current.appearances += appearances;
        current.kills += kills;
        current.deaths += deaths;
        current.differential += differential;
        if (row.season_id) current.seasons.add(row.season_id);
        if (row.team_name) current.teams.add(row.team_name);
        trainers.set(trainerKey, current);
      });

      seasonRows.push({
        season_id: row.season_id,
        division: row.division,
        trainer: ownerList.map((owner) => owner.name).filter(Boolean).join("; "),
        team_name: row.team_name,
        appearances,
        kills,
        deaths,
        differential,
        source_urls: row.source_urls || "",
      });
    });

  return {
    summary: {
      pokemon: summary.pokemon,
      appearances: summary.appearances,
      kills: summary.kills,
      deaths: summary.deaths,
      differential: summary.differential,
      seasons: summary.seasons.size,
      trainers: summary.trainers.size,
      teams: summary.teams.size,
      source_urls: [...summary.sourceUrls].join(";"),
    },
    trainerRows: [...trainers.values()]
      .sort((a, b) => b.kills - a.kills || b.differential - a.differential || a.trainer.localeCompare(b.trainer))
      .map((row) => ({
        trainer: row.trainer,
        appearances: row.appearances,
        kills: row.kills,
        deaths: row.deaths,
        differential: row.differential,
        seasons: row.seasons.size,
        season_list: formatSeasonList([...row.seasons]),
        teams: row.teams.size,
      })),
    seasonRows: seasonRows.sort((a, b) => String(a.season_id || "").localeCompare(String(b.season_id || "")) || String(a.division || "").localeCompare(String(b.division || ""))),
  };
}

export function matchupOverview(matches, selectedKey, normalizeKey) {
  const opponents = new Map();
  matches.forEach((row) => {
    const leftKey = normalizeKey(row.player_a || row.team_a);
    const rightKey = normalizeKey(row.player_b || row.team_b);
    if (!leftKey || !rightKey || (leftKey !== selectedKey && rightKey !== selectedKey)) {
      return;
    }
    const opponentKey = leftKey === selectedKey ? rightKey : leftKey;
    const opponentName = leftKey === selectedKey ? row.player_b || row.team_b : row.player_a || row.team_a;
    const current = opponents.get(opponentKey) ?? {
      opponent: opponentName,
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    const winner = normalizeKey(row.winner);
    current.matches += 1;
    if (winner === selectedKey) {
      current.wins += 1;
    } else if (winner === opponentKey) {
      current.losses += 1;
    } else {
      current.draws += 1;
    }
    opponents.set(opponentKey, current);
  });

  return [...opponents.values()]
    .map((row) => ({ ...row, win_pct: winPercentage(row.wins, row.losses, row.draws) }))
    .sort((a, b) => numberValue(b.win_pct) - numberValue(a.win_pct) || b.matches - a.matches || a.opponent.localeCompare(b.opponent));
}
