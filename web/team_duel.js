// Pure matchup-sheet computation for the Zeitmaschinen-Duell view. All
// gen-mechanical lookups go through an injected adapter so node tests run
// on literal fixtures and the browser can degrade to text badges when the
// @pkmn CDN bundles are unavailable. No DOM access.
import { pokemonAssetId } from "./pokemon_names.js";
import { rosterSeasonGeneration } from "./stats.js";

export function teamDuelRosters(teamRosters = []) {
  const byKey = new Map();
  for (const row of teamRosters ?? []) {
    const seasonId = row.season_id || "";
    const personName = row.person_name || "";
    const teamName = row.team_name || "";
    if (!seasonId || (!personName && !teamName)) continue;
    const key = JSON.stringify([
      seasonId,
      row.division || "",
      row.person_name_normalized || personName.toLowerCase(),
      row.team_name_normalized || teamName.toLowerCase(),
    ]);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        seasonId,
        division: row.division || "",
        teamName,
        personName,
        pokemon: [],
        seen: new Set(),
        sourceUrls: row.source_urls || "",
      });
    }
    const entry = byKey.get(key);
    const mon = row.pokemon || "";
    const monKey = row.pokemon_normalized || mon.toLowerCase();
    if (!mon || entry.seen.has(monKey)) continue;
    entry.seen.add(monKey);
    entry.pokemon.push(mon);
  }
  const rosters = [...byKey.values()].filter((entry) => entry.pokemon.length);
  for (const entry of rosters) delete entry.seen;
  rosters.sort(
    (a, b) =>
      a.seasonId.localeCompare(b.seasonId, "en") ||
      a.division.localeCompare(b.division, "de") ||
      (a.personName || a.teamName).localeCompare(b.personName || b.teamName, "de"),
  );
  return rosters;
}

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

function resolveSide(roster, gen) {
  if (!roster) return null;
  const mons = [];
  const unresolved = [];
  for (const name of roster.pokemon) {
    const species = gen?.species?.(pokemonAssetId(name)) ?? null;
    if (!species) {
      unresolved.push(name);
      mons.push({ name, english: "", types: [], baseStats: null, bst: null });
      continue;
    }
    const bst = STAT_KEYS.reduce((sum, key) => sum + (species.baseStats[key] ?? 0), 0);
    mons.push({ name, english: species.name, types: [...species.types], baseStats: { ...species.baseStats }, bst });
  }
  const rated = mons.filter((mon) => mon.baseStats);
  const averages = rated.length
    ? Object.fromEntries(STAT_KEYS.map((key) => [key, Math.round(rated.reduce((sum, mon) => sum + mon.baseStats[key], 0) / rated.length)]))
    : null;
  const avgBst = rated.length ? Math.round(rated.reduce((sum, mon) => sum + mon.bst, 0) / rated.length) : null;
  mons.sort((a, b) => (b.bst ?? -1) - (a.bst ?? -1) || a.name.localeCompare(b.name, "de"));
  return { roster, gen: rosterSeasonGeneration(roster.seasonId), mons, unresolved, averages, avgBst };
}

function typeProfile(side, gen) {
  if (!side || !gen?.typeNames) return null;
  return gen.typeNames.map((type) => {
    let weak = 0;
    let resist = 0;
    let immune = 0;
    for (const mon of side.mons) {
      if (!mon.types.length) continue;
      const mult = gen.effectiveness(type, mon.types);
      if (mult === 0) immune += 1;
      else if (mult > 1) weak += 1;
      else if (mult < 1) resist += 1;
    }
    return { type, weak, resist, immune };
  });
}

function speedTierList(sideA, sideB) {
  const entries = [];
  for (const [side, data] of [["a", sideA], ["b", sideB]]) {
    for (const mon of data?.mons ?? []) {
      if (mon.baseStats) entries.push({ side, name: mon.name, english: mon.english, speed: mon.baseStats.spe });
    }
  }
  entries.sort((a, b) => b.speed - a.speed || a.name.localeCompare(b.name, "de"));
  return entries;
}

export function teamDuelSheet({ rosterA = null, rosterB = null, genA = null, genB = null } = {}) {
  const a = resolveSide(rosterA, genA);
  const b = resolveSide(rosterB, genB);
  return {
    a,
    b,
    differentGens:
      Boolean(rosterA && rosterB) && rosterSeasonGeneration(rosterA.seasonId) !== rosterSeasonGeneration(rosterB.seasonId),
    degraded: !genA || !genB,
    speedTiers: speedTierList(a, b),
    typeMatrix: { a: typeProfile(a, genA), b: typeProfile(b, genB) },
  };
}
