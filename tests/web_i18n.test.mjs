import assert from "node:assert/strict";
import { columnTitle, nextLanguage, nextTheme, normalizeLanguage, normalizeTheme, t } from "../web/i18n.js";

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
assert.equal(t("de", "nav.teamRosters"), "Kaderübersichten");
assert.equal(t("de", "sections.pokemonDraftsDescription"), "Formgenaue Draft-Häufigkeit aus Killlisten und geprüften Teamgrafik-Zuordnungen.");
assert.equal(t("en", "sections.teamRostersTitle"), "Roster Overview");
assert.equal(t("de", "status.loaded"), "CSV-Daten geladen");
assert.equal(t("de", "actions.exportCsv"), "CSV exportieren");
assert.equal(t("en", "actions.videoUrls"), "Video URL List");
assert.equal(t("de", "filters.dataMode"), "Datenbasis");
assert.equal(t("de", "dataModes.primary"), "Gesamtübersicht");
assert.equal(t("de", "dataModes.leagueTwo"), "Liga 2");
assert.equal(t("en", "columns.elo"), "Elo");
assert.equal(t("de", "videoTypes.draft_analysis"), "Draftanalyse");
assert.equal(t("en", "matchStatuses.unmatched"), "Unmatched");
assert.equal(columnTitle("de", "pokemon"), "Pokémon");
assert.equal(columnTitle("en", "pokemon"), "Pokémon");
assert.equal(columnTitle("de", "win_pct"), "Sieg %");
assert.equal(columnTitle("de", "rating"), "Wertung");
assert.equal(columnTitle("de", "roster_score"), "Kaderscore");
assert.equal(columnTitle("de", "power_score"), "Power");
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
  pokemonDrafts: t("de", "pokemonDrafts"),
}), /Ã/);
