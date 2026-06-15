import assert from "node:assert/strict";
import { selectFilterValues, tableHeaderFilterConfig } from "../web/table_filters.js";

const rows = [
  { pokemon: "Miraidon", tier: "AG", picked_status: "Nie gepickt", data_status: "sheet_extracted" },
  { pokemon: "Arceus", tier: "Uber", picked_status: "Nie gepickt", data_status: "sheet_extracted" },
  { pokemon: "Pikachu", tier: "ZU", picked_status: "Gepickt", data_status: "manual_override" },
  { pokemon: "Bisasam", tier: "LC", picked_status: "", data_status: "" },
];

assert.deepEqual(selectFilterValues(rows, "tier", "Alle"), {
  "": "Alle",
  AG: "AG",
  LC: "LC",
  Uber: "Uber",
  ZU: "ZU",
});

const tierConfig = tableHeaderFilterConfig("tier", rows, { allLabel: "Alle" });
assert.equal(typeof tierConfig.headerFilter, "function");
assert.equal(tierConfig.headerFilter.name, "selectHeaderFilter");
assert.equal(tierConfig.headerFilterFunc, "=");
assert.equal(tierConfig.headerFilterEmptyCheck(""), true);
assert.deepEqual(tierConfig.headerFilterParams, {
  values: {
    "": "Alle",
    AG: "AG",
    LC: "LC",
    Uber: "Uber",
    ZU: "ZU",
  },
});

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
