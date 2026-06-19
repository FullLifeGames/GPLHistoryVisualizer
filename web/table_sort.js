import { plainFilterValue } from "./table_filters.js";

const SORT_ATTRIBUTE_BY_COLUMN = {
  pokemon: "data-pokemon-name",
};

export function tableSortText(column, value) {
  const attributeName = SORT_ATTRIBUTE_BY_COLUMN[column];
  if (attributeName) {
    const attributeValue = htmlAttributeValue(value, attributeName);
    if (attributeValue) {
      return plainFilterValue(attributeValue);
    }
  }
  return plainFilterValue(value);
}

export function textSorter(column, language = "de") {
  const collator = new Intl.Collator(language || undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return (left, right) => collator.compare(tableSortText(column, left), tableSortText(column, right));
}

export function weekSortValue(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const text = plainFilterValue(value).toLowerCase();
  const match = text.match(
    /(?:spieltag|matchday|week|st\.?|sp\.?)\s*#?\s*0*(\d{1,3})(?!\d)|\b0*(\d{1,3})\.\s*(?:spieltag|matchday|week|st\.?|sp\.?)/i,
  );
  return match ? Number(match[1] || match[2]) : 999;
}

function htmlAttributeValue(value, attributeName) {
  const pattern = new RegExp(`${escapeRegExp(attributeName)}\\s*=\\s*(["'])(.*?)\\1`, "i");
  return String(value ?? "").match(pattern)?.[2] ?? "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
