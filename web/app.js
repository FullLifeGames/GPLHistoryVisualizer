import {
  TABULATOR_LANGS,
  columnTitle,
  nextLanguage,
  nextTheme,
  normalizeLanguage,
  normalizeTheme,
  t,
} from "./i18n.js";
import { parseRouteHash, personRouteHash, pokemonRouteHash, rosterRouteHash, seasonRouteHash, viewRouteHash } from "./router.js";
import { pokemonAssetId } from "./pokemon_names.js";
import { defaultViewForGroup, viewGroupForView } from "./view_config.js";
import {
  ALL_TIME_COLUMNS,
  columnsForProfile,
  MATCHUP_COLUMNS,
  normalizeColumnProfile,
  PERSON_SEASON_COLUMNS,
  POKEMON_DRAFT_COLUMNS,
  POKEMON_KILLLIST_COLUMNS,
  SEASON_STANDINGS_COLUMNS,
  TABLE_HISTORY_COLUMNS,
  TEAM_ROSTER_COLUMNS,
  TEAM_ROSTER_POKEMON_COLUMNS,
} from "./table_columns.js";
import { tableHeaderFilterConfig } from "./table_filters.js";
import {
  aggregatePersonStats,
  canonicalKilllistRows,
  detailRowsWithDraftInstances,
  displayNumber,
  divisionMatches,
  eloRatings,
  filterSourceClaims,
  matchupOverview,
  mergeSeasonLists,
  missingDataRows,
  numberValue,
  personStorySummary,
  personPokemonHighlights,
  personOptionsFromAllTimeRows,
  pokemonDraftOverviewRows,
  pokemonTitleIndex,
  pokemonStorySummary,
  pokemonTimelineRows,
  personDetailKilllistRows,
  primaryCompetitionRows,
  qualityRowsFromData,
  reviewWorkflowRows,
  rosterKilllistRows,
  seasonCoverageRows,
  seasonCountFromList,
  sourceClaimsForSeason,
  summarizePokemonDetail,
  summarizeKilllists,
  summarizeTrainerPokemon,
  teamRosterDisplayGroups,
  teamRosterOverviewRows,
  teamRosterPokemonRows,
  titleInfoWithinSeasonList,
  winPercentage,
  weightedRating,
} from "./stats.js";

const CORE_DATASETS = {
  seasons: "../data/normalized/seasons.csv",
  people: "../data/normalized/people.csv",
  teams: "../data/normalized/teams.csv",
  standings: "../data/normalized/standings.csv",
  personStints: "../data/normalized/person_stints.csv",
  matches: "../data/normalized/matches.csv",
  champions: "../data/normalized/champions.csv",
  killlists: "../data/normalized/pokemon_killlists.csv",
};

const LAZY_DATASETS = {
  videos: { url: "../data/normalized/video_archive.csv", optional: true },
  matchVideos: { url: "../data/normalized/match_videos.csv", optional: true },
  pokemonDraftOverview: { url: "../data/normalized/pokemon_draft_overview.csv", optional: true },
  pokemonDraftInstances: { url: "../data/normalized/pokemon_draft_instances.csv", optional: true },
  teamPokemonUsage: { url: "../data/manual/team_pokemon_usage.csv", optional: true },
  teamRosters: { url: "../data/normalized/team_rosters.csv", optional: true },
  dataQuality: { url: "../data/normalized/data_quality.csv", optional: true },
  sourceClaims: { url: "../data/normalized/source_claims.csv", optional: true },
  reviewIndex: { url: "../data/review/review_index.csv", optional: true },
  missingKilllists: { url: "../data/review/missing_killlists.csv", optional: true },
  missingKilllistAppearances: { url: "../data/review/missing_killlist_appearances.csv", optional: true },
  lowConfidenceVideos: { url: "../data/review/low_confidence_videos.csv", optional: true },
  ambiguousMatches: { url: "../data/review/ambiguous_matches.csv", optional: true },
  personAllTime: { url: "../data/normalized/person_all_time.csv", optional: true },
  pokemonAllTime: { url: "../data/normalized/pokemon_all_time.csv", optional: true },
  matchupSummary: { url: "../data/normalized/matchup_summary.csv", optional: true },
  rosterScores: { url: "../data/normalized/roster_scores.csv", optional: true },
  seasonStorylines: { url: "../data/normalized/season_storylines.csv", optional: true },
};

const DATASETS = { ...CORE_DATASETS, ...LAZY_DATASETS };

const VIEW_DATASETS = {
  "all-time": ["personAllTime"],
  matchup: ["matchVideos", "matchupSummary"],
  killlists: ["pokemonDraftOverview", "pokemonAllTime"],
  "pokemon-drafts": ["pokemonDraftOverview", "pokemonDraftInstances"],
  "pokemon-detail": ["pokemonDraftOverview", "pokemonDraftInstances"],
  "table-history": [],
  "match-plan": ["matchVideos"],
  "battle-history": ["matchVideos"],
  "team-rosters": ["pokemonDraftOverview", "teamPokemonUsage", "teamRosters", "rosterScores"],
  "roster-detail": ["pokemonDraftOverview", "teamPokemonUsage", "teamRosters", "rosterScores"],
  "video-archive": ["videos"],
  "person-details": ["personAllTime", "videos", "pokemonDraftOverview", "pokemonDraftInstances", "teamPokemonUsage", "teamRosters", "rosterScores"],
  "data-coverage": ["dataQuality", "reviewIndex"],
  "review-workflow": ["reviewIndex", "missingKilllists", "missingKilllistAppearances", "lowConfidenceVideos", "ambiguousMatches"],
  "source-claims": ["sourceClaims"],
  "season-detail": ["videos", "sourceClaims", "seasonStorylines"],
};

const ROSTER_BACKGROUND_BY_SEASON = {
  season_003: "assets/roster-backgrounds/gpl-s3-background.png",
  season_004: "assets/roster-backgrounds/gpl-s4-background.png",
  season_005: "assets/roster-backgrounds/gpl-s5-background.png",
  season_007: "assets/roster-backgrounds/gpl-s7-background.png",
  season_008: "assets/roster-backgrounds/gpl-s8-background.png",
  season_009: "assets/roster-backgrounds/gpl-s9-background-pink-blau.png",
  season_010: "assets/roster-backgrounds/gpl-s10-background.png",
};

const ROSTER_BACKGROUND_POOL = Object.values(ROSTER_BACKGROUND_BY_SEASON);

const DATASET_LABELS = {
  seasons: "Saisons",
  people: "Personen",
  teams: "Teams",
  standings: "Tabellen",
  personStints: "Personen-Stints",
  matches: "Kämpfe",
  champions: "Titel",
  killlists: "Killlisten",
  videos: "Video-Archiv",
  matchVideos: "Video-Match-Zuordnungen",
  pokemonDraftOverview: "Pokémon-Drafts",
  teamPokemonUsage: "Team-Pokémon-Zuordnungen",
  pokemonDraftInstances: "Pokémon-Draft-Instanzen",
  dataQuality: "Datenlage",
  sourceClaims: "Quellenclaims",
  reviewIndex: "Review-Index",
  missingKilllists: "Fehlende Killlisten",
  missingKilllistAppearances: "Offene Einsätze",
  lowConfidenceVideos: "Video-Review",
  ambiguousMatches: "Mehrdeutige Matches",
  personAllTime: "Aggregierte Ewige Tabelle",
  pokemonAllTime: "Aggregierte Pokémon-Tabelle",
  matchupSummary: "Aggregierte Matchups",
  rosterScores: "Aggregierte Kaderscores",
  seasonStorylines: "Saisonakten-Aggregate",
};

const state = {
  view: "all-time",
  season: "all",
  dataMode: normalizeDataMode(readPreference("gpl-data-mode", "primary")),
  columnProfile: normalizeColumnProfile(readPreference("gpl-column-profile", "full")),
  division: "all",
  language: normalizeLanguage(readPreference("gpl-language", "de")),
  theme: normalizeTheme(readPreference("gpl-theme", "light")),
  search: "",
  personFocus: null,
  pokemonFocus: null,
  rosterFocus: null,
  draftPickedStatus: "all",
  draftTierFilter: "all",
  rosterCardLimit: 24,
  rosterVariantSelection: {},
  autoSeasonDefault: false,
  data: {},
  loadedDatasets: new Set(),
  loadingDatasets: new Map(),
};

const statusEl = document.querySelector("#load-status");
const loadingOverlay = document.querySelector("#app-loading");
const loadingDetail = document.querySelector("#loading-detail");
const loadingProgressBar = document.querySelector("#loading-progress-bar");
const loadingProgressText = document.querySelector("#loading-progress-text");
const languageToggle = document.querySelector("#language-toggle");
const themeToggle = document.querySelector("#theme-toggle");
const dataModeFilter = document.querySelector("#data-mode-filter");
const columnProfileFilter = document.querySelector("#column-profile-filter");
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
  showLoadingOverlay();
  try {
    await loadCoreDatasets();
    applyRouteFromHash();
    await ensureDatasetsForView(state.view);
    populateSeasonFilter();
    populateDivisionFilter();
    populateMatchupOptions();
    render();
    statusEl.textContent = t(state.language, "status.loaded");
    statusEl.classList.add("is-ready");
    hideLoadingOverlay();
  } catch (error) {
    statusEl.textContent = t(state.language, "status.failed");
    statusEl.classList.add("is-error");
    hideLoadingOverlay();
    console.error(error);
    renderError(error);
  }
}

function bindControls() {
  dataModeFilter.value = state.dataMode;
  columnProfileFilter.value = state.columnProfile;
  dataModeFilter.addEventListener("change", () => {
    state.dataMode = dataModeFilter.value || "primary";
    state.dataMode = normalizeDataMode(state.dataMode);
    savePreference("gpl-data-mode", state.dataMode);
    state.division = "all";
    resetRosterCardLimit();
    divisionFilter.value = state.division;
    populateDivisionFilter();
    populateMatchupOptions();
    render();
    if (state.view === "matchup") {
      renderMatchup();
    }
  });

  columnProfileFilter.addEventListener("change", () => {
    state.columnProfile = normalizeColumnProfile(columnProfileFilter.value);
    columnProfileFilter.value = state.columnProfile;
    savePreference("gpl-column-profile", state.columnProfile);
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

  document.querySelectorAll(".nav-group-tab").forEach((button) => {
    button.addEventListener("click", () => {
      navigateToView(defaultViewForGroup(button.dataset.viewGroup));
    });
  });

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      navigateToView(button.dataset.view);
    });
  });

  seasonFilter.addEventListener("change", () => {
    state.season = seasonFilter.value;
    state.autoSeasonDefault = false;
    resetRosterCardLimit();
    populateMatchupOptions();
    render();
  });

  divisionFilter.addEventListener("change", () => {
    state.division = divisionFilter.value;
    resetRosterCardLimit();
    populateMatchupOptions();
    render();
  });

  searchFilter.addEventListener("input", () => {
    state.search = searchFilter.value.trim().toLowerCase();
    resetRosterCardLimit();
    populateMatchupOptions();
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
    const matchupLink = event.target.closest("[data-matchup-select]");
    if (matchupLink) {
      event.preventDefault();
      selectMatchupParticipant(matchupLink.dataset.matchupSelect, matchupLink.dataset.matchupSlot, matchupLink.dataset.matchupPrimary);
      return;
    }
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
      navigateToView("all-time");
    }
    if (event.target.closest("[data-clear-pokemon-focus]")) {
      event.preventDefault();
      navigateToView("all-time");
    }
    if (event.target.closest("[data-show-more-rosters]")) {
      event.preventDefault();
      state.rosterCardLimit += defaultRosterCardLimit();
      renderTeamRosters();
    }
    const rosterVariantButton = event.target.closest("[data-roster-variant-key]");
    if (rosterVariantButton) {
      event.preventDefault();
      state.rosterVariantSelection[rosterVariantButton.dataset.rosterGroupKey] = rosterVariantButton.dataset.rosterVariantKey;
      renderTeamRosters();
      renderRosterDetail();
    }
  });

  window.addEventListener("hashchange", () => {
    void handleRouteChange();
  });
}

async function handleRouteChange() {
  applyRouteFromHash();
  populateDivisionFilter();
  populateMatchupOptions();
  const loadedLazyDatasets = await ensureDatasetsForView(state.view);
  if (loadedLazyDatasets) {
    populateDivisionFilter();
    populateMatchupOptions();
    statusEl.textContent = t(state.language, "status.loaded");
    statusEl.classList.add("is-ready");
  }
  render();
  if (state.view === "matchup") {
    renderMatchup();
  }
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

function selectMatchupParticipant(value, slot = "b", primary = "") {
  if (primary) {
    setMatchupSelectValue(matchupA, primary);
  }
  if (slot === "a") {
    setMatchupSelectValue(matchupA, value);
  } else if (slot === "b") {
    setMatchupSelectValue(matchupB, value);
  } else if (!matchupA.value) {
    setMatchupSelectValue(matchupA, value);
  } else {
    setMatchupSelectValue(matchupB, value);
  }
  if (state.view !== "matchup") {
    navigateToView("matchup");
    return;
  }
  renderMatchup();
}

function setMatchupSelectValue(select, value) {
  const key = matchupSelectKey(value);
  if (!key) return false;
  if (![...select.options].some((option) => option.value === key)) {
    return false;
  }
  select.value = key;
  return true;
}

function applyRouteFromHash() {
  const route = parseRouteHash(window.location.hash);
  const previousView = state.view;
  const previousGroup = viewGroupForView(previousView);
  const currentGroup = viewGroupForView(route.view);
  if (route.personKey) {
    state.personFocus = resolvePersonFocus(route.personKey);
    state.pokemonFocus = null;
    state.rosterFocus = null;
    state.season = "all";
    state.autoSeasonDefault = false;
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else if (route.seasonId) {
    state.personFocus = null;
    state.pokemonFocus = null;
    state.rosterFocus = null;
    state.season = route.seasonId;
    state.autoSeasonDefault = false;
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else if (route.pokemonKey) {
    state.personFocus = null;
    state.pokemonFocus = resolvePokemonFocus(route.pokemonKey);
    state.rosterFocus = null;
    state.season = "all";
    state.autoSeasonDefault = false;
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else if (route.rosterKey) {
    state.personFocus = null;
    state.pokemonFocus = null;
    state.rosterFocus = { key: route.rosterKey };
    state.season = "all";
    state.autoSeasonDefault = false;
    state.division = "all";
    state.search = "";
    seasonFilter.value = state.season;
    divisionFilter.value = state.division;
    searchFilter.value = "";
  } else {
    state.personFocus = null;
    state.pokemonFocus = null;
    state.rosterFocus = null;
    if (previousGroup !== currentGroup) {
      state.search = "";
      searchFilter.value = "";
    }
  }
  setActiveView(route.view);
  applyViewSeasonDefaults(route, previousView);
}

function applyViewSeasonDefaults(route, previousView) {
  const previousGroup = viewGroupForView(previousView);
  const currentGroup = viewGroupForView(route.view);
  if (previousGroup === "seasons" && currentGroup !== "seasons" && state.autoSeasonDefault) {
    state.season = "all";
    state.autoSeasonDefault = false;
  }
  if (currentGroup === "seasons" && !route.seasonId && state.season === "all") {
    state.season = "season_010";
    state.autoSeasonDefault = true;
  }
  seasonFilter.value = state.season;
}

function setActiveView(viewName) {
  state.view = viewName;
  document.querySelectorAll(".tab").forEach((item) => {
    const activeGroup = viewGroupForView(viewName);
    const inActiveGroup = item.dataset.viewGroup === activeGroup;
    item.hidden = !inActiveGroup;
    item.setAttribute("aria-hidden", String(!inActiveGroup));
    item.classList.toggle("is-active", item.dataset.view === viewName);
  });
  document.querySelectorAll(".nav-group-tab").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.viewGroup === viewGroupForView(viewName));
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
    (state.data.pokemonDraftOverview ?? []).find((row) => normalizedKey(row.pokemon_normalized || row.pokemon || row.asset_id) === comparable)?.pokemon ||
    (state.data.pokemonDraftInstances ?? []).find((row) => normalizedKey(row.pokemon_normalized || row.pokemon || row.asset_id) === comparable)?.pokemon ||
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
  return value === "league2" || value === "all" ? value : "primary";
}

async function loadCoreDatasets() {
  state.data = await loadDatasetKeys(Object.keys(CORE_DATASETS), { overlay: true });
}

async function ensureDatasetsForView(viewName) {
  const pending = (VIEW_DATASETS[viewName] ?? []).filter((key) => !state.loadedDatasets.has(key));
  if (pending.length) {
    renderViewLoadingState(viewName, pending);
  }
  return ensureDatasets(pending);
}

async function ensureDatasets(keys = []) {
  const pending = keys.filter((key) => !state.loadedDatasets.has(key));
  if (!pending.length) {
    return false;
  }
  statusEl.classList.remove("is-ready", "is-error");
  await loadDatasetKeys(pending, { overlay: !Object.keys(state.data).length });
  return true;
}

function renderViewLoadingState(viewName, keys) {
  const view = document.querySelector(`#view-${viewName}`);
  if (!view) return;
  const labels = keys.map(datasetLabel).join(", ");
  const message = formatMessage(t(state.language, "loading.dataset"), { name: labels });
  view.querySelectorAll(".table-wrap, .result-box, .summary-grid, .bracket-board, .roster-grid, .roster-detail-visual").forEach((target) => {
    if (target.id) {
      destroyTable(`#${target.id}`);
    }
    target.innerHTML = `<p class="empty">${escapeHtml(message)}</p>`;
  });
}

async function loadDatasetKeys(keys, options = {}) {
  let completed = 0;
  const total = keys.length;
  updateLoadingProgress({ completed, total, dataset: "" });
  const entries = await Promise.all(
    keys.map(async (key) => {
      const rows = await loadDataset(key);
      completed += 1;
      updateLoadingProgress({ completed, total, dataset: datasetLabel(key) });
      return [key, rows];
    }),
  );
  if (options.overlay && completed >= total) {
    updateLoadingProgress({ completed, total, dataset: t(state.language, "loading.ready") });
  }
  return Object.fromEntries(entries);
}

async function loadDataset(key) {
  if (state.loadedDatasets.has(key)) {
    return state.data[key] ?? [];
  }
  if (state.loadingDatasets.has(key)) {
    return state.loadingDatasets.get(key);
  }
  const promise = fetchDataset(key).then((rows) => {
    state.data[key] = rows;
    state.loadedDatasets.add(key);
    state.loadingDatasets.delete(key);
    return rows;
  });
  state.loadingDatasets.set(key, promise);
  return promise;
}

async function fetchDataset(key) {
  const spec = DATASETS[key];
  if (!spec) {
    throw new Error(`Unknown dataset ${key}`);
  }
  const url = typeof spec === "string" ? spec : spec.url;
  const optional = typeof spec === "string" ? false : Boolean(spec.optional);
  const response = await fetch(url);
  if (!response.ok && optional) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return parseCsv(await response.text());
}

function datasetLabel(key) {
  return DATASET_LABELS[key] || key;
}

function showLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.hidden = false;
  }
}

function hideLoadingOverlay() {
  if (loadingOverlay) {
    loadingOverlay.hidden = true;
  }
}

function updateLoadingProgress({ completed = 0, total = 0, dataset = "" } = {}) {
  const percent = total ? Math.round((completed / total) * 100) : 0;
  if (loadingProgressBar) {
    loadingProgressBar.style.width = `${percent}%`;
  }
  if (loadingProgressText) {
    loadingProgressText.textContent = formatMessage(t(state.language, "loading.progress"), { completed, total });
  }
  if (loadingDetail) {
    loadingDetail.textContent = dataset ? formatMessage(t(state.language, "loading.dataset"), { name: dataset }) : t(state.language, "loading.subtitle");
  }
  statusEl.textContent = dataset ? `${formatMessage(t(state.language, "loading.dataset"), { name: dataset })} (${completed}/${total})` : t(state.language, "status.loading");
}

function formatMessage(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
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
  ["standings", "personStints", "matches", "matchVideos", "teams", "killlists", "teamPokemonUsage", "teamRosters", "videos"].forEach((dataset) => {
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
  const statRows = filteredPersonStats({ primaryOnly: state.dataMode === "primary" });
  const champions = filtered(state.data.champions ?? []).filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status));
  return personOptionsFromAllTimeRows(statRows, champions, normalizedKey);
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
  renderBracketOverview();
  renderTeamRosters();
  renderRosterDetail();
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
    const divisionOk = divisionMatches(row, state.division);
    const searchOk = !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search);
    return dataModeOk && seasonOk && divisionOk && searchOk;
  });
}

function scoped(rows) {
  return rows.filter((row) => {
    const dataModeOk = applyDataMode(row);
    const seasonOk = state.season === "all" || row.season_id === state.season;
    const divisionOk = divisionMatches(row, state.division);
    return dataModeOk && seasonOk && divisionOk;
  });
}

function combinedDetailRows() {
  return detailRowsWithDraftInstances(
    personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division),
    filtered(state.data.pokemonDraftInstances ?? []),
    normalizedKey,
  );
}

function performanceDisplay(row, field) {
  return numberValue(row.performance_rows) > 0 ? displayNumber(row[field]) : "";
}

function draftDetailStatus(row) {
  return numberValue(row.performance_rows) > 0 ? "" : t(state.language, "values.draftOnly");
}

function applyDataMode(row) {
  const division = row.division || "";
  if (state.dataMode === "all") {
    return true;
  }
  if (!division) {
    return state.dataMode !== "league2";
  }
  if (state.dataMode === "league2") {
    return division === "Liga 2";
  }
  return division !== "Liga 2";
}

function metricCard(label, value) {
  return `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`;
}

function seasonDisplay(seasonId) {
  const match = String(seasonId ?? "").match(/season_0*(\d+)/);
  if (!match) return seasonId || "";
  return state.language === "de" ? `Saison ${Number(match[1])}` : `Season ${Number(match[1])}`;
}

function seasonSlug(seasonId) {
  const match = String(seasonId ?? "").match(/season_0*(\d+)/);
  return match ? `s${Number(match[1])}` : normalizedKey(seasonId || "season");
}

function seasonListDisplay(seasonIds) {
  return [...new Set((seasonIds ?? []).filter(Boolean))]
    .sort((a, b) => seasonOrder(a) - seasonOrder(b) || String(a).localeCompare(String(b)))
    .map(seasonDisplay)
    .join(", ");
}

function shortSeasonList(value) {
  const seasons = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/(\d+)/);
      return match ? `S${Number(match[1])}` : item;
    });
  return [...new Set(seasons)]
    .sort((a, b) => seasonOrder(a) - seasonOrder(b) || String(a).localeCompare(String(b)))
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

function sourceCell(value) {
  const links = sourceLinks(value);
  if (links) return links;
  const labels = String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  return labels ? `<span class="muted">${escapeHtml(labels)}</span>` : "";
}

function personLink(key, name) {
  return `<a class="link-button" href="${escapeAttr(personRouteHash(key))}" data-person-key="${escapeAttr(key)}" data-person-name="${escapeAttr(name)}">${escapeHtml(name)}</a>`;
}

function pokemonLink(key, name) {
  const label = name || key;
  return `<a class="link-button" href="${escapeAttr(pokemonRouteHash(key))}" data-pokemon-key="${escapeAttr(key)}" data-pokemon-name="${escapeAttr(label)}">${escapeHtml(label)}</a>`;
}

function pokemonCell(name, key = normalizedKey(name), assetName = name) {
  return `<span class="pokemon-cell">${pokemonIcon(assetName, name)}${pokemonLink(key, name)}</span>`;
}

function rosterDetailLink(rosterKey, label, className = "link-button") {
  const text = String(label ?? "").trim();
  if (!rosterKey || !text) {
    return escapeHtml(text);
  }
  return `<a class="${escapeAttr(className)}" href="${escapeAttr(rosterRouteHash(rosterKey))}" data-roster-key="${escapeAttr(rosterKey)}">${escapeHtml(text)}</a>`;
}

function rosterLinkForContext(row, label = row.team_name || row.team || "") {
  return rosterDetailLink(rosterGroupKeyFromRow(row), label);
}

function rosterParticipantLink(row, side) {
  const person = row[`player_${side}`] || "";
  const team = row[`team_${side}`] || "";
  const label = person || team;
  return rosterDetailLink(rosterGroupKeyFromRow({ ...row, player_name: person, person_name: person, team_name: team }), label);
}

function pokemonIcon(name, label = name) {
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
  return `<span class="pokemon-icon-fallback" aria-hidden="true">${escapeHtml(String(label || name || "?").slice(0, 1).toUpperCase())}</span>`;
}

function pokemonSprite(name) {
  const sprites = window.pkmn?.img?.Sprites;
  const id = pokemonAssetId(name);
  const fallback = `<span class="pokemon-sprite pokemon-sprite-fallback" aria-hidden="true">${escapeHtml(String(name || "?").slice(0, 2).toUpperCase())}</span>`;
  try {
    const animatedSprite = sprites?.getPokemon?.(id, { gen: "ani" });
    const isAnimated = /\.gif(?:$|\?)/i.test(animatedSprite?.url || "");
    const sprite = isAnimated ? animatedSprite : sprites?.getDexPokemon?.(id) || sprites?.getPokemon?.(id);
    if (sprite?.url) {
      const rendering = sprite.pixelated ? "image-rendering: pixelated;" : "";
      const modeClass = isAnimated ? " pokemon-sprite-animated" : "";
      const mode = isAnimated ? "animated" : "static";
      return `<span class="pokemon-sprite-frame"><img class="pokemon-sprite pokemon-sprite-img${modeClass}" src="${escapeAttr(sprite.url)}" width="${escapeAttr(sprite.w || 96)}" height="${escapeAttr(sprite.h || 96)}" alt="${escapeAttr(name)}" data-sprite-mode="${mode}" style="${rendering}" loading="lazy" decoding="async" onerror="this.hidden=true" /></span>`;
    }
  } catch {
    // Keep the detail page useful even when a local or German name has no sprite mapping.
  }
  return `<span class="pokemon-sprite-frame">${fallback}</span>`;
}

function seasonLink(seasonId) {
  return `<a class="link-button" href="${escapeAttr(seasonRouteHash(seasonId))}">${escapeHtml(seasonDisplay(seasonId))}</a>`;
}

function rosterGroupKeyFromRow(row) {
  const season = row.season_id || row.detected_season_id || "";
  const division = row.division || "";
  const personName = row.person_name || row.player_name || row.person || row.trainer || row.champion_name || "";
  const teamName = row.team_name || row.team || row.champion_team || inferredTeamForSeasonPerson(season, personName);
  const teamKey = normalizedKey(row.team_key || row.team_name_normalized || teamName || "");
  const personKey = normalizedKey(row.person_key || row.person_name_normalized || personName || rosterPersonIdKey(row.person_id || row.champion_person_id));
  if (!season || (!teamKey && !personKey)) {
    return "";
  }
  return JSON.stringify([season, rosterVariantFamilyForRoute({ season_id: season, division }), teamKey, personKey]);
}

function rosterPersonIdKey(value) {
  return String(value ?? "").replace(/^person_/, "").replaceAll("_", " ");
}

function inferredTeamForSeasonPerson(seasonId, personName) {
  const personKey = normalizedKey(personName);
  if (!seasonId || !personKey) return "";
  const row =
    (state.data.standings ?? []).find((item) => item.season_id === seasonId && normalizedKey(item.player_name) === personKey && item.team_name) ||
    (state.data.personStints ?? []).find((item) => item.season_id === seasonId && normalizedKey(item.person_name || item.player_name) === personKey && item.team_name) ||
    (state.data.teams ?? []).find((item) => item.season_id === seasonId && normalizedKey(item.person_name || item.player_name) === personKey && item.team_name);
  return row?.team_name || "";
}

function rosterVariantFamilyForRoute(row) {
  const division = normalizedKey(row.division);
  if (row.season_id === "season_006" && (division === "sun conference" || division === "moon conference" || division.includes("playoff"))) {
    return "main";
  }
  if (division === "regular season" || division.includes("playoff")) {
    return "main";
  }
  return division || "unknown";
}

function personIdForName(name) {
  const key = normalizedKey(name);
  const row = (state.data.people ?? []).find((person) => {
    const aliases = String(person.aliases || "")
      .split(";")
      .map((alias) => normalizedKey(alias));
    return (
      normalizedKey(person.person_name) === key ||
      normalizedKey(person.person_name_normalized) === key ||
      normalizedKey(person.person_id) === key ||
      aliases.includes(key)
    );
  });
  return row?.person_id || `person_${key.replaceAll(" ", "_")}`;
}

function personDisplayName(name) {
  const id = personIdForName(name);
  return (state.data.people ?? []).find((person) => person.person_id === id)?.person_name || name;
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
  const aggregateRows = aggregateAllTimeRows();
  if (aggregateRows) {
    renderTable("#all-time-table", aggregateRows, ALL_TIME_COLUMNS, ["name"]);
    return;
  }

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
        numberValue(b.rating) - numberValue(a.rating) ||
        numberValue(b.elo) - numberValue(a.elo) ||
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

function aggregateAllTimeRows() {
  const rows = state.data.personAllTime ?? [];
  if (!rows.length || state.dataMode !== "all" || state.season !== "all" || state.division !== "all") {
    return null;
  }
  return rows
    .filter((row) => !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search))
    .map((row, index) => ({
      rank: index + 1,
      name: personLink(row.person_id, row.person_name),
      seasons_won: row.seasons_won,
      title_seasons: shortSeasonList(row.title_seasons),
      seasons: row.seasons,
      season_list: shortSeasonList(row.season_list),
      elo: row.elo,
      matches: row.matches,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      win_pct: row.win_pct,
      rating: row.weighted_rating,
      points: row.points,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      best_rank: row.best_rank,
    }));
}

function availableMatchRows() {
  return filtered(state.data.matches ?? []).filter((row) => !["source_video_only", "not_available"].includes(row.data_status));
}

function personComparableKey(value) {
  return normalizedKey(String(value || "").replace(/^person_/, "").replaceAll("_", " "));
}

function renderKilllists() {
  const aggregateRows = aggregateKilllistRows();
  if (aggregateRows) {
    renderTable("#killlists-table", aggregateRows, POKEMON_KILLLIST_COLUMNS, ["pokemon"]);
    return;
  }

  const titles = pokemonTitleIndex(state.data.pokemonDraftOverview ?? [], normalizedKey);
  const draftHistory = pokemonDraftHistoryIndex();
  const rows = summarizeKilllists(canonicalKilllistRows(filtered(state.data.killlists ?? []), state.division)).map((row) => ({
    ...row,
    ...pokemonHistoryFields(row, titles, draftHistory),
    pokemon: pokemonCell(row.pokemon),
  }));
  renderTable("#killlists-table", rows, POKEMON_KILLLIST_COLUMNS, ["pokemon"]);
}

function pokemonDraftHistoryIndex() {
  const rows = pokemonDraftOverviewRows(state.data.pokemonDraftOverview ?? [], {
    draftInstances: draftInstanceScopeForOverview(),
    normalizeKey: normalizedKey,
  });
  const index = new Map();
  rows
    .filter((row) => row.picked_status !== "never_picked")
    .forEach((row) => {
      [row.pokemon_normalized, row.pokemon, row.asset_id, row.english].forEach((value) => {
        const key = normalizedKey(value);
        if (key && !index.has(key)) {
          index.set(key, row);
        }
      });
    });
  return index;
}

function pokemonHistoryFields(row, titleIndex, draftHistory) {
  const key = normalizedKey(row.pokemon_normalized || row.pokemon);
  const draft = draftHistory.get(key) || draftHistory.get(key.replace(/\s+/g, ""));
  const seasonList = mergeSeasonLists(row.season_list, draft?.season_list);
  return {
    seasons: seasonCountFromList(seasonList),
    season_list: seasonList,
    ...titleInfoWithinSeasonList(titleInfoForPokemon(titleIndex, row.pokemon), seasonList),
  };
}

function aggregateKilllistRows() {
  const rows = state.data.pokemonAllTime ?? [];
  if (!rows.length || state.season !== "all" || state.division !== "all" || state.dataMode !== "all") {
    return null;
  }
  return rows
    .filter((row) => state.season === "all" || String(row.season_list || "").includes(seasonDisplay(state.season)))
    .filter((row) => !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search))
    .map((row, index) => ({
      rank: index + 1,
      pokemon: pokemonCell(row.pokemon, row.pokemon_normalized || normalizedKey(row.pokemon)),
      appearances: row.appearances,
      kills: row.kills,
      deaths: row.deaths,
      differential: row.differential,
      seasons: row.seasons,
      season_list: shortSeasonList(row.season_list),
      titles: row.titles,
      title_seasons: shortSeasonList(row.title_seasons),
      trainers: row.trainers,
      teams: row.teams,
    }));
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
    search: state.search,
    draftInstances: draftInstanceScopeForOverview(),
    normalizeKey: normalizedKey,
  }).map((row) => ({
    ...row,
    season_list: shortSeasonList(row.season_list),
    title_seasons: shortSeasonList(row.title_seasons),
    pokemon: pokemonCell(row.pokemon, row.pokemon_normalized || normalizedKey(row.pokemon), row.asset_id || row.pokemon),
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

function draftInstanceScopeForOverview() {
  const rows = state.data.pokemonDraftInstances;
  if (!Array.isArray(rows)) return null;
  const needsScopedDraftCounts = state.dataMode !== "primary" || state.season !== "all" || state.division !== "all";
  return needsScopedDraftCounts ? scoped(rows) : null;
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

function mergedRosterUsageRows(manualRows = [], rosterRows = []) {
  const rosterKeys = new Set(rosterRows.map((row) => rosterUsageKey(row)));
  return [...manualRows.filter((row) => !rosterKeys.has(rosterUsageKey(row))), ...rosterRows];
}

function rosterUsageKey(row) {
  return [
    row.season_id || "",
    row.division || "",
    normalizedKey(row.team_name || row.team_name_normalized || row.team || ""),
    normalizedKey(row.person_name || row.person_name_normalized || row.person || ""),
    normalizedKey(row.pokemon_normalized || row.pokemon || ""),
  ].join("\u0000");
}

function renderTeamRosters() {
  const groupedRosters = rosterDisplayGroups();
  renderRosterCards(groupedRosters.groups);
  renderTable(
    "#team-roster-overview-table",
    groupedRosters.overviewRows.map(rosterOverviewTableRow),
    TEAM_ROSTER_COLUMNS,
    ["season", "variants", "person", "team", "roster_score", "top_pokemon", "source"],
    { filename: "team-roster-ranking.csv" },
  );
  renderTable(
    "#team-roster-pokemon-table",
    groupedRosters.pokemonRows.map((row, index) => rosterPokemonTableRow(row, index + 1)),
    TEAM_ROSTER_POKEMON_COLUMNS,
    ["season", "person", "pokemon", "pokemon_score", "source"],
    { filename: "team-roster-pokemon.csv" },
  );
}

function rosterDisplayGroups(options = {}) {
  const { ignoreFilters = false, includeAllDataModes = false } = options;
  const rosterUsageRows = mergedRosterUsageRows(state.data.teamPokemonUsage ?? [], state.data.teamRosters ?? []);
  const rowFilter = (row) => rosterScopeMatches(row, { ignoreFilters, includeAllDataModes });
  const pokemonRows = teamRosterPokemonRows(
    {
      teamUsage: rosterUsageRows.filter(rowFilter),
      killlists: rosterKilllistRows((state.data.killlists ?? []).filter(rowFilter), ignoreFilters ? "all" : state.division),
      pokemonDraftOverview: state.data.pokemonDraftOverview ?? [],
    },
    normalizedKey,
  );
  const overviewRows = teamRosterOverviewRows(pokemonRows, (state.data.standings ?? []).filter(rowFilter));
  return teamRosterDisplayGroups(overviewRows, pokemonRows, state.rosterVariantSelection);
}

function rosterScopeMatches(row, { ignoreFilters = false, includeAllDataModes = false } = {}) {
  const dataModeOk = includeAllDataModes || applyDataMode(row);
  if (ignoreFilters) {
    return dataModeOk;
  }
  const seasonOk = state.season === "all" || row.season_id === state.season;
  const divisionOk = divisionMatches(row, state.division);
  const searchOk = !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search);
  return dataModeOk && seasonOk && divisionOk && searchOk;
}

function rosterOverviewTableRow(row) {
  return {
    ...row,
    season: seasonLink(row.season_id),
    division: rosterOverviewDivisionDisplay(row),
    roster_phase: row.variant_count > 1 ? rosterPhaseDisplay(row.roster_phase) : "",
    variants: rosterVariantControls(row),
    person: row.person ? personLink(personIdForName(row.person), row.person) : "",
    team: rosterDetailLink(row.roster_group_key, row.team || t(state.language, "rosters.openDetail")),
    roster_score: scoreFormulaCell(row.roster_score, rosterScoreFormula(row)),
    top_pokemon: topPokemonLinks(row.top_pokemon),
    source: sourceCell(row.source_urls),
  };
}

function rosterPokemonTableRow(row, rank) {
  return {
    ...row,
    rank,
    season: seasonLink(row.season_id),
    division: divisionDisplay(row.division),
    roster_phase: rosterPhaseDisplay(row.roster_phase),
    person: row.person ? personLink(personIdForName(row.person), row.person) : "",
    team: rosterDetailLink(rosterGroupKeyFromRow(row), row.team || t(state.language, "rosters.openDetail")),
    pokemon: pokemonCell(row.pokemon, row.pokemon_key || normalizedKey(row.pokemon)),
    pokemon_score: scoreFormulaCell(row.pokemon_score, pokemonScoreFormula(row)),
    source: sourceCell(row.source_urls),
  };
}

function renderRosterCards(groups) {
  const target = document.querySelector("#team-roster-cards");
  if (!target) return;
  if (!groups.length) {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    return;
  }
  const limit = state.rosterCardLimit || defaultRosterCardLimit();
  const cards = groups
    .slice(0, limit)
    .map((group) => rosterCard(group.overview, group.pokemonRows))
    .join("");
  const showMore =
    groups.length > limit
      ? `<button class="show-more-button" type="button" data-show-more-rosters>${escapeHtml(t(state.language, "rosters.showMore"))}</button>`
      : "";
  target.innerHTML = `${cards}${showMore}`;
}

function rosterCard(row, pokemonRows) {
  const sortedPokemon = rosterPokemonDisplayRows(pokemonRows);
  const flags = row.roster_flags
    ? `<details class="roster-flags"><summary>${escapeHtml(t(state.language, "rosters.notesSummary"))}</summary><p>${escapeHtml(row.roster_flags)}</p></details>`
    : "";
  const variantControls = rosterVariantControls(row, "roster-variant-tabs");
  const detailLink = rosterDetailLink(row.roster_group_key, t(state.language, "rosters.openDetail"), "roster-detail-link");
  return `
    <article class="roster-card">
      <div class="roster-card-head">
        <span class="roster-rank">#${escapeHtml(row.rank)}</span>
        <div>
          <h3>${row.person ? personLink(personIdForName(row.person), row.person) : escapeHtml(row.team || "")}</h3>
          <p>${escapeHtml(rosterHeaderMeta(row).join(" · "))}</p>
        </div>
        <strong title="${escapeAttr(rosterScoreFormula(row))}">${escapeHtml(String(row.roster_score))}</strong>
      </div>
      ${detailLink}
      ${variantControls}
      <div class="roster-metrics">
        ${rosterMetric("columns.pokemon_count", row.pokemon_count)}
        ${rosterMetric("columns.avg_tier_rank", row.avg_tier_rank || "n/a")}
        ${rosterMetric("columns.kills", row.kills)}
        ${rosterMetric("columns.differential", row.differential)}
      </div>
      <div class="roster-pokemon-list">
        ${sortedPokemon.map((pokemon) => rosterPokemonChip(pokemon)).join("")}
      </div>
      ${flags}
    </article>
  `;
}

function rosterMetric(labelKey, value) {
  return `<span><small>${escapeHtml(t(state.language, labelKey))}</small><strong>${escapeHtml(String(value))}</strong></span>`;
}

function rosterPokemonChip(row) {
  return `<span class="roster-pokemon-chip">${pokemonCell(row.pokemon, row.pokemon_key || normalizedKey(row.pokemon))}<small title="${escapeAttr(pokemonScoreFormula(row))}">${escapeHtml(String(row.pokemon_score))}</small></span>`;
}

function renderRosterDetail() {
  const focus = state.rosterFocus?.key;
  const focusTarget = document.querySelector("#roster-detail-focus");
  const summaryTarget = document.querySelector("#roster-detail-summary");
  const visualTarget = document.querySelector("#roster-detail-visual");
  const tableSelector = "#roster-detail-pokemon-table";
  if (!focusTarget || !summaryTarget || !visualTarget) return;
  destroyTable(tableSelector);

  if (!focus) {
    focusTarget.innerHTML = "";
    summaryTarget.innerHTML = "";
    visualTarget.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    document.querySelector(tableSelector).innerHTML = "";
    return;
  }

  const detail = rosterDetailForKey(focus);
  if (!detail) {
    focusTarget.innerHTML = "";
    summaryTarget.innerHTML = "";
    visualTarget.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "rosters.detailNotFound"))}</p>`;
    document.querySelector(tableSelector).innerHTML = "";
    return;
  }

  const { overview, pokemonRows } = detail;
  const sortedPokemon = rosterPokemonDisplayRows(pokemonRows);
  focusTarget.innerHTML = rosterDetailHero(overview);
  visualTarget.innerHTML = rosterTeamSheet(overview, sortedPokemon);
  summaryTarget.innerHTML = [
    metricCard(t(state.language, "columns.roster_score"), overview.roster_score),
    metricCard(t(state.language, "columns.performance_score"), overview.performance_score),
    metricCard(t(state.language, "columns.balance_score"), overview.balance_score),
    metricCard(t(state.language, "columns.history_score"), overview.history_score),
    metricCard(t(state.language, "columns.confidence_score"), overview.confidence_score),
    metricCard(t(state.language, "columns.pokemon_count"), overview.pokemon_count),
    metricCard(t(state.language, "columns.kills"), displayNumber(overview.kills)),
    metricCard(t(state.language, "columns.deaths"), displayNumber(overview.deaths)),
    metricCard(t(state.language, "columns.differential"), displayNumber(overview.differential)),
  ].join("");
  renderTable(
    tableSelector,
    sortedPokemon.map((row, index) => rosterPokemonTableRow(row, index + 1)),
    TEAM_ROSTER_POKEMON_COLUMNS,
    ["season", "person", "team", "pokemon", "pokemon_score", "source"],
    { filename: `roster-${seasonSlug(overview.season_id)}-${normalizedKey(overview.team || overview.person || "detail")}.csv` },
  );
}

function rosterDetailForKey(key) {
  let group = rosterDisplayGroups({ ignoreFilters: true }).groups.find((item) => item.key === key);
  if (!group) {
    group = rosterDisplayGroups({ ignoreFilters: true, includeAllDataModes: true }).groups.find((item) => item.key === key);
  }
  if (!group) return null;
  return {
    group,
    overview: group.overview,
    pokemonRows: group.pokemonRows,
  };
}

function rosterPokemonDisplayRows(pokemonRows) {
  return [...pokemonRows].sort(compareRosterPokemonBySlot);
}

function compareRosterPokemonBySlot(a, b) {
  const slotDiff = rosterSlotOrder(a) - rosterSlotOrder(b);
  if (slotDiff) {
    return slotDiff;
  }
  return numberValue(b.pokemon_score) - numberValue(a.pokemon_score) || String(a.pokemon).localeCompare(String(b.pokemon));
}

function rosterSlotOrder(row) {
  const raw = String(row?.slot ?? "").trim();
  if (!raw) {
    return Number.POSITIVE_INFINITY;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function rosterDetailHero(row) {
  const title = row.person || row.team || t(state.language, "rosters.detailTitleFallback");
  const meta = rosterHeaderMeta(row).filter(Boolean).join(" · ");
  return `
    <article class="roster-detail-hero">
      <div>
        <span class="roster-detail-kicker">${escapeHtml(t(state.language, "rosters.detailKicker"))}</span>
        <h3>${row.person ? personLink(personIdForName(row.person), row.person) : escapeHtml(title)}</h3>
        <p>${escapeHtml(meta)}</p>
      </div>
      <div class="roster-detail-actions">
        ${rosterVariantControls(row, "roster-variant-tabs")}
        <a class="table-action" href="${escapeAttr(viewRouteHash("team-rosters"))}">${escapeHtml(t(state.language, "rosters.backToOverview"))}</a>
      </div>
    </article>
  `;
}

function rosterTeamSheet(row, pokemonRows) {
  const title = row.team || row.person || t(state.language, "rosters.detailTitleFallback");
  const meta = rosterHeaderMeta(row).filter(Boolean).join(" · ");
  const background = rosterBackgroundFor(row);
  const flags = row.roster_flags
    ? `<details class="roster-detail-flags"><summary>${escapeHtml(t(state.language, "rosters.notesSummary"))}</summary><p>${escapeHtml(row.roster_flags)}</p></details>`
    : "";
  return `
    <section class="roster-teamsheet" style="--roster-bg-image: url(${escapeAttr(background)});">
      <header class="roster-teamsheet-head">
        <div>
          <span>${escapeHtml(t(state.language, "rosters.teamSheetTitle"))}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(meta)}</p>
        </div>
        <div class="roster-teamsheet-score" title="${escapeAttr(rosterScoreFormula(row))}">
          <small>${escapeHtml(t(state.language, "columns.roster_score"))}</small>
          <strong>${escapeHtml(String(row.roster_score ?? ""))}</strong>
        </div>
      </header>
      <div class="roster-teamsheet-grid">
        ${rosterTeamSheetRows(pokemonRows)
          .map(
            (row) => `
              <div class="roster-teamsheet-row roster-teamsheet-row-${row.length}">
                ${row.map(({ pokemon, rank }) => rosterTeamSheetTile(pokemon, rank)).join("")}
              </div>
            `,
          )
          .join("")}
      </div>
      ${flags}
    </section>
  `;
}

function rosterBackgroundFor(row) {
  const seasonBackground = ROSTER_BACKGROUND_BY_SEASON[row.season_id];
  if (seasonBackground) {
    return seasonBackground;
  }
  const seed = [row.season_id, row.division, row.team, row.person].filter(Boolean).join("|");
  return ROSTER_BACKGROUND_POOL[stableBackgroundIndex(seed, ROSTER_BACKGROUND_POOL.length)] || "";
}

function stableBackgroundIndex(value, length) {
  if (!length) return 0;
  let hash = 0;
  for (const char of String(value || "gpl")) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function rosterTeamSheetRows(pokemonRows) {
  const pattern = [2, 3, 3, 3];
  const rows = [];
  let index = 0;
  for (const count of pattern) {
    if (index >= pokemonRows.length) break;
    const take = Math.min(count, pokemonRows.length - index);
    rows.push(
      pokemonRows.slice(index, index + take).map((pokemon, offset) => ({
        pokemon,
        rank: rosterDisplaySlot(pokemon, index + offset + 1),
      })),
    );
    index += take;
  }
  while (index < pokemonRows.length) {
    const remaining = pokemonRows.length - index;
    const take = remaining === 4 ? 2 : Math.min(3, remaining);
    rows.push(
      pokemonRows.slice(index, index + take).map((pokemon, offset) => ({
        pokemon,
        rank: rosterDisplaySlot(pokemon, index + offset + 1),
      })),
    );
    index += take;
  }
  return rows;
}

function rosterDisplaySlot(row, fallbackRank) {
  return String(row?.slot ?? "").trim() || fallbackRank;
}

function rosterTeamSheetTile(row, rank) {
  return `
    <article class="roster-teamsheet-tile" title="${escapeAttr(pokemonScoreFormula(row))}">
      <span class="roster-teamsheet-rank">#${escapeHtml(rank)}</span>
      ${pokemonSprite(row.pokemon)}
      <h4>${pokemonLink(row.pokemon_key || normalizedKey(row.pokemon), row.pokemon)}</h4>
    </article>
  `;
}

function rosterVariantControls(row, className = "roster-variant-inline") {
  const options = row.roster_variant_options ?? [];
  if (options.length <= 1) {
    return "";
  }
  return `
    <div class="${escapeAttr(className)}" aria-label="${escapeAttr(t(state.language, "columns.variants"))}">
      ${options
        .map((option) => {
          const active = option.key === row.roster_variant_key;
          return `<button class="roster-variant-button${active ? " is-active" : ""}" type="button" data-roster-group-key="${escapeAttr(row.roster_group_key)}" data-roster-variant-key="${escapeAttr(option.key)}">${escapeHtml(rosterVariantLabel(option))}</button>`;
        })
        .join("")}
    </div>
  `;
}

function rosterVariantLabel(row) {
  const divisionKey = normalizedKey(row.division);
  const phaseKey = normalizedKey(row.roster_phase);
  const phase = rosterPhaseDisplay(row.roster_phase);
  if (phaseKey === "regular" && divisionKey === "regular season") {
    return state.language === "en" ? "Group stage" : "Gruppenphase";
  }
  if (phase && phaseKey !== divisionKey) {
    return phase;
  }
  return divisionDisplay(row.division) || phase;
}

function rosterOverviewDivisionDisplay(row) {
  if (Number(row.variant_count || 1) <= 1 && normalizedKey(row.division) === "regular season") {
    return "";
  }
  return divisionDisplay(row.division);
}

function rosterHeaderMeta(row) {
  const values = [seasonDisplay(row.season_id)];
  const singleVariant = Number(row.variant_count || 1) <= 1;
  const detail = singleVariant ? rosterSingleVariantLabel(row) : "";
  if (detail) values.push(detail);
  if (row.team) values.push(row.team);
  return values;
}

function rosterSingleVariantLabel(row) {
  const divisionKey = normalizedKey(row.division);
  if (!divisionKey || divisionKey === "regular season") return "";
  return divisionDisplay(row.division);
}

function rosterPhaseDisplay(value) {
  const key = normalizedKey(value).replaceAll(" ", "_");
  const labels = {
    de: {
      hinrunde: "Hinrunde",
      rueckrunde: "Rückrunde",
      regular: "Regulär",
      playoffs: "Playoffs",
      season: "Saison",
      season_with_rueckrunde: "Saison inkl. Rückrunde",
    },
    en: {
      hinrunde: "First half",
      rueckrunde: "Second half",
      regular: "Regular",
      playoffs: "Playoffs",
      season: "Season",
      season_with_rueckrunde: "Season incl. second half",
    },
  };
  return labels[state.language]?.[key] || labels.de[key] || String(value || "");
}

function defaultRosterCardLimit() {
  return state.season === "all" ? 24 : 48;
}

function resetRosterCardLimit() {
  state.rosterCardLimit = defaultRosterCardLimit();
}

function scoreFormulaCell(value, formula) {
  return `<span class="score-formula" title="${escapeAttr(formula)}">${escapeHtml(String(value))}</span>`;
}

function rosterScoreFormula(row) {
  const resultWeight = numberValue(row.result_weight);
  const pokemonWeight = resultWeight ? Math.max(0, 1 - resultWeight) : 1;
  const performanceMix =
    resultWeight && row.result_score !== ""
      ? state.language === "en"
        ? `Performance ${row.performance_score} = Pokémon performance ${row.pokemon_performance_score} * ${formatFormulaPercent(pokemonWeight)} + table result ${row.result_score} * ${formatFormulaPercent(resultWeight)}.`
        : `Performance ${row.performance_score} = Pokémon-Leistung ${row.pokemon_performance_score} * ${formatFormulaPercent(pokemonWeight)} + Tabellenleistung ${row.result_score} * ${formatFormulaPercent(resultWeight)}.`
      : state.language === "en"
        ? `Performance ${row.performance_score} comes from Pokémon rows only because no matching table result is available.`
        : `Performance ${row.performance_score} kommt nur aus den Pokémon-Zeilen, weil keine passende Tabellenleistung verfügbar ist.`;
  if (state.language === "en") {
    return [
      "Roster score = 40% Performance + 15% Balance + 10% History + 5% Confidence.",
      Number(row.variant_count || 1) > 1
        ? "With multiple roster variants, the score is recomputed from the merged team; buttons only switch the visible variant."
        : "",
      performanceMix,
      `Parts: Performance ${row.performance_score}, Balance ${row.balance_score}, History ${row.history_score}, Confidence ${row.confidence_score}.`,
      `Shown: Score ${row.roster_score}, Pokémon ${row.pokemon_count}, avg tier rank ${row.avg_tier_rank || "n/a"}.`,
      "Balance uses roster size up to 11, top-11 depth, bench quality, and top-heavy concentration. Lower tiers are not rewarded. Missing death data is estimated and lowers Confidence.",
    ].filter(Boolean).join(" ");
  }
  return [
    "Kaderscore = 40% Performance + 15% Balance + 10% Historie + 5% Confidence.",
    Number(row.variant_count || 1) > 1
      ? "Bei mehreren Kader-Varianten wird der Score aus dem zusammengeführten Team neu berechnet; die Buttons wechseln nur die sichtbare Variante."
      : "",
    performanceMix,
    `Teilwerte: Performance ${row.performance_score}, Balance ${row.balance_score}, Historie ${row.history_score}, Confidence ${row.confidence_score}.`,
    `Angezeigt: Score ${row.roster_score}, Pokémon ${row.pokemon_count}, Ø Tier-Rang ${row.avg_tier_rank || "n/a"}.`,
    "Balance nutzt Kadergröße bis 11, Top-11-Tiefe, Bankqualität und Top-Heavy-Konzentration. Lower-Tiers werden nicht belohnt. Fehlende Todesdaten werden geschätzt und senken Confidence.",
  ].filter(Boolean).join(" ");
}

function pokemonScoreFormula(row) {
  const appearances = numberValue(row.appearances);
  const kills = numberValue(row.kills);
  const deathsNote = row.deaths_estimated
    ? `Tode geschätzt über erwartete Todesrate ${row.expected_death_rate}.`
    : "Tode aus Quelle übernommen.";
  const performanceNote = appearances
    ? "Performance vergleicht Kills/Einsätze und Differential/Einsätze mit erwarteten Raten und dämpft kleine Samples."
    : kills
      ? "Performance nutzt hier kills-only: 50 + min(Kills, 30) / 30 * 25, weil Einsätze fehlen."
      : "Performance nutzt den Fallback 45, weil Einsätze und Kills fehlen.";
  return [
    "Pokémon-Score = 45% Performance + 12% Historie + 8% Confidence.",
    `Teilwerte: Performance ${row.performance_score}, Historie ${row.history_score}, Confidence ${row.confidence_score}.`,
    performanceNote,
    `${deathsNote} Werte: Einsätze ${appearances}, Kills ${row.kills}, Tode ${row.deaths}, Differential ${row.differential}.`,
  ].filter(Boolean).join(" ");
}

function formatFormulaPercent(value) {
  return `${Math.round(numberValue(value) * 100)}%`;
}

function topPokemonLinks(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => pokemonCell(name, normalizedKey(name)))
    .join(" ");
}

function renderPokemonDetail() {
  const focus = state.pokemonFocus;
  const titles = pokemonTitleIndex(state.data.pokemonDraftOverview ?? [], normalizedKey);
  renderPokemonFocus();
  const summaryTarget = document.querySelector("#pokemon-detail-summary");
  const detailTables = ["#pokemon-trainer-table", "#pokemon-timeline-table", "#pokemon-season-table"];
  const focusedSections = ["#pokemon-trainer-section", "#pokemon-timeline-section", "#pokemon-season-section"];
  setDetailSections(focusedSections, Boolean(focus));

  if (!focus) {
    summaryTarget.innerHTML = "";
    detailTables.forEach((selector) => {
      destroyTable(selector);
      document.querySelector(selector).innerHTML = "";
    });
    return;
  }

  const pokemonDetailRows = combinedDetailRows();
  const detail = summarizePokemonDetail(
    pokemonDetailRows,
    focus.key,
    normalizedKey,
    state.data.teams ?? [],
  );
  const story = pokemonStorySummary(pokemonDetailRows, focus.key, normalizedKey, titles);
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

  renderTable(
    "#pokemon-trainer-table",
    detail.trainerRows.map((row) => {
      const trainerName = personDisplayName(row.trainer);
      return {
        trainer: personLink(personIdForName(trainerName), trainerName),
        appearances: performanceDisplay(row, "appearances"),
        kills: performanceDisplay(row, "kills"),
        deaths: performanceDisplay(row, "deaths"),
        differential: performanceDisplay(row, "differential"),
        seasons: row.seasons,
        season_list: row.season_list,
        teams: row.teams,
        status: draftDetailStatus(row),
      };
    }),
    ["trainer", "appearances", "kills", "deaths", "differential", "seasons", "season_list", "teams", "status"],
    ["trainer"],
  );
  renderTable(
    "#pokemon-timeline-table",
    pokemonTimelineRows(pokemonDetailRows, focus.key, normalizedKey).map((row) => ({
      season: seasonLink(row.season_id),
      divisions: row.divisions,
      appearances: performanceDisplay(row, "appearances"),
      kills: performanceDisplay(row, "kills"),
      deaths: performanceDisplay(row, "deaths"),
      differential: performanceDisplay(row, "differential"),
      trainers: row.trainers,
      teams: row.teams,
      status: draftDetailStatus(row),
    })),
    ["season", "divisions", "appearances", "kills", "deaths", "differential", "trainers", "teams", "status"],
    ["season"],
  );
  renderTable(
    "#pokemon-season-table",
    detail.seasonRows.map((row) => ({
      season: seasonLink(row.season_id),
      division: divisionDisplay(row.division),
      trainer: row.trainer ? personLink(personIdForName(personDisplayName(row.trainer)), personDisplayName(row.trainer)) : "",
      team: rosterLinkForContext(row, row.team_name),
      appearances: performanceDisplay(row, "appearances"),
      kills: performanceDisplay(row, "kills"),
      deaths: performanceDisplay(row, "deaths"),
      differential: performanceDisplay(row, "differential"),
      status: draftDetailStatus(row),
      source: sourceLinks(row.source_urls),
    })),
    ["season", "division", "trainer", "team", "appearances", "kills", "deaths", "differential", "status", "source"],
    ["season", "trainer", "team", "source"],
  );
}

function setDetailSections(selectors, visible) {
  selectors.forEach((selector) => {
    const section = document.querySelector(selector);
    if (section) {
      section.hidden = !visible;
    }
  });
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
    season: seasonLink(row.season_id),
    division: divisionDisplay(row.division, row.stage),
    rank: row.rank,
    person: row.player_name ? personLink(personIdForName(row.player_name), row.player_name) : "",
    team: rosterLinkForContext(row, row.team_name),
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
  renderTable("#table-history-table", rows, TABLE_HISTORY_COLUMNS, ["season", "person", "team", "source"]);
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
      season: seasonLink(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      stage: stageDisplay(row.stage),
      week: row.week,
      player_a: rosterParticipantLink(row, "a"),
      player_b: rosterParticipantLink(row, "b"),
      score: row.score_a || row.score_b ? `${row.score_a || "?"} - ${row.score_b || "?"}` : "",
      winner: row.winner,
      videos: videoLinksForMatch(row.match_id),
      source: sourceLink(row.source_urls),
    }));

  renderTable("#match-plan-table", rows, ["season", "division", "stage", "week", "player_a", "player_b", "score", "winner", "videos", "source"], ["season", "player_a", "player_b", "videos", "source"]);
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

function renderBracketOverview() {
  const target = document.querySelector("#bracket-overview");
  if (!target) return;
  if (state.season === "all") {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.chooseSeason"))}</p>`;
    return;
  }

  const rows = filtered(state.data.matches ?? [])
    .filter((row) => !["source_video_only", "not_available"].includes(row.data_status))
    .filter((row) => row.player_a || row.player_b || row.team_a || row.team_b || row.winner)
    .sort(compareMatches);
  const playoffRows = rows.filter(isPlayoffMatch);
  const groupRows = rows.filter((row) => !isPlayoffMatch(row));

  if (!rows.length) {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    return;
  }

  target.innerHTML = `
    ${playoffRows.length ? renderPlayoffBracket(playoffRows) : renderBracketNotice(t(state.language, "bracket.noPlayoffs"))}
    ${groupRows.length ? renderGroupPhase(groupRows) : renderBracketNotice(t(state.language, "bracket.noGroupMatches"))}
  `;
}

function renderPlayoffBracket(rows) {
  const rounds = groupRows(rows, playoffRoundLabel);
  const roundEntries = [...rounds.entries()].sort((a, b) => playoffRoundOrder(a[0]) - playoffRoundOrder(b[0]) || a[0].localeCompare(b[0]));
  return `
    <section class="bracket-section">
      <div class="bracket-section-head">
        <h3>${escapeHtml(t(state.language, "bracket.playoffsTitle"))}</h3>
        <span>${escapeHtml(String(rows.length))}</span>
      </div>
      <div class="bracket-rounds">
        ${roundEntries
          .map(
            ([round, matches]) => `
              <article class="bracket-round">
                <h4>${escapeHtml(round)}</h4>
                <div class="bracket-match-list">
                  ${matches.map((row) => bracketMatchCard(row)).join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderGroupPhase(rows) {
  const divisions = groupRows(rows, (row) => divisionDisplay(row.division, row.stage) || t(state.language, "divisions.regularSeason"));
  return `
    <section class="bracket-section">
      <div class="bracket-section-head">
        <h3>${escapeHtml(t(state.language, "bracket.groupsTitle"))}</h3>
        <span>${escapeHtml(String(rows.length))}</span>
      </div>
      <div class="group-phase-grid">
        ${[...divisions.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([division, divisionRows]) => renderGroupDivision(division, divisionRows))
          .join("")}
      </div>
    </section>
  `;
}

function renderGroupDivision(division, rows) {
  const weeks = groupRows(rows, (row) => row.week || t(state.language, "values.unknown"));
  const weekEntries = [...weeks.entries()].sort((a, b) => weekOrder(a[1][0]) - weekOrder(b[1][0]) || a[0].localeCompare(b[0]));
  return `
    <article class="group-panel">
      <h4>${escapeHtml(division)}</h4>
      <div class="group-week-list">
        ${weekEntries
          .map(
            ([week, matches]) => `
              <section class="group-week">
                <h5>${escapeHtml(week)}</h5>
                ${matches.map((row) => bracketMatchCard(row, { compact: true })).join("")}
              </section>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function bracketMatchCard(row, options = {}) {
  const playerB = row.player_b || row.team_b || "";
  const winner = row.winner || "";
  const links = bracketLinks(row);
  return `
    <article class="bracket-match ${options.compact ? "is-compact" : ""}">
      ${options.compact ? "" : `<div class="bracket-match-kicker">${escapeHtml(row.week || stageDisplay(row.stage) || "")}</div>`}
      ${bracketParticipant(row, "a", row.score_a, winner)}
      ${playerB ? bracketParticipant(row, "b", row.score_b, winner) : `<div class="bracket-participant is-empty">${escapeHtml(t(state.language, "values.unknown"))}</div>`}
      ${links ? `<div class="bracket-links">${links}</div>` : ""}
    </article>
  `;
}

function bracketParticipant(row, side, score, winner) {
  const name = row[`player_${side}`] || row[`team_${side}`] || "";
  const isWinner = name && winner && normalizedKey(name) === normalizedKey(winner);
  const label = name ? rosterParticipantLink(row, side) : escapeHtml(t(state.language, "values.unknown"));
  return `
    <div class="bracket-participant ${isWinner ? "is-winner" : ""}">
      <span>${label}</span>
      <strong>${escapeHtml(score || "")}</strong>
    </div>
  `;
}

function bracketLinks(row) {
  return [videoLinksForMatch(row.match_id, { compact: true }), sourceLink(row.source_urls)]
    .filter(Boolean)
    .map((link) => `<span>${link}</span>`)
    .join("");
}

function renderBracketNotice(message) {
  return `<section class="bracket-section is-muted"><p>${escapeHtml(message)}</p></section>`;
}

function isPlayoffMatch(row) {
  const text = `${row.stage || ""} ${row.division || ""} ${row.week || ""}`.toLowerCase();
  return text.includes("playoff") || text.includes("viertel") || text.includes("halbfinal") || text.includes("finale") || text.includes("final");
}

function playoffRoundLabel(row) {
  const text = String(row.week || "").toLowerCase();
  if (text.includes("vorrunde")) return t(state.language, "bracket.rounds.opening");
  if (text.includes("viertel")) return t(state.language, "bracket.rounds.quarter");
  if (text.includes("halb")) return t(state.language, "bracket.rounds.semi");
  if (text.includes("platz 3")) return t(state.language, "bracket.rounds.thirdPlace");
  if (text.includes("final")) return t(state.language, "bracket.rounds.final");
  return row.week || stageDisplay(row.stage) || t(state.language, "bracket.playoffsTitle");
}

function playoffRoundOrder(round) {
  const order = new Map([
    [t(state.language, "bracket.rounds.opening"), 10],
    [t(state.language, "bracket.rounds.quarter"), 20],
    [t(state.language, "bracket.rounds.semi"), 30],
    [t(state.language, "bracket.rounds.thirdPlace"), 40],
    [t(state.language, "bracket.rounds.final"), 50],
  ]);
  return order.get(round) ?? 90;
}

function groupRows(rows, keyFn) {
  return rows.reduce((groups, row) => {
    const key = keyFn(row) || t(state.language, "values.unknown");
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
    return groups;
  }, new Map());
}

function renderVideoArchive() {
  const rows = filteredVideoRows(state.data.videos ?? [])
    .sort(compareVideoRows)
    .map((row) => ({
      _season_order: seasonOrder(row.detected_season_id),
      _week_order: weekNumber(row.detected_week),
      season: seasonDisplay(row.detected_season_id),
      division: divisionDisplay(row.division, row.detected_stage),
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
    ["season", "division", "video_type", "stage", "detected_week", "perspective_person", "opponent", "title", "channel", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "match_id", "published_at"],
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
    const divisionOk = divisionMatches(row, state.division);
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
      review_key: row.review_key,
      queue: row.queue,
      severity: severityDisplay(row.severity),
      season: row.season_id ? seasonLink(row.season_id) : "",
      subject: row.subject,
      detail: row.detail,
      review_reason: reviewReasonDisplay(row.review_reason),
      confidence: row.confidence,
      confidence_tier: confidenceTierDisplay(row.confidence_tier),
      correction_file: row.correction_file,
      correction_target: row.correction_target,
      suggested_action: row.suggested_action,
      source: sourceLinks(row.source_urls),
    }));
  renderTable(
    "#review-workflow-table",
    rows,
    ["review_key", "queue", "severity", "season", "subject", "detail", "review_reason", "confidence", "confidence_tier", "correction_file", "correction_target", "suggested_action", "source"],
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
  const storyline = (state.data.seasonStorylines ?? []).find((row) => row.season_id === state.season);
  summary.innerHTML = coverage || storyline
    ? [
        metricCard(t(state.language, "summary.coverage"), coverage ? coverageStatusDisplay(coverage.coverage_status) : storyline.quality_score),
        metricCard(t(state.language, "summary.battles"), coverage?.matches ?? storyline.match_rows),
        metricCard(t(state.language, "summary.killlists"), coverage?.killlists ?? storyline.killlist_rows),
        metricCard(t(state.language, "summary.videos"), coverage?.videos ?? storyline.video_rows),
        storyline?.top_pokemon ? metricCard(t(state.language, "columns.top_pokemon"), storyline.top_pokemon) : "",
      ].join("")
    : "";

  const standings = filtered(state.data.standings ?? [])
    .map((row) => ({
      division: divisionDisplay(row.division, row.stage),
      rank: row.rank,
      person: row.player_name ? personLink(personIdForName(row.player_name), row.player_name) : "",
      team: rosterLinkForContext(row, row.team_name),
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
  renderTable("#season-detail-standings", standings, SEASON_STANDINGS_COLUMNS, ["person", "team", "source"]);

  const champions = filtered(state.data.champions ?? [])
    .map((row) => ({
      champion: row.champion_name ? personLink(personIdForName(row.champion_name), row.champion_name) : "",
      team: rosterLinkForContext(
        { season_id: row.season_id, division: championRosterDivision(row), team_name: row.champion_team, player_name: row.champion_name },
        row.champion_team,
      ),
      evidence: row.evidence_type,
      status: statusDisplay(row.data_status),
      notes: row.notes,
      source: sourceLinks(row.source_urls),
    }));
  renderTable("#season-detail-champions", champions, ["champion", "team", "evidence", "status", "notes", "source"], ["champion", "team", "source"]);

  const killlists = personDetailKilllistRows(filtered(state.data.killlists ?? []), state.division).map((row) => ({
    division: divisionDisplay(row.division, row.stage),
    pokemon: pokemonCell(row.pokemon, row.pokemon_normalized || normalizedKey(row.pokemon)),
    trainer: row.trainer ? personLink(personIdForName(row.trainer), row.trainer) : "",
    team: rosterLinkForContext(row, row.team_name),
    appearances: row.appearances,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    status: statusDisplay(row.data_status),
    source: sourceLinks(row.source_urls),
  }));
  renderTable("#season-detail-killlists", killlists, ["division", "pokemon", "trainer", "team", "appearances", "kills", "deaths", "differential", "status", "source"], ["pokemon", "trainer", "team", "source"]);

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

function championRosterDivision(row) {
  const evidence = normalizedKey(row.evidence_type);
  if (evidence.includes("playoff")) return "Playoffs";
  if (["season_005", "season_008"].includes(row.season_id)) return "Liga 1";
  if (row.season_id === "season_009") return "Overall Tag Team";
  return "Hauptrunde";
}

function videoLinksForMatch(matchId, options = {}) {
  const rows = (state.data.matchVideos ?? []).filter((row) => row.match_id === matchId);
  if (!rows.length) {
    return "";
  }
  return rows
    .map((row, index) => {
      const label = options.compact && rows.length > 1 ? `${t(state.language, "values.video")} ${index + 1}` : row.perspective_person || row.channel_title || row.video_title || t(state.language, "values.video");
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
  const match = String(seasonId ?? "").match(/(\d+)/);
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
  const focusedSections = [
    "#person-timeline-section",
    "#person-season-section",
    "#person-pokemon-section",
    "#person-video-section",
    "#person-matchup-section",
    "#person-missing-section",
  ];
  const allStatRows = filteredPersonStats();
  const allChampions = filtered(state.data.champions ?? []).filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status));
  const statRows = allStatRows.filter((row) => !focusKey || rowPersonKey(row) === focusKey);
  const champions = allChampions.filter((row) => !focusKey || championPersonKey(row) === focusKey);

  renderPersonFocus();
  setDetailSections(focusedSections, Boolean(focusKey));

  const detailRows = statRows
    .sort((a, b) => (a.person_name || a.player_name || "").localeCompare(b.person_name || b.player_name || "") || a.season_id.localeCompare(b.season_id))
    .map((row) => {
      return {
        person: row.person_name || row.player_name,
        season: seasonLink(row.season_id),
        division: divisionDisplay(row.division, row.stage),
        team: rosterLinkForContext(row, row.team_name),
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
  const personDetailRows = combinedDetailRows();
  const timelineRows = statRows
    .sort((a, b) => seasonOrder(a.season_id) - seasonOrder(b.season_id) || divisionPriority(a.division) - divisionPriority(b.division))
    .map((row) => ({
      season: seasonDisplay(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      team: rosterLinkForContext(row, row.team_name),
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
    personDetailRows,
    focusKey,
    normalizedKey,
    state.data.teams ?? [],
  ).map((row) => ({
    trainer: personDisplayName(row.trainer),
    pokemon: pokemonCell(row.pokemon),
    appearances: performanceDisplay(row, "appearances"),
    kills: performanceDisplay(row, "kills"),
    deaths: performanceDisplay(row, "deaths"),
    differential: performanceDisplay(row, "differential"),
    seasons: row.seasons,
    season_list: row.season_list,
    divisions: row.divisions,
    teams: row.teams,
    status: draftDetailStatus(row),
    source: sourceLink(row.source_urls),
  }));
  const storyPokemonRows = personPokemonHighlights(
    personDetailRows,
    focusKey,
    normalizedKey,
    state.data.teams ?? [],
  );
  const story = focusKey ? personStorySummary(statRows, champions, storyPokemonRows, focusKey, normalizedKey) : null;
  const allTimeSummary = focusKey ? personDetailAllTimeSummary(focusKey, allStatRows, allChampions) : null;
  const storyTarget = document.querySelector("#person-story-summary");
  storyTarget.innerHTML = story ? personSummaryCards(story, allTimeSummary).join("") : "";
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
  const matchupPrimary = matchupSelectKey(focusKey);
  const matchupRows = focusKey
    ? matchupOverview(
        availableMatchRows(),
        focusKey.replace(/^person_/, "").replaceAll("_", " "),
        normalizedKey,
      ).map((row) => ({
        ...row,
        opponent: matchupSelectButton(row.opponent_key, row.opponent, "b", matchupPrimary),
      }))
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

  renderTable("#person-timeline-table", timelineRows, ["season", "division", "team", "record", "win_pct", "rating", "points", "kills", "deaths", "differential", "title", "source"], ["season", "team", "source"]);
  renderTable("#person-season-table", detailRows, PERSON_SEASON_COLUMNS, ["season", "team", "source"]);
  renderTable("#person-pokemon-table", pokemonRows, ["trainer", "pokemon", "appearances", "kills", "deaths", "differential", "seasons", "season_list", "divisions", "teams", "status", "source"], ["pokemon", "source"]);
  renderTable("#person-video-table", personVideos, ["season", "video_type", "detected_week", "opponent", "title", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "published_at"], ["title"]);
  renderTable("#person-matchup-table", matchupRows, MATCHUP_COLUMNS, ["opponent"]);
  renderTable("#person-missing-table", missingKilllistRows, ["season", "division", "trainer", "team", "status", "source"], ["source"]);
}

function personSummaryCards(story, allTime) {
  const notAvailable = t(state.language, "summary.notAvailable");
  const value = (item) => (item === null || item === undefined || item === "" ? notAvailable : item);
  const record = allTime ? personRecordDisplay(allTime) : "";
  const recordAndWinPct = [record, percentDisplay(allTime?.win_pct)].filter(Boolean).join(" · ");
  return [
    metricCard(t(state.language, "columns.rank"), value(allTime?.rank)),
    metricCard(t(state.language, "columns.seasons_won"), value(allTime?.seasons_won)),
    metricCard(t(state.language, "columns.title_seasons"), value(allTime?.title_seasons || story.title_seasons)),
    metricCard(t(state.language, "columns.rating"), value(allTime?.rating)),
    metricCard(t(state.language, "columns.elo"), value(allTime?.elo)),
    metricCard(t(state.language, "columns.seasons"), value(allTime?.seasons || story.seasons)),
    metricCard(t(state.language, "columns.season_list"), value(allTime?.season_list || story.season_list)),
    metricCard(t(state.language, "columns.matches"), value(allTime?.matches)),
    metricCard(`${t(state.language, "columns.record")} / ${t(state.language, "columns.win_pct")}`, value(recordAndWinPct)),
    metricCard(t(state.language, "columns.points"), value(displayNumber(allTime?.points))),
    metricCard(t(state.language, "columns.kills"), value(displayNumber(allTime?.kills))),
    metricCard(t(state.language, "columns.deaths"), value(displayNumber(allTime?.deaths))),
    metricCard(t(state.language, "columns.differential"), value(displayNumber(allTime?.differential))),
    metricCard(t(state.language, "columns.best_rank"), value(allTime?.best_rank)),
    metricCard(t(state.language, "columns.best_season"), value(story.best_season)),
    metricCard(t(state.language, "columns.signature_pokemon"), value(story.signature_pokemon)),
  ];
}

function personDetailAllTimeSummary(focusKey, statRows, championRows) {
  const csvSummary = personDetailCsvSummary(focusKey);
  if (csvSummary && state.dataMode === "all" && state.season === "all" && state.division === "all") {
    return csvSummary;
  }
  const comparableFocus = personComparableKey(focusKey);
  const aggregateRows = aggregatePersonStats(statRows, championRows);
  const eloIndex = new Map(eloRatings(availableMatchRows(), normalizedKey).map((row) => [personComparableKey(row.key), row]));
  const index = aggregateRows.findIndex((row) => personComparableKey(row.key) === comparableFocus);
  if (index < 0) return csvSummary;
  const row = aggregateRows[index];
  return {
    ...row,
    rank: index + 1,
    elo: eloIndex.get(comparableFocus)?.elo || csvSummary?.elo || "",
  };
}

function personDetailCsvSummary(focusKey) {
  const comparableFocus = personComparableKey(focusKey);
  const rows = state.data.personAllTime ?? [];
  const index = rows.findIndex((row) => personComparableKey(row.person_id || row.person_name) === comparableFocus);
  if (index < 0) return null;
  const row = rows[index];
  return {
    rank: index + 1,
    key: row.person_id,
    name: row.person_name,
    seasons_won: row.seasons_won,
    title_seasons: shortSeasonList(row.title_seasons),
    seasons: row.seasons,
    season_list: shortSeasonList(row.season_list),
    matches: row.matches,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    win_pct: row.win_pct,
    rating: row.weighted_rating,
    points: row.points,
    kills: row.kills,
    deaths: row.deaths,
    differential: row.differential,
    best_rank: row.best_rank,
    elo: row.elo,
  };
}

function personRecordDisplay(row) {
  if (![row?.wins, row?.losses, row?.draws].some((value) => value !== null && value !== undefined && value !== "")) {
    return "";
  }
  return `${displayNumber(row.wins)}-${displayNumber(row.losses)}-${displayNumber(row.draws)}`;
}

function percentDisplay(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.endsWith("%") ? raw : `${raw}%`;
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
    const sourceRows = aggregateMatchupRows(a) ?? matchupOverview(availableMatches, a, normalizedKey);
    const overviewRows = sourceRows.map((row) => ({
      ...row,
      opponent: matchupSelectButton(row.opponent_key, row.opponent, "b", a),
    }));
    const overviewColumns = columnsForProfile(MATCHUP_COLUMNS, state.columnProfile);
    result.innerHTML = overviewRows.length
      ? `<div class="table-wrap">${tableHtml(overviewRows, overviewColumns, ["opponent"])}</div>`
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

  const matchRows = matches.slice(0, 25).map((row) => {
    const playerA = row.player_a || row.team_a;
    const playerB = row.player_b || row.team_b;
    return {
    season: seasonDisplay(row.season_id),
    division: divisionDisplay(row.division, row.stage),
    week: row.week,
    player_a: matchupSelectButton(playerA, playerA, "a"),
    player_b: matchupSelectButton(playerB, playerB, "b"),
    winner: row.winner,
    score: row.score_a || row.score_b ? `${row.score_a || "?"} - ${row.score_b || "?"}` : "",
    videos: videoLinksForMatch(row.match_id),
    source: sourceLink(row.video_url || row.source_urls, row.video_title || row.video_id || t(state.language, "values.source")),
    };
  });

  const matchColumns = columnsForProfile(["season", "division", "week", "player_a", "player_b", "score", "winner", "videos", "source"], state.columnProfile);
  result.innerHTML = `
    <div class="result-grid">
      <div class="metric"><span class="muted">${escapeHtml(t(state.language, "matchup.matches"))}</span><strong>${matches.length}</strong></div>
      <div class="metric"><span class="muted">${escapeHtml(t(state.language, "matchup.firstWins"))}</span><strong>${aWins}</strong></div>
      <div class="metric"><span class="muted">${escapeHtml(t(state.language, "matchup.secondWins"))}</span><strong>${bWins}</strong></div>
    </div>
    ${matches.length ? `<div class="table-wrap">${tableHtml(matchRows, matchColumns, ["player_a", "player_b", "videos", "source"])}</div>` : `<p class="empty">${escapeHtml(t(state.language, "matchup.empty"))}</p>`}
  `;
}

function aggregateMatchupRows(selectedKey) {
  const rows = state.data.matchupSummary ?? [];
  if (!rows.length || state.season !== "all" || state.division !== "all") {
    return null;
  }
  const comparable = matchupSelectKey(selectedKey);
  return rows
    .filter((row) => matchupSelectKey(row.person_id || row.person_name) === comparable || matchupSelectKey(row.person_name) === comparable)
    .filter((row) => !state.search || Object.values(row).join(" ").toLowerCase().includes(state.search))
    .map((row) => ({
      opponent_key: matchupSelectKey(row.opponent_id || row.opponent_name),
      opponent: row.opponent_name,
      matches: row.matches,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      win_pct: row.win_pct,
    }));
}

function matchupSelectButton(value, label = value, slot = "b", primary = "") {
  const key = matchupSelectKey(value);
  const text = String(label ?? "").trim();
  if (!key || !text) {
    return escapeHtml(text);
  }
  const primaryAttr = primary ? ` data-matchup-primary="${escapeAttr(matchupSelectKey(primary))}"` : "";
  return `<button type="button" class="link-button" data-matchup-select="${escapeAttr(key)}" data-matchup-slot="${escapeAttr(slot)}"${primaryAttr}>${escapeHtml(text)}</button>`;
}

function matchupSelectKey(value) {
  return normalizedKey(String(value ?? "").replace(/^person_/, "").replaceAll("_", " "));
}

function renderTable(selector, rows, columns, html = false, options = {}) {
  const target = document.querySelector(selector);
  destroyTable(selector);
  if (!rows.length) {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    return;
  }
  const extraActions = options.extraActions ?? [];
  const visibleColumns = columnsForProfile(columns, state.columnProfile);
  target.dataset.columnProfile = state.columnProfile;
  target.innerHTML = `
    <div class="table-actions">
      <button class="table-action" type="button" data-table-export>${escapeHtml(t(state.language, "actions.exportCsv"))}</button>
      ${extraActions.map((action, index) => `<button class="table-action" type="button" data-extra-action="${index}">${escapeHtml(action.label)}</button>`).join("")}
    </div>
    <div class="table-host"></div>
  `;
  const host = target.querySelector(".table-host");
  target.querySelector("[data-table-export]").addEventListener("click", () => {
    downloadRowsAsCsv(options.filename || filenameForSelector(selector), rows, visibleColumns);
  });
  target.querySelectorAll("[data-extra-action]").forEach((button) => {
    const action = extraActions[Number(button.dataset.extraAction)];
    button.addEventListener("click", () => action.onClick?.());
  });

  if (!window.Tabulator) {
    host.innerHTML = tableHtml(rows, visibleColumns, html);
    return;
  }

  const htmlColumns = new Set(html === true ? ["video"] : Array.isArray(html) ? html : []);
  const tabulatorColumns = buildTabulatorColumns(visibleColumns, htmlColumns, rows);
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
    initialSort: initialSort(visibleColumns),
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
  "slot",
  "roster_score",
  "pokemon_score",
  "performance_score",
  "balance_score",
  "history_score",
  "confidence_score",
  "pokemon_count",
  "avg_tier_rank",
]);

function minWidthFor(column) {
  if (["name", "person", "team", "pokemon", "trainer", "player_a", "player_b", "winner", "video", "videos", "source", "title", "channel", "perspective_person", "opponent", "video_type", "missing_data", "notes", "match_basis", "confidence_explanation", "record", "top_pokemon", "roster_flags"].includes(column)) {
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
    .replaceAll("Ã¤", "ae")
    .replaceAll("Ã¶", "oe")
    .replaceAll("Ã¼", "ue")
    .replaceAll("ÃŸ", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedKey(value) {
  const folded = String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("Ã¤", "ae")
    .replaceAll("Ã¶", "oe")
    .replaceAll("Ã¼", "ue")
    .replaceAll("ÃŸ", "ss")
    .replaceAll("ÃƒÂ¤", "ae")
    .replaceAll("ÃƒÂ¶", "oe")
    .replaceAll("ÃƒÂ¼", "ue")
    .replaceAll("ÃƒÅ¸", "ss")
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
