// Pure beat building for the Season Story scrollytelling view. Beats are
// data-derived narration units; the actual German/English sentences live in
// i18n templates so every claim stays sourced and bilingual. No DOM access.

// Ladder order matters: "Viertelfinale" and "Halbfinale" both contain "final".
const PHASE_ORDER = [
  ["vorrunde", 100],
  ["viertel", 110],
  ["halb", 120],
  ["platz 3", 130],
  ["final", 140],
];

export function storyWeekOrder(week, stage) {
  const folded = String(week ?? "").toLowerCase();
  const phase = PHASE_ORDER.find(([needle]) => folded.includes(needle));
  if (phase) return phase[1];
  const match = /(\d+)/.exec(folded);
  if (match) return Number(match[1]);
  return stage === "playoffs" ? 150 : 999;
}

export function storyFrameForWeek(weeks, week) {
  let frame = 0;
  for (let index = 0; index < (weeks ?? []).length; index += 1) {
    if (weeks[index] <= week) frame = index;
  }
  return frame;
}

const DECIDED_THRESHOLD = 0.95;

export function seasonStoryBeats({
  seasonId,
  division,
  weeks = [],
  matches = [],
  champions = [],
  highlights = [],
  titleOdds = [],
  playoffMatches = [],
  topHighlights = 3,
} = {}) {
  const beats = [];
  const divisionMatches = matches.filter(
    (row) => row.season_id === seasonId && (row.division || "") === division && row.stage === "regular_season",
  );
  const players = new Set(divisionMatches.flatMap((row) => [row.player_a, row.player_b]).filter(Boolean));

  beats.push({
    kind: "intro",
    week: weeks[0] ?? 0,
    frameIndex: 0,
    playerCount: players.size,
    matchdayCount: weeks.length,
    sourceUrls: divisionMatches[0]?.source_urls ?? "",
  });

  // Race checkpoints at one and two thirds of the season keep the sticky
  // table moving even in seasons without notable highlight matches.
  for (const ratio of [1 / 3, 2 / 3]) {
    if (weeks.length < 3) break;
    const index = Math.max(1, Math.round(weeks.length * ratio) - 1);
    beats.push({ kind: "race", week: weeks[index], frameIndex: index });
  }

  const topMatches = highlights
    .filter((row) => row.season_id === seasonId)
    .map((row) => ({ row, score: Number.parseFloat(row.highlight_score) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, topHighlights);
  for (const entry of topMatches) {
    const week = storyWeekOrder(entry.row.week, entry.row.stage);
    beats.push({
      kind: "highlight",
      week,
      frameIndex: storyFrameForWeek(weeks, week),
      matchId: entry.row.match_id,
      playerA: entry.row.player_a,
      playerB: entry.row.player_b,
      score: entry.row.score ?? "",
      highlightScore: entry.score,
      videoUrl: String(entry.row.video_urls ?? "").split(";")[0] ?? "",
      sourceUrls: entry.row.source_urls ?? "",
    });
  }

  const oddsRows = titleOdds
    .filter((row) => row.season_id === seasonId && (row.division || "") === division)
    .map((row) => ({ week: Number(row.week), name: row.person_name, p: Number.parseFloat(row.p_first) }))
    .filter((entry) => Number.isFinite(entry.week) && Number.isFinite(entry.p))
    .sort((a, b) => a.week - b.week || b.p - a.p);
  const decided = oddsRows.find((entry) => entry.p >= DECIDED_THRESHOLD);
  if (decided) {
    beats.push({
      kind: "decided",
      week: decided.week,
      frameIndex: storyFrameForWeek(weeks, decided.week),
      name: decided.name,
      probability: decided.p,
    });
  }

  const playoffBeats = playoffMatches
    .filter((row) => row.season_id === seasonId)
    .map((row) => ({ row, order: storyWeekOrder(row.week, row.stage) }))
    .sort((a, b) => a.order - b.order || String(a.row.match_id).localeCompare(String(b.row.match_id), "en"));
  for (const entry of playoffBeats) {
    beats.push({
      kind: "playoff",
      week: entry.order,
      frameIndex: weeks.length ? weeks.length - 1 : 0,
      matchId: entry.row.match_id,
      weekLabel: entry.row.week ?? "",
      playerA: entry.row.player_a,
      playerB: entry.row.player_b,
      score: entry.row.score_a || entry.row.score_b ? `${entry.row.score_a || "?"} - ${entry.row.score_b || "?"}` : "",
      winner: entry.row.winner ?? "",
      sourceUrls: entry.row.source_urls ?? "",
    });
  }

  const championRow = champions.find((row) => row.season_id === seasonId);
  beats.push({
    kind: "champion",
    week: Number.POSITIVE_INFINITY,
    frameIndex: weeks.length ? weeks.length - 1 : 0,
    name: championRow?.champion_name ?? "",
    team: championRow?.champion_team ?? "",
    sourceUrls: championRow?.source_urls ?? "",
  });

  const rank = { intro: 0, race: 1, highlight: 1, decided: 1, playoff: 2, champion: 3 };
  beats.sort((a, b) => rank[a.kind] - rank[b.kind] || a.week - b.week);
  return beats;
}
