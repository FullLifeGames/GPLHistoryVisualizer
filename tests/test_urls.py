from gpl_history.urls import extract_urls, normalize_url, resolve_google_sheets_id
from gpl_history.normalize import _header


def test_extract_urls_finds_plain_markdown_and_bare_links():
    description = """
    Tabelle: https://docs.google.com/spreadsheets/d/abc123/edit#gid=0
    Short: https://bit.ly/gpl-sheet
    Markdown: [Roster](https://example.com/roster?team=alpha).
    Angle: <https://youtu.be/video123>
    """

    assert extract_urls(description) == [
        "https://docs.google.com/spreadsheets/d/abc123/edit#gid=0",
        "https://bit.ly/gpl-sheet",
        "https://example.com/roster?team=alpha",
        "https://youtu.be/video123",
    ]


def test_extract_urls_repairs_common_obfuscation_and_strips_punctuation():
    description = "Sheet: docs.google.com/spreadsheets/d/sheet_123/edit, backup www.example.org/path)."

    assert extract_urls(description) == [
        "https://docs.google.com/spreadsheets/d/sheet_123/edit",
        "https://www.example.org/path",
    ]


def test_normalize_url_keeps_query_and_fragment_but_removes_wrappers():
    assert normalize_url("(https://example.com/a?b=1#c).") == "https://example.com/a?b=1#c"


def test_resolve_google_sheets_id_from_standard_link():
    url = "https://docs.google.com/spreadsheets/d/1AbC-De_Fg1234567890/edit#gid=42"

    assert resolve_google_sheets_id(url) == "1AbC-De_Fg1234567890"


def test_resolve_google_sheets_id_from_public_csv_export_link():
    url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vPublic/pub?output=csv"

    assert resolve_google_sheets_id(url) == "2PACX-1vPublic"


def test_resolve_google_sheets_id_ignores_non_sheet_links():
    assert resolve_google_sheets_id("https://example.com/spreadsheets/d/nope/edit") is None


def test_header_folds_pokemon_accent():
    assert _header("Pokémon") == "pokemon"
