import csv
from pathlib import Path

from gpl_history.manual import read_manual_table
from gpl_history.normalize import (
    NORMALIZED_FIELDS,
    _apply_team_pokemon_usage_to_killlists,
    _replace_generated_killlists_with_manual_overrides,
    normalize_all,
)


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


def test_manual_killlist_rows_replace_trainerless_generated_rows():
    rows = [
        {
            "season_id": "season_003",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Snibunna",
            "pokemon_normalized": "snibunna",
            "trainer": "",
            "trainer_normalized": "",
            "team_name": "",
            "appearances": "",
            "kills": "20",
            "deaths": "",
            "differential": "",
            "data_status": "sheet_extracted",
            "source_urls": "https://example.test/old-sheet",
        },
        {
            "season_id": "season_003",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Snibunna",
            "pokemon_normalized": "snibunna",
            "trainer": "Bene",
            "trainer_normalized": "bene",
            "team_name": "Unlimited Blade Works",
            "appearances": "",
            "kills": "20",
            "deaths": "",
            "differential": "",
            "data_status": "manual_override",
            "source_urls": "https://example.test/old-sheet;data/manual/sources/s3-s5-pokemon-usage.csv",
        },
    ]

    result = _replace_generated_killlists_with_manual_overrides(rows)

    assert result == [rows[1]]


def test_manual_killlist_rows_replace_graphic_assigned_generated_rows():
    rows = [
        {
            "season_id": "season_003",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Heatran",
            "pokemon_normalized": "heatran",
            "trainer": "Bene",
            "trainer_normalized": "bene",
            "team_name": "Unlimited Blade Works",
            "appearances": "",
            "kills": "20",
            "deaths": "",
            "differential": "",
            "data_status": "manual_graphic_assignment",
            "source_urls": "https://example.test/old-sheet;data/manual/team_pokemon_usage.csv",
        },
        {
            "season_id": "season_003",
            "division": "Regular Season",
            "stage": "regular_season",
            "pokemon": "Heatran",
            "pokemon_normalized": "heatran",
            "trainer": "Bene",
            "trainer_normalized": "bene",
            "team_name": "Unlimited Blade Works",
            "appearances": "",
            "kills": "20",
            "deaths": "",
            "differential": "",
            "data_status": "manual_override",
            "source_urls": "https://example.test/old-sheet;data/manual/team_pokemon_usage.csv;data/manual/pokemon_killlists.csv",
        },
    ]

    result = _replace_generated_killlists_with_manual_overrides(rows)

    assert result == [rows[1]]


def test_team_pokemon_usage_enriches_trainerless_killlist_rows_without_changing_kills():
    killlists = [
        {
            "season_id": "season_005",
            "division": "Liga 1",
            "stage": "full_season",
            "pokemon": "Snibunna",
            "pokemon_normalized": "snibunna",
            "trainer": "",
            "trainer_normalized": "",
            "team_name": "",
            "appearances": "",
            "kills": "24",
            "deaths": "",
            "differential": "",
            "data_status": "sheet_extracted",
            "source_urls": "https://example.test/old-sheet",
        }
    ]
    usage_rows = [
        {
            "season_id": "season_005",
            "division": "Liga 1",
            "team_name": "Victini Bottom",
            "team_name_normalized": "victini bottom",
            "person_name": "Bene",
            "person_name_normalized": "bene",
            "pokemon": "Snibunna",
            "pokemon_normalized": "snibunna",
            "slot": "1",
            "source_file": "output/team-graphics/s5/Victini Bottom.png",
            "source_urls": "data/manual/team_pokemon_usage.csv",
            "data_status": "manual_override",
        }
    ]

    enriched = _apply_team_pokemon_usage_to_killlists(killlists, usage_rows)

    assert enriched[0]["trainer"] == "Bene"
    assert enriched[0]["trainer_normalized"] == "bene"
    assert enriched[0]["team_name"] == "Victini Bottom"
    assert enriched[0]["kills"] == "24"
    assert enriched[0]["data_status"] == "manual_graphic_assignment"
    assert (
        enriched[0]["source_urls"]
        == "https://example.test/old-sheet;data/manual/team_pokemon_usage.csv;output/team-graphics/s5/Victini Bottom.png"
    )


def test_team_pokemon_usage_leaves_ambiguous_usage_rows_unassigned():
    killlists = [
        {
            "season_id": "season_005",
            "division": "Liga 1",
            "stage": "full_season",
            "pokemon": "Snibunna",
            "pokemon_normalized": "snibunna",
            "kills": "24",
            "data_status": "sheet_extracted",
            "source_urls": "https://example.test/old-sheet",
        }
    ]
    usage_rows = [
        {"season_id": "season_005", "pokemon_normalized": "snibunna", "person_name": "Bene", "team_name": "Victini Bottom"},
        {"season_id": "season_005", "pokemon_normalized": "snibunna", "person_name": "PresentLP", "team_name": "Prekani"},
    ]

    enriched = _apply_team_pokemon_usage_to_killlists(killlists, usage_rows)

    assert enriched == killlists


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})
