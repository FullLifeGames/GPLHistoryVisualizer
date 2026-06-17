from gpl_history.team_rosters import _extract_block_kader_rows, _extract_pair_kader_rows


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
