import csv
import json

import pytest

from gpl_history.wrapped_cards import wrapped_card_texts

AWARDS = [
    {"award_key": "mvp", "scope": "season", "season_id": "season_004", "person_id": "person_a", "person_name": "Alice", "value": "88.1", "source_urls": "u"},
    {"award_key": "holzloeffel", "scope": "season", "season_id": "season_004", "person_id": "person_d", "person_name": "Dave", "value": "14", "source_urls": "u"},
]
CHAMPIONS = [
    {"season_id": "season_004", "champion_name": "Alice", "champion_person_id": "person_a", "champion_team": "Team A", "source_urls": "u"},
]
HIGHLIGHTS = [
    {"season_id": "season_004", "match_id": "m1", "player_a": "Alice", "player_b": "Bob", "score": "6 - 5", "close_match": "1", "highlight_score": "70", "video_urls": "", "source_urls": "u"},
]
VIDEOS = [
    {"video_id": "a", "title": "Big Final", "channel_title": "Present", "detected_season_id": "season_004", "view_count": "50000", "video_url": "", "source_urls": "u"},
]


def test_card_texts_mirror_frontend_semantics():
    cards = wrapped_card_texts(AWARDS, CHAMPIONS, HIGHLIGHTS, VIDEOS)
    keys = [(card["season_id"], card["card_key"]) for card in cards]
    assert ("season_004", "champion") in keys
    assert ("season_004", "mvp") in keys
    assert ("season_004", "top_video") in keys
    assert ("season_004", "closest") in keys
    assert ("season_004", "spoon") in keys
    champion = next(card for card in cards if card["card_key"] == "champion")
    assert champion["name"] == "Alice"
    assert champion["title"] == "Champion"
    assert champion["computed"] is False
    top_video = next(card for card in cards if card["card_key"] == "top_video")
    assert top_video["value_line"] == "50.000 Aufrufe"


def test_seasons_without_data_get_no_cards():
    assert wrapped_card_texts([], [], [], []) == []


def test_render_writes_pngs_and_manifest(tmp_path):
    pytest.importorskip("PIL")
    from gpl_history.wrapped_cards import render_wrapped_cards

    normalized = tmp_path / "data" / "normalized"
    normalized.mkdir(parents=True)

    def write(name, rows):
        with open(normalized / name, "w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]), lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows)

    write("awards.csv", AWARDS)
    write("champions.csv", CHAMPIONS)
    write("match_highlights.csv", HIGHLIGHTS)
    write("video_archive.csv", VIDEOS)

    web_dir = tmp_path / "web"
    count = render_wrapped_cards(tmp_path / "data", web_dir)
    assert count >= 5
    manifest = json.loads((web_dir / "assets" / "wrapped" / "manifest.json").read_text(encoding="utf-8"))
    assert len(manifest["cards"]) == count
    for card in manifest["cards"]:
        assert (web_dir / "assets" / "wrapped" / card["file"]).exists()
