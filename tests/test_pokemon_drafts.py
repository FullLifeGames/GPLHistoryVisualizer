from gpl_history.pokemon_drafts import build_pokemon_draft_overview, parse_showdown_tiers


FORMATS_DATA = """
export const FormatsData = {
  bulbasaur: {
    tier: "LC",
  },
  charizard: {
    tier: "ZU",
  },
  charizardmegax: {
    tier: "Uber",
  },
  pikachu: {
    tier: "ZU",
  },
};
"""


def test_parse_showdown_tiers_reads_format_data_blocks():
    tiers = parse_showdown_tiers(FORMATS_DATA)

    assert tiers["bulbasaur"]["tier"] == "LC"
    assert tiers["charizardmegax"]["tier"] == "Uber"


def test_build_pokemon_draft_overview_is_form_level_and_marks_never_picked():
    translations = [
        {"species_id": "1", "german": "Bisasam", "english": "Bulbasaur", "asset_id": "bulbasaur", "source_url": "pokeapi"},
        {"species_id": "6", "german": "Glurak", "english": "Charizard", "asset_id": "charizard", "source_url": "pokeapi"},
        {"species_id": "6", "german": "Mega-Glurak X", "english": "charizard-mega-x", "asset_id": "charizardmegax", "source_url": "pokeapi"},
        {"species_id": "25", "german": "Pikachu", "english": "Pikachu", "asset_id": "pikachu", "source_url": "pokeapi"},
    ]
    killlists = [
        {
            "season_id": "season_001",
            "pokemon": "Pikachu",
            "pokemon_normalized": "pikachu",
            "trainer": "A",
            "team_name": "Alpha",
            "data_status": "sheet_extracted",
            "source_urls": "kill-source",
        },
        {
            "season_id": "season_001",
            "pokemon": "Pikachu",
            "pokemon_normalized": "pikachu",
            "trainer": "A",
            "team_name": "Alpha",
            "data_status": "sheet_extracted",
            "source_urls": "duplicate-kill-source",
        },
    ]
    team_usage = [
        {
            "season_id": "season_003",
            "pokemon": "Mega-Glurak X",
            "pokemon_normalized": "mega glurak x",
            "person_name": "B",
            "team_name": "Beta",
            "source_urls": "usage-source",
        }
    ]

    rows = build_pokemon_draft_overview(translations, killlists, team_usage, FORMATS_DATA)
    by_asset = {row["asset_id"]: row for row in rows}

    assert by_asset["charizardmegax"]["draft_count"] == "1"
    assert by_asset["charizardmegax"]["picked_status"] == "picked"
    assert by_asset["charizardmegax"]["tier"] == "Uber"
    assert by_asset["charizardmegax"]["season_list"] == "S3"
    assert by_asset["pikachu"]["draft_count"] == "1"
    assert by_asset["pikachu"]["source_urls"] == "pokeapi;kill-source"
    assert by_asset["charizard"]["draft_count"] == "0"
    assert by_asset["charizard"]["picked_status"] == "never_picked"
    assert int(by_asset["bulbasaur"]["tier_rank"]) > int(by_asset["charizardmegax"]["tier_rank"])
