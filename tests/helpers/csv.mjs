import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Minimal RFC-4180 reader for tests that assert against the real normalized CSVs.
// Not exported from web/ because the app parses CSV inside app.js, which needs a DOM.
export function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character !== '"') {
        field += character;
      } else if (text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift() ?? [];
  return rows.filter((cells) => cells.length > 1).map((cells) => Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""])));
}

export function readNormalizedCsv(name) {
  return parseCsv(readFileSync(fileURLToPath(new URL(`../../data/normalized/${name}`, import.meta.url)), "utf8"));
}
