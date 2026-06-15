from gpl_history.pokemon_drafts import _write_csv, build_pokemon_draft_overview, parse_showdown_tiers


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


def test_pokemon_draft_csv_writer_uses_lf_line_endings(tmp_path):
    path = tmp_path / "drafts.csv"

    _write_csv(path, ["name"], [{"name": "Bene"}])

    assert path.read_bytes() == b"name\nBene\n"


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


def test_build_pokemon_draft_overview_counts_titles_from_champion_teams_once_per_season():
    translations = [
        {"species_id": "25", "german": "Pikachu", "english": "Pikachu", "asset_id": "pikachu", "source_url": "pokeapi"},
        {"species_id": "1", "german": "Bisasam", "english": "Bulbasaur", "asset_id": "bulbasaur", "source_url": "pokeapi"},
    ]
    killlists = [
        {
            "season_id": "season_009",
            "pokemon": "Pikachu",
            "pokemon_normalized": "pikachu",
            "trainer": "",
            "team_name": "Victory Instinct",
            "data_status": "sheet_extracted",
            "source_urls": "s9-overall",
        },
        {
            "season_id": "season_009",
            "pokemon": "Pikachu",
            "pokemon_normalized": "pikachu",
            "trainer": "",
            "team_name": "Victory Instinct",
            "data_status": "sheet_extracted",
            "source_urls": "s9-doubles",
        },
        {
            "season_id": "season_010",
            "pokemon": "Pikachu",
            "pokemon_normalized": "pikachu",
            "trainer": "Bene",
            "team_name": "Wackel Backel",
            "data_status": "sheet_extracted",
            "source_urls": "s10-playoffs",
        },
        {
            "season_id": "season_010",
            "pokemon": "Bisasam",
            "pokemon_normalized": "bisasam",
            "trainer": "Raizor",
            "team_name": "Finalist Team",
            "data_status": "sheet_extracted",
            "source_urls": "s10-finalist",
        },
    ]
    champions = [
        {
            "season_id": "season_009",
            "champion_name": "BelmontGabriel",
            "champion_team": "Victory Instinct",
            "data_status": "user_provided",
        },
        {
            "season_id": "season_009",
            "champion_name": "El Scizor",
            "champion_team": "Victory Instinct",
            "data_status": "source_evidenced",
        },
        {
            "season_id": "season_009",
            "champion_name": "Bene",
            "champion_team": "Victory Instinct",
            "data_status": "source_evidenced",
        },
        {
            "season_id": "season_010",
            "champion_name": "Bene",
            "champion_team": "Wackel Backel",
            "data_status": "source_evidenced",
        },
    ]

    rows = build_pokemon_draft_overview(translations, killlists, [], FORMATS_DATA, champions)
    by_asset = {row["asset_id"]: row for row in rows}

    assert by_asset["pikachu"]["title_count"] == "2"
    assert by_asset["pikachu"]["title_seasons"] == "S9, S10"
    assert by_asset["bulbasaur"]["title_count"] == "0"
    assert by_asset["bulbasaur"]["title_seasons"] == ""


def test_build_pokemon_draft_overview_counts_titles_by_champion_person_when_killlist_team_is_missing():
    translations = [
        {"species_id": "637", "german": "Ramoth", "english": "Volcarona", "asset_id": "volcarona", "source_url": "pokeapi"},
    ]
    killlists = [
        {
            "season_id": "season_010",
            "pokemon": "Ramoth",
            "pokemon_normalized": "ramoth",
            "trainer": "Bene",
            "trainer_normalized": "bene",
            "team_name": "",
            "data_status": "sheet_extracted",
            "source_urls": "s10-playoffs",
        }
    ]
    champions = [
        {
            "season_id": "season_010",
            "champion_name": "Bene",
            "champion_person_id": "person_bene",
            "champion_team": "Wackel Backel",
            "data_status": "source_evidenced",
        },
    ]

    rows = build_pokemon_draft_overview(translations, killlists, [], FORMATS_DATA, champions)

    assert rows[0]["title_count"] == "1"
    assert rows[0]["title_seasons"] == "S10"


def test_build_pokemon_draft_overview_counts_titles_with_normalized_champion_person_fallback():
    translations = [
        {"species_id": "59", "german": "Arkani", "english": "Arcanine", "asset_id": "arcanine", "source_url": "pokeapi"},
    ]
    killlists = [
        {
            "season_id": "season_001",
            "pokemon": "Arkani",
            "pokemon_normalized": "arkani",
            "trainer": "PresentLP",
            "trainer_normalized": "present",
            "team_name": "",
            "data_status": "sheet_extracted",
            "source_urls": "s1-killlist",
        },
        {
            "season_id": "season_001",
            "pokemon": "Arkani",
            "pokemon_normalized": "arkani",
            "trainer": "SteveParker",
            "trainer_normalized": "steveparker",
            "team_name": "",
            "data_status": "sheet_extracted",
            "source_urls": "s1-other-usage",
        },
    ]
    champions = [
        {
            "season_id": "season_001",
            "champion_name": "PresentLP",
            "champion_person_id": "person_present",
            "champion_team": "Prekani",
            "data_status": "source_evidenced",
        },
    ]

    rows = build_pokemon_draft_overview(translations, killlists, [], FORMATS_DATA, champions)

    assert rows[0]["draft_count"] == "2"
    assert rows[0]["title_count"] == "1"
    assert rows[0]["title_seasons"] == "S1"
