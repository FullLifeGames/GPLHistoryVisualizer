const DEFAULT_VIEW = "all-time";
const VALID_VIEWS = new Set(["all-time", "killlists", "table-history", "match-plan", "battle-history", "video-archive", "person-details", "matchup"]);

export function parseRouteHash(hash) {
  const raw = String(hash ?? "").replace(/^#/, "").split("?")[0].replace(/^\/+/, "");
  const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "person" && parts[1]) {
    return { view: "person-details", personKey: parts[1] };
  }
  const view = VALID_VIEWS.has(parts[0]) ? parts[0] : DEFAULT_VIEW;
  return { view, personKey: null };
}

export function viewRouteHash(view) {
  return `#/${VALID_VIEWS.has(view) ? view : DEFAULT_VIEW}`;
}

export function personRouteHash(personKey) {
  return `#/person/${encodeURIComponent(personKey)}`;
}
