// Pure matchup-sheet computation for the Zeitmaschinen-Duell view. All
// gen-mechanical lookups go through an injected adapter so node tests run
// on literal fixtures and the browser can degrade to text badges when the
// @pkmn CDN bundles are unavailable. No DOM access.
import { pokemonAssetId } from "./pokemon_names.js";
import { rosterSeasonGeneration } from "./stats.js";

// Hinrunde and Rückrunde (and regular vs. playoffs) are DIFFERENT teams —
// every roster phase becomes its own selectable entry.
const PHASE_RANK = { "": 0, regular: 1, hinrunde: 2, rueckrunde: 3, playoffs: 4 };

// Rows may come straight from team_rosters.csv (person_name/team_name) or
// from the merged Kaderübersicht pipeline (person/team), which also covers
// the killlist-derived rosters of seasons 1 and 2.
export function teamDuelRosters(rosterRows = []) {
  const byKey = new Map();
  for (const row of rosterRows ?? []) {
    const seasonId = row.season_id || "";
    const personName = row.person_name || row.person || "";
    const teamName = row.team_name || row.team || "";
    const phase = row.roster_phase || "";
    if (!seasonId || (!personName && !teamName)) continue;
    const key = JSON.stringify([
      seasonId,
      row.division || "",
      phase,
      row.person_name_normalized || personName.toLowerCase(),
      row.team_name_normalized || teamName.toLowerCase(),
    ]);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        seasonId,
        division: row.division || "",
        phase,
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
      (PHASE_RANK[a.phase] ?? 5) - (PHASE_RANK[b.phase] ?? 5) ||
      (a.personName || a.teamName).localeCompare(b.personName || b.teamName, "de"),
  );
  return rosters;
}

const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];

// Damage-modifying abilities: full immunities plus the halving abilities
// (Thick Fat on Hariyama softens Fire and Ice). The actual set of a
// historic match is unknown, so any ability the species can have counts —
// the balance shows the roster's defensive potential.
const ABILITY_EFFECTS = {
  Levitate: [{ type: "Ground", kind: "immune" }],
  "Earth Eater": [{ type: "Ground", kind: "immune" }],
  "Flash Fire": [{ type: "Fire", kind: "immune" }],
  "Well-Baked Body": [{ type: "Fire", kind: "immune" }],
  "Water Absorb": [{ type: "Water", kind: "immune" }],
  "Storm Drain": [{ type: "Water", kind: "immune" }],
  "Dry Skin": [{ type: "Water", kind: "immune" }],
  "Volt Absorb": [{ type: "Electric", kind: "immune" }],
  "Lightning Rod": [{ type: "Electric", kind: "immune" }],
  "Motor Drive": [{ type: "Electric", kind: "immune" }],
  "Sap Sipper": [{ type: "Grass", kind: "immune" }],
  "Thick Fat": [
    { type: "Fire", kind: "resist" },
    { type: "Ice", kind: "resist" },
  ],
  Heatproof: [{ type: "Fire", kind: "resist" }],
  "Water Bubble": [{ type: "Fire", kind: "resist" }],
  "Purifying Salt": [{ type: "Ghost", kind: "resist" }],
};

function abilityEffectSets(abilities = []) {
  const sets = { immune: new Set(), resist: new Set() };
  for (const ability of abilities) {
    for (const effect of ABILITY_EFFECTS[ability] ?? []) {
      (effect.kind === "immune" ? sets.immune : sets.resist).add(effect.type);
    }
  }
  return sets;
}

function resolveSide(roster, gen) {
  if (!roster) return null;
  const mons = [];
  const unresolved = [];
  for (const name of roster.pokemon) {
    const species = gen?.species?.(pokemonAssetId(name)) ?? null;
    if (!species) {
      unresolved.push(name);
      mons.push({ name, english: "", types: [], baseStats: null, bst: null, abilityEffects: abilityEffectSets([]) });
      continue;
    }
    const bst = STAT_KEYS.reduce((sum, key) => sum + (species.baseStats[key] ?? 0), 0);
    mons.push({
      name,
      english: species.name,
      types: [...species.types],
      baseStats: { ...species.baseStats },
      bst,
      abilityEffects: abilityEffectSets(species.abilities ?? []),
    });
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
      const effects = mon.abilityEffects;
      if (effects.immune.has(type)) {
        immune += 1;
        continue;
      }
      let mult = gen.effectiveness(type, mon.types);
      if (effects.resist.has(type)) mult *= 0.5;
      if (mult === 0) {
        immune += 1;
        continue;
      }
      if (mult > 1) weak += 1;
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

// A hypothetical best-of-six lineup, chosen by what each pick OFFERS —
// against THIS opponent: hitting opposing Pokémon super-effectively and
// walling their STABs weigh in alongside covering weaknesses earlier
// picks left open, new resistances and fresh types; stacking a weakness
// costs points, being STAB-threatened costs points, and BST only breaks
// ties. Purely computed; renderers must label it as a simulation.
const SIX_WEIGHTS = { cover: 40, newResist: 15, freshType: 25, stackedWeak: 15, bstDivisor: 25, threat: 6, wall: 5, threatened: 4 };

function stabMultiplier(attackType, defender, gen) {
  if (defender.abilityEffects.immune.has(attackType)) return 0;
  let mult = gen.effectiveness(attackType, defender.types);
  if (defender.abilityEffects.resist.has(attackType)) mult *= 0.5;
  return mult;
}

// Both directions are evaluated under the candidate side's own generation —
// cross-era pairings have no canonical shared ruleset, so each side asks
// "how would this look under my rules?".
function opponentMatchup(candidate, opponents, gen) {
  const result = { threatens: 0, threatened: 0, walls: 0 };
  if (!gen) return result;
  for (const foe of opponents) {
    if (candidate.types.some((type) => stabMultiplier(type, foe, gen) > 1)) result.threatens += 1;
    const foeHits = foe.types.map((type) => stabMultiplier(type, candidate, gen));
    if (foeHits.some((mult) => mult > 1)) result.threatened += 1;
    else if (foeHits.length && foeHits.every((mult) => mult < 1)) result.walls += 1;
  }
  return result;
}

// Immunities count as resistances here: for team building both answer an
// attacking type, and certain ability effects are already folded in.
function defensiveProfile(mon, gen) {
  const weak = new Set();
  const resist = new Set();
  if (!gen?.typeNames || !mon.types.length) return { weak, resist };
  for (const type of gen.typeNames) {
    if (mon.abilityEffects.immune.has(type)) {
      resist.add(type);
      continue;
    }
    let mult = gen.effectiveness(type, mon.types);
    if (mon.abilityEffects.resist.has(type)) mult *= 0.5;
    if (mult > 1) weak.add(type);
    else if (mult < 1 || mult === 0) resist.add(type);
  }
  return { weak, resist };
}

export function hypotheticalSix(side, gen, opponentSide = null) {
  const empty = { picks: [], openWeaknesses: [] };
  if (!side) return empty;
  const opponents = (opponentSide?.mons ?? []).filter((mon) => mon.types.length);
  const pool = side.mons
    .filter((mon) => mon.baseStats)
    .map((mon) => ({ mon, ...defensiveProfile(mon, gen), matchup: opponentMatchup(mon, opponents, gen) }));
  if (!pool.length) return empty;
  const picks = [];
  const teamTypes = new Set();
  const teamResists = new Set();
  const teamWeakCounts = new Map();
  const openWeaknesses = () => [...teamWeakCounts.keys()].filter((type) => !teamResists.has(type));
  while (picks.length < 6 && pool.length) {
    const open = new Set(openWeaknesses());
    // Balance offense and defense: whichever of the two matchup dimensions
    // the lineup has accumulated less of gets boosted for the next pick,
    // so the six alternates attackers and walls instead of stacking one.
    const offenseSoFar = picks.reduce((sum, pick) => sum + pick.threatens, 0);
    const defenseSoFar = picks.reduce((sum, pick) => sum + pick.walls, 0);
    const threatWeight = SIX_WEIGHTS.threat * (offenseSoFar > defenseSoFar ? 0.5 : 1.5);
    const wallWeight = SIX_WEIGHTS.wall * (defenseSoFar > offenseSoFar ? 0.5 : 1.5);
    let best = null;
    let bestScore = -Infinity;
    for (const entry of pool) {
      const covers = [...entry.resist].filter((type) => open.has(type));
      const newResists = [...entry.resist].filter((type) => !teamResists.has(type) && !open.has(type));
      const fresh = entry.mon.types.filter((type) => !teamTypes.has(type));
      const stacked = [...entry.weak].filter((type) => (teamWeakCounts.get(type) ?? 0) >= 1).length;
      const score =
        covers.length * SIX_WEIGHTS.cover +
        newResists.length * SIX_WEIGHTS.newResist +
        fresh.length * SIX_WEIGHTS.freshType -
        stacked * SIX_WEIGHTS.stackedWeak +
        entry.matchup.threatens * threatWeight +
        entry.matchup.walls * wallWeight -
        entry.matchup.threatened * SIX_WEIGHTS.threatened +
        entry.mon.bst / SIX_WEIGHTS.bstDivisor;
      if (score > bestScore) {
        bestScore = score;
        best = { entry, covers, newResists, fresh };
      }
    }
    picks.push({
      mon: best.entry.mon,
      covers: best.covers,
      resists: best.newResists,
      fresh: best.fresh,
      threatens: best.entry.matchup.threatens,
      walls: best.entry.matchup.walls,
      threatened: best.entry.matchup.threatened,
    });
    for (const type of best.entry.mon.types) teamTypes.add(type);
    for (const type of best.entry.resist) teamResists.add(type);
    for (const type of best.entry.weak) teamWeakCounts.set(type, (teamWeakCounts.get(type) ?? 0) + 1);
    pool.splice(pool.indexOf(best.entry), 1);
  }
  return { picks, openWeaknesses: openWeaknesses() };
}

// The real head-to-head record behind a hypothetical pairing. Same-season
// pairs scope to that season's direct meetings (the true outcome of these
// rosters); cross-era pairs fall back to the career record between the two
// trainers. Winner-less rows count as draws, matching the reconstruction
// rules. Returns null when the two never met.
export function teamDuelActualOutcome(matches, keyA, keyB, seasonA, seasonB, normalizeKey) {
  const sameSeason = seasonA === seasonB;
  const meetings = [];
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  for (const row of matches ?? []) {
    const left = normalizeKey(row.player_a || "");
    const right = normalizeKey(row.player_b || "");
    const leftIsA = left === keyA && right === keyB;
    const rightIsA = left === keyB && right === keyA;
    if (!leftIsA && !rightIsA) continue;
    if (sameSeason && row.season_id !== seasonA) continue;
    const winnerKey = normalizeKey(row.winner || "");
    let result = "draw";
    if (winnerKey === keyA) {
      winsA += 1;
      result = "a";
    } else if (winnerKey === keyB) {
      winsB += 1;
      result = "b";
    } else {
      draws += 1;
    }
    meetings.push({
      seasonId: row.season_id || "",
      week: row.week || "",
      stage: row.stage || "",
      scoreA: leftIsA ? row.score_a || "" : row.score_b || "",
      scoreB: leftIsA ? row.score_b || "" : row.score_a || "",
      result,
      sourceUrls: row.source_urls || "",
    });
  }
  if (!meetings.length) return null;
  return { scope: sameSeason ? "season" : "career", meetings, winsA, winsB, draws };
}

// Era-correct rating: the person's Elo right after their last match in or
// before the chosen season — NOT today's all-time value. Season ids sort
// chronologically as strings (season_001 … season_010).
export function eloAtSeasonEnd(personKey, chronology, seasonId) {
  const person = chronology?.perPerson?.get?.(personKey);
  if (!person) return null;
  let rating = null;
  for (const point of person.points) {
    if ((point.seasonId || "").localeCompare(seasonId, "en") > 0) break;
    rating = point.rating;
  }
  return rating;
}

export function teamDuelOutcome(eloA, eloB) {
  if (!Number.isFinite(eloA) || !Number.isFinite(eloB)) return null;
  const pA = 1 / (1 + 10 ** ((eloB - eloA) / 400));
  return { eloA, eloB, pA, pB: 1 - pA };
}
