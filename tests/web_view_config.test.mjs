import assert from "node:assert/strict";
import {
  defaultViewForGroup,
  GAME_IDS,
  isStandaloneView,
  isValidView,
  STANDALONE_VIEWS,
  stackDefaultView,
  stackForView,
  stackViews,
  subviewsForGroup,
  viewGroupForView,
  VIEW_GROUPS,
} from "../web/view_config.js";

assert.deepEqual(
  VIEW_GROUPS.map((group) => group.id),
  ["records", "seasons", "duels", "pokemon", "videos", "games", "data"],
);

// Bestenlisten: Ewige Tabelle + Kaderübersichten + Rekord-Cluster.
assert.equal(defaultViewForGroup("records"), "all-time");
assert.deepEqual(subviewsForGroup("records"), ["all-time", "team-rosters", "record-book", "awards", "hall-of-fame"]);
for (const view of ["all-time", "team-rosters", "person-details", "roster-detail", "record-book", "awards", "hall-of-fame"]) {
  assert.equal(viewGroupForView(view), "records");
}

// Saisons: Hub-Stack + Chronik. Spielbaum eröffnet, die Akte schließt ab.
assert.equal(defaultViewForGroup("seasons"), "battle-history");
assert.deepEqual(subviewsForGroup("seasons"), ["battle-history", "table-history", "season-story", "season-wrapped", "match-plan", "season-detail", "zeitreise"]);
assert.deepEqual(stackViews("season-hub"), ["battle-history", "table-history", "season-story", "season-wrapped", "match-plan", "season-detail"]);
assert.equal(stackDefaultView("season-hub"), "battle-history");
for (const view of stackViews("season-hub")) {
  assert.equal(stackForView(view), "season-hub");
  assert.equal(viewGroupForView(view), "seasons");
}
assert.equal(stackForView("zeitreise"), null);
assert.equal(stackForView("all-time"), null);
assert.deepEqual(stackViews("unknown-stack"), []);

// Duelle / Pokémon unverändert.
assert.deepEqual(subviewsForGroup("duels"), ["rivalries", "oracle", "team-duel"]);
assert.equal(viewGroupForView("rivalry-detail"), "duels");
assert.deepEqual(subviewsForGroup("pokemon"), ["killlists", "pokemon-drafts"]);
assert.equal(viewGroupForView("pokemon-detail"), "pokemon");

// Videos übernimmt Highlightkämpfe und Upset-Index; Kino und Archiv schließen ab.
assert.equal(defaultViewForGroup("videos"), "match-highlights");
assert.deepEqual(subviewsForGroup("videos"), ["match-highlights", "upset-index", "audience-history", "zeitstrahl", "cinema", "video-archive"]);
assert.equal(viewGroupForView("match-highlights"), "videos");
assert.equal(viewGroupForView("upset-index"), "videos");

// Spiele unverändert.
const gamesGroup = VIEW_GROUPS.find((group) => group.id === "games");
assert.deepEqual(gamesGroup.views, ["games"]);
assert.deepEqual(gamesGroup.detailViews, ["game"]);
assert.deepEqual(GAME_IDS, ["kader-raten", "tipp-spiel", "klick-duell", "quizshow", "wer-bin-ich"]);

// Werkstatt: als einzige Gruppe mit tool-Flag.
const dataGroup = VIEW_GROUPS.find((group) => group.id === "data");
assert.equal(dataGroup.tool, true);
assert.equal(VIEW_GROUPS.filter((group) => group.tool).length, 1);
assert.equal(defaultViewForGroup("data"), "data-coverage");
assert.deepEqual(subviewsForGroup("data"), [
  "data-coverage",
  "data-gaps",
  "roster-gaps",
  "appearance-gaps",
  "video-review",
  "match-video-coverage",
  "review-workflow",
  "source-claims",
]);

// Wegweiser: gruppenloser Standalone-View.
assert.deepEqual(STANDALONE_VIEWS, ["wegweiser"]);
assert.equal(isValidView("wegweiser"), true);
assert.equal(isStandaloneView("wegweiser"), true);
assert.equal(isStandaloneView("all-time"), false);

// Fallbacks: Standardgruppe ist jetzt records.
assert.equal(defaultViewForGroup("unknown"), "all-time");
assert.equal(viewGroupForView("missing"), "records");
assert.equal(isValidView("matchup"), false);
