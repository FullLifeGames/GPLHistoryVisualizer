from pathlib import Path


def test_ci_runs_all_web_unit_tests():
    workflow = Path(".github/workflows/ci.yml").read_text(encoding="utf-8")

    assert "node --test tests/*.mjs" in workflow

