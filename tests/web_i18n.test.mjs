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
assert.equal(t("de", "status.loaded"), "CSV-Daten geladen");
assert.equal(t("de", "actions.exportCsv"), "CSV exportieren");
assert.equal(t("en", "actions.videoUrls"), "Video URL List");
assert.equal(t("de", "videoTypes.draft_analysis"), "Draftanalyse");
assert.equal(t("en", "matchStatuses.unmatched"), "Unmatched");
assert.equal(columnTitle("de", "pokemon"), "Pokémon");
assert.equal(columnTitle("en", "pokemon"), "Pokémon");
assert.equal(columnTitle("de", "win_pct"), "Sieg %");
assert.equal(columnTitle("de", "rating"), "Wertung");
assert.equal(columnTitle("de", "video_type"), "Kategorie");
assert.equal(columnTitle("de", "confidence_explanation"), "Zuordnungserklärung");
assert.equal(columnTitle("en", "confidence_explanation"), "Match Explanation");
assert.equal(columnTitle("en", "seasons_won"), "Seasons Won");
assert.equal(columnTitle("de", "opponent"), "Gegner");
assert.equal(columnTitle("en", "trainers"), "Trainers");
