"""Shareable GPL Wrapped PNG cards (Pillow optional extra ``[wrapped]``).

Card semantics mirror web/wrapped.js: champion (sourced), upset/mvp/
kill-leader/spoon awards (computed), most-watched video, closest match.
German-only in v1; PNG bytes are not drift-checked because Pillow output is
not stable across versions. Backgrounds reuse the season roster art the web
app uses (web/assets/roster-backgrounds/) with a dark scrim.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .aggregates import _read_csv

CARD_SIZE = 1080

_CARD_TITLES = {
    "champion": "Champion",
    "upset": "Upset der Saison",
    "mvp": "MVP",
    "kill_leader": "Kill-Leader",
    "top_video": "Meistgesehenes Video",
    "closest": "Engstes Match",
    "spoon": "Holzlöffel",
}

_CARD_ORDER = ["champion", "upset", "mvp", "kill_leader", "top_video", "closest", "spoon"]

_AWARD_CARDS = [("upset_of_season", "upset"), ("mvp", "mvp"), ("kill_leader", "kill_leader"), ("holzloeffel", "spoon")]

_ROSTER_BACKGROUNDS = {
    "season_003": "gpl-s3-background.png",
    "season_004": "gpl-s4-background.png",
    "season_005": "gpl-s5-background.png",
    "season_007": "gpl-s7-background.png",
    "season_008": "gpl-s8-background.png",
    "season_009": "gpl-s9-background-pink-blau.png",
    "season_010": "gpl-s10-background.png",
}

_COMPUTED_NOTE = "Berechnet, nicht offiziell · GPL-Archiv"
_SOURCED_NOTE = "GPL-Archiv"


def _season_number(season_id: str) -> str:
    digits = "".join(char for char in season_id if char.isdigit())
    return f"Saison {int(digits)}" if digits else season_id


def _award_text(awards: list[dict[str, str]], season_id: str, award_key: str, card_key: str) -> dict[str, Any] | None:
    row = next(
        (
            entry
            for entry in awards
            if entry.get("scope") == "season" and entry.get("season_id") == season_id and entry.get("award_key") == award_key
        ),
        None,
    )
    if not row:
        return None
    return {
        "season_id": season_id,
        "card_key": card_key,
        "title": _CARD_TITLES[card_key],
        "name": row.get("person_name") or "",
        "value_line": row.get("value") or "",
        "detail": "",
        "computed": True,
    }


def wrapped_card_texts(
    awards: list[dict[str, str]],
    champions: list[dict[str, str]],
    highlights: list[dict[str, str]],
    videos: list[dict[str, str]],
) -> list[dict[str, Any]]:
    season_ids = sorted(
        {row.get("season_id") or "" for row in champions}
        | {row.get("season_id") or "" for row in awards if row.get("scope") == "season"}
    )
    cards: list[dict[str, Any]] = []
    for season_id in season_ids:
        if not season_id:
            continue
        by_key: dict[str, dict[str, Any]] = {}
        champion = next((row for row in champions if row.get("season_id") == season_id), None)
        if champion:
            by_key["champion"] = {
                "season_id": season_id,
                "card_key": "champion",
                "title": _CARD_TITLES["champion"],
                "name": champion.get("champion_name") or "",
                "value_line": champion.get("champion_team") or "",
                "detail": _season_number(season_id),
                "computed": False,
            }
        for award_key, card_key in _AWARD_CARDS:
            card = _award_text(awards, season_id, award_key, card_key)
            if card:
                by_key[card_key] = card

        season_videos = [
            (float(row.get("view_count") or 0), row)
            for row in videos
            if row.get("detected_season_id") == season_id and (row.get("view_count") or "").strip()
        ]
        if season_videos:
            views, top = max(season_videos, key=lambda entry: entry[0])
            formatted_views = f"{int(views):,}".replace(",", ".")
            by_key["top_video"] = {
                "season_id": season_id,
                "card_key": "top_video",
                "title": _CARD_TITLES["top_video"],
                "name": top.get("title") or "",
                "value_line": f"{formatted_views} Aufrufe",
                "detail": top.get("channel_title") or "",
                "computed": True,
            }

        close = [
            (float(row.get("highlight_score") or 0), row)
            for row in highlights
            if row.get("season_id") == season_id and str(row.get("close_match")) == "1"
        ]
        if close:
            _, top = max(close, key=lambda entry: entry[0])
            by_key["closest"] = {
                "season_id": season_id,
                "card_key": "closest",
                "title": _CARD_TITLES["closest"],
                "name": f"{top.get('player_a')} vs {top.get('player_b')}",
                "value_line": top.get("score") or "",
                "detail": "",
                "computed": True,
            }

        cards.extend(by_key[key] for key in _CARD_ORDER if key in by_key)
    return cards


def _load_font(size: int):
    from PIL import ImageFont

    for name in ("segoeuib.ttf", "segoeui.ttf", "arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _wrap_text(text: str, limit: int = 22) -> list[str]:
    words = str(text).split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) > limit and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines[:3]


def render_wrapped_cards(data_dir: Path, web_dir: Path) -> int:
    try:
        from PIL import Image, ImageDraw
    except ImportError as error:  # pragma: no cover - exercised only without Pillow
        raise SystemExit("Pillow is required: pip install .[wrapped]") from error

    normalized = data_dir / "normalized"
    cards = wrapped_card_texts(
        _read_csv(normalized / "awards.csv"),
        _read_csv(normalized / "champions.csv"),
        _read_csv(normalized / "match_highlights.csv"),
        _read_csv(normalized / "video_archive.csv"),
    )
    out_dir = web_dir / "assets" / "wrapped"
    out_dir.mkdir(parents=True, exist_ok=True)
    backgrounds_dir = web_dir / "assets" / "roster-backgrounds"

    heading_font = _load_font(34)
    title_font = _load_font(58)
    name_font = _load_font(84)
    detail_font = _load_font(44)
    note_font = _load_font(28)

    manifest: list[dict[str, str]] = []
    for card in cards:
        image = Image.new("RGB", (CARD_SIZE, CARD_SIZE), (24, 28, 44))
        art_name = _ROSTER_BACKGROUNDS.get(card["season_id"])
        art_path = backgrounds_dir / art_name if art_name else None
        if art_path and art_path.exists():
            art = Image.open(art_path).convert("RGB")
            scale = max(CARD_SIZE / art.width, CARD_SIZE / art.height)
            art = art.resize((round(art.width * scale), round(art.height * scale)))
            image.paste(art, ((CARD_SIZE - art.width) // 2, (CARD_SIZE - art.height) // 2))
        scrim = Image.new("RGBA", (CARD_SIZE, CARD_SIZE), (10, 12, 20, 165))
        image = Image.alpha_composite(image.convert("RGBA"), scrim).convert("RGB")

        draw = ImageDraw.Draw(image)
        y = 240
        draw.text((CARD_SIZE / 2, y), f"GPL Wrapped · {_season_number(card['season_id'])}", font=heading_font, fill=(220, 224, 235), anchor="mm")
        y += 90
        draw.text((CARD_SIZE / 2, y), card["title"], font=title_font, fill=(255, 255, 255), anchor="mm")
        y += 130
        for line in _wrap_text(card["name"]):
            draw.text((CARD_SIZE / 2, y), line, font=name_font, fill=(255, 255, 255), anchor="mm")
            y += 100
        if card["value_line"]:
            y += 10
            draw.text((CARD_SIZE / 2, y), str(card["value_line"]), font=detail_font, fill=(230, 230, 240), anchor="mm")
            y += 70
        if card["detail"]:
            draw.text((CARD_SIZE / 2, y + 10), str(card["detail"]), font=detail_font, fill=(200, 205, 220), anchor="mm")
        note = _COMPUTED_NOTE if card["computed"] else _SOURCED_NOTE
        draw.text((CARD_SIZE / 2, CARD_SIZE - 64), note, font=note_font, fill=(180, 185, 200), anchor="mm")

        file_name = f"{card['season_id']}-{card['card_key']}.png"
        image.save(out_dir / file_name)
        manifest.append({"season_id": card["season_id"], "card_key": card["card_key"], "file": file_name})

    (out_dir / "manifest.json").write_text(json.dumps({"cards": manifest}, indent=2) + "\n", encoding="utf-8")
    return len(manifest)
