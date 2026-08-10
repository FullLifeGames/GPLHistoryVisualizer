// Pure card building for GPL Wrapped. Award-derived cards are computed, not
// official — renderers must show the computed label; champion cards come from
// sourced champions.csv rows. No DOM access; node-tested.

const CARD_ORDER = ["champion", "upset", "mvp", "kill_leader", "top_video", "closest", "spoon"];

const CARD_ICONS = {
  champion: "🏆",
  upset: "⚡",
  mvp: "🌟",
  kill_leader: "🎯",
  top_video: "📺",
  closest: "🔥",
  spoon: "🥄",
  titles: "🏆",
  matches: "⚔️",
  kills: "🎯",
  elo: "📈",
  awards: "🎖️",
  spoons: "🥄",
};

function seasonAward(awards, seasonId, key) {
  return (awards ?? []).find((row) => row.scope === "season" && row.season_id === seasonId && row.award_key === key);
}

function awardCard(awards, seasonId, awardKey, cardKey) {
  const row = seasonAward(awards, seasonId, awardKey);
  if (!row) return null;
  return {
    key: cardKey,
    icon: CARD_ICONS[cardKey],
    name: row.person_name,
    personId: row.person_id,
    value: Number.parseFloat(row.value),
    detail: row.detail ?? "",
    awardKey,
    formula: row.formula ?? "",
    sourceUrls: row.source_urls ?? "",
    computed: true,
  };
}

export function wrappedCards({ seasonId, awards = [], champions = [], highlights = [], videos = [] } = {}) {
  const cards = [];

  const championRow = champions.find((row) => row.season_id === seasonId);
  if (championRow) {
    cards.push({
      key: "champion",
      icon: CARD_ICONS.champion,
      name: championRow.champion_name,
      personId: championRow.champion_person_id,
      value: null,
      detail: championRow.champion_team ?? "",
      sourceUrls: championRow.source_urls ?? "",
      computed: false,
    });
  }

  const byKey = {
    upset: awardCard(awards, seasonId, "upset_of_season", "upset"),
    mvp: awardCard(awards, seasonId, "mvp", "mvp"),
    kill_leader: awardCard(awards, seasonId, "kill_leader", "kill_leader"),
    spoon: awardCard(awards, seasonId, "holzloeffel", "spoon"),
  };

  const seasonVideos = videos
    .filter((row) => row.detected_season_id === seasonId)
    .map((row) => ({ row, views: Number.parseFloat(row.view_count) }))
    .filter((entry) => Number.isFinite(entry.views))
    .sort((a, b) => b.views - a.views);
  if (seasonVideos.length) {
    const top = seasonVideos[0];
    byKey.top_video = {
      key: "top_video",
      icon: CARD_ICONS.top_video,
      name: top.row.title,
      personId: "",
      value: top.views,
      detail: top.row.channel_title ?? "",
      videoUrl: top.row.video_url ?? "",
      sourceUrls: top.row.source_urls ?? "",
      computed: true,
    };
  }

  const close = highlights
    .filter((row) => row.season_id === seasonId && String(row.close_match) === "1")
    .map((row) => ({ row, score: Number.parseFloat(row.highlight_score) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);
  if (close.length) {
    const top = close[0].row;
    byKey.closest = {
      key: "closest",
      icon: CARD_ICONS.closest,
      name: `${top.player_a} vs ${top.player_b}`,
      personId: "",
      value: close[0].score,
      detail: top.score ?? "",
      videoUrl: String(top.video_urls ?? "").split(";")[0] ?? "",
      sourceUrls: top.source_urls ?? "",
      computed: true,
    };
  }

  for (const key of CARD_ORDER) {
    if (key === "champion") continue;
    if (byKey[key]) cards.push(byKey[key]);
  }
  return cards;
}

export function careerWrappedCards({ personRow, awards = [], champions = [] } = {}) {
  if (!personRow) return [];
  const cards = [];
  const number = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const base = {
    name: personRow.person_name,
    personId: personRow.person_id,
    sourceUrls: personRow.source_urls ?? "",
  };

  const titles = number(personRow.seasons_won);
  if (titles > 0) {
    cards.push({ ...base, key: "titles", icon: CARD_ICONS.titles, value: titles, detail: personRow.title_seasons ?? "", computed: false });
  }
  if (number(personRow.matches) > 0) {
    cards.push({
      ...base,
      key: "matches",
      icon: CARD_ICONS.matches,
      value: number(personRow.matches),
      detail: `${personRow.wins}-${personRow.losses}-${personRow.draws} · ${personRow.win_pct}%`,
      computed: true,
    });
  }
  if (number(personRow.kills) > 0) {
    cards.push({ ...base, key: "kills", icon: CARD_ICONS.kills, value: number(personRow.kills), detail: "", computed: true });
  }
  if (number(personRow.elo) > 0) {
    cards.push({ ...base, key: "elo", icon: CARD_ICONS.elo, value: number(personRow.elo), detail: "", computed: true });
  }
  const seasonAwards = (awards ?? []).filter(
    (row) => row.scope === "season" && row.person_id === personRow.person_id && row.award_key !== "holzloeffel",
  );
  if (seasonAwards.length) {
    cards.push({
      ...base,
      key: "awards",
      icon: CARD_ICONS.awards,
      value: seasonAwards.length,
      detail: [...new Set(seasonAwards.map((row) => row.award_key))].join(", "),
      sourceUrls: seasonAwards[0].source_urls ?? "",
      computed: true,
    });
  }
  const spoons = (awards ?? []).filter(
    (row) => row.scope === "season" && row.person_id === personRow.person_id && row.award_key === "holzloeffel",
  );
  if (spoons.length) {
    cards.push({ ...base, key: "spoons", icon: CARD_ICONS.spoons, value: spoons.length, detail: "", sourceUrls: spoons[0].source_urls ?? "", computed: true });
  }
  return cards;
}
