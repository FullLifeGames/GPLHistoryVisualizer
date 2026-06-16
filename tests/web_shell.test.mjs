import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexHtml = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
const dataModeSelect = indexHtml.match(/<select id="data-mode-filter">[\s\S]*?<\/select>/)?.[0] ?? "";

assert.equal(indexHtml.includes('id="summary-grid"'), false);
assert.equal(appJs.includes("renderSummary("), false);
assert.equal(indexHtml.includes('id="data-mode-filter"'), true);
assert.equal(dataModeSelect.includes('value="primary"'), true);
assert.equal(dataModeSelect.includes('value="league2"'), true);
assert.equal(dataModeSelect.includes('value="league1"'), false);
assert.equal(dataModeSelect.includes('value="all"'), false);
assert.equal(appJs.includes("applyDataMode("), true);
