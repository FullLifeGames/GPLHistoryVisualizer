// Directed win-chain graph over played, decided matches: an edge runs from
// the winner to the loser, so a path is a chain of transitive victories
// ("A beat B, B beat C"). Draws have no winner, forfeits and unresolved rows
// were never played - none of them are edges. The stored edge for a pair is
// their first such win, upgraded once if a later win has a video and the
// stored one does not.

const SKIPPED_BASIS = new Set(["forfeit", "unresolved"]);

function playedMatchRows(matches) {
  return matches.filter(
    (row) => row.player_a && row.player_b && !SKIPPED_BASIS.has(row.result_basis || ""),
  );
}

export function winChainGraph(matches = [], normalizeKey) {
  const nodes = new Map();
  const edges = new Map();
  const touch = (key, name) => {
    if (!nodes.has(key)) nodes.set(key, { name });
    if (!edges.has(key)) edges.set(key, new Map());
  };
  for (const row of playedMatchRows(matches)) {
    const aKey = normalizeKey(row.player_a);
    const bKey = normalizeKey(row.player_b);
    if (!aKey || !bKey || aKey === bKey) continue;
    touch(aKey, row.player_a);
    touch(bKey, row.player_b);
    const winnerKey = normalizeKey(row.winner);
    if (winnerKey !== aKey && winnerKey !== bKey) continue;
    const loserKey = winnerKey === aKey ? bKey : aKey;
    const via = {
      type: "match",
      matchId: String(row.match_id || ""),
      seasonId: row.season_id || "",
      week: row.week || "",
      division: row.division || "",
      videoUrl: row.video_url || "",
    };
    const existing = edges.get(winnerKey).get(loserKey);
    if (!existing) {
      edges.get(winnerKey).set(loserKey, via);
    } else if (!existing.videoUrl && via.videoUrl) {
      edges.get(winnerKey).set(loserKey, via);
    }
  }
  return { nodes, edges };
}

// Breadth-first search along win edges with sorted neighbor order so the
// reported chain is deterministic for a given dataset.
export function winChainPath(graph, aKey, bKey) {
  if (!graph.edges.has(aKey) || !graph.nodes.has(bKey)) return null;
  if (aKey === bKey) return [{ key: aKey, name: graph.nodes.get(aKey)?.name || aKey, via: null }];
  const cameFrom = new Map([[aKey, null]]);
  const queue = [aKey];
  while (queue.length) {
    const current = queue.shift();
    const neighbors = [...(graph.edges.get(current)?.keys() ?? [])].sort();
    for (const neighbor of neighbors) {
      if (cameFrom.has(neighbor)) continue;
      cameFrom.set(neighbor, current);
      if (neighbor === bKey) {
        const path = [];
        let step = neighbor;
        while (step) {
          const previous = cameFrom.get(step);
          path.unshift({
            key: step,
            name: graph.nodes.get(step)?.name || step,
            via: previous ? graph.edges.get(previous).get(step) : null,
          });
          step = previous;
        }
        return path;
      }
      queue.push(neighbor);
    }
  }
  return null;
}

// How many players someone beats directly, and how many fall to a chain of
// wins. Share is the transitive count over all other archive players, as a
// whole percent.
export function dominanceRows(graph) {
  const totalOthers = Math.max(1, graph.nodes.size - 1);
  const rows = [];
  for (const [key, node] of graph.nodes) {
    const direct = graph.edges.get(key)?.size ?? 0;
    const seen = new Set([key]);
    const queue = [key];
    while (queue.length) {
      const current = queue.shift();
      for (const neighbor of graph.edges.get(current)?.keys() ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push(neighbor);
      }
    }
    const transitive = seen.size - 1;
    rows.push({
      key,
      name: node.name || key,
      beats_direct: direct,
      beats_transitive: transitive,
      share: Math.round((transitive / totalOthers) * 100),
    });
  }
  return rows.sort(
    (a, b) => b.beats_transitive - a.beats_transitive || b.beats_direct - a.beats_direct || a.name.localeCompare(b.name),
  );
}
