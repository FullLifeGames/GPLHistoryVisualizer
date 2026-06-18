import csv

from gpl_history.pokemon_drafts import (
    OLD_PROJECT_EWIGE_TABELLE_URL,
    _old_project_team_note_usage_rows,
    _write_csv,
    build_and_write_pokemon_draft_overview,
    build_pokemon_draft_instances,
    build_pokemon_draft_overview,
    parse_showdown_tiers,
)


FORMATS_DATA = """
export const FormatsData = {
  bulbasaur: {
    tier: "LC",
    natDexTier: "LC",
  },
  charizard: {
    tier: "ZU",
  },
  charizardmegax: {
    tier: "Uber",
  },
  gengarmega: {
    isNonstandard: "Past",
    tier: "Illegal",
    natDexTier: "OU",
  },
  gengargmax: {
    isNonstandard: "Past",
    tier: "Illegal",
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
    assert "charizard" not in by_asset
    assert int(by_asset["bulbasaur"]["tier_rank"]) > int(by_asset["charizardmegax"]["tier_rank"])


def test_build_pokemon_draft_overview_uses_gen9_natdex_for_never_picked_forms():
    translations = [
        {"species_id": "94", "german": "Mega-Gengar", "english": "gengar-mega", "asset_id": "gengarmega", "source_url": "pokeapi"},
        {"species_id": "94", "german": "Giga-Gengar", "english": "gengar-gmax", "asset_id": "gengargmax", "source_url": "pokeapi"},
        {"species_id": "25", "german": "Pikachu", "english": "Pikachu", "asset_id": "pikachu", "source_url": "pokeapi"},
    ]
    killlists = [
        {
            "season_id": "season_008",
            "pokemon": "Giga-Gengar",
            "pokemon_normalized": "giga gengar",
            "trainer": "A",
            "team_name": "Alpha",
            "data_status": "sheet_extracted",
            "source_urls": "picked-gmax-source",
        },
    ]

    rows = build_pokemon_draft_overview(translations, killlists, [], FORMATS_DATA)
    by_asset = {row["asset_id"]: row for row in rows}

    assert by_asset["gengarmega"]["picked_status"] == "never_picked"
    assert by_asset["gengarmega"]["tier"] == "OU"
    assert by_asset["gengarmega"]["tier_rank"] == "3"
    assert by_asset["gengargmax"]["picked_status"] == "picked"
    assert by_asset["gengargmax"]["draft_count"] == "1"

    never_picked_assets = {row["asset_id"] for row in rows if row["picked_status"] == "never_picked"}
    assert "gengarmega" in never_picked_assets
    assert "gengargmax" not in never_picked_assets


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
            "division": "Playoffs",
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


def test_build_pokemon_draft_overview_uses_playoff_roster_for_playoff_titles():
    translations = [
        {"species_id": "959", "german": "Granforgita", "english": "Tinkaton", "asset_id": "tinkaton", "source_url": "pokeapi"},
        {"species_id": "625", "german": "Caesurio", "english": "Bisharp", "asset_id": "bisharp", "source_url": "pokeapi"},
    ]
    team_usage = [
        {
            "season_id": "season_010",
            "division": "Regular Season",
            "roster_phase": "regular",
            "pokemon": "Granforgita",
            "pokemon_normalized": "granforgita",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "team_name": "Wackel Backel",
            "data_status": "sheet_extracted",
            "source_urls": "regular-kader",
        },
        {
            "season_id": "season_010",
            "division": "Playoffs",
            "roster_phase": "playoffs",
            "pokemon": "Caesurio",
            "pokemon_normalized": "caesurio",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "team_name": "Wackel Backel",
            "data_status": "sheet_extracted",
            "source_urls": "playoff-kader",
        },
    ]
    champions = [
        {
            "season_id": "season_010",
            "champion_name": "Bene",
            "champion_person_id": "person_bene",
            "champion_team": "Wackel Backel",
            "evidence_type": "playoff_final_kader_status",
            "data_status": "source_evidenced",
        }
    ]

    killlists = [
        {
            "season_id": "season_010",
            "division": "Playoffs",
            "pokemon": "Granforgita",
            "pokemon_normalized": "granforgita",
            "trainer": "Bene",
            "trainer_normalized": "bene",
            "team_name": "",
            "data_status": "sheet_extracted",
            "source_urls": "playoff-killlist",
        },
    ]

    rows = build_pokemon_draft_overview(translations, killlists, team_usage, FORMATS_DATA, champions)
    by_asset = {row["asset_id"]: row for row in rows}

    assert by_asset["tinkaton"]["title_count"] == "0"
    assert by_asset["tinkaton"]["title_seasons"] == ""
    assert by_asset["bisharp"]["title_count"] == "1"
    assert by_asset["bisharp"]["title_seasons"] == "S10"


def test_old_project_team_notes_supply_zero_kill_draft_assignments(tmp_path):
    sheets_dir = tmp_path / "raw" / "season_003" / "sheets"
    sheets_dir.mkdir(parents=True)
    _write_csv(
        sheets_dir / "1jzpa_5xdldn2bjfvhvbphyk_1aenetlnf1uxnepwlna_ewige_tabelle_gpl_352888197.csv",
        ["Pokemon", "S2", "Team Note 1"],
        [{"Pokemon": "Mega-Latios", "S2": "0", "Team Note 1": "Cabgolord S2"}],
    )
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "teams.csv",
        [
            "season_id",
            "person_id",
            "person_name",
            "person_name_normalized",
            "team_name",
            "team_name_normalized",
            "division",
            "source_urls",
        ],
        [
            {
                "season_id": "season_002",
                "person_id": "person_fnupa",
                "person_name": "Cabgolord",
                "person_name_normalized": "fnupa",
                "team_name": "Doomforce",
                "team_name_normalized": "doomforce",
                "division": "Regular Season",
                "source_urls": "team-source",
            }
        ],
    )

    rows = _old_project_team_note_usage_rows(tmp_path)

    assert rows == [
        {
            "season_id": "season_002",
            "division": "Regular Season",
            "team_name": "Doomforce",
            "team_name_normalized": "doomforce",
            "person_name": "Cabgolord",
            "person_name_normalized": "fnupa",
            "pokemon": "Mega-Latios",
            "pokemon_normalized": "megalatios",
            "data_status": "old_project_team_note",
            "source_files": str(sheets_dir / "1jzpa_5xdldn2bjfvhvbphyk_1aenetlnf1uxnepwlna_ewige_tabelle_gpl_352888197.csv"),
            "source_urls": f"{OLD_PROJECT_EWIGE_TABELLE_URL};team-source",
            "notes": "Pick-Zuordnung aus Team-Note-Zelle der alten Ewigen GPL-Tabelle; keine Kill-Aussage.",
        }
    ]


def test_pokemon_draft_overview_uses_old_project_team_notes(tmp_path):
    (tmp_path / "raw" / "pokemon_showdown").mkdir(parents=True)
    (tmp_path / "raw" / "pokemon_showdown" / "formats-data.ts").write_text(
        """
export const FormatsData = {
  latiosmega: {
    tier: "Illegal",
    natDexTier: "OU",
  },
};
""",
        encoding="utf-8",
    )
    sheets_dir = tmp_path / "raw" / "season_003" / "sheets"
    sheets_dir.mkdir(parents=True)
    _write_csv(
        sheets_dir / "1jzpa_5xdldn2bjfvhvbphyk_1aenetlnf1uxnepwlna_ewige_tabelle_gpl_352888197.csv",
        ["Pokemon", "S2", "Team Note 1"],
        [{"Pokemon": "Mega-Latios", "S2": "0", "Team Note 1": "Cabgolord S2"}],
    )
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    _write_csv(
        normalized / "pokemon_name_translations.csv",
        ["species_id", "german", "english", "asset_id", "source_url"],
        [{"species_id": "381", "german": "Mega-Latios", "english": "latios-mega", "asset_id": "latiosmega", "source_url": "pokeapi"}],
    )
    _write_csv(normalized / "pokemon_killlists.csv", [], [])
    _write_csv(normalized / "team_rosters.csv", [], [])
    _write_csv(normalized / "champions.csv", [], [])
    _write_csv(
        normalized / "teams.csv",
        [
            "season_id",
            "person_id",
            "person_name",
            "person_name_normalized",
            "team_name",
            "team_name_normalized",
            "division",
            "source_urls",
        ],
        [
            {
                "season_id": "season_002",
                "person_id": "person_fnupa",
                "person_name": "Cabgolord",
                "person_name_normalized": "fnupa",
                "team_name": "Doomforce",
                "team_name_normalized": "doomforce",
                "division": "Regular Season",
                "source_urls": "team-source",
            }
        ],
    )

    rows = build_and_write_pokemon_draft_overview(tmp_path)

    assert rows[0]["asset_id"] == "latiosmega"
    assert rows[0]["draft_count"] == "1"
    assert rows[0]["season_list"] == "S2"
    assert rows[0]["trainer_count"] == "1"
    assert rows[0]["team_count"] == "1"
    assert rows[0]["picked_status"] == "picked"
    assert f"{OLD_PROJECT_EWIGE_TABELLE_URL};team-source" in rows[0]["source_urls"]

    with (normalized / "pokemon_draft_instances.csv").open(encoding="utf-8", newline="") as handle:
        instance_rows = list(csv.DictReader(handle))
    assert instance_rows == [
        {
            "season_id": "season_002",
            "division": "Regular Season",
            "roster_phase": "",
            "pokemon": "Mega-Latios",
            "pokemon_normalized": "megalatios",
            "asset_id": "latiosmega",
            "person_name": "Cabgolord",
            "person_name_normalized": "fnupa",
            "team_name": "Doomforce",
            "team_name_normalized": "doomforce",
            "data_status": "old_project_team_note",
            "source_urls": f"{OLD_PROJECT_EWIGE_TABELLE_URL};team-source",
        }
    ]


def test_build_pokemon_draft_instances_flattens_assignments():
    translations = [{"species_id": "6", "german": "Mega-Glurak X", "english": "charizard-mega-x", "asset_id": "charizardmegax"}]
    instances = build_pokemon_draft_instances(
        translations,
        [],
        [
            {
                "season_id": "season_003",
                "division": "Liga 1",
                "roster_phase": "hinrunde",
                "pokemon": "Mega-Glurak X",
                "person_name": "Bene",
                "person_name_normalized": "bene",
                "team_name": "Ritter",
                "data_status": "manual_override",
                "source_urls": "manual-source",
            }
        ],
    )

    assert instances == [
        {
            "season_id": "season_003",
            "division": "Liga 1",
            "roster_phase": "hinrunde",
            "pokemon": "Mega-Glurak X",
            "pokemon_normalized": "megaglurakx",
            "asset_id": "charizardmegax",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "team_name": "Ritter",
            "team_name_normalized": "ritter",
            "data_status": "manual_override",
            "source_urls": "manual-source",
        }
    ]
