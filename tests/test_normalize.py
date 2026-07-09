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
    assert _canonical_name("TJLH100") == "art n gaming"
    assert _person_id("Kaffeecone") == "person_art_n_gaming"
    assert _person_id("TJLH100") == "person_art_n_gaming"
    assert _display_name("Kaffecone") == "Art'n'Gaming"
    assert _display_name("TJLH100") == "Art'n'Gaming"
    assert _canonical_name("TheHerbertLP") == "daumenkino"
    assert _person_id("TheHerbertLP") == "person_daumenkino"
    assert _display_name("TheHerbertLP") == "DaumenkinoLP"
    assert _canonical_name("FinaALFaNtAsyLP") == "silva"
    assert _person_id("FinaALFaNtAsyLP") == "person_silva"
    assert _display_name("FinaALFaNtAsyLP") == "Silva"
    assert _display_name("TeamMauni") == "Maxi von Vogel"
    assert _display_name("Maxi [Team Mauni]") == "Maxi von Vogel"
    assert _display_name("DauniDaunstar") == "Dauni"
    assert _canonical_name("Dragoon ofDoom") == "dauni daunstar"
    assert _display_name("DragoonofDoom") == "Dauni"
    assert _canonical_name("Dauni & Hydronic") == "dauni daunstar hydronic"
    assert _display_name("Dauni Daunstar & Hydronic") == "Dauni & Hydronic"
    assert _display_name("Steve's Super Fun Time") == "SteveParker"
    assert _display_name("Belmont") == "BelmontGabriel"
    assert _display_name("BraveBirdGames") == "BraveBird"
    assert _display_name("CrowdCrontroller") == "CrowdController"
    assert _display_name("FreeCale") == "Raikani"
    assert _display_name("K-O-H") == "WolvX"
    assert _display_name("Kayze") == "LetsKayze"
    assert _display_name("Light Gaming") == "LightGaming"
    assert _display_name("Minetube13") == "Minetube"
    assert _display_name("Stratocopter") == "Stratocopter TV"
    assert _display_name("Zant017") == "Zant"
    assert _display_name("Raizor Zockt") == "Raizor"
    assert _display_name("ProfessorN") == "Professor N"
    assert _canonical_name("CabgoLord") == "fnupa"
    assert _person_id("Cabgolord") == "person_fnupa"
    assert _display_name("CabgoLord") == "Cabgolord"
    assert _display_name("Fnupa") == "Cabgolord"
    assert _canonical_name("FanmadeTim") == "fanmadeletsplay"
    assert _person_id("FanmadeTim") == "person_fanmadeletsplay"
    assert _display_name("FanmadeTim") == "FanmadeLetsPlay"
    assert _canonical_name("ImpeldownTV") == "barry d sin of speed"
    assert _person_id("ImpeldownTV") == "person_barry_d_sin_of_speed"
    assert _display_name("ImpeldownTV") == "Barry D. Sin of Speed"


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


def test_person_labels_drop_result_and_rule_notes_before_aliasing():
    assert _display_name("PresentLP nach Brechen der Item Clause") == "PresentLP"
    assert _display_name("Oktopaul; Draw nach Time Out") == "Oktopaul"
    assert _display_name("DaumenKinoLP; Sieg für Paul nach Time Out") == "DaumenkinoLP"
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
            "player_a": "DaumenkinoLP",
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


def test_schedule_matches_from_rows_prefers_same_row_week_context_over_s10_overview_grid():
    rows = [
        ["", "", "", "", "", "Spieltag 13", "", "Spieltag 13Dauni vs OGDeniz96"],
        ["", "Spieltag 10", "7", "Spieltag 10Bene vs Raizor", "", "", "Bene", "4", ":", "0", "Raizor"],
        ["", "Spieltag 13", "7", "Spieltag 13Snomnie vs Raizor", "", "", "Snomnie", "0", ":", "2", "Raizor"],
    ]

    matches = _schedule_matches_from_rows(
        "season_010",
        rows,
        "https://example.test/s10-results",
        division="Regular Season",
        infer_winner=True,
    )

    assert [(row["week"], row["player_a"], row["player_b"], row["winner"]) for row in matches] == [
        ("Spieltag 10", "Bene", "Raizor", "Bene"),
        ("Spieltag 13", "Snomnie", "Raizor", "Raizor"),
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
            row["source_urls"],
        )
        for row in rows
    ]
    duplicates = [key for key, count in Counter(keys).items() if count > 1]

    assert duplicates == []


def test_normalized_killlists_do_not_duplicate_same_source_assignments():
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
            row["source_urls"],
        )
        for row in rows
    ]
    duplicates = [key for key, count in Counter(keys).items() if count > 1]

    assert duplicates == []

    s2_oktopaul_meistagrif = next(
        row
        for row in rows
        if row["season_id"] == "season_002"
        and row["division"] == "Regular Season"
        and row["trainer"] == "Oktopaul"
        and row["pokemon"] == "Meistagrif"
    )
    assert s2_oktopaul_meistagrif["kills"] == "11"


def test_s10_killlist_counts_playoff_battle_columns_as_appearances():
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
    assert "deaths" not in ramoth
    assert "differential" not in ramoth

    maskagato = next(row for row in rows if row["pokemon"] == "Maskagato" and row["trainer"] == "Minetube")
    assert maskagato["appearances"] == "12"
    assert maskagato["kills"] == "9"
    assert "deaths" not in maskagato
    assert "differential" not in maskagato


def test_s10_killlist_keeps_regular_season_rows_for_roster_context():
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

    bene_ogerpon = [
        row
        for row in rows
        if row["pokemon"] == "Ogerpon-Gestein" and row["trainer"] == "Bene"
    ]
    assert {row["division"] for row in bene_ogerpon} == {"Regular Season", "Playoffs"}
    regular_ogerpon = next(row for row in bene_ogerpon if row["division"] == "Regular Season")
    assert regular_ogerpon["team_name"] == "Wackel Backel"
    assert regular_ogerpon["appearances"] == "10"
    assert regular_ogerpon["kills"] == "13"


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
    assert by_season_pokemon[("season_005", "Zygarde-50")]["kills"] == "20"

    sample = by_season_pokemon[("season_005", "Snibunna")]
    assert sample["division"] == "Liga 1"
    assert sample["trainer"] == "Bene"
    assert sample["trainer_normalized"] == "bene"
    assert sample["team_name"] == "Victini Bottom"
    assert sample["data_status"] == "manual_graphic_assignment"
    assert sample["appearances"] is None
    assert "1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA" in sample["source_urls"]
    assert "data/manual/team_pokemon_usage.csv" in sample["source_urls"]

    zygarde = by_season_pokemon[("season_005", "Zygarde-50")]
    assert zygarde["division"] == "Liga 1"
    assert zygarde["trainer"] == "Bene"
    assert zygarde["trainer_normalized"] == "bene"
    assert zygarde["team_name"] == "Victini Bottom"
    assert zygarde["data_status"] == "manual_override"
    assert "1JZpA-5XDldN2bjfvhvBPHYK-1AENETLnF1UxNEpWlNA" in zygarde["source_urls"]
    assert "data/manual/team_pokemon_usage.csv" in zygarde["source_urls"]
    assert "data/manual/pokemon_killlists.csv" in zygarde["source_urls"]


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


def test_killlists_fill_missing_team_from_person_season_division_context():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["pokemon_normalized"] == "uhafnir" and row["trainer_normalized"] == "bene"
    ]
    by_context = {(row["season_id"], row["division"]): row for row in rows}

    assert by_context[("season_008", "Liga 1")]["team_name"] == "Victini Bottom"
    assert by_context[("season_010", "Playoffs")]["team_name"] == "Wackel Backel"


def test_s10_playoff_matches_are_in_playoff_division():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.matches
        if row["season_id"] == "season_010" and row.get("stage") == "playoffs" and row["data_status"] == "sheet_extracted"
    ]

    assert rows
    assert {row["division"] for row in rows} == {"Playoffs"}


def test_s10_regular_matches_keep_results_sheet_spieltag_context():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.matches
        if row["season_id"] == "season_010" and row["division"] == "Regular Season"
    ]
    by_pair = {(_canonical_name(row["player_a"]), _canonical_name(row["player_b"])): row for row in rows}

    assert not [row["week"] for row in rows if " vs " in str(row.get("week") or "")]
    assert by_pair[("bene", "raizor")]["week"] == "Spieltag 10"
    assert by_pair[("snomnie", "raizor")]["week"] == "Spieltag 13"
    assert ("raizor", "minetube") not in by_pair

    playoff_rows = [
        row
        for row in output.matches
        if row["season_id"] == "season_010" and row["division"] == "Playoffs"
    ]
    playoff_by_pair = {(_canonical_name(row["player_a"]), _canonical_name(row["player_b"])): row for row in playoff_rows}
    assert playoff_by_pair[("raizor", "minetube")]["week"] == "Halbfinale"
    assert playoff_by_pair[("present", "minetube")]["week"] == "Spiel um Platz 3"
    assert playoff_by_pair[("present", "minetube")]["winner"] == "PresentLP"
    assert playoff_by_pair[("present", "minetube")]["score_a"] in {None, ""}
    assert playoff_by_pair[("present", "minetube")]["score_b"] in {None, ""}
    assert playoff_by_pair[("present", "minetube")]["data_status"] == "sheet_extracted_with_user_correction"


def test_s1_week_21_fnupagladi_prekani_manual_match_is_available_for_video_mapping():
    output = normalize_all(Path("data"))
    row = next(
        (
            row
            for row in output.matches
            if row["match_id"] == "season_001_manual_0021_fnupa_present"
        ),
        None,
    )

    assert row is not None
    assert row["season_id"] == "season_001"
    assert row["week"] == "21. Spieltag - Sonntag der 08.02.2015 [12:00 -17:00]"
    assert row["player_a"] == "Cabgolord"
    assert row["team_a"] == "Fnupagladi"
    assert row["player_b"] == "PresentLP"
    assert row["team_b"] == "Prekani"
    assert row["score_a"] in {None, ""}
    assert row["score_b"] in {None, ""}
    assert row["data_status"] == "manual_source_evidenced"


def test_pokemon_typo_aliases_are_corrected_in_normalized_killlists():
    output = normalize_all(Path("data"))
    typo_rows = {
        row["pokemon"]: row
        for row in output.pokemon_killlists
        if row["pokemon"] in {"Meistagrif", "Drifzepeli", "Schwalboss", "Shnurgarst"}
        and row["data_status"] != "not_available"
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
    round_counts = Counter(row["week"] for row in rows)
    assert round_counts == {
        "Playoffs - Vorrunde - Sonntag der 07.07.2019": 4,
        "Playoffs - Viertelfinale - Sonntag der 14.07.2019": 4,
        "Playoffs - Halbfinale - Sonntag der 21.07.2019": 2,
        "Playoffs - Spiel um Platz 3 - Samstag der 27.07.2019": 1,
        "Playoffs - Finale - Sonntag der 28.07.2019": 1,
    }


def test_s6_lazycakes_uses_dauni_despite_shared_teammauni_channel():
    output = normalize_all(Path("data"))

    s6_standings = {
        row["team_name"]: row
        for row in output.standings
        if row["season_id"] == "season_006" and row["is_primary"] == "true"
    }
    s6_stints = {
        row["team_name"]: row
        for row in output.person_stints
        if row["season_id"] == "season_006" and row["stage"] == "full_season"
    }
    s6_teams = {
        row["team_name"]: row
        for row in output.teams
        if row["season_id"] == "season_006"
    }

    assert s6_standings["Lazycakes"]["player_name"] == "Dauni"
    assert s6_standings["Lazycakes"]["person_id"] == "person_dauni_daunstar"
    assert s6_stints["Lazycakes"]["person_name"] == "Dauni"
    assert s6_teams["Lazycakes"]["person_name"] == "Dauni"

    assert s6_standings["Youngstars"]["player_name"] == "Maxi von Vogel"
    assert s6_standings["Youngstars"]["person_id"] == "person_maxi_von_vogel"
    assert s6_stints["Youngstars"]["person_name"] == "Maxi von Vogel"
    assert s6_teams["Youngstars"]["person_name"] == "Maxi von Vogel"


def test_schedule_parser_does_not_apply_right_side_playoff_header_to_left_blocks():
    rows = [
        ["", "1. Spieltag - Sonntag der 14.04.2019", "", "", "", "7. Spieltag - Sonntag der 26.05.2019"],
        ["", "Lauris", "5:0", "Scoutley", "", "Barry D. Sin of Speed", "4:0", "Asalakoren"],
        ["", "Hydronic", "0:3", "Minetube", "", "PokeBazi", "3:0", "Hydronic", "", "Playoffs - Viertelfinale - Sonntag der 14.07.2019"],
        ["", "", "", "", "", "", "", "", "", "TabascoTV", "0:2", "Dauni"],
        ["", "2. Spieltag - Sonntag der 21.04.2019", "", "", "", "8. Spieltag - Sonntag der 02.06.2019", "", "", "", "BelmontGabriel", "0:3", "Art'n'Gaming"],
    ]

    matches = _schedule_matches_from_rows(
        "season_006",
        rows,
        "source",
        division="Sun Conference",
        infer_winner=True,
    )

    by_pair = {(_canonical_name(row["player_a"]), _canonical_name(row["player_b"])): row for row in matches}
    assert by_pair[("lauris", "scoutley")]["week"] == "1. Spieltag - Sonntag der 14.04.2019"
    assert by_pair[("hydronic", "minetube")]["week"] == "1. Spieltag - Sonntag der 14.04.2019"
    assert by_pair[("pokebazi", "hydronic")]["week"] == "7. Spieltag - Sonntag der 26.05.2019"
    assert by_pair[("tabasco tv", "dauni daunstar")]["week"] == "Playoffs - Viertelfinale - Sonntag der 14.07.2019"
    assert by_pair[("belmontgabriel", "art n gaming")]["week"] == "Playoffs - Viertelfinale - Sonntag der 14.07.2019"


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


def test_playoff_rows_exist_for_s10_but_not_for_s7():
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

    # S7 had no playoffs (participant-confirmed): the title came from rank 1 of
    # the final table and must not appear as synthesized playoff rows.
    assert s7_standings == []
    assert s7_matches == []
    s7_champions = [row for row in output.champions if row["season_id"] == "season_007"]
    assert s7_champions and s7_champions[0]["champion_name"] == "Nestfloh"
    assert s7_champions[0]["evidence_type"] == "final_standings_rank_1"

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
        and row["player_b"] == "Zant"
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


def test_legacy_schedule_player_names_are_normalized_to_canonical_people():
    output = normalize_all(Path("data"))

    s2_freecale = next(row for row in output.matches if row["match_id"] == "season_002_schedule_0187")
    s2_glebber_san = next(row for row in output.matches if row["match_id"] == "season_002_schedule_0191")
    s2_philipp = next(row for row in output.matches if row["match_id"] == "season_002_schedule_0192")
    s5_belmont = next(row for row in output.matches if row["match_id"] == "season_005_schedule_0141")
    s5_crowd_typo = next(row for row in output.matches if row["match_id"] == "season_005_schedule_0220")
    s3_light_kayze = next(row for row in output.matches if row["match_id"] == "season_003_schedule_0184")

    assert s2_freecale["player_b"] == "Raikani"
    assert s2_freecale["winner"] == "Raikani"
    assert s2_glebber_san["player_b"] == "Domibri"
    assert s2_glebber_san["winner"] == "Domibri"
    assert s2_philipp["player_b"] == "Shizumania"
    assert s2_philipp["winner"] == "Shizumania"
    assert s5_belmont["player_a"] == "BelmontGabriel"
    assert s5_belmont["winner"] == "BelmontGabriel"
    assert s5_crowd_typo["player_b"] == "CrowdController"
    assert s3_light_kayze["player_a"] == "LightGaming"
    assert s3_light_kayze["player_b"] == "LetsKayze"


def test_s2_liga2_killlist_from_video_description_is_not_mixed_into_regular_season():
    output = normalize_all(Path("data"))
    rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] == "season_002" and row["pokemon"] == "Scherox" and row["trainer"] == "LucarioLP"
    ]

    assert any(row["division"] == "Liga 2" and row["kills"] == "40" for row in rows)
    assert not any(row["division"] == "Regular Season" and row["source_urls"] and "1odsNRAZ" in row["source_urls"] for row in rows)


def test_alias_variants_collapse_to_one_display_name():
    assert _display_name("glebber") == "Glebber"
    assert _display_name("Pentaplayer") == "PentaPlayer"
    assert _display_name("PokeBree") == "PokéBree"
    assert _display_name("ScarletSFT") == "Scarlet"
    assert _display_name("BlackLink1996") == "BlackLink"

    output = normalize_all(Path("data"))
    names = {n for row in output.matches for n in (row["player_a"], row["player_b"], row["winner"]) if n}
    names |= {row["player_name"] for row in output.standings if row["player_name"]}
    variants = {n for n in names if _canonical_name(n) in {"glebber", "pentaplayer", "pokebree"}}
    assert variants == {"Glebber", "PentaPlayer", "PokéBree"}


def test_season_3_splits_into_liga_1_and_liga_2():
    output = normalize_all(Path("data"))

    schedule_matches = [
        row
        for row in output.matches
        if row["season_id"] == "season_003" and row["data_status"] != "source_video_only"
    ]
    assert Counter(row["division"] for row in schedule_matches) == {"Liga 1": 182, "Liga 2": 182}

    standings = [row for row in output.standings if row["season_id"] == "season_003"]
    assert Counter(row["division"] for row in standings) == {"Liga 1": 14, "Liga 2": 14}

    liga1_rank1 = next(row for row in standings if row["division"] == "Liga 1" and row["rank"] == "1")
    assert liga1_rank1["player_name"] == "PresentLP"
    liga2_rank1 = next(row for row in standings if row["division"] == "Liga 2" and row["rank"] == "1")
    assert liga2_rank1["player_name"] == "LightGaming"
    assert liga2_rank1["team_name"] == "Departed Fairies"
    # The Liga 2 sheet counts 26 matchdays for every team, like the schedule.
    liga2_games = {
        int(row["wins"]) + int(row["losses"]) + int(row["draws"])
        for row in standings
        if row["division"] == "Liga 2"
    }
    assert liga2_games == {26}


def test_s10_winner_less_matches_resolved_by_participant_confirmation():
    output = normalize_all(Path("data"))
    s10 = [row for row in output.matches if row["season_id"] == "season_010"]

    st4 = next(row for row in s10 if row["week"] == "Spieltag 4" and {row["player_a"], row["player_b"]} == {"Domji", "Blocki"})
    assert st4["winner"] == "Domji"
    assert st4["data_status"] == "sheet_extracted_with_user_correction"

    st12 = next(row for row in s10 if row["week"] == "Spieltag 12" and {row["player_a"], row["player_b"]} == {"Blocki", "Snomnie"})
    assert st12["winner"] == "Blocki"
    assert st12["data_status"] == "sheet_extracted_with_user_correction"

    remaining = [row for row in s10 if not row["winner"] and row["data_status"] not in {"source_video_only", "not_available"}]
    assert remaining == []


def test_result_basis_classifies_special_results():
    output = normalize_all(Path("data"))

    basis = Counter(row["result_basis"] for row in output.matches if row.get("result_basis"))
    assert basis == {"draw": 12, "two_sided_score": 7, "forfeit": 6, "unresolved": 2}

    forfeits = [row for row in output.matches if row.get("result_basis") == "forfeit"]
    assert all(row["season_id"] == "season_001" for row in forfeits)
    assert all("Morbolth" in (row["player_a"], row["player_b"]) for row in forfeits)
    assert all(row["winner"] and row["winner"] != "Morbolth" for row in forfeits)
    assert all(row["data_status"] == "sheet_extracted_with_user_correction" for row in forfeits)

    unresolved = [row for row in output.matches if row.get("result_basis") == "unresolved"]
    assert {row["week"][:12] for row in unresolved} == {"21. Spieltag", "22. Spieltag"}
    assert all(not row["winner"] for row in unresolved)


def test_s10_final_table_includes_reconstructed_spieltag_13():
    output = normalize_all(Path("data"))
    rows = {
        row["player_name"]: row
        for row in output.standings
        if row["season_id"] == "season_010" and row["division"] == "Regular Season" and row["stage"] == "final_table"
    }
    assert len(rows) == 14
    # Every player carries the 13th matchday now.
    assert all(int(r["wins"]) + int(r["losses"]) + int(r["draws"]) == 13 for r in rows.values())
    # The official direct-comparison tiebreak for first place survives the re-rank.
    assert rows["Minetube"]["rank"] == "1"
    assert rows["PresentLP"]["rank"] == "2"
    # Kills follow the elimination convention, keeping the table self-consistent.
    assert all(int(r["kills"]) - int(r["deaths"]) == int(r["differential"]) for r in rows.values())
    assert all(r["data_status"] == "sheet_extracted_with_user_correction" for r in rows.values())


def test_final_table_differentials_match_kills_minus_deaths():
    output = normalize_all(Path("data"))
    # These rows contradict themselves in the source sheet and the match scores
    # arbitrate for neither candidate (see _STANDING_DIFFERENTIAL_CORRECTIONS):
    # they stay flagged instead of silently corrected.
    known_conflicts = {
        ("season_003", "Liga 1", "SurskitTV"),
        ("season_004", "Liga 2", "Dauni"),
        ("season_005", "Liga 2", "BraveBird"),
    }
    seen_conflicts = set()
    for row in output.standings:
        if row["stage"] != "final_table":
            continue
        try:
            delta = int(row["kills"]) - int(row["deaths"])
            differential = int(row["differential"])
        except (TypeError, ValueError):
            continue
        key = (row["season_id"], row["division"], row["player_name"])
        if delta != differential:
            seen_conflicts.add(key)
    assert seen_conflicts == known_conflicts


def test_mid_season_team_controller_changes_are_kept_as_person_stints():
    output = normalize_all(Path("data"))
    stints = output.person_stints

    s1_nocturne = [
        row
        for row in stints
        if row["season_id"] == "season_001" and row["team_id"] == "season_001_nocturne"
    ]
    assert {row["person_name"] for row in s1_nocturne} == {"PokemonFakten", "FanmadeLetsPlay"}
    assert {row["person_name"]: (row["start_week"], row["end_week"]) for row in s1_nocturne} == {
        "PokemonFakten": ("1", "11"),
        "FanmadeLetsPlay": ("12", "22"),
    }
    assert all(row["data_status"] == "user_provided" for row in s1_nocturne)
    assert all(row["kills"] is None for row in s1_nocturne)

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

    s5_week_6 = next(row for row in output.matches if row["match_id"] == "season_005_schedule_0121")
    assert s5_week_6["player_a"] == "Glebber"
    assert s5_week_6["player_b"] == "Parsifani"
    assert s5_week_6["winner"] == "Parsifani"
    assert s5_week_6["data_status"] == "sheet_extracted"
    assert "H78en417S7g" not in s5_week_6["source_urls"]

    s5_aggron = [
        row
        for row in stints
        if row["season_id"] == "season_005" and row["team_id"] == "season_005_aggron_successors"
    ]
    assert {row["person_name"] for row in s5_aggron} == {"Tabasco TV", "Parsifani"}
    assert {row["person_name"]: (row["start_week"], row["end_week"]) for row in s5_aggron} == {
        "Tabasco TV": ("1", "5"),
        "Parsifani": ("6", "22"),
    }
    assert {row["person_name"]: row["matches"] for row in s5_aggron} == {"Tabasco TV": "5", "Parsifani": "17"}

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


def test_s1_killlist_is_marked_partial_because_source_stops_at_week_7():
    output = normalize_all(Path("data"))
    s1_rows = [
        row
        for row in output.pokemon_killlists
        if row["season_id"] == "season_001" and row["data_status"] != "not_available"
    ]

    assert s1_rows
    assert {row["data_status"] for row in s1_rows} == {"partial_external_old_project_sheet"}
    assert all(row["appearances"] is not None for row in s1_rows)
