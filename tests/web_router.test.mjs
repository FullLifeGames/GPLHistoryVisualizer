import assert from "node:assert/strict";
import { parseRouteHash, personRouteHash, pokemonRouteHash, seasonRouteHash, viewRouteHash } from "../web/router.js";

assert.deepEqual(parseRouteHash(""), { view: "all-time", personKey: null });
assert.deepEqual(parseRouteHash("#/killlists"), { view: "killlists", personKey: null });
assert.deepEqual(parseRouteHash("#/pokemon-drafts"), { view: "pokemon-drafts", personKey: null });
assert.deepEqual(parseRouteHash("#/video-archive"), { view: "video-archive", personKey: null });
assert.deepEqual(parseRouteHash("#/team-rosters"), { view: "team-rosters", personKey: null });
assert.deepEqual(parseRouteHash("#/data-coverage"), { view: "data-coverage", personKey: null });
assert.deepEqual(parseRouteHash("#/review-workflow"), { view: "review-workflow", personKey: null });
assert.deepEqual(parseRouteHash("#/source-claims"), { view: "source-claims", personKey: null });
assert.deepEqual(parseRouteHash("#/season-detail"), { view: "season-detail", personKey: null });
assert.deepEqual(parseRouteHash("#/season/season_010"), { view: "season-detail", personKey: null, seasonId: "season_010" });
assert.deepEqual(parseRouteHash("#/person/person_bene"), { view: "person-details", personKey: "person_bene" });
assert.deepEqual(parseRouteHash("#/person/person_bene?ignored=true"), { view: "person-details", personKey: "person_bene" });
assert.deepEqual(parseRouteHash("#/pokemon/uhafnir"), { view: "pokemon-detail", personKey: null, pokemonKey: "uhafnir" });

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
