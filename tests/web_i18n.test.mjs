import assert from "node:assert/strict";
import { TABULATOR_LANGS, columnTitle, nextLanguage, nextTheme, normalizeLanguage, normalizeTheme, t } from "../web/i18n.js";

assert.equal(t("de", "nav.cinema"), "Kino-Modus");
assert.equal(t("en", "nav.cinema"), "Cinema Mode");
assert.equal(t("de", "cinema.filtersTitle"), "Kino-Filter");
assert.equal(t("de", "cinema.orderChronological"), "Spieltag-Reihenfolge");
assert.equal(t("de", "cinema.orderPublished"), "Älteste zuerst");
assert.equal(t("de", "cinema.orderHighlights"), "Highlights zuerst");
assert.equal(t("de", "cinema.perspective"), "Sicht");
assert.equal(t("de", "cinema.channelSingular"), "Kanal");
assert.equal(t("de", "cinema.channelPlural"), "Kanäle");
assert.equal(t("de", "cinema.previousVideo"), "Zurück");
assert.equal(t("de", "cinema.nextVideo"), "Weiter");
assert.equal(t("de", "cinema.randomVideo"), "Zufälliges Video");
assert.equal(t("en", "cinema.filtersTitle"), "Cinema filters");
assert.equal(t("en", "cinema.orderPublished"), "Oldest first");
assert.equal(t("en", "cinema.orderHighlights"), "Highlights first");
assert.equal(t("en", "cinema.channelSingular"), "channel");
assert.equal(t("en", "cinema.channelPlural"), "channels");
assert.equal(t("en", "cinema.previousVideo"), "Back");
assert.equal(t("en", "cinema.nextVideo"), "Next");
assert.equal(t("en", "cinema.randomVideo"), "Random video");
assert.equal(t("de", "videoTypes.reference"), "Referenz");
assert.equal(t("en", "videoTypes.reference"), "Reference");
assert.equal(t("de", "matchStatuses.livestream"), "Livestream");
assert.equal(t("en", "matchStatuses.livestream"), "Livestream");

assert.equal(normalizeLanguage("fr-FR"), "de");
assert.equal(normalizeLanguage("en-US"), "en");
assert.equal(nextLanguage("de"), "en");

assert.equal(normalizeTheme("unexpected"), "light");
assert.equal(nextTheme("light"), "dark");
assert.equal(nextTheme("dark"), "light");

assert.equal(t("de", "nav.killlists"), "Pokémon-Killlisten");
assert.equal(t("en", "nav.killlists"), "Pokémon Killlists");
assert.equal(t("de", "nav.pokemonDetail"), "Pokémon-Details");
assert.equal(t("en", "nav.pokemonDetail"), "Pokémon Details");
assert.equal(t("de", "nav.pokemonDrafts"), "Pokémon-Drafts");
assert.equal(t("de", "nav.matchHighlights"), "Highlightkämpfe");
assert.equal(t("en", "nav.matchHighlights"), "Highlight Battles");
assert.equal(t("de", "highlightMatches.scoreFormulaTitle"), "Highlight-Score-Formel");
assert.match(t("de", "highlightMatches.openingFormulaNote"), /Spieltag 1/);
assert.match(t("de", "highlightMatches.contextFormulaNote"), /15%/);
assert.equal(t("de", "highlightMatches.videoPreviewLabel"), "Video-Vorschau");
assert.equal(t("de", "highlightMatches.card.sources"), "Quellen");
assert.equal(t("de", "highlightMatches.card.watch"), "Ansehen");
assert.equal(t("de", "highlightMatches.card.details"), "Details");
assert.equal(t("en", "highlightMatches.scoreFormulaTitle"), "Highlight score formula");
assert.equal(t("en", "highlightMatches.card.sources"), "Sources");
assert.equal(t("en", "highlightMatches.card.watch"), "Watch");
assert.equal(t("de", "nav.teamRosters"), "Kaderübersichten");
assert.equal(t("de", "rosters.scoreFormulaTitle"), "Kaderscore-Formel");
assert.equal(t("de", "rosters.openDetail"), "Kader ansehen");
assert.equal(t("de", "rosters.notesSummary"), "Hinweise");
assert.equal(t("de", "sections.rosterDetailTitle"), "Kaderdetail");
assert.match(t("de", "rosters.performanceFormulaNote"), /18%/);
assert.match(t("de", "rosters.balanceFormulaNote"), /Lower-Tiers geben keinen Bonus/);
assert.equal(t("en", "rosters.scoreFormulaTitle"), "Roster score formula");
assert.equal(t("de", "sections.pokemonDraftsDescription"), "Formgenaue Draft-Häufigkeit aus Killlisten und geprüften Teamgrafik-Zuordnungen.");
assert.equal(t("de", "sections.killlistsDescription"), "Summierte Pokémon-Kills über den aktuell gefilterten CSV-Datenbestand.");
assert.equal(t("de", "sections.tableHistoryDescription"), "Tabellenstände je Saison mit Quellenlink pro Zeile.");
assert.equal(t("de", "sections.battleHistoryDescription"), "Grafische Sicht auf Playoffs, Gruppenphasen und belegte Matchwege der gewählten Saison.");
assert.equal(t("de", "sections.videoArchiveDescription"), "Öffentliche GPL-Videos aus Teilnehmerkanälen mit Best-effort-Zuordnung zu Spieltagen.");
assert.equal(t("de", "sections.dataCoverageDescription"), "Saisonweise Abdeckung der normalisierten CSVs und bekannte Lücken.");
assert.equal(t("de", "sections.matchupDescription"), "Vergleiche zwei Trainer oder Teams anhand verfügbarer Match-Zeilen.");
assert.equal(t("en", "sections.teamRostersTitle"), "Roster Overview");
assert.equal(t("de", "empty.table"), "Für diese Ansicht gibt es noch keine belegten Zeilen.");
assert.equal(t("de", "empty.chooseSeason"), "Wähle eine einzelne Saison aus, um den Spielplan zu sehen.");
assert.equal(t("de", "empty.chooseSeasonDetail"), "Wähle eine einzelne Saison aus, um die Saisonakte zu sehen.");
assert.equal(t("de", "empty.loadError"), "Normalisierte CSV-Dateien konnten nicht geladen werden. Führe zuerst den Collector aus.");
assert.equal(t("de", "status.loaded"), "CSV-Daten geladen");
assert.equal(t("de", "actions.exportCsv"), "CSV exportieren");
assert.equal(t("en", "actions.videoUrls"), "Video URL List");
assert.equal(t("de", "filters.dataMode"), "Datenbasis");
assert.equal(t("de", "dataModes.primary"), "Gesamtübersicht");
assert.equal(t("de", "dataModes.all"), "Gesamtübersicht + Liga 2");
assert.equal(t("de", "dataModes.leagueTwo"), "Liga 2");
assert.equal(t("en", "dataModes.all"), "Overall + League 2");
assert.equal(t("de", "coverage.missingTitle"), "Bekannte Lücken");
assert.equal(t("de", "coverage.status.complete"), "vollständig");
assert.equal(t("de", "coverage.status.complete_with_review_flags"), "vollständig mit Review-Hinweisen");
assert.equal(TABULATOR_LANGS.de.pagination.page_size, "Einträge");
assert.equal(TABULATOR_LANGS.de.pagination.prev, "Zurück");
assert.equal(TABULATOR_LANGS.de.pagination.next_title, "Nächste Seite");
assert.equal(t("en", "columns.elo"), "Elo");
assert.equal(t("de", "videoTypes.draft_analysis"), "Draftanalyse");
assert.equal(t("en", "matchStatuses.unmatched"), "Unmatched");
assert.equal(columnTitle("de", "pokemon"), "Pokémon");
assert.equal(columnTitle("en", "pokemon"), "Pokémon");
assert.equal(columnTitle("de", "win_pct"), "Sieg %");
assert.equal(columnTitle("de", "deaths"), "Tode");
assert.equal(columnTitle("de", "rating"), "Wertung");
assert.equal(columnTitle("de", "roster_score"), "Kaderscore");
assert.equal(columnTitle("de", "highlight_score"), "Highlight-Score");
assert.equal(columnTitle("de", "roster_phase"), "Kaderphase");
assert.equal(columnTitle("de", "performance_score"), "Performance");
assert.equal(columnTitle("de", "balance_score"), "Balance");
assert.equal(columnTitle("de", "history_score"), "Historie");
assert.equal(columnTitle("de", "confidence_score"), "Confidence");
assert.equal(columnTitle("en", "pokemon_score"), "Pokémon Score");
assert.equal(columnTitle("de", "video_type"), "Kategorie");
assert.equal(columnTitle("de", "confidence_explanation"), "Zuordnungserklärung");
assert.equal(columnTitle("en", "confidence_explanation"), "Match Explanation");
assert.equal(columnTitle("en", "seasons_won"), "Seasons Won");
assert.equal(columnTitle("de", "opponent"), "Gegner");
assert.equal(columnTitle("en", "trainers"), "Trainers");

assert.doesNotMatch(JSON.stringify({
  nav: t("de", "nav"),
  sections: t("de", "sections"),
  empty: t("de", "empty"),
  coverage: t("de", "coverage"),
  pokemonDrafts: t("de", "pokemonDrafts"),
  tabulator: TABULATOR_LANGS.de,
}), /Ã|\?ber|W\?hle|Tabellenstnde|gewhlten|Teilnehmerkanlen|Fr diese|Fhre|Lcken|verfgbarer|vollstndig|Eintrge|Zurck|Nchste/);
