import pytest

from gpl_history.adapters import SEASON_ADAPTERS, adapter_for_season


def test_all_known_gpl_seasons_are_registered():
    assert sorted(SEASON_ADAPTERS) == [f"season_{number:03d}" for number in range(1, 11)]
    assert all(adapter.parser_key == "legacy_monolith" for adapter in SEASON_ADAPTERS.values())


def test_adapter_lookup_rejects_unknown_season():
    with pytest.raises(KeyError):
        adapter_for_season("season_011")

