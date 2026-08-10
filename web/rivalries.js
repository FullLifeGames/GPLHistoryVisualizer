// Rivalry ranking and per-pair meeting history. Rankings come from the
// pipeline matchup summary; meetings come from the client-side Elo
// chronology so pregame ratings match the published Elo by construction.

const pairKeyOf = (left, right, normalizeKey) => {
  const keys = [normalizeKey(left), normalizeKey(right)].sort();
  return keys[0] && keys[1] ? keys.join("__") : "";
};

export function rivalryPairs(matchupRows = [], highlightRows = [], normalizeKey, minMeetings = 3) {
  const viewsByPair = new Map();
  for (const row of highlightRows) {
    const key = pairKeyOf(row.player_a, row.player_b, normalizeKey);
    if (!key) continue;
    viewsByPair.set(key, (viewsByPair.get(key) || 0) + (Number(row.view_total) || 0));
  }
  const rows = [];
  for (const row of matchupRows) {
    if (!row.person_id || !row.opponent_id || row.person_id >= row.opponent_id) continue;
    const matches = Number(row.matches) || 0;
    if (matches < minMeetings) continue;
    const winsA = Number(row.wins) || 0;
    const winsB = Number(row.losses) || 0;
    const closeness = 1 - Math.abs(winsA - winsB) / matches;
    const viewTotal = viewsByPair.get(pairKeyOf(row.person_name, row.opponent_name, normalizeKey)) || 0;
    rows.push({
      a_id: row.person_id,
      a_name: row.person_name,
      b_id: row.opponent_id,
      b_name: row.opponent_name,
      matches,
      wins_a: winsA,
      wins_b: winsB,
      draws: Number(row.draws) || 0,
      closeness,
      view_total: viewTotal,
      rivalry_score: matches * (0.2 + closeness) * (1 + Math.log10(1 + viewTotal)),
      source_urls: row.source_urls || "",
    });
  }
  return rows.sort(
    (a, b) => b.rivalry_score - a.rivalry_score || b.matches - a.matches || a.a_name.localeCompare(b.a_name),
  );
}

// Chronological meeting ledger for one pair, oriented so the first key is
// always "a": scores and Elo gaps flip with the participants or the display
// would imply the wrong side won (same rule as the upset index).
export function rivalryMeetings(aKey, bKey, chronology, matches = [], highlightRows = [], normalizeKey) {
  const matchById = new Map(matches.map((row) => [String(row.match_id || ""), row]));
  const viewsByMatch = new Map(highlightRows.map((row) => [String(row.match_id || ""), Number(row.view_total) || 0]));
  const meetings = [];
  for (const matchId of chronology.order) {
    const entry = chronology.perMatch.get(matchId);
    if (!entry) continue;
    const pairMatches =
      (entry.aKey === aKey && entry.bKey === bKey) || (entry.aKey === bKey && entry.bKey === aKey);
    if (!pairMatches) continue;
    const aIsLeft = entry.aKey === aKey;
    const source = matchById.get(matchId) || {};
    const winnerKey = normalizeKey(source.winner);
    const winProbA = aIsLeft ? entry.winProbA : 1 - entry.winProbA;
    const scoreParts = [source.score_a, source.score_b].filter((value) => value !== undefined && value !== "");
    const score =
      scoreParts.length < 2
        ? scoreParts.join(":")
        : aIsLeft
          ? `${source.score_a}:${source.score_b}`
          : `${source.score_b}:${source.score_a}`;
    meetings.push({
      match_id: matchId,
      season_id: entry.seasonId,
      division: source.division || "",
      stage: entry.stage,
      week: entry.week,
      score,
      winner: winnerKey === aKey ? "a" : winnerKey === bKey ? "b" : "draw",
      elo_pre_a: aIsLeft ? entry.eloPreA : entry.eloPreB,
      elo_pre_b: aIsLeft ? entry.eloPreB : entry.eloPreA,
      elo_gap: aIsLeft ? entry.eloPreA - entry.eloPreB : entry.eloPreB - entry.eloPreA,
      win_prob_a: winProbA,
      against_odds:
        winnerKey === aKey ? winProbA < 0.5 : winnerKey === bKey ? winProbA > 0.5 : false,
      video_url: source.video_url || "",
      view_total: viewsByMatch.get(matchId) || 0,
      source_urls: source.source_urls || "",
    });
  }
  const summary = {
    matches: meetings.length,
    wins_a: 0,
    wins_b: 0,
    draws: 0,
    streak: { side: "", length: 0 },
    biggest: null,
    mostWatched: null,
  };
  let biggestMargin = -1;
  for (const meeting of meetings) {
    if (meeting.winner === "a") summary.wins_a += 1;
    else if (meeting.winner === "b") summary.wins_b += 1;
    else summary.draws += 1;
    if (meeting.winner !== "draw") {
      const [left, right] = meeting.score.split(":").map(Number);
      const margin = Number.isFinite(left) && Number.isFinite(right) ? Math.abs(left - right) : 0;
      if (margin > biggestMargin) {
        biggestMargin = margin;
        summary.biggest = meeting;
      }
    }
    if (meeting.view_total > 0 && meeting.view_total > (summary.mostWatched?.view_total || 0)) {
      summary.mostWatched = meeting;
    }
  }
  for (let i = meetings.length - 1; i >= 0; i -= 1) {
    const winner = meetings[i].winner;
    if (winner === "draw") break;
    if (!summary.streak.side) summary.streak.side = winner;
    if (summary.streak.side !== winner) break;
    summary.streak.length += 1;
  }
  const gapPoints = meetings.map((meeting, index) => ({ x: index + 1, y: meeting.elo_gap, source: meeting }));
  return { meetings, summary, gapPoints };
}
