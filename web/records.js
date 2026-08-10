// Pure helpers for the Rekorde group views (Rekordbuch, Auszeichnungen,
// Hall of Fame). All functions take already-loaded CSV rows and return
// plain data; rendering stays in app.js.
import { comparablePersonKey, normalizedStatsKey, numberValue } from "./stats.js";

const EXCLUDED_STATUS = new Set(["not_available", "source_video_only"]);

export function finderFilterRows(matches = [], rosterMatchdays = [], criteria = {}, normalizeKey = normalizedStatsKey) {
  const participant = normalizeKey(criteria.participant || "");
  const opponent = normalizeKey(criteria.opponent || "");
  const pokemon = normalizeKey(criteria.pokemon || "");

  let pokemonIndex = null;
  if (pokemon) {
    // (season, person, week) triples in which the Pokémon was brought.
    pokemonIndex = new Set();
    for (const row of rosterMatchdays) {
      if (normalizeKey(row.pokemon_normalized || row.pokemon) !== pokemon) continue;
      if (row.used === "0") continue;
      pokemonIndex.add(`${row.season_id}#${normalizeKey(row.person_name_normalized || row.person_name)}#${row.week}`);
    }
  }

  return matches.filter((row) => {
    if (EXCLUDED_STATUS.has(row.data_status)) return false;
    if (!row.player_a || !row.player_b) return false;
    if (criteria.season && criteria.season !== "all" && row.season_id !== criteria.season) return false;
    if (criteria.division && criteria.division !== "all" && (row.division || "") !== criteria.division) return false;
    if (criteria.stage && criteria.stage !== "all" && (row.stage || "") !== criteria.stage) return false;
    const aKey = normalizeKey(row.player_a);
    const bKey = normalizeKey(row.player_b);
    if (participant && aKey !== participant && bKey !== participant) return false;
    if (opponent) {
      const other = participant ? (aKey === participant ? bKey : aKey) : null;
      if (other !== null) {
        if (other !== opponent) return false;
      } else if (aKey !== opponent && bKey !== opponent) {
        return false;
      }
    }
    if (criteria.sweepsOnly) {
      const winnerKey = normalizeKey(row.winner);
      const winnerScore = winnerKey === aKey ? row.score_a : winnerKey === bKey ? row.score_b : "";
      if (String(winnerScore).trim() !== "6") return false;
    }
    if (pokemonIndex) {
      const week = row.week || "";
      const hasA = pokemonIndex.has(`${row.season_id}#${aKey}#${week}`);
      const hasB = pokemonIndex.has(`${row.season_id}#${bKey}#${week}`);
      if (!hasA && !hasB) return false;
      if (participant && !(participant === aKey ? hasA : hasB) && !(hasA || hasB)) return false;
    }
    return true;
  });
}

export function streakTableRows(streakRows = [], { streakType = "all" } = {}) {
  return streakRows
    .filter((row) => streakType === "all" || row.streak_type === streakType)
    .sort((a, b) => numberValue(b.length) - numberValue(a.length) || String(a.person_name).localeCompare(String(b.person_name)));
}

const HOF_TOP_N = 10;
const HOF_MIN_MATCHES = 40;
const HOF_MIN_WIN_PCT = 60;
const HOF_MIN_SEASONS = 8;
// Absolute floors keep the top-N cuts meaningful even in small pools.
const HOF_MIN_KILLS = 100;
const HOF_MIN_PEAK_ELO = 1600;

export function hofInductees({ personAllTime = [], champions = [], killlists = [], peaks = new Map() } = {}, normalizeKey = normalizedStatsKey) {
  const championKeys = new Set(
    champions
      .filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status))
      .map((row) => comparablePersonKey(row.champion_person_id || row.champion_name, normalizeKey)),
  );

  const killsCut = topCut(personAllTime.map((row) => numberValue(row.kills)), HOF_TOP_N);
  const peakOf = (row) => peaks.get(comparablePersonKey(row.person_id || row.person_name, normalizeKey)) ?? numberValue(row.elo);
  const peakCut = topCut(personAllTime.map((row) => peakOf(row)), HOF_TOP_N);

  const signature = signaturePokemonByPerson(killlists, normalizeKey);

  const inductees = [];
  for (const row of personAllTime) {
    const key = comparablePersonKey(row.person_id || row.person_name, normalizeKey);
    const criteria = [];
    if (championKeys.has(key)) criteria.push("champion");
    if (numberValue(row.seasons) >= HOF_MIN_SEASONS) criteria.push("seasons");
    if (numberValue(row.kills) >= Math.max(killsCut, HOF_MIN_KILLS)) criteria.push("kills");
    if (peaks.has(key) && peakOf(row) >= Math.max(peakCut, HOF_MIN_PEAK_ELO)) criteria.push("peak_elo");
    if (numberValue(row.matches) >= HOF_MIN_MATCHES && parseFloat(row.win_pct) >= HOF_MIN_WIN_PCT) criteria.push("win_pct");
    if (!criteria.length) continue;
    inductees.push({
      personId: row.person_id || key,
      name: row.person_name,
      criteria,
      signaturePokemon: signature.get(key) || "",
      peak: peaks.get(key) ?? null,
      stats: row,
    });
  }
  return inductees.sort(
    (a, b) =>
      numberValue(b.stats.seasons_won) - numberValue(a.stats.seasons_won) ||
      (b.peak ?? 0) - (a.peak ?? 0) ||
      String(a.name).localeCompare(String(b.name)),
  );
}

function topCut(values, n) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => b - a);
  if (!sorted.length) return Infinity;
  return sorted[Math.min(n, sorted.length) - 1];
}

function signaturePokemonByPerson(killlists, normalizeKey) {
  const totals = new Map();
  for (const row of killlists) {
    if (EXCLUDED_STATUS.has(row.data_status)) continue;
    const key = comparablePersonKey(row.trainer_normalized || row.trainer, normalizeKey);
    if (!key || !row.pokemon) continue;
    if (!totals.has(key)) totals.set(key, new Map());
    const perPokemon = totals.get(key);
    perPokemon.set(row.pokemon, (perPokemon.get(row.pokemon) ?? 0) + numberValue(row.kills));
  }
  const signature = new Map();
  for (const [key, perPokemon] of totals) {
    const best = [...perPokemon.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best && best[1] > 0) signature.set(key, best[0]);
  }
  return signature;
}

export function spoonRows(awards = []) {
  return awards.filter((row) => row.award_key === "holzloeffel");
}

export function awardsBySeason(awards = [], seasonId = "all") {
  if (seasonId === "all") return [...awards];
  return awards.filter((row) => row.season_id === seasonId);
}
