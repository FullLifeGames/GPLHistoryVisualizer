from __future__ import annotations

import re
from collections import defaultdict
from typing import Any


def is_gpl_playlist(playlist: dict[str, Any]) -> bool:
    title = str(playlist.get("title") or "")
    normalized = _normalize_text(title)
    return "german pokemon league" in normalized or re.search(r"\bgpl\b", normalized) is not None


def parse_gpl_season_number(title: str | None) -> int | None:
    if not title:
        return None
    normalized = _normalize_text(title)
    patterns = [
        r"\bgpl\s*\[\s*s\s*(\d+)\s*]",
        r"\bgpl\s*season\s*(\d+)",
        r"\bgpl\s*s\s*(\d+)",
        r"\bseason\s*(\d+)",
        r"\bsaison\s*(\d+)",
        r"\bstaffel\s*(\d+)",
        r"\bs\s*(\d+)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            return int(match.group(1))

    if "german pokemon league" in normalized or re.search(r"\bgpl\b", normalized):
        return 1
    return None


def group_gpl_playlists(playlists: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for playlist in playlists:
        if not is_gpl_playlist(playlist):
            continue
        season_number = parse_gpl_season_number(playlist.get("title"))
        if season_number is None:
            continue
        grouped[season_number].append(playlist)

    seasons: list[dict[str, Any]] = []
    for season_number in sorted(grouped):
        season_playlists = sorted(grouped[season_number], key=lambda item: item.get("publishedAt") or "")
        seasons.append(
            {
                "season_number": season_number,
                "season_id": f"season_{season_number:03d}",
                "season_label": f"Season {season_number}",
                "playlists": season_playlists,
            }
        )
    return seasons


def _normalize_text(value: str) -> str:
    normalized = value.lower()
    normalized = (
        normalized.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .replace("é", "e")
    )
    return re.sub(r"\s+", " ", normalized).strip()
