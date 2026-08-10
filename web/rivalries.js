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
