const SELECT_FILTER_COLUMNS = new Set([
  "category",
  "claim_field",
  "claim_type",
  "confidence",
  "confidence_tier",
  "coverage_status",
  "data_status",
  "division",
  "divisions",
  "evidence_status",
  "match_basis",
  "match_status",
  "picked_status",
  "queue",
  "review_reason",
  "season",
  "season_id",
  "severity",
  "stage",
  "status",
  "tier",
  "title",
  "video_type",
]);

const DISABLED_FILTER_COLUMNS = new Set(["source", "video", "videos"]);

export function selectFilterValues(rows, column, allLabel = "Alle") {
  const values = [...new Set(rows.map((row) => plainFilterValue(row?.[column])).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
  return Object.fromEntries([["", allLabel], ...values.map((value) => [value, value])]);
}

export function plainFilterValue(value) {
  return decodeHtmlEntities(String(value ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'");
}

export function selectHeaderFilterFunc(headerValue, rowValue) {
  return emptyHeaderFilterValue(headerValue) || plainFilterValue(rowValue) === headerValue;
}

export function selectHeaderFilter(_cell, onRendered, success, _cancel, editorParams = {}) {
  const select = document.createElement("select");
  select.className = "table-header-select";
  Object.entries(editorParams.values ?? {}).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  select.addEventListener("change", () => {
    success(select.value);
  });
  onRendered?.(() => {
    select.style.width = "100%";
  });
  return select;
}

export function emptyHeaderFilterValue(value) {
  return value === "" || value === null || value === undefined;
}

export function tableHeaderFilterConfig(column, rows = [], { allLabel = "Alle", placeholder = "Filtern" } = {}) {
  if (DISABLED_FILTER_COLUMNS.has(column)) {
    return { headerFilter: false };
  }
  if (SELECT_FILTER_COLUMNS.has(column)) {
    return {
      headerFilter: selectHeaderFilter,
      headerFilterFunc: selectHeaderFilterFunc,
      headerFilterEmptyCheck: emptyHeaderFilterValue,
      headerFilterParams: {
        values: selectFilterValues(rows, column, allLabel),
      },
    };
  }
  return {
    headerFilter: "input",
    headerFilterPlaceholder: placeholder,
  };
}
