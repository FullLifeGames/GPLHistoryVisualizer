export const MANUAL_KILLLIST_FIELDS = [
  "season_id",
  "division",
  "stage",
  "pokemon",
  "pokemon_normalized",
  "trainer",
  "trainer_normalized",
  "team_name",
  "appearances",
  "kills",
  "data_status",
  "source_urls",
];

const TARGET_SEASONS = new Set(["season_003", "season_004", "season_005"]);
const DEFAULT_MANUAL_SOURCE = "data/manual/pokemon_killlists.csv";
const DATASETS = {
  killlists: "../data/normalized/pokemon_killlists.csv",
  personStints: "../data/normalized/person_stints.csv",
  teams: "../data/normalized/teams.csv",
  teamGraphicSlots: "../data/review/team_graphic_slots.csv",
};

const state = {
  rows: [],
  personStints: [],
  teams: [],
  teamGraphicSlots: [],
  assignments: new Map(),
  season: "all",
  search: "",
  openOnly: true,
};

const domReady = typeof document !== "undefined";

if (domReady) {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("#manual-killlist-entry")) {
      init().catch((error) => {
        const status = document.querySelector("#entry-status");
        if (status) {
          status.textContent = `Fehler: ${error.message}`;
          status.classList.add("is-error");
        }
        console.error(error);
      });
    }
  });
}

export function reviewableKilllistRows(killlists) {
  const byKey = new Map();
  for (const row of killlists) {
    if (!TARGET_SEASONS.has(row.season_id)) continue;
    if (row.data_status === "not_available") continue;
    if (!row.pokemon || !row.kills) continue;
    const key = assignmentKey(row);
    const current = byKey.get(key);
    if (!current || row.data_status === "manual_override") {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()].sort(compareEntryRows);
}

export function isAssignedKilllistRow(row) {
  return Boolean(clean(row.trainer) || clean(row.trainer_normalized) || clean(row.team_name));
}

export function unassignedKilllistRows(killlists) {
  return reviewableKilllistRows(killlists).filter((row) => !isAssignedKilllistRow(row));
}

export function playerOptionsForSeason(seasonId, division, personStints, teams, teamGraphicSlots = []) {
  const options = new Map();
  const add = (row) => {
    if (row.season_id !== seasonId) return;
    if (division && row.division && row.division !== division) return;
    const personName = clean(row.person_name || row.player_name);
    const personKey = clean(row.person_name_normalized || personName).toLowerCase();
    if (!personName || !personKey) return;
    const teamName = clean(row.team_name);
    const personId = clean(row.person_id) || `person_${personKey.replace(/[^a-z0-9]+/g, "_")}`;
    const startWeek = clean(row.start_week);
    const endWeek = clean(row.end_week);
    const weekSuffix = startWeek || endWeek ? ` (ST ${startWeek || "?"}-${endWeek || "?"})` : "";
    const label = teamName ? `${personName} - ${teamName}${weekSuffix}` : `${personName}${weekSuffix}`;
    const option = {
      person_id: personId,
      person_name: personName,
      person_name_normalized: personKey,
      team_name: teamName,
      label,
      value: personId,
    };
    const optionKey = `${personId}|${normalizeKey(teamName)}`;
    const current = options.get(optionKey);
    if (!current || label.length > current.label.length) {
      options.set(optionKey, option);
    }
  };

  personStints.forEach(add);
  teamGraphicSlots.forEach(add);
  if (!options.size) {
    teams.forEach(add);
  }
  return [...options.values()].sort((a, b) => a.person_name.localeCompare(b.person_name) || a.team_name.localeCompare(b.team_name));
}

export function buildManualKilllistRows(reviewRows, assignments, manualSourceUrl = DEFAULT_MANUAL_SOURCE) {
  const manualSource = clean(manualSourceUrl);
  return reviewRows
    .map((row) => {
      const assignment = assignments.get(assignmentKey(row));
      if (!assignment) return null;
      return {
        season_id: row.season_id || "",
        division: row.division || "",
        stage: row.stage || "",
        pokemon: row.pokemon || "",
        pokemon_normalized: row.pokemon_normalized || normalizeKey(row.pokemon),
        trainer: assignment.person_name || "",
        trainer_normalized: assignment.person_name_normalized || normalizeKey(assignment.person_name),
        team_name: assignment.team_name || "",
        appearances: row.appearances || "",
        kills: row.kills || "",
        data_status: "manual_override",
        source_urls: mergeSources(row.source_urls, manualSource),
      };
    })
    .filter(Boolean);
}

export function csvFromRows(fields, rows) {
  const lines = [
    fields.join(","),
    ...rows.map((row) => fields.map((field) => csvCell(row[field] ?? "")).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function assignmentKey(row) {
  return [row.season_id || "", row.division || "", row.stage || "", row.pokemon_normalized || normalizeKey(row.pokemon)].join("|");
}

async function init() {
  bindControls();
  setStatus("Lade S3-S5-Killdaten");
  const datasets = await loadDatasets();
  state.rows = reviewableKilllistRows(datasets.killlists);
  state.personStints = datasets.personStints;
  state.teams = datasets.teams;
  state.teamGraphicSlots = datasets.teamGraphicSlots;
  restoreAssignmentsFromRows(state.rows);
  restoreSavedAssignments();
  populateSeasonFilter();
  render();
  setStatus("Bereit");
}

function bindControls() {
  document.querySelector("#entry-open-only").checked = state.openOnly;
  document.querySelector("#entry-season").addEventListener("change", (event) => {
    state.season = event.target.value;
    render();
  });
  document.querySelector("#entry-search").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });
  document.querySelector("#entry-open-only").addEventListener("change", (event) => {
    state.openOnly = event.target.checked;
    render();
  });
  document.querySelector("#entry-export").addEventListener("click", () => {
    const rows = buildManualRowsFromState();
    downloadText("pokemon_killlists_s3_s5_manual.csv", csvFromRows(MANUAL_KILLLIST_FIELDS, rows), "text/csv;charset=utf-8");
  });
  document.querySelector("#entry-copy").addEventListener("click", async () => {
    const rows = buildManualRowsFromState();
    await navigator.clipboard.writeText(csvFromRows(MANUAL_KILLLIST_FIELDS, rows));
    setStatus("CSV in Zwischenablage kopiert");
  });
  document.querySelector("#entry-reset").addEventListener("click", () => {
    if (!confirm("Alle lokalen Zuordnungen für diese Maske löschen?")) return;
    state.assignments.clear();
    localStorage.removeItem(storageKey());
    render();
  });
}

function populateSeasonFilter() {
  const select = document.querySelector("#entry-season");
  const seasons = [...new Set(state.rows.map((row) => row.season_id))].sort(compareSeasons);
  select.innerHTML = [
    '<option value="all">Alle Saisons</option>',
    ...seasons.map((season) => `<option value="${escapeAttr(season)}">${escapeHtml(seasonDisplay(season))}</option>`),
  ].join("");
  select.value = state.season;
}

function render() {
  const rows = filteredRows();
  const assigned = state.rows.filter(isAssignedInUi).length;
  const open = state.rows.length - assigned;
  document.querySelector("#entry-summary").innerHTML = [
    metric("Pokémon gesamt", state.rows.length),
    metric("Zugeordnet", assigned),
    metric("Offen", open),
    metric("Export-Zeilen", buildManualRowsFromState().length),
  ].join("");

  const target = document.querySelector("#entry-table");
  if (!rows.length) {
    target.innerHTML = '<p class="empty">Keine Zeilen für diesen Filter.</p>';
    return;
  }
  target.innerHTML = `
    <table class="entry-table">
      <thead>
        <tr>
          <th>Saison</th>
          <th>Pokémon</th>
          <th>Kills</th>
          <th>Spieler</th>
          <th>Team</th>
          <th>Quelle</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(entryRowHtml).join("")}
      </tbody>
    </table>
  `;
  target.querySelectorAll("select[data-assignment-key]").forEach((select) => {
    select.addEventListener("change", () => {
      const key = select.dataset.assignmentKey;
      if (!select.value) {
        state.assignments.delete(key);
      } else {
        state.assignments.set(key, JSON.parse(select.value));
      }
      saveAssignments();
      render();
    });
  });
}

function entryRowHtml(row) {
  const key = assignmentKey(row);
  const options = playerOptionsForSeason(row.season_id, row.division, state.personStints, state.teams, state.teamGraphicSlots);
  const selected = state.assignments.get(key) || assignmentFromRow(row);
  const selectedValue = selected ? optionValue(selected) : "";
  const team = selected?.team_name || row.team_name || "";
  const sourceCount = splitSources(row.source_urls).length;
  return `
    <tr>
      <td>${escapeHtml(seasonDisplay(row.season_id))}</td>
      <td><strong>${escapeHtml(row.pokemon)}</strong><span class="entry-muted">${escapeHtml(row.division || "")}</span></td>
      <td class="numeric">${escapeHtml(row.kills || "")}</td>
      <td>
        <select data-assignment-key="${escapeAttr(key)}">
          <option value="">Nicht zugeordnet</option>
          ${options.map((option) => {
            const value = optionValue(option);
            return `<option value="${escapeAttr(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`;
          }).join("")}
        </select>
      </td>
      <td>${escapeHtml(team)}</td>
      <td><span class="badge">${sourceCount} Quelle${sourceCount === 1 ? "" : "n"}</span></td>
    </tr>
  `;
}

function filteredRows() {
  return state.rows.filter((row) => {
    if (state.season !== "all" && row.season_id !== state.season) return false;
    if (state.openOnly && isAssignedInUi(row)) return false;
    if (!state.search) return true;
    return [row.season_id, row.division, row.pokemon, row.kills, state.assignments.get(assignmentKey(row))?.person_name]
      .join(" ")
      .toLowerCase()
      .includes(state.search);
  });
}

function restoreAssignmentsFromRows(rows) {
  for (const row of rows) {
    if (row.data_status !== "manual_override") continue;
    if (!row.trainer && !row.trainer_normalized) continue;
    state.assignments.set(assignmentKey(row), assignmentFromRow(row));
  }
}

function isAssignedInUi(row) {
  return state.assignments.has(assignmentKey(row)) || isAssignedKilllistRow(row);
}

function assignmentFromRow(row) {
  if (!isAssignedKilllistRow(row)) return null;
  return {
    person_id: row.trainer_normalized ? `person_${row.trainer_normalized.replace(/[^a-z0-9]+/g, "_")}` : "",
    person_name: row.trainer || row.trainer_normalized,
    person_name_normalized: row.trainer_normalized || normalizeKey(row.trainer),
    team_name: row.team_name || "",
  };
}

function restoreSavedAssignments() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.assignments = new Map([...state.assignments.entries(), ...saved]);
  } catch {
    state.assignments = new Map(state.assignments);
  }
}

function saveAssignments() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify([...state.assignments.entries()]));
  } catch {
    // Local persistence is a convenience only.
  }
}

function buildManualRowsFromState() {
  return buildManualKilllistRows(state.rows, state.assignments, document.querySelector("#entry-source").value);
}

async function loadDatasets() {
  const entries = await Promise.all(
    Object.entries(DATASETS).map(async ([key, url]) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return [key, parseCsv(await response.text())];
    }),
  );
  return Object.fromEntries(entries);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift() ?? [];
  return rows
    .filter((item) => item.some((value) => clean(value)))
    .map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function compareEntryRows(a, b) {
  return compareSeasons(a.season_id, b.season_id) || Number(b.kills || 0) - Number(a.kills || 0) || a.pokemon.localeCompare(b.pokemon);
}

function compareSeasons(a, b) {
  return seasonNumber(a) - seasonNumber(b) || String(a).localeCompare(String(b));
}

function seasonNumber(value) {
  const match = String(value || "").match(/season_0*(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function seasonDisplay(value) {
  const number = seasonNumber(value);
  return Number.isFinite(number) ? `Saison ${number}` : value || "";
}

function metric(label, value) {
  return `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></article>`;
}

function optionValue(option) {
  return JSON.stringify({
    person_id: option.person_id || "",
    person_name: option.person_name || "",
    person_name_normalized: option.person_name_normalized || normalizeKey(option.person_name),
    team_name: option.team_name || "",
  });
}

function mergeSources(...values) {
  return [...new Set(values.flatMap(splitSources))].join(";");
}

function splitSources(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clean(value) {
  return String(value ?? "").trim();
}

function storageKey() {
  return "gpl-s3-s5-killlist-assignments";
}

function setStatus(value) {
  const status = document.querySelector("#entry-status");
  status.textContent = value;
  status.classList.remove("is-error");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
