import assert from "node:assert/strict";
import { normalizeRosterGroupKey, rosterIdentityKey } from "../web/roster_keys.js";

assert.equal(rosterIdentityKey("King Blex"), "kingblex");
assert.equal(rosterIdentityKey("Cyber End Jugulis"), "cyberendjugulis");
assert.equal(rosterIdentityKey("Liga 2"), "liga2");

assert.equal(
  normalizeRosterGroupKey('["season_010","main","cyber end jugulis","king blex"]'),
  '["season_010","main","cyberendjugulis","kingblex"]',
);

assert.equal(
  normalizeRosterGroupKey('["season_005","Liga 1","Victini Bottom","Bene"]'),
  '["season_005","liga1","victinibottom","bene"]',
);
