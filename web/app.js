import {
  TABULATOR_LANGS,
  columnTitle,
  nextLanguage,
  nextTheme,
  normalizeLanguage,
  normalizeTheme,
  t,
} from "./i18n.js";
import { parseRouteHash, personRouteHash, pokemonRouteHash, seasonRouteHash, viewRouteHash } from "./router.js";
import { pokemonAssetId } from "./pokemon_names.js";
import {
  ALL_TIME_COLUMNS,
  MATCHUP_COLUMNS,
  PERSON_SEASON_COLUMNS,
  PERSON_SUMMARY_COLUMNS,
  POKEMON_DETAIL_SUMMARY_COLUMNS,
  POKEMON_DRAFT_COLUMNS,
  POKEMON_KILLLIST_COLUMNS,
  SEASON_STANDINGS_COLUMNS,
  TABLE_HISTORY_COLUMNS,
} from "./table_columns.js";
import { tableHeaderFilterConfig } from "./table_filters.js";
import {
  aggregatePersonStats,
  canonicalKilllistRows,
  displayNumber,
  eloRatings,
  filterSourceClaims,
  matchupOverview,
  missingDataRows,
  numberValue,
  personStorySummary,
  personPokemonHighlights,
  pokemonDraftOverviewRows,
  pokemonTitleIndex,
  pokemonStorySummary,
  pokemonTimelineRows,
  personDetailKilllistRows,
  primaryCompetitionRows,
  qualityRowsFromData,
  reviewWorkflowRows,
  seasonCoverageRows,
  sourceClaimsForSeason,
  summarizePokemonDetail,
  summarizeKilllists,
  summarizeTrainerPokemon,
  winPercentage,
  weightedRating,
} from "./stats.js";

const DATASETS = {
  seasons: "../data/normalized/seasons.csv",
  people: "../data/normalized/people.csv",
  teams: "../data/normalized/teams.csv",
  standings: "../data/normalized/standings.csv",
  personStints: "../data/normalized/person_stints.csv",
  matches: "../data/normalized/matches.csv",
  videos: { url: "../data/normalized/video_archive.csv", optional: true },
  matchVideos: { url: "../data/normalized/match_videos.csv", optional: true },
  champions: "../data/normalized/champions.csv",
  killlists: "../data/normalized/pokemon_killlists.csv",
  pokemonDraftOverview: { url: "../data/normalized/pokemon_draft_overview.csv", optional: true },
  dataQuality: { url: "../data/normalized/data_quality.csv", optional: true },
  sourceClaims: { url: "../data/normalized/source_claims.csv", optional: true },
  reviewIndex: { url: "../data/review/review_index.csv", optional: true },
  missingKilllists: { url: "../data/review/missing_killlists.csv", optional: true },
  missingKilllistAppearances: { url: "../data/review/missing_killlist_appearances.csv", optional: true },
  lowConfidenceVideos: { url: "../data/review/low_confidence_videos.csv", optional: true },
  ambiguousMatches: { url: "../data/review/ambiguous_matches.csv", optional: true },
};

const state = {
  view: "all-time",
  season: "all",
  dataMode: normalizeDataMode(readPreference("gpl-data-mode", "primary")),
  division: "all",
  language: normalizeLanguage(readPreference("gpl-language", "de")),
  theme: normalizeTheme(readPreference("gpl-theme", "light")),
  search: "",
  personFocus: null,
  pokemonFocus: null,
  draftPickedStatus: "all",
  draftTierFilter: "all",
  data: {},
};

const statusEl = document.querySelector("#load-status");
const languageToggle = document.querySelector("#language-toggle");
const themeToggle = document.querySelector("#theme-toggle");
const dataModeFilter = document.querySelector("#data-mode-filter");
const seasonFilter = document.querySelector("#season-filter");
const divisionFilter = document.querySelector("#division-filter");
const searchFilter = document.querySelector("#search-filter");
const matchupA = document.querySelector("#matchup-a");
const matchupB = document.querySelector("#matchup-b");
const tableInstances = new Map();

init();

async function init() {
  applyTheme();
  applyLanguage();
  bindControls();
  try {
    state.data = await loadDatasets();
    applyRouteFromHash();
    populateSeasonFilter();
    populateDivisionFilter();
    populateMatchupOptions();
    render();
    statusEl.textContent = t(state.language, "status.loaded");
    statusEl.classList.add("is-ready");
  } catch (error) {
    statusEl.textContent = t(state.language, "status.failed");
    statusEl.classList.add("is-error");
    console.error(error);
    renderError(error);
  }
}

function bindControls() {
  dataModeFilter.value = state.dataMode;
  dataModeFilter.addEventListener("change", () => {
    state.dataMode = dataModeFilter.value || "primary";
    state.dataMode = normalizeDataMode(state.dataMode);
    savePreference("gpl-data-mode", state.dataMode);
    state.division = "all";
    divisionFilter.value = state.division;
    populateDivisionFilter();
    populateMatchupOptions();
    render();
    if (state.view === "matchup") {
      renderMatchup();
    }
  });

  languageToggle.addEventListener("click", () => {
    state.language = nextLanguage(state.language);
    savePreference("gpl-language", state.language);
    applyLanguage();
    populateSeasonFilter();
    populateDivisionFilter();
    dataModeFilter.value = state.dataMode;
    populateMatchupOptions();
    render();
    if (state.view === "matchup") {
      renderMatchup();
    }
  });

  themeToggle.addEventListener("click", () => {
    state.theme = nextTheme(state.theme);
    savePreference("gpl-theme", state.theme);
    applyTheme();
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      navigateToView(button.dataset.view);
    });
  });

  seasonFilter.addEventListener("change", () => {
    state.season = seasonFilter.value;
    render();
  });

  divisionFilter.addEventListener("change", () => {
    state.division = divisionFilter.value;
    render();
  });

  searchFilter.addEventListener("input", () => {
    state.search = searchFilter.value.trim().toLowerCase();
    render();
  });

  document.querySelector("#matchup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    renderMatchup();
  });

  document.querySelectorAll("[data-draft-picked-status]").forEach((button) => {
    button.addEventListener("click", () => {
      state.draftPickedStatus = button.dataset.draftPickedStatus || "all";
      renderPokemonDrafts();
    });
  });

  const draftTierFilter = document.querySelector("#draft-tier-filter");
  if (draftTierFilter) {
    draftTierFilter.addEventListener("change", () => {
      state.draftTierFilter = draftTierFilter.value || "all";
      renderPokemonDrafts();
    });
  }

  document.addEventListener("click", (event) => {
    const personLink = event.target.closest("[data-person-key]");
    if (personLink) {
      event.preventDefault();
      selectPerson(personLink.dataset.personKey, personLink.dataset.personName);
      return;
    }
    const pokemonLink = event.target.closest("[data-pokemon-key]");
    if (pokemonLink) {
      event.preventDefault();
      selectPokemon(pokemonLink.dataset.pokemonKey, pokemonLink.dataset.pokemonName);
      return;
    }
    if (event.target.closest("[data-clear-person-focus]")) {
      event.preventDefault();
      navigateToView("person-details");
    }
    if (event.target.closest("[data-clear-pokemon-focus]")) {
      event.preventDefault();
      navigateToView("pokemon-detail");
    }
  });

  window.addEventListener("hashchange", () => {
    applyRouteFromHash();
    render();
    if (state.view === "matchup") {
      renderMatchup();
    }
  });
}

function navigateToView(viewName) {
  navigateToHash(viewRouteHash(viewName));
}

function navigateToHash(hash) {
  if (window.location.hash === hash) {
    applyRouteFromHash();
    render();
    return;
  }
  window.location.hash = hash;
}

function applyRouteFromHash() {
  const route = parseRouteHash(window.location.hash);
  if (route.personKey) {
    state.personFocus = resolvePersonFocus(route.personKey);
    state.pokemonFocus = null;
    state.season = "all";
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else if (route.seasonId) {
    state.personFocus = null;
    state.pokemonFocus = null;
    state.season = route.seasonId;
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else if (route.pokemonKey) {
    state.personFocus = null;
    state.pokemonFocus = resolvePokemonFocus(route.pokemonKey);
    state.season = "all";
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else {
    state.personFocus = null;
    state.pokemonFocus = null;
  }
  setActiveView(route.view);
}

function setActiveView(viewName) {
  state.view = viewName;
  document.querySelectorAll(".tab").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${viewName}`);
  });
}

function selectPerson(key, name) {
  if (!key) return;
  state.personFocus = { key, name: name || key };
  state.pokemonFocus = null;
  state.season = "all";
  state.division = "all";
  state.search = "";
  seasonFilter.value = state.season;
  divisionFilter.value = state.division;
  searchFilter.value = "";
  navigateToHash(personRouteHash(key));
}

function selectPokemon(key, name) {
  if (!key) return;
  state.pokemonFocus = { key, name: name || key };
  state.personFocus = null;
  state.season = "all";
  state.division = "all";
  state.search = "";
  seasonFilter.value = state.season;
  divisionFilter.value = state.division;
  searchFilter.value = "";
  navigateToHash(pokemonRouteHash(key));
}

function resolvePersonFocus(key) {
  const name = findPersonName(key);
  return { key, name: name || key };
}

function resolvePokemonFocus(key) {
  const name = findPokemonName(key);
  return { key, name: name || key };
}

function findPersonName(key) {
  return (
    (state.data.people ?? []).find((row) => row.person_id === key)?.person_name ||
    (state.data.personStints ?? []).find((row) => row.person_id === key)?.person_name ||
    (state.data.teams ?? []).find((row) => row.person_id === key)?.person_name ||
    (state.data.standings ?? []).find((row) => row.person_id === key)?.player_name ||
    null
  );
}

function findPokemonName(key) {
  const comparable = normalizedKey(key);
  return (
    (state.data.killlists ?? []).find((row) => normalizedKey(row.pokemon_normalized || row.pokemon) === comparable)?.pokemon ||
    null
  );
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  document.title = t(state.language, "app.title");

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(state.language, element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(state.language, element.dataset.i18nPlaceholder));
  });

  languageToggle.textContent = t(state.language, "controls.language");
  languageToggle.setAttribute("aria-label", state.language === "de" ? "Switch to English" : "Auf Deutsch wechseln");
  updateThemeToggle();
  if (statusEl.classList.contains("is-ready")) {
    statusEl.textContent = t(state.language, "status.loaded");
  } else if (statusEl.classList.contains("is-error")) {
    statusEl.textContent = t(state.language, "status.failed");
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  themeToggle.setAttribute("aria-pressed", String(state.theme === "dark"));
  updateThemeToggle();
}

function updateThemeToggle() {
  themeToggle.textContent = t(state.language, state.theme === "dark" ? "controls.themeDark" : "controls.themeLight");
}

function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function savePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are optional; private browsing or file contexts may block storage.
  }
}

function normalizeDataMode(value) {
  return new Set(["primary", "league1", "league2", "all"]).has(value) ? value : "primary";
}

async function loadDatasets() {
  const entries = await Promise.all(
    Object.entries(DATASETS).map(async ([key, spec]) => {
      const url = typeof spec === "string" ? spec : spec.url;
      const optional = typeof spec === "string" ? false : Boolean(spec.optional);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok && optional) {
        return [key, []];
      }
      if (!response.ok) {
        throw new Error(`${url} returned ${response.status}`);
      }
      return [key, parseCsv(await response.text())];
    }),
  );
  return Object.fromEntries(entries);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift() ?? [];
  return rows
    .filter((item) => item.some((value) => value.trim()))
    .map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function populateSeasonFilter() {
  const seasons = state.data.seasons ?? [];
  seasonFilter.innerHTML = [
    `<option value="all">${escapeHtml(t(state.language, "filters.allSeasons"))}</option>`,
    ...seasons.map((season) => {
      const label = seasonDisplay(season.season_id);
      return `<option value="${escapeAttr(season.season_id)}">${escapeHtml(label)}</option>`;
    }),
  ].join("");
  seasonFilter.value = state.season;
}

function populateDivisionFilter() {
  const divisions = new Set();
  ["standings", "personStints", "matches", "matchVideos", "teams", "killlists"].forEach((dataset) => {
    (state.data[dataset] ?? []).filter(applyDataMode).forEach((row) => {
      if (row.division) {
        divisions.add(row.division);
      }
    });
  });
  divisionFilter.innerHTML = [
    `<option value="all">${escapeHtml(t(state.language, "filters.allDivisions"))}</option>`,
    ...[...divisions]
      .sort(compareDivisions)
      .map((division) => `<option value="${escapeAttr(division)}">${escapeHtml(divisionDisplay(division))}</option>`),
  ].join("");
  divisionFilter.value = state.division;
}

function compareDivisions(a, b) {
  return divisionPriority(a) - divisionPriority(b) || divisionDisplay(a).localeCompare(divisionDisplay(b));
}

function divisionPriority(division) {
  return {
    "Liga 1": 1,
    "Regular Season": 2,
    "Sun Conference": 3,
    "Moon Conference": 4,
    Singles: 5,
    Doubles: 6,
    "Overall Tag Team": 7,
    Overall: 8,
    "Tag Team": 9,
    Playoffs: 10,
    "Liga 2": 20,
  }[division] ?? 50;
}

function populateMatchupOptions() {
  const previousA = matchupA.value;
  const previousB = matchupB.value;
  const options = matchupOptions();
  const optionHtml = [
    `<option value="">${escapeHtml(t(state.language, "matchup.placeholder"))}</option>`,
    ...options.map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`),
  ].join("");
  [matchupA, matchupB].forEach((select, index) => {
    const previous = index === 0 ? previousA : previousB;
    select.innerHTML = optionHtml;
    select.value = options.some((option) => option.value === previous) ? previous : "";
  });
}

function matchupOptions() {
  const choices = new Map();
  const add = (value, preferred = false) => {
    const label = String(value ?? "").trim();
    const key = normalizedKey(label);
    if (!label || !key) return;
    const current = choices.get(key);
    if (!current || preferred || label.length < current.label.length) {
      choices.set(key, { value: key, label });
    }
  };

  (state.data.people ?? []).forEach((row) => add(row.person_name, true));
  (state.data.matches ?? [])
    .filter((row) => row.data_status !== "source_video_only" && row.data_status !== "not_available")
    .forEach((row) => {
      add(row.player_a);
      add(row.player_b);
      add(row.team_a);
      add(row.team_b);
      add(row.winner);
    });
  (state.data.standings ?? [])
    .filter((row) => row.data_status !== "not_available")
    .forEach((row) => {
      add(row.player_name, true);
      add(row.team_name);
    });
  (state.data.teams ?? [])
    .filter((row) => row.data_status !== "not_available")
    .forEach((row) => {
      add(row.person_name, true);
      add(row.team_name);
    });

  return [...choices.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function render() {
  if (!state.data.seasons) {
    return;
  }
  renderAllTime();
  renderKilllists();
  renderPokemonDrafts();
  renderTableHistory();
  renderMatchPlan();
  renderBattleHistory();
  renderVideoArchive();
  renderPersonDetails();
  renderPokemonDetail();
  renderDataCoverage();
  renderReviewWorkflow();
  renderSourceClaims();
  renderSeasonDetail();
}

function filtered(rows) {
  return rows.filter((row) => {
    const dataModeOk = applyDataMode(row);
    const seasonOk = state.season === "all" || row.season_id === state.season;
    const divisionOk = state.division === "all" || row.division === state.division;
    const searchOk = !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search);
    return dataModeOk && seasonOk && divisionOk && searchOk;
  });
}

function applyDataMode(row) {
  const division = row.division || "";
  if (!division) {
    return state.dataMode !== "league2";
  }
  if (state.dataMode === "all") {
    return true;
  }
  if (state.dataMode === "league1") {
    return division === "Liga 1";
  }
  if (state.dataMode === "league2") {
    return division === "Liga 2";
  }
  if (division !== "Liga 2") {
    return true;
  }
  return !seasonHasLeagueOne(row.season_id || row.detected_season_id);
}

function seasonHasLeagueOne(seasonId) {
  if (!seasonId) {
    return false;
  }
  return ["standings", "personStints", "matches", "matchVideos", "teams", "killlists"].some((dataset) =>
    (state.data[dataset] ?? []).some((row) => (row.season_id || row.detected_season_id) === seasonId && row.division === "Liga 1"),
  );
}

function metricCard(label, value) {
  return `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`;
}

function seasonDisplay(seasonId) {
  const match = String(seasonId ?? "").match(/season_0*(\d+)/);
  if (!match) return seasonId || "";
  return state.language === "de" ? `Saison ${Number(match[1])}` : `Season ${Number(match[1])}`;
}

function seasonListDisplay(seasonIds) {
  return [...new Set((seasonIds ?? []).filter(Boolean))]
    .sort((a, b) => seasonOrder(a) - seasonOrder(b) || String(a).localeCompare(String(b)))
    .map(seasonDisplay)
    .join(", ");
}

function divisionDisplay(division, stage = "") {
  if (!division && stage === "video_source") return t(state.language, "divisions.videoSource");
  const key = {
    "Regular Season": "regularSeason",
    "Liga 1": "leagueOne",
    "Liga 2": "leagueTwo",
    Playoffs: "playoffs",
    "Sun Conference": "sunConference",
    "Moon Conference": "moonConference",
    Overall: "overall",
    "Overall Tag Team": "overallTagTeam",
    Singles: "singles",
    Doubles: "doubles",
    "Tag Team": "tagTeam",
  }[division];
  return key ? t(state.language, `divisions.${key}`) : division || "";
}

function stageDisplay(stage) {
  return stage ? t(state.language, `stages.${stage}`) : "";
}

function videoTypeDisplay(videoType) {
  return videoType ? t(state.language, `videoTypes.${videoType}`) : "";
}

function matchStatusDisplay(matchStatus) {
  return matchStatus ? t(state.language, `matchStatuses.${matchStatus}`) : "";
}

function confidenceTierDisplay(tier) {
  return tier ? t(state.language, `confidenceTiers.${tier}`) : "";
}

function coverageStatusDisplay(status) {
  return status ? t(state.language, `coverage.status.${status}`) : "";
}

function reviewFlagsDisplay(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => t(state.language, `review.flags.${item}`))
    .join(", ");
}

function priorityGapsDisplay(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const reviewText = t(state.language, `review.flags.${item}`);
      if (reviewText !== `review.flags.${item}`) return reviewText;
      const missingText = t(state.language, `coverage.missing.${item}`);
      return missingText !== `coverage.missing.${item}` ? missingText : item;
    })
    .join(", ");
}

function severityDisplay(value) {
  return value ? t(state.language, `review.severity.${value}`) : "";
}

function reviewReasonDisplay(value) {
  return value ? t(state.language, `review.reasons.${value}`) : "";
}

function claimTypeDisplay(value) {
  return value ? t(state.language, `claimTypes.${value}`) : "";
}

function statusDisplay(status) {
  return status ? t(state.language, `statuses.${status}`) : "";
}

function missingDataDisplay(value) {
  return String(value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => t(state.language, `coverage.missing.${item}`))
    .join(", ");
}

function sourceLink(value, label = t(state.language, "values.source")) {
  const url = String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("http"));
  return url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>` : "";
}

function sourceLinks(value) {
  const urls = String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("http"));
  return urls
    .map((url, index) => `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(`${t(state.language, "values.source")} ${index + 1}`)}</a>`)
    .join(" ");
}

function personLink(key, name) {
  return `<a class="link-button" href="${escapeAttr(personRouteHash(key))}" data-person-key="${escapeAttr(key)}" data-person-name="${escapeAttr(name)}">${escapeHtml(name)}</a>`;
}

function pokemonLink(key, name) {
  const label = name || key;
  return `<a class="link-button" href="${escapeAttr(pokemonRouteHash(key))}" data-pokemon-key="${escapeAttr(key)}" data-pokemon-name="${escapeAttr(label)}">${escapeHtml(label)}</a>`;
}

function pokemonCell(name, key = normalizedKey(name)) {
  return `<span class="pokemon-cell">${pokemonIcon(name)}${pokemonLink(key, name)}</span>`;
}

function pokemonIcon(name) {
  const icons = window.pkmn?.img?.Icons;
  const id = pokemonAssetId(name);
  try {
    const icon = icons?.getPokemon?.(id);
    if (icon?.style) {
      return `<span class="pokemon-icon" aria-hidden="true" style="${escapeAttr(icon.style)}"></span>`;
    }
  } catch {
    // The sprite library is decorative; missing aliases should not block the data view.
  }
  return `<span class="pokemon-icon-fallback" aria-hidden="true">${escapeHtml(String(name || "?").slice(0, 1).toUpperCase())}</span>`;
}

function pokemonSprite(name) {
  const sprites = window.pkmn?.img?.Sprites;
  const id = pokemonAssetId(name);
  const fallback = `<span class="pokemon-sprite pokemon-sprite-fallback" aria-hidden="true">${escapeHtml(String(name || "?").slice(0, 2).toUpperCase())}</span>`;
  try {
    const sprite = sprites?.getDexPokemon?.(id) || sprites?.getPokemon?.(id);
    if (sprite?.url) {
      const rendering = sprite.pixelated ? "image-rendering: pixelated;" : "";
      return `<span class="pokemon-sprite-frame">${fallback}<img class="pokemon-sprite pokemon-sprite-img" src="${escapeAttr(sprite.url)}" width="${escapeAttr(sprite.w || 96)}" height="${escapeAttr(sprite.h || 96)}" alt="${escapeAttr(name)}" style="${rendering}" onerror="this.hidden=true" /></span>`;
    }
  } catch {
    // Keep the detail page useful even when a local or German name has no sprite mapping.
  }
  return `<span class="pokemon-sprite-frame">${fallback}</span>`;
}

function seasonLink(seasonId) {
  return `<a class="link-button" href="${escapeAttr(seasonRouteHash(seasonId))}">${escapeHtml(seasonDisplay(seasonId))}</a>`;
}

function personIdForName(name) {
  return `person_${normalizedKey(name).replaceAll(" ", "_")}`;
}

function filteredPersonStats({ primaryOnly = false } = {}) {
  const stints = state.data.personStints ?? [];
  let rows;
  if (stints.length) {
    rows = filtered(stints).filter((row) => row.data_status !== "not_available");
  } else {
    rows = filtered(state.data.standings ?? [])
      .filter((row) => row.data_status !== "not_available" && row.is_primary !== "false")
      .map((row) => ({
        ...row,
        person_id: row.person_id,
        person_name: row.player_name,
      }));
  }
  return primaryOnly ? primaryCompetitionRows(rows, state.division) : rows;
}

function renderAllTime() {
  const statRows = filteredPersonStats({ primaryOnly: state.dataMode === "primary" });
  const champions = filtered(state.data.champions ?? []).filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status));
  const eloIndex = new Map(eloRatings(availableMatchRows(), normalizedKey).map((row) => [row.key, row]));
  const personRows = aggregatePersonStats(statRows, champions)
    .map((row) => ({
      ...row,
      elo: eloIndex.get(personComparableKey(row.key))?.elo || "",
    }))
    .sort(
      (a, b) =>
        numberValue(b.seasons_won) - numberValue(a.seasons_won) ||
        numberValue(b.elo) - numberValue(a.elo) ||
        numberValue(b.rating) - numberValue(a.rating) ||
        numberValue(b.points) - numberValue(a.points) ||
        String(a.name).localeCompare(String(b.name)),
    );
  const rows = personRows.map((row, index) => ({
      rank: index + 1,
      name: personLink(row.key, row.name),
      seasons_won: row.seasons_won,
      title_seasons: row.title_seasons,
      seasons: row.seasons,
      season_list: row.season_list,
      teams: row.teams,
      elo: row.elo,
      matches: row.matches,
      wins: displayNumber(row.wins),
      losses: displayNumber(row.losses),
      draws: displayNumber(row.draws),
      win_pct: row.win_pct,
      rating: row.rating,
      points: displayNumber(row.points),
      kills: displayNumber(row.kills),
      deaths: displayNumber(row.deaths),
      differential: displayNumber(row.differential),
      best_rank: row.best_rank,
    }));

  renderTable("#all-time-table", rows, ALL_TIME_COLUMNS, ["name"]);
}

function availableMatchRows() {
  return filtered(state.data.matches ?? []).filter((row) => !["source_video_only", "not_available"].includes(row.data_status));
}

function personComparableKey(value) {
  return normalizedKey(String(value || "").replace(/^person_/, "").replaceAll("_", " "));
}

function renderKilllists() {
  const titles = pokemonTitleIndex(state.data.pokemonDraftOverview ?? [], normalizedKey);
  const rows = summarizeKilllists(canonicalKilllistRows(filtered(state.data.killlists ?? []), state.division)).map((row) => ({
    ...row,
    ...titleInfoForPokemon(titles, row.pokemon),
    pokemon: pokemonCell(row.pokemon),
  }));
  renderTable("#killlists-table", rows, POKEMON_KILLLIST_COLUMNS, ["pokemon"]);
}

function renderPokemonDrafts() {
  document.querySelectorAll("[data-draft-picked-status]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.draftPickedStatus === state.draftPickedStatus);
  });
  const draftTierFilter = document.querySelector("#draft-tier-filter");
  if (draftTierFilter) {
    draftTierFilter.value = state.draftTierFilter;
  }
  const rows = pokemonDraftOverviewRows(state.data.pokemonDraftOverview ?? [], {
    pickedStatus: state.draftPickedStatus,
    excludedTiers: excludedDraftTierValues(state.draftTierFilter),
  }).map((row) => ({
    ...row,
    pokemon: pokemonCell(row.pokemon),
    picked_status: t(state.language, `values.${row.picked_status}`),
    source: sourceLinks(row.source_urls),
  }));
  renderTable(
    "#pokemon-drafts-table",
    rows,
    POKEMON_DRAFT_COLUMNS,
    ["pokemon", "source"],
    { filename: draftOverviewFilename() },
  );
}

function excludedDraftTierValues(filter) {
  if (filter === "exclude_ag_uber") return ["AG", "Uber"];
  return [];
}

function draftOverviewFilename() {
  const picked = state.draftPickedStatus === "never_picked" ? "pokemon-never-picked" : "pokemon-draft-overview";
  const tier = state.draftTierFilter === "exclude_ag_uber" ? "-without-ag-uber" : "";
  return `${picked}${tier}.csv`;
}

function renderPokemonDetail() {
  const focus = state.pokemonFocus;
  const titles = pokemonTitleIndex(state.data.pokemonDraftOverview ?? [], normalizedKey);
  renderPokemonFocus();
  const summaryTarget = document.querySelector("#pokemon-detail-summary");
  const detailTables = ["#pokemon-trainer-table", "#pokemon-timeline-table", "#pokemon-season-table"];

  if (!focus) {
    summaryTarget.innerHTML = "";
    detailTables.forEach((selector) => {
      destroyTable(selector);
      document.querySelector(selector).innerHTML = "";
    });
    const rows = summarizeKilllists(canonicalKilllistRows(filtered(state.data.killlists ?? []), state.division)).map((row) => ({
      ...row,
      ...titleInfoForPokemon(titles, row.pokemon),
      pokemon: pokemonCell(row.pokemon),
    }));
    renderTable("#pokemon-summary-table", rows, POKEMON_KILLLIST_COLUMNS, ["pokemon"]);
    return;
  }

  const detail = summarizePokemonDetail(
    personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division),
    focus.key,
    normalizedKey,
    state.data.teams ?? [],
  );
  const story = pokemonStorySummary(personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division), focus.key, normalizedKey, titles);
  summaryTarget.innerHTML = [
    metricCard(t(state.language, "columns.appearances"), displayNumber(detail.summary.appearances)),
    metricCard(t(state.language, "columns.kills"), displayNumber(detail.summary.kills)),
    metricCard(t(state.language, "columns.deaths"), displayNumber(detail.summary.deaths)),
    metricCard(t(state.language, "columns.differential"), displayNumber(detail.summary.differential)),
    metricCard(t(state.language, "columns.titles"), displayNumber(story.titles)),
    metricCard(t(state.language, "columns.title_seasons"), story.title_seasons || t(state.language, "summary.notAvailable")),
    metricCard(t(state.language, "columns.season_list"), story.season_list || t(state.language, "summary.notAvailable")),
    metricCard(t(state.language, "columns.best_trainer"), story.best_trainer || t(state.language, "summary.notAvailable")),
    metricCard(t(state.language, "columns.best_season"), story.best_season || t(state.language, "summary.notAvailable")),
    metricCard(t(state.language, "columns.top_team"), story.top_team || t(state.language, "summary.notAvailable")),
  ].join("");

  renderTable("#pokemon-summary-table", [pokemonSummaryRow(detail.summary, story)], POKEMON_DETAIL_SUMMARY_COLUMNS, ["pokemon", "source"]);
  renderTable(
    "#pokemon-trainer-table",
    detail.trainerRows.map((row) => ({
      trainer: personLink(personIdForName(row.trainer), row.trainer),
      appearances: displayNumber(row.appearances),
      kills: displayNumber(row.kills),
      deaths: displayNumber(row.deaths),
      differential: displayNumber(row.differential),
      seasons: row.seasons,
      season_list: row.season_list,
      teams: row.teams,
    })),
    ["trainer", "appearances", "kills", "deaths", "differential", "seasons", "season_list", "teams"],
    ["trainer"],
  );
  renderTable(
    "#pokemon-timeline-table",
    pokemonTimelineRows(personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division), focus.key, normalizedKey).map((row) => ({
      season: seasonLink(row.season_id),
      divisions: row.divisions,
      appearances: displayNumber(row.appearances),
      kills: displayNumber(row.kills),
      deaths: displayNumber(row.deaths),
      differential: displayNumber(row.differential),
      trainers: row.trainers,
      teams: row.teams,
    })),
    ["season", "divisions", "appearances", "kills", "deaths", "differential", "trainers", "teams"],
    ["season"],
  );
  renderTable(
    "#pokemon-season-table",
    detail.seasonRows.map((row) => ({
      season: seasonDisplay(row.season_id),
      division: divisionDisplay(row.division),
      trainer: row.trainer,
      team: row.team_name,
      appearances: displayNumber(row.appearances),
      kills: displayNumber(row.kills),
      deaths: displayNumber(row.deaths),
      differential: displayNumber(row.differential),
      source: sourceLinks(row.source_urls),
    })),
    ["season", "division", "trainer", "team", "appearances", "kills", "deaths", "differential", "source"],
    ["source"],
  );
}

function pokemonSummaryRow(summary, story = {}) {
  return {
    pokemon: pokemonCell(summary.pokemon, normalizedKey(summary.pokemon)),
    appearances: displayNumber(summary.appearances),
    kills: displayNumber(summary.kills),
    deaths: displayNumber(summary.deaths),
    differential: displayNumber(summary.differential),
    seasons: summary.seasons,
    season_list: story.season_list || "",
    titles: displayNumber(story.titles),
    title_seasons: story.title_seasons || "",
    trainers: summary.trainers,
    teams: summary.teams,
    source: sourceLinks(summary.source_urls),
  };
}

function titleInfoForPokemon(titleIndex, pokemon) {
  const key = normalizedKey(pokemon);
  return titleIndex.get(key) || titleIndex.get(key.replace(/\s+/g, "")) || { titles: 0, title_seasons: "" };
}

function renderPokemonFocus() {
  const target = document.querySelector("#pokemon-focus");
  if (!target) return;
  if (!state.pokemonFocus) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  target.innerHTML = `
    <div class="pokemon-focus-card">
      ${pokemonSprite(state.pokemonFocus.name)}
      <div>
        <span>${escapeHtml(t(state.language, "pokemonDetails.focus"))}</span>
        <strong>${escapeHtml(state.pokemonFocus.name)}</strong>
      </div>
    </div>
    <button type="button" class="header-button" data-clear-pokemon-focus>${escapeHtml(t(state.language, "pokemonDetails.showAll"))}</button>
  `;
}

function renderTableHistory() {
  const rows = filtered(state.data.standings ?? []).map((row) => ({
    season: seasonDisplay(row.season_id),
    division: divisionDisplay(row.division, row.stage),
    rank: row.rank,
    person: row.player_name,
    team: row.team_name,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    matches: numberValue(row.wins) + numberValue(row.losses) + numberValue(row.draws),
    win_pct: winPercentage(row.wins, row.losses, row.draws),
    points: row.points,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    source: sourceLink(row.source_urls),
  }));
  renderTable("#table-history-table", rows, TABLE_HISTORY_COLUMNS, ["source"]);
}

function renderMatchPlan() {
  const selector = "#match-plan-table";
  const target = document.querySelector(selector);
  destroyTable(selector);
  if (state.season === "all") {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.chooseSeason"))}</p>`;
    return;
  }

  const rows = filtered(state.data.matches ?? [])
    .filter((row) => !["source_video_only", "not_available"].includes(row.data_status) && (row.player_a || row.player_b || row.score_a || row.score_b || row.winner))
    .sort(compareMatches)
    .map((row) => ({
      season: seasonDisplay(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      stage: stageDisplay(row.stage),
      week: row.week,
      player_a: row.player_a || row.team_a,
      player_b: row.player_b || row.team_b,
      score: row.score_a || row.score_b ? `${row.score_a || "?"} - ${row.score_b || "?"}` : "",
      winner: row.winner,
      videos: videoLinksForMatch(row.match_id),
      source: sourceLink(row.source_urls),
    }));

  renderTable("#match-plan-table", rows, ["season", "division", "stage", "week", "player_a", "player_b", "score", "winner", "videos", "source"], ["videos", "source"]);
}

function compareMatches(a, b) {
  return (
    weekOrder(a) - weekOrder(b) ||
    String(a.division || "").localeCompare(String(b.division || "")) ||
    String(a.player_a || "").localeCompare(String(b.player_a || "")) ||
    String(a.player_b || "").localeCompare(String(b.player_b || ""))
  );
}

function weekOrder(row) {
  const text = String(row.week ?? "").toLowerCase();
  const match = text.match(/(\d+)\.\s*spieltag/);
  if (match) return Number(match[1]);
  if (text.includes("viertel")) return 100;
  if (text.includes("halb")) return 110;
  if (text.includes("final")) return 120;
  return row.stage === "playoffs" ? 150 : 999;
}

function renderBattleHistory() {
  const rows = filtered(state.data.matches ?? [])
    .filter((row) => !["source_video_only", "not_available"].includes(row.data_status))
    .map((row) => ({
      season: seasonDisplay(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      stage: stageDisplay(row.stage),
      week: row.week,
      player_a: row.player_a || row.team_a,
      player_b: row.player_b || row.team_b,
      winner: row.winner,
      score: row.score_a || row.score_b ? `${row.score_a || "?"} - ${row.score_b || "?"}` : "",
      videos: videoLinksForMatch(row.match_id) || (row.video_url ? `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(row.video_title || row.video_id || t(state.language, "values.video"))}</a>` : ""),
      source: sourceLink(row.source_urls),
    }));
  renderTable("#battle-history-table", rows, ["season", "division", "stage", "week", "player_a", "player_b", "winner", "score", "videos", "source"], ["videos", "source"]);
}

function renderVideoArchive() {
  const rows = filteredVideoRows(state.data.videos ?? [])
    .sort(compareVideoRows)
    .map((row) => ({
      _season_order: seasonOrder(row.detected_season_id),
      _week_order: weekNumber(row.detected_week),
      season: seasonDisplay(row.detected_season_id),
      video_type: videoTypeDisplay(row.video_type),
      stage: stageDisplay(row.detected_stage),
      detected_week: row.detected_week,
      perspective_person: row.perspective_person,
      opponent: row.opponent,
      title: `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(row.title || row.video_id || t(state.language, "values.video"))}</a>`,
      channel: row.channel_title,
      match_status: matchStatusDisplay(row.match_status),
      confidence: row.confidence,
      confidence_tier: confidenceTierDisplay(row.confidence_tier),
      match_basis: row.match_basis,
      confidence_explanation: row.confidence_explanation,
      match_id: row.best_match_id,
      published_at: row.published_at,
    }));
  renderTable(
    "#video-archive-table",
    rows,
    ["season", "video_type", "stage", "detected_week", "perspective_person", "opponent", "title", "channel", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "match_id", "published_at"],
    ["title"],
    {
      filename: "gpl-video-archive.csv",
      extraActions: [{ label: t(state.language, "actions.videoUrls"), onClick: downloadAllVideoUrls }],
    },
  );
}

function filteredVideoRows(rows) {
  return rows.filter((row) => {
    const dataModeOk = applyDataMode(row);
    const seasonOk = state.season === "all" || row.detected_season_id === state.season || row.season_id === state.season;
    const divisionOk = state.division === "all" || row.division === state.division;
    const searchOk = !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search);
    return dataModeOk && seasonOk && divisionOk && searchOk;
  });
}

function renderDataCoverage() {
  const rows = qualityRowsFromData(state.data)
    .filter((row) => state.season === "all" || row.season_id === state.season)
    .filter((row) => !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search))
    .map((row) => ({
      season: seasonLink(row.season_id),
      status: coverageStatusDisplay(row.coverage_status),
      quality_score: row.quality_score ?? "",
      tables_score: row.tables_score ?? "",
      matches_score: row.matches_score ?? "",
      killlists_score: row.killlists_score ?? "",
      videos_score: row.videos_score ?? "",
      priority_gaps: priorityGapsDisplay(row.priority_gaps || row.review_flags || row.missing_categories),
      standings: row.standings_rows ?? row.standings,
      matches: row.match_rows ?? row.matches,
      playoff_matches: row.playoff_match_rows ?? "",
      champions: row.champion_rows ?? row.champions,
      killlists: row.killlist_rows ?? row.killlists,
      missing_appearances: row.killlist_rows_missing_appearances ?? "",
      unavailable_killlists: row.unavailable_killlist_rows ?? row.unavailable_killlists,
      videos: row.video_rows ?? row.videos,
      matched_videos: row.matched_video_rows ?? row.matched_videos,
      unmatched_game_videos: row.unmatched_game_video_rows ?? "",
      low_confidence_videos: row.low_confidence_video_rows ?? "",
      missing_data: missingDataDisplay(row.missing_categories ?? row.missing_data),
      review_flags: reviewFlagsDisplay(row.review_flags),
      source: sourceLinks(row.source_urls ?? row.missing_source_urls),
    }));
  renderTable(
    "#coverage-table",
    rows,
    ["season", "status", "quality_score", "tables_score", "matches_score", "killlists_score", "videos_score", "priority_gaps", "standings", "matches", "playoff_matches", "champions", "killlists", "missing_appearances", "unavailable_killlists", "videos", "matched_videos", "unmatched_game_videos", "low_confidence_videos", "missing_data", "review_flags", "source"],
    ["season", "source"],
  );

  const missingRows = missingDataRows(state.data)
    .filter((row) => state.season === "all" || row.season_id === state.season)
    .map((row) => ({
      season: seasonLink(row.season_id),
      status: coverageStatusDisplay(row.coverage_status),
      missing_data: missingDataDisplay(row.missing_data),
      unavailable_killlists: row.unavailable_killlists,
      source: sourceLinks(row.source_urls),
    }));
  renderTable("#missing-data-table", missingRows, ["season", "status", "missing_data", "unavailable_killlists", "source"], ["season", "source"]);

  const reviewRows = (state.data.reviewIndex ?? [])
    .filter((row) => !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search))
    .map((row) => ({
      review_file: row.review_file,
      row_count: row.row_count,
      severity: severityDisplay(row.severity),
      review_reason: reviewReasonDisplay(row.review_reason),
      correction_file: row.correction_file,
      suggested_action: row.suggested_action,
      description: row.description,
    }));
  renderTable("#review-index-table", reviewRows, ["review_file", "row_count", "severity", "review_reason", "correction_file", "suggested_action", "description"]);
}

function renderReviewWorkflow() {
  const rows = reviewWorkflowRows(state.data)
    .filter((row) => state.season === "all" || row.season_id === state.season)
    .filter((row) => !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search))
    .map((row) => ({
      queue: row.queue,
      severity: severityDisplay(row.severity),
      season: row.season_id ? seasonLink(row.season_id) : "",
      subject: row.subject,
      detail: row.detail,
      review_reason: reviewReasonDisplay(row.review_reason),
      confidence: row.confidence,
      confidence_tier: confidenceTierDisplay(row.confidence_tier),
      correction_file: row.correction_file,
      suggested_action: row.suggested_action,
      source: sourceLinks(row.source_urls),
    }));
  renderTable(
    "#review-workflow-table",
    rows,
    ["queue", "severity", "season", "subject", "detail", "review_reason", "confidence", "confidence_tier", "correction_file", "suggested_action", "source"],
    ["season", "source"],
  );
}

function renderSourceClaims() {
  const rows = filterSourceClaims(state.data.sourceClaims ?? [], {
    season: state.season,
    claimType: "all",
    search: state.search,
  }).map((row) => ({
    season: row.season_id ? seasonLink(row.season_id) : "",
    claim_type: claimTypeDisplay(row.claim_type),
    claim_subject: row.claim_subject,
    claim_field: columnTitle(state.language, row.claim_field),
    claim_value: row.claim_value,
    evidence_status: statusDisplay(row.evidence_status) || matchStatusDisplay(row.evidence_status) || row.evidence_status,
    confidence: row.confidence,
    source: sourceLinks(row.source_urls),
    notes: row.notes,
  }));
  renderTable(
    "#source-claims-table",
    rows,
    ["season", "claim_type", "claim_subject", "claim_field", "claim_value", "evidence_status", "confidence", "source", "notes"],
    ["season", "source"],
    { filename: "gpl-source-claims.csv" },
  );
}

function renderSeasonDetail() {
  const summary = document.querySelector("#season-detail-summary");
  const tables = ["#season-detail-standings", "#season-detail-champions", "#season-detail-killlists", "#season-detail-videos", "#season-detail-claims"];
  tables.forEach(destroyTable);
  if (state.season === "all") {
    summary.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.chooseSeasonDetail"))}</p>`;
    tables.forEach((selector) => {
      document.querySelector(selector).innerHTML = "";
    });
    return;
  }

  const coverage = seasonCoverageRows(state.data).find((row) => row.season_id === state.season);
  summary.innerHTML = coverage
    ? [
        metricCard(t(state.language, "summary.coverage"), coverageStatusDisplay(coverage.coverage_status)),
        metricCard(t(state.language, "summary.battles"), coverage.matches),
        metricCard(t(state.language, "summary.killlists"), coverage.killlists),
        metricCard(t(state.language, "summary.videos"), coverage.videos),
      ].join("")
    : "";

  const standings = filtered(state.data.standings ?? [])
    .map((row) => ({
      division: divisionDisplay(row.division, row.stage),
      rank: row.rank,
      person: row.player_name,
      team: row.team_name,
      matches: numberValue(row.wins) + numberValue(row.losses) + numberValue(row.draws),
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      win_pct: winPercentage(row.wins, row.losses, row.draws),
      points: row.points,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      status: statusDisplay(row.data_status),
      source: sourceLinks(row.source_urls),
    }));
  renderTable("#season-detail-standings", standings, SEASON_STANDINGS_COLUMNS, ["source"]);

  const champions = filtered(state.data.champions ?? [])
    .map((row) => ({
      champion: row.champion_name,
      team: row.champion_team,
      evidence: row.evidence_type,
      status: statusDisplay(row.data_status),
      notes: row.notes,
      source: sourceLinks(row.source_urls),
    }));
  renderTable("#season-detail-champions", champions, ["champion", "team", "evidence", "status", "notes", "source"], ["source"]);

  const killlists = personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division).map((row) => ({
    division: divisionDisplay(row.division, row.stage),
    pokemon: pokemonCell(row.pokemon, row.pokemon_normalized || normalizedKey(row.pokemon)),
    trainer: row.trainer,
    team: row.team_name,
    appearances: row.appearances,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    status: statusDisplay(row.data_status),
    source: sourceLinks(row.source_urls),
  }));
  renderTable("#season-detail-killlists", killlists, ["division", "pokemon", "trainer", "team", "appearances", "kills", "deaths", "differential", "status", "source"], ["pokemon", "source"]);

  const videos = filteredVideoRows(state.data.videos ?? [])
    .sort(compareVideoRows)
    .map((row) => ({
      video_type: videoTypeDisplay(row.video_type),
      stage: stageDisplay(row.detected_stage),
      detected_week: row.detected_week,
      perspective_person: row.perspective_person,
      opponent: row.opponent,
      title: `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(row.title || row.video_id || t(state.language, "values.video"))}</a>`,
      channel: row.channel_title,
      match_status: matchStatusDisplay(row.match_status),
      confidence: row.confidence,
      confidence_tier: confidenceTierDisplay(row.confidence_tier),
      match_basis: row.match_basis,
      confidence_explanation: row.confidence_explanation,
      published_at: row.published_at,
    }));
  renderTable("#season-detail-videos", videos, ["video_type", "stage", "detected_week", "perspective_person", "opponent", "title", "channel", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "published_at"], ["title"]);

  const claims = sourceClaimsForSeason(state.data.sourceClaims ?? [], state.season).map((row) => ({
    claim_type: claimTypeDisplay(row.claim_type),
    claim_subject: row.claim_subject,
    claim_field: columnTitle(state.language, row.claim_field),
    claim_value: row.claim_value,
    evidence_status: statusDisplay(row.evidence_status) || matchStatusDisplay(row.evidence_status) || row.evidence_status,
    confidence: row.confidence,
    source: sourceLinks(row.source_urls),
    notes: row.notes,
  }));
  renderTable("#season-detail-claims", claims, ["claim_type", "claim_subject", "claim_field", "claim_value", "evidence_status", "confidence", "source", "notes"], ["source"]);
}

function videoLinksForMatch(matchId) {
  const rows = (state.data.matchVideos ?? []).filter((row) => row.match_id === matchId);
  if (!rows.length) {
    return "";
  }
  return rows
    .map((row) => {
      const label = row.perspective_person || row.channel_title || row.video_title || t(state.language, "values.video");
      return `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
    })
    .join(" ");
}

function compareVideoRows(a, b) {
  return (
    seasonOrder(a.detected_season_id) - seasonOrder(b.detected_season_id) ||
    weekNumber(a.detected_week) - weekNumber(b.detected_week) ||
    videoTypePriority(a.video_type) - videoTypePriority(b.video_type) ||
    String(a.published_at || "").localeCompare(String(b.published_at || "")) ||
    String(a.title || "").localeCompare(String(b.title || ""))
  );
}

function seasonOrder(seasonId) {
  const match = String(seasonId ?? "").match(/season_0*(\d+)/);
  return match ? Number(match[1]) : 999;
}

function weekNumber(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 999;
}

function videoTypePriority(value) {
  return {
    game: 1,
    teambuilding: 2,
    draft_analysis: 3,
    announcement: 4,
    update: 5,
    recap: 6,
    reaction: 7,
    tierlist: 8,
    other: 9,
  }[value] ?? 50;
}

function renderPersonDetails() {
  const focusKey = state.personFocus?.key;
  const teams = filtered(state.data.teams ?? [])
    .filter((row) => row.data_status !== "not_available")
    .filter((row) => !focusKey || rowPersonKey(row) === focusKey);
  const statRows = filteredPersonStats().filter((row) => !focusKey || rowPersonKey(row) === focusKey);
  const champions = filtered(state.data.champions ?? [])
    .filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status))
    .filter((row) => !focusKey || championPersonKey(row) === focusKey);
  const people = new Map();

  renderPersonFocus();

  teams.forEach((row) => {
    const key = rowPersonKey(row);
    if (!key) return;
    const current = people.get(key) ?? personAggregate(row.person_name);
    current.seasons.add(row.season_id);
    if (row.team_name) current.teams.add(`${row.season_id}: ${row.team_name}`);
    people.set(key, current);
  });

  statRows.forEach((row) => {
    const key = rowPersonKey(row);
    if (!key) return;
    const current = people.get(key) ?? personAggregate(row.person_name || row.player_name);
    current.seasons.add(row.season_id);
    if (row.team_name) current.teams.add(`${row.season_id}: ${row.team_name}`);
    current.wins += numberValue(row.wins);
    current.losses += numberValue(row.losses);
    current.draws += numberValue(row.draws);
    current.points += numberValue(row.points);
    current.bestRank = Math.min(current.bestRank, numberValue(row.rank) || Number.POSITIVE_INFINITY);
    people.set(key, current);
  });

  champions.forEach((row) => {
    const key = championPersonKey(row);
    if (!key) return;
    const current = people.get(key) ?? personAggregate(row.champion_name);
    current.championships.add(row.season_id);
    people.set(key, current);
  });

  const summaryRows = [...people.values()]
    .sort((a, b) => b.championships.size - a.championships.size || b.points - a.points || a.name.localeCompare(b.name))
    .map((row) => ({
      person: row.name,
      seasons: row.seasons.size,
      season_list: seasonListDisplay([...row.seasons]),
      teams: row.teams.size,
      championships: row.championships.size,
      title_seasons: seasonListDisplay([...row.championships]),
      matches: row.wins + row.losses + row.draws,
      wins: displayNumber(row.wins),
      losses: displayNumber(row.losses),
      draws: displayNumber(row.draws),
      win_pct: winPercentage(row.wins, row.losses, row.draws),
      points: displayNumber(row.points),
      best_rank: Number.isFinite(row.bestRank) ? row.bestRank : "",
    }));

  const detailRows = statRows
    .sort((a, b) => (a.person_name || a.player_name || "").localeCompare(b.person_name || b.player_name || "") || a.season_id.localeCompare(b.season_id))
    .map((row) => {
      return {
        person: row.person_name || row.player_name,
        season: seasonDisplay(row.season_id),
        division: divisionDisplay(row.division, row.stage),
        team: row.team_name,
        start_week: row.start_week,
        end_week: row.end_week,
        rank: row.rank ?? "",
        matches: row.matches || numberValue(row.wins) + numberValue(row.losses) + numberValue(row.draws),
        wins: row.wins ?? "",
        losses: row.losses ?? "",
        draws: row.draws ?? "",
        win_pct: winPercentage(row.wins, row.losses, row.draws),
        points: row.points ?? "",
        source: sourceLink(row.source_urls),
      };
    });
  const titleSeasons = new Set(champions.map((row) => row.season_id));
  const timelineRows = statRows
    .sort((a, b) => seasonOrder(a.season_id) - seasonOrder(b.season_id) || divisionPriority(a.division) - divisionPriority(b.division))
    .map((row) => ({
      season: seasonDisplay(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      team: row.team_name,
      record: `${row.wins ?? 0}-${row.losses ?? 0}-${row.draws ?? 0}`,
      win_pct: winPercentage(row.wins, row.losses, row.draws),
      rating: weightedRating(row.wins, row.losses, row.draws),
      points: row.points ?? "",
      kills: row.kills ?? "",
      deaths: row.deaths ?? "",
      differential: row.differential ?? "",
      title: titleSeasons.has(row.season_id) ? t(state.language, "values.yes") : "",
      source: sourceLink(row.source_urls),
    }));
  const pokemonRows = summarizeTrainerPokemon(
    personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division),
    focusKey,
    normalizedKey,
    state.data.teams ?? [],
  ).map((row) => ({
    trainer: row.trainer,
    pokemon: pokemonCell(row.pokemon),
    appearances: displayNumber(row.appearances),
    kills: displayNumber(row.kills),
    deaths: displayNumber(row.deaths),
    differential: displayNumber(row.differential),
    seasons: row.seasons,
    season_list: row.season_list,
    divisions: row.divisions,
    teams: row.teams,
    source: sourceLink(row.source_urls),
  }));
  const storyPokemonRows = personPokemonHighlights(
    personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division),
    focusKey,
    normalizedKey,
    state.data.teams ?? [],
  );
  const story = focusKey ? personStorySummary(statRows, champions, storyPokemonRows, focusKey, normalizedKey) : null;
  const storyTarget = document.querySelector("#person-story-summary");
  storyTarget.innerHTML = story
    ? [
        metricCard(t(state.language, "columns.season_list"), story.season_list || t(state.language, "summary.notAvailable")),
        metricCard(t(state.language, "columns.title_seasons"), story.title_seasons || t(state.language, "summary.notAvailable")),
        metricCard(t(state.language, "columns.best_season"), story.best_season || t(state.language, "summary.notAvailable")),
        metricCard(t(state.language, "columns.signature_pokemon"), story.signature_pokemon || t(state.language, "summary.notAvailable")),
      ].join("")
    : "";
  const personVideos = focusKey
    ? filteredVideoRows(state.data.videos ?? [])
        .filter((row) => isFocusedPersonValue(row.perspective_person, focusKey) || isFocusedPersonValue(row.source_person_names, focusKey))
        .sort(compareVideoRows)
        .map((row) => ({
          season: seasonDisplay(row.detected_season_id),
          video_type: videoTypeDisplay(row.video_type),
          detected_week: row.detected_week,
          opponent: row.opponent,
          title: `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(row.title || row.video_id || t(state.language, "values.video"))}</a>`,
          match_status: matchStatusDisplay(row.match_status),
          confidence: row.confidence,
          confidence_tier: confidenceTierDisplay(row.confidence_tier),
          match_basis: row.match_basis,
          confidence_explanation: row.confidence_explanation,
          published_at: row.published_at,
        }))
    : [];
  const matchupRows = focusKey
    ? matchupOverview(
        availableMatchRows(),
        focusKey.replace(/^person_/, "").replaceAll("_", " "),
        normalizedKey,
      )
    : [];
  const missingKilllistRows = filtered(state.data.killlists ?? [])
    .filter((row) => row.data_status === "not_available")
    .filter((row) => !focusKey || isFocusedPersonValue(row.trainer || row.trainer_normalized, focusKey))
    .map((row) => ({
      season: seasonDisplay(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      trainer: row.trainer,
      team: row.team_name,
      status: statusDisplay(row.data_status),
      source: sourceLinks(row.source_urls),
    }));

  renderTable("#person-summary-table", summaryRows, PERSON_SUMMARY_COLUMNS);
  renderTable("#person-timeline-table", timelineRows, ["season", "division", "team", "record", "win_pct", "rating", "points", "kills", "deaths", "differential", "title", "source"], ["source"]);
  renderTable("#person-season-table", detailRows, PERSON_SEASON_COLUMNS, ["source"]);
  renderTable("#person-pokemon-table", pokemonRows, ["trainer", "pokemon", "appearances", "kills", "deaths", "differential", "seasons", "season_list", "divisions", "teams", "source"], ["pokemon", "source"]);
  renderTable("#person-video-table", personVideos, ["season", "video_type", "detected_week", "opponent", "title", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "published_at"], ["title"]);
  renderTable("#person-matchup-table", matchupRows, MATCHUP_COLUMNS);
  renderTable("#person-missing-table", missingKilllistRows, ["season", "division", "trainer", "team", "status", "source"], ["source"]);
}

function renderPersonFocus() {
  const target = document.querySelector("#person-focus");
  if (!target) return;
  if (!state.personFocus) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  target.innerHTML = `
    <span>${escapeHtml(t(state.language, "personDetails.focus"))}: <strong>${escapeHtml(state.personFocus.name)}</strong></span>
    <button type="button" class="header-button" data-clear-person-focus>${escapeHtml(t(state.language, "personDetails.showAll"))}</button>
  `;
}

function rowPersonKey(row) {
  return row.person_id || normalizedKey(row.person_name || row.player_name);
}

function championPersonKey(row) {
  return row.champion_person_id || normalizedKey(row.champion_name);
}

function isFocusedPersonValue(value, focusKey) {
  const comparableFocus = normalizedKey(String(focusKey || "").replace(/^person_/, "").replaceAll("_", " "));
  return String(value ?? "")
    .split(";")
    .map((item) => normalizedKey(item))
    .some((key) => key && (key === focusKey || key === comparableFocus));
}

function personAggregate(name) {
  return {
    name: name || t(state.language, "values.unknown"),
    seasons: new Set(),
    teams: new Set(),
    championships: new Set(),
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    bestRank: Number.POSITIVE_INFINITY,
  };
}

function renderMatchup() {
  const result = document.querySelector("#matchup-result");
  const a = matchupA.value;
  const b = matchupB.value;
  if (!a) {
    result.innerHTML = `<p class="muted">${escapeHtml(t(state.language, "matchup.enterNames"))}</p>`;
    return;
  }

  const availableMatches = availableMatchRows();
  if (!b) {
    const overviewRows = matchupOverview(availableMatches, a, normalizedKey);
    result.innerHTML = overviewRows.length
      ? `<div class="table-wrap">${tableHtml(overviewRows, MATCHUP_COLUMNS)}</div>`
      : `<p class="empty">${escapeHtml(t(state.language, "matchup.empty"))}</p>`;
    return;
  }

  const matches = availableMatches.filter((row) => {
    const left = [row.player_a, row.team_a].map(normalizedKey);
    const right = [row.player_b, row.team_b].map(normalizedKey);
    return (left.includes(a) && right.includes(b)) || (left.includes(b) && right.includes(a));
  });

  let aWins = 0;
  let bWins = 0;
  matches.forEach((row) => {
    const winner = normalizedKey(row.winner);
    if (winner === a) aWins += 1;
    if (winner === b) bWins += 1;
  });

  const matchRows = matches.slice(0, 25).map((row) => ({
    season: seasonDisplay(row.season_id),
    division: divisionDisplay(row.division, row.stage),
    week: row.week,
    player_a: row.player_a || row.team_a,
    player_b: row.player_b || row.team_b,
    winner: row.winner,
    score: row.score_a || row.score_b ? `${row.score_a || "?"} - ${row.score_b || "?"}` : "",
    source: sourceLink(row.video_url || row.source_urls, row.video_title || row.video_id || t(state.language, "values.source")),
  }));

  result.innerHTML = `
    <div class="result-grid">
      <div class="metric"><span class="muted">${escapeHtml(t(state.language, "matchup.matches"))}</span><strong>${matches.length}</strong></div>
      <div class="metric"><span class="muted">${escapeHtml(t(state.language, "matchup.firstWins"))}</span><strong>${aWins}</strong></div>
      <div class="metric"><span class="muted">${escapeHtml(t(state.language, "matchup.secondWins"))}</span><strong>${bWins}</strong></div>
    </div>
    ${matches.length ? `<div class="table-wrap">${tableHtml(matchRows, ["season", "division", "week", "player_a", "player_b", "score", "winner", "source"], ["source"])}</div>` : `<p class="empty">${escapeHtml(t(state.language, "matchup.empty"))}</p>`}
  `;
}

function renderTable(selector, rows, columns, html = false, options = {}) {
  const target = document.querySelector(selector);
  destroyTable(selector);
  if (!rows.length) {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    return;
  }
  const extraActions = options.extraActions ?? [];
  target.innerHTML = `
    <div class="table-actions">
      <button class="table-action" type="button" data-table-export>${escapeHtml(t(state.language, "actions.exportCsv"))}</button>
      ${extraActions.map((action, index) => `<button class="table-action" type="button" data-extra-action="${index}">${escapeHtml(action.label)}</button>`).join("")}
    </div>
    <div class="table-host"></div>
  `;
  const host = target.querySelector(".table-host");
  target.querySelector("[data-table-export]").addEventListener("click", () => {
    downloadRowsAsCsv(options.filename || filenameForSelector(selector), rows, columns);
  });
  target.querySelectorAll("[data-extra-action]").forEach((button) => {
    const action = extraActions[Number(button.dataset.extraAction)];
    button.addEventListener("click", () => action.onClick?.());
  });

  if (!window.Tabulator) {
    host.innerHTML = tableHtml(rows, columns, html);
    return;
  }

  const htmlColumns = new Set(html === true ? ["video"] : Array.isArray(html) ? html : []);
  const tabulatorColumns = buildTabulatorColumns(columns, htmlColumns, rows);
  appendHiddenSortColumns(tabulatorColumns, rows);
  const table = new window.Tabulator(host, {
    data: rows,
    columns: tabulatorColumns,
    layout: "fitDataStretch",
    locale: state.language,
    langs: TABULATOR_LANGS,
    movableColumns: true,
    pagination: "local",
    paginationSize: 100,
    paginationSizeSelector: [25, 50, 100, 250, true],
    placeholder: t(state.language, "empty.table"),
    initialSort: initialSort(columns),
  });
  tableInstances.set(selector, table);
}

function destroyTable(selector) {
  const table = tableInstances.get(selector);
  if (table) {
    table.destroy();
    tableInstances.delete(selector);
  }
}

function buildTabulatorColumns(columns, htmlColumns, rows = []) {
  return columns.map((column) => {
    const numeric = NUMERIC_COLUMNS.has(column);
    const filterConfig = tableHeaderFilterConfig(column, rows, {
      allLabel: t(state.language, "filters.allValues"),
      placeholder: t(state.language, "filters.header"),
    });
    return {
      title: columnTitle(state.language, column),
      field: column,
      sorter: sorterFor(column),
      ...filterConfig,
      formatter: formatterFor(column, htmlColumns),
      hozAlign: numeric ? "right" : "left",
      headerHozAlign: numeric ? "right" : "left",
      minWidth: minWidthFor(column),
    };
  });
}

function appendHiddenSortColumns(columns, rows) {
  if (rows.some((row) => row._season_order !== undefined)) {
    columns.push({ field: "_season_order", visible: false, sorter: "number" });
  }
  if (rows.some((row) => row._week_order !== undefined)) {
    columns.push({ field: "_week_order", visible: false, sorter: "number" });
  }
}

function formatterFor(column, htmlColumns) {
  if (column === "status") {
    return (cell) => {
      const value = cell.getValue() || t(state.language, "values.unknown");
      const badgeClass = value === "not_available" ? "badge warn" : "badge";
      return `<span class="${badgeClass}">${escapeHtml(String(value))}</span>`;
    };
  }
  if (htmlColumns.has(column)) {
    return "html";
  }
  return "plaintext";
}

function sorterFor(column) {
  if (column === "win_pct") {
    return (left, right) => percentSortValue(left) - percentSortValue(right);
  }
  return NUMERIC_COLUMNS.has(column) ? "number" : "string";
}

function initialSort(columns) {
  if (columns.includes("rank")) {
    return [{ column: "rank", dir: "asc" }];
  }
  if (columns.includes("kills")) {
    return [{ column: "kills", dir: "desc" }];
  }
  return [];
}

function downloadRowsAsCsv(filename, rows, columns) {
  const headers = columns.map((column) => columnTitle(state.language, column));
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(plainCellText(row[column]))).join(",")),
  ];
  downloadText(filename, `${lines.join("\n")}\n`, "text/csv;charset=utf-8");
}

function downloadAllVideoUrls() {
  const urls = (state.data.videos ?? [])
    .map((row) => row.video_url)
    .filter(Boolean);
  const uniqueUrls = [...new Set(urls)];
  downloadText("gpl-video-urls.txt", `${uniqueUrls.join("\n")}\n`, "text/plain;charset=utf-8");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filenameForSelector(selector) {
  return `${String(selector).replace(/^#/, "").replace(/[^a-z0-9]+/gi, "-")}.csv`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function plainCellText(value) {
  const text = String(value ?? "");
  if (!text.includes("<")) {
    return text;
  }
  const container = document.createElement("div");
  container.innerHTML = text;
  return container.textContent || "";
}

function percentSortValue(value) {
  const parsed = Number.parseFloat(String(value).replace("%", ""));
  return Number.isFinite(parsed) ? parsed : -1;
}

const NUMERIC_COLUMNS = new Set([
  "rank",
  "seasons_won",
  "titles",
  "title_count",
  "elo",
  "rating",
  "seasons",
  "divisions",
  "trainers",
  "teams",
  "matches",
  "standings",
  "killlists",
  "unavailable_killlists",
  "matched_videos",
  "wins",
  "losses",
  "draws",
  "points",
  "best_rank",
  "appearances",
  "kills",
  "deaths",
  "differential",
  "championships",
  "confidence",
  "detected_week",
  "draft_count",
  "season_count",
  "trainer_count",
  "team_count",
  "tier_rank",
]);

function minWidthFor(column) {
  if (["name", "person", "team", "pokemon", "trainer", "player_a", "player_b", "winner", "video", "videos", "source", "title", "channel", "perspective_person", "opponent", "video_type", "missing_data", "notes", "match_basis", "confidence_explanation", "record"].includes(column)) {
    return 170;
  }
  if (column === "status") {
    return 150;
  }
  return NUMERIC_COLUMNS.has(column) || column === "win_pct" ? 96 : 128;
}

function tableHtml(rows, columns, html = false) {
  const htmlColumns = new Set(html === true ? ["video"] : Array.isArray(html) ? html : []);
  return `
    <table>
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(columnTitle(state.language, column))}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                ${columns
                  .map((column) => {
                    const value = row[column] ?? "";
                    const content = htmlColumns.has(column) ? value : escapeHtml(String(value));
                    const badgeClass = String(value) === "not_available" ? "badge warn" : "badge";
                    return `<td>${column === "status" ? `<span class="${badgeClass}">${content || escapeHtml(t(state.language, "values.unknown"))}</span>` : content}</td>`;
                  })
                  .join("")}
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderError(error) {
  document.querySelectorAll(".table-wrap").forEach((target) => {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.loadError"))} ${escapeHtml(error.message)}</p>`;
  });
}

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedKey(value) {
  const folded = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replaceAll("Ã¤", "ae")
    .replaceAll("Ã¶", "oe")
    .replaceAll("Ã¼", "ue")
    .replaceAll("ÃŸ", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return {
    presentlp: "present",
    prespres: "present",
    present: "present",
    shirosan: "shiro",
    shriosan: "shiro",
    neverusedshiro: "shiro",
    daumenkinolp: "daumenkino",
    daumenkino: "daumenkino",
    sinofspeed: "barry d sin of speed",
    "sin of speed": "barry d sin of speed",
    fulllifegames: "bene",
    "full lifegames": "bene",
    dauni: "dauni daunstar",
    daunidaunstar: "dauni daunstar",
    artngaming: "art n gaming",
    "art n gaming": "art n gaming",
    kaffecone: "art n gaming",
    kaffeecone: "art n gaming",
    kaffeconelp: "art n gaming",
    kaffeeconelp: "art n gaming",
    regi: "regibang",
    ogdeniz96: "og dnz",
    ogdnz: "og dnz",
    raizorzockt: "raizor",
    "raizor zockt": "raizor",
    maxivonvogel: "maxi von vogel",
    maxi: "maxi von vogel",
    teammauni: "maxi von vogel",
    crowd: "crowdcontroller",
    crowdcontroller: "crowdcontroller",
    professorn: "professor n",
    "professor n": "professor n",
    stratocoptertv: "stratocopter tv",
    "stratocopter tv": "stratocopter tv",
    tabascotv: "tabasco tv",
    "tabasco tv": "tabasco tv",
    belmontgabriellp: "belmontgabriel",
    enteitainment: "lauris",
    thedirtydancer64: "dirtyd64",
  }[folded] ?? folded;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
