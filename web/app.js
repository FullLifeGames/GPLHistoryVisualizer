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
import { normalizeRosterGroupKey, rosterIdentityKey } from "./roster_keys.js";
import { defaultViewForGroup, viewGroupForView } from "./view_config.js";
import {
  ALL_TIME_COLUMNS,
  AWARD_COLUMNS,
  columnsForProfile,
  ELO_LEDGER_COLUMNS,
  MATCH_FINDER_COLUMNS,
  MATCH_HIGHLIGHT_COLUMNS,
  RECORD_HOLDER_COLUMNS,
  STREAK_COLUMNS,
  MATCHUP_COLUMNS,
  normalizeColumnProfile,
  PERSON_SEASON_COLUMNS,
  POKEMON_DRAFT_COLUMNS,
  POKEMON_KILLLIST_COLUMNS,
  SEASON_STANDINGS_COLUMNS,
  TABLE_HISTORY_COLUMNS,
  TEAM_ROSTER_COLUMNS,
  TEAM_ROSTER_POKEMON_COLUMNS,
  UPSET_COLUMNS,
  VIDEO_ARCHIVE_COLUMNS,
} from "./table_columns.js";
import { eloChronology, eloLedgerRows, personEloSeries, upsetRows } from "./elo_history.js";
import { buildSeries, lineChart, stepChart } from "./charts.js";
import { awardsBySeason, finderFilterRows, hofInductees, spoonRows, streakTableRows } from "./records.js";
import { tableHeaderFilterConfig } from "./table_filters.js";
import { textSorter, weekSortValue } from "./table_sort.js";
import {
  aggregatePersonStats,
  canonicalKilllistRows,
  canonicalPersonKey,
  personKeyIndex,
  cinemaAdjacentVideoKey,
  cinemaPerspectiveParticipantOptions,
  cinemaVideoRows,
  detailRowsWithDraftInstances,
  displayNumber,
  divisionMatches,
  eloRatings,
  filterSourceClaims,
  isAnalysisSourceVideo,
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
  rowMatchesSearch as statsRowMatchesSearch,
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
  textMatchesSearch as statsTextMatchesSearch,
  titleInfoWithinSeasonList,
  winPercentage,
  weightedRating,
} from "./stats.js";
import { renderZeitreise } from "./zeitreise.js";

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
  matchHighlights: { url: "../data/normalized/match_highlights.csv", optional: true },
  pokemonDraftOverview: { url: "../data/normalized/pokemon_draft_overview.csv", optional: true },
  pokemonDraftInstances: { url: "../data/normalized/pokemon_draft_instances.csv", optional: true },
  teamPokemonUsage: { url: "../data/manual/team_pokemon_usage.csv", optional: true },
  teamRosters: { url: "../data/normalized/team_rosters.csv", optional: true },
  rosterMatchdays: { url: "../data/normalized/roster_matchdays.csv", optional: true },
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
  streaks: { url: "../data/normalized/streaks.csv", optional: true },
  recordsProgression: { url: "../data/normalized/records_progression.csv", optional: true },
  awards: { url: "../data/normalized/awards.csv", optional: true },
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
  "match-highlights": ["matchHighlights", "matchVideos"],
  "cinema": ["matchHighlights", "matchVideos", "videos"],
  zeitreise: ["matchHighlights"],
  "team-rosters": ["pokemonDraftOverview", "teamPokemonUsage", "teamRosters", "rosterScores"],
  "roster-detail": ["pokemonDraftOverview", "teamPokemonUsage", "teamRosters", "rosterScores", "rosterMatchdays"],
  "video-archive": ["videos"],
  "upset-index": ["matchHighlights", "matchVideos"],
  "record-book": ["streaks", "recordsProgression", "matchVideos", "rosterMatchdays"],
  "awards": ["awards", "personAllTime"],
  "hall-of-fame": ["personAllTime", "matchVideos", "awards"],
  "person-details": ["personAllTime", "videos", "pokemonDraftOverview", "pokemonDraftInstances", "teamPokemonUsage", "teamRosters", "rosterScores", "awards"],
  "data-coverage": ["dataQuality", "reviewIndex"],
  "data-gaps": ["dataQuality", "reviewIndex", "missingKilllists", "missingKilllistAppearances", "lowConfidenceVideos", "ambiguousMatches", "teamPokemonUsage", "teamRosters", "pokemonDraftOverview", "rosterScores", "matchVideos", "videos"],
  "roster-gaps": ["teamPokemonUsage", "teamRosters", "pokemonDraftOverview", "rosterScores"],
  "appearance-gaps": ["missingKilllists", "missingKilllistAppearances"],
  "video-review": ["videos", "lowConfidenceVideos", "ambiguousMatches"],
  "match-video-coverage": ["matchVideos", "videos"],
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
const ALL_SEASON_DEFAULT_VIEWS = new Set(["match-highlights"]);
const DATA_MODE_DEFAULT_BY_VIEW = {
  "match-highlights": "all",
};

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
  matchHighlights: "Highlightkämpfe",
  pokemonDraftOverview: "Pokémon-Drafts",
  teamPokemonUsage: "Team-Pokémon-Zuordnungen",
  pokemonDraftInstances: "Pokémon-Draft-Instanzen",
  rosterMatchdays: "Kader-Spieltagdaten",
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
  streaks: "Serien",
  recordsProgression: "Rekordverlauf",
  awards: "Auszeichnungen",
};

const POKEMON_USAGE_HINT_COLUMNS = new Set(["appearances", "kills", "kill_rate"]);

function initialDataMode() {
  const route = parseRouteHash(window.location.hash);
  if (route.view === "all-time") {
    return "primary";
  }
  return normalizeDataMode(readPreference("gpl-data-mode", "primary"));
}

const state = {
  view: "all-time",
  season: "all",
  dataMode: initialDataMode(),
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
  matchHighlightCardLimit: 8,
  upsetCardLimit: 8,
  recordBookTab: "records",
  recordKey: null,
  streakType: "all",
  hofTab: "hall",
  cinema: {
    season: "all",
    participant: "all",
    perspective: "all",
    videoType: "all",
    stage: "all",
    order: "published",
    search: "",
    selectedKey: "",
  },
  rosterVariantSelection: {},
  autoSeasonDefault: false,
  autoDataModeDefault: null,
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
const cinemaSeasonFilter = document.querySelector("#cinema-season-filter");
const cinemaParticipantFilter = document.querySelector("#cinema-participant-filter");
const cinemaPerspectiveFilter = document.querySelector("#cinema-perspective-filter");
const cinemaTypeFilter = document.querySelector("#cinema-type-filter");
const cinemaStageFilter = document.querySelector("#cinema-stage-filter");
const cinemaOrderFilter = document.querySelector("#cinema-order-filter");
const cinemaSearchFilter = document.querySelector("#cinema-search-filter");
const cinemaRandomButton = document.querySelector("#cinema-random-button");
const tableInstances = new Map();
const tableCleanups = new Map();
let activeColumnHelpAnchor = null;
const LINKABLE_SEASON_COLUMNS = new Set(["season", "season_id", "season_list", "title_seasons", "best_season"]);
const LINKABLE_PERSON_COLUMNS = new Set(["name", "person", "trainer", "trainers", "player_a", "player_b", "winner", "opponent", "perspective_person", "peak_perspective", "champion"]);
const VIEW_RENDERERS = {
  "all-time": renderAllTime,
  matchup: renderMatchup,
  killlists: renderKilllists,
  "pokemon-drafts": renderPokemonDrafts,
  "pokemon-detail": renderPokemonDetail,
  "battle-history": renderBracketOverview,
  "match-highlights": renderMatchHighlights,
  "season-detail": renderSeasonDetail,
  "table-history": renderTableHistory,
  "match-plan": renderMatchPlan,
  "video-archive": renderVideoArchive,
  "upset-index": renderUpsetIndex,
  "record-book": renderRecordBook,
  "awards": renderAwards,
  "hall-of-fame": renderHallOfFame,
  cinema: renderCinema,
  zeitreise: renderZeitreiseView,
  "team-rosters": renderTeamRosters,
  "roster-detail": renderRosterDetail,
  "person-details": renderPersonDetails,
  "data-coverage": renderDataCoverage,
  "data-gaps": renderDataGaps,
  "roster-gaps": renderRosterGaps,
  "appearance-gaps": renderAppearanceGaps,
  "video-review": renderVideoReview,
  "match-video-coverage": renderMatchVideoCoverage,
  "review-workflow": renderReviewWorkflow,
  "source-claims": renderSourceClaims,
};

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
    populateCinemaControls();
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
    state.autoDataModeDefault = null;
    state.dataMode = dataModeFilter.value || "primary";
    state.dataMode = normalizeDataMode(state.dataMode);
    savePreference("gpl-data-mode", state.dataMode);
    state.division = "all";
    resetRosterCardLimit();
    resetMatchHighlightCardLimit();
    resetUpsetCardLimit();
    divisionFilter.value = state.division;
    populateDivisionFilter();
    populateMatchupOptions();
    populateCinemaControls();
    render();
  });

  columnProfileFilter.addEventListener("change", () => {
    state.columnProfile = normalizeColumnProfile(columnProfileFilter.value);
    columnProfileFilter.value = state.columnProfile;
    savePreference("gpl-column-profile", state.columnProfile);
    render();
  });

  languageToggle.addEventListener("click", () => {
    state.language = nextLanguage(state.language);
    savePreference("gpl-language", state.language);
    applyLanguage();
    populateSeasonFilter();
    populateDivisionFilter();
    dataModeFilter.value = state.dataMode;
    populateMatchupOptions();
    populateCinemaControls();
    render();
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
      // In-view tab buttons (record book, hall of fame) share the .tab look
      // but carry no data-view; only subnav tabs navigate.
      if (!button.dataset.view) return;
      navigateToView(button.dataset.view);
    });
  });

  seasonFilter.addEventListener("change", () => {
    state.season = seasonFilter.value;
    state.autoSeasonDefault = false;
    resetRosterCardLimit();
    resetMatchHighlightCardLimit();
    resetUpsetCardLimit();
    populateMatchupOptions();
    populateCinemaControls();
    render();
  });

  divisionFilter.addEventListener("change", () => {
    state.division = divisionFilter.value;
    resetRosterCardLimit();
    resetMatchHighlightCardLimit();
    resetUpsetCardLimit();
    populateMatchupOptions();
    populateCinemaControls();
    render();
  });

  searchFilter.addEventListener("input", () => {
    state.search = searchFilter.value.trim().toLowerCase();
    resetRosterCardLimit();
    resetMatchHighlightCardLimit();
    resetUpsetCardLimit();
    populateMatchupOptions();
    populateCinemaControls();
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

  bindCinemaControls();
  bindResponsiveFilterPanels();
  bindColumnHelpTooltips();

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
    if (event.target.closest("[data-show-more-match-highlights]")) {
      event.preventDefault();
      state.matchHighlightCardLimit += defaultMatchHighlightCardLimit();
      renderMatchHighlights();
    }
    if (event.target.closest("[data-show-more-upsets]")) {
      event.preventDefault();
      state.upsetCardLimit += DEFAULT_UPSET_CARD_LIMIT;
      renderUpsetIndex();
    }
    const recordTabButton = event.target.closest("[data-record-tab]");
    if (recordTabButton) {
      event.preventDefault();
      state.recordBookTab = recordTabButton.dataset.recordTab;
      renderRecordBook();
    }
    const recordKeyButton = event.target.closest("[data-record-key]");
    if (recordKeyButton) {
      event.preventDefault();
      state.recordKey = recordKeyButton.dataset.recordKey;
      renderRecordBook();
    }
    if (event.target.closest("[data-record-back]")) {
      event.preventDefault();
      state.recordKey = null;
      renderRecordBook();
    }
    const streakTypeButton = event.target.closest("[data-streak-type]");
    if (streakTypeButton) {
      event.preventDefault();
      state.streakType = streakTypeButton.dataset.streakType;
      renderRecordBook();
    }
    const hofTabButton = event.target.closest("[data-hof-tab]");
    if (hofTabButton) {
      event.preventDefault();
      state.hofTab = hofTabButton.dataset.hofTab;
      renderHallOfFame();
    }
    const cinemaStepButton = event.target.closest("[data-cinema-step]");
    if (cinemaStepButton) {
      event.preventDefault();
      stepCinemaVideo(Number(cinemaStepButton.dataset.cinemaStep || 0));
      return;
    }
    const cinemaCard = event.target.closest("[data-cinema-video-key]");
    if (cinemaCard) {
      event.preventDefault();
      state.cinema.selectedKey = cinemaCard.dataset.cinemaVideoKey || "";
      renderCinema();
      document.querySelector("#cinema-screen")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
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
  populateCinemaControls();
  await yieldBeforeViewRender();
  const loadedLazyDatasets = await ensureDatasetsForView(state.view);
  if (loadedLazyDatasets) {
    populateDivisionFilter();
    populateMatchupOptions();
    populateCinemaControls();
    statusEl.textContent = t(state.language, "status.loaded");
    statusEl.classList.add("is-ready");
  }
  render();
}

function yieldBeforeViewRender() {
  if (typeof requestAnimationFrame !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
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

function bindCinemaControls() {
  [
    [cinemaSeasonFilter, "season", "all"],
    [cinemaParticipantFilter, "participant", "all"],
    [cinemaPerspectiveFilter, "perspective", "all"],
    [cinemaTypeFilter, "videoType", "all"],
    [cinemaStageFilter, "stage", "all"],
    [cinemaOrderFilter, "order", "published"],
  ].forEach(([control, key, fallback]) => {
    control?.addEventListener("change", () => {
      state.cinema[key] = control.value || fallback;
      state.cinema.selectedKey = "";
      renderCinema();
    });
  });
  cinemaSearchFilter?.addEventListener("input", () => {
    state.cinema.search = cinemaSearchFilter.value.trim();
    state.cinema.selectedKey = "";
    renderCinema();
  });
  cinemaRandomButton?.addEventListener("click", () => {
    pickRandomCinemaVideo();
  });
}

function bindResponsiveFilterPanels() {
  const panels = [...document.querySelectorAll(".compact-filter-panel")];
  if (!panels.length || !window.matchMedia) return;
  const query = window.matchMedia("(max-width: 720px)");
  const apply = () => {
    panels.forEach((panel) => {
      if (panel.dataset.userToggled === "1") return;
      const shouldOpen = !query.matches;
      if (panel.open !== shouldOpen) {
        panel.dataset.autoToggled = "1";
        panel.open = shouldOpen;
      }
    });
  };
  panels.forEach((panel) => {
    panel.addEventListener("toggle", () => {
      if (panel.dataset.autoToggled === "1") {
        delete panel.dataset.autoToggled;
        return;
      }
      panel.dataset.userToggled = "1";
    });
  });
  query.addEventListener?.("change", apply);
  apply();
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
  applyViewDefaults(route, previousView);
}

function applyViewDefaults(route, previousView) {
  const previousGroup = viewGroupForView(previousView);
  const currentGroup = viewGroupForView(route.view);
  applyViewDataModeDefaults(route.view, previousView);
  if (previousGroup === "seasons" && currentGroup !== "seasons" && state.autoSeasonDefault) {
    state.season = "all";
    state.autoSeasonDefault = false;
  }
  if (currentGroup === "seasons" && !route.seasonId && ALL_SEASON_DEFAULT_VIEWS.has(route.view)) {
    if (state.autoSeasonDefault) {
      state.season = "all";
    }
    state.autoSeasonDefault = false;
  } else if (currentGroup === "seasons" && !route.seasonId && state.season === "all") {
    state.season = "season_010";
    state.autoSeasonDefault = true;
  }
  seasonFilter.value = state.season;
}

function applyViewDataModeDefaults(viewName, previousView) {
  const defaultMode = DATA_MODE_DEFAULT_BY_VIEW[viewName];
  if (!defaultMode && state.autoDataModeDefault) {
    state.dataMode = state.autoDataModeDefault;
    state.autoDataModeDefault = null;
  } else if (defaultMode && state.dataMode !== defaultMode) {
    if (!DATA_MODE_DEFAULT_BY_VIEW[previousView] && !state.autoDataModeDefault) {
      state.autoDataModeDefault = state.dataMode;
    }
    state.dataMode = defaultMode;
  }
  dataModeFilter.value = state.dataMode;
}

function setActiveView(viewName) {
  state.view = viewName;
  document.querySelector(".toolbar")?.classList.toggle("is-cinema-hidden", viewName === "cinema" || viewName === "zeitreise");
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
  document.querySelectorAll("[data-i18n-title]").forEach((element) => {
    element.setAttribute("title", t(state.language, element.dataset.i18nTitle));
  });
  document.querySelectorAll("[data-i18n-tooltip]").forEach((element) => {
    element.dataset.tooltip = t(state.language, element.dataset.i18nTooltip);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(state.language, element.dataset.i18nAriaLabel));
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
  const response = await fetch(url, { cache: "no-store" });
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

function populateCinemaControls() {
  if (!cinemaSeasonFilter || !cinemaParticipantFilter || !cinemaPerspectiveFilter || !cinemaTypeFilter || !cinemaStageFilter || !cinemaOrderFilter) {
    return;
  }
  const rows = cinemaRows({ season: "all", participant: "all", perspective: "all", videoType: "all", stage: "all", search: "", order: "chronological" });
  const seasonOptions = [
    { value: "all", label: t(state.language, "filters.allSeasons") },
    ...(state.data.seasons ?? []).map((season) => ({ value: season.season_id, label: seasonDisplay(season.season_id) })),
  ];
  const participantOptions = [
    { value: "all", label: t(state.language, "cinema.allParticipants") },
    ...cinemaParticipantOptions(rows),
  ];
  const perspectiveOptions = [
    { value: "all", label: t(state.language, "cinema.allPerspectives") },
    ...cinemaPerspectiveOptions(rows),
  ];
  const typeOptions = [
    { value: "battle", label: t(state.language, "cinema.battleType") },
    { value: "all", label: t(state.language, "cinema.allTypes") },
    ...cinemaTypeOptions(rows),
  ];
  const stageOptions = [
    { value: "all", label: t(state.language, "cinema.allStages") },
    { value: "regular", label: t(state.language, "cinema.regularStage") },
    { value: "playoffs", label: t(state.language, "cinema.playoffStage") },
    { value: "other", label: t(state.language, "cinema.otherStage") },
  ];
  setSelectOptions(cinemaSeasonFilter, seasonOptions, state.cinema.season);
  if (cinemaSeasonFilter.value !== state.cinema.season) {
    state.cinema.season = cinemaSeasonFilter.value || "all";
  }
  setSelectOptions(cinemaParticipantFilter, participantOptions, state.cinema.participant);
  if (cinemaParticipantFilter.value !== state.cinema.participant) {
    state.cinema.participant = cinemaParticipantFilter.value || "all";
  }
  setSelectOptions(cinemaPerspectiveFilter, perspectiveOptions, state.cinema.perspective);
  if (cinemaPerspectiveFilter.value !== state.cinema.perspective) {
    state.cinema.perspective = cinemaPerspectiveFilter.value || "all";
  }
  setSelectOptions(cinemaTypeFilter, typeOptions, state.cinema.videoType);
  if (cinemaTypeFilter.value !== state.cinema.videoType) {
    state.cinema.videoType = cinemaTypeFilter.value || "all";
  }
  setSelectOptions(cinemaStageFilter, stageOptions, state.cinema.stage);
  if (cinemaStageFilter.value !== state.cinema.stage) {
    state.cinema.stage = cinemaStageFilter.value || "all";
  }
  cinemaOrderFilter.value = state.cinema.order;
  if (cinemaSearchFilter && cinemaSearchFilter.value !== state.cinema.search) {
    cinemaSearchFilter.value = state.cinema.search;
  }
}

function cinemaRows(overrides = {}) {
  return cinemaVideoRows(
    {
      seasons: state.data.seasons ?? [],
      matchHighlights: state.data.matchHighlights ?? [],
      matchVideos: state.data.matchVideos ?? [],
      videos: state.data.videos ?? [],
    },
    {
      season: state.cinema.season,
      participant: state.cinema.participant,
      perspective: state.cinema.perspective,
      videoType: state.cinema.videoType,
      stage: state.cinema.stage,
      order: state.cinema.order,
      search: state.cinema.search,
      normalizeKey: normalizedKey,
      ...overrides,
    },
  );
}

function cinemaParticipantOptions(rows) {
  const people = new Map();
  rows.forEach((row) => {
    [
      row.perspective_person,
      row.opponent,
      row.player_a,
      row.player_b,
      row.channel_title,
      row.source_person_names,
    ].forEach((value) => {
      String(value ?? "")
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((name) => {
          const key = normalizedKey(name);
          if (!key || key === "unknown") return;
          people.set(key, people.get(key) || name);
        });
    });
  });
  return [...people.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }));
}

function cinemaPerspectiveOptions(rows) {
  return cinemaPerspectiveParticipantOptions(rows, { normalizeKey: normalizedKey })
    .map((option) => ({ value: option.value, label: cinemaPerspectiveOptionLabel(option) }));
}

function cinemaPerspectiveOptionLabel(option) {
  if (!option.channelCount) return option.label;
  const key = option.channelCount === 1 ? "cinema.channelSingular" : "cinema.channelPlural";
  return `${option.label} (${option.channelCount} ${t(state.language, key)})`;
}

function cinemaTypeOptions(rows) {
  const types = new Set(rows.map((row) => row.video_type).filter(Boolean));
  return [...types]
    .sort((left, right) => videoTypePriority(left) - videoTypePriority(right) || videoTypeDisplay(left).localeCompare(videoTypeDisplay(right)))
    .map((type) => ({ value: type, label: videoTypeDisplay(type) || type }));
}

function setSelectOptions(select, options, selectedValue) {
  const previous = selectedValue || select.value;
  select.innerHTML = options
    .map((option) => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`)
    .join("");
  select.value = options.some((option) => option.value === previous) ? previous : options[0]?.value || "";
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
  renderCurrentView();
}

function renderCurrentView() {
  const renderView = VIEW_RENDERERS[state.view] || VIEW_RENDERERS["all-time"];
  renderView?.call(null);
}

function filtered(rows) {
  return rows.filter((row) => {
    const dataModeOk = applyDataMode(row);
    const seasonOk = state.season === "all" || row.season_id === state.season;
    const divisionOk = divisionMatches(row, state.division);
    const searchOk = rowMatchesSearch(row);
    return dataModeOk && seasonOk && divisionOk && searchOk;
  });
}

function textMatchesSearch(text, search = state.search) {
  return statsTextMatchesSearch(text, search);
}

function rowMatchesSearch(row, search = state.search) {
  return statsRowMatchesSearch(row, search);
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

function numericCellValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function killRateDisplay(row) {
  const appearances = numericCellValue(row?.appearances);
  const kills = numericCellValue(row?.kills);
  if (!appearances || kills === null) {
    return "";
  }
  return displayNumber(Number((kills / appearances).toFixed(2)));
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

function metricCard(label, value, hint = "") {
  const labelHtml = hint
    ? `<span class="summary-card-label column-header-with-help">${escapeHtml(label)} ${columnHelpHtml(hint)}</span>`
    : `<span>${escapeHtml(label)}</span>`;
  return `<article class="summary-card">${labelHtml}<strong>${escapeHtml(String(value))}</strong></article>`;
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

function killlistCoverageDisplay(value) {
  const text = String(value ?? "").trim();
  return text === "" ? "" : `${text} %`;
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

function youtubeVideoIdFromUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  const watchMatch = url.match(/[?&]v=([^&#]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([^?&#/]+)/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/(?:embed|shorts)\/([^?&#/]+)/);
  return embedMatch ? embedMatch[1] : "";
}

function youtubeThumbnailPreviews(value, limit = 2) {
  const videos = String(value ?? "")
    .split(";")
    .map((url) => ({ url: url.trim(), videoId: youtubeVideoIdFromUrl(url) }))
    .filter((item) => item.url.startsWith("http") && item.videoId)
    .slice(0, limit);
  if (!videos.length) return "";
  return `
    <div class="highlight-video-previews" aria-label="${escapeAttr(t(state.language, "highlightMatches.videoPreviewLabel"))}">
      ${videos
        .map(
          (item, index) => `
            <a class="highlight-video-preview" href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer" aria-label="${escapeAttr(`${t(state.language, "values.video")} ${index + 1}`)}">
              <img src="https://i.ytimg.com/vi/${escapeAttr(item.videoId)}/mqdefault.jpg" alt="" loading="lazy" />
              <span class="highlight-play" aria-hidden="true"></span>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function highlightPreviewUrls(row) {
  const videos = (state.data.matchVideos ?? [])
    .filter((video) => video.match_id === row.match_id)
    .filter((video) => !isAnalysisSourceVideo(video))
    .map((video) => video.video_url || sourceFirstUrl(video.source_urls))
    .filter(Boolean);
  if (!videos.length) {
    return row.video_urls;
  }
  return [...new Set(videos)].join(";");
}

function highlightVideoItems(value, limit = Number.POSITIVE_INFINITY) {
  return String(value ?? "")
    .split(";")
    .map((url) => ({ url: url.trim(), videoId: youtubeVideoIdFromUrl(url) }))
    .filter((item) => item.url.startsWith("http") && item.videoId)
    .slice(0, limit);
}

function highlightMediaPreview(value) {
  const videos = highlightVideoItems(value);
  if (!videos.length) {
    return `<div class="highlight-media is-empty">${escapeHtml(t(state.language, "highlightMatches.card.noVideo"))}</div>`;
  }
  const primary = videos[0];
  const secondary = videos[1];
  const extraCount = Math.max(0, videos.length - 1);
  return `
    <div class="highlight-media" aria-label="${escapeAttr(t(state.language, "highlightMatches.videoPreviewLabel"))}">
      <a class="highlight-media-main" href="${escapeAttr(primary.url)}" target="_blank" rel="noreferrer" aria-label="${escapeAttr(t(state.language, "highlightMatches.card.watch"))}">
        <img src="https://i.ytimg.com/vi/${escapeAttr(primary.videoId)}/mqdefault.jpg" alt="" loading="lazy" />
        <span class="highlight-play" aria-hidden="true"></span>
      </a>
      ${
        secondary
          ? `<a class="highlight-media-secondary" href="${escapeAttr(secondary.url)}" target="_blank" rel="noreferrer" aria-label="${escapeAttr(`${t(state.language, "values.video")} 2`)}">
              <img src="https://i.ytimg.com/vi/${escapeAttr(secondary.videoId)}/mqdefault.jpg" alt="" loading="lazy" />
              ${extraCount > 1 ? `<span>+${extraCount}</span>` : ""}
            </a>`
          : ""
      }
    </div>
  `;
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

let personKeyIndexCache = null;

function canonicalPersonRouteKey(value) {
  const people = state.data.people ?? [];
  if (!personKeyIndexCache || personKeyIndexCache.source !== people) {
    personKeyIndexCache = { source: people, value: personKeyIndex(people, normalizedKey) };
  }
  return canonicalPersonKey(personKeyIndexCache.value, value, normalizedKey);
}

function personLink(key, name) {
  const canonical = canonicalPersonRouteKey(key || name);
  return `<a class="link-button" href="${escapeAttr(personRouteHash(canonical))}" data-person-key="${escapeAttr(canonical)}" data-person-name="${escapeAttr(name)}">${escapeHtml(name)}</a>`;
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

function seasonLink(seasonId, label = seasonDisplay(seasonId)) {
  return `<a class="link-button" href="${escapeAttr(seasonRouteHash(seasonId))}">${escapeHtml(label)}</a>`;
}

function rosterGroupKeyFromRow(row) {
  const season = row.season_id || row.detected_season_id || "";
  const division = row.division || "";
  const personName = row.person_name || row.player_name || row.person || row.trainer || row.champion_name || "";
  const teamName = row.team_name || row.team || row.champion_team || inferredTeamForSeasonPerson(season, personName);
  const teamKey = rosterIdentityKey(row.team_key || row.team_name_normalized || teamName || "", normalizedKey);
  const personKey = rosterIdentityKey(row.person_key || row.person_name_normalized || personName || rosterPersonIdKey(row.person_id || row.champion_person_id), normalizedKey);
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
  return rosterIdentityKey(division || "unknown", normalizedKey) || "unknown";
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
    .filter((row) => rowMatchesSearch(row))
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
    renderTable("#killlists-table", aggregateRows, POKEMON_KILLLIST_COLUMNS, ["pokemon"], { hintColumns: POKEMON_USAGE_HINT_COLUMNS });
    return;
  }

  const titles = pokemonTitleIndex(state.data.pokemonDraftOverview ?? [], normalizedKey);
  const draftHistory = pokemonDraftHistoryIndex();
  const rows = summarizeKilllists(canonicalKilllistRows(filtered(state.data.killlists ?? []), state.division)).map((row) => ({
    ...row,
    ...pokemonHistoryFields(row, titles, draftHistory),
    kill_rate: killRateDisplay(row),
    pokemon: pokemonCell(row.pokemon),
  }));
  renderTable("#killlists-table", rows, POKEMON_KILLLIST_COLUMNS, ["pokemon"], { hintColumns: POKEMON_USAGE_HINT_COLUMNS });
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
    .filter((row) => rowMatchesSearch(row))
    .map((row, index) => ({
      rank: index + 1,
      pokemon: pokemonCell(row.pokemon, row.pokemon_normalized || normalizedKey(row.pokemon)),
      appearances: row.appearances,
      kills: row.kills,
      kill_rate: killRateDisplay(row),
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
    { filename: "team-roster-ranking.csv", hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );
  renderTable(
    "#team-roster-pokemon-table",
    groupedRosters.pokemonRows.map((row, index) => rosterPokemonTableRow(row, index + 1)),
    TEAM_ROSTER_POKEMON_COLUMNS,
    ["season", "person", "pokemon", "pokemon_score", "source"],
    { filename: "team-roster-pokemon.csv", hintColumns: POKEMON_USAGE_HINT_COLUMNS },
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
  const searchOk = rowMatchesSearch(row);
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
    kill_rate: killRateDisplay(row),
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
    kill_rate: killRateDisplay(row),
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
        ${rosterMetric("columns.kills", row.kills, pokemonColumnHint("kills"))}
        ${rosterMetric("columns.kill_rate", killRateDisplay(row), pokemonColumnHint("kill_rate"))}
      </div>
      <div class="roster-pokemon-list">
        ${sortedPokemon.map((pokemon) => rosterPokemonChip(pokemon)).join("")}
      </div>
      ${flags}
    </article>
  `;
}

function rosterMetric(labelKey, value, hint = "") {
  const label = escapeHtml(t(state.language, labelKey));
  return `<span><small>${label}${hint ? ` ${columnHelpHtml(hint)}` : ""}</small><strong>${escapeHtml(String(value))}</strong></span>`;
}

function rosterMatchdayMetric(column, value) {
  return `<span><strong>${escapeHtml(String(value))}</strong> ${columnHeaderHtml(column, POKEMON_USAGE_HINT_COLUMNS)}</span>`;
}

function rosterPokemonChip(row) {
  return `<span class="roster-pokemon-chip">${pokemonCell(row.pokemon, row.pokemon_key || normalizedKey(row.pokemon))}<small title="${escapeAttr(pokemonScoreFormula(row))}">${escapeHtml(String(row.pokemon_score))}</small></span>`;
}

function renderRosterDetail() {
  const focus = state.rosterFocus?.key;
  const focusTarget = document.querySelector("#roster-detail-focus");
  const summaryTarget = document.querySelector("#roster-detail-summary");
  const visualTarget = document.querySelector("#roster-detail-visual");
  const matchdaySection = document.querySelector("#roster-detail-matchday-section");
  const matchdayTarget = document.querySelector("#roster-detail-matchday-matrix");
  const tableSelector = "#roster-detail-pokemon-table";
  if (!focusTarget || !summaryTarget || !visualTarget) return;
  destroyTable(tableSelector);

  if (!focus) {
    focusTarget.innerHTML = "";
    summaryTarget.innerHTML = "";
    visualTarget.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    if (matchdaySection) matchdaySection.hidden = true;
    if (matchdayTarget) matchdayTarget.innerHTML = "";
    document.querySelector(tableSelector).innerHTML = "";
    return;
  }

  const detail = rosterDetailForKey(focus);
  if (!detail) {
    focusTarget.innerHTML = "";
    summaryTarget.innerHTML = "";
    visualTarget.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "rosters.detailNotFound"))}</p>`;
    if (matchdaySection) matchdaySection.hidden = true;
    if (matchdayTarget) matchdayTarget.innerHTML = "";
    document.querySelector(tableSelector).innerHTML = "";
    return;
  }

  const { overview, pokemonRows } = detail;
  const sortedPokemon = rosterPokemonDisplayRows(pokemonRows);
  const matchdayRows = rosterMatchdayRowsForDetail(overview, sortedPokemon);
  focusTarget.innerHTML = rosterDetailHero(overview);
  visualTarget.innerHTML = rosterTeamSheet(overview, sortedPokemon);
  summaryTarget.innerHTML = [
    metricCard(t(state.language, "columns.roster_score"), overview.roster_score),
    metricCard(t(state.language, "columns.performance_score"), overview.performance_score),
    metricCard(t(state.language, "columns.balance_score"), overview.balance_score),
    metricCard(t(state.language, "columns.history_score"), overview.history_score),
    metricCard(t(state.language, "columns.confidence_score"), overview.confidence_score),
    metricCard(t(state.language, "columns.pokemon_count"), overview.pokemon_count),
    metricCard(t(state.language, "columns.appearances"), displayNumber(overview.appearances), pokemonColumnHint("appearances")),
    metricCard(t(state.language, "columns.kills"), displayNumber(overview.kills), pokemonColumnHint("kills")),
    metricCard(t(state.language, "columns.kill_rate"), killRateDisplay(overview), pokemonColumnHint("kill_rate")),
  ].join("");
  if (matchdaySection && matchdayTarget) {
    matchdaySection.hidden = !matchdayRows.length;
    matchdayTarget.innerHTML = matchdayRows.length ? rosterMatchdayMatrix(overview, sortedPokemon, matchdayRows) : "";
  }
  renderTable(
    tableSelector,
    sortedPokemon.map((row, index) => rosterPokemonTableRow(row, index + 1)),
    TEAM_ROSTER_POKEMON_COLUMNS,
    ["season", "person", "team", "pokemon", "pokemon_score", "source"],
    { filename: `roster-${seasonSlug(overview.season_id)}-${normalizedKey(overview.team || overview.person || "detail")}.csv`, hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );
}

function rosterMatchdayRowsForDetail(overview, pokemonRows) {
  const pokemonKeys = new Set(pokemonRows.map((row) => normalizedKey(row.pokemon_key || row.pokemon_normalized || row.pokemon)).filter(Boolean));
  const slotKeys = new Map(
    pokemonRows
      .map((row) => [String(row.slot || "").trim(), normalizedKey(row.pokemon_key || row.pokemon_normalized || row.pokemon)])
      .filter(([slot, key]) => slot && key),
  );
  const overviewTeamKey = normalizedKey(overview.team || overview.team_name);
  const overviewPersonKey = normalizedKey(overview.person || overview.person_name);
  return (state.data.rosterMatchdays ?? [])
    .filter((row) => row.season_id === overview.season_id)
    .filter((row) => normalizedKey(row.division) === normalizedKey(overview.division))
    .filter((row) => normalizedKey(row.roster_phase) === normalizedKey(overview.roster_phase))
    .filter((row) => {
      const rowTeamKey = normalizedKey(row.team_name || row.team);
      const rowPersonKey = normalizedKey(row.person_name || row.person);
      const teamMatches = overviewTeamKey ? rowTeamKey === overviewTeamKey : true;
      const personMatches = overviewPersonKey ? rowPersonKey === overviewPersonKey || teamMatches : true;
      return teamMatches && personMatches;
    })
    .map((row) => {
      const pokemonKey = normalizedKey(row.pokemon_normalized || row.pokemon);
      const slotKey = String(row.slot || "").trim();
      const displayKey = pokemonKeys.has(pokemonKey) ? pokemonKey : slotKeys.get(slotKey) || pokemonKey;
      return { ...row, _display_pokemon_key: displayKey };
    })
    .filter((row) => row._display_pokemon_key)
    .sort(
      (a, b) =>
        _intCompare(a.slot, b.slot) ||
        numberValue(a.week_sort) - numberValue(b.week_sort) ||
        String(a.pokemon).localeCompare(String(b.pokemon)),
    );
}

function rosterMatchdayMatrix(overview, pokemonRows, rows) {
  const weeks = uniqueSortedMatchdayWeeks(rows);
  const displayRows = rosterMatchdayDisplayPokemonRows(pokemonRows, rows);
  const usage = rosterMatchdayUsageMap(rows);
  const appearances = rows.length;
  const kills = rows.reduce((sum, row) => sum + numberValue(row.kills), 0);
  const sources = uniqueSourceUrls(rows);
  return `
    <div class="roster-matchday-toolbar">
      ${rosterMatchdayMetric("appearances", appearances)}
      ${rosterMatchdayMetric("kills", displayNumber(kills))}
      <span><strong>${escapeHtml(String(weeks.length))}</strong> ${escapeHtml(t(state.language, "rosters.matchdayWeeks"))}</span>
      ${sources ? `<span class="roster-matchday-source">${sourceLinks(sources)}</span>` : ""}
    </div>
    <div class="roster-matchday-scroll" aria-label="${escapeAttr(t(state.language, "rosters.matchdayMatrixTitle"))}">
      <table class="roster-matchday-table">
        <thead>
          <tr>
            <th class="roster-matchday-pokemon">${escapeHtml(t(state.language, "columns.pokemon"))}</th>
            ${weeks.map((week) => `<th>${escapeHtml(week.label)}</th>`).join("")}
            <th>${columnHeaderHtml("appearances", POKEMON_USAGE_HINT_COLUMNS)}</th>
            <th>${columnHeaderHtml("kills", POKEMON_USAGE_HINT_COLUMNS)}</th>
          </tr>
          <tr>
            <th class="roster-matchday-pokemon">${escapeHtml(t(state.language, "columns.record"))}</th>
            ${weeks.map((week) => rosterMatchdayResultHeader(rows, week.week)).join("")}
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${displayRows
            .map((pokemon) => {
              const key = pokemon._display_pokemon_key || normalizedKey(pokemon.pokemon_key || pokemon.pokemon_normalized || pokemon.pokemon);
              const cells = weeks.map((week) => rosterMatchdayKillCell(usage.get(`${key}\u0000${week.week}`))).join("");
              const pokemonRows = rows.filter((row) => row._display_pokemon_key === key);
              const pokemonKills = pokemonRows.reduce((sum, row) => sum + numberValue(row.kills), 0);
              return `
                <tr>
                  <th class="roster-matchday-pokemon" scope="row">${pokemonCell(pokemon.pokemon, key)}</th>
                  ${cells}
                  <td class="roster-matchday-total">${escapeHtml(String(pokemonRows.length))}</td>
                  <td class="roster-matchday-total">${escapeHtml(displayNumber(pokemonKills))}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function rosterMatchdayDisplayPokemonRows(pokemonRows, matchdayRows) {
  const rows = pokemonRows.map((row) => ({
    ...row,
    _display_pokemon_key: normalizedKey(row.pokemon_key || row.pokemon_normalized || row.pokemon),
  }));
  const known = new Set(rows.map((row) => row._display_pokemon_key));
  for (const row of matchdayRows) {
    if (known.has(row._display_pokemon_key)) continue;
    known.add(row._display_pokemon_key);
    rows.push({
      pokemon: row.pokemon,
      pokemon_key: row._display_pokemon_key,
      pokemon_normalized: row._display_pokemon_key,
      slot: row.slot,
      pokemon_score: "",
      _display_pokemon_key: row._display_pokemon_key,
    });
  }
  return rows.sort(compareRosterPokemonBySlot);
}

function uniqueSortedMatchdayWeeks(rows) {
  const map = new Map();
  for (const row of rows) {
    const week = row.week || row.week_label;
    if (!week || map.has(week)) continue;
    map.set(week, {
      week,
      label: row.week_label || week,
      sort: numberValue(row.week_sort) || 999,
    });
  }
  return [...map.values()].sort((a, b) => a.sort - b.sort || String(a.label).localeCompare(String(b.label)));
}

function rosterMatchdayUsageMap(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = `${row._display_pokemon_key}\u0000${row.week}`;
    const previous = map.get(key);
    if (!previous) {
      map.set(key, { ...row });
      continue;
    }
    previous.kills = displayNumber(numberValue(previous.kills) + numberValue(row.kills));
    previous.source_urls = uniqueSourceUrls([previous, row]);
  }
  return map;
}

function rosterMatchdayResultHeader(rows, week) {
  const row = rows.find((item) => item.week === week && item.result);
  if (!row) return `<th class="roster-week-result"></th>`;
  const label = rosterResultLabel(row.result);
  const title = rosterResultTitle(row.result);
  return `<th class="roster-week-result is-${escapeAttr(row.result)}" title="${escapeAttr(title)}">${escapeHtml(label)}</th>`;
}

function rosterMatchdayKillCell(row) {
  if (!row) return `<td class="roster-matchday-cell"></td>`;
  const value = String(row.kills ?? "").trim();
  const isZero = value === "0";
  const title = row.source_urls ? sourceTitle(row.source_urls) : "";
  return `<td class="roster-matchday-cell is-used${isZero ? " is-zero" : ""}" title="${escapeAttr(title)}">${escapeHtml(value || "0")}</td>`;
}

function rosterResultLabel(result) {
  const labels = {
    de: { win: "S", loss: "N", draw: "U", not_played: "-" },
    en: { win: "W", loss: "L", draw: "D", not_played: "-" },
  };
  return labels[state.language]?.[result] || labels.de[result] || "";
}

function rosterResultTitle(result) {
  const key = {
    win: "rosters.resultWin",
    loss: "rosters.resultLoss",
    draw: "rosters.resultDraw",
    not_played: "rosters.resultNotPlayed",
  }[result];
  return key ? t(state.language, key) : "";
}

function uniqueSourceUrls(rows) {
  const urls = new Set();
  for (const row of rows) {
    String(row.source_urls || "")
      .split(";")
      .map((item) => item.trim())
      .filter((item) => item.startsWith("http"))
      .forEach((url) => urls.add(url));
  }
  return [...urls].join(";");
}

function sourceTitle(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

function _intCompare(a, b) {
  const left = String(a ?? "").trim() ? numberValue(a) : Number.POSITIVE_INFINITY;
  const right = String(b ?? "").trim() ? numberValue(b) : Number.POSITIVE_INFINITY;
  return left - right;
}

function rosterDetailForKey(key) {
  const normalizedFocusKey = normalizeRosterGroupKey(key, normalizedKey);
  let group = rosterDisplayGroups({ ignoreFilters: true }).groups.find((item) => item.key === key || normalizeRosterGroupKey(item.key, normalizedKey) === normalizedFocusKey);
  if (!group) {
    group = rosterDisplayGroups({ ignoreFilters: true, includeAllDataModes: true }).groups.find((item) => item.key === key || normalizeRosterGroupKey(item.key, normalizedKey) === normalizedFocusKey);
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

function defaultMatchHighlightCardLimit() {
  return 8;
}

function resetMatchHighlightCardLimit() {
  state.matchHighlightCardLimit = defaultMatchHighlightCardLimit();
}

function resetUpsetCardLimit() {
  state.upsetCardLimit = DEFAULT_UPSET_CARD_LIMIT;
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
      "Balance uses roster size up to 11, top-11 depth, bench quality, and top-heavy concentration. Lower tiers are not rewarded. Missing usage data lowers Confidence.",
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
    "Balance nutzt Kadergröße bis 11, Top-11-Tiefe, Bankqualität und Top-Heavy-Konzentration. Lower-Tiers werden nicht belohnt. Fehlende Einsatzdaten senken Confidence.",
  ].filter(Boolean).join(" ");
}

function pokemonScoreFormula(row) {
  const appearances = numberValue(row.appearances);
  const kills = numberValue(row.kills);
  const killRate = killRateDisplay(row);
  const performanceNote = appearances
    ? "Performance vergleicht Kills/Einsätze mit erwarteten Raten und dämpft kleine Samples."
    : kills
      ? "Performance nutzt hier kills-only: 50 + min(Kills, 30) / 30 * 25, weil Einsätze fehlen."
      : "Performance nutzt den Fallback 45, weil Einsätze und Kills fehlen.";
  return [
    "Pokémon-Score = 45% Performance + 12% Historie + 8% Confidence.",
    `Teilwerte: Performance ${row.performance_score}, Historie ${row.history_score}, Confidence ${row.confidence_score}.`,
    performanceNote,
    `Werte: Einsätze ${appearances}, Kills ${row.kills}, Killquote ${killRate || "n/a"}.`,
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
    metricCard(t(state.language, "columns.appearances"), displayNumber(detail.summary.appearances), pokemonColumnHint("appearances")),
    metricCard(t(state.language, "columns.kills"), displayNumber(detail.summary.kills), pokemonColumnHint("kills")),
    metricCard(t(state.language, "columns.kill_rate"), killRateDisplay(detail.summary), pokemonColumnHint("kill_rate")),
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
        kill_rate: performanceDisplay(row, "appearances") ? killRateDisplay(row) : "",
        seasons: row.seasons,
        season_list: row.season_list,
        teams: row.teams,
      };
    }),
    ["trainer", "appearances", "kills", "kill_rate", "seasons", "season_list", "teams"],
    ["trainer"],
    { hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );
  renderTable(
    "#pokemon-timeline-table",
    pokemonTimelineRows(pokemonDetailRows, focus.key, normalizedKey).map((row) => ({
      season: seasonLink(row.season_id),
      divisions: row.divisions,
      appearances: performanceDisplay(row, "appearances"),
      kills: performanceDisplay(row, "kills"),
      kill_rate: performanceDisplay(row, "appearances") ? killRateDisplay(row) : "",
      trainers: row.trainers,
      teams: row.teams,
    })),
    ["season", "divisions", "appearances", "kills", "kill_rate", "trainers", "teams"],
    ["season"],
    { hintColumns: POKEMON_USAGE_HINT_COLUMNS },
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
      kill_rate: performanceDisplay(row, "appearances") ? killRateDisplay(row) : "",
      source: sourceLinks(row.source_urls),
    })),
    ["season", "division", "trainer", "team", "appearances", "kills", "kill_rate", "source"],
    ["season", "trainer", "team", "source"],
    { hintColumns: POKEMON_USAGE_HINT_COLUMNS },
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

function weekOrder(rowOrWeek) {
  const value =
    rowOrWeek && typeof rowOrWeek === "object"
      ? rowOrWeek.week ?? rowOrWeek.detected_week ?? rowOrWeek.week_label
      : rowOrWeek;
  const orderedWeek = weekSortValue(value);
  if (orderedWeek !== 999) return orderedWeek;

  const text = String(value ?? "").toLowerCase();
  if (text.includes("viertel")) return 100;
  if (text.includes("halb")) return 110;
  if (text.includes("final")) return 120;
  return rowOrWeek && typeof rowOrWeek === "object" && rowOrWeek.stage === "playoffs" ? 150 : 999;
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
  const weekEntries = [...weeks.entries()].sort((a, b) => weekOrder(a[0]) - weekOrder(b[0]) || a[0].localeCompare(b[0]));
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

function renderMatchHighlights() {
  const summary = document.querySelector("#match-highlight-summary");
  const cards = document.querySelector("#match-highlight-cards");
  if (!summary || !cards) return;

  const rows = filtered(state.data.matchHighlights ?? []).sort(compareMatchHighlights);

  summary.innerHTML = [
    metricCard(t(state.language, "highlightMatches.summary.matches"), rows.length),
    metricCard(t(state.language, "highlightMatches.summary.viewOutliers"), rows.filter((row) => numberValue(row.view_trend_multiplier_match) >= 2).length),
    metricCard(t(state.language, "highlightMatches.summary.closeMatches"), rows.filter((row) => row.close_match === "1").length),
    metricCard(t(state.language, "highlightMatches.summary.playoffs"), rows.filter((row) => row.playoff_match === "1").length),
  ].join("");

  if (!rows.length) {
    cards.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "highlightMatches.empty"))}</p>`;
  } else {
    const limit = state.matchHighlightCardLimit || defaultMatchHighlightCardLimit();
    cards.innerHTML = [
      rows.slice(0, limit).map((row, index) => matchHighlightCard(row, index + 1)).join(""),
      rows.length > limit
        ? `<button class="show-more-button" type="button" data-show-more-match-highlights>${escapeHtml(t(state.language, "highlightMatches.showMore"))}</button>`
        : "",
    ].join("");
  }

  renderTable(
    "#match-highlight-table",
    rows.map((row, index) => matchHighlightTableRow(row, index + 1)),
    MATCH_HIGHLIGHT_COLUMNS,
    ["season", "player_a", "player_b", "videos", "source"],
    { filename: "gpl-match-highlights.csv" },
  );
}

function compareMatchHighlights(a, b) {
  return (
    numberValue(b.highlight_score) - numberValue(a.highlight_score) ||
    numberValue(b.view_peak) - numberValue(a.view_peak) ||
    seasonOrder(a.season_id) - seasonOrder(b.season_id) ||
    weekOrder(a) - weekOrder(b) ||
    String(a.match_id || "").localeCompare(String(b.match_id || ""))
  );
}

function matchHighlightTableRow(row, rank) {
  return {
    _season_order: seasonOrder(row.season_id),
    _week_order: weekOrder(row),
    rank,
    season: seasonLink(row.season_id),
    division: divisionDisplay(row.division, row.stage),
    stage: stageDisplay(row.stage),
    week: row.week,
    player_a: row.player_a ? personLink(normalizedKey(row.player_a), row.player_a) : "",
    player_b: row.player_b ? personLink(normalizedKey(row.player_b), row.player_b) : "",
    score: row.score,
    winner: row.winner,
    highlight_score: displayNumber(row.highlight_score),
    highlight_reasons: row.highlight_reasons,
    view_peak: displayNumber(row.view_peak),
    view_total: displayNumber(row.view_total),
    view_median: displayNumber(row.view_median),
    view_multiplier_peak: row.view_multiplier_peak ? `${displayNumber(row.view_multiplier_peak)}x` : "",
    views_percentile_peak: ratioPercentDisplay(row.views_percentile_peak),
    views_z_score_peak: displayNumber(row.views_z_score_peak),
    view_expected_peak: displayNumber(row.view_expected_peak),
    view_trend_multiplier_peak: row.view_trend_multiplier_peak ? `${displayNumber(row.view_trend_multiplier_peak)}x` : "",
    views_trend_percentile_peak: ratioPercentDisplay(row.views_trend_percentile_peak),
    views_trend_z_score_peak: displayNumber(row.views_trend_z_score_peak),
    view_expected_total: displayNumber(row.view_expected_total),
    view_trend_multiplier_match: row.view_trend_multiplier_match ? `${displayNumber(row.view_trend_multiplier_match)}x` : "",
    views_trend_percentile_match: ratioPercentDisplay(row.views_trend_percentile_match),
    views_trend_z_score_match: displayNumber(row.views_trend_z_score_match),
    views_total_percentile_match: ratioPercentDisplay(row.views_total_percentile_match),
    like_peak: displayNumber(row.like_peak),
    comment_peak: displayNumber(row.comment_peak),
    engagement_rate_peak: displayNumber(row.engagement_rate_peak),
    engagement_multiplier_peak: row.engagement_multiplier_peak ? `${displayNumber(row.engagement_multiplier_peak)}x` : "",
    engagement_percentile_peak: ratioPercentDisplay(row.engagement_percentile_peak),
    engagement_z_score_peak: displayNumber(row.engagement_z_score_peak),
    peak_perspective: row.peak_perspective,
    both_sides_spiked: row.both_sides_spiked === "1" ? t(state.language, "values.yes") : "",
    close_match: row.close_match === "1" ? t(state.language, "values.yes") : "",
    playoff_match: row.playoff_match === "1" ? t(state.language, "values.yes") : "",
    video_count: row.video_count,
    videos: sourceLinks(row.video_urls),
    source: sourceLinks(row.source_urls),
  };
}

const HIGHLIGHT_REASON_PRIORITY = [
  "Community-Magnet",
  "Match-Ausrei",
  "über Match",
  "Engagement-Ausrei",
  "knapper Kampf",
  "Playoff",
  "beide Perspektiven",
  "mehrere Perspektiven",
  "Top 5% Reichweite",
  "Top 5% match",
  "Top 10% match",
  "starke Einzelperspektive",
  "Match-Z-Score",
];

function highlightPrimaryReasons(reasons, limit = 3) {
  return [...reasons]
    .sort((left, right) => highlightReasonPriority(left) - highlightReasonPriority(right))
    .slice(0, limit);
}

function highlightReasonPriority(reason) {
  const index = HIGHLIGHT_REASON_PRIORITY.findIndex((token) => reason.includes(token));
  return index === -1 ? HIGHLIGHT_REASON_PRIORITY.length : index;
}

function highlightSourceCountLabel(count) {
  const singular = t(state.language, "values.source");
  const plural = t(state.language, "highlightMatches.card.sources");
  return `${count} ${count === 1 ? singular : plural}`;
}

function highlightSourceActions(value) {
  const videos = highlightVideoItems(value);
  if (!videos.length) return "";
  const sourceList =
    videos.length > 1
      ? `<details class="highlight-source-menu">
          <summary>${escapeHtml(highlightSourceCountLabel(videos.length))}</summary>
          <div>${videos
            .map(
              (item, index) =>
                `<a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(`${t(state.language, "values.source")} ${index + 1}`)}</a>`,
            )
            .join("")}</div>
        </details>`
      : "";
  return `
    <div class="highlight-source-actions">
      <a class="highlight-watch-link" href="${escapeAttr(videos[0].url)}" target="_blank" rel="noreferrer">${escapeHtml(t(state.language, "highlightMatches.card.watch"))}</a>
      ${sourceList}
    </div>
  `;
}

function matchHighlightCard(row, rank) {
  const reasons = String(row.highlight_reasons || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const previewUrls = highlightPreviewUrls(row);
  const videoCount = highlightVideoItems(previewUrls).length || numberValue(row.video_count);
  const meta = [
    divisionDisplay(row.division, row.stage),
    row.video_count ? `${row.video_count} ${t(state.language, "summary.videos")}` : "",
  ].filter(Boolean);
  return `
    <article class="highlight-card">
      <div class="highlight-card-head">
        <span class="highlight-rank">#${escapeHtml(String(rank))}</span>
        <span class="highlight-card-meta">${escapeHtml(seasonDisplay(row.season_id))}${row.week ? ` \u00b7 ${escapeHtml(row.week)}` : ""}${meta.length ? ` \u00b7 ${escapeHtml(meta.join(" \u00b7 "))}` : ""}</span>
        <strong><small>${escapeHtml(t(state.language, "columns.highlight_score"))}</small>${escapeHtml(displayNumber(row.highlight_score))}</strong>
      </div>
      <h3 class="highlight-match-title">${row.player_a ? personLink(normalizedKey(row.player_a), row.player_a) : ""}<span class="highlight-vs">vs</span>${row.player_b ? personLink(normalizedKey(row.player_b), row.player_b) : ""}</h3>
      ${highlightMediaPreview(previewUrls)}
      <div class="highlight-card-stats">
        <span>${escapeHtml(t(state.language, "highlightMatches.card.views"))}<strong>${escapeHtml(displayNumber(row.view_peak))}</strong></span>
        <span>${escapeHtml(t(state.language, "highlightMatches.card.trend"))}<strong>${escapeHtml(row.view_trend_multiplier_match ? `${displayNumber(row.view_trend_multiplier_match)}x` : "")}</strong></span>
        <span>${escapeHtml(t(state.language, "highlightMatches.card.engagement"))}<strong>${escapeHtml(row.engagement_multiplier_peak ? `${displayNumber(row.engagement_multiplier_peak)}x` : "")}</strong></span>
        <span>${escapeHtml(t(state.language, "highlightMatches.card.sources"))}<strong>${escapeHtml(videoCount ? String(videoCount) : "")}</strong></span>
      </div>
      ${
        reasons.length
          ? `<details class="highlight-card-details"><summary>${escapeHtml(t(state.language, "highlightMatches.card.details"))}</summary><div>${reasons
              .map((reason) => `<span>${escapeHtml(reason)}</span>`)
              .join("")}</div></details>`
          : ""
      }
      ${highlightSourceActions(previewUrls)}
    </article>
  `;
}

const DEFAULT_UPSET_CARD_LIMIT = 8;

// The Elo walk must cover the full chronology of the current data basis, or
// pregame ratings would reset whenever a season filter is active. Season,
// division, and search narrow the displayed rows only.
let eloChronologyCache = null;

// Person routes carry either the person_id form ("person_bene", used by
// aggregate CSV links) or the normalized name ("bene"); the chronology is
// keyed by normalized names only, so both forms must resolve to one key.
function chronologyKeyForPerson(chronology, focusKey) {
  if (!focusKey) return "";
  if (chronology.perPerson.has(focusKey)) return focusKey;
  const comparable = personComparableKey(focusKey);
  for (const key of chronology.perPerson.keys()) {
    if (personComparableKey(key) === comparable) return key;
  }
  return "";
}

function cachedEloChronology() {
  const matches = state.data.matches ?? [];
  if (eloChronologyCache && eloChronologyCache.mode === state.dataMode && eloChronologyCache.source === matches) {
    return eloChronologyCache.value;
  }
  const rows = matches.filter((row) => applyDataMode(row));
  eloChronologyCache = { mode: state.dataMode, source: matches, value: eloChronology(rows, normalizedKey) };
  return eloChronologyCache.value;
}

function renderUpsetIndex() {
  const summary = document.querySelector("#upset-summary");
  const cards = document.querySelector("#upset-cards");
  if (!summary || !cards) return;

  const chronology = cachedEloChronology();
  const allRows = upsetRows(
    (state.data.matches ?? []).filter((row) => applyDataMode(row)),
    chronology,
    state.data.matchHighlights ?? [],
    normalizedKey,
  );
  const rows = allRows.filter((row) => {
    const seasonOk = state.season === "all" || row.season_id === state.season;
    return seasonOk && divisionMatches(row, state.division) && rowMatchesSearch(row);
  });

  const biggest = rows[0];
  const underdogWins = new Map();
  for (const row of rows) {
    if (row.win_prob_winner < 0.35) {
      underdogWins.set(row.winner_name, (underdogWins.get(row.winner_name) ?? 0) + 1);
    }
  }
  const topUnderdog = [...underdogWins.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

  summary.innerHTML = [
    metricCard(t(state.language, "upsets.summaryRanked"), rows.length),
    metricCard(t(state.language, "upsets.summaryUnder25"), rows.filter((row) => row.win_prob_winner < 0.25).length),
    metricCard(t(state.language, "upsets.summaryBiggest"), biggest ? upsetProbDisplay(biggest.win_prob_winner) : "–"),
    metricCard(t(state.language, "upsets.summaryTopUnderdog"), topUnderdog ? `${topUnderdog[0]} (${topUnderdog[1]})` : "–"),
  ].join("");

  if (!rows.length) {
    cards.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "upsets.empty"))}</p>`;
  } else {
    const limit = state.upsetCardLimit || DEFAULT_UPSET_CARD_LIMIT;
    cards.innerHTML = [
      rows.slice(0, limit).map((row, index) => upsetCard(row, index + 1)).join(""),
      rows.length > limit
        ? `<button class="show-more-button" type="button" data-show-more-upsets>${escapeHtml(t(state.language, "upsets.showMore"))}</button>`
        : "",
    ].join("");
  }

  renderTable(
    "#upset-table",
    rows.map((row, index) => upsetTableRow(row, index + 1)),
    UPSET_COLUMNS,
    ["season", "winner", "loser", "videos", "source"],
    { filename: "gpl-upset-index.csv" },
  );
}

function upsetProbDisplay(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)} %` : "";
}

function renderPersonEloLedger(focusKey) {
  const container = document.querySelector("#person-elo-ledger-table");
  if (!container) return;
  const chronology = focusKey ? cachedEloChronology() : null;
  const chronoKey = chronology ? chronologyKeyForPerson(chronology, focusKey) : "";
  if (!chronoKey) {
    destroyTable("#person-elo-ledger-table");
    container.replaceChildren();
    return;
  }

  const rows = eloLedgerRows(chronoKey, chronology, state.data.matches ?? [], normalizedKey).map((row) => {
    const delta = Math.round(row.elo_delta);
    return {
      _season_order: seasonOrder(row.season_id),
      _week_order: weekOrder(row),
      season: seasonLink(row.season_id),
      week: row.week,
      division: divisionDisplay(row.division, row.stage),
      opponent: personLink(row.opponent_key, row.opponent_name),
      score: row.score,
      result: t(state.language, `values.${row.result}`),
      elo_delta: `${delta > 0 ? "+" : ""}${delta}`,
      elo_after: String(Math.round(row.elo_after)),
      videos:
        videoLinksForMatch(row.match_id, { compact: true }) ||
        (row.video_url
          ? `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(t(state.language, "values.video"))}</a>`
          : ""),
      source: sourceCell(row.source_urls),
    };
  });

  renderTable("#person-elo-ledger-table", rows, ELO_LEDGER_COLUMNS, ["season", "opponent", "videos", "source"], {
    filename: "gpl-elo-ledger.csv",
  });
}

function renderPersonEloChart(focusKey) {
  const block = document.querySelector("#person-elo-block");
  const container = document.querySelector("#person-elo-chart");
  if (!block || !container) return;

  const chronology = focusKey ? cachedEloChronology() : null;
  const chronoKey = chronology ? chronologyKeyForPerson(chronology, focusKey) : "";
  const series = chronoKey
    ? personEloSeries(chronoKey, chronology, state.data.personStints ?? [], state.data.champions ?? [], normalizedKey)
    : null;
  const hasCurve = Boolean(series && series.points.length >= 2);
  block.hidden = !hasCurve;
  if (!hasCurve) {
    container.replaceChildren();
    return;
  }

  const built = buildSeries(series.points, (point) => point.seq, (point) => point.rating);
  const markers = series.markers.map((marker) => ({
    x: marker.seq,
    y: marker.rating,
    label: "🏆",
    title: `${t(state.language, "columns.titles")} ${marker.label}`,
  }));
  const peakPoint = series.points.find((point) => point.matchId === series.peak.matchId);
  if (peakPoint) {
    markers.push({
      x: peakPoint.seq,
      y: peakPoint.rating,
      label: `${t(state.language, "personDetails.eloPeak")} ${Math.round(series.peak.rating)}`,
      className: "chart-marker-peak",
      labelAt: "top",
    });
  }

  lineChart(container, {
    series: [{ id: "elo", points: built.points, className: "viz-series-1" }],
    bands: series.bands.map((band) => ({ fromX: band.fromSeq, toX: band.toSeq, label: band.label, shortLabel: band.shortLabel })),
    markers,
    xDomain: built.xDomain,
    yDomain: built.yDomain,
    formatX: () => "",
    formatY: (value) => String(Math.round(value)),
    fallbackText: t(state.language, "personDetails.eloChartNote"),
    tooltip: (point) => {
      const entry = chronology.perMatch.get(point.matchId);
      if (!entry) return String(Math.round(point.rating));
      const isA = entry.aKey === chronoKey;
      const opponent = isA ? entry.bName : entry.aName;
      const delta = isA ? entry.deltaA : entry.deltaB;
      const sign = delta >= 0 ? "+" : "";
      const week = entry.week ? ` ${entry.week}` : "";
      return `${seasonDisplay(entry.seasonId)}${week} · vs ${opponent}: ${sign}${Math.round(delta)} → ${Math.round(point.rating)}`;
    },
  });
}

function upsetCard(row, rank) {
  const probLine = t(state.language, "upsets.probLine")
    .replace("{name}", row.winner_name)
    .replace("{prob}", String(Math.round(row.win_prob_winner * 100)));
  const previewUrls = highlightPreviewUrls({ match_id: row.match_id, video_urls: row.video_url });
  const meta = [divisionDisplay(row.division, row.stage)].filter(Boolean);
  return `
    <article class="highlight-card">
      <div class="highlight-card-head">
        <span class="highlight-rank">#${escapeHtml(String(rank))}</span>
        <span class="highlight-card-meta">${escapeHtml(seasonDisplay(row.season_id))}${row.week ? ` · ${escapeHtml(row.week)}` : ""}${meta.length ? ` · ${escapeHtml(meta.join(" · "))}` : ""}</span>
        <strong><small>${escapeHtml(t(state.language, "columns.win_prob_winner"))}</small>${escapeHtml(upsetProbDisplay(row.win_prob_winner))}</strong>
      </div>
      <h3 class="highlight-match-title">${personLink(row.winner_key, row.winner_name)}<span class="highlight-vs">vs</span>${personLink(row.loser_key, row.loser_name)}</h3>
      ${highlightMediaPreview(previewUrls)}
      <div class="highlight-card-stats">
        <span>${escapeHtml(t(state.language, "columns.elo_pre_winner"))}<strong>${escapeHtml(String(Math.round(row.elo_pre_winner)))}</strong></span>
        <span>${escapeHtml(t(state.language, "columns.elo_pre_loser"))}<strong>${escapeHtml(String(Math.round(row.elo_pre_loser)))}</strong></span>
        <span>${escapeHtml(t(state.language, "columns.score"))}<strong>${escapeHtml(row.score)}</strong></span>
        <span>${escapeHtml(t(state.language, "columns.views_z_score"))}<strong>${escapeHtml(String(displayNumber(row.views_z_score)))}</strong></span>
      </div>
      <p class="upset-prob-line">${escapeHtml(probLine)}</p>
      ${highlightSourceActions(previewUrls)}
    </article>
  `;
}

function upsetTableRow(row, rank) {
  return {
    _season_order: seasonOrder(row.season_id),
    _week_order: weekOrder(row),
    rank,
    season: seasonLink(row.season_id),
    division: divisionDisplay(row.division, row.stage),
    stage: stageDisplay(row.stage),
    week: row.week,
    winner: personLink(row.winner_key, row.winner_name),
    elo_pre_winner: String(Math.round(row.elo_pre_winner)),
    loser: personLink(row.loser_key, row.loser_name),
    elo_pre_loser: String(Math.round(row.elo_pre_loser)),
    win_prob_winner: upsetProbDisplay(row.win_prob_winner),
    score: row.score,
    views_z_score: displayNumber(row.views_z_score),
    videos:
      videoLinksForMatch(row.match_id, { compact: true }) ||
      (row.video_url
        ? `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(t(state.language, "values.video"))}</a>`
        : ""),
    source: sourceCell(row.source_urls),
  };
}

const RECORD_KEYS = [
  "highest_elo",
  "longest_win_streak",
  "longest_unbeaten",
  "most_career_wins",
  "most_career_matches",
  "most_career_kills",
  "most_season_kills_person",
  "most_season_kills_pokemon",
  "most_career_kills_pokemon",
  "most_seasons_played",
];

const STREAK_TYPE_KEYS = ["all", "win", "unbeaten", "sweep", "loss"];

function renderRecordBook() {
  const panels = {
    records: document.querySelector("#record-book-records"),
    finder: document.querySelector("#record-book-finder"),
    streaks: document.querySelector("#record-book-streaks"),
  };
  if (!panels.records) return;
  for (const [tab, panel] of Object.entries(panels)) {
    if (panel) panel.hidden = tab !== state.recordBookTab;
  }
  document.querySelectorAll("[data-record-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.recordTab === state.recordBookTab);
  });

  if (state.recordBookTab === "records") renderRecordTab();
  if (state.recordBookTab === "finder") renderFinderTab();
  if (state.recordBookTab === "streaks") renderStreaksTab();
}

function recordHolderLabel(row) {
  if (row.holder_pokemon) return pokemonCell(row.holder_pokemon);
  return personLink(row.holder_person_id || normalizedKey(row.holder_name), row.holder_name);
}

const RECORD_ICONS = {
  highest_elo: "📈",
  longest_win_streak: "🔥",
  longest_unbeaten: "🛡️",
  most_career_wins: "🏅",
  most_career_matches: "🎮",
  most_career_kills: "⚔️",
  most_season_kills_person: "💥",
  most_season_kills_pokemon: "🐉",
  most_career_kills_pokemon: "👑",
  most_seasons_played: "📅",
};

function currentRecordRow(rows) {
  return rows.find((row) => row.superseded === "0" || row.superseded === 0) || rows[rows.length - 1];
}

function renderRecordTab() {
  const overview = document.querySelector("#record-overview");
  const detail = document.querySelector("#record-detail");
  if (!overview || !detail) return;
  overview.hidden = Boolean(state.recordKey);
  detail.hidden = !state.recordKey;
  if (!state.recordKey) {
    renderRecordOverview(overview);
    return;
  }
  renderRecordDetail();
}

function renderRecordOverview(overview) {
  const allRows = state.data.recordsProgression ?? [];
  overview.innerHTML = RECORD_KEYS.map((key) => {
    const rows = allRows.filter((row) => row.record_key === key);
    const current = currentRecordRow(rows);
    if (!current) return "";
    const holder = current.holder_pokemon
      ? `${pokemonIcon(current.holder_pokemon, current.holder_pokemon)} ${escapeHtml(current.holder_pokemon)}`
      : escapeHtml(current.holder_name);
    return `
      <article class="hof-card record-card" data-record-key="${escapeAttr(key)}" role="button" tabindex="0">
        <h3><span class="award-legend-icon">${escapeHtml(RECORD_ICONS[key] || "🏁")}</span>${escapeHtml(t(state.language, `recordBook.records.${key}`))}</h3>
        <p class="record-card-holder">${holder}</p>
        <p class="record-card-value">${escapeHtml(String(displayNumber(current.value) || current.value))}</p>
        <p class="hof-stats">${escapeHtml(t(state.language, "recordBook.sinceLabel"))} ${escapeHtml(seasonDisplay(current.season_id))}${current.week ? ` · ${escapeHtml(current.week)}` : ""} — ${escapeHtml(t(state.language, "recordBook.handOffs"))}: ${rows.length}</p>
      </article>
    `;
  }).join("");
}

function renderRecordDetail() {
  const holderCard = document.querySelector("#record-holder-card");
  const chartContainer = document.querySelector("#record-progression-chart");
  const title = document.querySelector("#record-detail-title");
  if (!holderCard || !chartContainer) return;
  if (title) {
    title.textContent = `${RECORD_ICONS[state.recordKey] || ""} ${t(state.language, `recordBook.records.${state.recordKey}`)}`.trim();
  }

  const rows = (state.data.recordsProgression ?? []).filter((row) => row.record_key === state.recordKey);
  const current = currentRecordRow(rows);

  holderCard.innerHTML = current
    ? [
        metricCard(t(state.language, "recordBook.currentHolder"), current.holder_pokemon || current.holder_name),
        metricCard(t(state.language, "columns.value"), displayNumber(current.value) || current.value),
        metricCard(t(state.language, "recordBook.sinceLabel"), `${seasonDisplay(current.season_id)}${current.week ? ` · ${current.week}` : ""}`),
        metricCard(t(state.language, "recordBook.handOffs"), rows.length),
      ].join("")
    : `<p class="empty">${escapeHtml(t(state.language, "hof.empty"))}</p>`;

  stepChart(chartContainer, {
    series: [
      {
        id: "record",
        className: "viz-series-1",
        points: rows.map((row, index) => ({ x: index, y: numberValue(row.value), source: row })),
      },
    ],
    height: 240,
    formatX: () => "",
    formatY: (value) => String(Math.round(value)),
    fallbackText: t(state.language, "recordBook.progressionTitle"),
    tooltip: (row) => `${row.holder_pokemon || row.holder_name}: ${row.value} (${seasonDisplay(row.season_id)})`,
  });

  renderTable(
    "#record-progression-table",
    rows.map((row, index) => ({
      _season_order: seasonOrder(row.season_id),
      _week_order: weekOrder(row),
      rank: index + 1,
      holder: recordHolderLabel(row),
      value: displayNumber(row.value) || row.value,
      season: seasonLink(row.season_id),
      week: row.week,
      videos:
        videoLinksForMatch(row.match_id, { compact: true }) ||
        (row.video_url
          ? `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(t(state.language, "values.video"))}</a>`
          : ""),
      source: sourceCell(row.source_urls),
    })),
    RECORD_HOLDER_COLUMNS,
    ["holder", "season", "videos", "source"],
    { filename: `gpl-record-${state.recordKey}.csv` },
  );
}

let finderBound = false;

function finderCriteria() {
  return {
    season: document.querySelector("#record-finder-season")?.value || "all",
    division: document.querySelector("#record-finder-division")?.value || "all",
    participant: document.querySelector("#record-finder-participant")?.value || "",
    opponent: document.querySelector("#record-finder-opponent")?.value || "",
    pokemon: document.querySelector("#record-finder-pokemon")?.value || "",
    sweepsOnly: Boolean(document.querySelector("#record-finder-sweeps")?.checked),
  };
}

function renderFinderTab() {
  const form = document.querySelector("#record-finder-form");
  if (!form) return;

  const seasonSelect = document.querySelector("#record-finder-season");
  if (seasonSelect && !seasonSelect.options.length) {
    const seasons = [...new Set((state.data.matches ?? []).map((row) => row.season_id).filter(Boolean))].sort(
      (a, b) => seasonOrder(a) - seasonOrder(b),
    );
    seasonSelect.innerHTML = [`<option value="all">${escapeHtml(t(state.language, "filters.allSeasons"))}</option>`]
      .concat(seasons.map((id) => `<option value="${escapeAttr(id)}">${escapeHtml(seasonDisplay(id))}</option>`))
      .join("");
    const divisionSelect = document.querySelector("#record-finder-division");
    const divisions = [...new Set((state.data.matches ?? []).map((row) => row.division).filter(Boolean))].sort();
    divisionSelect.innerHTML = [`<option value="all">${escapeHtml(t(state.language, "filters.allDivisions"))}</option>`]
      .concat(divisions.map((name) => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`))
      .join("");
    const peopleList = document.querySelector("#record-finder-people");
    peopleList.innerHTML = (state.data.people ?? [])
      .map((row) => `<option value="${escapeAttr(row.person_name)}"></option>`)
      .join("");
  }
  const pokemonList = document.querySelector("#record-finder-pokemon-list");
  if (pokemonList && !pokemonList.options.length && (state.data.rosterMatchdays ?? []).length) {
    const names = [...new Set((state.data.rosterMatchdays ?? []).map((row) => row.pokemon).filter(Boolean))].sort();
    pokemonList.innerHTML = names.map((name) => `<option value="${escapeAttr(name)}"></option>`).join("");
  }

  if (!finderBound) {
    finderBound = true;
    form.addEventListener("input", () => renderFinderResults());
    form.addEventListener("submit", (event) => event.preventDefault());
  }
  renderFinderResults();
}

function renderFinderResults() {
  const countLine = document.querySelector("#record-finder-count");
  if (!countLine) return;
  const rows = finderFilterRows(state.data.matches ?? [], state.data.rosterMatchdays ?? [], finderCriteria(), normalizedKey);
  countLine.textContent = t(state.language, "recordBook.finderCount").replace("{count}", String(rows.length));
  renderTable(
    "#record-finder-table",
    rows.map((row) => ({
      _season_order: seasonOrder(row.season_id),
      _week_order: weekOrder(row),
      season: seasonLink(row.season_id),
      week: row.week,
      division: divisionDisplay(row.division, row.stage),
      stage: stageDisplay(row.stage),
      player_a: personLink(normalizedKey(row.player_a), row.player_a),
      player_b: personLink(normalizedKey(row.player_b), row.player_b),
      score: [row.score_a, row.score_b].filter((value) => value !== undefined && value !== "").join(":"),
      winner: row.winner,
      videos:
        videoLinksForMatch(row.match_id, { compact: true }) ||
        (row.video_url
          ? `<a href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(t(state.language, "values.video"))}</a>`
          : ""),
      source: sourceCell(row.source_urls),
    })),
    MATCH_FINDER_COLUMNS,
    ["season", "player_a", "player_b", "videos", "source"],
    { filename: "gpl-match-finder.csv" },
  );
}

function renderStreaksTab() {
  const buttons = document.querySelector("#streak-type-buttons");
  if (!buttons) return;
  buttons.innerHTML = STREAK_TYPE_KEYS.map((type) => {
    const label = type === "all" ? t(state.language, "recordBook.allTypes") : t(state.language, `recordBook.streakTypes.${type}`);
    return `<button class="tab record-chip${type === state.streakType ? " is-active" : ""}" type="button" data-streak-type="${escapeAttr(type)}">${escapeHtml(label)}</button>`;
  }).join("");

  const rows = streakTableRows(state.data.streaks ?? [], { streakType: state.streakType });
  renderTable(
    "#streak-table",
    rows.map((row, index) => ({
      _season_order: seasonOrder(row.start_season_id),
      rank: index + 1,
      person: personLink(row.person_id || normalizedKey(row.person_name), row.person_name),
      streak_type: t(state.language, `recordBook.streakTypes.${row.streak_type}`),
      length: row.length,
      start_season: seasonLink(row.start_season_id),
      start_week: row.start_week,
      end_season: seasonLink(row.end_season_id),
      end_week: row.end_week,
      active: row.active === "1" || row.active === 1 ? t(state.language, "values.yes") : "",
      source: sourceCell(row.source_urls),
    })),
    STREAK_COLUMNS,
    ["person", "start_season", "end_season", "source"],
    { filename: "gpl-streaks.csv" },
  );
}

const AWARD_ICONS = {
  champion: "🏆",
  mvp: "🥇",
  kill_leader: "⚔️",
  best_newcomer: "🌱",
  upset_of_season: "⚡",
  giant_slayer: "🗡️",
  holzloeffel: "🥄",
  holzloeffel_redemption: "🔁",
  iron_man: "🛡️",
};

function awardName(awardKey) {
  return t(state.language, `awards.names.${awardKey}`);
}

function awardFormula(formula) {
  return t(state.language, `awards.formulas.${formula}`);
}

function renderAwards() {
  const cards = document.querySelector("#award-cards");
  if (!cards) return;
  renderAwardLegend();
  const allRows = state.data.awards ?? [];
  const rows = awardsBySeason(allRows, state.season).filter((row) => rowMatchesSearch(row));

  if (state.season === "all") {
    cards.innerHTML = allTimeAwardCards(rows);
  } else {
    cards.innerHTML = rows.length
      ? rows.filter((row) => row.scope === "season").map((row) => awardCard(row)).join("")
      : `<p class="empty">${escapeHtml(t(state.language, "hof.empty"))}</p>`;
  }

  renderTable(
    "#award-table",
    rows.map((row) => ({
      _season_order: seasonOrder(row.season_id),
      season: row.scope === "career" ? escapeHtml(t(state.language, "awards.careerTitle")) : seasonLink(row.season_id),
      award: `${AWARD_ICONS[row.award_key] || ""} ${escapeHtml(awardName(row.award_key))}`.trim(),
      division: row.division,
      person: personLink(row.person_id || normalizedKey(row.person_name), row.person_name),
      value: row.value,
      formula: `<span title="${escapeAttr(awardFormula(row.formula))}">${escapeHtml(awardFormula(row.formula))}</span>`,
      source: sourceCell(row.source_urls),
    })),
    AWARD_COLUMNS,
    ["season", "award", "person", "formula", "source"],
    { filename: "gpl-awards.csv" },
  );
}

function renderAwardLegend() {
  const legend = document.querySelector("#award-legend");
  if (!legend) return;
  // Only award types that actually occur in the data; a type with zero rows
  // (nobody has earned it yet) would just clutter the legend.
  const usedKeys = new Set((state.data.awards ?? []).map((row) => row.award_key));
  legend.innerHTML = Object.keys(AWARD_ICONS)
    .filter((key) => usedKeys.has(key))
    .map(
      (key) => `
        <div class="award-legend-row">
          <span class="award-legend-icon">${escapeHtml(AWARD_ICONS[key])}</span>
          <div class="award-legend-text">
            <strong>${escapeHtml(awardName(key))}</strong>
            <span class="award-legend-formula">${escapeHtml(awardFormula(AWARD_FORMULA_BY_KEY[key]))}</span>
          </div>
        </div>
      `,
    )
    .join("");
}

const AWARD_FORMULA_BY_KEY = {
  champion: "sourced_title",
  mvp: "weighted_rating_min5",
  kill_leader: "season_kills",
  best_newcomer: "weighted_rating_debut_min5",
  upset_of_season: "min_pregame_win_chance",
  giant_slayer: "beat_highest_rated",
  holzloeffel: "last_place",
  holzloeffel_redemption: "spoon_to_title",
  iron_man: "consecutive_seasons",
};

function awardCard(row) {
  return `
    <article class="highlight-card award-card">
      <div class="highlight-card-head">
        <span class="highlight-rank">${escapeHtml(AWARD_ICONS[row.award_key] || "🎖️")}</span>
        <span class="highlight-card-meta">${escapeHtml(seasonDisplay(row.season_id))}${row.division ? ` · ${escapeHtml(row.division)}` : ""}</span>
        <strong><small>${escapeHtml(awardName(row.award_key))}</small>${escapeHtml(String(row.value || ""))}</strong>
      </div>
      <h3 class="highlight-match-title">${personLink(row.person_id || normalizedKey(row.person_name), row.person_name)}</h3>
      <p class="upset-prob-line">${escapeHtml(awardFormula(row.formula))}</p>
    </article>
  `;
}

function allTimeAwardCards(rows) {
  const byPerson = new Map();
  for (const row of rows) {
    const key = row.person_id || normalizedKey(row.person_name);
    if (!byPerson.has(key)) byPerson.set(key, { name: row.person_name, key, counts: new Map(), total: 0 });
    const entry = byPerson.get(key);
    entry.counts.set(row.award_key, (entry.counts.get(row.award_key) ?? 0) + 1);
    entry.total += 1;
  }
  const top = [...byPerson.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 12);
  return top
    .map(
      (entry) => `
        <article class="highlight-card award-card">
          <div class="highlight-card-head">
            <span class="highlight-rank">${escapeHtml(String(entry.total))}</span>
            <span class="highlight-card-meta">${escapeHtml(t(state.language, "awards.allTimeTitle"))}</span>
          </div>
          <h3 class="highlight-match-title">${personLink(entry.key, entry.name)}</h3>
          <div class="highlight-card-stats award-count-row">
            ${[...entry.counts.entries()]
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .map(([key, count]) => `<span title="${escapeAttr(awardName(key))}">${escapeHtml(AWARD_ICONS[key] || "")}<strong>${escapeHtml(String(count))}</strong></span>`)
              .join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function renderPersonTrophies(focusKey) {
  const shelf = document.querySelector("#person-trophies");
  if (!shelf) return;
  if (!focusKey) {
    shelf.hidden = true;
    shelf.replaceChildren();
    return;
  }
  const comparable = personComparableKey(focusKey);
  const titleChips = (state.data.champions ?? [])
    .filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status))
    .filter((row) => personComparableKey(row.champion_person_id || normalizedKey(row.champion_name)) === comparable)
    .map(
      (row) =>
        `<span class="trophy-chip is-title" title="${escapeAttr(`${t(state.language, "awards.names.champion")} ${seasonDisplay(row.season_id)}`)}">🏆 ${escapeHtml(seasonShortDisplay(row.season_id))}</span>`,
    );
  const awardChips = (state.data.awards ?? [])
    .filter((row) => row.award_key !== "champion")
    .filter((row) => personComparableKey(row.person_id || normalizedKey(row.person_name)) === comparable)
    .map((row) => {
      const label = row.scope === "career" ? String(row.value || "") : seasonShortDisplay(row.season_id);
      const tooltip = `${awardName(row.award_key)}${row.season_id ? ` ${seasonDisplay(row.season_id)}` : ""} — ${awardFormula(row.formula)}`;
      return `<span class="trophy-chip" title="${escapeAttr(tooltip)}">${escapeHtml(AWARD_ICONS[row.award_key] || "🎖️")} ${escapeHtml(label)}</span>`;
    });

  const chips = titleChips.concat(awardChips);
  shelf.hidden = !chips.length;
  shelf.innerHTML = chips.length
    ? `${chips.join("")}<span class="trophy-note">${escapeHtml(t(state.language, "awards.computedNote"))}</span>`
    : "";
}

function seasonShortDisplay(seasonId) {
  const match = String(seasonId || "").match(/season_0*(\d+)/);
  return match ? `S${match[1]}` : String(seasonId || "");
}

const HOF_CRITERIA_KEYS = ["champion", "seasons", "kills", "peak_elo", "win_pct"];

function renderHallOfFame() {
  const hallPanel = document.querySelector("#hof-hall");
  const spoonPanel = document.querySelector("#hof-spoon");
  if (!hallPanel || !spoonPanel) return;
  hallPanel.hidden = state.hofTab !== "hall";
  spoonPanel.hidden = state.hofTab !== "spoon";
  document.querySelectorAll("[data-hof-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.hofTab === state.hofTab);
  });

  if (state.hofTab === "hall") renderHofHall();
  else renderHofSpoon();
}

function renderHofHall() {
  const criteriaList = document.querySelector("#hof-criteria");
  const cardsHost = document.querySelector("#hof-cards");
  if (!criteriaList || !cardsHost) return;

  criteriaList.innerHTML = [`<strong>${escapeHtml(t(state.language, "hof.criteriaTitle"))}</strong>`]
    .concat(
      HOF_CRITERIA_KEYS.map(
        (key) =>
          `<li><span class="award-legend-icon">${escapeHtml(hofCriterionIcon(key))}</span> ${escapeHtml(t(state.language, `hof.criteria.${key}`))}</li>`,
      ),
    )
    .concat([`<li><span class="award-legend-icon">🏆</span> ${escapeHtml(t(state.language, "hof.legendTitles"))}</li>`])
    .join("");

  const chronology = cachedEloChronology();
  const peaks = new Map();
  for (const [key, person] of chronology.perPerson) {
    if (Number.isFinite(person.peak.rating)) peaks.set(personComparableKey(key), Math.round(person.peak.rating));
  }

  const inductees = hofInductees(
    {
      personAllTime: state.data.personAllTime ?? [],
      champions: state.data.champions ?? [],
      killlists: state.data.killlists ?? [],
      peaks,
    },
    normalizedKey,
  );

  cardsHost.innerHTML = inductees.length
    ? inductees.map((entry) => hofCard(entry)).join("")
    : `<p class="empty">${escapeHtml(t(state.language, "hof.empty"))}</p>`;
}

function hofCard(entry) {
  const stats = entry.stats;
  const record = `${stats.wins ?? 0}-${stats.losses ?? 0}-${stats.draws ?? 0}`;
  const statLine = [
    `${t(state.language, "columns.seasons")}: ${stats.seasons ?? ""}`,
    `${record} (${stats.win_pct ?? ""})`,
    entry.peak !== null ? `${t(state.language, "personDetails.eloPeak")} ${entry.peak}` : "",
    `${t(state.language, "columns.kills")}: ${stats.kills ?? ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `
    <article class="hof-card">
      <h3>${entry.signaturePokemon ? pokemonIcon(entry.signaturePokemon, entry.signaturePokemon) : ""}${personLink(entry.personId, entry.name)}</h3>
      <div class="hof-badges">
        ${entry.criteria.map((key) => `<span class="trophy-chip" title="${escapeAttr(t(state.language, `hof.criteria.${key}`))}">${escapeHtml(hofCriterionIcon(key))}</span>`).join("")}
        ${numberValue(stats.seasons_won) > 0 ? `<span class="trophy-chip is-title">🏆 ×${escapeHtml(String(stats.seasons_won))}</span>` : ""}
      </div>
      <p class="hof-stats">${escapeHtml(statLine)}</p>
    </article>
  `;
}

function hofCriterionIcon(key) {
  return { champion: "🏆", seasons: "📅", kills: "⚔️", peak_elo: "📈", win_pct: "🎯" }[key] || "⭐";
}

function renderHofSpoon() {
  const summary = document.querySelector("#spoon-summary");
  const redemption = document.querySelector("#spoon-redemption");
  if (!summary || !redemption) return;

  const spoons = spoonRows(state.data.awards ?? []);
  const counts = new Map();
  for (const row of spoons) {
    const key = row.person_id || normalizedKey(row.person_name);
    if (!counts.has(key)) counts.set(key, { name: row.person_name, key, count: 0 });
    counts.get(key).count += 1;
  }
  const topCollectors = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 4);
  summary.innerHTML = topCollectors
    .map((entry) => metricCard(`🥄 ${entry.name}`, entry.count, t(state.language, "hof.spoonCounts")))
    .join("");

  const arcs = (state.data.awards ?? []).filter((row) => row.award_key === "holzloeffel_redemption");
  redemption.innerHTML = arcs.length
    ? `<strong>${escapeHtml(t(state.language, "hof.redemptionTitle"))}</strong> ` +
      arcs
        .map((row) =>
          t(state.language, "hof.redemptionLine")
            .replace("{value}", row.value)
            .replace("{name}", `<!--name-->`)
            .replace("<!--name-->", personLink(row.person_id || normalizedKey(row.person_name), row.person_name)),
        )
        .join(" · ")
    : "";

  renderTable(
    "#spoon-table",
    spoons.map((row) => ({
      _season_order: seasonOrder(row.season_id),
      season: seasonLink(row.season_id),
      award: `🥄 ${escapeHtml(awardName(row.award_key))}`,
      division: row.division,
      person: personLink(row.person_id || normalizedKey(row.person_name), row.person_name),
      value: row.value,
      formula: escapeHtml(awardFormula(row.formula)),
      source: sourceCell(row.source_urls),
    })),
    AWARD_COLUMNS,
    ["season", "award", "person", "formula", "source"],
    { filename: "gpl-holzloeffel.csv" },
  );
}

// The Zeitreise spans every season by design, so it reads the unfiltered data
// rather than going through filtered(): the toolbar is hidden for this view.
function renderZeitreiseView() {
  renderZeitreise({
    matches: state.data.matches ?? [],
    standings: state.data.standings ?? [],
    champions: state.data.champions ?? [],
    killlists: state.data.killlists ?? [],
    highlights: state.data.matchHighlights ?? [],
    translate: (key) => t(state.language, key),
    pokemonIcon,
  });
}

function renderCinema() {
  const screen = document.querySelector("#cinema-screen");
  const list = document.querySelector("#cinema-list");
  if (!screen || !list) return;

  const rows = cinemaRows();
  const selectedIndex = Math.max(0, rows.findIndex((row) => cinemaVideoKey(row) === state.cinema.selectedKey));
  const selected = rows[selectedIndex] || rows[0];
  if (!rows.length || !selected) {
    screen.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "cinema.empty"))}</p>`;
    list.innerHTML = "";
    return;
  }

  const selectedKey = cinemaVideoKey(selected);
  state.cinema.selectedKey = selectedKey;
  screen.innerHTML = cinemaScreen(selected, rows.length, selectedIndex);
  list.innerHTML = rows.map((row, index) => cinemaCard(row, index + 1, cinemaVideoKey(row) === selectedKey)).join("");
}

function stepCinemaVideo(offset) {
  const rows = cinemaRows();
  const nextKey = cinemaAdjacentVideoKey(rows, state.cinema.selectedKey, offset);
  if (!nextKey || nextKey === state.cinema.selectedKey) return;
  state.cinema.selectedKey = nextKey;
  renderCinema();
  document.querySelector("#cinema-screen")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function pickRandomCinemaVideo() {
  const rows = cinemaRows();
  if (!rows.length) {
    state.cinema.selectedKey = "";
    renderCinema();
    return;
  }
  const current = state.cinema.selectedKey;
  let index = Math.floor(Math.random() * rows.length);
  if (rows.length > 1 && cinemaVideoKey(rows[index]) === current) {
    index = (index + 1) % rows.length;
  }
  state.cinema.selectedKey = cinemaVideoKey(rows[index]);
  renderCinema();
}

function cinemaScreen(row, total, selectedIndex = 0) {
  const videoId = cinemaVideoId(row);
  const embed = videoId
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(videoId)}" srcdoc="${escapeAttr(cinemaEmbedSrcdoc(row, videoId))}" title="${escapeAttr(row.title || row.match_label || t(state.language, "values.video"))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
    : `<div class="cinema-player-empty">${escapeHtml(t(state.language, "highlightMatches.card.noVideo"))}</div>`;
  return `
    <article class="cinema-player-card">
      <div class="cinema-player">
        ${embed}
        <div class="cinema-playback-controls" aria-label="${escapeAttr(t(state.language, "cinema.playbackControls"))}">
          <button class="cinema-nav-button cinema-nav-button--previous" type="button" data-cinema-step="-1" aria-label="${escapeAttr(t(state.language, "cinema.previousVideo"))}" title="${escapeAttr(t(state.language, "cinema.previousVideo"))}" ${selectedIndex <= 0 ? "disabled" : ""}><span class="cinema-nav-icon" aria-hidden="true">&larr;</span></button>
          <button class="cinema-nav-button cinema-nav-button--next" type="button" data-cinema-step="1" aria-label="${escapeAttr(t(state.language, "cinema.nextVideo"))}" title="${escapeAttr(t(state.language, "cinema.nextVideo"))}" ${selectedIndex >= total - 1 ? "disabled" : ""}><span class="cinema-nav-icon" aria-hidden="true">&rarr;</span></button>
        </div>
      </div>
      <div class="cinema-player-info">
        <span>${escapeHtml(t(state.language, "cinema.nowPlaying"))} · ${escapeHtml(String(total))} ${escapeHtml(t(state.language, "summary.videos"))}</span>
        <h3>${cinemaMatchTitle(row)}</h3>
        <p>${escapeHtml(row.title || "")}</p>
        <div class="cinema-meta-row">
          ${cinemaMetaItems(row)
            .map((item) => `<span>${escapeHtml(item.label)}<strong>${escapeHtml(item.value)}</strong></span>`)
            .join("")}
        </div>
        <div class="cinema-actions">
          ${row.video_url ? `<a class="header-button" href="${escapeAttr(row.video_url)}" target="_blank" rel="noreferrer">${escapeHtml(t(state.language, "cinema.watchOnYoutube"))}</a>` : ""}
          ${sourceLinks(row.source_urls)}
        </div>
      </div>
    </article>
  `;
}

function cinemaCard(row, rank, active = false) {
  const thumbnail = cinemaThumbnail(row);
  return `
    <article class="cinema-card ${active ? "is-active" : ""}">
      <button type="button" data-cinema-video-key="${escapeAttr(cinemaVideoKey(row))}" aria-pressed="${active ? "true" : "false"}">
        <span class="cinema-card-rank">#${escapeHtml(String(rank))}</span>
        <img src="${escapeAttr(thumbnail)}" alt="" loading="lazy" />
        <span class="cinema-card-body">
          <span class="cinema-card-meta">${escapeHtml(cinemaCardMeta(row))}</span>
          <strong>${escapeHtml(cinemaPlainMatchTitle(row))}</strong>
          <span>${escapeHtml(row.title || "")}</span>
        </span>
        <span class="cinema-card-stats">
          <span>${escapeHtml(t(state.language, "highlightMatches.card.views"))}<strong>${escapeHtml(displayNumber(row.view_count) || "0")}</strong></span>
          <span>${escapeHtml(t(state.language, "highlightMatches.card.perspective"))}<strong>${escapeHtml(row.perspective_person || row.channel_title || "")}</strong></span>
        </span>
      </button>
    </article>
  `;
}

function cinemaMetaItems(row) {
  return [
    { label: t(state.language, "columns.season"), value: seasonDisplay(row.season_id) },
    { label: t(state.language, "columns.stage"), value: cinemaStageDisplay(row.stage_group) },
    { label: t(state.language, "columns.week"), value: row.week || "" },
    { label: t(state.language, "columns.video_type"), value: cinemaVideoTypeDisplay(row.video_type) },
    { label: t(state.language, "highlightMatches.card.views"), value: displayNumber(row.view_count) || "0" },
  ].filter((item) => item.value);
}

function cinemaCardMeta(row) {
  return [
    seasonDisplay(row.season_id),
    cinemaStageDisplay(row.stage_group),
    row.week,
    cinemaVideoTypeDisplay(row.video_type),
  ]
    .filter(Boolean)
    .join(" · ");
}

function cinemaMatchTitle(row) {
  const playerA = row.player_a || "";
  const playerB = row.player_b || "";
  if (playerA && playerB) {
    return `${personLink(personIdForName(playerA), playerA)} <span class="highlight-vs">vs</span> ${personLink(personIdForName(playerB), playerB)}`;
  }
  if (row.perspective_person && row.opponent) {
    return `${personLink(personIdForName(row.perspective_person), row.perspective_person)} <span class="highlight-vs">vs</span> ${personLink(personIdForName(row.opponent), row.opponent)}`;
  }
  return escapeHtml(row.match_label || row.title || row.video_id || t(state.language, "values.video"));
}

function cinemaPlainMatchTitle(row) {
  if (row.player_a && row.player_b) return `${row.player_a} vs ${row.player_b}`;
  if (row.perspective_person && row.opponent) return `${row.perspective_person} vs ${row.opponent}`;
  return row.match_label || row.title || row.video_id || t(state.language, "values.video");
}

function cinemaVideoKey(row) {
  return [row.match_id, row.video_id || row.video_url, row.title].filter(Boolean).join("::");
}

function cinemaVideoId(row) {
  return row.video_id || youtubeVideoIdFromUrl(row.video_url || sourceFirstUrl(row.source_urls));
}

function cinemaThumbnail(row) {
  const videoId = cinemaVideoId(row);
  return videoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`
    : "./assets/GPL_Season_10_Logo.png";
}

function cinemaEmbedSrcdoc(row, videoId) {
  const title = escapeHtml(row.title || row.match_label || t(state.language, "values.video"));
  const thumbnail = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
  return `
    <style>
      *{box-sizing:border-box}body{margin:0;background:#020407;font-family:Inter,Arial,sans-serif}
      a{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden;color:white;text-decoration:none}
      img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(1.08)}
      span{position:relative;display:grid;width:76px;height:76px;place-items:center;border-radius:999px;background:#f20d17;box-shadow:0 12px 30px rgb(0 0 0 / 34%)}
      span:before{content:"";margin-left:5px;border-top:16px solid transparent;border-bottom:16px solid transparent;border-left:24px solid white}
      strong{position:absolute;left:18px;right:18px;bottom:16px;text-shadow:0 3px 16px #000;font-size:18px;text-align:left}
    </style>
    <a href="${embedUrl}" aria-label="${title}">
      <img src="${thumbnail}" alt="">
      <span></span>
      <strong>${title}</strong>
    </a>
  `;
}

function cinemaVideoTypeDisplay(videoType) {
  if (videoType === "livestream") return t(state.language, "videoTypes.livestream");
  return videoTypeDisplay(videoType);
}

function cinemaStageDisplay(stageGroup) {
  if (stageGroup === "regular") return t(state.language, "cinema.regularStage");
  if (stageGroup === "playoffs") return t(state.language, "cinema.playoffStage");
  return t(state.language, "cinema.otherStage");
}

function legacyMatchHighlightCard(row) {
  const reasons = String(row.highlight_reasons || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const meta = [
    row.week,
    divisionDisplay(row.division, row.stage),
    row.video_count ? `${row.video_count} ${t(state.language, "summary.videos")}` : "",
  ].filter(Boolean);
  return `
    <article class="highlight-card">
      <div class="highlight-card-head">
        <span>${escapeHtml(seasonDisplay(row.season_id))}${meta.length ? ` · ${escapeHtml(meta.join(" · "))}` : ""}</span>
        <strong>${escapeHtml(displayNumber(row.highlight_score))}</strong>
      </div>
      <h3 class="highlight-match-title">${row.player_a ? personLink(normalizedKey(row.player_a), row.player_a) : ""}<span class="highlight-vs">vs</span>${row.player_b ? personLink(normalizedKey(row.player_b), row.player_b) : ""}</h3>
      ${youtubeThumbnailPreviews(highlightPreviewUrls(row))}
      <div class="highlight-card-stats">
        <span>${escapeHtml(t(state.language, "highlightMatches.card.views"))}<strong>${escapeHtml(displayNumber(row.view_peak))}</strong></span>
        <span>${escapeHtml(t(state.language, "highlightMatches.card.trend"))}<strong>${escapeHtml(row.view_trend_multiplier_match ? `${displayNumber(row.view_trend_multiplier_match)}x` : "")}</strong></span>
        <span>${escapeHtml(t(state.language, "highlightMatches.card.engagement"))}<strong>${escapeHtml(row.engagement_multiplier_peak ? `${displayNumber(row.engagement_multiplier_peak)}x` : "")}</strong></span>
        <span>${escapeHtml(t(state.language, "highlightMatches.card.perspective"))}<strong>${escapeHtml(row.peak_perspective || "")}</strong></span>
      </div>
      ${reasons.length ? `<div class="highlight-badges">${reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}</div>` : ""}
      <div class="highlight-card-links">${sourceLinks(row.video_urls)}</div>
    </article>
  `;
}

function ratioPercentDisplay(value) {
  const numeric = numberValue(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return `${displayNumber(numeric * 100)}%`;
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
      view_count: displayNumber(row.view_count),
      like_count: displayNumber(row.like_count),
      comment_count: displayNumber(row.comment_count),
      duration_seconds: displayNumber(row.duration_seconds),
      views_baseline_median: displayNumber(row.views_baseline_median),
      views_multiplier: row.views_multiplier ? `${displayNumber(row.views_multiplier)}x` : "",
      views_percentile: ratioPercentDisplay(row.views_percentile),
      views_z_score: displayNumber(row.views_z_score),
      video_highlight_reasons: row.video_highlight_reasons,
      views_week_factor: row.views_week_factor ? `${displayNumber(row.views_week_factor)}x` : "",
      views_expected: displayNumber(row.views_expected),
      views_trend_multiplier: row.views_trend_multiplier ? `${displayNumber(row.views_trend_multiplier)}x` : "",
      views_trend_percentile: ratioPercentDisplay(row.views_trend_percentile),
      views_trend_z_score: displayNumber(row.views_trend_z_score),
      views_trend_highlight_reasons: row.views_trend_highlight_reasons,
      stats_fetched_at: row.stats_fetched_at,
      published_at: row.published_at,
    }));
  renderTable(
    "#video-archive-table",
    rows,
    VIDEO_ARCHIVE_COLUMNS,
    ["title"],
    {
      filename: "gpl-video-archive.csv",
      extraActions: [{ label: t(state.language, "actions.videoUrls"), onClick: downloadAllVideoUrls }],
      stickyColumn: "title",
    },
  );
}

function filteredVideoRows(rows) {
  return rows.filter((row) => {
    const dataModeOk = applyDataMode(row);
    const seasonOk = state.season === "all" || row.detected_season_id === state.season || row.season_id === state.season;
    const divisionOk = divisionMatches(row, state.division);
    const searchOk = rowMatchesSearch(row);
    return dataModeOk && seasonOk && divisionOk && searchOk;
  });
}

function renderDataCoverage() {
  const rows = qualityRowsFromData(state.data)
    .filter((row) => state.season === "all" || row.season_id === state.season)
    .filter((row) => rowMatchesSearch(row))
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
      killlist_coverage: killlistCoverageDisplay(row.killlist_kill_coverage),
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
    ["season", "status", "quality_score", "tables_score", "matches_score", "killlists_score", "videos_score", "priority_gaps", "standings", "matches", "playoff_matches", "champions", "killlists", "killlist_coverage", "missing_appearances", "unavailable_killlists", "videos", "matched_videos", "unmatched_game_videos", "low_confidence_videos", "missing_data", "review_flags", "source"],
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
    .filter((row) => rowMatchesSearch(row))
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

function renderDataGaps() {
  const summaryTarget = document.querySelector("#data-gap-summary");
  if (!summaryTarget) return;

  const rosterRows = rosterGapRows();
  const appearanceRows = appearanceGapRows();
  const missingKilllistGapRows = missingKilllistRows();
  const unmatchedVideos = videoReviewRows("unmatched");
  const lowConfidenceVideos = videoReviewRows("low_confidence");
  const matchCoverageRows = matchVideoCoverageRows();
  const matchesWithoutVideos = matchCoverageRows.filter((row) => row.video_count === 0);

  summaryTarget.innerHTML = [
    metricCard(t(state.language, "columns.roster_gaps"), rosterRows.length),
    metricCard(t(state.language, "columns.missing_appearances"), appearanceRows.length),
    metricCard(t(state.language, "columns.unavailable_killlists"), missingKilllistGapRows.length),
    metricCard(t(state.language, "columns.unmatched_game_videos"), unmatchedVideos.length),
    metricCard(t(state.language, "columns.low_confidence_videos"), lowConfidenceVideos.length),
    metricCard(t(state.language, "columns.matches_without_videos"), matchesWithoutVideos.length),
  ].join("");

  const seasonRows = qualityRowsFromData(state.data)
    .filter((row) => state.season === "all" || row.season_id === state.season)
    .filter((row) => rowMatchesSearch(row))
    .map((row) => ({
      season: seasonLink(row.season_id),
      status: coverageStatusDisplay(row.coverage_status),
      quality_score: row.quality_score ?? "",
      priority_gaps: priorityGapsDisplay(row.priority_gaps || row.review_flags || row.missing_categories),
      missing_appearances: row.killlist_rows_missing_appearances ?? "",
      unavailable_killlists: row.unavailable_killlist_rows ?? "",
      unmatched_game_videos: row.unmatched_game_video_rows ?? "",
      low_confidence_videos: row.low_confidence_video_rows ?? "",
      matches_without_videos: matchesWithoutVideos.filter((match) => match.season_id === row.season_id).length,
      roster_gaps: rosterRows.filter((roster) => roster.season_id === row.season_id).length,
      source: sourceLinks(row.source_urls),
    }));
  renderTable(
    "#data-gap-season-table",
    seasonRows,
    ["season", "status", "quality_score", "priority_gaps", "roster_gaps", "missing_appearances", "unavailable_killlists", "unmatched_game_videos", "low_confidence_videos", "matches_without_videos", "source"],
    ["season", "source"],
    { filename: "gpl-data-gaps-by-season.csv" },
  );

  const queueRows = (state.data.reviewIndex ?? [])
    .filter((row) => rowMatchesSearch(row))
    .map((row) => ({
      review_file: row.review_file,
      row_count: row.row_count,
      severity: severityDisplay(row.severity),
      review_reason: reviewReasonDisplay(row.review_reason),
      correction_file: row.correction_file,
      suggested_action: row.suggested_action,
      description: row.description,
    }));
  renderTable(
    "#data-gap-queue-table",
    queueRows,
    ["review_file", "row_count", "severity", "review_reason", "correction_file", "suggested_action", "description"],
    false,
    { filename: "gpl-review-queues.csv" },
  );
}

function renderRosterGaps() {
  const summaryTarget = document.querySelector("#roster-gap-summary");
  if (!summaryTarget) return;

  const rows = rosterGapRows();
  summaryTarget.innerHTML = [
    metricCard(t(state.language, "columns.roster_gaps"), rows.length),
    metricCard(t(state.language, "columns.incomplete_rosters"), rows.filter((row) => numberValue(row.missing_slots) > 0).length),
    metricCard(t(state.language, "columns.snapshot_rosters"), rows.filter((row) => String(row.roster_flags || "").toLowerCase().includes("snapshot")).length),
    metricCard(t(state.language, "columns.review_flags"), rows.filter((row) => String(row.roster_flags || "").trim()).length),
  ].join("");

  renderTable(
    "#roster-gap-table",
    rows.map((row) => ({
      ...row,
      season: seasonLink(row.season_id),
      division: divisionDisplay(row.division),
      roster_phase: rosterPhaseDisplay(row.roster_phase),
      person: row.person ? personLink(personIdForName(row.person), row.person) : "",
      team: rosterDetailLink(row.roster_group_key, row.team || t(state.language, "rosters.openDetail")),
      kill_rate: killRateDisplay(row),
      source: sourceCell(row.source_urls),
    })),
    ["season", "division", "roster_phase", "person", "team", "pokemon_count", "missing_slots", "appearances", "kills", "kill_rate", "confidence_score", "roster_flags", "source"],
    ["season", "person", "team", "source"],
    { filename: "gpl-roster-gaps.csv", hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );
}

function renderAppearanceGaps() {
  if (!document.querySelector("#appearance-gap-table")) return;

  renderTable(
    "#appearance-gap-table",
    appearanceGapRows().map((row) => ({
      season: seasonLink(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      stage: stageDisplay(row.stage),
      pokemon: pokemonCell(row.pokemon, normalizedKey(row.pokemon)),
      trainer: row.trainer ? personLink(personIdForName(row.trainer), row.trainer) : "",
      team: rosterLinkForContext(row, row.team_name),
      kills: row.kills,
      review_reason: reviewReasonDisplay(row.review_reason),
      source: sourceLinks(row.source_urls),
    })),
    ["season", "division", "stage", "pokemon", "trainer", "team", "kills", "review_reason", "source"],
    ["season", "pokemon", "trainer", "team", "source"],
    { filename: "gpl-missing-killlist-appearances.csv", hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );

  renderTable(
    "#missing-killlist-table",
    missingKilllistRows().map((row) => ({
      season: seasonLink(row.season_id),
      division: divisionDisplay(row.division),
      trainer: row.trainer ? personLink(personIdForName(row.trainer), row.trainer) : "",
      team: rosterLinkForContext(row, row.team_name),
      review_reason: reviewReasonDisplay(row.review_reason),
      source: sourceLinks(row.source_urls),
    })),
    ["season", "division", "trainer", "team", "review_reason", "source"],
    ["season", "trainer", "team", "source"],
    { filename: "gpl-missing-killlists.csv" },
  );
}

function renderVideoReview() {
  if (!document.querySelector("#unmatched-video-table")) return;

  renderTable(
    "#unmatched-video-table",
    videoReviewRows("unmatched").map(videoReviewTableRow),
    ["season", "video_type", "detected_week", "title", "channel", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "match_id", "source"],
    ["season", "title", "source"],
    {
      filename: "gpl-unmatched-game-videos.csv",
      extraActions: [{ label: t(state.language, "actions.videoUrls"), onClick: () => downloadVideoReviewUrls("unmatched") }],
    },
  );

  renderTable(
    "#low-confidence-video-table",
    videoReviewRows("low_confidence").map(videoReviewTableRow),
    ["season", "video_type", "detected_week", "title", "channel", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "match_id", "source"],
    ["season", "title", "source"],
    {
      filename: "gpl-low-confidence-videos.csv",
      extraActions: [{ label: t(state.language, "actions.videoUrls"), onClick: () => downloadVideoReviewUrls("low_confidence") }],
    },
  );
}

function renderMatchVideoCoverage() {
  const summaryTarget = document.querySelector("#match-video-summary");
  if (!summaryTarget) return;

  const rows = matchVideoCoverageRows();
  summaryTarget.innerHTML = [
    metricCard(t(state.language, "columns.matches"), rows.length),
    metricCard(t(state.language, "columns.both_perspectives"), rows.filter((row) => row.video_count >= 2).length),
    metricCard(t(state.language, "columns.single_perspective"), rows.filter((row) => row.video_count === 1).length),
    metricCard(t(state.language, "columns.matches_without_videos"), rows.filter((row) => row.video_count === 0).length),
  ].join("");

  renderTable(
    "#match-video-coverage-table",
    rows.map((row) => ({
      ...row,
      season: seasonLink(row.season_id),
      division: divisionDisplay(row.division, row.stage),
      stage: stageDisplay(row.stage),
      player_a: rosterParticipantLink(row, "a"),
      player_b: rosterParticipantLink(row, "b"),
      videos: videoLinksForMatch(row.match_id),
      source: sourceLinks(row.source_urls),
    })),
    ["season", "division", "stage", "week", "player_a", "player_b", "score", "winner", "video_count", "video_coverage", "missing_perspectives", "videos", "source"],
    ["season", "player_a", "player_b", "videos", "source"],
    { filename: "gpl-match-video-coverage.csv" },
  );
}

function rosterGapRows() {
  return rosterDisplayGroups()
    .overviewRows.filter((row) => rosterNeedsReview(row))
    .map((row) => ({
      ...row,
      missing_slots: Math.max(0, 11 - numberValue(row.pokemon_count)),
    }))
    .sort(
      (a, b) =>
        seasonOrder(a.season_id) - seasonOrder(b.season_id) ||
        numberValue(b.missing_slots) - numberValue(a.missing_slots) ||
        numberValue(a.confidence_score) - numberValue(b.confidence_score) ||
        String(a.person || a.team).localeCompare(String(b.person || b.team)),
    );
}

function rosterNeedsReview(row) {
  if (numberValue(row.pokemon_count) < 11) return true;
  const flags = normalizedKey(row.roster_flags);
  return [
    "unter 11",
    "snapshot",
    "teamgrafik",
    "unvollstandig",
    "unvollstaendig",
    "nicht strukturiert",
  ].some((needle) => flags.includes(normalizedKey(needle)));
}

function appearanceGapRows() {
  return scopedReviewRows(state.data.missingKilllistAppearances ?? [])
    .sort(
      (a, b) =>
        seasonOrder(a.season_id) - seasonOrder(b.season_id) ||
        divisionPriority(a.division) - divisionPriority(b.division) ||
        numberValue(b.kills) - numberValue(a.kills) ||
        String(a.pokemon || "").localeCompare(String(b.pokemon || "")),
    );
}

function missingKilllistRows() {
  return scopedReviewRows(state.data.missingKilllists ?? [])
    .sort(
      (a, b) =>
        seasonOrder(a.season_id) - seasonOrder(b.season_id) ||
        divisionPriority(a.division) - divisionPriority(b.division) ||
        String(a.trainer || "").localeCompare(String(b.trainer || "")),
    );
}

function scopedReviewRows(rows = []) {
  return rows.filter((row) => {
    const seasonId = reviewSeasonId(row);
    const dataModeOk = applyDataMode(row);
    const seasonOk = state.season === "all" || seasonId === state.season;
    const divisionOk = divisionMatches(row, state.division);
    const searchOk = rowMatchesSearch(row);
    return dataModeOk && seasonOk && divisionOk && searchOk;
  });
}

function reviewSeasonId(row) {
  return row.season_id || row.detected_season_id || "";
}

function videoReviewRows(kind) {
  const rows = [];
  if (kind === "unmatched") {
    rows.push(...(state.data.ambiguousMatches ?? []));
    rows.push(
      ...(state.data.videos ?? []).filter((row) => row.video_type === "game" && row.match_status === "unmatched"),
    );
  } else {
    rows.push(...(state.data.lowConfidenceVideos ?? []));
    rows.push(
      ...(state.data.videos ?? []).filter((row) => row.match_status === "matched" && ["low", "medium"].includes(row.confidence_tier)),
    );
  }
  return dedupeVideoReviewRows(rows)
    .filter((row) => {
      const seasonId = reviewSeasonId(row);
      const dataModeOk = applyDataMode(row);
      const seasonOk = state.season === "all" || seasonId === state.season;
      const divisionOk = divisionMatches(row, state.division);
      const searchOk = rowMatchesSearch(row);
      return dataModeOk && seasonOk && divisionOk && searchOk;
    })
    .sort(compareVideoRows);
}

function dedupeVideoReviewRows(rows = []) {
  const byVideo = new Map();
  rows.forEach((row) => {
    const key = row.video_id || row.video_url || row.title;
    if (!key) return;
    const current = byVideo.get(key);
    if (!current) {
      byVideo.set(key, { ...row });
      return;
    }
    byVideo.set(key, preferRicherVideoRow(current, row));
  });
  return [...byVideo.values()];
}

function preferRicherVideoRow(left, right) {
  const score = (row) =>
    ["channel_title", "best_match_id", "match_id", "confidence", "confidence_tier", "confidence_explanation", "source_urls"]
      .filter((field) => row[field])
      .length;
  return mergeVideoReviewRows(score(right) > score(left) ? left : right, score(right) > score(left) ? right : left);
}

function mergeVideoReviewRows(base, overlay) {
  const merged = { ...base };
  Object.entries(overlay).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  });
  return merged;
}

function videoReviewTableRow(row) {
  const url = row.video_url || sourceFirstUrl(row.source_urls);
  const title = row.title || row.video_title || row.video_id || t(state.language, "values.video");
  return {
    season: seasonLink(reviewSeasonId(row)),
    video_type: videoTypeDisplay(row.video_type),
    detected_week: row.detected_week,
    title: url
      ? `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>`
      : escapeHtml(title),
    channel: row.channel_title || "",
    match_status: matchStatusDisplay(row.match_status),
    confidence: row.confidence,
    confidence_tier: confidenceTierDisplay(row.confidence_tier),
    match_basis: row.match_basis,
    confidence_explanation: row.confidence_explanation,
    match_id: row.best_match_id || row.match_id || "",
    source: sourceLinks(row.source_urls || row.video_url),
  };
}

function sourceFirstUrl(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("http")) || "";
}

function downloadVideoReviewUrls(kind) {
  const urls = videoReviewRows(kind)
    .map((row) => row.video_url || sourceFirstUrl(row.source_urls))
    .filter(Boolean);
  downloadText(`gpl-${kind.replaceAll("_", "-")}-video-urls.txt`, `${[...new Set(urls)].join("\n")}\n`, "text/plain;charset=utf-8");
}

function matchVideoCoverageRows() {
  const videosByMatch = groupRows(state.data.matchVideos ?? [], (row) => row.match_id || "");
  return (state.data.matches ?? [])
    .filter((row) => {
      if (["source_video_only", "not_available"].includes(row.data_status)) return false;
      if (!(row.player_a || row.player_b || row.team_a || row.team_b)) return false;
      const dataModeOk = applyDataMode(row);
      const seasonOk = state.season === "all" || row.season_id === state.season;
      const divisionOk = divisionMatches(row, state.division);
      const videos = videosByMatch.get(row.match_id) ?? [];
      const searchText = [Object.values(row).join(" "), ...videos.map((video) => Object.values(video).join(" "))].join(" ").toLowerCase();
      const searchOk = textMatchesSearch(searchText);
      return dataModeOk && seasonOk && divisionOk && searchOk;
    })
    .sort(compareMatches)
    .map((row) => {
      const videos = videosByMatch.get(row.match_id) ?? [];
      const missingPerspectives = missingMatchVideoPerspectives(row, videos);
      return {
        ...row,
        video_count: videos.length,
        video_coverage: matchVideoCoverageStatus(videos.length, missingPerspectives),
        missing_perspectives: missingPerspectives.join(", "),
        source_urls: joinSourceValues(row.source_urls, ...videos.map((video) => video.source_urls || video.video_url)),
      };
    });
}

function missingMatchVideoPerspectives(matchRow, videos = []) {
  const participants = [matchRow.player_a || matchRow.team_a, matchRow.player_b || matchRow.team_b].filter(Boolean);
  if (!participants.length) return [];
  const perspectives = new Set(videos.map((row) => normalizedKey(row.perspective_person || row.channel_title)).filter(Boolean));
  if (!perspectives.size) return participants;
  return participants.filter((participant) => !perspectives.has(normalizedKey(participant)));
}

function matchVideoCoverageStatus(videoCount, missingPerspectives = []) {
  if (!videoCount) return t(state.language, "matchVideoCoverage.none");
  if (videoCount === 1) return t(state.language, "matchVideoCoverage.single");
  if (missingPerspectives.length) return t(state.language, "matchVideoCoverage.review");
  return t(state.language, "matchVideoCoverage.both");
}

function joinSourceValues(...values) {
  const items = new Set();
  values.forEach((value) => {
    String(value ?? "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => items.add(item));
  });
  return [...items].join(";");
}

function renderReviewWorkflow() {
  const rows = reviewWorkflowRows(state.data)
    .filter((row) => state.season === "all" || row.season_id === state.season)
    .filter((row) => rowMatchesSearch(row))
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
    kill_rate: killRateDisplay(row),
    status: statusDisplay(row.data_status),
    source: sourceLinks(row.source_urls),
  }));
  renderTable(
    "#season-detail-killlists",
    killlists,
    ["division", "pokemon", "trainer", "team", "appearances", "kills", "kill_rate", "status", "source"],
    ["pokemon", "trainer", "team", "source"],
    { hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );

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
  return weekSortValue(value);
}

function videoTypePriority(value) {
  return {
    game: 1,
    showmatch: 2,
    teambuilding: 3,
    draft_analysis: 4,
    announcement: 5,
    update: 6,
    recap: 7,
    reaction: 8,
    tierlist: 9,
    other: 10,
  }[value] ?? 50;
}

function renderPersonDetails() {
  const focusKey = state.personFocus?.key;
  const focusedSections = [
    "#person-timeline-section",
    "#person-elo-ledger-section",
    "#person-season-section",
    "#person-pokemon-section",
    "#person-video-section",
    "#person-matchup-section",
  ];
  const allStatRows = filteredPersonStats();
  const allChampions = filtered(state.data.champions ?? []).filter((row) => ["source_evidenced", "user_provided"].includes(row.data_status));
  const statRows = allStatRows.filter((row) => !focusKey || rowPersonKey(row) === focusKey);
  const champions = allChampions.filter((row) => !focusKey || championPersonKey(row) === focusKey);

  renderPersonFocus();
  setDetailSections(focusedSections, Boolean(focusKey));
  renderPersonTrophies(focusKey);
  renderPersonEloChart(focusKey);
  renderPersonEloLedger(focusKey);

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
    pokemon: pokemonCell(row.pokemon),
    appearances: performanceDisplay(row, "appearances"),
    kills: performanceDisplay(row, "kills"),
    kill_rate: performanceDisplay(row, "appearances") ? killRateDisplay(row) : "",
    seasons: row.seasons,
    season_list: row.season_list,
    teams: row.teams,
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

  renderTable("#person-timeline-table", timelineRows, ["season", "division", "team", "record", "win_pct", "rating", "points", "kills", "deaths", "differential", "title", "source"], ["season", "team", "source"]);
  renderTable("#person-season-table", detailRows, PERSON_SEASON_COLUMNS, ["season", "team", "source"]);
  renderTable(
    "#person-pokemon-table",
    pokemonRows,
    ["pokemon", "appearances", "kills", "kill_rate", "seasons", "season_list", "teams", "source"],
    ["pokemon", "source"],
    { hintColumns: POKEMON_USAGE_HINT_COLUMNS },
  );
  renderTable("#person-video-table", personVideos, ["season", "video_type", "detected_week", "opponent", "title", "match_status", "confidence", "confidence_tier", "match_basis", "confidence_explanation", "published_at"], ["title"]);
  renderTable("#person-matchup-table", matchupRows, MATCHUP_COLUMNS, ["opponent"]);
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
    .filter((row) => rowMatchesSearch(row))
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

function htmlColumnSet(html) {
  if (html instanceof Set) {
    return new Set(html);
  }
  return new Set(html === true ? ["video"] : Array.isArray(html) ? html : []);
}

function tableHtmlColumns(columns, explicitHtmlColumns) {
  const htmlColumns = new Set(explicitHtmlColumns);
  columns.forEach((column) => {
    if (LINKABLE_SEASON_COLUMNS.has(column) || LINKABLE_PERSON_COLUMNS.has(column)) {
      htmlColumns.add(column);
    }
  });
  return htmlColumns;
}

function decorateTableRows(rows, columns, explicitHtmlColumns) {
  return rows.map((row) => {
    const decorated = { ...row };
    columns.forEach((column) => {
      const value = decorated[column];
      if (cellContainsHtml(value)) {
        return;
      }
      const linked = linkableTableCell(column, value);
      if (linked !== null) {
        decorated[column] = linked;
      }
    });
    return decorated;
  });
}

function linkableTableCell(column, value) {
  if (value === null || value === undefined || value === "") {
    return value ?? "";
  }
  if (LINKABLE_SEASON_COLUMNS.has(column)) {
    return linkedSeasonListCell(value);
  }
  if (LINKABLE_PERSON_COLUMNS.has(column)) {
    return linkedPersonListCell(value);
  }
  return null;
}

function linkedSeasonListCell(value) {
  return splitLinkList(value)
    .map((item) => {
      const seasonId = seasonIdFromLabel(item);
      return seasonId ? seasonLink(seasonId, item) : escapeHtml(item);
    })
    .join(", ");
}

function linkedPersonListCell(value) {
  return splitLinkList(value)
    .map((item) => {
      const personId = knownPersonIdForName(item);
      return personId ? personLink(personId, personDisplayName(item)) : escapeHtml(item);
    })
    .join(", ");
}

function splitLinkList(value) {
  return String(value ?? "")
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function seasonIdFromLabel(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^season_0*(\d+)$/i) || text.match(/^(?:s|saison|season)\s*0*(\d+)$/i);
  if (!match) {
    return "";
  }
  return `season_${String(Number(match[1])).padStart(3, "0")}`;
}

function knownPersonIdForName(name) {
  const personId = personIdForName(name);
  return (state.data.people ?? []).some((person) => person.person_id === personId) ? personId : "";
}

function cellContainsHtml(value) {
  return String(value ?? "").includes("<");
}

function renderTable(selector, rows, columns, html = false, options = {}) {
  const target = document.querySelector(selector);
  destroyTable(selector);
  target.classList.remove("has-horizontal-overflow", "has-horizontal-scroll", "is-short-table");
  if (!rows.length) {
    target.innerHTML = `<p class="empty">${escapeHtml(t(state.language, "empty.table"))}</p>`;
    return;
  }
  const extraActions = options.extraActions ?? [];
  const visibleColumns = columnsForProfile(columns, state.columnProfile);
  const explicitHtmlColumns = htmlColumnSet(html);
  const displayRows = decorateTableRows(rows, visibleColumns, explicitHtmlColumns);
  const htmlColumns = tableHtmlColumns(visibleColumns, explicitHtmlColumns);
  const hintColumns = options.hintColumns ? new Set(options.hintColumns) : null;
  target.dataset.columnProfile = state.columnProfile;
  target.classList.toggle("is-short-table", rows.length <= 25);
  target.innerHTML = `
    <div class="table-actions">
      <div class="table-action-group">
        <button class="table-action" type="button" data-table-export>${escapeHtml(t(state.language, "actions.exportCsv"))}</button>
        ${extraActions.map((action, index) => `<button class="table-action" type="button" data-extra-action="${index}">${escapeHtml(action.label)}</button>`).join("")}
      </div>
      <div class="table-scroll-hint" data-table-scroll-hint hidden>
        <span class="table-scroll-label">${escapeHtml(t(state.language, "tableUx.moreColumns"))}</span>
        <div class="table-scroll-controls" aria-label="${escapeAttr(t(state.language, "tableUx.moreColumns"))}">
          <button class="table-action table-scroll-button" type="button" data-table-scroll-left>${escapeHtml(t(state.language, "tableUx.scrollLeft"))}</button>
          <button class="table-action table-scroll-button" type="button" data-table-scroll-right>${escapeHtml(t(state.language, "tableUx.scrollRight"))}</button>
        </div>
      </div>
    </div>
    <div class="table-host"></div>
  `;
  const host = target.querySelector(".table-host");
  target.querySelector("[data-table-export]").addEventListener("click", () => {
    downloadRowsAsCsv(options.filename || filenameForSelector(selector), displayRows, visibleColumns);
  });
  target.querySelectorAll("[data-extra-action]").forEach((button) => {
    const action = extraActions[Number(button.dataset.extraAction)];
    button.addEventListener("click", () => action.onClick?.());
  });

  if (!window.Tabulator) {
    host.classList.add("is-native-table");
    host.innerHTML = tableHtml(displayRows, visibleColumns, htmlColumns, hintColumns);
    wireTableScrollAid(selector, target, host);
    return;
  }

  const stickyIdentity = stickyIdentityColumn(visibleColumns, options.stickyColumn);
  const tabulatorColumns = buildTabulatorColumns(visibleColumns, htmlColumns, displayRows, stickyIdentity, hintColumns);
  appendHiddenSortColumns(tabulatorColumns, displayRows);
  const tableMount = document.createElement("div");
  tableMount.className = "table-tabulator";
  host.replaceChildren(tableMount);
  const tableOptions = {
    data: displayRows,
    columns: tabulatorColumns,
    layout: "fitDataStretch",
    locale: state.language,
    langs: TABULATOR_LANGS,
    movableColumns: false,
    pagination: "local",
    paginationSize: 25,
    paginationSizeSelector: [25, 50, 100, true],
    placeholder: t(state.language, "empty.table"),
    initialSort: initialSort(visibleColumns),
  };
  if (rows.length > 25) {
    tableOptions.height = "100%";
  }
  const table = new window.Tabulator(tableMount, tableOptions);
  tableInstances.set(selector, table);
  wireTableScrollAid(selector, target, host, table, stickyIdentity);
}

function destroyTable(selector) {
  const cleanup = tableCleanups.get(selector);
  if (cleanup) {
    cleanup();
    tableCleanups.delete(selector);
  }
  const table = tableInstances.get(selector);
  if (table) {
    table.destroy();
    tableInstances.delete(selector);
  }
}

function buildTabulatorColumns(columns, htmlColumns, rows = [], stickyIdentity = null, hintColumns = null) {
  return columns.map((column) => {
    const numeric = NUMERIC_COLUMNS.has(column);
    const sticky = column === stickyIdentity;
    const stickyWidth = stickyColumnWidth(column, stickyIdentity);
    const filterConfig = tableHeaderFilterConfig(column, rows, {
      allLabel: t(state.language, "filters.allValues"),
      placeholder: t(state.language, "filters.header"),
    });
    return {
      title: columnTitle(state.language, column),
      titleFormatter: () => columnHeaderHtml(column, hintColumns),
      headerTooltip: false,
      field: column,
      sorter: sorterFor(column),
      ...filterConfig,
      formatter: formatterFor(column, htmlColumns),
      hozAlign: numeric ? "right" : "left",
      headerHozAlign: numeric ? "right" : "left",
      minWidth: minWidthFor(column),
      ...(stickyWidth ? { width: stickyWidth, maxWidth: stickyWidth } : {}),
      resizable: false,
      cssClass: sticky ? "table-sticky-identity-cell" : "",
    };
  });
}

function stickyColumnWidth(column, stickyIdentity) {
  if (column !== stickyIdentity) {
    return null;
  }
  if (column === "title") {
    return responsiveStickyTitleWidth();
  }
  return null;
}

function responsiveStickyTitleWidth() {
  const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 1024;
  if (viewportWidth <= 720) {
    return Math.max(200, Math.min(240, Math.round(viewportWidth * 0.56)));
  }
  return 360;
}

function stickyIdentityColumn(columns, preferredColumn = "") {
  if (preferredColumn && columns.includes(preferredColumn)) {
    return preferredColumn;
  }
  const preferred = ["name", "person", "pokemon", "trainer", "team", "player_a", "opponent", "season", "week", "title", "review_file", "claim_subject"];
  return (
    preferred.find((column) => columns.includes(column)) ||
    columns.find((column) => !NUMERIC_COLUMNS.has(column) && !["source", "video", "videos"].includes(column)) ||
    columns[0] ||
    null
  );
}

function wireTableScrollAid(selector, target, host, table = null, stickyIdentity = null) {
  const hint = target.querySelector("[data-table-scroll-hint]");
  const scrollLeftButton = target.querySelector("[data-table-scroll-left]");
  const scrollRightButton = target.querySelector("[data-table-scroll-right]");
  if (!hint || !scrollLeftButton || !scrollRightButton) {
    return;
  }

  let scrollElement = null;
  let resizeObserver = null;
  let tableReady = false;
  const updateHint = () => {
    const scroller = tableScrollElement(host);
    if (!scroller) {
      return;
    }
    const hasOverflow = scroller.scrollWidth > scroller.clientWidth + 4;
    const canScrollLeft = hasOverflow && scroller.scrollLeft > 4;
    const canScrollRight = hasOverflow && scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4;
    target.classList.toggle("has-horizontal-scroll", hasOverflow);
    target.classList.toggle("has-horizontal-left", canScrollLeft);
    target.classList.toggle("has-horizontal-overflow", canScrollRight);
    hint.hidden = !hasOverflow;
    scrollLeftButton.disabled = !canScrollLeft;
    scrollRightButton.disabled = !canScrollRight;
    syncStickyIdentityColumn(host, stickyIdentity);
  };
  const onScroll = () => updateHint();
  const attachScrollElement = () => {
    const nextElement = tableScrollElement(host);
    if (nextElement && nextElement !== scrollElement) {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", onScroll);
      }
      scrollElement = nextElement;
      scrollElement.addEventListener("scroll", onScroll, { passive: true });
    }
    updateHint();
  };
  const scrollByDirection = (direction) => {
    const scroller = tableScrollElement(host);
    if (!scroller) {
      return;
    }
    scroller.scrollBy({
      left: direction * Math.max(240, scroller.clientWidth * 0.85),
      behavior: "smooth",
    });
  };
  const scrollLeft = () => scrollByDirection(-1);
  const scrollRight = () => scrollByDirection(1);

  scrollLeftButton.addEventListener("click", scrollLeft);
  scrollRightButton.addEventListener("click", scrollRight);
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      if (tableReady) {
        table?.redraw?.(true);
      }
      attachScrollElement();
    });
    resizeObserver.observe(host);
  }
  const onTableBuilt = () => {
    tableReady = true;
    attachScrollElement();
  };
  table?.on?.("tableBuilt", onTableBuilt);
  table?.on?.("renderComplete", updateHint);
  setTimeout(attachScrollElement, 0);

  tableCleanups.set(selector, () => {
    scrollLeftButton.removeEventListener("click", scrollLeft);
    scrollRightButton.removeEventListener("click", scrollRight);
    if (scrollElement) {
      scrollElement.removeEventListener("scroll", onScroll);
    }
    resizeObserver?.disconnect();
    table?.off?.("tableBuilt", onTableBuilt);
    table?.off?.("renderComplete", updateHint);
  });
}

function syncStickyIdentityColumn(host, stickyIdentity) {
  if (!stickyIdentity) {
    return;
  }
  host.querySelectorAll(".table-sticky-identity-header").forEach((header) => header.classList.remove("table-sticky-identity-header"));
  host.querySelectorAll(".tabulator-col").forEach((header) => {
    if (header.getAttribute("tabulator-field") === stickyIdentity) {
      header.classList.add("table-sticky-identity-header");
    }
  });
}

function tableScrollElement(host) {
  return host.querySelector(".tabulator-tableholder") || host;
}

function columnHint(column, hintColumns = null) {
  if (column === "kills" && !hintColumns?.has("kills")) {
    return "";
  }
  if (hintColumns && column !== "rating" && !hintColumns.has(column)) {
    return "";
  }
  const key = columnHintKey(column);
  const hint = t(state.language, key);
  return hint === key ? "" : hint;
}

function pokemonColumnHint(column) {
  return columnHint(column, POKEMON_USAGE_HINT_COLUMNS);
}

function columnHintKey(column) {
  if (column === "rating") {
    return "columnHints.rating";
  }
  return `columnHints.${column}`;
}

function columnHeaderHtml(column, hintColumns = null) {
  const title = columnTitle(state.language, column);
  const hint = columnHint(column, hintColumns);
  if (!hint) {
    return escapeHtml(title);
  }
  return `<span class="column-header-with-help">${escapeHtml(title)} ${columnHelpHtml(hint)}</span>`;
}

function columnHelpHtml(hint) {
  return `<span class="column-help" data-tooltip="${escapeAttr(hint)}" aria-label="${escapeAttr(hint)}" tabindex="0">i</span>`;
}

function bindColumnHelpTooltips() {
  document.addEventListener("pointerover", (event) => {
    const anchor = event.target.closest?.(".column-help[data-tooltip]");
    if (anchor) {
      showColumnHelpTooltip(anchor);
    }
  });
  document.addEventListener("pointerout", (event) => {
    const anchor = event.target.closest?.(".column-help[data-tooltip]");
    if (anchor && !anchor.contains(event.relatedTarget)) {
      hideColumnHelpTooltip(anchor);
    }
  });
  document.addEventListener("focusin", (event) => {
    const anchor = event.target.closest?.(".column-help[data-tooltip]");
    if (anchor) {
      showColumnHelpTooltip(anchor);
    }
  });
  document.addEventListener("focusout", (event) => {
    const anchor = event.target.closest?.(".column-help[data-tooltip]");
    if (anchor) {
      hideColumnHelpTooltip(anchor);
    }
  });
  window.addEventListener("scroll", () => hideColumnHelpTooltip(), true);
  window.addEventListener("resize", () => hideColumnHelpTooltip());
}

function showColumnHelpTooltip(anchor) {
  const text = anchor.dataset.tooltip || anchor.getAttribute("aria-label") || "";
  if (!text) return;
  const tooltip = document.querySelector("#column-help-tooltip") || document.createElement("div");
  tooltip.id = "column-help-tooltip";
  tooltip.className = "app-tooltip";
  tooltip.textContent = text;
  tooltip.hidden = false;
  if (!tooltip.parentElement) {
    document.body.appendChild(tooltip);
  }
  activeColumnHelpAnchor = anchor;
  positionColumnHelpTooltip(anchor, tooltip);
  tooltip.classList.add("is-visible");
}

function hideColumnHelpTooltip(anchor = null) {
  if (anchor && activeColumnHelpAnchor !== anchor) return;
  const tooltip = document.querySelector("#column-help-tooltip");
  if (!tooltip) return;
  tooltip.classList.remove("is-visible");
  tooltip.hidden = true;
  activeColumnHelpAnchor = null;
}

function positionColumnHelpTooltip(anchor, tooltip) {
  const margin = 12;
  const gap = 8;
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
  const preferredLeft = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
  const left = Math.max(margin, Math.min(preferredLeft, maxLeft));
  const belowTop = anchorRect.bottom + gap;
  const aboveTop = anchorRect.top - tooltipRect.height - gap;
  const top = belowTop + tooltipRect.height + margin <= window.innerHeight ? belowTop : Math.max(margin, aboveTop);
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
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
  return NUMERIC_COLUMNS.has(column) ? "number" : textSorter(column, state.language);
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
  "elo_pre_winner",
  "elo_pre_loser",
  "win_prob_winner",
  "elo_delta",
  "elo_after",
  "rating",
  "seasons",
  "divisions",
  "trainers",
  "teams",
  "matches",
  "standings",
  "killlists",
  "unavailable_killlists",
  "roster_gaps",
  "incomplete_rosters",
  "missing_slots",
  "estimated_deaths",
  "snapshot_rosters",
  "matched_videos",
  "matches_without_videos",
  "video_count",
  "view_count",
  "like_count",
  "comment_count",
  "duration_seconds",
  "views_baseline_median",
  "views_multiplier",
  "views_percentile",
  "views_z_score",
  "views_week_factor",
  "views_opponent_factor",
  "views_expected",
  "views_trend_multiplier",
  "views_trend_percentile",
  "views_trend_z_score",
  "highlight_score",
  "view_peak",
  "view_total",
  "view_median",
  "view_multiplier_peak",
  "views_percentile_peak",
  "views_z_score_peak",
  "view_expected_peak",
  "view_trend_multiplier_peak",
  "views_trend_percentile_peak",
  "views_trend_z_score_peak",
  "view_expected_total",
  "view_trend_multiplier_match",
  "views_trend_percentile_match",
  "views_trend_z_score_match",
  "views_total_percentile_match",
  "like_peak",
  "comment_peak",
  "engagement_rate_peak",
  "engagement_multiplier_peak",
  "engagement_percentile_peak",
  "engagement_z_score_peak",
  "both_perspectives",
  "single_perspective",
  "wins",
  "losses",
  "draws",
  "points",
  "best_rank",
  "appearances",
  "kills",
  "kill_rate",
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
  if (["name", "person", "team", "pokemon", "trainer", "player_a", "player_b", "winner", "video", "videos", "source", "title", "channel", "perspective_person", "opponent", "video_type", "missing_data", "notes", "match_basis", "confidence_explanation", "record", "top_pokemon", "roster_flags", "highlight_reasons", "video_highlight_reasons", "views_trend_highlight_reasons", "peak_perspective"].includes(column)) {
    return 170;
  }
  if (column === "status") {
    return 150;
  }
  return NUMERIC_COLUMNS.has(column) || column === "win_pct" ? 96 : 128;
}

function tableHtml(rows, columns, html = false, hintColumns = null) {
  const htmlColumns = htmlColumnSet(html);
  return `
    <table>
      <thead><tr>${columns.map((column) => {
        return `<th>${columnHeaderHtml(column, hintColumns)}</th>`;
      }).join("")}</tr></thead>
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
    dragoonofdoom: "dauni daunstar",
    "dragoon ofdoom": "dauni daunstar",
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
