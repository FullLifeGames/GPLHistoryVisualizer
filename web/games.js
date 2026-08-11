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
  const pools = [...byKey.values()]
    .filter((pool) => pool.pokemon.length >= minPokemon)
    .map(({ pokemonKeys, sourceUrls, ...pool }) => ({ ...pool, sourceUrls: [...sourceUrls].join(";") }))
    .sort((a, b) => a.poolKey.localeCompare(b.poolKey));
  // Tag-Saisons (S9) teilen einen Kader zwischen Singles- und Doubles-Partner:
  // jede Person mit demselben Team in derselben Saison zählt als richtige
  // Antwort auf diesen Kader.
  const byTeam = new Map();
  for (const pool of pools) {
    const teamKey = normalizeKey(pool.teamName);
    if (!teamKey) continue;
    const groupKey = `${pool.seasonId}__${teamKey}`;
    if (!byTeam.has(groupKey)) byTeam.set(groupKey, []);
    byTeam.get(groupKey).push(pool);
  }
  for (const pool of pools) {
    const teamKey = normalizeKey(pool.teamName);
    const mates = teamKey ? byTeam.get(`${pool.seasonId}__${teamKey}`) || [pool] : [pool];
    pool.acceptedKeys = [...new Set(mates.map((mate) => mate.personKey))];
    pool.acceptedNames = [...new Set(mates.map((mate) => mate.personName))];
  }
  return pools;
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

// Stats duel (Klick-Duell mode): compare two careers on a random stat. Only
// people with all stats recorded qualify, and both sides must differ so the
// question always has one right answer.
export const STATS_DUEL_STATS = ["kills", "wins", "matches", "seasons"];

export function statsDuelCandidates(rows = []) {
  return rows.filter(
    (row) => row.person_name && STATS_DUEL_STATS.every((stat) => String(row[stat] ?? "") !== "" && Number.isFinite(Number(row[stat]))),
  );
}

export function statsDuelRound(candidates = [], rng) {
  if (candidates.length < 2) return null;
  for (const stat of shuffled(STATS_DUEL_STATS, rng)) {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const i = pickIndex(rng, candidates.length);
      let j = pickIndex(rng, candidates.length);
      if (j === i) j = (j + 1) % candidates.length;
      const a = candidates[i];
      const b = candidates[j];
      if (Number(a[stat]) !== Number(b[stat])) {
        return { stat, a, b };
      }
    }
  }
  return null;
}

// "Wer bin ich?": staged career riddle over the all-time table. Short
// careers are excluded — with three matches there is nothing to riddle.
export function personRiddleCandidates(allTimeRows = [], minMatches = 10) {
  return allTimeRows.filter((row) => row.person_name && Number(row.matches) >= minMatches);
}

export function personRiddleRound(candidates = [], rng) {
  if (!candidates.length) return null;
  return candidates[pickIndex(rng, candidates.length)];
}

// Hints ordered least to most revealing; ids resolve to i18n templates.
// Team lists are near-unique identifiers, so they come second to last —
// only the name's first letter gives more away.
export function personRiddleHints(row, stintsRows = [], normalizeKey) {
  const personKey = normalizeKey(row.person_name);
  const teams = [];
  const seenTeams = new Set();
  for (const stint of stintsRows) {
    if (normalizeKey(stint.person_name) !== personKey || !stint.team_name) continue;
    const teamKey = normalizeKey(stint.team_name);
    if (seenTeams.has(teamKey)) continue;
    seenTeams.add(teamKey);
    teams.push(stint.team_name);
  }
  const titles = Number(row.seasons_won) || 0;
  const hints = [
    { id: "activity", params: { seasons: Number(row.seasons) || 0, matches: Number(row.matches) || 0 } },
    { id: "kills", params: { kills: Number(row.kills) || 0, wins: Number(row.wins) || 0 } },
    { id: "peak", params: { elo: Number(row.elo) || 0, rank: String(row.best_rank ?? "") } },
    titles > 0 ? { id: "titles", params: { count: titles, seasons: row.title_seasons || "" } } : { id: "noTitles", params: {} },
  ];
  if (teams.length) {
    hints.push({ id: "teams", params: { teams: teams.join(", ") } });
  }
  hints.push({ id: "initial", params: { letter: String(row.person_name || "?").slice(0, 1).toUpperCase() } });
  return hints;
}

// Quizshow: every question is generated from archive rows and carries the
// source_urls of the row(s) it was built from — the reveal always cites them.
export const QUIZ_CATEGORIES = ["champions", "standings", "killlists", "drafts", "matchups"];

function championsCandidates(rows) {
  const candidates = rows.filter((row) => row.champion_name && row.season_id);
  const names = [...new Set(candidates.map((row) => row.champion_name))];
  return names.length >= 4 ? candidates : [];
}

function standingsCandidates(rows) {
  const finals = rows.filter((row) => String(row.is_primary) === "true" && row.stage === "final_table" && row.player_name);
  const tables = new Map();
  for (const row of finals) {
    const key = `${row.season_id}__${row.division}`;
    if (!tables.has(key)) tables.set(key, []);
    tables.get(key).push(row);
  }
  const candidates = [];
  const bigTables = [...tables.values()]
    .filter((table) => table.length >= 4)
    .sort(
      (a, b) => a[0].season_id.localeCompare(b[0].season_id) || String(a[0].division).localeCompare(String(b[0].division)),
    );
  for (const table of bigTables) {
    for (const row of table) {
      if (Number(row.rank) >= 1 && Number(row.rank) <= 3) candidates.push({ row, table });
    }
  }
  return candidates;
}

function killlistsCandidates(rows) {
  const byTrainer = new Map();
  for (const row of rows) {
    if (!row.trainer || !row.pokemon || !Number.isFinite(Number(row.kills))) continue;
    const key = `${row.season_id}__${row.trainer}`;
    if (!byTrainer.has(key)) byTrainer.set(key, []);
    byTrainer.get(key).push(row);
  }
  return [...byTrainer.values()]
    .filter((group) => group.length >= 4)
    .map((group) => [...group].sort((a, b) => Number(b.kills) - Number(a.kills)))
    .filter((group) => Number(group[0].kills) > Number(group[1].kills))
    .sort((a, b) => `${a[0].season_id}${a[0].trainer}`.localeCompare(`${b[0].season_id}${b[0].trainer}`));
}

function matchupsCandidates(rows) {
  return rows.filter(
    (row) => row.person_id < row.opponent_id && Number(row.matches) >= 5 && Number(row.wins) !== Number(row.losses),
  );
}

function draftsCandidates(rows) {
  return rows.filter((row) => row.pokemon && row.person_name && row.season_id);
}

function championsQuestion(rows, rng) {
  const candidates = championsCandidates(rows);
  if (!candidates.length) return null;
  const names = [...new Set(candidates.map((row) => row.champion_name))];
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
  const candidates = standingsCandidates(rows);
  if (!candidates.length) return null;
  const { row, table } = candidates[pickIndex(rng, candidates.length)];
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
  const groups = killlistsCandidates(rows);
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
  const decisive = matchupsCandidates(rows);
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

function draftsQuestion(rows, rng) {
  const candidates = draftsCandidates(rows);
  if (!candidates.length) return null;
  const row = candidates[pickIndex(rng, candidates.length)];
  const others = [
    ...new Set(
      candidates
        .filter((other) => other.season_id === row.season_id && other.person_name !== row.person_name)
        .map((other) => other.person_name),
    ),
  ];
  const distractors = shuffled(others, rng).slice(0, 3);
  if (distractors.length < 3) return null;
  return {
    category: "drafts",
    params: { pokemon: row.pokemon, season: row.season_id },
    options: shuffled(
      [{ label: row.person_name, correct: true }, ...distractors.map((label) => ({ label, correct: false }))],
      rng,
    ),
    sourceUrls: row.source_urls || "",
  };
}

const QUIZ_GENERATORS = {
  champions: championsQuestion,
  standings: standingsQuestion,
  killlists: killlistsQuestion,
  drafts: draftsQuestion,
  matchups: matchupsQuestion,
};

const QUIZ_CANDIDATES = {
  champions: championsCandidates,
  standings: standingsCandidates,
  killlists: killlistsCandidates,
  drafts: draftsCandidates,
  matchups: matchupsCandidates,
};

export function quizPoolSizes(sources = {}) {
  const sizes = {};
  for (const key of QUIZ_CATEGORIES) {
    sizes[key] = QUIZ_CANDIDATES[key](sources[key] || []).length;
  }
  return sizes;
}

// "Alle" draws categories proportionally to the square root of their pool
// size: small pools (champions has one row per season) still appear, just
// clearly less often than the hundreds of killlist questions.
export function weightedQuizCategory(sources, rng) {
  const sizes = quizPoolSizes(sources);
  const entries = QUIZ_CATEGORIES.map((key) => ({ key, weight: Math.sqrt(sizes[key] || 0) })).filter(
    (entry) => entry.weight > 0,
  );
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.key;
  }
  return entries[entries.length - 1].key;
}

export function quizQuestion(sources, category, rng) {
  if (category === "all") {
    const picked = weightedQuizCategory(sources, rng);
    if (!picked) return null;
    const question = QUIZ_GENERATORS[picked](sources[picked] || [], rng);
    if (question) return question;
  }
  const order = category === "all" ? shuffled(QUIZ_CATEGORIES, rng) : [category];
  for (const key of order) {
    const question = QUIZ_GENERATORS[key]?.(sources[key] || [], rng);
    if (question) return question;
  }
  return null;
}
