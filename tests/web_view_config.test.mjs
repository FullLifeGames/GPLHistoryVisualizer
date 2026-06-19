import assert from "node:assert/strict";
import { defaultViewForGroup, subviewsForGroup, viewGroupForView, VIEW_GROUPS } from "../web/view_config.js";

assert.deepEqual(
  VIEW_GROUPS.map((group) => group.id),
  ["people", "pokemon", "seasons", "data"],
);

assert.equal(defaultViewForGroup("people"), "all-time");
assert.equal(defaultViewForGroup("pokemon"), "killlists");
assert.equal(defaultViewForGroup("seasons"), "battle-history");
assert.equal(defaultViewForGroup("data"), "data-coverage");
assert.equal(defaultViewForGroup("unknown"), "all-time");

assert.equal(viewGroupForView("all-time"), "people");
assert.equal(viewGroupForView("person-details"), "people");
assert.equal(viewGroupForView("roster-detail"), "people");
assert.equal(viewGroupForView("matchup"), "people");
assert.equal(viewGroupForView("killlists"), "pokemon");
assert.equal(viewGroupForView("pokemon-drafts"), "pokemon");
assert.equal(viewGroupForView("pokemon-detail"), "pokemon");
assert.equal(viewGroupForView("season-detail"), "seasons");
assert.equal(viewGroupForView("table-history"), "seasons");
assert.equal(viewGroupForView("match-plan"), "seasons");
assert.equal(viewGroupForView("battle-history"), "seasons");
assert.equal(viewGroupForView("match-highlights"), "seasons");
assert.equal(viewGroupForView("team-rosters"), "people");
assert.equal(viewGroupForView("video-archive"), "seasons");
assert.equal(viewGroupForView("data-coverage"), "data");
assert.equal(viewGroupForView("review-workflow"), "data");
assert.equal(viewGroupForView("source-claims"), "data");
assert.equal(viewGroupForView("missing"), "people");

assert.deepEqual(subviewsForGroup("people"), ["all-time", "team-rosters", "matchup"]);
assert.deepEqual(subviewsForGroup("pokemon"), ["killlists", "pokemon-drafts"]);
assert.deepEqual(subviewsForGroup("seasons"), ["battle-history", "match-highlights", "season-detail", "table-history", "match-plan", "video-archive"]);
