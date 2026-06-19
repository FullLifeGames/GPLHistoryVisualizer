import assert from "node:assert/strict";
import { plainFilterValue, selectFilterValues, tableHeaderFilterConfig } from "../web/table_filters.js";

const rows = [
  { pokemon: "Miraidon", tier: "AG", picked_status: "Nie gepickt", data_status: "sheet_extracted" },
  { pokemon: "Arceus", tier: "Uber", picked_status: "Nie gepickt", data_status: "sheet_extracted" },
  { pokemon: "Pikachu", tier: "ZU", picked_status: "Gepickt", data_status: "manual_override" },
  { pokemon: "Bisasam", tier: "LC", picked_status: "", data_status: "" },
  { season: '<a class="link-button" href="#/season/season_010">Saison 10</a>', tier: "OU" },
];

assert.deepEqual(selectFilterValues(rows, "tier", "Alle"), {
  "": "Alle",
  AG: "AG",
  LC: "LC",
  OU: "OU",
  Uber: "Uber",
  ZU: "ZU",
});

const tierConfig = tableHeaderFilterConfig("tier", rows, { allLabel: "Alle" });
assert.equal(typeof tierConfig.headerFilter, "function");
assert.equal(tierConfig.headerFilter.name, "selectHeaderFilter");
assert.equal(tierConfig.headerFilterFunc.name, "selectHeaderFilterFunc");
assert.equal(tierConfig.headerFilterEmptyCheck(""), true);
assert.deepEqual(tierConfig.headerFilterParams, {
  values: {
    "": "Alle",
    AG: "AG",
    LC: "LC",
    OU: "OU",
    Uber: "Uber",
    ZU: "ZU",
  },
});

assert.equal(plainFilterValue(rows.at(-1).season), "Saison 10");
const seasonConfig = tableHeaderFilterConfig("season", rows, { allLabel: "Alle" });
assert.deepEqual(seasonConfig.headerFilterParams, {
  values: {
    "": "Alle",
    "Saison 10": "Saison 10",
  },
});
assert.equal(seasonConfig.headerFilterFunc("Saison 10", rows.at(-1).season), true);

const pickedStatusConfig = tableHeaderFilterConfig("picked_status", rows, { allLabel: "Alle" });
assert.equal(typeof pickedStatusConfig.headerFilter, "function");
assert.deepEqual(pickedStatusConfig.headerFilterParams, {
  values: {
    "": "Alle",
    Gepickt: "Gepickt",
    "Nie gepickt": "Nie gepickt",
  },
});

assert.deepEqual(tableHeaderFilterConfig("pokemon", rows, { placeholder: "Filtern" }), {
  headerFilter: "input",
  headerFilterPlaceholder: "Filtern",
});

assert.deepEqual(tableHeaderFilterConfig("source", rows), {
  headerFilter: false,
});
