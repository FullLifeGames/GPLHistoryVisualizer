from pathlib import Path

from gpl_history.storage import read_json, write_json
from gpl_history.external_sources import EXTERNAL_WORKBOOKS, fetch_external_workbooks
from gpl_history.normalize import (
    _external_old_project_s1_killlists,
    _replace_season_001_killlists_with_external_old_project,
)


class FakeSheetsClient:
    def __init__(self):
        self.calls = []

    def fetch_visible_tabs(self, spreadsheet_id: str, out_dir: Path, source_url: str):
        self.calls.append((spreadsheet_id, out_dir, source_url))
        out_dir.mkdir(parents=True, exist_ok=True)
        raw_path = out_dir / f"{spreadsheet_id}_all_0.csv"
        raw_path.write_text("player_a,player_b\nBene,Cabgolord\n", encoding="utf-8")
        return [
            {
                "sheet_id": spreadsheet_id,
                "workbook_title": "Workbook",
                "gid": "0",
                "title": "All",
                "index": 0,
                "source_url": source_url,
                "raw_path": str(raw_path).replace("\\", "/"),
                "status": "available",
                "status_code": 200,
                "error": None,
                "rows": 2,
                "columns": 2,
                "fetch_method": "sheets_api",
            }
        ]


def test_fetch_external_workbooks_writes_per_workbook_indexes_and_manifest(tmp_path):
    client = FakeSheetsClient()

    results = fetch_external_workbooks(tmp_path, client)

    assert len(client.calls) == len(EXTERNAL_WORKBOOKS)
    assert {result["label"] for result in results} == {workbook.label for workbook in EXTERNAL_WORKBOOKS}
    first = EXTERNAL_WORKBOOKS[0]
    workbook_dir = tmp_path / "raw" / "external" / first.label
    assert (workbook_dir / "workbook.json").exists()
    assert (workbook_dir / "sheets_index.json").exists()
    assert (tmp_path / "raw" / "external" / "external_sheets_index.json").exists()
    sheets_index = read_json(workbook_dir / "sheets_index.json", [])
    assert sheets_index[0]["source_url"].endswith("#gid=0")


def test_external_old_project_s1_killlists_parse_appearances_and_source(tmp_path):
    sheet_path = _write_external_s1_kills_sheet(tmp_path)

    rows = _external_old_project_s1_killlists(tmp_path)

    assert rows == [
        {
            "season_id": "season_001",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Meistagrif",
            "pokemon_normalized": "meistagrif",
            "trainer": "DaumenkinoLP",
            "trainer_normalized": "daumenkino",
            "team_name": None,
            "appearances": "6",
            "kills": "16",
            "data_status": "partial_external_old_project_sheet",
            "source_urls": "https://docs.google.com/spreadsheets/d/old/edit#gid=1222240008",
        }
    ]
    assert sheet_path.exists()


def test_replace_season_001_killlists_with_external_old_project_keeps_other_seasons(tmp_path):
    _write_external_s1_kills_sheet(tmp_path)
    existing_rows = [
        {
            "season_id": "season_001",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Meistagrif",
            "pokemon_normalized": "meistagrif",
            "trainer": "DaumenkinoLP",
            "trainer_normalized": "daumenkino",
            "team_name": "Melting Mamoswines",
            "appearances": None,
            "kills": "11",
            "data_status": "partial_sheet_extracted",
            "source_urls": "https://example.test/partial",
        },
        {
            "season_id": "season_002",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Pixi",
            "pokemon_normalized": "pixi",
            "trainer": "SteveParker",
            "trainer_normalized": "steveparker",
            "team_name": "ToxicBlast",
            "appearances": None,
            "kills": "20",
            "data_status": "sheet_extracted",
            "source_urls": "https://example.test/s2",
        },
    ]

    rows = _replace_season_001_killlists_with_external_old_project(tmp_path, existing_rows)

    assert [row["season_id"] for row in rows] == ["season_002", "season_001"]
    assert rows[1]["kills"] == "16"
    assert rows[1]["appearances"] == "6"
    assert rows[1]["data_status"] == "partial_external_old_project_sheet"


def _write_external_s1_kills_sheet(tmp_path):
    workbook_dir = tmp_path / "raw" / "external" / "old_project_ewige_tabelle"
    sheets_dir = workbook_dir / "sheets"
    sheets_dir.mkdir(parents=True)
    sheet_path = sheets_dir / "old_s1_kills.csv"
    sheet_path.write_text(
        ",,GPL Pokémon Kill Rang:,,,,\n"
        ",,Pokémon,Kills,Einsätze,Kanal,Sp. 1,Sp. 2\n"
        "Rang,,,,,,,\n"
        "5,\"15,94\",Meistagrif,16,6,DaumenkinoLP,,4\n",
        encoding="utf-8",
    )
    write_json(
        workbook_dir / "sheets_index.json",
        [
            {
                "sheet_id": "old",
                "workbook_title": "Ewige Tabelle GPL",
                "gid": "1222240008",
                "title": "S1 Kills",
                "index": 5,
                "source_url": "https://docs.google.com/spreadsheets/d/old/edit#gid=1222240008",
                "raw_path": str(sheet_path).replace("\\", "/"),
                "status": "available",
                "rows": 4,
                "columns": 8,
            }
        ],
    )
    return sheet_path
