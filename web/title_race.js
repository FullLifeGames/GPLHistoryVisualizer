// Pure parsing of title_odds.csv for the Titelrennen chart. Everything here
// is a SIMULATION readout — renderers must keep the Simulation labeling that
// app.js attaches. No DOM access; node-tested.

const DECIDED_THRESHOLD = 0.95;

function seasonRows(rows, seasonId) {
  return (rows ?? []).filter((row) => row.season_id === seasonId);
}

// Top league first: viewers land on the championship race, not Liga 2.
function divisionRank(division) {
  const folded = division.toLowerCase();
  if (folded.includes("regular")) return 0;
  if (folded.includes("liga 1")) return 1;
  return 2;
}

export function titleRaceDivisions(rows, seasonId) {
  return [...new Set(seasonRows(rows, seasonId).map((row) => row.division || ""))].sort(
    (a, b) => divisionRank(a) - divisionRank(b) || a.localeCompare(b, "de"),
  );
}

function buildSeriesList(rows, field) {
  const byPerson = new Map();
  for (const row of rows) {
    const value = Number.parseFloat(row[field]);
    if (!Number.isFinite(value)) continue;
    if (!byPerson.has(row.person_id)) {
      byPerson.set(row.person_id, { personId: row.person_id, name: row.person_name, points: [] });
    }
    byPerson.get(row.person_id).points.push({ x: Number(row.week), y: value, source: row });
  }
  const series = [...byPerson.values()];
  for (const entry of series) {
    entry.points.sort((a, b) => a.x - b.x);
    entry.final = entry.points.length ? entry.points[entry.points.length - 1].y : 0;
  }
  series.sort((a, b) => b.final - a.final || a.name.localeCompare(b.name, "de"));
  return series;
}

export function titleRaceSeries(rows, { seasonId, division, topN = 8 } = {}) {
  const divisionRows = seasonRows(rows, seasonId).filter((row) => (row.division || "") === division);
  const weeks = [...new Set(divisionRows.map((row) => Number(row.week)))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const allSeries = buildSeriesList(divisionRows, "p_first");
  const series = allSeries.slice(0, topN);
  const playoffAll = buildSeriesList(divisionRows, "p_playoffs");
  const playoffSeries = playoffAll.length ? playoffAll.slice(0, topN) : null;

  let decidedWeek = null;
  let decidedName = null;
  outer: for (const week of weeks) {
    for (const entry of allSeries) {
      const point = entry.points.find((candidate) => candidate.x === week);
      if (point && point.y >= DECIDED_THRESHOLD) {
        decidedWeek = week;
        decidedName = entry.name;
        break outer;
      }
    }
  }

  const sample = divisionRows[0];
  return {
    weeks,
    series,
    playoffSeries,
    decidedWeek,
    decidedName,
    sims: sample ? Number(sample.sims) : 0,
    seed: sample ? String(sample.seed) : "",
  };
}
