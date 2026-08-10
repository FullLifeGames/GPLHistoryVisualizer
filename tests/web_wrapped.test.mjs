import assert from "node:assert/strict";
import test from "node:test";

import { careerWrappedCards, wrappedCards } from "../web/wrapped.js";

const AWARDS = [
  { award_key: "mvp", scope: "season", season_id: "season_004", person_id: "person_a", person_name: "Alice", value: "88.1", source_urls: "https://example.com/mvp" },
  { award_key: "kill_leader", scope: "season", season_id: "season_004", person_id: "person_b", person_name: "Bob", value: "61", source_urls: "https://example.com/kills" },
  { award_key: "upset_of_season", scope: "season", season_id: "season_004", person_id: "person_c", person_name: "Carol", value: "0.12", source_urls: "https://example.com/upset" },
  { award_key: "holzloeffel", scope: "season", season_id: "season_004", person_id: "person_d", person_name: "Dave", value: "14", source_urls: "https://example.com/spoon" },
  { award_key: "mvp", scope: "season", season_id: "season_005", person_id: "person_x", person_name: "Xavier", value: "90", source_urls: "https://example.com/other" },
];

const CHAMPIONS = [
  { season_id: "season_004", champion_name: "Alice", champion_person_id: "person_a", champion_team: "Team A", source_urls: "https://example.com/champ" },
];

const HIGHLIGHTS = [
  { season_id: "season_004", match_id: "m1", player_a: "Alice", player_b: "Bob", score: "6 - 5", close_match: "1", highlight_score: "70", video_urls: "https://youtube.com/watch?v=a", source_urls: "https://example.com/h1" },
  { season_id: "season_004", match_id: "m2", player_a: "Carol", player_b: "Dave", score: "6 - 0", close_match: "0", highlight_score: "90", video_urls: "", source_urls: "https://example.com/h2" },
];

const VIDEOS = [
  { video_id: "a", title: "Big Final", channel_title: "Present", detected_season_id: "season_004", view_count: "50000", video_url: "https://youtube.com/watch?v=a", source_urls: "https://example.com/v" },
  { video_id: "b", title: "Other Season", channel_title: "Raizor", detected_season_id: "season_005", view_count: "99999", video_url: "https://youtube.com/watch?v=b", source_urls: "https://example.com/v2" },
];

test("season cards cover all data-backed keys in deck order", () => {
  const cards = wrappedCards({ seasonId: "season_004", awards: AWARDS, champions: CHAMPIONS, highlights: HIGHLIGHTS, videos: VIDEOS });
  assert.deepEqual(cards.map((card) => card.key), ["champion", "upset", "mvp", "kill_leader", "top_video", "closest", "spoon"]);
  const champion = cards[0];
  assert.equal(champion.name, "Alice");
  assert.equal(champion.computed, false);
  const mvp = cards.find((card) => card.key === "mvp");
  assert.equal(mvp.computed, true);
  assert.equal(mvp.personId, "person_a");
});

test("top video only counts videos of the season", () => {
  const card = wrappedCards({ seasonId: "season_004", awards: [], champions: [], highlights: [], videos: VIDEOS }).find(
    (entry) => entry.key === "top_video",
  );
  assert.equal(card.name, "Big Final");
  assert.equal(card.value, 50000);
});

test("closest match prefers close_match rows by highlight score", () => {
  const card = wrappedCards({ seasonId: "season_004", awards: [], champions: [], highlights: HIGHLIGHTS, videos: [] }).find(
    (entry) => entry.key === "closest",
  );
  assert.equal(card.detail, "6 - 5");
});

test("cards without data are omitted", () => {
  const cards = wrappedCards({ seasonId: "season_009", awards: AWARDS, champions: CHAMPIONS, highlights: HIGHLIGHTS, videos: VIDEOS });
  assert.deepEqual(cards, []);
});

test("career cards read person_all_time and count awards", () => {
  const personRow = {
    person_id: "person_a",
    person_name: "Alice",
    seasons: "5",
    seasons_won: "2",
    title_seasons: "S4, S6",
    matches: "120",
    wins: "80",
    losses: "38",
    draws: "2",
    win_pct: "66.7",
    elo: "1642",
    kills: "400",
    source_urls: "https://example.com/p",
  };
  const cards = careerWrappedCards({ personRow, awards: AWARDS, champions: CHAMPIONS });
  assert.deepEqual(cards.map((card) => card.key), ["titles", "matches", "kills", "elo", "awards"]);
  const titles = cards[0];
  assert.equal(titles.value, 2);
  assert.equal(titles.detail, "S4, S6");
  const awardsCard = cards.find((card) => card.key === "awards");
  assert.equal(awardsCard.value, 1); // one season award for person_a
});

test("career cards include spoons when present", () => {
  const personRow = { person_id: "person_d", person_name: "Dave", seasons_won: "0", matches: "40", wins: "10", losses: "30", draws: "0", win_pct: "25", elo: "1400", kills: "80", source_urls: "" };
  const cards = careerWrappedCards({ personRow, awards: AWARDS, champions: CHAMPIONS });
  const spoons = cards.find((card) => card.key === "spoons");
  assert.equal(spoons.value, 1);
});
