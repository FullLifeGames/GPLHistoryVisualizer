from pathlib import Path

from gpl_history.team_graphics import build_team_graphic_slots


def test_build_team_graphic_slots_maps_s4_s5_files_and_s3_rows(tmp_path):
    graphics = tmp_path / "team-graphics"
    (graphics / "s3").mkdir(parents=True)
    (graphics / "s4").mkdir()
    (graphics / "s5").mkdir()
    (graphics / "s3" / "GPL Teams Spieltag 14 (1).jpg").write_bytes(b"fake")
    (graphics / "s4" / "Ritter der Tapukokosnuss - FullLifeGames.png").write_bytes(b"fake")
    (graphics / "s5" / "Victini Bottom.png").write_bytes(b"fake")
    (graphics / "s5" / "Aggron Berlin.png").write_bytes(b"fake")
    (graphics / "s5" / "Shocking Shaymins.png").write_bytes(b"fake")

    teams = [
        {
            "season_id": "season_004",
            "division": "Regular Season",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "team_name": "Ritter der Tapukokosnuss",
            "team_name_normalized": "ritter der tapukokosnuss",
        },
        {
            "season_id": "season_005",
            "division": "Liga 1",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "team_name": "Victini Bottom",
            "team_name_normalized": "victini bottom",
        },
        {
            "season_id": "season_005",
            "division": "Liga 1",
            "person_name": "Parsifani",
            "person_name_normalized": "parsifani",
            "team_name": "Aggron Successors*",
            "team_name_normalized": "aggron successors",
        },
    ]

    rows = build_team_graphic_slots(graphics, teams)

    s4_rows = [row for row in rows if row["season_id"] == "season_004"]
    assert len(s4_rows) == 11
    assert s4_rows[0]["team_name"] == "Ritter der Tapukokosnuss"
    assert s4_rows[0]["person_name"] == "Bene"
    assert s4_rows[0]["image_path"] == "../output/team-graphics/s4/Ritter der Tapukokosnuss - FullLifeGames.png"

    s5_rows = [row for row in rows if row["season_id"] == "season_005"]
    assert len(s5_rows) == 33
    victini_row = next(row for row in s5_rows if row["source_file"].endswith("Victini Bottom.png"))
    assert victini_row["team_name"] == "Victini Bottom"
    assert victini_row["person_name"] == "Bene"
    aggron_row = next(row for row in s5_rows if row["source_file"].endswith("Aggron Berlin.png"))
    assert aggron_row["team_name"] == "Aggron Successors*"
    assert aggron_row["person_name"] == "Parsifani"
    shaymins_row = next(row for row in s5_rows if row["source_file"].endswith("Shocking Shaymins.png"))
    assert shaymins_row["team_name"] == "Shocking Shaymins"
    assert shaymins_row["team_name_normalized"] == "shocking shaymins"
    assert shaymins_row["person_name"] == "MeLevies"
    assert shaymins_row["person_name_normalized"] == "melevies"

    s3_rows = [row for row in rows if row["season_id"] == "season_003"]
    assert len(s3_rows) == 77
    assert s3_rows[0]["graphic_row"] == "1"
    assert s3_rows[0]["team_name"] == ""
    assert s3_rows[0]["crop_width"] == "76"
