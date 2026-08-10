import { VIEW_GROUPS, defaultViewForGroup, isValidView } from "./view_config.js";

const DEFAULT_VIEW = "all-time";
const GROUP_IDS = new Set(VIEW_GROUPS.map((group) => group.id));

export function parseRouteHash(hash) {
  const raw = String(hash ?? "").replace(/^#/, "").split("?")[0].replace(/^\/+/, "");
  const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "person" && parts[1]) {
    return { view: "person-details", personKey: parts[1] };
  }
  if (parts[0] === "season" && parts[1]) {
    return { view: "season-detail", personKey: null, seasonId: parts[1] };
  }
  if (parts[0] === "pokemon" && parts[1]) {
    return { view: "pokemon-detail", personKey: null, pokemonKey: parts[1] };
  }
  if (parts[0] === "roster" && parts[1]) {
    return { view: "roster-detail", personKey: null, rosterKey: parts[1] };
  }
  if (parts[0] === "rivalitaet" && parts[1]) {
    const pair = parts[1].split("__");
    if (pair.length === 2 && pair[0] && pair[1]) {
      return { view: "rivalry-detail", personKey: null, rivalryKey: { aKey: pair[0], bKey: pair[1] } };
    }
    return { view: "rivalries", personKey: null };
  }
  if (GROUP_IDS.has(parts[0])) {
    return { view: defaultViewForGroup(parts[0]), personKey: null };
  }
  const view = isValidView(parts[0]) ? parts[0] : DEFAULT_VIEW;
  return { view, personKey: null };
}

export function viewRouteHash(view) {
  return `#/${isValidView(view) ? view : DEFAULT_VIEW}`;
}

export function personRouteHash(personKey) {
  return `#/person/${encodeURIComponent(personKey)}`;
}

export function seasonRouteHash(seasonId) {
  return `#/season/${encodeURIComponent(seasonId)}`;
}

export function pokemonRouteHash(pokemonKey) {
  return `#/pokemon/${encodeURIComponent(pokemonKey)}`;
}

export function rosterRouteHash(rosterKey) {
  return `#/roster/${encodeURIComponent(rosterKey)}`;
}

export function rivalryRouteHash(aKey, bKey) {
  return `#/rivalitaet/${encodeURIComponent(aKey)}__${encodeURIComponent(bKey)}`;
}
