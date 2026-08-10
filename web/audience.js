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

const METRIC_FIELDS = { views: "view_count", likes: "like_count", comments: "comment_count" };
const GROUP_FIELDS = { channel: "channel_title", type: "video_type", season: "detected_season_id", person: "perspective_person" };

export function monthlyChannelStacks(videoRows, { metric = "uploads", topChannels = 6, otherLabel = "Andere", groupBy = "channel" } = {}) {
  const field = METRIC_FIELDS[metric];
  const groupField = GROUP_FIELDS[groupBy] || GROUP_FIELDS.channel;
  const entries = [];
  for (const row of videoRows ?? []) {
    const month = monthKey(row.published_at);
    if (!month) continue;
    let value = 1;
    if (field) {
      const amount = Number(row[field]);
      value = Number.isFinite(amount) && String(row[field] ?? "").trim() !== "" ? amount : 0;
    }
    entries.push({ month, channel: row[groupField] || "?", value });
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

export function seasonMonthBands(seasonRows, months, championRows, endOverrides = {}) {
  if (!months?.length) return [];
  const firstOrdinal = monthOrdinal(months[0]);
  const lastIndex = months.length - 1;
  const champions = new Map((championRows ?? []).map((row) => [row.season_id, row.champion_name]));
  const bands = [];
  for (const row of seasonRows ?? []) {
    const startKey = monthKey(row.start_date);
    const endKey = monthKey(endOverrides[row.season_id] ?? row.end_date);
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

export function attentionStripPoints(matchHighlightRows, seasonId, { mode = "views" } = {}) {
  const points = [];
  for (const row of matchHighlightRows ?? []) {
    if (row.season_id !== seasonId) continue;
    let z = null;
    if (mode === "engagement") {
      const raw = String(row.engagement_z_score_peak ?? "").trim();
      if (raw !== "" && Number.isFinite(Number(raw))) z = Number(raw);
    } else {
      const trendRaw = String(row.views_trend_z_score_peak ?? "").trim();
      const plainRaw = String(row.views_z_score_peak ?? "").trim();
      z = trendRaw !== "" && Number.isFinite(Number(trendRaw))
        ? Number(trendRaw)
        : plainRaw !== "" && Number.isFinite(Number(plainRaw))
          ? Number(plainRaw)
          : null;
    }
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

// Metric-relative anomalies: how strongly a video deviates from its own
// channel's median on the compared quantity — combined interaction rate
// ((likes + comments) / views), raw views, like rate, or comment rate.
// Channel-relative comparison keeps big and small channels comparable.
export function engagementAnomalies(videoRows, { metric = "interactions", minViews = 500, minChannelVideos = 5, top = 8 } = {}) {
  const entries = [];
  for (const row of videoRows ?? []) {
    const views = Number(row.view_count);
    if (!Number.isFinite(views) || views < minViews) continue;
    const likesRaw = String(row.like_count ?? "").trim();
    const commentsRaw = String(row.comment_count ?? "").trim();
    const interactions = (likesRaw ? Number(likesRaw) || 0 : 0) + (commentsRaw ? Number(commentsRaw) || 0 : 0);
    let rate;
    if (metric === "views") {
      rate = views;
    } else if (metric === "likes") {
      if (!likesRaw) continue;
      rate = (Number(likesRaw) || 0) / views;
    } else if (metric === "comments") {
      if (!commentsRaw) continue;
      rate = (Number(commentsRaw) || 0) / views;
    } else {
      if (!likesRaw && !commentsRaw) continue;
      rate = interactions / views;
    }
    entries.push({
      title: row.title || row.video_id,
      videoUrl: row.video_url,
      channel: row.channel_title || "?",
      publishedAt: row.published_at,
      views,
      interactions,
      rate,
    });
  }
  const byChannel = new Map();
  for (const entry of entries) {
    if (!byChannel.has(entry.channel)) byChannel.set(entry.channel, []);
    byChannel.get(entry.channel).push(entry);
  }
  const scored = [];
  for (const list of byChannel.values()) {
    if (list.length < minChannelVideos) continue;
    const rates = list.map((entry) => entry.rate).sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    const median = rates.length % 2 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
    if (!(median > 0)) continue;
    for (const entry of list) scored.push({ ...entry, channelMedianRate: median, factor: entry.rate / median });
  }
  scored.sort((a, b) => b.factor - a.factor || a.title.localeCompare(b.title, "de"));
  const high = scored.slice(0, top);
  const low = scored.slice(top).slice(-top).sort((a, b) => a.factor - b.factor || a.title.localeCompare(b.title, "de"));
  return { high, low };
}

export function stripSeasonIds(matchHighlightRows) {
  return [...new Set((matchHighlightRows ?? []).map((row) => row.season_id).filter(Boolean))].sort();
}
