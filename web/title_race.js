// Pure parsing of title_odds.csv for the Titelrennen chart. Everything here
// is a SIMULATION readout — renderers must keep the Simulation labeling that
// app.js attaches. No DOM access; node-tested.

const DECIDED_THRESHOLD = 0.95;

// Anyone who ever held a real share of the race belongs on the chart — a cut
// by final probability would hide early leaders who faded to zero.
const MIN_PEAK = 0.05;

// Playoff checkpoints use the pipeline's phase orders as week values; the
// chart maps them onto compact x positions after the last matchday.
const ROUND_LABEL_KEYS = { 100: "roundPre", 110: "roundQuarter", 120: "roundSemi", 130: "roundThird", 140: "roundFinal" };

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

function buildSeriesList(rows, field, weekToX) {
  const byPerson = new Map();
  for (const row of rows) {
    const value = Number.parseFloat(row[field]);
    if (!Number.isFinite(value)) continue;
    const week = Number(row.week);
    if (!weekToX.has(week)) continue;
    if (!byPerson.has(row.person_id)) {
      byPerson.set(row.person_id, { personId: row.person_id, name: row.person_name, points: [] });
    }
    byPerson.get(row.person_id).points.push({ x: weekToX.get(week), y: value, source: row });
  }
  const series = [...byPerson.values()];
  for (const entry of series) {
    entry.points.sort((a, b) => a.x - b.x);
    entry.final = entry.points.length ? entry.points[entry.points.length - 1].y : 0;
    entry.peak = entry.points.reduce((best, point) => Math.max(best, point.y), 0);
  }
  series.sort((a, b) => b.final - a.final || b.peak - a.peak || a.name.localeCompare(b.name, "de"));
  return series;
}

export function titleRaceSeries(rows, { seasonId, division, topN = 12 } = {}) {
  const divisionRows = seasonRows(rows, seasonId).filter((row) => (row.division || "") === division);
  const allWeeks = [...new Set(divisionRows.map((row) => Number(row.week)))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const regularWeeks = allWeeks.filter((week) => week < 100);
  const playoffRounds = allWeeks.filter((week) => week >= 100);

  const weekToX = new Map(regularWeeks.map((week) => [week, week]));
  const lastRegular = regularWeeks.length ? regularWeeks[regularWeeks.length - 1] : 0;
  const ticks = regularWeeks.map((week) => ({ x: week, labelKey: null, label: String(week) }));
  playoffRounds.forEach((round, index) => {
    const x = lastRegular + index + 1;
    weekToX.set(round, x);
    ticks.push({ x, labelKey: ROUND_LABEL_KEYS[round] ?? null, label: String(round) });
  });

  const pickSeries = (list) => list.filter((entry) => entry.peak >= MIN_PEAK).slice(0, topN);
  const series = pickSeries(buildSeriesList(divisionRows, "p_first", weekToX));
  const playoffAll = buildSeriesList(divisionRows, "p_playoffs", weekToX);
  const playoffSeries = playoffAll.length ? pickSeries(playoffAll) : null;

  // "Mathematically decided" means decided EARLY: the final checkpoint is
  // always certain, so a hit there says nothing and is suppressed. Playoff
  // seasons look at the bracket checkpoints only — during their regular
  // season p_first tracks the division win, not the title.
  let decidedWeek = null;
  let decidedName = null;
  const searchWeeks = playoffRounds.length ? playoffRounds : regularWeeks;
  outer: for (const week of searchWeeks) {
    for (const row of divisionRows) {
      if (Number(row.week) !== week) continue;
      const value = Number.parseFloat(row.p_first);
      if (Number.isFinite(value) && value >= DECIDED_THRESHOLD) {
        decidedWeek = week;
        decidedName = row.person_name;
        break outer;
      }
    }
  }
  if (decidedWeek !== null && allWeeks.length && decidedWeek === allWeeks[allWeeks.length - 1]) {
    decidedWeek = null;
    decidedName = null;
  }

  const sample = divisionRows[0];
  return {
    weeks: allWeeks.map((week) => weekToX.get(week)),
    ticks,
    series,
    playoffSeries,
    decidedWeek,
    decidedX: decidedWeek === null ? null : weekToX.get(decidedWeek),
    decidedName,
    sims: sample ? Number(sample.sims) : 0,
    seed: sample ? String(sample.seed) : "",
  };
}
