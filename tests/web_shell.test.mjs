import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexHtml = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");

assert.equal(indexHtml.includes('id="summary-grid"'), false);
assert.equal(appJs.includes("renderSummary("), false);
