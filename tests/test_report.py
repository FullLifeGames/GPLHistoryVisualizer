from pathlib import Path

from gpl_history.report import generate_report


def test_report_name_normalization_mentions_cabgolord_display_name(tmp_path):
    report_path = tmp_path / "docs" / "gpl-history.md"

    generate_report(tmp_path / "data", report_path)

    text = report_path.read_text(encoding="utf-8")
    assert "CabgoLord/Fnupa -> Cabgolord" in text
    assert "CabgoLord -> Fnupa" not in text
