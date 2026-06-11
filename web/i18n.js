const SUPPORTED_LANGUAGES = new Set(["de", "en"]);
const SUPPORTED_THEMES = new Set(["light", "dark"]);

export const DEFAULT_LANGUAGE = "de";
export const DEFAULT_THEME = "light";

export const TRANSLATIONS = {
  de: {
    app: {
      title: "GPL History Visualizer",
      subtitle: "Archiv der German Pokémon League.",
    },
    controls: {
      language: "English",
      themeLight: "Nachtmodus",
      themeDark: "Tagmodus",
    },
    status: {
      loading: "Lade CSV-Daten",
      loaded: "CSV-Daten geladen",
      failed: "CSV-Laden fehlgeschlagen",
    },
    actions: {
      exportCsv: "CSV exportieren",
      videoUrls: "Video-URL-Liste",
    },
    nav: {
      allTime: "Ewige Tabelle",
      killlists: "Pokémon-Killlisten",
      tableHistory: "Tabellenverlauf",
      matchPlan: "Spielplan",
      battleHistory: "Kampfverlauf",
      videoArchive: "Video-Archiv",
      personDetails: "Personendetails",
      matchup: "Matchup-Check",
    },
    filters: {
      season: "Saison",
      allSeasons: "Alle Saisons",
      division: "Liga/Bereich",
      allDivisions: "Alle Ligen/Bereiche",
      search: "Suche",
      searchPlaceholder: "Team, Trainer, Pokémon, Video",
      header: "Filtern",
    },
    summary: {
      archiveLabel: "Gefilterte Archiv-Zusammenfassung",
      seasons: "Saisons",
      people: "Personen",
      battles: "Kämpfe",
      winRate: "Siegquote",
      notAvailable: "n/v",
    },
    sections: {
      allTimeTitle: "Ewige Tabelle",
      allTimeDescription: "Aus personenspezifischen CSV-Stints aggregiert; Teamtabellen bleiben im Tabellenverlauf erhalten.",
      killlistsTitle: "Pokémon-Killlisten",
      killlistsDescription: "Summierte Pokémon-Kills über den aktuell gefilterten CSV-Datenbestand.",
      tableHistoryTitle: "Tabellenverlauf",
      tableHistoryDescription: "Tabellenstände je Saison mit Quellenlink pro Zeile.",
      matchPlanTitle: "Spielplan",
      matchPlanDescription: "Saisonbezogener Matchplan aus den vorhandenen CSV-Matchdaten.",
      battleHistoryTitle: "Kampfverlauf",
      battleHistoryDescription: "Kampfzeilen aus den normalisierten CSV-Daten, mit Videoquellen wenn vorhanden.",
      videoArchiveTitle: "Video-Archiv",
      videoArchiveDescription: "Öffentliche GPL-Videos aus Teilnehmerkanälen mit Best-effort-Zuordnung zu Spieltagen.",
      personDetailsTitle: "Personendetails",
      personDetailsDescription: "Personen, Teams, Stints und Titel über alle Saisons.",
      matchupTitle: "Matchup-Check",
      matchupDescription: "Vergleiche zwei Trainer oder Teams anhand verfügbarer Match-Zeilen.",
    },
    matchup: {
      firstName: "Erste Auswahl",
      secondName: "Zweite Auswahl",
      placeholder: "Trainer oder Team auswählen",
      check: "Prüfen",
      enterNames: "Wähle zwei Trainer oder Teams aus.",
      matches: "Matches",
      firstWins: "Siege 1",
      secondWins: "Siege 2",
      empty: "Keine belegten Matchup-Zeilen gefunden.",
    },
    personDetails: {
      focus: "Person",
      showAll: "Alle Personen",
      pokemonTitle: "Pokémon & Kills",
    },
    empty: {
      table: "Für diese Ansicht gibt es noch keine belegten Zeilen.",
      chooseSeason: "Wähle eine einzelne Saison aus, um den Spielplan zu sehen.",
      loadError: "Normalisierte CSV-Dateien konnten nicht geladen werden. Führe zuerst den Collector aus.",
    },
    divisions: {
      regularSeason: "Hauptrunde",
      leagueOne: "Liga 1",
      leagueTwo: "Liga 2",
      playoffs: "Playoffs",
      sunConference: "Sun Conference",
      moonConference: "Moon Conference",
      overall: "Gesamt",
      overallTagTeam: "Gesamt Tag Team",
      singles: "Singles",
      doubles: "Doubles",
      tagTeam: "Tag Team",
      videoSource: "Videoquelle",
    },
    stages: {
      regular_season: "Hauptrunde",
      playoffs: "Playoffs",
      video_source: "Videoquelle",
    },
    videoTypes: {
      game: "Kampf",
      teambuilding: "Teambuilding",
      draft_analysis: "Draftanalyse",
      announcement: "Ankündigung",
      update: "Update",
      reaction: "Reaction",
      recap: "Rückblick",
      tierlist: "Tierliste",
      other: "Sonstiges",
    },
    matchStatuses: {
      matched: "Zugeordnet",
      unmatched: "Nicht zugeordnet",
      teambuilding: "Teambuilding",
      draft_analysis: "Draftanalyse",
      announcement: "Ankündigung",
      update: "Update",
      reaction: "Reaction",
      recap: "Rückblick",
      tierlist: "Tierliste",
      other: "Sonstiges",
    },
    values: {
      unknown: "Unbekannt",
      video: "Video",
      source: "Quelle",
    },
    columns: {
      rank: "Rang",
      name: "Name",
      seasons_won: "Titel",
      rating: "Wertung",
      seasons: "Saisons",
      teams: "Teams",
      trainers: "Trainer",
      matches: "Matches",
      wins: "Siege",
      losses: "Niederlagen",
      draws: "Remis",
      win_pct: "Sieg %",
      points: "Punkte",
      best_rank: "Bester Rang",
      rows: "Zeilen",
      season: "Saison",
      season_id: "Saison",
      division: "Liga/Bereich",
      divisions: "Bereiche",
      pokemon: "Pokémon",
      trainer: "Trainer",
      team: "Team",
      kills: "Kills",
      deaths: "Deaths",
      differential: "Differenz",
      status: "Status",
      person: "Person",
      championships: "Titel",
      stage: "Phase",
      week: "Spieltag",
      start_week: "Ab ST",
      end_week: "Bis ST",
      player_a: "Spieler A",
      player_b: "Spieler B",
      opponent: "Gegner",
      winner: "Sieger",
      score: "Score",
      video: "Video",
      videos: "Videos",
      channel: "Kanal",
      title: "Titel",
      video_type: "Kategorie",
      published_at: "Veröffentlicht",
      detected_week: "Spieltag",
      match_status: "Zuordnung",
      confidence: "Konfidenz",
      match_id: "Match-ID",
      perspective_person: "Sicht",
      video_title: "Video",
      source: "Quelle",
    },
  },
  en: {
    app: {
      title: "GPL History Visualizer",
      subtitle: "German Pokémon League archive.",
    },
    controls: {
      language: "Deutsch",
      themeLight: "Night Theme",
      themeDark: "Day Theme",
    },
    status: {
      loading: "Loading CSV data",
      loaded: "CSV data loaded",
      failed: "CSV load failed",
    },
    actions: {
      exportCsv: "Export CSV",
      videoUrls: "Video URL List",
    },
    nav: {
      allTime: "All Time Table",
      killlists: "Pokémon Killlists",
      tableHistory: "Table History",
      matchPlan: "Match Plan",
      battleHistory: "Battle History",
      videoArchive: "Video Archive",
      personDetails: "Person Details",
      matchup: "Matchup Checker",
    },
    filters: {
      season: "Season",
      allSeasons: "All seasons",
      division: "Division",
      allDivisions: "All divisions",
      search: "Search",
      searchPlaceholder: "Team, trainer, Pokémon, video",
      header: "Filter",
    },
    summary: {
      archiveLabel: "Filtered archive summary",
      seasons: "Seasons",
      people: "People",
      battles: "Battles",
      winRate: "Win %",
      notAvailable: "n/a",
    },
    sections: {
      allTimeTitle: "All Time Table",
      allTimeDescription: "Aggregated from person-specific CSV stints; team standings stay in Table History.",
      killlistsTitle: "Pokémon Killlists",
      killlistsDescription: "Summed Pokémon kills across the currently filtered CSV data.",
      tableHistoryTitle: "Table History",
      tableHistoryDescription: "Per-season standings with source links for each row.",
      matchPlanTitle: "Match Plan",
      matchPlanDescription: "Season-specific match plan generated from the available CSV match data.",
      battleHistoryTitle: "Battle History",
      battleHistoryDescription: "Battle rows from normalized CSV data, with video sources when available.",
      videoArchiveTitle: "Video Archive",
      videoArchiveDescription: "Public GPL videos from participant channels with best-effort matchday assignment.",
      personDetailsTitle: "Person Details",
      personDetailsDescription: "People, teams, stints, and championships across seasons.",
      matchupTitle: "Matchup Checker",
      matchupDescription: "Compare two trainers or teams using available match rows.",
    },
    matchup: {
      firstName: "First pick",
      secondName: "Second pick",
      placeholder: "Select trainer or team",
      check: "Check",
      enterNames: "Select two trainers or teams.",
      matches: "Matches",
      firstWins: "First wins",
      secondWins: "Second wins",
      empty: "No sourced matchup rows found.",
    },
    personDetails: {
      focus: "Person",
      showAll: "All people",
      pokemonTitle: "Pokémon & Kills",
    },
    empty: {
      table: "No available sourced rows for this view yet.",
      chooseSeason: "Select one season to show the match plan.",
      loadError: "Could not load normalized CSV files. Run the collector first.",
    },
    divisions: {
      regularSeason: "Regular Season",
      leagueOne: "League 1",
      leagueTwo: "League 2",
      playoffs: "Playoffs",
      sunConference: "Sun Conference",
      moonConference: "Moon Conference",
      overall: "Overall",
      overallTagTeam: "Overall Tag Team",
      singles: "Singles",
      doubles: "Doubles",
      tagTeam: "Tag Team",
      videoSource: "Video source",
    },
    stages: {
      regular_season: "Regular Season",
      playoffs: "Playoffs",
      video_source: "Video source",
    },
    videoTypes: {
      game: "Game",
      teambuilding: "Teambuilding",
      draft_analysis: "Draft Analysis",
      announcement: "Announcement",
      update: "Update",
      reaction: "Reaction",
      recap: "Recap",
      tierlist: "Tier List",
      other: "Other",
    },
    matchStatuses: {
      matched: "Matched",
      unmatched: "Unmatched",
      teambuilding: "Teambuilding",
      draft_analysis: "Draft Analysis",
      announcement: "Announcement",
      update: "Update",
      reaction: "Reaction",
      recap: "Recap",
      tierlist: "Tier List",
      other: "Other",
    },
    values: {
      unknown: "Unknown",
      video: "Video",
      source: "Source",
    },
    columns: {
      rank: "Rank",
      name: "Name",
      seasons_won: "Seasons Won",
      rating: "Rating",
      seasons: "Seasons",
      teams: "Teams",
      trainers: "Trainers",
      matches: "Matches",
      wins: "Wins",
      losses: "Losses",
      draws: "Draws",
      win_pct: "Win %",
      points: "Points",
      best_rank: "Best Rank",
      rows: "Rows",
      season: "Season",
      season_id: "Season",
      division: "Division",
      divisions: "Divisions",
      pokemon: "Pokémon",
      trainer: "Trainer",
      team: "Team",
      kills: "Kills",
      deaths: "Deaths",
      differential: "Differential",
      status: "Status",
      person: "Person",
      championships: "Championships",
      stage: "Stage",
      week: "Week",
      start_week: "From week",
      end_week: "To week",
      player_a: "Player A",
      player_b: "Player B",
      opponent: "Opponent",
      winner: "Winner",
      score: "Score",
      video: "Video",
      videos: "Videos",
      channel: "Channel",
      title: "Title",
      video_type: "Category",
      published_at: "Published",
      detected_week: "Week",
      match_status: "Match status",
      confidence: "Confidence",
      match_id: "Match ID",
      perspective_person: "Perspective",
      video_title: "Video",
      source: "Source",
    },
  },
};

export const TABULATOR_LANGS = {
  de: {
    data: {
      loading: "Lade Daten",
      error: "Fehler",
    },
    pagination: {
      page_size: "Einträge",
      page_title: "Seite anzeigen",
      first: "Erste",
      first_title: "Erste Seite",
      last: "Letzte",
      last_title: "Letzte Seite",
      prev: "Zurück",
      prev_title: "Vorherige Seite",
      next: "Weiter",
      next_title: "Nächste Seite",
      all: "Alle",
    },
    headerFilters: {
      default: "Spalte filtern",
    },
  },
  en: {
    data: {
      loading: "Loading",
      error: "Error",
    },
    pagination: {
      page_size: "Page Size",
      page_title: "Show Page",
      first: "First",
      first_title: "First Page",
      last: "Last",
      last_title: "Last Page",
      prev: "Prev",
      prev_title: "Prev Page",
      next: "Next",
      next_title: "Next Page",
      all: "All",
    },
    headerFilters: {
      default: "Filter column",
    },
  },
};

export function normalizeLanguage(value) {
  const language = String(value ?? "").slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
}

export function nextLanguage(language) {
  return normalizeLanguage(language) === "de" ? "en" : "de";
}

export function normalizeTheme(value) {
  const theme = String(value ?? "").toLowerCase();
  return SUPPORTED_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

export function nextTheme(theme) {
  return normalizeTheme(theme) === "dark" ? "light" : "dark";
}

export function t(language, key) {
  const normalized = normalizeLanguage(language);
  return lookup(TRANSLATIONS[normalized], key) ?? lookup(TRANSLATIONS[DEFAULT_LANGUAGE], key) ?? key;
}

export function columnTitle(language, column) {
  return t(language, `columns.${column}`) ?? prettifyColumn(column);
}

function lookup(source, key) {
  return key.split(".").reduce((value, part) => (value && value[part] !== undefined ? value[part] : undefined), source);
}

function prettifyColumn(column) {
  return String(column)
    .replaceAll("_", " ")
    .replace(/\bpokemon\b/gi, "Pokémon")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
