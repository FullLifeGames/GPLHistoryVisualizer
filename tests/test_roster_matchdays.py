from gpl_history.roster_matchdays import extract_wide_roster_matchday_rows


def test_extracts_s10_regular_roster_usage_with_blank_result_gap():
    rows = extract_wide_roster_matchday_rows(
        [
            ["", "", "", "", "", "Wackel Backel"],
            [],
            ["", "", "", "", "", "1", "2", "3"],
            [],
            ["", "", "Platz 4", "", "", "S", "N", "S"],
            ["", "Bene", "Ogerpon-Gestein", "", "", "1", "0", ""],
            ["", "Bene", "UHaFniR", "", "", "", "", "2"],
        ],
        [_team("season_010", "Regular Season", "Bene", "Wackel Backel")],
        season_id="season_010",
        division="Regular Season",
        roster_phase="regular",
        source_table="Kader",
        source_file="kader.csv",
        source_urls="https://sheet.test/kader",
        notes="test",
        week_mode="regular",
    )

    assert [(row["pokemon"], row["week"], row["result"], row["kills"]) for row in rows] == [
        ("Ogerpon-Gestein", "1", "win", "1"),
        ("Ogerpon-Gestein", "2", "loss", "0"),
        ("UHaFniR", "3", "win", "2"),
    ]


def test_s9_victory_instinct_singles_are_split_by_week_owner():
    rows = extract_wide_roster_matchday_rows(
        [
            ["", "", "", "", "", "Victory Instinct"],
            ["", "", "", "", "", "Spieltag:", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
            ["", "", "", "", "", "", "W", "W", "W", "W", "W", "W", "W", "L", "W"],
            ["", "Tier", "Pokémon", "Icon", "Speed"],
            ["", "S", "Demeteros-T", "", "91", "", "", "", "", "", "", "", "1", "2", "3"],
        ],
        [
            _team("season_009", "Singles", "BelmontGabriel", "Victory Instinct"),
            _team("season_009", "Singles", "El Scizor", "Victory Instinct"),
        ],
        season_id="season_009",
        division="Singles",
        roster_phase="season",
        source_table="Kader Singles",
        source_file="kader_singles.csv",
        source_urls="https://sheet.test/kader-singles",
        notes="test",
        week_mode="regular",
    )

    assert [(row["person_name"], row["roster_phase"], row["week"], row["kills"]) for row in rows] == [
        ("BelmontGabriel", "hinrunde", "7", "1"),
        ("El Scizor", "rueckrunde", "8", "2"),
        ("El Scizor", "rueckrunde", "9", "3"),
    ]


def test_s10_playoff_mode_keeps_only_playoff_columns():
    rows = extract_wide_roster_matchday_rows(
        [
            ["", "", "", "", "", "Wackel Backel"],
            ["", "", "", "", "", "1", "2", "3", "P1", "P2", "Fin"],
            ["", "", "", "", "", "S", "S", "N", "S", "N", "S"],
            ["", "Bene", "Ogerpon-Gestein", "", "", "1", "0", "2", "4", "", "2"],
        ],
        [_team("season_010", "Playoffs", "Bene", "Wackel Backel")],
        season_id="season_010",
        division="Playoffs",
        roster_phase="playoffs",
        source_table="Playoffs Kader",
        source_file="playoffs_kader.csv",
        source_urls="https://sheet.test/playoffs-kader",
        notes="test",
        week_mode="playoffs_only",
    )

    assert [(row["week"], row["week_label"], row["kills"]) for row in rows] == [
        ("P1", "PO 1", "4"),
        ("Fin", "Finale", "2"),
    ]


def _team(season_id: str, division: str, person: str, team: str) -> dict[str, str]:
    return {
        "season_id": season_id,
        "division": division,
        "person_name": person,
        "person_name_normalized": person.lower(),
        "team_name": team,
        "team_name_normalized": team.lower(),
    }
