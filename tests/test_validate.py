import csv
from pathlib import Path

from gpl_history.normalize import NORMALIZED_FIELDS
from gpl_history.validate import validate_normalized_data


def test_validate_normalized_data_accepts_current_project_data():
    issues = validate_normalized_data(Path("data"))

    assert [issue for issue in issues if issue.level == "error"] == []


def test_validate_normalized_data_reports_missing_normalized_files(tmp_path):
    issues = validate_normalized_data(tmp_path)

    assert any(issue.level == "error" and issue.table == "seasons" and "Missing" in issue.message for issue in issues)


def test_validate_normalized_data_reports_header_and_source_url_problems(tmp_path):
    normalized = tmp_path / "normalized"
    normalized.mkdir()
    for table, fields in NORMALIZED_FIELDS.items():
        _write_csv(normalized / f"{table}.csv", fields, [])
    _write_csv(
        normalized / "seasons.csv",
        ["season_id", "season_label"],
        [{"season_id": "season_001", "season_label": "Season 1"}],
    )
    _write_csv(
        normalized / "matches.csv",
        NORMALIZED_FIELDS["matches"],
        [
            {
                "season_id": "season_001",
                "match_id": "m1",
                "data_status": "sheet_extracted",
                "source_urls": "",
            }
        ],
    )

    issues = validate_normalized_data(tmp_path)

    assert any(issue.level == "error" and issue.table == "seasons" and "header mismatch" in issue.message for issue in issues)
    assert any(issue.level == "warning" and issue.table == "matches" and "source_urls" in issue.message for issue in issues)


def _write_csv(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
