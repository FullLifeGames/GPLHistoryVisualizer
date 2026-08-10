// Six-degrees graph over played matches. Forfeits and unresolved rows are
// not edges: a chain hop must be a match that actually happened. The stored
// edge for a pair is their first meeting, upgraded once if a later meeting
// has a video and the stored one does not.

const SKIPPED_BASIS = new Set(["forfeit", "unresolved"]);

function playedMatchRows(matches) {
  return matches.filter(
    (row) => row.player_a && row.player_b && !SKIPPED_BASIS.has(row.result_basis || ""),
  );
}

export function oracleGraph(matches = [], stints = [], { includeStints = false } = {}, normalizeKey) {
  const nodes = new Map();
  const edges = new Map();
  const touch = (key, name) => {
    if (!nodes.has(key)) nodes.set(key, { name });
    if (!edges.has(key)) edges.set(key, new Map());
  };
  const connect = (aKey, bKey, via, { upgradeForVideo = false } = {}) => {
    const existing = edges.get(aKey).get(bKey);
    if (!existing) {
      edges.get(aKey).set(bKey, via);
    } else if (upgradeForVideo && existing.type === "match" && !existing.videoUrl && via.videoUrl) {
      edges.get(aKey).set(bKey, via);
    }
  };
  for (const row of playedMatchRows(matches)) {
    const aKey = normalizeKey(row.player_a);
    const bKey = normalizeKey(row.player_b);
    if (!aKey || !bKey || aKey === bKey) continue;
    touch(aKey, row.player_a);
    touch(bKey, row.player_b);
    const via = {
      type: "match",
      matchId: String(row.match_id || ""),
      seasonId: row.season_id || "",
      week: row.week || "",
      division: row.division || "",
      videoUrl: row.video_url || "",
    };
    connect(aKey, bKey, via, { upgradeForVideo: true });
    connect(bKey, aKey, via, { upgradeForVideo: true });
  }
  if (includeStints) {
    const bySeasonDivision = new Map();
    for (const row of stints) {
      const key = normalizeKey(row.person_name);
      if (!key) continue;
      const groupKey = `${row.season_id}\u0000${row.division}`;
      if (!bySeasonDivision.has(groupKey)) bySeasonDivision.set(groupKey, new Map());
      bySeasonDivision.get(groupKey).set(key, row.person_name);
    }
    for (const [groupKey, members] of bySeasonDivision) {
      const [seasonId, division] = groupKey.split("\u0000");
      const entries = [...members.entries()];
      for (let i = 0; i < entries.length; i += 1) {
        for (let j = i + 1; j < entries.length; j += 1) {
          const [aKey, aName] = entries[i];
          const [bKey, bName] = entries[j];
          touch(aKey, aName);
          touch(bKey, bName);
          const via = { type: "stint", seasonId, division };
          connect(aKey, bKey, via);
          connect(bKey, aKey, via);
        }
      }
    }
  }
  return { nodes, edges };
}

// Breadth-first search with sorted neighbor order so the reported chain is
// deterministic for a given dataset.
export function oraclePath(graph, aKey, bKey) {
  if (!graph.edges.has(aKey) || !graph.edges.has(bKey)) return null;
  if (aKey === bKey) return [{ key: aKey, name: graph.nodes.get(aKey)?.name || aKey, via: null }];
  const cameFrom = new Map([[aKey, null]]);
  const queue = [aKey];
  while (queue.length) {
    const current = queue.shift();
    const neighbors = [...graph.edges.get(current).keys()].sort();
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

export function connectednessRows(matches = [], normalizeKey) {
  const byPerson = new Map();
  for (const row of playedMatchRows(matches)) {
    const aKey = normalizeKey(row.player_a);
    const bKey = normalizeKey(row.player_b);
    if (!aKey || !bKey || aKey === bKey) continue;
    const track = (key, name, opponent) => {
      if (!byPerson.has(key)) byPerson.set(key, { key, name, opponents: new Set(), matches: 0 });
      const entry = byPerson.get(key);
      entry.opponents.add(opponent);
      entry.matches += 1;
    };
    track(aKey, row.player_a, bKey);
    track(bKey, row.player_b, aKey);
  }
  return [...byPerson.values()]
    .map((entry) => ({ key: entry.key, name: entry.name, opponents: entry.opponents.size, matches: entry.matches }))
    .sort((a, b) => b.opponents - a.opponents || b.matches - a.matches || a.name.localeCompare(b.name));
}
