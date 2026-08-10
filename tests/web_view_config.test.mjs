import assert from "node:assert/strict";
import { defaultViewForGroup, isValidView, subviewsForGroup, viewGroupForView, VIEW_GROUPS } from "../web/view_config.js";

assert.deepEqual(
  VIEW_GROUPS.map((group) => group.id),
  ["people", "duels", "pokemon", "seasons", "videos", "records", "data"],
);

assert.equal(defaultViewForGroup("records"), "upset-index");
assert.equal(viewGroupForView("upset-index"), "records");
assert.equal(viewGroupForView("record-book"), "records");
assert.equal(viewGroupForView("awards"), "records");
assert.equal(viewGroupForView("hall-of-fame"), "records");

assert.equal(defaultViewForGroup("people"), "all-time");
assert.equal(defaultViewForGroup("duels"), "matchup");
assert.equal(defaultViewForGroup("pokemon"), "killlists");
assert.equal(defaultViewForGroup("seasons"), "battle-history");
assert.equal(defaultViewForGroup("videos"), "video-archive");
assert.equal(defaultViewForGroup("data"), "data-coverage");
assert.equal(defaultViewForGroup("unknown"), "all-time");

assert.equal(viewGroupForView("all-time"), "people");
assert.equal(viewGroupForView("person-details"), "people");
assert.equal(viewGroupForView("roster-detail"), "people");
assert.equal(viewGroupForView("matchup"), "duels");
assert.equal(viewGroupForView("killlists"), "pokemon");
assert.equal(viewGroupForView("pokemon-drafts"), "pokemon");
assert.equal(viewGroupForView("pokemon-detail"), "pokemon");
assert.equal(viewGroupForView("season-detail"), "seasons");
assert.equal(viewGroupForView("table-history"), "seasons");
assert.equal(viewGroupForView("match-plan"), "seasons");
assert.equal(viewGroupForView("battle-history"), "seasons");
assert.equal(viewGroupForView("match-highlights"), "seasons");
assert.equal(viewGroupForView("cinema"), "videos");
assert.equal(viewGroupForView("zeitreise"), "seasons");
assert.equal(viewGroupForView("team-rosters"), "people");
assert.equal(viewGroupForView("video-archive"), "videos");
assert.equal(viewGroupForView("data-coverage"), "data");
assert.equal(viewGroupForView("review-workflow"), "data");
assert.equal(viewGroupForView("source-claims"), "data");
assert.equal(viewGroupForView("missing"), "people");

assert.deepEqual(subviewsForGroup("people"), ["all-time", "team-rosters"]);
assert.deepEqual(subviewsForGroup("duels"), ["matchup", "rivalries", "oracle"]);

const duelsGroup = VIEW_GROUPS.find((group) => group.id === "duels");
assert.deepEqual(duelsGroup.views, ["matchup", "rivalries", "oracle"]);
assert.deepEqual(duelsGroup.detailViews, ["rivalry-detail"]);
assert.equal(viewGroupForView("rivalries"), "duels");
assert.equal(viewGroupForView("oracle"), "duels");
assert.equal(viewGroupForView("rivalry-detail"), "duels");
assert.equal(isValidView("oracle"), true);
assert.equal(isValidView("rivalries"), true);
assert.equal(isValidView("rivalry-detail"), true);
assert.deepEqual(subviewsForGroup("pokemon"), ["killlists", "pokemon-drafts"]);
assert.deepEqual(subviewsForGroup("seasons"), ["battle-history", "match-highlights", "season-detail", "table-history", "match-plan", "zeitreise"]);
assert.deepEqual(subviewsForGroup("videos"), ["video-archive", "cinema"]);
assert.deepEqual(subviewsForGroup("records"), ["upset-index", "record-book", "awards", "hall-of-fame"]);
