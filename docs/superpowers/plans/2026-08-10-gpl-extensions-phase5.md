# GPL Extensions Phase 5 (Videos & Zeit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the two Phase 5 views from `docs/superpowers/specs/2026-08-10-gpl-extensions-design.md`: `audience-history` (Publikums-Geschichte: monthly upload/view charts stacked by channel, season shading, champion annotations, per-season attention strip) and `zeitstrahl` (calendar timeline with year sections plus the "Heute vor X Jahren" widget), both in the existing `videos` group.

**Architecture:** Pure frontend, no pipeline change. Two new pure-logic modules (`web/audience.js`, `web/timeline_events.js`) carry all computation and get node tests; `web/charts.js` gains a `stackedBarChart` renderer (shares margin/cleanup/label conventions with `renderChart`, colors via `--viz-*`/`currentColor`); `web/app.js` gains two renderers. View registration follows the established 5 touch points (view_config, index.html, app.js, i18n de+en, tests).

**Tech Stack:** Static ES modules, d3 v7 (CDN global), node:test with top-level asserts for shell/config/i18n suites and `test()` for the new logic suites.

## Global Constraints

- Source URLs on every claim; computed values labeled; bilingual de/en with i18n parity (test-enforced).
- All dates in these views come from YouTube `published_at` (matches.csv has no dates) — every displayed date must carry the upload-date caveat (spec §Zeitstrahl).
- New CSV loads stay `optional: true` lazy datasets; no new CSVs in this phase (`videos`, `matchHighlights`, `recordsProgression`, `matchVideos` already registered).
- No zeitreise internals imported; charts only through `web/charts.js`.
- No localStorage use in these views.
- View ids fixed by spec: `audience-history`, `zeitstrahl`; both in group `videos`, subnav order: video-archive, cinema, audience-history, zeitstrahl.
- Gates at the end of every task that touches web code: `node --test tests/*.mjs`; full gates in the final task (`python -m pytest -q`, `npm run validate`, `npm run check:generated`, `git diff --check`).

## File Structure

- Create: `web/audience.js` (monthly aggregation, season bands, attention strip — pure), `web/timeline_events.js` (event building, year grouping, on-this-day — pure), `tests/web_audience.test.mjs`, `tests/web_timeline_events.test.mjs`
- Modify: `web/charts.js` (+`stackSegments` pure helper, +`stackedBarChart`), `tests/web_charts.test.mjs`, `web/view_config.js`, `web/index.html`, `web/app.js`, `web/i18n.js`, `web/styles.css`, `tests/web_view_config.test.mjs`, `tests/web_shell.test.mjs`, `tests/web_i18n.test.mjs`, `tests/web_loading.test.mjs`, `README.md`, `docs/known-limitations.md`

---

### Task 1: `web/audience.js` pure logic + tests

**Files:**
- Create: `web/audience.js`, `tests/web_audience.test.mjs`

**Interfaces (Produces):**
- `monthKey(publishedAt)` → `"YYYY-MM"` or `null`
- `monthRangeKeys(firstKey, lastKey)` → contiguous `["2014-09", …]`
- `monthlyChannelStacks(videoRows, { metric = "uploads", topChannels = 6, otherLabel = "Andere" })` → `{ months: string[], channels: string[], rows: [{ month, monthIndex, values: number[], total }] }`; metric `"uploads"` counts rows, `"views"` sums numeric `view_count`; channels = top-N `channel_title` by overall metric plus a trailing other-bucket (only if a remainder exists); rows cover the full contiguous month range (gap months → zero values).
- `seasonMonthBands(seasonRows, months, champions)` → `[{ fromX, toX, label, shortLabel, seasonId }]` in month-index coordinates (fromX = index of start month − 0.5, toX = index of end month + 0.5, clamped to the month range); `label` = `"S<N> · 🏆 <champion>"` when a champion row exists (via `seasonId`), else the short season label; `shortLabel` = short season label; skips seasons without parseable `start_date`/`end_date`.
- `attentionStripPoints(matchHighlightRows, seasonId)` → `[{ x, weekLabel, z, matchLabel, videoUrls }]` sorted by week order (numeric prefix of the `week` string), one point per match with finite `views_trend_z_score_peak` (fallback `views_z_score_peak`), `matchLabel` = `"<player_a> <score> <player_b>"`.
- `stripSeasonIds(matchHighlightRows)` → sorted distinct season ids present.

**Steps:**

- [ ] **Step 1:** Write `tests/web_audience.test.mjs` (node:test `test()` style like `web_games.test.mjs`) with literal fixtures: video rows across a 4-month span with 3 channels (one dominating), a gap month, one row with empty `view_count`; season rows with ISO `start_date`/`end_date`; champion rows; match-highlight rows for two seasons with mixed z-score availability. Cover: monthKey parsing (valid ISO, empty → null), contiguous range with gap month zeros, top-channel selection + other-bucket + no-other-bucket-when-exact, views metric summing with non-numeric skip, band coordinates + champion label + shortLabel, strip sorting + z fallback + season filtering, stripSeasonIds.
- [ ] **Step 2:** Run `node --test tests/web_audience.test.mjs` → expect failures (module missing).
- [ ] **Step 3:** Implement `web/audience.js` (no DOM, no imports from app.js).
- [ ] **Step 4:** Run `node --test tests/web_audience.test.mjs` → PASS; run `node --test tests/*.mjs` → all green.
- [ ] **Step 5:** Commit `feat: add audience aggregation logic for Publikums-Geschichte`.

### Task 2: `stackedBarChart` in charts.js

**Files:**
- Modify: `web/charts.js`, `tests/web_charts.test.mjs`

**Interfaces (Produces):**
- `stackSegments(values)` → `[{ y0, y1 }]` cumulative stacking; non-finite values treated as 0; negative values stack downward from 0 (needed for the single-series attention strip if used as bars).
- `stackedBarChart(container, { rows, channels, months, bands, markers, height, formatX, formatY, tooltip, fallbackText })` — d3 SVG bar chart: x = band scale over `rows` (one bar per row, labeled via `formatX(monthIndex)`), y = linear over stacked totals (paddedDomain, floor 0 when all values ≥ 0); per-row segments as `rect.chart-bar.viz-series-N` (fill: `currentColor`), season bands + degradable band labels reusing the same label rules as `renderChart` (extract a shared `drawBandsWithLabels(root, labelLayer, bands, xScale, innerWidth, innerHeight)` where xScale maps numeric band coords — for the bar chart, month-index → pixel via a linear scale spanning the same range); tooltip on bar hover via `config.tooltip(row, channelIndex)`; resize/redraw + cleanup identical to `renderChart` (reuse `cleanupContainer`, ResizeObserver pattern).

**Steps:**

- [ ] **Step 1:** Add `stackSegments` tests to `tests/web_charts.test.mjs` (positive stack, zeros, non-finite → 0, negatives downward).
- [ ] **Step 2:** Run → FAIL (not exported).
- [ ] **Step 3:** Implement `stackSegments` (exported, pure) and `stackedBarChart` (DOM, untested — consistent with `lineChart`); refactor the band+label block of `renderChart` into the shared helper so both renderers use one implementation.
- [ ] **Step 4:** `node --test tests/*.mjs` → all green (refactor must not break chart suites).
- [ ] **Step 5:** Commit `feat: add stacked bar chart renderer to charts.js`.

### Task 3: Register `audience-history` view

**Files:**
- Modify: `web/view_config.js` (videos group `views: ["video-archive", "cinema", "audience-history"]`), `web/index.html` (subnav button `data-view="audience-history" data-view-group="videos" data-i18n="nav.audienceHistory"`; section `view-audience-history` with section-head + `#audience-metric` select + `#audience-chart` + legend div `#audience-legend` + strip block: `#audience-strip-season` select, `#audience-strip`), `web/app.js` (`VIEW_RENDERERS["audience-history"] = renderAudienceHistory` stub rendering the empty note; `VIEW_DATASETS["audience-history"] = ["videos", "matchHighlights"]`; add `"audience-history"` to `TOOLBAR_HIDDEN_VIEWS`), `web/i18n.js` (de+en: `nav.audienceHistory`, `sections.audienceHistoryTitle`, `sections.audienceHistoryDescription`, `audience.*` keys used in Task 4), tests: `tests/web_view_config.test.mjs` (videos group view list), `tests/web_shell.test.mjs` (section shell, renderer registration, toolbar-hidden, dataset mapping), `tests/web_loading.test.mjs` (dataset list), `tests/web_i18n.test.mjs` (new namespace keys).
- Test-first: update the four suites, watch them fail, then implement, then `node --test tests/*.mjs` green.

- [ ] Commit `feat: register audience-history view shell`.

### Task 4: `renderAudienceHistory` implementation + CSS

**Files:**
- Modify: `web/app.js`, `web/styles.css`, `web/i18n.js` (any keys still missing)

**Behavior:**
- Metric select (`audience.metricUploads` "Uploads pro Monat" / `audience.metricViews` "Aufrufe pro Monat"), stored in `state.audience = { metric: "uploads", stripSeason: null }` (session-only).
- `monthlyChannelStacks(state.data.videos ?? [], { metric, otherLabel: t(lang, "audience.otherChannels") })` → `stackedBarChart` in `#audience-chart`; bands from `seasonMonthBands(seasons, months, champions)`; formatX prints `"MM/YY"` on January + first/last ticks; formatY compact (`displayNumber`, views → `Math.round(v/1000) + "k"` above 10k); tooltip: month, per-channel value, total.
- Legend: one chip per channel (`.audience-legend .viz-series-N` colored square + name).
- Attention strip: season select from `stripSeasonIds(matchHighlights)` (default latest); `attentionStripPoints` → `stepChart` in `#audience-strip` (y = z-score, tooltip = matchLabel + z, zero-line via yDomain including 0); empty note when no highlight rows.
- Empty states via `.muted` notes when `videos` dataset absent.
- CSS: `#audience-chart` / `#audience-strip` height, `.audience-controls` centered row, legend chips.

**Steps:**

- [ ] Implement + verify in browser (Playwright: navigate `#/audience-history` after `window.location.reload()`, check bars render, metric toggle changes chart, band labels visible, strip renders for a chosen season, dark mode, EN toggle).
- [ ] `node --test tests/*.mjs` green.
- [ ] Commit `feat: render Publikums-Geschichte charts`.

### Task 5: `web/timeline_events.js` pure logic + tests

**Files:**
- Create: `web/timeline_events.js`, `tests/web_timeline_events.test.mjs`

**Interfaces (Produces):**
- `timelineEvents({ seasons, champions, videos, recordsProgression, matchVideos }, { topVideosPerYear = 3, milestoneSteps = [1, 100, 250, 500, 1000, 2000] })` → sorted ascending by `date` (`YYYY-MM-DD` from ISO timestamps): 
  - `season-start` / `season-end` per season row with parseable dates; `season-end` carries `champion` + `championPersonId` when a champions row matches `season_id`;
  - `top-video`: per calendar year, top `topVideosPerYear` archive rows by numeric `view_count` (`title`, `videoUrl`, `channel`, `viewCount`);
  - `record`: each `records_progression` row whose `match_id` resolves to ≥1 `match_videos` row with `published_at` (earliest wins) — carries `recordKey`, `holderName`, `value`, `seasonId`, `videoUrl` (progression row's own, fallback resolved video url); unresolved rows are dropped;
  - `milestone`: the Nth upload (chronological by `published_at`) for each step within range (`n`, `title`, `videoUrl`, `channel`).
  - Every event: `{ type, date, year, sourceUrls: [] }` (split from the row's `source_urls` / built from video urls).
- `groupEventsByYear(events)` → `[{ year, events }]` descending years (newest first), events ascending within the year.
- `onThisDayEvents(events, isoDate)` → events sharing the `MM-DD` of `isoDate` in an earlier year, each extended with `yearsAgo`, sorted by `yearsAgo` ascending.

**Steps:**

- [ ] **Step 1:** Write `tests/web_timeline_events.test.mjs` with literal fixtures (2 seasons w/ champions, one season missing dates, 6 videos across 2 years incl. tie-free top ranking + milestone step 1, progression rows with resolvable/unresolvable match ids, multi-video match → earliest date). Cover: ordering, champion attachment, top-per-year cutoff, record resolution + drop, milestone indexing, year grouping order, on-this-day matching (match, no-match, same-year excluded, Feb-29-free fixtures).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** `node --test tests/*.mjs` green.
- [ ] **Step 5:** Commit `feat: add timeline event builder logic`.

### Task 6: Register `zeitstrahl` view

**Files:**
- Modify: `web/view_config.js` (append `"zeitstrahl"` to videos group), `web/index.html` (subnav button `nav.zeitstrahl`; section `view-zeitstrahl` with section-head, widget card `#zeitstrahl-today` (date input `#zeitstrahl-date` + results div), timeline container `#zeitstrahl-body`), `web/app.js` (renderer stub, `VIEW_DATASETS.zeitstrahl = ["videos", "matchHighlights", "recordsProgression", "matchVideos"]` — matchHighlights not needed: use `["videos", "recordsProgression", "matchVideos"]`; `TOOLBAR_HIDDEN_VIEWS` += `"zeitstrahl"`), `web/i18n.js` (nav/sections + `zeitstrahl.*`), same four test suites as Task 3, test-first.
- [ ] Commit `feat: register zeitstrahl view shell`.

### Task 7: `renderZeitstrahl` implementation + CSS

**Behavior:**
- Top widget: date input defaulting to today (`new Date()` at render), on change re-render results: `onThisDayEvents(events, pickedDate)` list ("Vor {years} Jahren – {text}") or `zeitstrahl.noEvents` note.
- Year sections (newest first) from `groupEventsByYear`; each event a card row: type icon (🏁 start, 🏆 end/champion, 📈 top-video, 🏅 record, 🎬 milestone), formatted date + upload-date caveat marker (`zeitstrahl.uploadDate` tooltip/abbr "Upload-Datum"), event text via `formatMessage` templates, links (video link, person link for champions/records via `personLink`), source URLs via the existing source-link rendering.
- Event texts (de): seasonStart "„{season}" beginnt", seasonEnd "„{season}" endet – Champion: {champion}", topVideo "Top-Video {year}: „{title}" ({views} Aufrufe, {channel})", record "Rekord: {record} – {holder} ({value})", milestone "{n}. GPL-Video: „{title}""; record names reuse the existing `records.names.*` i18n namespace from Phase 2.
- Vertical timeline CSS: `.zeitstrahl-year` heading, `.zeitstrahl-event` grid (icon | date | text) with left border line, `.zeitstrahl-widget` standalone-card centered.

**Steps:**

- [ ] Implement; Playwright verify (`#/zeitstrahl` after reload: year sections render, widget defaults to today and finds/absents events, date change re-renders, record events link videos, EN + dark mode).
- [ ] `node --test tests/*.mjs` green.
- [ ] Commit `feat: render Zeitstrahl timeline with An-diesem-Tag widget`.

### Task 8: Docs + full gates

- [ ] README "Videos" bullet: mention Publikums-Geschichte + Zeitstrahl (computed, upload-date caveat).
- [ ] `docs/known-limitations.md`: new "Videos & Zeit (computed)" section — all dates are video upload dates; monthly stacks top-6 channels + Andere; attention strip needs match_highlights; record dates resolved via match_videos (unresolved records omitted from timeline); milestone numbering counts archive rows.
- [ ] Full gates: `python -m pytest -q`, `node --test tests/*.mjs`, `npm run validate`, `npm run check:generated`, `git diff --check`.
- [ ] Commit `docs: document Phase 5 Videos & Zeit`.

## Self-Review

- Spec coverage: uploads+views/month stacked by channel ✓ (T1/T2/T4), season shading ✓ (seasonMonthBands), champions annotated ✓ (band labels), attention strip ✓ (T1/T4), scrollable year timeline ✓ (T5/T7), event classes (season start/end+champion, top uploads, record falls via upload dates, milestones) ✓, upload-date labeling ✓, An-diesem-Tag widget with date picker defaulting today ✓, `videos` group placement + view ids ✓, optional teaser chip on default view: spec marks it optional ("only if it stays visually quiet") — deliberately skipped, noted in known-limitations.
- Types consistent: `monthlyChannelStacks().rows` feeds `stackedBarChart({ rows, channels, months })`; `seasonMonthBands` band shape `{fromX,toX,label,shortLabel}` matches the shared band drawer; `timelineEvents` event shape consumed by both `groupEventsByYear` and `onThisDayEvents`.
- No placeholders: all event texts, key names, and thresholds fixed above.
