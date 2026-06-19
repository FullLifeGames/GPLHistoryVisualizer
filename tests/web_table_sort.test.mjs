import assert from "node:assert/strict";

import { tableSortText, textSorter, weekSortValue } from "../web/table_sort.js";

const fallbackIconCell = `
  <span class="pokemon-cell">
    <span class="pokemon-icon-fallback" aria-hidden="true">R</span>
    <a class="link-button" href="#/pokemon/riesenzahn" data-pokemon-key="riesenzahn" data-pokemon-name="Riesenzahn">Riesenzahn</a>
  </span>
`;

const pokemonCells = [
  `<span class="pokemon-cell"><span class="pokemon-icon" aria-hidden="true"></span><a class="link-button" data-pokemon-name="Zeraora">Zeraora</a></span>`,
  fallbackIconCell,
  `<span class="pokemon-cell"><span class="pokemon-icon" aria-hidden="true"></span><a class="link-button" data-pokemon-name="Ägislash">Ägislash</a></span>`,
  `<span class="pokemon-cell"><span class="pokemon-icon" aria-hidden="true"></span><a class="link-button" data-pokemon-name="Amigento-Normal">Amigento-Normal</a></span>`,
];

assert.equal(tableSortText("pokemon", fallbackIconCell), "Riesenzahn");
assert.deepEqual(
  [...pokemonCells].sort(textSorter("pokemon", "de")).map((value) => tableSortText("pokemon", value)),
  ["Ägislash", "Amigento-Normal", "Riesenzahn", "Zeraora"],
);

assert.equal(tableSortText("source", '<a href="https://example.com">Quelle 1</a>'), "Quelle 1");

assert.deepEqual(
  ["Spieltag 1", "Spieltag 10", "Spieltag 11", "Spieltag 2", "Spieltag 3"]
    .sort((left, right) => weekSortValue(left) - weekSortValue(right) || left.localeCompare(right)),
  ["Spieltag 1", "Spieltag 2", "Spieltag 3", "Spieltag 10", "Spieltag 11"],
);
assert.equal(weekSortValue("21. Spieltag - Sonntag der 08.02.2015 [12:00 -17:00]"), 21);
assert.equal(weekSortValue("Spieltag #05"), 5);
