import { canonicalKilllistRows, compareMatchChronology, eloRatings, matchWeekOrder, normalizedStatsKey, numberValue } from "./stats.js";

// Pure data layer for the Zeitreise view. No DOM, no d3 — everything here is
// exercised by tests/web_timeline.test.mjs under `node --test`.

const EXCLUDED_MATCH_STATUSES = new Set(["source_video_only", "not_available"]);

const PLAYOFF_PHASE_BY_ORDER = new Map([
  [100, "vorrunde"],
  [110, "viertelfinale"],
  [120, "halbfinale"],
  [130, "platz3"],
  [140, "finale"],
  [150, "playoffs"],
]);

const POINTS_PER_WIN = 3;
const POINTS_PER_DRAW = 1;

// The 514 `video_source` rows carry a video id but no players, no score and no
// winner — they are video pointers, not battles, and must never reach the
// timeline. Same filter as availableMatchRows() in app.js.
export function isTimelineMatch(row = {}) {
  if (EXCLUDED_MATCH_STATUSES.has(row.data_status)) return false;
  return Boolean(row.player_a || row.team_a) && Boolean(row.player_b || row.team_b);
}

function participantKeys(row) {
  return [normalizedStatsKey(row.player_a || row.team_a), normalizedStatsKey(row.player_b || row.team_b)];
}

function tickKey(row) {
  return `${row.season_id}#${matchWeekOrder(row)}`;
}

export function buildTimeline(matches = []) {
  const rows = matches.filter(isTimelineMatch).sort(compareMatchChronology);

  const ticks = [];
  const byKey = new Map();
  for (const row of rows) {
    const order = matchWeekOrder(row);
    const key = tickKey(row);
    let tick = byKey.get(key);
    if (!tick) {
      tick = {
        key,
        index: ticks.length,
        seasonId: row.season_id || "",
        order,
        kind: order < 100 ? "matchday" : "playoff",
        weekNumber: order < 100 ? order : null,
        phase: PLAYOFF_PHASE_BY_ORDER.get(order) ?? null,
        matches: [],
      };
      byKey.set(key, tick);
      ticks.push(tick);
    }
    tick.matches.push(row);
  }

  const seasons = [];
  for (const tick of ticks) {
    const last = seasons[seasons.length - 1];
    if (last && last.seasonId === tick.seasonId) {
      last.lastTick = tick.index;
    } else {
      seasons.push({ seasonId: tick.seasonId, index: seasons.length, firstTick: tick.index, lastTick: tick.index });
    }
  }
  for (const season of seasons) {
    season.tickCount = season.lastTick - season.firstTick + 1;
  }

  return { ticks, seasons };
}

// Rating snapshot after every tick. Delegates the actual Elo walk to
// eloRatings so the last frame is bit-for-bit the all-time table's value.
export function eloHistory(matches = [], timeline, normalizeKey = normalizedStatsKey) {
  const tickIndexByKey = new Map(timeline.ticks.map((tick) => [tick.key, tick.index]));
  const frames = new Array(timeline.ticks.length).fill(null);

  const snapshot = (ratings) => new Map([...ratings].map(([key, row]) => [key, row.rating]));

  // eloRatings walks matches in chronological order, so writing each match's
  // snapshot onto its own tick leaves every tick holding the state after its
  // last match. Ratings stay unrounded here; rounding happens at render time.
  const finalRows = eloRatings(matches.filter(isTimelineMatch), normalizeKey, {
    onMatch: (row, ratings) => {
      const index = tickIndexByKey.get(tickKey(row));
      if (index !== undefined) frames[index] = snapshot(ratings);
    },
  });

  // A tick whose only matches were skipped (same player on both sides) leaves
  // no frame; carry the previous ratings forward so the curve stays continuous.
  let previous = new Map();
  for (let index = 0; index < frames.length; index += 1) {
    if (frames[index] === null) frames[index] = previous;
    previous = frames[index];
  }

  return {
    frames,
    players: finalRows.map((row) => ({ key: row.key, name: row.name })),
    finalRatings: new Map(finalRows.map((row) => [row.key, numberValue(row.elo)])),
  };
}

function emptyStandingRow(key, name) {
  return { key, name, matches: 0, wins: 0, losses: 0, draws: 0, points: 0, diff: 0 };
}

function applyMatchToStandings(table, row) {
  // `unresolved` marks the winner-less rows no official table confirms as
  // draws (the manually sourced S1 Spieltage 21/22). They stay out of the
  // reconstruction entirely, like the uncaptured matchdays around them.
  if (row.result_basis === "unresolved") return;

  const [leftKey, rightKey] = participantKeys(row);
  if (!leftKey || !rightKey || leftKey === rightKey) return;

  if (!table.has(leftKey)) table.set(leftKey, emptyStandingRow(leftKey, row.player_a || row.team_a));
  if (!table.has(rightKey)) table.set(rightKey, emptyStandingRow(rightKey, row.player_b || row.team_b));
  const left = table.get(leftKey);
  const right = table.get(rightKey);

  left.matches += 1;
  right.matches += 1;

  // Since result_basis landed, every remaining winner-less row is an official
  // draw (the counts line up season by season); forfeits carry the opponent
  // as winner and count like the official tables count them.
  const winner = normalizedStatsKey(row.winner);
  if (winner === leftKey) {
    left.wins += 1;
    right.losses += 1;
  } else if (winner === rightKey) {
    right.wins += 1;
    left.losses += 1;
  } else {
    left.draws += 1;
    right.draws += 1;
  }

  // In a 6v6 played to elimination, a match's kill differential is exactly
  // ±(the winner's surviving Pokémon), which is what score_a/score_b record.
  // S7 confirms it: 13 of 14 official differentials reproduce to the point.
  const scoreDiff = numberValue(row.score_a) - numberValue(row.score_b);
  left.diff += scoreDiff;
  right.diff -= scoreDiff;

  left.points = left.wins * POINTS_PER_WIN + left.draws * POINTS_PER_DRAW;
  right.points = right.wins * POINTS_PER_WIN + right.draws * POINTS_PER_DRAW;
}

function rankedRows(table) {
  // Ties break on differential, like the official tables: S7 has Nestfloh and
  // Dauni both at 11-2, and the crown goes to Nestfloh on +30 vs +24.
  return [...table.values()]
    .map((row) => ({ ...row }))
    .sort((a, b) => b.points - a.points || b.diff - a.diff || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name))

    .map((row, index) => ({ ...row, rank: index + 1 }));
}

// Cumulative table per (season, division) after every tick of that season.
// Every match counts toward its own division's table: names without an
// official standings row (mid-season controller swaps like LucarioLP, or
// cross-league guests like Lauris covering a Liga-2 slot in S3) get their own
// person rows, and reconcileStandings marks them as unofficial.
export function standingsHistory(timeline) {
  const result = new Map();

  for (const season of timeline.seasons) {
    const seasonTicks = timeline.ticks.slice(season.firstTick, season.lastTick + 1);
    const divisions = [...new Set(seasonTicks.flatMap((tick) => tick.matches.map((row) => row.division || "")))];
    const perDivision = new Map();

    for (const division of divisions) {
      const table = new Map();
      const frames = [];
      for (const tick of seasonTicks) {
        for (const row of tick.matches) {
          if ((row.division || "") !== division) continue;
          applyMatchToStandings(table, row);
        }
        frames.push(rankedRows(table));
      }
      perDivision.set(division, frames);
    }
    result.set(season.seasonId, perDivision);
  }

  return result;
}

// Compare the reconstructed final table against the official standings rows.
// Differences are expected and meaningful: point deductions, uncaptured
// results and season 10's 13th matchday all show up here.
export function reconcileStandings(computedRows = [], standingsRows = [], { seasonId, division } = {}) {
  const seasonRows = standingsRows.filter((row) => row.season_id === seasonId && row.stage === "final_table");
  const divisionRows = seasonRows.filter((row) => (row.division || "") === division);
  let official = new Map(divisionRows.map((row) => [normalizedStatsKey(row.player_name), row]));
  if (!official.size) {
    // Season 9's matches say "Tag Team" while its standings split into Singles
    // and Doubles, so fall back to the whole season — but only when that
    // actually covers the table. A stray overlap (a Liga-1 player guesting in
    // an uncharted league) must not be compared against their Liga-1 row.
    const fallback = new Map(seasonRows.map((row) => [normalizedStatsKey(row.player_name), row]));
    const covered = computedRows.filter((row) => fallback.has(row.key)).length;
    if (covered * 2 >= computedRows.length) official = fallback;
  }

  return computedRows.map((row) => {
    const match = official.get(row.key);
    if (!match) return { ...row, official: null, pointsDelta: null, matchesDelta: null };
    const officialPoints = numberValue(match.points);
    const officialMatches = numberValue(match.wins) + numberValue(match.losses) + numberValue(match.draws);
    return {
      ...row,
      official: { points: officialPoints, wins: numberValue(match.wins), losses: numberValue(match.losses), draws: numberValue(match.draws), rank: numberValue(match.rank) },
      pointsDelta: row.points - officialPoints,
      matchesDelta: row.matches - officialMatches,
    };
  });
}

// Killlists are aggregated per season, so the leader race interpolates: the
// series holds CUMULATIVE kills per Pokémon at each season boundary, and the
// view draws any fractional position between them. The set of series is the
// union of every season's cumulative top N, so a Pokémon that ever reaches
// the board can be ranked at any point in time.
export function killlistLeaderSeries(killlistRows = [], seasonIds = [], { topN = 12 } = {}) {
  const rows = canonicalKilllistRows(killlistRows, "all").filter((row) => row.data_status !== "not_available");

  const killsBySeason = new Map(seasonIds.map((seasonId) => [seasonId, new Map()]));
  const displayNames = new Map();
  for (const row of rows) {
    const season = killsBySeason.get(row.season_id);
    if (!season) continue;
    const key = row.pokemon_normalized || row.pokemon;
    if (!key) continue;
    season.set(key, (season.get(key) ?? 0) + numberValue(row.kills));
    if (!displayNames.has(key)) displayNames.set(key, row.pokemon || key);
  }

  const running = new Map();
  let runningTotal = 0;
  const cumulativeBySeason = [];
  const totals = [];
  const union = new Set();
  for (const seasonId of seasonIds) {
    for (const [key, kills] of killsBySeason.get(seasonId) ?? []) {
      running.set(key, (running.get(key) ?? 0) + kills);
      runningTotal += kills;
    }
    [...running.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
      .slice(0, topN)
      .forEach(([key]) => union.add(key));
    cumulativeBySeason.push(new Map(running));
    totals.push(runningTotal);
  }

  return {
    topN,
    pokemon: [...union].map((key) => ({ key, name: displayNames.get(key) ?? key })),
    cumulativeBySeason,
    totals,
  };
}

// `position` is a fractional season count: 3.4 means 40% into season 4, and
// values run linearly from the cumulative total BEFORE the season to the one
// including it. Only the whole-season values are measured.
export function sampleLeaderValues(series, position) {
  const seasons = series.cumulativeBySeason.length;
  if (!seasons) return { values: new Map(), total: 0 };
  const clamped = Math.max(0, Math.min(seasons, position));
  const index = Math.min(seasons - 1, Math.floor(clamped));
  const progress = Math.max(0, Math.min(1, clamped - index));
  const before = index > 0 ? series.cumulativeBySeason[index - 1] : new Map();
  const after = series.cumulativeBySeason[index];
  const totalBefore = index > 0 ? series.totals[index - 1] : 0;

  const values = new Map();
  for (const entry of series.pokemon) {
    const from = before.get(entry.key) ?? 0;
    const to = after.get(entry.key) ?? 0;
    values.set(entry.key, from + (to - from) * progress);
  }
  return { values, total: totalBefore + (series.totals[index] - totalBefore) * progress };
}
