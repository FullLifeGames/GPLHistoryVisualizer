from gpl_history.sheets import _decode_response_content, _sheet_csv_filename
from gpl_history.sheets_api import _values_by_title, visible_sheet_tabs


def test_sheet_csv_filename_includes_sheet_id_and_gid_label():
    assert _sheet_csv_filename("1AbC-De_Fg", "gid_0") == "1abc_de_fg_gid_0.csv"


def test_decode_response_content_prefers_utf8_for_google_csv_bytes():
    assert _decode_response_content("Pokémon".encode("utf-8")) == "Pokémon"


def test_visible_sheet_tabs_filters_hidden_tabs_and_keeps_metadata():
    payload = {
        "properties": {"title": "GPL S9"},
        "sheets": [
            {
                "properties": {
                    "sheetId": 1953155019,
                    "title": "Tabelle",
                    "index": 0,
                    "gridProperties": {"rowCount": 11, "columnCount": 13},
                }
            },
            {
                "properties": {
                    "sheetId": 1306581875,
                    "title": "Backup",
                    "index": 1,
                    "hidden": True,
                    "gridProperties": {"rowCount": 1000, "columnCount": 33},
                }
            },
        ],
    }

    assert visible_sheet_tabs(payload) == [
        {
            "gid": "1953155019",
            "title": "Tabelle",
            "index": 0,
            "row_count": 11,
            "column_count": 13,
        }
    ]


def test_values_by_title_maps_batch_ranges_back_to_tabs():
    tabs = [
        {"title": "Tabelle", "gid": "1"},
        {"title": "Spielplan L1 [Spoilerfrei]", "gid": "2"},
    ]
    payload = {
        "valueRanges": [
            {"range": "'Tabelle'!A1:Z", "values": [["Team", "Punkte"], ["Prekani", "60"]]},
            {"range": "'Spielplan L1 [Spoilerfrei]'!A1:Z", "values": [["Spieltag"]]},
        ]
    }

    assert _values_by_title(payload, tabs) == {
        "Tabelle": [["Team", "Punkte"], ["Prekani", "60"]],
        "Spielplan L1 [Spoilerfrei]": [["Spieltag"]],
    }
