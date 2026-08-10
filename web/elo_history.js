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

// Career series for one person: every post-match rating in sequence, with
// season/team stint bands and championship markers placed on the sequence
// axis. Bands group the person's own points by season, so gaps between the
// person's active seasons never stretch a band across seasons they sat out.
export function personEloSeries(personKey, chronology, stintRows = [], championRows = [], normalizeKey = normalizedStatsKey) {
  const person = chronology.perPerson.get(personKey);
  if (!person || !person.points.length) {
    return { points: [], bands: [], markers: [], peak: { rating: -Infinity, matchId: "" } };
  }

  const teamBySeason = new Map();
  for (const row of stintRows) {
    if (normalizeKey(row.person_name) !== personKey) continue;
    const existing = teamBySeason.get(row.season_id);
    const team = row.team_name || "";
    teamBySeason.set(row.season_id, existing && existing !== team ? `${existing} / ${team}` : team);
  }

  const bands = [];
  for (const point of person.points) {
    const last = bands[bands.length - 1];
    if (last && last.seasonId === point.seasonId) {
      last.toSeq = point.seq;
    } else {
      bands.push({ seasonId: point.seasonId, fromSeq: point.seq, toSeq: point.seq });
    }
  }
  for (const band of bands) {
    const team = teamBySeason.get(band.seasonId) || "";
    const season = seasonShortLabel(band.seasonId);
    band.label = team ? `${season} · ${team}` : season;
    band.shortLabel = season;
  }

  const lastPointBySeason = new Map();
  for (const point of person.points) {
    lastPointBySeason.set(point.seasonId, point);
  }
  const markers = [];
  for (const row of championRows) {
    if (normalizeKey(row.champion_name) !== personKey) continue;
    const point = lastPointBySeason.get(row.season_id);
    if (!point) continue;
    markers.push({ seq: point.seq, rating: point.rating, seasonId: row.season_id, label: seasonShortLabel(row.season_id) });
  }

  return { points: person.points, bands, markers, peak: person.peak };
}

// One ledger row per rated match of a person, in chronological order, with
// the signed Elo movement and the source match row's display fields joined in.
export function eloLedgerRows(personKey, chronology, matches = [], normalizeKey = normalizedStatsKey) {
  const matchById = new Map(matches.map((row) => [String(row.match_id || ""), row]));
  const rows = [];
  for (const matchId of chronology.order) {
    const entry = chronology.perMatch.get(matchId);
    if (!entry || (entry.aKey !== personKey && entry.bKey !== personKey)) continue;
    const isA = entry.aKey === personKey;
    const opponentKey = isA ? entry.bKey : entry.aKey;
    const source = matchById.get(matchId) || {};
    const winnerKey = normalizeKey(source.winner);
    rows.push({
      match_id: matchId,
      season_id: entry.seasonId,
      week: entry.week,
      stage: entry.stage,
      division: source.division || "",
      opponent_name: isA ? entry.bName : entry.aName,
      opponent_key: opponentKey,
      score: orientedScore(source, isA),
      result: winnerKey === personKey ? "win" : winnerKey === opponentKey ? "loss" : "draw",
      elo_delta: isA ? entry.deltaA : entry.deltaB,
      elo_after: isA ? entry.eloAfterA : entry.eloAfterB,
      video_url: source.video_url || "",
      source_urls: source.source_urls || "",
    });
  }
  return rows;
}

// Scores are stored in player_a:player_b order; views that reorder the
// participants (winner-first, focused-person-first) must flip the score with
// them or the display implies the wrong side won.
function orientedScore(row, firstIsA) {
  const parts = [row.score_a, row.score_b].filter((value) => value !== undefined && value !== "");
  if (parts.length < 2) return parts.join(":");
  return firstIsA ? `${row.score_a}:${row.score_b}` : `${row.score_b}:${row.score_a}`;
}

function seasonShortLabel(seasonId) {
  const match = String(seasonId || "").match(/season_0*(\d+)/);
  return match ? `S${match[1]}` : String(seasonId || "");
}

// Ranks decided matches by how improbable the winner's victory was under the
// pregame Elo. Forfeits stay out: the league counted them as wins, but nobody
// beat the odds in a match that was never played. Draws have no winner to rank.
export function upsetRows(matches = [], chronology, highlightRows = [], normalizeKey = normalizedStatsKey) {
  const zByMatch = new Map(
    highlightRows.map((row) => [String(row.match_id || ""), row.views_z_score_peak ?? ""]),
  );
  const rows = [];
  for (const row of matches) {
    if (["forfeit", "unresolved", "draw"].includes(row.result_basis || "")) continue;
    const entry = chronology.perMatch.get(String(row.match_id || ""));
    const winnerKey = normalizeKey(row.winner);
    if (!entry || !winnerKey || (winnerKey !== entry.aKey && winnerKey !== entry.bKey)) continue;
    const winnerIsA = winnerKey === entry.aKey;
    const winProb = winnerIsA ? entry.winProbA : 1 - entry.winProbA;
    rows.push({
      match_id: String(row.match_id || ""),
      season_id: row.season_id || "",
      division: row.division || "",
      stage: row.stage || "",
      week: row.week || "",
      winner_name: winnerIsA ? entry.aName : entry.bName,
      winner_key: winnerKey,
      loser_name: winnerIsA ? entry.bName : entry.aName,
      loser_key: winnerIsA ? entry.bKey : entry.aKey,
      elo_pre_winner: winnerIsA ? entry.eloPreA : entry.eloPreB,
      elo_pre_loser: winnerIsA ? entry.eloPreB : entry.eloPreA,
      win_prob_winner: winProb,
      upset_score: 1 - winProb,
      score: orientedScore(row, winnerIsA),
      video_url: row.video_url || "",
      views_z_score: zByMatch.get(String(row.match_id || "")) ?? "",
      source_urls: row.source_urls || "",
    });
  }
  return rows.sort(
    (a, b) => b.upset_score - a.upset_score || String(a.match_id).localeCompare(String(b.match_id)),
  );
}
