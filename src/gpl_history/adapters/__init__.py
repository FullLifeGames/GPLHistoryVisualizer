from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SeasonAdapter:
    season_id: str
    label: str
    parser_key: str = "legacy_monolith"


SEASON_ADAPTERS: dict[str, SeasonAdapter] = {
    f"season_{number:03d}": SeasonAdapter(
        season_id=f"season_{number:03d}",
        label=f"GPL Season {number}",
    )
    for number in range(1, 11)
}


def adapter_for_season(season_id: str) -> SeasonAdapter:
    try:
        return SEASON_ADAPTERS[season_id]
    except KeyError as exc:
        raise KeyError(f"No season adapter registered for {season_id}") from exc

