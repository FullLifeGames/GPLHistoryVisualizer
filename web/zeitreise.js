import { normalizedStatsKey } from "./stats.js";
import { buildTimeline, eloHistory, killlistLeaderSeries, reconcileStandings, sampleLeaderValues, standingsHistory } from "./timeline.js";

// Playback engine plus the three d3 renderers. All colour comes from CSS custom
// properties via .viz-series-N classes, so switching theme needs no JS.

const MS_PER_TICK = 150;
const SEASON_END_HOLD_MS = 1600;
const HIGHLIGHT_SCORE_THRESHOLD = 55;
const HIGHLIGHT_CARDS_SHOWN = 3;
const LEAD_SERIES = 12;

const MARGIN = { top: 16, right: 132, bottom: 34, left: 46 };
const HEIGHT = 430;

const state = {
  track: "elo",
  tick: 0,
  playing: false,
  speed: 1,
  raf: 0,
  lastFrameAt: 0,
  holdUntil: 0,
  heldSeasonEnd: -1,
  bound: false,
  source: null,
  model: null,
  width: 0,
  eloScene: null,
  leadersScene: null,
  lastBoardKey: "",
  lastCardsTick: -1,
  lastCardsKey: null,
  mode: "all",
  modelMode: null,
};

const dom = {};
function cacheDom() {
  dom.canvas = document.querySelector("#zeitreise-canvas");
  dom.highlights = document.querySelector("#zeitreise-highlights");
  dom.legend = document.querySelector("#zeitreise-legend");
  dom.note = document.querySelector("#zeitreise-note");
  dom.play = document.querySelector("#zeitreise-play");
  dom.scrubber = document.querySelector("#zeitreise-scrubber");
  dom.position = document.querySelector("#zeitreise-position");
  dom.speed = document.querySelector("#zeitreise-speed");
  dom.mode = document.querySelector("#zeitreise-mode");
  dom.tableView = document.querySelector("#zeitreise-table-view-body");
  dom.stage = document.querySelector(".zeitreise-stage");
}

export function renderZeitreise(context) {
  cacheDom();
  if (!dom.canvas) return;

  if (state.source !== context.matches || state.modelMode !== state.mode) {
    state.source = context.matches;
    state.modelMode = state.mode;
    state.model = buildModel(context);
    state.tick = 0;
  }
  state.context = context;

  if (!state.model || !state.model.timeline.ticks.length) {
    dom.canvas.innerHTML = `<p class="empty">${context.translate("zeitreise.noData")}</p>`;
    return;
  }

  bindControls();
  dom.scrubber.max = String(state.model.timeline.ticks.length - 1);
  measure();
  invalidateRender();
  drawTrack();
  syncControls();
}

// Language, theme, data or size changed: throw away everything cached.
function invalidateRender() {
  state.eloScene = null;
  state.leadersScene = null;
  state.lastBoardKey = "";
  state.lastCardsTick = -1;
  state.lastCardsKey = null;
}

// Mirrors applyDataMode in app.js: the whole model is rebuilt on the chosen
// slice, so Elo, tables and the leader race all agree on what counts.
function matchesDataMode(row) {
  const division = row.division || "";
  if (state.mode === "all") return true;
  if (!division) return state.mode !== "league2";
  if (state.mode === "league2") return division === "Liga 2";
  return division !== "Liga 2";
}

function buildModel(context) {
  const matches = (context.matches ?? []).filter(matchesDataMode);
  const timeline = buildTimeline(matches);
  if (!timeline.ticks.length) return { timeline };

  const elo = eloHistory(matches, timeline);
  const tables = standingsHistory(timeline);

  // Leads are fixed for the whole playback: colour must follow the person, not
  // whoever happens to top the chart at the current tick.
  // Only eight categorical colours are CVD-safe, so leads 9-12 reuse colours
  // 1-4 with a dashed stroke (composite encoding); the permanent name labels
  // mean identity is never colour-alone anyway.
  const leads = [...elo.finalRatings.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LEAD_SERIES)
    .map(([key], index) => [key, index + 1]);
  const leadSlot = new Map(leads);
  const nameByKey = new Map(elo.players.map((player) => [player.key, player.name]));

  // A rating is carried forward forever once earned, so a line drawn over every
  // tick would run flat to the right edge long after the person stopped playing.
  // Each line ends on the tick of that person's last recorded match.
  const lastActive = new Map();
  timeline.ticks.forEach((tick, index) => {
    for (const row of tick.matches) {
      lastActive.set(normalizedStatsKey(row.player_a || row.team_a), index);
      lastActive.set(normalizedStatsKey(row.player_b || row.team_b), index);
    }
  });

  const tracks = new Map();
  for (const [key] of elo.finalRatings) {
    const end = lastActive.get(key) ?? timeline.ticks.length - 1;
    const points = [];
    timeline.ticks.slice(0, end + 1).forEach((tick, index) => {
      const rating = elo.frames[index].get(key);
      if (rating !== undefined) points.push([index, rating]);
    });
    if (points.length) tracks.set(key, points);
  }

  const ratings = elo.frames.flatMap((frame) => [...frame.values()]);
  const seasonIds = timeline.seasons.map((season) => season.seasonId);

  return {
    timeline,
    elo,
    tables,
    leadSlot,
    nameByKey,
    tracks,
    eloDomain: [Math.min(...ratings), Math.max(...ratings)],
    seasonIds,
    seasonEnds: timeline.seasons.map((season) => season.lastTick),
    leaderSeries: killlistLeaderSeries((context.killlists ?? []).filter(matchesDataMode), seasonIds),
    highlights: groupHighlights(context.highlights ?? [], timeline),
    championsBySeason: groupChampions(context.champions ?? []),
    divisionBySeason: pickDivisions(timeline, tables),
  };
}

// Season 9 has three champions: Victory Instinct took the title as a team.
function groupChampions(rows) {
  const bySeason = new Map();
  for (const row of rows) {
    if (!row.champion_name) continue;
    if (!bySeason.has(row.season_id)) bySeason.set(row.season_id, []);
    bySeason.get(row.season_id).push(row);
  }
  return bySeason;
}

// Highlight cards are keyed by the tick their match sits on, so the playhead
// crossing a tick is all it takes to fire them.
function groupHighlights(rows, timeline) {
  const tickBySeasonWeek = new Map();
  timeline.ticks.forEach((tick) => {
    for (const row of tick.matches) tickBySeasonWeek.set(`${row.season_id}#${row.match_id}`, tick.index);
  });

  const byTick = new Map();
  for (const row of rows) {
    const score = Number(row.highlight_score);
    if (!Number.isFinite(score) || score < HIGHLIGHT_SCORE_THRESHOLD) continue;
    const index = tickBySeasonWeek.get(`${row.season_id}#${row.match_id}`);
    if (index === undefined) continue;
    if (!byTick.has(index)) byTick.set(index, []);
    byTick.get(index).push(row);
  }
  for (const list of byTick.values()) list.sort((a, b) => Number(b.highlight_score) - Number(a.highlight_score));
  return byTick;
}

// One table per season: the division that carries the most players.
// The replay board shows one division per season: the main league first.
// Size alone would pick the wrong board — S3's Liga 2 table carries more
// person rows than Liga 1 because every mid-season controller gets a row.
const DIVISION_BOARD_PRIORITY = new Map([
  ["Liga 1", 0],
  ["Regular Season", 0],
  ["Tag Team", 0],
  ["Sun Conference", 1],
  ["Moon Conference", 1],
  ["Liga 2", 2],
]);

function pickDivisions(timeline, tables) {
  const chosen = new Map();
  for (const season of timeline.seasons) {
    let best = null;
    for (const [division, frames] of tables.get(season.seasonId)) {
      if (division === "Playoffs") continue;
      const priority = DIVISION_BOARD_PRIORITY.get(division) ?? 1;
      const size = frames[frames.length - 1]?.length ?? 0;
      if (!best || priority < best.priority || (priority === best.priority && size > best.size)) {
        best = { division, priority, size };
      }
    }
    if (best) chosen.set(season.seasonId, best.division);
  }
  return chosen;
}

function bindControls() {
  if (state.bound) return;
  state.bound = true;

  dom.play.addEventListener("click", () => (state.playing ? pause() : play()));
  dom.speed.addEventListener("change", () => {
    state.speed = Number(dom.speed.value) || 1;
  });
  dom.mode?.addEventListener("change", () => {
    pause();
    state.mode = dom.mode.value;
    renderZeitreise(state.context);
  });
  dom.scrubber.addEventListener("input", () => {
    // Read before pausing: pause() runs syncControls(), which would write the
    // old tick back into the scrubber and swallow the drag.
    const requested = Number(dom.scrubber.value);
    pause();
    state.tick = clampTick(requested);
    drawTrack();
    syncControls();
  });

  document.querySelectorAll("[data-zeitreise-track]").forEach((button) => {
    button.addEventListener("click", () => {
      state.track = button.dataset.zeitreiseTrack;
      document.querySelectorAll("[data-zeitreise-track]").forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-selected", String(active));
      });
      invalidateRender();
      drawTrack();
      syncControls();
    });
  });

  dom.stage.addEventListener("keydown", onKeydown);
  dom.stage.setAttribute("tabindex", "0");

  globalThis.addEventListener("resize", () => {
    if (!state.model || !document.querySelector("#view-zeitreise")?.classList.contains("is-active")) return;
    measure();
    invalidateRender();
    drawTrack();
  });
}

function onKeydown(event) {
  if (event.key === " ") {
    event.preventDefault();
    state.playing ? pause() : play();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    step(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    step(-1);
  }
}

function step(delta) {
  pause();
  state.tick = clampTick(Math.round(state.tick) + delta);
  drawTrack();
  syncControls();
}

function clampTick(value) {
  return Math.max(0, Math.min(state.model.timeline.ticks.length - 1, value));
}

function play() {
  if (state.playing) return;
  if (state.tick >= state.model.timeline.ticks.length - 1) state.tick = 0;
  state.playing = true;
  state.holdUntil = 0;
  state.heldSeasonEnd = -1;
  state.lastFrameAt = performance.now();
  state.raf = requestAnimationFrame(tickLoop);
  syncControls();
}

function pause() {
  state.playing = false;
  state.holdUntil = 0;
  cancelAnimationFrame(state.raf);
  syncControls();
}

function tickLoop(now) {
  // Season ends are chapter breaks: playback rests there so the final table,
  // the crowning and the reconcile line are readable before the cut.
  if (now < state.holdUntil) {
    state.lastFrameAt = now;
    state.raf = requestAnimationFrame(tickLoop);
    return;
  }

  const elapsed = now - state.lastFrameAt;
  state.lastFrameAt = now;
  const previous = state.tick;
  state.tick += (elapsed / MS_PER_TICK) * state.speed;

  const last = state.model.timeline.ticks.length - 1;
  const crossed = state.model.seasonEnds.find((end) => previous <= end && state.tick > end && state.heldSeasonEnd !== end);
  if (crossed !== undefined && crossed < last) {
    state.tick = crossed;
    state.heldSeasonEnd = crossed;
    state.holdUntil = now + SEASON_END_HOLD_MS;
  }

  if (state.tick >= last) {
    state.tick = last;
    pause();
  } else {
    state.raf = requestAnimationFrame(tickLoop);
  }
  drawTrack();
  syncControls();
}

function syncControls() {
  const translate = state.context.translate;
  dom.play.textContent = state.playing ? "❚❚" : "▶";
  dom.play.setAttribute("aria-label", translate(state.playing ? "zeitreise.pause" : "zeitreise.play"));
  dom.scrubber.value = String(Math.round(state.tick));
  const tick = state.model.timeline.ticks[clampTick(Math.round(state.tick))];
  dom.position.textContent = state.track === "meta" ? seasonLabel(tick?.seasonId ?? "") : tickLabel(tick);
}

function seasonLabel(seasonId) {
  const number = Number(String(seasonId).replace(/\D+/g, ""));
  return Number.isFinite(number) ? `S${number}` : seasonId;
}

function tickLabel(tick) {
  if (!tick) return "";
  const translate = state.context.translate;
  const phaseKeys = {
    vorrunde: "zeitreise.phaseVorrunde",
    viertelfinale: "zeitreise.phaseViertelfinale",
    halbfinale: "zeitreise.phaseHalbfinale",
    platz3: "zeitreise.phasePlatz3",
    finale: "zeitreise.phaseFinale",
    playoffs: "zeitreise.phasePlayoffs",
  };
  const detail = tick.kind === "matchday" ? `${translate("zeitreise.matchday")} ${tick.weekNumber}` : translate(phaseKeys[tick.phase] ?? "zeitreise.phasePlayoffs");
  return `${seasonLabel(tick.seasonId)} · ${detail}`;
}

function measure() {
  state.width = Math.max(520, dom.canvas.clientWidth || 900);
}

function drawTrack() {
  const intTick = clampTick(Math.round(state.tick));
  // The leader race is a pure season view: no matchday-bound highlight cards.
  if (state.track === "meta") {
    if (dom.highlights.innerHTML) {
      dom.highlights.innerHTML = "";
      state.lastCardsKey = null;
    }
    drawLeaders();
    return;
  }
  if (intTick !== state.lastCardsTick) {
    renderHighlightCards();
    state.lastCardsTick = intTick;
  }
  if (state.track === "elo") {
    drawElo();
    return;
  }
  const boardKey = `table#${intTick}`;
  if (boardKey === state.lastBoardKey) return;
  state.lastBoardKey = boardKey;
  drawTable();
}

/* ------------------------------------------------------------------ shared */

function leadClasses(position) {
  return `viz-series-${((position - 1) % 8) + 1}${position > 8 ? " is-dashed" : ""}`;
}

function svgRoot() {
  const d3 = globalThis.d3;
  dom.canvas.innerHTML = "";
  return d3
    .select(dom.canvas)
    .append("svg")
    .attr("viewBox", `0 0 ${state.width} ${HEIGHT}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("role", "img");
}

function drawSeasonBands(svg, x) {
  const bands = svg.append("g");
  state.model.timeline.seasons.forEach((season, index) => {
    if (index % 2 === 1) return;
    bands
      .append("rect")
      .attr("class", "zeitreise-band")
      .attr("x", x(season.firstTick))
      .attr("y", MARGIN.top)
      .attr("width", Math.max(1, x(season.lastTick) - x(season.firstTick)))
      .attr("height", HEIGHT - MARGIN.top - MARGIN.bottom);
  });
  state.model.timeline.seasons.forEach((season) => {
    bands
      .append("text")
      .attr("class", "zeitreise-season-label")
      .attr("x", (x(season.firstTick) + x(season.lastTick)) / 2)
      .attr("y", HEIGHT - MARGIN.bottom + 16)
      .attr("text-anchor", "middle")
      .text(seasonLabel(season.seasonId));
  });
}

function interpolatedRating(points, tick) {
  let previous = null;
  for (const point of points) {
    if (point[0] > tick) {
      if (!previous) return null;
      const span = point[0] - previous[0];
      const ratio = span > 0 ? (tick - previous[0]) / span : 0;
      return previous[1] + (point[1] - previous[1]) * ratio;
    }
    previous = point;
  }
  return previous ? previous[1] : null;
}

/* -------------------------------------------------------------- Elo track */

// The 69 curve paths, bands, grid and axis never change during playback, so
// they are built once and cached; every frame only moves the clip rectangle,
// the playhead and the eight labels. Rebuilding everything per frame is what
// made playback stutter.
function eloScene() {
  const cached = state.eloScene;
  if (cached && cached.width === state.width && dom.canvas.firstElementChild === cached.node) return cached;

  const d3 = globalThis.d3;
  const model = state.model;
  const svg = svgRoot();

  const x = d3.scaleLinear().domain([0, model.timeline.ticks.length - 1]).range([MARGIN.left, state.width - MARGIN.right]);
  const y = d3.scaleLinear().domain(model.eloDomain).nice().range([HEIGHT - MARGIN.bottom, MARGIN.top]);

  drawSeasonBands(svg, x);

  svg
    .append("g")
    .attr("class", "zeitreise-grid")
    .selectAll("line")
    .data(y.ticks(5))
    .join("line")
    .attr("x1", MARGIN.left)
    .attr("x2", state.width - MARGIN.right)
    .attr("y1", (value) => y(value))
    .attr("y2", (value) => y(value));

  svg.append("g").attr("class", "zeitreise-axis").attr("transform", `translate(${MARGIN.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0)).call((group) => group.select(".domain").remove());

  const line = d3.line().curve(d3.curveMonotoneX).x((point) => x(point[0])).y((point) => y(point[1]));

  const clipId = "zeitreise-elo-clip";
  const clip = svg.append("clipPath").attr("id", clipId).append("rect").attr("x", 0).attr("y", 0).attr("width", 0).attr("height", HEIGHT);

  const plot = svg.append("g").attr("clip-path", `url(#${clipId})`);
  const ghosts = [...model.tracks.entries()].filter(([key]) => !model.leadSlot.has(key));
  plot
    .append("g")
    .selectAll("path")
    .data(ghosts)
    .join("path")
    .attr("class", "zeitreise-line is-ghost")
    .attr("d", ([, points]) => line(points));

  const leads = [...model.tracks.entries()].filter(([key]) => model.leadSlot.has(key));
  plot
    .append("g")
    .selectAll("path")
    .data(leads)
    .join("path")
    .attr("class", ([key]) => `zeitreise-line ${leadClasses(model.leadSlot.get(key))}`)
    .attr("d", ([, points]) => line(points));

  // Highlight matchdays get a permanent marker on the axis line; the clip
  // reveals them as the playhead passes, and they stay. Native <title> gives
  // the match and the reason on hover.
  const markers = plot.append("g");
  for (const [tickIndex, rows] of model.highlights) {
    const marker = markers
      .append("text")
      .attr("class", "zeitreise-highlight-marker")
      .attr("x", x(tickIndex))
      .attr("y", HEIGHT - MARGIN.bottom - 4)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .text("⚡");
    marker.append("title").text(rows.map((row) => `${row.player_a} ${row.score || ""} ${row.player_b} — ${row.highlight_reasons || ""}`).join("\n"));
  }

  const playhead = svg.append("line").attr("class", "zeitreise-playhead").attr("y1", MARGIN.top).attr("y2", HEIGHT - MARGIN.bottom);
  const labelGroup = svg.append("g");

  const scene = { node: dom.canvas.firstElementChild, width: state.width, x, y, clip, playhead, labelGroup, leads, lastIntTick: -1 };
  bindEloHover(svg, scene);
  state.eloScene = scene;
  return scene;
}

// Hovering names any line, including the grey ones: every person's rating at
// the hovered matchday, nearest line wins.
function bindEloHover(svg, scene) {
  const tooltip = document.createElement("div");
  tooltip.className = "zeitreise-tooltip";
  tooltip.hidden = true;
  dom.stage.appendChild(tooltip);
  scene.tooltip = tooltip;

  const model = state.model;
  svg.on("pointermove", (event) => {
    const [pointerX, pointerY] = globalThis.d3.pointer(event);
    const tick = Math.max(0, Math.min(model.timeline.ticks.length - 1, scene.x.invert(pointerX)));
    if (tick > state.tick) {
      tooltip.hidden = true;
      return;
    }
    let best = null;
    for (const [key, points] of model.tracks) {
      if (points[0][0] > tick) continue;
      const rating = interpolatedRating(points, Math.min(tick, points[points.length - 1][0]));
      if (rating === null) continue;
      const distance = Math.abs(scene.y(rating) - pointerY);
      if (!best || distance < best.distance) best = { key, rating, distance };
    }
    if (!best || best.distance > 18) {
      tooltip.hidden = true;
      return;
    }
    const tickIndex = clampTick(Math.round(tick));
    tooltip.innerHTML = `<strong>${escapeHtml(model.nameByKey.get(best.key) ?? "")}</strong><dl><dt>${escapeHtml(tickLabel(model.timeline.ticks[tickIndex]))}</dt><dd>${Math.round(best.rating)}</dd></dl>`;
    tooltip.hidden = false;
    const stageBox = dom.stage.getBoundingClientRect();
    const left = Math.min(event.clientX - stageBox.left + 14, stageBox.width - tooltip.offsetWidth - 8);
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${event.clientY - stageBox.top + 14}px`;
  });
  svg.on("pointerleave", () => {
    tooltip.hidden = true;
  });
}

function drawElo() {
  const model = state.model;
  const scene = eloScene();
  const { x, y } = scene;

  scene.clip.attr("width", Math.max(0, x(state.tick)));
  scene.playhead.attr("x1", x(state.tick)).attr("x2", x(state.tick));

  // Direct labels are mandatory relief: three light-mode slots sit below 3:1.
  // Each label sits at the end of its own line, which is the playhead while the
  // person is still active and their final matchday once they have stopped.
  const placed = scene.leads
    .filter(([, points]) => points[0][0] <= state.tick)
    .map(([key, points]) => {
      const end = Math.min(state.tick, points[points.length - 1][0]);
      return { key, end, rating: interpolatedRating(points, end) };
    })
    .filter((entry) => entry.rating !== null)
    .sort((a, b) => b.rating - a.rating);

  // Push apart only labels whose boxes actually collide; two labels far apart
  // on the x axis never do, however close their ratings are.
  const boxes = [];
  for (const entry of placed) {
    const text = `${model.nameByKey.get(entry.key)} ${Math.round(entry.rating)}`;
    const left = x(entry.end) + 8;
    const right = left + text.length * 6.6;
    let top = y(entry.rating) - 7;
    while (boxes.some((box) => left < box.right && right > box.left && top < box.bottom && top + 14 > box.top)) top += 4;
    boxes.push({ left, right, top, bottom: top + 14 });
    entry.labelY = top + 7;
    entry.text = text;
  }

  scene.labelGroup
    .selectAll("circle")
    .data(placed, (entry) => entry.key)
    .join("circle")
    .attr("class", (entry) => `zeitreise-dot ${leadClasses(model.leadSlot.get(entry.key))}`)
    .attr("cx", (entry) => x(entry.end))
    .attr("cy", (entry) => y(entry.rating))
    .attr("r", 4);

  scene.labelGroup
    .selectAll("text")
    .data(placed, (entry) => entry.key)
    .join("text")
    .attr("class", "zeitreise-label")
    .attr("x", (entry) => x(entry.end) + 10)
    .attr("y", (entry) => entry.labelY + 4)
    .text((entry) => entry.text);

  const intTick = clampTick(Math.round(state.tick));
  if (intTick !== scene.lastIntTick) {
    scene.lastIntTick = intTick;
    renderLegend(scene.leads.map(([key]) => ({ position: model.leadSlot.get(key), label: model.nameByKey.get(key) })));
    dom.note.textContent = state.context.translate("zeitreise.eloNote");
    renderEloTableView(intTick);
  }
}

// The table view lists everyone, not just the eight coloured leads — it is the
// hover tooltip's keyboard-reachable twin.
function renderEloTableView(tickIndex) {
  const translate = state.context.translate;
  const model = state.model;
  const rows = [...model.tracks.entries()]
    .filter(([, points]) => points[0][0] <= tickIndex)
    .map(([key, points]) => ({ key, rating: interpolatedRating(points, Math.min(tickIndex, points[points.length - 1][0])) }))
    .filter((entry) => entry.rating !== null)
    .sort((a, b) => b.rating - a.rating);
  dom.tableView.innerHTML = `
    <table>
      <thead><tr><th>${escapeHtml(translate("zeitreise.columnRank"))}</th><th>${escapeHtml(translate("zeitreise.eloColumnPerson"))}</th><th>${escapeHtml(translate("zeitreise.eloColumnElo"))}</th></tr></thead>
      <tbody>${rows
        .map((entry, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(model.nameByKey.get(entry.key) ?? "")}</td><td>${Math.round(entry.rating)}</td></tr>`)
        .join("")}</tbody>
    </table>`;
}

/* ------------------------------------------------------------ Season table */

function phaseLabel(phase) {
  const translate = state.context.translate;
  const keys = {
    vorrunde: "zeitreise.phaseVorrunde",
    viertelfinale: "zeitreise.phaseViertelfinale",
    halbfinale: "zeitreise.phaseHalbfinale",
    platz3: "zeitreise.phasePlatz3",
    finale: "zeitreise.phaseFinale",
    playoffs: "zeitreise.phasePlayoffs",
  };
  return translate(keys[phase] ?? "zeitreise.phasePlayoffs");
}

function championBadge(names) {
  const translate = state.context.translate;
  return `<span class="zeitreise-badge">🏆 ${escapeHtml(translate("zeitreise.champion"))}</span>${names ? ` ${escapeHtml(names)}` : ""}`;
}

function drawTable() {
  const model = state.model;
  const tickIndex = clampTick(Math.round(state.tick));
  const tick = model.timeline.ticks[tickIndex];
  const season = model.timeline.seasons.find((item) => item.seasonId === tick.seasonId);

  if (tick.kind === "playoff") {
    drawPlayoffPanel(season, tickIndex);
    return;
  }

  const division = model.divisionBySeason.get(tick.seasonId);
  const frames = model.tables.get(tick.seasonId)?.get(division) ?? [];
  const rows = frames[tickIndex - season.firstTick] ?? [];
  const translate = state.context.translate;

  // In seasons with playoffs the crowning happens on the playoff panel; here
  // the crown appears only when the regular season IS the whole season.
  const atSeasonEnd = tickIndex === season.lastTick;
  const champions = atSeasonEnd ? (model.championsBySeason.get(tick.seasonId) ?? []) : [];
  const championKeys = new Set(champions.map((row) => normalizeName(row.champion_name)));
  const lastRegularTick = regularSeasonEndTick(season);

  dom.canvas.innerHTML = `
    <div class="zeitreise-board-title"><strong>${escapeHtml(seasonLabel(tick.seasonId))}</strong> · ${escapeHtml(division)} · ${escapeHtml(tickLabel(tick).split(" · ")[1] ?? "")}</div>
    <div class="zeitreise-row zeitreise-head">
      <span>#</span>
      <span class="zeitreise-row-name">${escapeHtml(translate("zeitreise.columnPerson"))}</span>
      <span>${escapeHtml(translate("zeitreise.columnWins"))}</span>
      <span>${escapeHtml(translate("zeitreise.columnLosses"))}</span>
      <span>${escapeHtml(translate("zeitreise.columnDraws"))}</span>
      <span>${escapeHtml(translate("zeitreise.columnDiff"))}</span>
      <span>${escapeHtml(translate("zeitreise.columnPoints"))}</span>
    </div>
    <div class="zeitreise-standings" style="height:${rows.length * 34}px"></div>`;
  const board = dom.canvas.querySelector(".zeitreise-standings");

  // Rows are keyed per season: a rank change within a season glides, but a
  // season change swaps the whole board. Without the season in the key, a
  // player present in both seasons would glide from the old table's rank into
  // the new one, as if the standings carried over.
  const d3 = globalThis.d3;
  d3.select(board)
    .selectAll("div.zeitreise-row")
    .data(rows, (row) => `${tick.seasonId}#${row.key}`)
    .join((enter) => enter.append("div").attr("class", "zeitreise-row"))
    .classed("is-champion", (row) => championKeys.has(normalizeName(row.name)))
    .style("transform", (row) => `translateY(${(row.rank - 1) * 34}px)`)
    .html(
      (row) => `
        <span>${row.rank}</span>
        <span class="zeitreise-row-name">${escapeHtml(row.name)}${championKeys.has(normalizeName(row.name)) ? ` ${championBadge("")}` : ""}</span>
        <span>${row.wins}</span>
        <span>${row.losses}</span>
        <span>${row.draws}</span>
        <span>${row.diff > 0 ? "+" + row.diff : row.diff}</span>
        <span>${row.points}</span>`,
    );

  renderLegend([]);
  dom.note.textContent = translate("zeitreise.tableNote");
  renderTableView(rows, tickIndex >= lastRegularTick ? reconcileNote(rows, tick.seasonId, division) : "");
}

function regularSeasonEndTick(season) {
  let last = season.firstTick;
  for (let index = season.firstTick; index <= season.lastTick; index += 1) {
    if (state.model.timeline.ticks[index].kind === "matchday") last = index;
  }
  return last;
}

// During playoff ticks the frozen league table gives way to the knockout
// rounds themselves: every round played so far, its matches and, at the final
// tick, the crowning.
function drawPlayoffPanel(season, tickIndex) {
  const model = state.model;
  const translate = state.context.translate;
  const seasonId = season.seasonId;

  const playoffTicks = [];
  for (let index = season.firstTick; index <= Math.min(tickIndex, season.lastTick); index += 1) {
    const tick = model.timeline.ticks[index];
    if (tick.kind === "playoff") playoffTicks.push(tick);
  }

  const atSeasonEnd = tickIndex === season.lastTick;
  const champions = atSeasonEnd ? (model.championsBySeason.get(seasonId) ?? []) : [];

  const rounds = playoffTicks
    .map(
      (tick) => `
      <section class="zeitreise-playoff-round">
        <h4>${escapeHtml(phaseLabel(tick.phase))}</h4>
        ${tick.matches
          .map((row) => {
            const winner = normalizeName(row.winner);
            const side = (name, score) => {
              const isWinner = winner && normalizeName(name) === winner;
              return `<span class="zeitreise-playoff-side${isWinner ? " is-winner" : ""}">${escapeHtml(name)}</span><span class="zeitreise-playoff-score">${escapeHtml(score || "–")}</span>`;
            };
            return `<div class="zeitreise-playoff-match">${side(row.player_a, row.score_a)}${side(row.player_b, row.score_b)}</div>`;
          })
          .join("")}
      </section>`,
    )
    .join("");

  const crowning = champions.length
    ? `<p class="zeitreise-playoff-crowning">🏆 ${escapeHtml(translate("zeitreise.champion"))}: <strong>${champions.map((row) => escapeHtml(row.champion_name)).join(", ")}</strong>${champions[0]?.champion_team ? ` (${escapeHtml(champions[0].champion_team)})` : ""}</p>`
    : "";

  dom.canvas.innerHTML = `
    <div class="zeitreise-board-title"><strong>${escapeHtml(seasonLabel(seasonId))}</strong> · ${escapeHtml(translate("zeitreise.phasePlayoffs"))} · ${escapeHtml(phaseLabel(playoffTicks[playoffTicks.length - 1]?.phase))}</div>
    <div class="zeitreise-playoffs">${rounds}</div>
    ${crowning}`;

  renderLegend([]);
  dom.note.textContent = translate("zeitreise.playoffsNote");
  renderPlayoffTableView(playoffTicks);
}

function renderPlayoffTableView(playoffTicks) {
  const translate = state.context.translate;
  dom.tableView.innerHTML = `
    <table>
      <thead><tr><th>${escapeHtml(translate("zeitreise.playoffColumnRound"))}</th><th>${escapeHtml(translate("zeitreise.columnPerson"))} A</th><th></th><th>${escapeHtml(translate("zeitreise.columnPerson"))} B</th><th>${escapeHtml(translate("zeitreise.playoffColumnWinner"))}</th></tr></thead>
      <tbody>${playoffTicks
        .flatMap((tick) =>
          tick.matches.map(
            (row) =>
              `<tr><td>${escapeHtml(phaseLabel(tick.phase))}</td><td>${escapeHtml(row.player_a)}</td><td>${escapeHtml(row.score_a || "")} - ${escapeHtml(row.score_b || "")}</td><td>${escapeHtml(row.player_b)}</td><td>${escapeHtml(row.winner || "")}</td></tr>`,
          ),
        )
        .join("")}</tbody>
    </table>`;
}

function reconcileNote(rows, seasonId, division) {
  const translate = state.context.translate;
  const reconciled = reconcileStandings(rows, state.context.standings ?? [], { seasonId, division });
  const withOfficial = reconciled.filter((row) => row.official);
  if (!withOfficial.length) return translate("zeitreise.reconcileMissing");

  const drifting = withOfficial.filter((row) => row.pointsDelta !== 0 || row.matchesDelta !== 0);
  if (!drifting.length) return translate("zeitreise.reconcileExact");

  // Season 10 plays a 13th matchday the official table ignores, so every person
  // carries the same surplus. A scattered delta means genuinely missing battles.
  const deltas = new Set(withOfficial.map((row) => row.matchesDelta));
  const surplus = [...deltas][0];
  if (deltas.size === 1 && drifting.length === withOfficial.length && surplus > 0) {
    if (surplus === 1) return translate("zeitreise.reconcileExtraMatchday");
    return translate("zeitreise.reconcileExtraMatchdays").replace("{matches}", String(surplus));
  }
  return translate("zeitreise.reconcileGaps").replace("{people}", String(drifting.length)).replace("{total}", String(withOfficial.length));
}

function renderTableView(rows, note) {
  const translate = state.context.translate;
  dom.tableView.innerHTML = `
    ${note ? `<p class="zeitreise-note"><strong>${escapeHtml(translate("zeitreise.reconcileHeading"))}:</strong> ${escapeHtml(note)}</p>` : ""}
    <table>
      <thead><tr>
        <th>${escapeHtml(translate("zeitreise.columnRank"))}</th>
        <th>${escapeHtml(translate("zeitreise.columnPerson"))}</th>
        <th>${escapeHtml(translate("zeitreise.columnWins"))}</th>
        <th>${escapeHtml(translate("zeitreise.columnLosses"))}</th>
        <th>${escapeHtml(translate("zeitreise.columnDraws"))}</th>
        <th>${escapeHtml(translate("zeitreise.columnDiff"))}</th>
        <th>${escapeHtml(translate("zeitreise.columnPoints"))}</th>
      </tr></thead>
      <tbody>${rows
        .map((row) => `<tr><td>${row.rank}</td><td>${escapeHtml(row.name)}</td><td>${row.wins}</td><td>${row.losses}</td><td>${row.draws}</td><td>${row.diff > 0 ? "+" + row.diff : row.diff}</td><td>${row.points}</td></tr>`)
        .join("")}</tbody>
    </table>`;
}

/* --------------------------------------------------- Killlist leader track */

// A season-axis bar race: cumulative kills interpolate linearly inside each
// season (the user opted into the smoothing; only whole-season values are
// measured), rows glide as interpolated values cross, bars grow every frame.
// Matchdays play no role on this track.
function leaderPosition() {
  const timeline = state.model.timeline;
  const season = timeline.seasons.find((item) => state.tick <= item.lastTick) ?? timeline.seasons[timeline.seasons.length - 1];
  const progress = Math.max(0, Math.min(1, (state.tick - season.firstTick + 1) / season.tickCount));
  return { season, position: season.index + progress };
}

function leadersScene() {
  const cached = state.leadersScene;
  if (cached && dom.canvas.firstElementChild === cached.node) return cached;

  const translate = state.context.translate;
  const series = state.model.leaderSeries;
  const icon = state.context.pokemonIcon ?? (() => "");
  const visible = series.topN;

  dom.canvas.innerHTML = `
    <div class="zeitreise-board-title"></div>
    <div class="zeitreise-row zeitreise-leader-row zeitreise-head">
      <span>#</span>
      <span class="zeitreise-row-name">${escapeHtml(translate("zeitreise.metaColumnPokemon"))}</span>
      <span></span>
      <span>${escapeHtml(translate("zeitreise.metaColumnKills"))}</span>
      <span>${escapeHtml(translate("zeitreise.metaColumnShare"))}</span>
    </div>
    <div class="zeitreise-standings zeitreise-leaders" style="height:${visible * 34}px"></div>`;

  const board = dom.canvas.querySelector(".zeitreise-leaders");
  const rows = new Map();
  for (const entry of series.pokemon) {
    const row = document.createElement("div");
    row.className = "zeitreise-row zeitreise-leader-row";
    row.innerHTML = `
      <span></span>
      <span class="zeitreise-row-name">${icon(entry.name)} ${escapeHtml(entry.name)}</span>
      <span class="zeitreise-leader-bar"><span></span></span>
      <span></span>
      <span></span>`;
    board.appendChild(row);
    rows.set(entry.key, {
      element: row,
      rank: row.children[0],
      bar: row.children[2].firstElementChild,
      kills: row.children[3],
      share: row.children[4],
    });
  }

  const scene = {
    node: dom.canvas.firstElementChild,
    title: dom.canvas.querySelector(".zeitreise-board-title"),
    rows,
    visible,
    lastSeasonId: null,
  };
  state.leadersScene = scene;
  return scene;
}

function drawLeaders() {
  const model = state.model;
  const translate = state.context.translate;
  const series = model.leaderSeries;
  if (!series.pokemon.length) return;

  const scene = leadersScene();
  const { season, position } = leaderPosition();
  const { values, total } = sampleLeaderValues(series, position);

  const ranked = series.pokemon
    .map((entry) => ({ key: entry.key, value: values.get(entry.key) ?? 0 }))
    .sort((a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)));
  const best = ranked[0]?.value ?? 1;

  ranked.forEach((entry, index) => {
    const row = scene.rows.get(entry.key);
    if (!row) return;
    const onBoard = index < scene.visible && entry.value > 0;
    row.element.style.visibility = onBoard ? "visible" : "hidden";
    if (!onBoard) return;
    row.element.style.transform = `translateY(${index * 34}px)`;
    row.element.classList.toggle("is-champion", entry.value === best);
    row.rank.textContent = String(index + 1);
    row.bar.style.width = `${best > 0 ? Math.round((entry.value / best) * 100) : 0}%`;
    row.kills.textContent = String(Math.round(entry.value));
    row.share.textContent = total > 0 ? `${((entry.value / total) * 100).toFixed(1)}%` : "";
  });

  if (scene.lastSeasonId !== season.seasonId) {
    scene.lastSeasonId = season.seasonId;
    scene.title.innerHTML = `<strong>S1–S${season.index + 1}</strong> · ${escapeHtml(translate("zeitreise.leadersTitle"))}`;
    renderLegend([]);
    renderLeadersTableView(series, season.index);
  }
  dom.note.textContent = translate("zeitreise.leadersNote").replace("{kills}", String(Math.round(total)));
}

// The table view shows the measured season boundary, not the interpolation.
function renderLeadersTableView(series, seasonIndex) {
  const translate = state.context.translate;
  const measured = series.cumulativeBySeason[seasonIndex] ?? new Map();
  const rows = series.pokemon
    .map((entry) => ({ name: entry.name, kills: measured.get(entry.key) ?? 0 }))
    .sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name))
    .slice(0, series.topN);
  const total = series.totals[seasonIndex] ?? 0;
  dom.tableView.innerHTML = `
    <table>
      <thead><tr><th>${escapeHtml(translate("zeitreise.columnRank"))}</th><th>${escapeHtml(translate("zeitreise.metaColumnPokemon"))}</th><th>${escapeHtml(translate("zeitreise.metaColumnKills"))}</th><th>${escapeHtml(translate("zeitreise.metaColumnShare"))}</th></tr></thead>
      <tbody>${rows
        .map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.name)}</td><td>${row.kills}</td><td>${total > 0 ? ((row.kills / total) * 100).toFixed(1) : 0}%</td></tr>`)
        .join("")}</tbody>
    </table>`;
}

/* ------------------------------------------------------------- highlights */

// Passed highlights accumulate instead of flashing: the panel shows the
// newest cards of the current season and each one stays until the playhead
// passes the next. Cards are keyed so a re-render does not restart the pop
// animation of cards already on screen.
function renderHighlightCards() {
  const model = state.model;
  const current = clampTick(Math.round(state.tick));
  const season = model.timeline.seasons.find((item) => current >= item.firstTick && current <= item.lastTick);

  const cards = [];
  for (let index = current; index >= (season?.firstTick ?? 0); index -= 1) {
    for (const row of model.highlights.get(index) ?? []) cards.push({ row, tickIndex: index });
    if (cards.length >= HIGHLIGHT_CARDS_SHOWN) break;
  }
  const shown = cards.slice(0, HIGHLIGHT_CARDS_SHOWN);

  const cardsKey = shown.map((card) => `${card.row.season_id}#${card.row.match_id}`).join("|");
  if (cardsKey === state.lastCardsKey) return;
  state.lastCardsKey = cardsKey;

  const translate = state.context.translate;
  dom.highlights.innerHTML = shown
    .map(({ row, tickIndex }) => {
      const videoUrl = String(row.video_urls ?? "").split(";").map((url) => url.trim()).find((url) => url.startsWith("http"));
      return `
      <article class="zeitreise-highlight-card">
        <div class="zeitreise-highlight-when">⚡ ${escapeHtml(tickLabel(model.timeline.ticks[tickIndex]))}</div>
        <h4>${escapeHtml(row.player_a)} ${escapeHtml(row.score || "")} ${escapeHtml(row.player_b)}</h4>
        <p>${escapeHtml(row.highlight_reasons || "")}</p>
        ${videoUrl ? `<a href="${escapeAttr(videoUrl)}" target="_blank" rel="noreferrer">▶ ${escapeHtml(translate("zeitreise.highlightWatch"))}</a>` : ""}
      </article>`;
    })
    .join("");
}

function renderLegend(entries) {
  dom.legend.innerHTML = entries
    .map((entry) => `<span class="zeitreise-legend-item"><span class="zeitreise-swatch ${leadClasses(entry.position ?? entry.slot)}"></span><span>${escapeHtml(entry.label ?? "")}</span></span>`)
    .join("");
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
