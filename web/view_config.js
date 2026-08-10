export const VIEW_GROUPS = [
  {
    id: "people",
    labelKey: "navGroups.people",
    defaultView: "all-time",
    views: ["all-time", "team-rosters"],
    detailViews: ["person-details", "roster-detail"],
  },
  {
    id: "duels",
    labelKey: "navGroups.duels",
    defaultView: "matchup",
    views: ["matchup"],
  },
  {
    id: "pokemon",
    labelKey: "navGroups.pokemon",
    defaultView: "killlists",
    views: ["killlists", "pokemon-drafts"],
    detailViews: ["pokemon-detail"],
  },
  {
    id: "seasons",
    labelKey: "navGroups.seasons",
    defaultView: "battle-history",
    views: ["battle-history", "match-highlights", "season-detail", "table-history", "match-plan", "zeitreise"],
  },
  {
    id: "videos",
    labelKey: "navGroups.videos",
    defaultView: "video-archive",
    views: ["video-archive", "cinema"],
  },
  {
    id: "records",
    labelKey: "navGroups.records",
    defaultView: "upset-index",
    views: ["upset-index"],
  },
  {
    id: "data",
    labelKey: "navGroups.data",
    defaultView: "data-coverage",
    views: [
      "data-coverage",
      "data-gaps",
      "roster-gaps",
      "appearance-gaps",
      "video-review",
      "match-video-coverage",
      "review-workflow",
      "source-claims",
    ],
  },
];

const DEFAULT_GROUP = VIEW_GROUPS[0].id;
const GROUP_BY_VIEW = new Map(VIEW_GROUPS.flatMap((group) => [...group.views, ...(group.detailViews || [])].map((view) => [view, group.id])));
const GROUP_BY_ID = new Map(VIEW_GROUPS.map((group) => [group.id, group]));

export const VALID_VIEW_IDS = new Set(VIEW_GROUPS.flatMap((group) => [...group.views, ...(group.detailViews || [])]));

export function viewGroupForView(view) {
  return GROUP_BY_VIEW.get(view) || DEFAULT_GROUP;
}

export function defaultViewForGroup(groupId) {
  return GROUP_BY_ID.get(groupId)?.defaultView || VIEW_GROUPS[0].defaultView;
}

export function subviewsForGroup(groupId) {
  return [...(GROUP_BY_ID.get(groupId)?.views || VIEW_GROUPS[0].views)];
}

export function isValidView(view) {
  return VALID_VIEW_IDS.has(view);
}
