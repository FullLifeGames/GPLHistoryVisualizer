import assert from "node:assert/strict";
import { parseRouteHash, personRouteHash, pokemonRouteHash, rosterRouteHash, seasonRouteHash, viewRouteHash } from "../web/router.js";

assert.deepEqual(parseRouteHash(""), { view: "all-time", personKey: null });
assert.deepEqual(parseRouteHash("#/killlists"), { view: "killlists", personKey: null });
assert.deepEqual(parseRouteHash("#/pokemon-drafts"), { view: "pokemon-drafts", personKey: null });
assert.deepEqual(parseRouteHash("#/video-archive"), { view: "video-archive", personKey: null });
assert.deepEqual(parseRouteHash("#/team-rosters"), { view: "team-rosters", personKey: null });
assert.deepEqual(parseRouteHash("#/data-coverage"), { view: "data-coverage", personKey: null });
assert.deepEqual(parseRouteHash("#/review-workflow"), { view: "review-workflow", personKey: null });
assert.deepEqual(parseRouteHash("#/source-claims"), { view: "source-claims", personKey: null });
assert.deepEqual(parseRouteHash("#/season-detail"), { view: "season-detail", personKey: null });
assert.deepEqual(parseRouteHash("#/people"), { view: "all-time", personKey: null });
assert.deepEqual(parseRouteHash("#/pokemon"), { view: "killlists", personKey: null });
assert.deepEqual(parseRouteHash("#/seasons"), { view: "battle-history", personKey: null });
assert.deepEqual(parseRouteHash("#/data"), { view: "data-coverage", personKey: null });
assert.deepEqual(parseRouteHash("#/season/season_010"), { view: "season-detail", personKey: null, seasonId: "season_010" });
assert.deepEqual(parseRouteHash("#/person/person_bene"), { view: "person-details", personKey: "person_bene" });
assert.deepEqual(parseRouteHash("#/person/person_bene?ignored=true"), { view: "person-details", personKey: "person_bene" });
assert.deepEqual(parseRouteHash("#/pokemon/uhafnir"), { view: "pokemon-detail", personKey: null, pokemonKey: "uhafnir" });
assert.deepEqual(parseRouteHash(`#/roster/${encodeURIComponent("[\"season_010\",\"main\",\"wackel backel\",\"bene\"]")}`), {
  view: "roster-detail",
  personKey: null,
  rosterKey: "[\"season_010\",\"main\",\"wackel backel\",\"bene\"]",
});

assert.equal(viewRouteHash("all-time"), "#/all-time");
assert.equal(viewRouteHash("pokemon-drafts"), "#/pokemon-drafts");
assert.equal(viewRouteHash("person-details"), "#/person-details");
assert.equal(viewRouteHash("video-archive"), "#/video-archive");
assert.equal(viewRouteHash("team-rosters"), "#/team-rosters");
assert.equal(viewRouteHash("data-coverage"), "#/data-coverage");
assert.equal(viewRouteHash("review-workflow"), "#/review-workflow");
assert.equal(viewRouteHash("source-claims"), "#/source-claims");
assert.equal(viewRouteHash("season-detail"), "#/season-detail");
assert.equal(personRouteHash("person_bene"), "#/person/person_bene");
assert.equal(seasonRouteHash("season_010"), "#/season/season_010");
assert.equal(pokemonRouteHash("uhafnir"), "#/pokemon/uhafnir");
assert.equal(rosterRouteHash("[\"season_010\",\"main\",\"wackel backel\",\"bene\"]"), "#/roster/%5B%22season_010%22%2C%22main%22%2C%22wackel%20backel%22%2C%22bene%22%5D");
