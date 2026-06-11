import assert from "node:assert/strict";
import { parseRouteHash, personRouteHash, viewRouteHash } from "../web/router.js";

assert.deepEqual(parseRouteHash(""), { view: "all-time", personKey: null });
assert.deepEqual(parseRouteHash("#/killlists"), { view: "killlists", personKey: null });
assert.deepEqual(parseRouteHash("#/video-archive"), { view: "video-archive", personKey: null });
assert.deepEqual(parseRouteHash("#/person/person_bene"), { view: "person-details", personKey: "person_bene" });
assert.deepEqual(parseRouteHash("#/person/person_bene?ignored=true"), { view: "person-details", personKey: "person_bene" });

assert.equal(viewRouteHash("all-time"), "#/all-time");
assert.equal(viewRouteHash("person-details"), "#/person-details");
assert.equal(viewRouteHash("video-archive"), "#/video-archive");
assert.equal(personRouteHash("person_bene"), "#/person/person_bene");
