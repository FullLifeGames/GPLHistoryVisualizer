from collections import Counter
from pathlib import Path

from gpl_history.normalize import (
    _canonical_name,
    _display_name,
    _match_row,
    _person_id,
    _records_from_rows,
    _schedule_matches_from_rows,
    _write_csv,
    normalize_all,
)


def test_aliases_merge_to_preferred_person_display_names():
    assert _canonical_name("FullLifeGames") == "bene"
    assert _person_id("FullLifeGames") == "person_bene"
    assert _display_name("FullLifeGames") == "Bene"

    assert _canonical_name("Kaffecone") == "art n gaming"
    assert _canonical_name("Kaffeecone") == "art n gaming"
    assert _person_id("Kaffeecone") == "person_art_n_gaming"
    assert _display_name("Kaffecone") == "Art'n'Gaming"
    assert _display_name("TeamMauni") == "Maxi von Vogel"
    assert _display_name("Maxi [Team Mauni]") == "Maxi von Vogel"
    assert _display_name("DauniDaunstar") == "Dauni Daunstar"
    assert _display_name("Raizor Zockt") == "Raizor"
    assert _display_name("ProfessorN") == "Professor N"
    assert _canonical_name("CabgoLord") == "fnupa"
    assert _person_id("Cabgolord") == "person_fnupa"


def test_write_csv_retries_transient_windows_invalid_argument(tmp_path, monkeypatch):
    path = tmp_path / "rows.csv"
    original_open = Path.open
    calls = 0

    def flaky_open(self, *args, **kwargs):
        nonlocal calls
        if self == path and calls == 0:
            calls += 1
            raise OSError(22, "Invalid argument")
        return original_open(self, *args, **kwargs)

    monkeypatch.setattr(Path, "open", flaky_open)

    _write_csv(path, ["name"], [{"name": "Bene"}])

    assert path.read_bytes() == b"name\nBene\n"
    assert calls == 1
    assert _display_name("CabgoLord") == "Fnupa"


def test_person_labels_drop_result_and_rule_notes_before_aliasing():
    assert _display_name("PresentLP nach Brechen der Item Clause") == "PresentLP"
    assert _display_name("Oktopaul; Draw nach Time Out") == "Oktopaul"
    assert _display_name("DaumenKinoLP; Sieg für Paul nach Time Out") == "DaumenKinoLP"
    assert _display_name("Crowd [Freewin]") == "CrowdController"
    assert _display_name("Morbolth Daumenkino Sieg") == "Morbolth"


def test_match_row_removes_disconnect_notes_before_alias_display():
    row = _match_row(
        "season_001",
        1,
        "1. Spieltag",
        "DiaSwordPlay",
        "KaffeeConeLP nach DC",
        "5",
        "0",
        "https://example.test/sheet",
        "Regular Season",
        True,
    )

    assert row["player_b"] == "Art'n'Gaming"
    assert row["winner"] == "DiaSwordPlay"


def test_records_from_rows_prefers_known_header_row_after_title_rows():
    rows = [
        ["GPL Pokémon Kill Rang:", "", "Stand: Spieltag 7"],
        ["", "", ""],
        ["Pokémon", "Kills", "Platz", "Kanal"],
        ["Quajutsu", "13", "1", "PresentLP"],
    ]

    assert _records_from_rows(rows) == [
        {"pokemon": "Quajutsu", "kills": "13", "rank": "1", "kanal": "PresentLP"}
    ]


def test_schedule_matches_from_rows_extracts_explicit_scored_cells_with_week_context():
    rows = [
        ["", "1. Spieltag - Sonntag der 14.09.2014", "", "7. Spieltag - Sonntag der 26.10.2014"],
        ["", "DaumenKinoLP [4 – 3] SurskitTV   U. nach DC", "", "PresentLP [3 - 0] SurskitTV"],
    ]

    matches = _schedule_matches_from_rows("season_001", rows, "https://example.test/sheet")

    assert matches == [
        {
            "season_id": "season_001",
            "match_id": "season_001_schedule_0001",
            "week": "1. Spieltag - Sonntag der 14.09.2014",
            "player_a": "DaumenKinoLP",
            "player_b": "SurskitTV",
            "team_a": None,
            "team_b": None,
            "score_a": "4",
            "score_b": "3",
            "winner": None,
            "video_id": None,
            "video_title": None,
            "video_url": None,
            "data_status": "sheet_extracted",
            "source_urls": "https://example.test/sheet",
        },
        {
            "season_id": "season_001",
            "match_id": "season_001_schedule_0002",
            "week": "7. Spieltag - Sonntag der 26.10.2014",
            "player_a": "PresentLP",
            "player_b": "SurskitTV",
            "team_a": None,
            "team_b": None,
            "score_a": "3",
            "score_b": "0",
            "winner": None,
            "video_id": None,
            "video_title": None,
            "video_url": None,
            "data_status": "sheet_extracted",
            "source_urls": "https://example.test/sheet",
        },
    ]


def test_normalized_killlists_do_not_duplicate_identical_rows():
    output = normalize_all(Path("data"))
    rows = [row for row in output.pokemon_killlists if row["data_status"] != "not_available"]
    keys = [
        (
            row["season_id"],
            row["division"],
            row["stage"],
            row["pokemon_normalized"],
            row["trainer_normalized"],
            row["team_name"],
            row["appearances"],
            row["kills"],
            row["deaths"],
            row["differential"],
            row["source_urls"],
        )
        for row in rows
    ]
    duplicates = [key for key, count in Counter(keys).items() if count > 1]

    assert duplicates == []


def test_s10_killlist_uses_playoff_table_with_deaths():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] == "season_010" and row["data_status"] == "sheet_extracted"
    ]

    assert rows
    assert "Playoffs" in {row["division"] for row in rows}

    ramoth = next(row for row in rows if row["pokemon"] == "Ramoth" and row["trainer"] == "Minetube")
    assert ramoth["appearances"] == "2"
    assert ramoth["kills"] == "3"
    assert ramoth["deaths"] == "2"
    assert ramoth["differential"] == "1"


def test_s10_killlist_keeps_regular_season_only_pokemon():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] == "season_010" and row["data_status"] == "sheet_extracted"
    ]

    riesenzahn = next(row for row in rows if row["pokemon"] == "Riesenzahn")
    eisenhand = next(row for row in rows if row["pokemon"] == "Eisenhand")

    assert riesenzahn["division"] == "Regular Season"
    assert riesenzahn["trainer"] == "Sirazoa"
    assert riesenzahn["team_name"] == "Eon Engine"
    assert riesenzahn["appearances"] == "11"
    assert riesenzahn["kills"] == "10"

    assert eisenhand["division"] == "Regular Season"
    assert eisenhand["trainer"] == "KingBlex"
    assert eisenhand["team_name"] == "Cyber End Jugulis"
    assert eisenhand["appearances"] == "12"
    assert eisenhand["kills"] == "13"


def test_killlists_capture_appearances_where_sources_expose_usage_columns():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["data_status"] == "sheet_extracted"
    ]

    season_007_katapuldra = next(
        row
        for row in rows
        if row["season_id"] == "season_007"
        and row["pokemon"] == "Katapuldra"
        and row["trainer"] == "RegiBang"
    )
    season_008_uhafnir = next(
        row
        for row in rows
        if row["season_id"] == "season_008"
        and row["division"] == "Liga 1"
        and row["pokemon"] == "UHaFniR"
        and row["trainer"] == "Bene"
    )
    season_009_stalobor = next(
        row
        for row in rows
        if row["season_id"] == "season_009"
        and row["division"] == "Overall"
        and row["pokemon"] == "Stalobor"
        and row["team_name"] == "Toon World"
    )

    assert season_007_katapuldra["appearances"] == "11"
    assert season_008_uhafnir["appearances"] == "9"
    assert season_009_stalobor["appearances"] == "21"


def test_killlists_mark_zero_appearances_when_usage_columns_are_present_but_empty():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["data_status"] == "sheet_extracted"
    ]

    season_007_cottomi = next(
        row
        for row in rows
        if row["season_id"] == "season_007"
        and row["pokemon"] == "Cottomi"
        and row["trainer"] == "Nestfloh"
    )
    season_010_rotom_heat = next(
        row
        for row in rows
        if row["season_id"] == "season_010"
        and row["pokemon"] == "Rotom-Hitze"
        and row["trainer"] == "Nestfloh"
    )

    assert season_007_cottomi["appearances"] == "0"
    assert season_010_rotom_heat["appearances"] == "0"


def test_missing_killlist_placeholders_preserve_unavailable_source_urls():
    output = normalize_all(Path("data"))
    rows = {
        row["season_id"]: row
        for row in output.pokemon_killlists
        if row["season_id"] in {"season_003", "season_004", "season_005"} and row["data_status"] == "not_available"
    }

    assert "1d7DpiW3aMjnYWiY9KSpk9nSi-gnEUnSFVAK-zGpy59Q" in rows["season_003"]["source_urls"]
    assert "16OVT2YZN7gtsckJEMPSdMETsCiXuCs0HTSFl5xQGdwg" in rows["season_004"]["source_urls"]
    assert "1oXO8WjHo3Og1gncQWS7jEPaNyAFrkJhxL-xS57holc0" in rows["season_005"]["source_urls"]


def test_unavailable_bene_killlists_are_person_scoped_without_inferred_pokemon():
    output = normalize_all(Path("data"))
    rows = {
        row["season_id"]: row
        for row in output.pokemon_killlists
        if row["season_id"] in {"season_003", "season_004", "season_005"} and row["data_status"] == "not_available"
    }

    assert rows["season_003"]["trainer"] == "Bene"
    assert rows["season_003"]["team_name"] == "Unlimited Blade Works"
    assert rows["season_004"]["trainer"] == "Bene"
    assert rows["season_004"]["team_name"] == "Ritter der Tapukokosnuss"
    assert rows["season_005"]["trainer"] == "Bene"
    assert rows["season_005"]["team_name"] == "Victini Bottom"
    assert {row["pokemon"] for row in rows.values()} == {None}
    assert {row["appearances"] for row in rows.values()} == {None}
    assert {row["kills"] for row in rows.values()} == {None}


def test_old_project_sheet_supplies_s3_to_s5_pokemon_kills_with_reviewed_team_usage():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] in {"season_003", "season_004", "season_005"}
        and row["data_status"] != "not_available"
    ]
    unavailable = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] in {"season_003", "season_004", "season_005"}
        and row["data_status"] == "not_available"
    ]

    assert rows
    assert len(unavailable) == 3

    by_season_pokemon = {(row["season_id"], row["pokemon"]): row for row in rows}
    assert by_season_pokemon[("season_003", "Snibunna")]["kills"] == "20"
    assert by_season_pokemon[("season_004", "Snibunna")]["kills"] == "14"
    assert by_season_pokemon[("season_005", "Snibunna")]["kills"] == "24"
    assert by_season_pokemon[("season_003", "Demeteros-T")]["kills"] == "15"
    assert by_season_pokemon[("season_004", "Demeteros-T")]["kills"] == "17"
    assert by_season_pokemon[("season_005", "Demeteros-T")]["kills"] == "12"

    sample = by_season_pokemon[("season_005", "Snibunna")]
    assert sample["division"] == "Liga 1"
    assert sample["trainer"] == "Bene"
    assert sample["trainer_normalized"] == "bene"
    assert sample["team_name"] == "Victini Bottom"
    assert sample["data_status"] == "manual_graphic_assignment"
    assert sample["appearances"] is None
    assert sample["deaths"] is None
    assert sample["differential"] is None
    assert "1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA" in sample["source_urls"]
    assert "data/manual/team_pokemon_usage.csv" in sample["source_urls"]


def test_s9_killlists_preserve_team_from_wide_summary_rows():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] == "season_009" and row["pokemon_normalized"] == "uhafnir"
    ]
    by_division = {row["division"]: row for row in rows}

    assert by_division["Overall"]["team_name"] == "Victory Instinct"
    assert by_division["Doubles"]["team_name"] == "Victory Instinct"
    assert by_division["Doubles"]["trainer"] == "Bene"
    assert by_division["Doubles"]["kills"] == "3"

    singles_rows = [row for row in rows if row["division"] == "Singles"]
    assert {row["trainer"]: row["kills"] for row in singles_rows} == {"BelmontGabriel": "2", "El Scizor": "1"}
    assert {row["trainer"]: row["appearances"] for row in singles_rows} == {
        "BelmontGabriel": "3",
        "El Scizor": "3",
    }


def test_s10_playoff_matches_are_in_playoff_division():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.matches
        if row["season_id"] == "season_010" and row.get("stage") == "playoffs" and row["data_status"] == "sheet_extracted"
    ]

    assert rows
    assert {row["division"] for row in rows} == {"Playoffs"}


def test_pokemon_typo_aliases_are_corrected_in_normalized_killlists():
    output = normalize_all(Path("data"))
    typo_rows = {
        row["pokemon"]: row
        for row in output.pokemon_killlists
        if row["pokemon"] in {"Meistagrif", "Drifzepeli", "Schwalboss", "Shnurgarst"}
        and row["data_status"] == "sheet_extracted"
    }

    assert "Meistergrif" not in {row["pokemon"] for row in output.pokemon_killlists}
    assert "Drifzepli" not in {row["pokemon"] for row in output.pokemon_killlists}
    assert "Schwallbos" not in {row["pokemon"] for row in output.pokemon_killlists}
    assert "Shnurgast" not in {row["pokemon"] for row in output.pokemon_killlists}
    assert typo_rows["Meistagrif"]["pokemon_normalized"] == "meistagrif"
    assert typo_rows["Drifzepeli"]["pokemon_normalized"] == "drifzepeli"
    assert typo_rows["Schwalboss"]["pokemon_normalized"] == "schwalboss"
    assert typo_rows["Shnurgarst"]["pokemon_normalized"] == "shnurgarst"


def test_pokemon_form_aliases_are_merged_in_normalized_killlists():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["data_status"] == "sheet_extracted"
    ]

    bene_landorus = [
        row
        for row in rows
        if row["trainer_normalized"] == "bene"
        and row["pokemon_normalized"] in {"demeteros", "demeteros i"}
    ]
    assert bene_landorus
    assert {row["pokemon_normalized"] for row in bene_landorus} == {"demeteros i"}
    assert {row["pokemon"] for row in bene_landorus} == {"Demeteros-I"}
    assert {"season_009", "season_010"} <= {row["season_id"] for row in bene_landorus}

    raizor_landorus_therian = [
        row
        for row in rows
        if row["trainer_normalized"] == "raizor"
        and row["pokemon_normalized"] in {"demeteros t", "demeteros tiergeistform"}
    ]
    assert {row["pokemon_normalized"] for row in raizor_landorus_therian} == {"demeteros t"}

    present_rotom_wash = [
        row
        for row in rows
        if row["trainer_normalized"] == "present"
        and row["pokemon_normalized"] in {"rotom w", "rotom wash", "rotom wasch form", "rotom wasch"}
    ]
    assert {row["pokemon_normalized"] for row in present_rotom_wash} == {"rotom wasch"}


def test_s6_playoff_matches_are_filterable_as_playoffs():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.matches
        if row["season_id"] == "season_006" and row.get("stage") == "playoffs" and row["data_status"] == "sheet_extracted"
    ]

    assert rows
    assert {row["division"] for row in rows} == {"Playoffs"}


def test_playoff_and_tag_team_champions_are_represented_per_person():
    output = normalize_all(Path("data"))
    rows = [row for row in output.champions if row["data_status"] in {"source_evidenced", "user_provided"}]
    by_season = {}
    for row in rows:
        by_season.setdefault(row["season_id"], []).append(row)

    assert {row["champion_name"] for row in by_season["season_007"]} == {"Nestfloh"}
    assert by_season["season_007"][0]["data_status"] == "source_evidenced"
    assert by_season["season_007"][0]["evidence_type"] == "final_standings_rank_1"
    assert {row["champion_name"] for row in by_season["season_009"]} == {"BelmontGabriel", "El Scizor", "Bene"}
    assert {row["champion_name"] for row in by_season["season_010"]} == {"Bene"}
    assert by_season["season_010"][0]["data_status"] == "source_evidenced"
    assert by_season["season_010"][0]["evidence_type"] == "playoff_final_kader_status"


def test_s10_regular_table_uses_direct_comparison_for_first_place():
    output = normalize_all(Path("data"))
    rows = {
        row["player_name"]: row
        for row in output.standings
        if row["season_id"] == "season_010" and row["division"] == "Regular Season" and row["is_primary"] == "true"
    }

    assert len(rows) == 14
    assert rows["Minetube"]["rank"] == "1"
    assert rows["PresentLP"]["rank"] == "2"


def test_playoff_rows_are_available_for_s7_and_s10_tables_and_plan():
    output = normalize_all(Path("data"))
    s7_standings = [
        row for row in output.standings if row["season_id"] == "season_007" and row["division"] == "Playoffs"
    ]
    s10_standings = [
        row for row in output.standings if row["season_id"] == "season_010" and row["division"] == "Playoffs"
    ]
    s7_matches = [row for row in output.matches if row["season_id"] == "season_007" and row["division"] == "Playoffs"]
    s10_final = [
        row
        for row in output.matches
        if row["season_id"] == "season_010" and row["division"] == "Playoffs" and row["week"] == "Finale"
    ]

    assert s7_standings and s7_standings[0]["player_name"] == "Nestfloh"
    assert s7_matches and s7_matches[0]["winner"] == "Nestfloh"
    assert s7_matches[0]["data_status"] == "source_evidenced"
    assert any(row["player_name"] == "Bene" and row["rank"] == "1" for row in s10_standings)
    assert s10_final and s10_final[0]["winner"] == "Bene"
    assert s10_final[0]["data_status"] == "sheet_extracted"


def test_liga2_sources_from_video_descriptions_are_partitioned_by_division():
    output = normalize_all(Path("data"))
    standings = [
        row
        for row in output.standings
        if row["season_id"] in {"season_002", "season_004", "season_005"} and row["is_primary"] == "true"
    ]
    counts = Counter((row["season_id"], row["division"]) for row in standings)

    assert counts[("season_002", "Regular Season")] == 14
    assert counts[("season_002", "Liga 2")] == 14
    assert counts[("season_004", "Regular Season")] == 12
    assert counts[("season_004", "Liga 2")] == 12
    assert counts[("season_005", "Liga 1")] == 12
    assert counts[("season_005", "Liga 2")] == 12

    s2_liga2_first = next(
        row
        for row in standings
        if row["season_id"] == "season_002" and row["division"] == "Liga 2" and row["rank"] == "1"
    )
    s4_liga2_first = next(
        row
        for row in standings
        if row["season_id"] == "season_004" and row["division"] == "Liga 2" and row["rank"] == "1"
    )
    s5_liga2_first = next(
        row
        for row in standings
        if row["season_id"] == "season_005" and row["division"] == "Liga 2" and row["rank"] == "1"
    )

    assert s2_liga2_first["player_name"] == "Parsifani"
    assert s2_liga2_first["team_name"] == "Duelling Luca-Ri-Oh"
    assert s4_liga2_first["team_name"] == "Insirnapes"
    assert s5_liga2_first["player_name"] == "BelmontGabriel"
    assert s5_liga2_first["team_name"] == "Symphonic Swellow"


def test_liga2_video_description_schedules_are_imported_without_changing_s2_champion():
    output = normalize_all(Path("data"))

    s2_match = next(
        row
        for row in output.matches
        if row["season_id"] == "season_002"
        and row["division"] == "Liga 2"
        and row["player_a"] == "LucarioLP"
        and row["player_b"] == "Zant017"
        and row["week"].startswith("1. Spieltag")
    )
    s4_match = next(
        row
        for row in output.matches
        if row["season_id"] == "season_004"
        and row["division"] == "Liga 2"
        and row["player_a"] == "Scoutley"
        and row["player_b"] == "BlackLink"
        and row["week"].startswith("1. Spieltag")
    )
    s5_match = next(
        row
        for row in output.matches
        if row["season_id"] == "season_005"
        and row["division"] == "Liga 2"
        and row["player_a"] == "Craycom"
        and row["player_b"] == "Asalakoren"
        and row["week"].startswith("1. Spieltag")
    )

    assert (s2_match["score_a"], s2_match["score_b"], s2_match["winner"]) == ("6", "0", "LucarioLP")
    assert (s4_match["score_a"], s4_match["score_b"], s4_match["winner"]) == ("0", "3", "BlackLink")
    assert (s5_match["score_a"], s5_match["score_b"], s5_match["winner"]) == ("4", "0", "Craycom")

    s2_champion = next(row for row in output.champions if row["season_id"] == "season_002")
    assert s2_champion["champion_name"] == "SteveParker"
    assert s2_champion["champion_team"] == "ToxicBlast"


def test_s2_liga2_killlist_from_video_description_is_not_mixed_into_regular_season():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] == "season_002" and row["pokemon"] == "Scherox" and row["trainer"] == "LucarioLP"
    ]

    assert any(row["division"] == "Liga 2" and row["kills"] == "40" for row in rows)
    assert not any(row["division"] == "Regular Season" and row["source_urls"] and "1odsNRAZ" in row["source_urls"] for row in rows)


def test_mid_season_team_controller_changes_are_kept_as_person_stints():
    output = normalize_all(Path("data"))
    stints = output.person_stints

    s3_ubw = [
        row
        for row in stints
        if row["season_id"] == "season_003" and row["team_id"] == "season_003_unlimited_blade_works_1"
    ]
    assert {row["person_name"] for row in s3_ubw} == {"LucarioLP", "Bene"}
    assert {row["person_name"]: (row["start_week"], row["end_week"]) for row in s3_ubw} == {
        "LucarioLP": ("1", "10"),
        "Bene": ("11", "26"),
    }
    assert {row["person_name"]: row["matches"] for row in s3_ubw} == {"LucarioLP": "10", "Bene": "16"}

    s3_week_1 = next(row for row in output.matches if row["season_id"] == "season_003" and row["week"].startswith("1. Spieltag") and row["player_b"] == "FanmadeLetsPlay")
    s3_week_11 = next(row for row in output.matches if row["season_id"] == "season_003" and row["week"].startswith("11. Spieltag") and row["player_b"] == "SurskitTV")
    assert s3_week_1["player_a"] == "LucarioLP"
    assert s3_week_1["team_a"] == "Unlimited Blade Works*¹"
    assert s3_week_11["player_a"] == "Bene"

    s9_victory = [
        row
        for row in stints
        if row["season_id"] == "season_009" and row["team_id"] == "season_009_victory_instinct"
    ]
    assert {row["person_name"] for row in s9_victory} == {"BelmontGabriel", "El Scizor", "Bene"}
    assert {row["person_name"]: (row["start_week"], row["end_week"]) for row in s9_victory} == {
        "BelmontGabriel": ("1", "7"),
        "El Scizor": ("8", "14"),
        "Bene": ("1", "14"),
    }

    s9_week_1 = next(row for row in output.matches if row["season_id"] == "season_009" and row["week"].startswith("1. Spieltag") and row["player_b"] == "Maxi von Vogel")
    s9_week_8 = next(row for row in output.matches if row["season_id"] == "season_009" and row["week"].startswith("8. Spieltag") and row["player_a"] == "Maxi von Vogel")
    assert s9_week_1["player_a"] == "BelmontGabriel"
    assert s9_week_1["winner"] == "BelmontGabriel"
    assert s9_week_8["player_b"] == "El Scizor"

    s9_champions = [row["champion_name"] for row in output.champions if row["season_id"] == "season_009"]
    assert set(s9_champions) == {"BelmontGabriel", "El Scizor", "Bene"}
