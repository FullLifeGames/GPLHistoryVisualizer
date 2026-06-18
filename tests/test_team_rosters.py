import csv

from gpl_history.team_rosters import (
    _dedupe_rows,
    _draft_roster_rows,
    _extract_block_kader_rows,
    _extract_pair_kader_rows,
    _extract_usage_kader_rows,
    _killlist_supplement_roster_rows,
    _manual_team_graphic_snapshot_rows,
    _parse_initial_draft_picks,
    _parse_rueckrunde_draft_changes,
    _remove_pokemon,
    _season_006_killlist_roster_rows,
    _team_lookup,
)


def test_extract_pair_kader_rows_maps_aliases_and_skips_header_people():
    teams = [
        {
            "season_id": "season_010",
            "division": "Regular Season",
            "team_name": "Wackel Backel",
            "team_name_normalized": "wackel backel",
            "person_name": "Bene",
            "person_name_normalized": "bene",
        },
        {
            "season_id": "season_010",
            "division": "Regular Season",
            "team_name": "Squid Squad",
            "team_name_normalized": "squid squad",
            "person_name": "OGDNZ",
            "person_name_normalized": "ogdnz",
        },
    ]
    csv_rows = [
        ["", "Bene", "Bene"],
        ["", "Bene", "Ogerpon-Gestein"],
        ["", "OGDeniz96", "Eisenfalter"],
    ]

    rows = _extract_pair_kader_rows(
        csv_rows,
        teams,
        season_id="season_010",
        division="Regular Season",
        source_table="Kader",
        source_file="s10.csv",
        source_urls="sheet-url",
        notes="Hauptrundenkader",
    )

    assert [(row["person_name"], row["team_name"], row["pokemon"], row["slot"]) for row in rows] == [
        ("Bene", "Wackel Backel", "Ogerpon-Gestein", "1"),
        ("OGDNZ", "Squid Squad", "Eisenfalter", "1"),
    ]


def test_extract_pair_kader_rows_can_require_playoff_header_values():
    teams = [
        {
            "season_id": "season_010",
            "division": "Playoffs",
            "team_name": "Wackel Backel",
            "team_name_normalized": "wackel backel",
            "person_name": "Bene",
            "person_name_normalized": "bene",
        }
    ]
    csv_rows = [
        ["", "", "", "P1", "P2", "Fin"],
        ["Bene", "Ogerpon-Gestein", "", "0", "", ""],
        ["Bene", "Granforgita", "", "", "", ""],
    ]

    rows = _extract_pair_kader_rows(
        csv_rows,
        teams,
        season_id="season_010",
        division="Playoffs",
        roster_phase="playoffs",
        source_table="Playoffs Kader",
        source_file="s10-playoffs.csv",
        source_urls="sheet-url",
        notes="Playoffkader",
        required_headers="P1;P2;Fin",
    )

    assert [(row["pokemon"], row["slot"]) for row in rows] == [("Ogerpon-Gestein", "1")]


def test_extract_block_kader_rows_stops_at_section_boundary_and_keeps_out_picks():
    teams = [
        {
            "season_id": "season_009",
            "division": "Singles",
            "team_name": "Alpha",
            "team_name_normalized": "alpha",
            "person_name": "Player A",
            "person_name_normalized": "player a",
        },
        {
            "season_id": "season_009",
            "division": "Singles",
            "team_name": "Beta",
            "team_name_normalized": "beta",
            "person_name": "Player B",
            "person_name_normalized": "player b",
        },
    ]
    csv_rows = [
        ["", "", "", "", "", "Alpha"],
        ["", "", "", "", "", "Player A"],
        ["", "Tier", "Pokemon", "Icon", "Speed"],
        ["", "S", "Pikachu", "", "90"],
        ["", "Out", "Evoli", "", "55"],
        [],
        ["", "", "", "", "", "Beta"],
        ["", "", "", "", "", "Player B"],
        ["", "Tier", "Pokemon", "Icon", "Speed"],
        ["", "A", "Bisasam", "", "45"],
    ]

    rows = _extract_block_kader_rows(
        csv_rows,
        teams,
        season_id="season_009",
        division="Singles",
        source_table="Kader Singles",
        source_file="s9.csv",
        source_urls="sheet-url",
        notes="Rückrundendraft erkannt",
    )

    assert [(row["person_name"], row["pokemon"], row["slot"]) for row in rows] == [
        ("Player A", "Pikachu", "1"),
        ("Player A", "Evoli", "2"),
        ("Player B", "Bisasam", "1"),
    ]
    assert all(row["notes"] == "Rückrundendraft erkannt" for row in rows)
def test_extract_usage_kader_rows_infers_s8_hinrunde_and_rueckrunde_phases():
    teams = [
        {
            "season_id": "season_008",
            "division": "Liga 1",
            "team_name": "Alpha",
            "team_name_normalized": "alpha",
            "person_name": "Dauni Daunstar",
            "person_name_normalized": "dauni daunstar",
        }
    ]
    csv_rows = [
        ["", "Alpha", "", "Spieltag:", "1", "2", "8", "9"],
        ["", "", "", "", "W", "L", "W", "L"],
        ["", "Platz 1", "", "Kills am Spieltag"],
        ["", "S", "Pikachu", "", "0", "", "", ""],
        ["", "Out", "Evoli", "", "", "1", "", ""],
        ["", "B", "Bisasam", "", "", "", "0", ""],
    ]

    rows = _extract_usage_kader_rows(
        csv_rows,
        teams,
        season_id="season_008",
        division="Liga 1",
        source_table="Kader L1",
        source_file="s8.csv",
        source_urls="sheet-url",
        notes="inferiert",
    )

    assert [(row["roster_phase"], row["pokemon"], row["slot"]) for row in rows] == [
        ("hinrunde", "Pikachu", "1"),
        ("rueckrunde", "Pikachu", "1"),
        ("hinrunde", "Evoli", "2"),
        ("rueckrunde", "Bisasam", "2"),
    ]


def test_season_009_draft_rows_apply_rueckrunde_changes_and_phase_specific_victory_owner():
    teams = [
        {
            "season_id": "season_009",
            "division": "Singles",
            "team_name": "Victory Instinct",
            "team_name_normalized": "victory instinct",
            "person_name": "BelmontGabriel",
            "person_name_normalized": "belmontgabriel",
        },
        {
            "season_id": "season_009",
            "division": "Singles",
            "team_name": "Victory Instinct",
            "team_name_normalized": "victory instinct",
            "person_name": "El Scizor",
            "person_name_normalized": "el scizor",
        },
        {
            "season_id": "season_009",
            "division": "Doubles",
            "team_name": "Victory Instinct",
            "team_name_normalized": "victory instinct",
            "person_name": "Bene",
            "person_name_normalized": "bene",
        },
    ]
    lookup = _team_lookup(teams, "season_009", {"Singles", "Doubles"})
    initial = _parse_initial_draft_picks(
        [["1", "Victory Instinct", "", "Rotom", "C-Tier"], ["2", "Victory Instinct", "", "Irokex", "B-Tier"]],
        lookup,
    )
    changes = _parse_rueckrunde_draft_changes(
        [["1", "Victory Instinct", "", "Rotom", "C-Tier", "", "Miltank", "C-Tier"]],
        lookup,
    )
    team_key = next(iter(initial))
    rueckrunde = {team_key: list(initial[team_key])}
    for pokemon in changes[team_key]["out"]:
        _remove_pokemon(rueckrunde[team_key], pokemon)
    rueckrunde[team_key].extend(changes[team_key]["in"])

    hinrunde_rows = _draft_roster_rows(
        "season_009",
        "hinrunde",
        initial,
        lookup,
        source_table="Draftpicks",
        source_file="draft.csv",
        source_urls="draft-url",
        notes="initial",
    )
    rueckrunde_rows = _draft_roster_rows(
        "season_009",
        "rueckrunde",
        rueckrunde,
        lookup,
        source_table="Draftpicks Rückrunde",
        source_file="rr.csv",
        source_urls="rr-url",
        notes="rr",
    )

    assert ("Singles", "BelmontGabriel", "Rotom") in {
        (row["division"], row["person_name"], row["pokemon"]) for row in hinrunde_rows
    }
    assert ("Singles", "El Scizor", "Miltank") in {
        (row["division"], row["person_name"], row["pokemon"]) for row in rueckrunde_rows
    }
    assert ("Doubles", "Bene", "Miltank") in {
        (row["division"], row["person_name"], row["pokemon"]) for row in rueckrunde_rows
    }
    assert all(row["pokemon"] != "Rotom" for row in rueckrunde_rows)


def test_dedupe_keeps_same_pokemon_when_roster_phase_differs():
    base = {
        "season_id": "season_008",
        "division": "Liga 1",
        "person_name_normalized": "bene",
        "team_name_normalized": "victini bottom",
        "pokemon_normalized": "uhafnir",
    }

    rows = _dedupe_rows([{**base, "roster_phase": "hinrunde"}, {**base, "roster_phase": "rueckrunde"}])

    assert [row["roster_phase"] for row in rows] == ["hinrunde", "rueckrunde"]


def test_manual_s4_team_graphics_are_hinrunde_snapshots(tmp_path):
    manual_dir = tmp_path / "manual"
    manual_dir.mkdir()
    manual_path = manual_dir / "team_pokemon_usage.csv"
    fields = [
        "season_id",
        "division",
        "team_name",
        "team_name_normalized",
        "person_name",
        "person_name_normalized",
        "pokemon",
        "pokemon_normalized",
        "slot",
        "source_file",
        "source_urls",
        "data_status",
    ]
    with manual_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerow(
            {
                "season_id": "season_004",
                "division": "Regular Season",
                "team_name": "Ritter der Tapukokosnuss",
                "team_name_normalized": "ritter der tapukokosnuss",
                "person_name": "Bene",
                "person_name_normalized": "bene",
                "pokemon": "Quappo",
                "pokemon_normalized": "quappo",
                "slot": "11",
                "source_file": "s4.png",
                "source_urls": "manual-source",
                "data_status": "manual_override",
            }
        )
    teams = [
        {
            "season_id": "season_004",
            "division": "Regular Season",
            "team_name": "Ritter der Tapukokosnuss",
            "team_name_normalized": "ritter der tapukokosnuss",
            "person_name": "Bene",
            "person_name_normalized": "bene",
        }
    ]

    rows = _manual_team_graphic_snapshot_rows(tmp_path, teams)

    assert rows[0]["roster_phase"] == "hinrunde"
    assert rows[0]["pokemon"] == "Quappo"
    assert "Hinrunden-Snapshot" in rows[0]["notes"]


def test_manual_s3_team_graphics_are_rueckrunde_snapshots(tmp_path):
    manual_dir = tmp_path / "manual"
    manual_dir.mkdir()
    manual_path = manual_dir / "team_pokemon_usage.csv"
    fields = [
        "season_id",
        "division",
        "team_name",
        "team_name_normalized",
        "person_name",
        "person_name_normalized",
        "pokemon",
        "pokemon_normalized",
        "slot",
        "source_file",
        "source_urls",
        "data_status",
    ]
    with manual_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerow(
            {
                "season_id": "season_003",
                "division": "Regular Season",
                "team_name": "Unlimited Blade Works",
                "team_name_normalized": "unlimited blade works",
                "person_name": "Bene",
                "person_name_normalized": "bene",
                "pokemon": "Heatran",
                "pokemon_normalized": "heatran",
                "slot": "35",
                "source_file": "s3.jpg",
                "source_urls": "manual-source",
                "data_status": "manual_override",
            }
        )

    rows = _manual_team_graphic_snapshot_rows(tmp_path, [])

    assert rows[0]["season_id"] == "season_003"
    assert rows[0]["roster_phase"] == "rueckrunde"
    assert rows[0]["slot"] == "1"
    assert "Spieltag 14" in rows[0]["notes"]
    assert "Rückrunden-Snapshot" in rows[0]["notes"]


def test_killlist_supplements_loose_manual_snapshot_rosters(tmp_path):
    normalized_dir = tmp_path / "normalized"
    normalized_dir.mkdir()
    _write_rows(
        normalized_dir / "pokemon_killlists.csv",
        [
            {
                "season_id": "season_005",
                "division": "Liga 1",
                "pokemon": "Snibunna",
                "pokemon_normalized": "snibunna",
                "trainer": "Bene",
                "trainer_normalized": "bene",
                "team_name": "Victini Bottom",
                "data_status": "manual_graphic_assignment",
                "source_urls": "duplicate-source",
            },
            {
                "season_id": "season_005",
                "division": "Liga 1",
                "pokemon": "Lanturn",
                "pokemon_normalized": "lanturn",
                "trainer": "Bene",
                "trainer_normalized": "bene",
                "team_name": "Victini Bottom",
                "data_status": "manual_override",
                "source_urls": "killlist-source",
            },
        ],
    )
    roster_rows = [
        {
            "season_id": "season_005",
            "division": "Liga 1",
            "roster_phase": "rueckrunde",
            "team_name": "Victini Bottom",
            "team_name_normalized": "victini bottom",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "pokemon": "Snibunna",
            "pokemon_normalized": "snibunna",
            "slot": "1",
            "source_table": "Manual team graphics",
        }
    ]

    rows = _killlist_supplement_roster_rows(tmp_path, roster_rows)

    assert [(row["pokemon"], row["roster_phase"], row["slot"]) for row in rows] == [("Lanturn", "rueckrunde", "2")]
    assert rows[0]["source_table"] == "Pokemon killlist supplement"
    assert rows[0]["source_urls"] == "killlist-source"


def test_season_006_killlists_can_supply_conference_and_playoff_rosters(tmp_path):
    normalized_dir = tmp_path / "normalized"
    normalized_dir.mkdir()
    _write_rows(
        normalized_dir / "pokemon_killlists.csv",
        [
            {
                "season_id": "season_006",
                "division": "Moon Conference",
                "pokemon": "Heatran",
                "pokemon_normalized": "heatran",
                "trainer": "Bene",
                "trainer_normalized": "bene",
                "team_name": "Kleinsteins;Gate",
                "data_status": "sheet_extracted",
                "source_urls": "moon-source",
            },
            {
                "season_id": "season_006",
                "division": "Playoffs",
                "pokemon": "Zapdos",
                "pokemon_normalized": "zapdos",
                "trainer": "Bene",
                "trainer_normalized": "bene",
                "team_name": "Kleinsteins;Gate",
                "data_status": "sheet_extracted",
                "source_urls": "playoff-source",
            },
        ],
    )

    rows = _season_006_killlist_roster_rows(tmp_path, [])

    assert [(row["division"], row["roster_phase"], row["pokemon"], row["slot"]) for row in rows] == [
        ("Moon Conference", "regular", "Heatran", "1"),
        ("Playoffs", "playoffs", "Zapdos", "1"),
    ]
    assert all("S6 Kader" in row["notes"] for row in rows)


def _write_rows(path, rows):
    fields = sorted({field for row in rows for field in row}) or ["data_status"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
