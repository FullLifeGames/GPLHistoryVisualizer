import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexHtml = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../web/app.js", import.meta.url), "utf8");
const stylesCss = readFileSync(new URL("../web/styles.css", import.meta.url), "utf8");

const coreDatasets = appJs.match(/const CORE_DATASETS = \{[\s\S]*?\n\};/)?.[0] ?? "";
const lazyDatasets = appJs.match(/const LAZY_DATASETS = \{[\s\S]*?\n\};/)?.[0] ?? "";

assert.ok(coreDatasets, "app.js should define a core dataset group for first paint");
assert.ok(lazyDatasets, "app.js should define a lazy dataset group for heavy secondary views");

assert.equal(indexHtml.includes('id="app-loading"'), true);
assert.equal(indexHtml.includes('id="loading-progress-bar"'), true);
assert.equal(indexHtml.includes('id="loading-progress-text"'), true);
assert.equal(stylesCss.includes(".loading-overlay"), true);
assert.equal(stylesCss.includes(".loading-progress-bar"), true);

assert.equal(coreDatasets.includes("sourceClaims"), false);
assert.equal(coreDatasets.includes("videos"), false);
assert.equal(coreDatasets.includes("matchVideos"), false);
assert.equal(coreDatasets.includes("reviewIndex"), false);

assert.equal(lazyDatasets.includes("sourceClaims"), true);
assert.equal(lazyDatasets.includes("videos"), true);
assert.equal(lazyDatasets.includes("matchVideos"), true);
assert.equal(lazyDatasets.includes("reviewIndex"), true);

assert.equal(appJs.includes("const VIEW_DATASETS"), true);
assert.equal(appJs.includes("loadCoreDatasets("), true);
assert.equal(appJs.includes("ensureDatasetsForView("), true);
assert.equal(appJs.includes("updateLoadingProgress("), true);
assert.equal(appJs.includes('fetch(url, { cache: "no-store" })'), false);

const loadingStateRenderer = appJs.match(/function renderViewLoadingState\(viewName, keys\) \{[\s\S]*?\n\}/)?.[0] ?? "";
assert.match(loadingStateRenderer, /destroyTable\(`#\$\{target\.id\}`\)/);
