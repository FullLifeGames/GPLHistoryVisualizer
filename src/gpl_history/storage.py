from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def safe_slug(value: str, fallback: str = "item") -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    return slug or fallback


def season_dir_name(index: int) -> str:
    return f"season_{index:03d}"


def video_url(video_id: str | None) -> str | None:
    if not video_id:
        return None
    return f"https://www.youtube.com/watch?v={video_id}"


def playlist_url(playlist_id: str | None) -> str | None:
    if not playlist_id:
        return None
    return f"https://www.youtube.com/playlist?list={playlist_id}"
