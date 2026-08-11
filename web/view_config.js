export const VIEW_GROUPS = [
  {
    id: "records",
    labelKey: "navGroups.records",
    defaultView: "all-time",
    views: ["all-time", "team-rosters", "record-book", "awards", "hall-of-fame"],
    detailViews: ["person-details", "roster-detail"],
  },
  {
    id: "seasons",
    labelKey: "navGroups.seasons",
    defaultView: "season-detail",
    views: ["season-detail", "match-plan", "battle-history", "table-history", "season-story", "season-wrapped", "zeitreise"],
    stacks: [
      {
        id: "season-hub",
        labelKey: "seasonHub.tab",
        views: ["season-detail", "match-plan", "battle-history", "table-history", "season-story", "season-wrapped"],
      },
    ],
  },
  {
    id: "duels",
    labelKey: "navGroups.duels",
    defaultView: "rivalries",
    views: ["rivalries", "oracle", "team-duel"],
    detailViews: ["rivalry-detail"],
  },
  {
    id: "pokemon",
    labelKey: "navGroups.pokemon",
    defaultView: "killlists",
    views: ["killlists", "pokemon-drafts"],
    detailViews: ["pokemon-detail"],
  },
  {
    id: "videos",
    labelKey: "navGroups.videos",
    defaultView: "video-archive",
    views: ["video-archive", "cinema", "match-highlights", "upset-index", "audience-history", "zeitstrahl"],
  },
  {
    id: "games",
    labelKey: "navGroups.games",
    defaultView: "games",
    views: ["games"],
    detailViews: ["game"],
  },
  {
    id: "data",
    labelKey: "navGroups.data",
    tool: true,
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

export const GAME_IDS = ["kader-raten", "tipp-spiel", "klick-duell", "quizshow", "wer-bin-ich"];

// Views ohne Gruppen-Tab (Header-Zugang): der Wegweiser.
export const STANDALONE_VIEWS = ["wegweiser"];

const DEFAULT_GROUP = VIEW_GROUPS[0].id;
const GROUP_BY_VIEW = new Map(VIEW_GROUPS.flatMap((group) => [...group.views, ...(group.detailViews || [])].map((view) => [view, group.id])));
const GROUP_BY_ID = new Map(VIEW_GROUPS.map((group) => [group.id, group]));
const STACK_BY_ID = new Map(VIEW_GROUPS.flatMap((group) => (group.stacks || []).map((stack) => [stack.id, stack])));
const STACK_ID_BY_VIEW = new Map(
  VIEW_GROUPS.flatMap((group) => (group.stacks || []).flatMap((stack) => stack.views.map((view) => [view, stack.id]))),
);

export const VALID_VIEW_IDS = new Set([
  ...VIEW_GROUPS.flatMap((group) => [...group.views, ...(group.detailViews || [])]),
  ...STANDALONE_VIEWS,
]);

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

export function stackForView(view) {
  return STACK_ID_BY_VIEW.get(view) || null;
}

export function stackViews(stackId) {
  return [...(STACK_BY_ID.get(stackId)?.views || [])];
}

export function stackDefaultView(stackId) {
  return STACK_BY_ID.get(stackId)?.views[0] || VIEW_GROUPS[0].defaultView;
}

export function isStandaloneView(view) {
  return STANDALONE_VIEWS.includes(view);
}
