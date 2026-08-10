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

export function kaderPuzzle(pools, seedString) {
  if (!pools.length) return null;
  const rng = seededRandom(seedString);
  const pool = pools[pickIndex(rng, pools.length)];
  const revealOrder = shuffled(pool.pokemon.map((_, index) => index), rng);
  return { pool, revealOrder };
}

export function dailyKader(pools, dateString) {
  return kaderPuzzle(pools, `kader-${dateString}`);
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

// Klick-Duell: equal view counts have no right answer, so the next video
// must differ in count — resolved purely so the pick stays testable.
export function klickCandidates(videoRows = []) {
  return videoRows.filter((row) => row.video_id && row.title && Number(row.view_count) > 0);
}

export function nextKlickIndex(candidates = [], currentIndex, rng) {
  const currentCount = Number(candidates[currentIndex]?.view_count);
  const valid = candidates
    .map((row, index) => ({ row, index }))
    .filter(({ row, index }) => index !== currentIndex && Number(row.view_count) !== currentCount);
  if (!valid.length) return -1;
  return valid[pickIndex(rng, valid.length)].index;
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

// Quizshow: every question is generated from archive rows and carries the
// source_urls of the row(s) it was built from — the reveal always cites them.
export const QUIZ_CATEGORIES = ["champions", "standings", "killlists", "matchups"];

function championsQuestion(rows, rng) {
  const candidates = rows.filter((row) => row.champion_name && row.season_id);
  const names = [...new Set(candidates.map((row) => row.champion_name))];
  if (candidates.length < 1 || names.length < 4) return null;
  const row = candidates[pickIndex(rng, candidates.length)];
  const distractors = shuffled(names.filter((name) => name !== row.champion_name), rng).slice(0, 3);
  return {
    category: "champions",
    params: { season: row.season_id },
    options: shuffled(
      [{ label: row.champion_name, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

function standingsQuestion(rows, rng) {
  const finals = rows.filter((row) => String(row.is_primary) === "true" && row.stage === "final_table" && row.player_name);
  const tables = new Map();
  for (const row of finals) {
    const key = `${row.season_id}__${row.division}`;
    if (!tables.has(key)) tables.set(key, []);
    tables.get(key).push(row);
  }
  const bigTables = [...tables.values()]
    .filter((table) => table.length >= 4)
    .sort(
      (a, b) => a[0].season_id.localeCompare(b[0].season_id) || String(a[0].division).localeCompare(String(b[0].division)),
    );
  if (!bigTables.length) return null;
  const table = bigTables[pickIndex(rng, bigTables.length)];
  const topRows = table.filter((row) => Number(row.rank) >= 1 && Number(row.rank) <= 3);
  if (!topRows.length) return null;
  const row = topRows[pickIndex(rng, topRows.length)];
  const distractors = shuffled(table.filter((other) => other !== row).map((other) => other.player_name), rng).slice(0, 3);
  if (distractors.length < 3) return null;
  return {
    category: "standings",
    params: { rank: Number(row.rank), season: row.season_id, division: row.division },
    options: shuffled(
      [{ label: row.player_name, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

function killlistsQuestion(rows, rng) {
  const byTrainer = new Map();
  for (const row of rows) {
    if (!row.trainer || !row.pokemon || !Number.isFinite(Number(row.kills))) continue;
    const key = `${row.season_id}__${row.trainer}`;
    if (!byTrainer.has(key)) byTrainer.set(key, []);
    byTrainer.get(key).push(row);
  }
  const groups = [...byTrainer.values()]
    .filter((group) => group.length >= 4)
    .map((group) => [...group].sort((a, b) => Number(b.kills) - Number(a.kills)))
    .filter((group) => Number(group[0].kills) > Number(group[1].kills))
    .sort((a, b) => `${a[0].season_id}${a[0].trainer}`.localeCompare(`${b[0].season_id}${b[0].trainer}`));
  if (!groups.length) return null;
  const group = groups[pickIndex(rng, groups.length)];
  const top = group[0];
  const distractors = shuffled(group.slice(1).map((row) => row.pokemon), rng).slice(0, 3);
  return {
    category: "killlists",
    params: { trainer: top.trainer, season: top.season_id },
    options: shuffled(
      [{ label: top.pokemon, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: top.source_urls || "",
  };
}

function matchupsQuestion(rows, rng) {
  const decisive = rows.filter(
    (row) => row.person_id < row.opponent_id && Number(row.matches) >= 5 && Number(row.wins) !== Number(row.losses),
  );
  if (!decisive.length) return null;
  const row = decisive[pickIndex(rng, decisive.length)];
  const leader = Number(row.wins) > Number(row.losses) ? row.person_name : row.opponent_name;
  return {
    category: "matchups",
    params: { a: row.person_name, b: row.opponent_name, matches: Number(row.matches) },
    options: shuffled(
      [
        { label: row.person_name, correct: row.person_name === leader },
        { label: row.opponent_name, correct: row.opponent_name === leader },
      ],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

const QUIZ_GENERATORS = {
  champions: championsQuestion,
  standings: standingsQuestion,
  killlists: killlistsQuestion,
  matchups: matchupsQuestion,
};

export function quizQuestion(sources, category, rng) {
  const order = category === "all" ? shuffled(QUIZ_CATEGORIES, rng) : [category];
  for (const key of order) {
    const question = QUIZ_GENERATORS[key]?.(sources[key] || [], rng);
    if (question) return question;
  }
  return null;
}
