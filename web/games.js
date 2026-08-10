// Shared game utilities: deterministic daily puzzles need a seedable RNG
// (mulberry32 over a string hash) so every visitor sees the same puzzle on
// the same day, and streaks survive reloads via plain serializable state.

export function seededRandom(seedString) {
  const text = String(seedString ?? "");
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickIndex(rng, length) {
  if (!length) return -1;
  return Math.min(length - 1, Math.floor(rng() * length));
}

export function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function dateSeedString(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function previousDateString(dateString) {
  const parsed = Date.parse(`${dateString}T00:00:00Z`);
  return new Date(parsed - DAY_MS).toISOString().slice(0, 10);
}

export function updateDailyStreak(prev, dateString, solved) {
  const state = prev && typeof prev === "object" ? prev : { streak: 0, best: 0, lastDate: "" };
  if (state.lastDate === dateString) {
    return state;
  }
  if (!solved) {
    return { streak: 0, best: state.best || 0, lastDate: dateString };
  }
  const streak = state.lastDate === previousDateString(dateString) ? (state.streak || 0) + 1 : 1;
  return { streak, best: Math.max(state.best || 0, streak), lastDate: dateString };
}
