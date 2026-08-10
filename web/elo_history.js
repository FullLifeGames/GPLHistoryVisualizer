// Per-match Elo chronology derived from the same eloRatings walk the
// all-time table uses, so every number here matches the published Elo
// column by construction. Ratings stay unrounded; rounding happens at
// render time.
import { eloRatings, normalizedStatsKey } from "./stats.js";

export function eloChronology(matches = [], normalizeKey = normalizedStatsKey) {
  const perMatch = new Map();
  const perPerson = new Map();
  const order = [];

  const track = (key, name, matchId, seasonId, rating) => {
    if (!perPerson.has(key)) {
      perPerson.set(key, { name, points: [], peak: { rating: -Infinity, matchId: "" } });
    }
    const person = perPerson.get(key);
    if (!person.name && name) person.name = name;
    person.points.push({ seq: person.points.length, matchId, seasonId: seasonId || "", rating });
    if (rating > person.peak.rating) person.peak = { rating, matchId };
  };

  const finalRows = eloRatings(matches, normalizeKey, {
    onMatch: (row, ratings, details) => {
      if (!details) return;
      const matchId = String(row.match_id || "");
      order.push(matchId);
      perMatch.set(matchId, {
        aKey: details.leftKey,
        bKey: details.rightKey,
        aName: row.player_a || row.team_a || "",
        bName: row.player_b || row.team_b || "",
        eloPreA: details.leftBefore,
        eloPreB: details.rightBefore,
        winProbA: details.leftExpected,
        eloAfterA: details.leftAfter,
        eloAfterB: details.rightAfter,
        deltaA: details.leftAfter - details.leftBefore,
        deltaB: details.rightAfter - details.rightBefore,
        seasonId: row.season_id || "",
        week: row.week || "",
        stage: row.stage || "",
      });
      track(details.leftKey, row.player_a || row.team_a || "", matchId, row.season_id, details.leftAfter);
      track(details.rightKey, row.player_b || row.team_b || "", matchId, row.season_id, details.rightAfter);
    },
  });

  return { perMatch, perPerson, order, finalRows };
}
