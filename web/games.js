// Shared game utilities: deterministic daily puzzles need a seedable RNG
// (mulberry32 over a string hash) so every visitor sees the same puzzle on
// the same day, and streaks survive reloads via plain serializable state.

export function seededRandom(seedString) {
  const text = String(seedString ?? "");
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(rng, length) {
  if (!length) return -1;
  return Math.min(length - 1, Math.floor(rng() * length));
}

export function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function dateSeedString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function previousDateString(dateString) {
  const parsed = Date.parse(`${dateString}T00:00:00Z`);
  return new Date(parsed - DAY_MS).toISOString().slice(0, 10);
}

export function updateDailyStreak(prev, dateString, solved) {
  const state = prev && typeof prev === "object" ? prev : { streak: 0, best: 0, lastDate: "" };
  if (state.lastDate === dateString) {
    return state;
  }
  if (!solved) {
    return { streak: 0, best: state.best || 0, lastDate: dateString };
  }
  const streak = state.lastDate === previousDateString(dateString) ? (state.streak || 0) + 1 : 1;
  return { streak, best: Math.max(state.best || 0, streak), lastDate: dateString };
}

// Kader-Raten: one deterministic daily puzzle. Pools are sorted by key so
// the seeded pick is stable across visitors regardless of CSV row order.
export function kaderPools(rosterRows = [], normalizeKey, minPokemon = 6) {
  const byKey = new Map();
  for (const row of rosterRows) {
    const personKey = normalizeKey(row.person_name);
    const pokemon = String(row.pokemon || "").trim();
    if (!personKey || !pokemon || !row.season_id) continue;
    const poolKey = `${row.season_id}__${row.division || ""}__${personKey}`;
    let pool = byKey.get(poolKey);
    if (!pool) {
      pool = {
        poolKey,
        seasonId: row.season_id,
        division: row.division || "",
        personName: row.person_name,
        personKey,
        teamName: row.team_name || "",
        pokemon: [],
        pokemonKeys: new Set(),
        sourceUrls: new Set(),
        sampleRow: row,
      };
      byKey.set(poolKey, pool);
    }
    const pokemonKey = normalizeKey(pokemon);
    if (!pool.pokemonKeys.has(pokemonKey)) {
      pool.pokemonKeys.add(pokemonKey);
      pool.pokemon.push(pokemon);
    }
    for (const url of String(row.source_urls || "").split(";")) {
      if (url.trim()) pool.sourceUrls.add(url.trim());
    }
  }
  return [...byKey.values()]
    .filter((pool) => pool.pokemon.length >= minPokemon)
    .map(({ pokemonKeys, sourceUrls, ...pool }) => ({ ...pool, sourceUrls: [...sourceUrls].join(";") }))
    .sort((a, b) => a.poolKey.localeCompare(b.poolKey));
}

export function dailyKader(pools, dateString) {
  if (!pools.length) return null;
  const rng = seededRandom(`kader-${dateString}`);
  const pool = pools[pickIndex(rng, pools.length)];
  const revealOrder = shuffled(pool.pokemon.map((_, index) => index), rng);
  return { pool, revealOrder };
}

// Tipp-Spiel: forfeits and unresolved results are excluded the same way the
// oracle skips them — there was no playable game to predict.
const TIPP_SKIPPED_BASIS = /forfeit|unresolved/;

export function tippCandidates(matches = [], normalizeKey) {
  return matches.filter((row) => {
    if (!row.player_a || !row.player_b) return false;
    if (TIPP_SKIPPED_BASIS.test(String(row.result_basis || ""))) return false;
    if (String(row.score_a ?? "") === "" || String(row.score_b ?? "") === "") return false;
    const winnerKey = normalizeKey(row.winner);
    return winnerKey === normalizeKey(row.player_a) || winnerKey === normalizeKey(row.player_b);
  });
}

export function pickTippRound(candidates = [], rng) {
  if (!candidates.length) return null;
  return candidates[pickIndex(rng, candidates.length)];
}

export function kaderHintValues(pool, standingsRows = [], normalizeKey) {
  const finalRow = standingsRows.find(
    (row) =>
      row.season_id === pool.seasonId &&
      (row.division || "") === pool.division &&
      String(row.is_primary) === "true" &&
      row.stage === "final_table" &&
      normalizeKey(row.player_name) === pool.personKey,
  );
  return { division: pool.division, rank: finalRow ? String(finalRow.rank ?? "") : "", seasonId: pool.seasonId };
}
