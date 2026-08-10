// Pure aggregation logic for the Publikums-Geschichte view: monthly
// upload/view stacks per channel, season shading bands, and the per-season
// attention strip. No DOM access — everything here is node-tested.

export function monthKey(publishedAt) {
  const match = /^(\d{4})-(\d{2})/.exec(String(publishedAt ?? ""));
  return match ? `${match[1]}-${match[2]}` : null;
}

function monthOrdinal(key) {
  const [year, month] = key.split("-").map(Number);
  return year * 12 + (month - 1);
}

function ordinalToKey(ordinal) {
  const year = Math.floor(ordinal / 12);
  const month = (ordinal % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthRangeKeys(firstKey, lastKey) {
  const keys = [];
  for (let ordinal = monthOrdinal(firstKey); ordinal <= monthOrdinal(lastKey); ordinal += 1) {
    keys.push(ordinalToKey(ordinal));
  }
  return keys;
}

export function monthlyChannelStacks(videoRows, { metric = "uploads", topChannels = 6, otherLabel = "Andere" } = {}) {
  const entries = [];
  for (const row of videoRows ?? []) {
    const month = monthKey(row.published_at);
    if (!month) continue;
    const views = Number(row.view_count);
    const value = metric === "views" ? (Number.isFinite(views) ? views : 0) : 1;
    entries.push({ month, channel: row.channel_title || "?", value });
  }
  if (!entries.length) return { months: [], channels: [], rows: [] };

  const totals = new Map();
  for (const entry of entries) {
    totals.set(entry.channel, (totals.get(entry.channel) || 0) + entry.value);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"));
  const kept = ranked.slice(0, topChannels).map(([channel]) => channel);
  const channels = ranked.length > topChannels ? [...kept, otherLabel] : kept;
  const channelIndex = new Map(channels.map((channel, index) => [channel, index]));
  const otherIndex = ranked.length > topChannels ? channels.length - 1 : -1;

  const monthKeys = entries.map((entry) => entry.month).sort();
  const months = monthRangeKeys(monthKeys[0], monthKeys[monthKeys.length - 1]);
  const rowByMonth = new Map(
    months.map((month, monthIndex) => [month, { month, monthIndex, values: channels.map(() => 0), total: 0 }]),
  );
  for (const entry of entries) {
    const row = rowByMonth.get(entry.month);
    const index = channelIndex.has(entry.channel) ? channelIndex.get(entry.channel) : otherIndex;
    if (!row || index < 0) continue;
    row.values[index] += entry.value;
    row.total += entry.value;
  }
  return { months, channels, rows: months.map((month) => rowByMonth.get(month)) };
}

export function shortSeasonLabel(seasonId) {
  const match = /(\d+)\s*$/.exec(String(seasonId ?? ""));
  return match ? `S${Number(match[1])}` : "";
}

export function seasonMonthBands(seasonRows, months, championRows) {
  if (!months?.length) return [];
  const firstOrdinal = monthOrdinal(months[0]);
  const lastIndex = months.length - 1;
  const champions = new Map((championRows ?? []).map((row) => [row.season_id, row.champion_name]));
  const bands = [];
  for (const row of seasonRows ?? []) {
    const startKey = monthKey(row.start_date);
    const endKey = monthKey(row.end_date);
    if (!startKey || !endKey) continue;
    const fromX = Math.max(monthOrdinal(startKey) - firstOrdinal - 0.5, -0.5);
    const toX = Math.min(monthOrdinal(endKey) - firstOrdinal + 0.5, lastIndex + 0.5);
    if (!(toX > fromX)) continue;
    const short = shortSeasonLabel(row.season_id) || row.season_label || row.season_id;
    const champion = champions.get(row.season_id);
    bands.push({
      seasonId: row.season_id,
      fromX,
      toX,
      label: champion ? `${short} · 🏆 ${champion}` : short,
      shortLabel: short,
    });
  }
  return bands;
}

function weekNumber(week) {
  const match = /(\d+)/.exec(String(week ?? ""));
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function attentionStripPoints(matchHighlightRows, seasonId) {
  const points = [];
  for (const row of matchHighlightRows ?? []) {
    if (row.season_id !== seasonId) continue;
    const trendRaw = String(row.views_trend_z_score_peak ?? "").trim();
    const plainRaw = String(row.views_z_score_peak ?? "").trim();
    const z = trendRaw !== "" && Number.isFinite(Number(trendRaw))
      ? Number(trendRaw)
      : plainRaw !== "" && Number.isFinite(Number(plainRaw))
        ? Number(plainRaw)
        : null;
    if (z === null) continue;
    points.push({
      // Playoff rounds ("Finale", "Spiel um Platz 3") carry no usable week
      // number, so they sort behind the regular season by schedule id.
      playoff: row.stage && row.stage !== "regular_season" ? 1 : 0,
      weekOrder: weekNumber(row.week),
      matchId: String(row.match_id ?? ""),
      weekLabel: row.week,
      z,
      matchLabel: `${row.player_a} ${row.score} ${row.player_b}`,
      videoUrls: String(row.video_urls ?? "").split(";").map((url) => url.trim()).filter(Boolean),
    });
  }
  points.sort(
    (a, b) =>
      a.playoff - b.playoff ||
      (a.playoff ? a.matchId.localeCompare(b.matchId, "en") : a.weekOrder - b.weekOrder) ||
      a.matchLabel.localeCompare(b.matchLabel, "de"),
  );
  return points.map((point, index) => ({
    x: index,
    weekLabel: point.weekLabel,
    z: point.z,
    matchLabel: point.matchLabel,
    videoUrls: point.videoUrls,
  }));
}

export function stripSeasonIds(matchHighlightRows) {
  return [...new Set((matchHighlightRows ?? []).map((row) => row.season_id).filter(Boolean))].sort();
}
