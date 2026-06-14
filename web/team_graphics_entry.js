export const TEAM_POKEMON_USAGE_FIELDS = [
  "season_id",
  "division",
  "team_name",
  "team_name_normalized",
  "person_name",
  "person_name_normalized",
  "pokemon",
  "pokemon_normalized",
  "slot",
  "source_file",
  "source_urls",
  "data_status",
];

const DATASETS = {
  slots: "../data/review/team_graphic_slots.csv",
  killlists: "../data/normalized/pokemon_killlists.csv",
  teams: "../data/normalized/teams.csv",
};

const DEFAULT_SOURCE = "data/manual/team_pokemon_usage.csv";

const state = {
  slots: [],
  killlists: [],
  teams: [],
  pokemonAssignments: new Map(),
  groupAssignments: new Map(),
  season: "all",
  search: "",
  openOnly: false,
};

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("#team-graphics-entry")) {
      init().catch((error) => {
        const status = document.querySelector("#graphics-status");
        if (status) {
          status.textContent = `Fehler: ${error.message}`;
          status.classList.add("is-error");
        }
        console.error(error);
      });
    }
  });
}

export function candidateOptionsForSeason(killlists, seasonId) {
  const byPokemon = new Map();
  for (const row of killlists) {
    if (row.season_id !== seasonId || row.data_status === "not_available") continue;
    const key = row.pokemon_normalized || normalizeKey(row.pokemon);
    if (!key || !row.pokemon) continue;
    const kills = numberValue(row.kills);
    const current = byPokemon.get(key);
    if (!current || kills > current.kills) {
      byPokemon.set(key, {
        pokemon: row.pokemon,
        pokemon_normalized: key,
        kills,
        label: `${row.pokemon}${Number.isFinite(kills) ? ` (${kills} Kills)` : ""}`,
      });
    }
  }
  return [...byPokemon.values()].sort((a, b) => b.kills - a.kills || a.pokemon.localeCompare(b.pokemon));
}

export function defaultSuggestionForSlot(slot, candidates, pokemonAssignments) {
  const used = new Set(
    [...pokemonAssignments.values()]
      .map((assignment) => assignment.pokemon_normalized || normalizeKey(assignment.pokemon))
      .filter(Boolean),
  );
  return candidates.find((candidate) => !used.has(candidate.pokemon_normalized)) || candidates[0] || null;
}

export function groupSlots(slots) {
  const groups = new Map();
  for (const slot of slots) {
    const key = slot.graphic_group || `${slot.season_id}_${slot.source_file}_${slot.graphic_row}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        season_id: slot.season_id,
        division: slot.division,
        team_name: slot.team_name || "",
        team_name_normalized: slot.team_name_normalized || "",
        person_name: slot.person_name || "",
        person_name_normalized: slot.person_name_normalized || "",
        source_file: slot.source_file,
        image_path: slot.image_path,
        graphic_row: slot.graphic_row || "",
        slots: [],
      });
    }
    groups.get(key).slots.push(slot);
  }
  return [...groups.values()].sort(compareGroups);
}

export function buildTeamPokemonUsageRows(slots, pokemonAssignments, groupAssignments, sourceUrl = DEFAULT_SOURCE) {
  const rows = [];
  for (const slot of slots) {
    const pokemon = pokemonAssignments.get(slot.slot_id);
    if (!pokemon) continue;
    const groupAssignment = groupAssignments.get(slot.graphic_group) || {};
    const teamName = slot.team_name || groupAssignment.team_name || "";
    const personName = slot.person_name || groupAssignment.person_name || "";
    if (!teamName && !personName) continue;
    rows.push({
      season_id: slot.season_id || "",
      division: slot.division || "",
      team_name: teamName,
      team_name_normalized: slot.team_name_normalized || groupAssignment.team_name_normalized || normalizeKey(teamName),
      person_name: personName,
      person_name_normalized: slot.person_name_normalized || groupAssignment.person_name_normalized || normalizeKey(personName),
      pokemon: pokemon.pokemon || "",
      pokemon_normalized: pokemon.pokemon_normalized || normalizeKey(pokemon.pokemon),
      slot: slot.slot_number || "",
      source_file: slot.source_file || "",
      source_urls: mergeSources(sourceUrl),
      data_status: "manual_override",
    });
  }
  return rows.sort((a, b) => compareSeasons(a.season_id, b.season_id) || a.team_name.localeCompare(b.team_name) || numberValue(a.slot) - numberValue(b.slot));
}

export function csvFromRows(fields, rows) {
  return `${[fields.join(","), ...rows.map((row) => fields.map((field) => csvCell(row[field] ?? "")).join(","))].join("\n")}\n`;
}

async function init() {
  bindControls();
  setStatus("Lade Grafik-Slots");
  const data = await loadDatasets();
  state.slots = data.slots;
  state.killlists = data.killlists;
  state.teams = data.teams;
  restoreSavedState();
  populateSeasonFilter();
  render();
  setStatus("Bereit");
}

function bindControls() {
  document.querySelector("#graphics-season").addEventListener("change", (event) => {
    state.season = event.target.value;
    render();
  });
  document.querySelector("#graphics-search").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });
  document.querySelector("#graphics-open-only").addEventListener("change", (event) => {
    state.openOnly = event.target.checked;
    render();
  });
  document.querySelector("#graphics-export").addEventListener("click", () => {
    downloadText("team_pokemon_usage.csv", csvFromRows(TEAM_POKEMON_USAGE_FIELDS, usageRowsFromState()), "text/csv;charset=utf-8");
  });
  document.querySelector("#graphics-copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText(csvFromRows(TEAM_POKEMON_USAGE_FIELDS, usageRowsFromState()));
    setStatus("CSV in Zwischenablage kopiert");
  });
  document.querySelector("#graphics-reset").addEventListener("click", () => {
    if (!confirm("Alle lokalen Grafik-Zuordnungen loeschen?")) return;
    state.pokemonAssignments.clear();
    state.groupAssignments.clear();
    localStorage.removeItem(storageKey());
    render();
  });
}

function populateSeasonFilter() {
  const select = document.querySelector("#graphics-season");
  const seasons = [...new Set(state.slots.map((slot) => slot.season_id))].sort(compareSeasons);
  select.innerHTML = [
    '<option value="all">Alle Saisons</option>',
    ...seasons.map((season) => `<option value="${escapeAttr(season)}">${escapeHtml(seasonDisplay(season))}</option>`),
  ].join("");
  select.value = state.season;
}

function render() {
  const visibleGroups = groupSlots(filteredSlots());
  const assignedSlots = state.slots.filter((slot) => state.pokemonAssignments.has(slot.slot_id)).length;
  document.querySelector("#graphics-summary").innerHTML = [
    metric("Slots", state.slots.length),
    metric("Pokémon gesetzt", assignedSlots),
    metric("Export-Zeilen", usageRowsFromState().length),
    metric("Gruppen", groupSlots(state.slots).length),
  ].join("");

  const target = document.querySelector("#graphics-groups");
  if (!visibleGroups.length) {
    target.innerHTML = '<p class="empty">Keine Grafik-Slots fuer diesen Filter.</p>';
    return;
  }
  target.innerHTML = visibleGroups.map(groupHtml).join("");
  bindRenderedControls(target);
}

function groupHtml(group) {
  const team = teamForGroup(group);
  const needsTeam = !team.team_name && !team.person_name;
  const teamSelect = needsTeam ? groupTeamSelect(group) : "";
  return `
    <article class="graphics-group">
      <div class="graphics-group-head">
        <div>
          <h3>${escapeHtml(groupTitle(group, team))}</h3>
          <p>${escapeHtml(seasonDisplay(group.season_id))} · ${escapeHtml(group.division || "")}${group.graphic_row ? ` · Grafikzeile ${escapeHtml(group.graphic_row)}` : ""}</p>
        </div>
        ${teamSelect}
      </div>
      <div class="graphics-slot-grid">
        ${group.slots.map(slotHtml).join("")}
      </div>
    </article>
  `;
}

function slotHtml(slot) {
  const candidates = candidateOptionsForSeason(state.killlists, slot.season_id);
  const assignment = state.pokemonAssignments.get(slot.slot_id);
  const selectedValue = assignment ? optionValue(assignment) : "";
  const suggestion = defaultSuggestionForSlot(slot, candidates, state.pokemonAssignments);
  return `
    <div class="graphics-slot">
      ${cropHtml(slot)}
      <div class="graphics-slot-body">
        <span class="entry-muted">Slot ${escapeHtml(slot.slot_number)}</span>
        <select data-pokemon-slot="${escapeAttr(slot.slot_id)}">
          <option value="">Pokémon wählen</option>
          ${candidates.map((candidate) => {
            const value = optionValue(candidate);
            return `<option value="${escapeAttr(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(candidate.label)}</option>`;
          }).join("")}
        </select>
        ${
          suggestion
            ? `<button class="table-action suggestion-button" type="button" data-suggest-slot="${escapeAttr(slot.slot_id)}" data-suggestion="${escapeAttr(optionValue(suggestion))}">Vorschlag: ${escapeHtml(suggestion.pokemon)}</button>`
            : '<span class="entry-muted">Kein Vorschlag</span>'
        }
      </div>
    </div>
  `;
}

function cropHtml(slot) {
  const scale = cropScale(slot);
  const imageWidth = slot.season_id === "season_005" ? 1920 : 1280;
  const imageHeight = slot.season_id === "season_005" ? 1080 : 720;
  return `
    <div
      class="graphics-crop"
      style="
        width:${Number(slot.crop_width) * scale}px;
        height:${Number(slot.crop_height) * scale}px;
        background-image:url('${escapeAttr(slot.image_path)}');
        background-size:${imageWidth * scale}px ${imageHeight * scale}px;
        background-position:-${Number(slot.crop_x) * scale}px -${Number(slot.crop_y) * scale}px;
      "
      aria-label="Grafikausschnitt Slot ${escapeAttr(slot.slot_number)}"
    ></div>
  `;
}

function bindRenderedControls(target) {
  target.querySelectorAll("[data-group-team]").forEach((select) => {
    select.addEventListener("change", () => {
      if (!select.value) {
        state.groupAssignments.delete(select.dataset.groupTeam);
      } else {
        state.groupAssignments.set(select.dataset.groupTeam, JSON.parse(select.value));
      }
      saveState();
      render();
    });
  });
  target.querySelectorAll("[data-pokemon-slot]").forEach((select) => {
    select.addEventListener("change", () => {
      if (!select.value) {
        state.pokemonAssignments.delete(select.dataset.pokemonSlot);
      } else {
        state.pokemonAssignments.set(select.dataset.pokemonSlot, JSON.parse(select.value));
      }
      saveState();
      render();
    });
  });
  target.querySelectorAll("[data-suggest-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pokemonAssignments.set(button.dataset.suggestSlot, JSON.parse(button.dataset.suggestion));
      saveState();
      render();
    });
  });
}

function groupTeamSelect(group) {
  const options = teamOptionsForSeason(group.season_id, group.division);
  const selected = state.groupAssignments.get(group.key);
  const selectedValue = selected ? optionValue(selected) : "";
  return `
    <label class="graphics-group-team">
      <span>Team/Spieler</span>
      <select data-group-team="${escapeAttr(group.key)}">
        <option value="">Team wählen</option>
        ${options.map((option) => {
          const value = optionValue(option);
          return `<option value="${escapeAttr(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(option.label)}</option>`;
        }).join("")}
      </select>
    </label>
  `;
}

function teamOptionsForSeason(seasonId, division) {
  return (state.teams ?? [])
    .filter((team) => team.season_id === seasonId && (!division || !team.division || team.division === division))
    .filter((team) => team.person_name || team.team_name)
    .map((team) => ({
      team_name: team.team_name || "",
      team_name_normalized: team.team_name_normalized || normalizeKey(team.team_name),
      person_name: team.person_name || "",
      person_name_normalized: team.person_name_normalized || normalizeKey(team.person_name),
      label: [team.person_name, team.team_name].filter(Boolean).join(" - "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function teamForGroup(group) {
  return {
    team_name: group.team_name || state.groupAssignments.get(group.key)?.team_name || "",
    team_name_normalized: group.team_name_normalized || state.groupAssignments.get(group.key)?.team_name_normalized || "",
    person_name: group.person_name || state.groupAssignments.get(group.key)?.person_name || "",
    person_name_normalized: group.person_name_normalized || state.groupAssignments.get(group.key)?.person_name_normalized || "",
  };
}

function groupTitle(group, team) {
  if (team.person_name || team.team_name) {
    return [team.person_name, team.team_name].filter(Boolean).join(" - ");
  }
  return `Grafikgruppe ${group.graphic_row || group.key}`;
}

function filteredSlots() {
  return state.slots.filter((slot) => {
    if (state.season !== "all" && slot.season_id !== state.season) return false;
    if (state.openOnly && state.pokemonAssignments.has(slot.slot_id)) return false;
    if (!state.search) return true;
    return [slot.season_id, slot.division, slot.team_name, slot.person_name, slot.source_file, slot.graphic_row]
      .join(" ")
      .toLowerCase()
      .includes(state.search);
  });
}

function usageRowsFromState() {
  return buildTeamPokemonUsageRows(state.slots, state.pokemonAssignments, state.groupAssignments, document.querySelector("#graphics-source").value);
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
    .filter((item) => item.some((value) => String(value || "").trim()))
    .map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function restoreSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || "{}");
    state.pokemonAssignments = new Map(saved.pokemonAssignments || []);
    state.groupAssignments = new Map(saved.groupAssignments || []);
  } catch {
    state.pokemonAssignments = new Map();
    state.groupAssignments = new Map();
  }
}

function saveState() {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        pokemonAssignments: [...state.pokemonAssignments.entries()],
        groupAssignments: [...state.groupAssignments.entries()],
      }),
    );
  } catch {
    // Local persistence is optional.
  }
}

function storageKey() {
  return "gpl-team-graphics-entry";
}

function cropScale(slot) {
  return slot.season_id === "season_003" ? 1.25 : slot.season_id === "season_005" ? 0.58 : 0.8;
}

function compareGroups(a, b) {
  return compareSeasons(a.season_id, b.season_id) || a.source_file.localeCompare(b.source_file) || numberValue(a.graphic_row) - numberValue(b.graphic_row);
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
  return JSON.stringify(option);
}

function mergeSources(...values) {
  return [...new Set(values.flatMap((value) => String(value || "").split(";").map((item) => item.trim()).filter(Boolean)))].join(";");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function numberValue(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
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

function setStatus(value) {
  const status = document.querySelector("#graphics-status");
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
