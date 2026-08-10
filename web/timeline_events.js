// Pure event building for the Zeitstrahl view. Every date in here comes from
// YouTube upload timestamps (matches.csv has no dates), so the frontend must
// always label them as upload dates. No DOM access — node-tested.

function dateKey(timestamp) {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(timestamp ?? ""));
  return match ? match[1] : null;
}

function splitUrls(value) {
  return String(value ?? "")
    .split(";")
    .map((url) => url.trim())
    .filter(Boolean);
}

function baseEvent(type, date, sourceUrls) {
  return { type, date, year: Number(date.slice(0, 4)), sourceUrls };
}

export function timelineEvents(
  { seasons, champions, videos, recordsProgression, matchVideos } = {},
  { topVideosPerYear = 3, milestoneSteps = [1, 100, 250, 500, 1000, 2000] } = {},
) {
  const events = [];

  const championBySeason = new Map((champions ?? []).map((row) => [row.season_id, row]));
  for (const row of seasons ?? []) {
    const start = dateKey(row.start_date);
    const end = dateKey(row.end_date);
    if (!start || !end) continue;
    const sources = splitUrls(row.source_urls).slice(0, 2);
    events.push({
      ...baseEvent("season-start", start, sources),
      seasonId: row.season_id,
      seasonLabel: row.season_label || row.season_id,
    });
    const championRow = championBySeason.get(row.season_id);
    events.push({
      ...baseEvent("season-end", end, championRow ? [...sources, ...splitUrls(championRow.source_urls).slice(0, 1)] : sources),
      seasonId: row.season_id,
      seasonLabel: row.season_label || row.season_id,
      ...(championRow ? { champion: championRow.champion_name, championPersonId: championRow.champion_person_id } : {}),
    });
  }

  const datedVideos = (videos ?? [])
    .map((row) => ({ row, date: dateKey(row.published_at) }))
    .filter((entry) => entry.date);

  const byYear = new Map();
  for (const entry of datedVideos) {
    const year = entry.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(entry);
  }
  for (const yearEntries of byYear.values()) {
    const ranked = yearEntries
      .filter((entry) => Number.isFinite(Number(entry.row.view_count)))
      .sort((a, b) => Number(b.row.view_count) - Number(a.row.view_count))
      .slice(0, topVideosPerYear);
    for (const entry of ranked) {
      events.push({
        ...baseEvent("top-video", entry.date, splitUrls(entry.row.source_urls).slice(0, 2)),
        title: entry.row.title || entry.row.video_id,
        videoUrl: entry.row.video_url,
        channel: entry.row.channel_title,
        viewCount: Number(entry.row.view_count),
      });
    }
  }

  const chronological = [...datedVideos].sort(
    (a, b) => String(a.row.published_at).localeCompare(String(b.row.published_at), "en") || String(a.row.video_id).localeCompare(String(b.row.video_id), "en"),
  );
  for (const step of milestoneSteps ?? []) {
    const entry = chronological[step - 1];
    if (!entry) continue;
    events.push({
      ...baseEvent("milestone", entry.date, splitUrls(entry.row.source_urls).slice(0, 2)),
      n: step,
      title: entry.row.title || entry.row.video_id,
      videoUrl: entry.row.video_url,
      channel: entry.row.channel_title,
    });
  }

  const uploadsByMatch = new Map();
  for (const row of matchVideos ?? []) {
    const date = dateKey(row.published_at);
    if (!row.match_id || !date) continue;
    const existing = uploadsByMatch.get(row.match_id);
    if (!existing || date < existing.date) uploadsByMatch.set(row.match_id, { date, videoUrl: row.video_url });
  }
  // Only genuine hand-offs make the timeline: a holder improving their own
  // record (career counters do this constantly) is not a "record fall", and
  // the very first row per key is just the archive's starting value.
  const previousHolder = new Map();
  for (const row of recordsProgression ?? []) {
    const holder = `${row.holder_person_id || row.holder_name || ""}__${row.holder_pokemon || ""}`;
    const prev = previousHolder.get(row.record_key);
    previousHolder.set(row.record_key, holder);
    if (prev === undefined || prev === holder) continue;
    const resolved = uploadsByMatch.get(row.match_id);
    if (!resolved) continue;
    events.push({
      ...baseEvent("record", resolved.date, splitUrls(row.source_urls).slice(0, 2)),
      recordKey: row.record_key,
      holderName: row.holder_name,
      holderPersonId: row.holder_person_id,
      value: row.value,
      seasonId: row.season_id,
      videoUrl: row.video_url || resolved.videoUrl,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date, "en") || a.type.localeCompare(b.type, "en"));
  return events;
}

export function groupEventsByYear(events) {
  const byYear = new Map();
  for (const event of events ?? []) {
    if (!byYear.has(event.year)) byYear.set(event.year, []);
    byYear.get(event.year).push(event);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearEvents]) => ({ year, events: yearEvents }));
}

export function onThisDayEvents(events, isoDate) {
  const date = dateKey(isoDate);
  if (!date) return [];
  const monthDay = date.slice(5);
  const year = Number(date.slice(0, 4));
  return (events ?? [])
    .filter((event) => event.date.slice(5) === monthDay && event.year < year)
    .map((event) => ({ ...event, yearsAgo: year - event.year }))
    .sort((a, b) => a.yearsAgo - b.yearsAgo || a.type.localeCompare(b.type, "en"));
}
