import csv
from pathlib import Path

from gpl_history.manual import read_manual_table
from gpl_history.normalize import NORMALIZED_FIELDS, normalize_all


def test_read_manual_table_uses_declared_fields_and_skips_empty_rows(tmp_path):
    manual_dir = tmp_path / "manual"
    manual_dir.mkdir()
    path = manual_dir / "champions.csv"
    _write_csv(
        path,
        NORMALIZED_FIELDS["champions"],
        [
            {
                "season_id": "season_011",
                "champion_name": "Example",
                "champion_person_id": "person_example",
                "champion_team": "Example Team",
                "evidence_type": "manual_source",
                "data_status": "manual_override",
                "notes": "Imported from reviewed local correction.",
                "source_urls": "https://example.test/source",
            },
            {},
        ],
    )

    rows = read_manual_table(tmp_path, "champions", NORMALIZED_FIELDS["champions"])

    assert rows == [
        {
            "season_id": "season_011",
            "champion_name": "Example",
            "champion_person_id": "person_example",
            "champion_team": "Example Team",
            "evidence_type": "manual_source",
            "data_status": "manual_override",
            "notes": "Imported from reviewed local correction.",
            "source_urls": "https://example.test/source",
        }
    ]


def test_normalize_all_appends_manual_rows_before_people_are_built(tmp_path):
    manual_dir = tmp_path / "manual"
    manual_dir.mkdir()
    _write_csv(
        manual_dir / "champions.csv",
        NORMALIZED_FIELDS["champions"],
        [
            {
                "season_id": "season_011",
                "champion_name": "Manual Champ",
                "champion_person_id": "person_manual_champ",
                "champion_team": "Manual Team",
                "evidence_type": "manual_source",
                "data_status": "manual_override",
                "notes": "Manual test fixture.",
                "source_urls": "https://example.test/manual",
            }
        ],
    )

    output = normalize_all(tmp_path)

    assert output.champions[0]["champion_name"] == "Manual Champ"
    assert any(row["person_id"] == "person_manual_champ" for row in output.people)
    assert (tmp_path / "normalized" / "champions.csv").exists()


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
