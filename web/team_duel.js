// Pure matchup-sheet computation for the Zeitmaschinen-Duell view. All
// gen-mechanical lookups go through an injected adapter so node tests run
// on literal fixtures and the browser can degrade to text badges when the
// @pkmn CDN bundles are unavailable. No DOM access.
import { pokemonAssetId } from "./pokemon_names.js";
import { rosterSeasonGeneration } from "./stats.js";

export function teamDuelRosters(teamRosters = []) {
  const byKey = new Map();
  for (const row of teamRosters ?? []) {
    const seasonId = row.season_id || "";
    const personName = row.person_name || "";
    const teamName = row.team_name || "";
    if (!seasonId || (!personName && !teamName)) continue;
    const key = JSON.stringify([
      seasonId,
      row.division || "",
      row.person_name_normalized || personName.toLowerCase(),
      row.team_name_normalized || teamName.toLowerCase(),
    ]);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        seasonId,
        division: row.division || "",
        teamName,
        personName,
        pokemon: [],
        seen: new Set(),
        sourceUrls: row.source_urls || "",
      });
    }
    const entry = byKey.get(key);
    const mon = row.pokemon || "";
    const monKey = row.pokemon_normalized || mon.toLowerCase();
    if (!mon || entry.seen.has(monKey)) continue;
    entry.seen.add(monKey);
    entry.pokemon.push(mon);
  }
  const rosters = [...byKey.values()].filter((entry) => entry.pokemon.length);
  for (const entry of rosters) delete entry.seen;
  rosters.sort(
    (a, b) =>
      a.seasonId.localeCompare(b.seasonId, "en") ||
      a.division.localeCompare(b.division, "de") ||
      (a.personName || a.teamName).localeCompare(b.personName || b.teamName, "de"),
  );
  return rosters;
}
