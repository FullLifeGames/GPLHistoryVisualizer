export const VIEW_GROUPS = [
  {
    id: "people",
    labelKey: "navGroups.people",
    defaultView: "all-time",
    views: ["all-time", "matchup"],
    detailViews: ["person-details"],
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
    defaultView: "season-detail",
    views: ["season-detail", "table-history", "match-plan", "battle-history", "team-rosters", "video-archive"],
  },
  {
    id: "data",
    labelKey: "navGroups.data",
    defaultView: "data-coverage",
    views: ["data-coverage", "review-workflow", "source-claims"],
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
