from __future__ import annotations

import csv
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .normalize import _canonical_name, _display_name
from .storage import ensure_dir, read_json, safe_slug, video_url, write_json
from .urls import extract_urls, normalize_url
from .video_stats import VIDEO_STATS_FIELDS, enrich_video_rows_with_stats, load_video_stats
from .youtube import YouTubeApiError, YouTubeClient

VIDEO_ARCHIVE_FIELDS = [
    "video_id",
    "video_url",
    "title",
    "video_type",
    "published_at",
    "channel_id",
    "channel_title",
    "channel_url",
    "source_person_ids",
    "source_person_names",
    "source_team_names",
    "source_seasons",
    "division",
    "detected_season_id",
    "detected_week",
    "detected_stage",
    "detected_round",
    "match_status",
    "best_match_id",
    "confidence",
    "confidence_tier",
    "match_basis",
    "confidence_explanation",
    "perspective_person",
    "opponent",
    *VIDEO_STATS_FIELDS,
    "source_urls",
]

MATCH_VIDEO_FIELDS = [
    "season_id",
    "match_id",
    "division",
    "stage",
    "week",
    "player_a",
    "player_b",
    "score",
    "video_id",
    "video_url",
    "video_title",
    "video_type",
    "published_at",
    "perspective_person",
    "opponent",
    "confidence",
    "match_basis",
    "confidence_explanation",
    "channel_title",
    "channel_url",
    *VIDEO_STATS_FIELDS,
    "source_urls",
]

_GPL_RE = re.compile(r"(?:\bgpl\b|german\s+pok[eé]mon\s+league)", re.IGNORECASE)
_FOREIGN_LEAGUE_RE = re.compile(r"\b(?:gpc|udt)\b", re.IGNORECASE)
_NON_GPL_SERIES_RE = re.compile(r"\bpaldea\s*-?\s*fabrik\b", re.IGNORECASE)
_SEASON_RE = re.compile(r"(?:season|saison|staffel|\bs)\s*0?([0-9]{1,2})\b", re.IGNORECASE)
_WEEK_RE = re.compile(r"(?:spieltag|matchday|sp\.?|st\.?|week|woche)\s*#?\s*0?([0-9]{1,2})\b", re.IGNORECASE)
_WEEK_PREFIX_RE = re.compile(r"\b0?([0-9]{1,2})\.\s*(?:spieltag|matchday|st\.?|week|woche)\b", re.IGNORECASE)
_VERSUS_RE = re.compile(r"(?:\bvs\.?\b|\bversus\b|\bgegen\b)", re.IGNORECASE)
_DATE_RE = re.compile(r"\b([0-9]{1,2})\.([0-9]{1,2})\.([0-9]{4})\b")
_PUBLISH_DATE_TOLERANCE_DAYS = 60
_TEAMBUILDING_TOKENS = {
    "teambuilding",
    "team building",
    "team build",
    "team preview",
    "teamvorstellung",
    "kaderanalyse",
}
_SHOWMATCH_TOKENS = {
    "show battle",
    "showbattle",
    "showkampf",
    "showmatch",
}
_CATEGORY_TOKENS = {
    "announcement": {
        "ankundigung",
        "ankuendigung",
        "announcement",
        "info",
        "infos",
        "information",
    },
    "update": {
        "update",
        "news",
    },
    "reaction": {
        "reaction",
        "reaktion",
        "reagiere",
        "reagiert",
        "gehate",
        "meine meinung",
    },
    "recap": {
        "recap",
        "ruckblick",
        "review",
        "zusammenfassung",
    },
    "draft_analysis": {
        "draftanalyse",
        "draft analyse",
        "draft analysis",
        "draft recap",
        "draft ranking",
    },
    "tierlist": {
        "tierlist",
        "tierliste",
        "power ranking",
        "powerranking",
    },
}
_OTHER_VIDEO_TOKENS = {
    "update",
    "ankundigung",
    "ankuendigung",
    "announcement",
    "reaction",
    "recap",
    "rueckblick",
}
_ROUND_LABELS = (
    ("spiel um platz 3", "platz_3"),
    ("platz 3", "platz_3"),
    ("third place", "platz_3"),
    ("halbfinale", "halbfinale"),
    ("semifinals", "halbfinale"),
    ("semifinal", "halbfinale"),
    ("semi final", "halbfinale"),
    ("viertelfinale", "viertelfinale"),
    ("quarterfinals", "viertelfinale"),
    ("quarterfinal", "viertelfinale"),
    ("quarter final", "viertelfinale"),
    ("finale", "finale"),
    ("final", "finale"),
)


def channel_candidate_from_url(url: str | None) -> dict[str, str] | None:
    if not url:
        return None
    parsed = urlparse(normalize_url(url))
    host = parsed.netloc.lower().removeprefix("www.")
    if host in {"youtu.be", "youtube.de"}:
        host = "youtube.com"
    if host not in {"youtube.com", "m.youtube.com"}:
        return None

    parts = [part for part in parsed.path.split("/") if part]
    if not parts:
        return None
    first = parts[0]
    if first in {"watch", "playlist", "shorts", "embed", "live"}:
        return None
    if first.startswith("@"):
        handle = first
        return {"kind": "handle", "value": handle, "canonical_url": f"https://www.youtube.com/{handle}"}
    if first == "channel" and len(parts) >= 2:
        channel_id = parts[1]
        return {"kind": "channel_id", "value": channel_id, "canonical_url": f"https://www.youtube.com/channel/{channel_id}"}
    if first in {"user", "c"} and len(parts) >= 2:
        value = parts[1]
        return {"kind": "username" if first == "user" else "custom", "value": value, "canonical_url": f"https://www.youtube.com/{first}/{value}"}
    return None


def parse_gpl_video_title(title: str | None) -> dict[str, Any]:
    text = str(title or "")
    folded = _fold_text(text)
    stage = "playoffs" if any(token in folded for token in ["playoff", "finale", "halbfinale", "viertelfinale"]) else "regular_season"
    round_label = _round_label_from_text(text)
    if round_label:
        stage = "playoffs"

    season_match = _SEASON_RE.search(text)
    week_match = _WEEK_RE.search(text) or _WEEK_PREFIX_RE.search(text)
    is_gpl = bool(_GPL_RE.search(text)) and not _FOREIGN_LEAGUE_RE.search(folded) and not _NON_GPL_SERIES_RE.search(folded)
    return {
        "is_gpl": is_gpl,
        "season_id": f"season_{int(season_match.group(1)):03d}" if season_match else None,
        "division": _division_from_title(text),
        "week_number": int(week_match.group(1)) if week_match else None,
        "stage": stage,
        "round": round_label,
        "video_type": classify_video_type(text),
    }


def _division_from_title(title: str | None) -> str | None:
    folded = _fold_text(title)
    if re.search(r"\b(?:oder|or)\s+liga\s*[12]\b", folded):
        return None
    if re.search(r"\bliga\s*1\s*(?:und|and)?\s*2\b", folded):
        return None
    has_league_one = bool(re.search(r"\bliga\s*1\b|\bl1\b", folded))
    has_league_two = bool(re.search(r"\bliga\s*2\b|\bl2\b", folded))
    if has_league_one and has_league_two:
        return None
    if has_league_one:
        return "Liga 1"
    if has_league_two:
        return "Liga 2"
    return None


def classify_video_type(title: str | None) -> str:
    text = str(title or "")
    folded = _fold_text(text)
    has_week = bool(_WEEK_RE.search(text) or _WEEK_PREFIX_RE.search(text))
    has_round = _round_label_from_text(text) is not None
    has_versus = bool(_VERSUS_RE.search(text))
    has_teambuilding = any(token in folded for token in _TEAMBUILDING_TOKENS)
    if any(token in folded for token in _SHOWMATCH_TOKENS):
        return "showmatch"
    if has_teambuilding and not _is_teambuilding_joke_match_title(folded, has_week=has_week, has_round=has_round, has_versus=has_versus):
        return "teambuilding"
    if re.search(r"\br\s*(?:u|ue)?ckblick\b", folded):
        return "recap"
    for category, tokens in _CATEGORY_TOKENS.items():
        if any(token in folded for token in tokens):
            return category
    if (has_week or has_round) and has_versus:
        return "game"
    if has_week or has_round or has_versus:
        return "game"
    return "other"


def _is_teambuilding_joke_match_title(folded_title: str, *, has_week: bool, has_round: bool, has_versus: bool) -> bool:
    if not has_versus or not (has_week or has_round):
        return False
    return bool(re.search(r"\b(?:team\s*building|team\s*build|teambuilding)\s+fail\b", folded_title))


def _round_label_from_text(value: str | None) -> str | None:
    folded = _fold_text(value)
    for token, label in _ROUND_LABELS:
        pattern = r"\b" + r"\s+".join(re.escape(part) for part in token.split()) + r"\b"
        if token == "final":
            pattern += r"(?!\s+(?:matchday|schedule)\b)"
        if re.search(pattern, folded):
            return label
    return None


def discover_channel_candidates(data_dir: Path, include_description_channels: bool = False) -> list[dict[str, Any]]:
    candidates: dict[tuple[str, str], dict[str, Any]] = {}
    team_rows = _read_csv(data_dir / "normalized" / "teams.csv")
    team_lookup = _team_rows_by_description_label(team_rows)

    for row in team_rows:
        candidate = channel_candidate_from_url(row.get("channel_url"))
        if not candidate:
            continue
        _add_channel_candidate(
            candidates,
            candidate,
            sources=[row.get("channel_url")],
            person_ids=[row.get("person_id")],
            person_names=[row.get("person_name")],
            team_names=[row.get("team_name")],
            seasons=[row.get("season_id")],
            divisions=[row.get("division")],
        )

    for row in _read_csv(data_dir / "manual" / "video_channels.csv"):
        candidate = _manual_channel_candidate(row)
        if not candidate:
            continue
        _add_channel_candidate(
            candidates,
            candidate,
            sources=[row.get("source_urls"), row.get("canonical_url"), row.get("channel_url")],
            person_ids=[row.get("source_person_ids")],
            person_names=[row.get("source_person_names")],
            team_names=[row.get("source_team_names")],
            seasons=[row.get("source_seasons")],
            divisions=[row.get("source_divisions")],
        )

    if include_description_channels:
        for mention in _description_participant_channel_mentions(data_dir):
            candidate = channel_candidate_from_url(mention.get("url"))
            if not candidate:
                continue
            matched_rows = _matched_team_rows_for_description_label(
                team_lookup,
                mention.get("season_id"),
                mention.get("label"),
            )
            if not matched_rows:
                continue
            for row in matched_rows:
                _add_channel_candidate(
                    candidates,
                    candidate,
                    sources=[mention.get("url")],
                    person_ids=[row.get("person_id")],
                    person_names=[row.get("person_name")],
                    team_names=[row.get("team_name")],
                    seasons=[row.get("season_id")],
                    divisions=[row.get("division")],
                )

    rows = []
    for current in candidates.values():
        rows.append(
            {
                **{key: current[key] for key in ["kind", "value", "canonical_url"]},
                "source_urls": _join_sorted(current["sources"]),
                "source_person_ids": _join_sorted(current["person_ids"]),
                "source_person_names": _join_display_names(current["person_names"]),
                "source_team_names": _join_sorted(current["team_names"]),
                "source_seasons": _join_sorted(current["seasons"]),
                "source_divisions": _join_sorted(current["divisions"]),
            }
        )
    return sorted(rows, key=lambda row: (row["source_person_names"], row["canonical_url"]))


def _add_channel_candidate(
    candidates: dict[tuple[str, str], dict[str, Any]],
    candidate: dict[str, str],
    *,
    sources: list[str | None],
    person_ids: list[str | None],
    person_names: list[str | None],
    team_names: list[str | None],
    seasons: list[str | None],
    divisions: list[str | None],
) -> None:
    key = (candidate["kind"], candidate["value"].lower())
    current = candidates.get(key) or {
        **candidate,
        "sources": set(),
        "person_ids": set(),
        "person_names": set(),
        "team_names": set(),
        "seasons": set(),
        "divisions": set(),
    }
    for values, target in (
        (sources, current["sources"]),
        (person_ids, current["person_ids"]),
        (person_names, current["person_names"]),
        (team_names, current["team_names"]),
        (seasons, current["seasons"]),
        (divisions, current["divisions"]),
    ):
        for value in values:
            for part in _split_values(value):
                _add_nonempty(target, part)
    candidates[key] = current


def _manual_channel_candidate(row: dict[str, str]) -> dict[str, str] | None:
    kind = str(row.get("kind") or "").strip()
    value = str(row.get("value") or "").strip()
    canonical_url = str(row.get("canonical_url") or row.get("channel_url") or "").strip()
    if not canonical_url:
        canonical_url = next(iter(_split_values(row.get("source_urls"))), "")

    if kind and value:
        if kind == "handle" and not value.startswith("@"):
            value = f"@{value}"
        return {
            "kind": kind,
            "value": value,
            "canonical_url": canonical_url or _canonical_channel_url(kind, value),
        }
    return channel_candidate_from_url(canonical_url)


def _canonical_channel_url(kind: str, value: str) -> str:
    if kind == "handle":
        return f"https://www.youtube.com/{value}"
    if kind == "channel_id":
        return f"https://www.youtube.com/channel/{value}"
    if kind in {"username", "custom"}:
        prefix = "user" if kind == "username" else "c"
        return f"https://www.youtube.com/{prefix}/{value}"
    return value


def _description_participant_channel_mentions(data_dir: Path) -> list[dict[str, str]]:
    seen: set[tuple[str, str, str]] = set()
    mentions: list[dict[str, str]] = []
    for path in sorted((data_dir / "raw").glob("season_*/videos.json")):
        season_id = path.parent.name
        for video in read_json(path, []):
            for mention in _participant_channel_mentions_from_description(video.get("description")):
                key = (season_id, _name_key(mention["label"]), mention["url"])
                if key in seen:
                    continue
                seen.add(key)
                mentions.append({"season_id": season_id, **mention})
    return mentions


def _participant_channel_mentions_from_description(description: str | None) -> list[dict[str, str]]:
    mentions: list[dict[str, str]] = []
    in_participant_block = False
    current_label: str | None = None
    found_mention = False

    for raw_line in str(description or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        folded = _fold_text(line)
        if _is_participant_block_start(folded):
            in_participant_block = True
            current_label = None
            continue
        if not in_participant_block:
            continue
        if _looks_like_description_separator(line) and found_mention:
            break

        urls = extract_urls(line)
        if urls:
            label = _clean_description_participant_label(line.split(urls[0], 1)[0]) or current_label
            current_label = None
            if not label or _is_description_section_label(label):
                continue
            for url in urls:
                if channel_candidate_from_url(url):
                    mentions.append({"label": label, "url": url})
                    found_mention = True
            continue

        label = _clean_description_participant_label(line)
        current_label = None if not label or _is_description_section_label(label) else label

    return mentions


def _team_rows_by_description_label(rows: list[dict[str, str]]) -> dict[tuple[str, str], list[dict[str, str]]]:
    lookup: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        season_id = row.get("season_id")
        if not season_id:
            continue
        labels = [row.get("person_name"), row.get("team_name"), *_split_values(row.get("aliases"))]
        for label in labels:
            for key in {_name_key(label), _name_key(_display_name(label))}:
                if key:
                    lookup[(season_id, key)].append(row)
    return lookup


def _matched_team_rows_for_description_label(
    lookup: dict[tuple[str, str], list[dict[str, str]]],
    season_id: str | None,
    label: str | None,
) -> list[dict[str, str]]:
    if not season_id or not label:
        return []
    keys = {_name_key(label), _name_key(_display_name(label))}
    matched: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for key in keys:
        for row in lookup.get((season_id, key), []):
            row_key = (row.get("season_id") or "", row.get("person_id") or "", row.get("team_id") or row.get("team_name") or "")
            if row_key in seen:
                continue
            seen.add(row_key)
            matched.append(row)
    return matched


def _clean_description_participant_label(value: str | None) -> str | None:
    label = str(value or "").strip()
    label = re.sub(r"^[^\w@]+", "", label, flags=re.UNICODE)
    label = re.sub(r"\s+", " ", label).strip(" :-\t")
    return label or None


def _is_description_section_label(value: str | None) -> bool:
    folded = _fold_text(value).strip(" :")
    return folded in {"liga 1", "liga 2", "sun conference", "moon conference", "teilnehmer", "alle teilnehmer"}


def _is_participant_block_start(folded_line: str) -> bool:
    return any(
        token in folded_line
        for token in {
            "alle teilnehmer",
            "teilnehmerfeld",
            "teilnehmer feld",
            "teilnehmer liste",
            "teilnehmerliste",
        }
    )


def _looks_like_description_separator(value: str | None) -> bool:
    text = str(value or "").strip()
    return len(text) >= 8 and not re.search(r"[A-Za-z0-9]", text)


def scan_video_archive(
    data_dir: Path,
    client: YouTubeClient,
    max_channels: int | None = None,
    max_pages_per_channel: int | None = None,
    include_description_channels: bool = False,
    resume: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    raw_dir = ensure_dir(data_dir / "raw" / "video_archive")
    channels_path = raw_dir / "channels.json"
    candidates = discover_channel_candidates(data_dir, include_description_channels=include_description_channels)
    if max_channels is not None:
        candidates = candidates[:max_channels]

    rows_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    if resume:
        for row in read_json(channels_path, []):
            key = _channel_record_key(row)
            if key:
                rows_by_key[key] = row

    for candidate in candidates:
        key = (candidate["kind"], candidate["value"].lower())
        record = _merge_cached_channel_record(candidate, rows_by_key.get(key))
        if resume and _cached_upload_scan_is_current(record):
            rows_by_key[key] = record
            write_json(channels_path, list(rows_by_key.values()))
            continue
        try:
            channel = _cached_channel_resolution(record) or _resolve_channel_candidate(client, candidate)
            record.update(channel)
            playlist_id = channel.get("uploadsPlaylistId")
            videos = client.list_playlist_videos(playlist_id, max_pages=max_pages_per_channel) if playlist_id else []
            raw_path = raw_dir / f"{safe_slug(channel.get('channelId') or candidate['value'])}_uploads.json"
            write_json(raw_path, videos)
            record.update(
                {
                    "status": "available",
                    "error": None,
                    "video_count": len(videos),
                    "raw_path": str(raw_path).replace("\\", "/"),
                }
            )
        except YouTubeApiError as exc:
            cached_raw_path = _cached_raw_path(record) or _infer_raw_upload_path(raw_dir, record, candidate)
            if cached_raw_path:
                videos = read_json(cached_raw_path, [])
                if not record.get("channelId") and candidate.get("kind") == "channel_id":
                    record["channelId"] = candidate.get("value")
                if not record.get("title"):
                    record["title"] = _first_nonempty(_split_values(record.get("source_person_names") or candidate.get("source_person_names")))
                record.update(
                    {
                        "status": "available",
                        "error": None,
                        "refresh_error": str(exc),
                        "video_count": len(videos),
                        "raw_path": str(cached_raw_path).replace("\\", "/"),
                    }
                )
            else:
                record.update({"status": "unavailable", "error": str(exc), "video_count": 0, "raw_path": None})
        rows_by_key[key] = record
        write_json(channels_path, list(rows_by_key.values()))

    write_json(channels_path, list(rows_by_key.values()))
    return build_video_archive(data_dir)


def _channel_record_key(row: dict[str, Any]) -> tuple[str, str] | None:
    kind = str(row.get("kind") or "").strip()
    value = str(row.get("value") or "").strip().lower()
    if kind and value:
        return (kind, value)
    return None


def _merge_cached_channel_record(candidate: dict[str, Any], cached: dict[str, Any] | None) -> dict[str, Any]:
    if not cached:
        return dict(candidate)
    record = dict(cached)
    for key, value in candidate.items():
        if value not in (None, ""):
            record[key] = value
    return record


def _cached_upload_scan_is_current(record: dict[str, Any]) -> bool:
    if record.get("status") != "available" or not record.get("raw_path"):
        return False
    raw_path = _cached_raw_path(record)
    if not raw_path:
        return False
    videos = read_json(raw_path, [])
    if not videos:
        return True
    return any(
        "videoPublishedAt" in video or "playlistPublishedAt" in video or "defaultLanguage" in video
        for video in videos
    )


def _cached_raw_path(record: dict[str, Any]) -> Path | None:
    raw_path = record.get("raw_path")
    if not raw_path:
        return None
    path = Path(str(raw_path))
    if path.exists():
        return path
    return None


def _infer_raw_upload_path(raw_dir: Path, record: dict[str, Any], candidate: dict[str, Any]) -> Path | None:
    channel_ids = [
        record.get("channelId"),
        candidate.get("channelId"),
        record.get("value") if record.get("kind") == "channel_id" else None,
        candidate.get("value") if candidate.get("kind") == "channel_id" else None,
    ]
    for channel_id in channel_ids:
        if not channel_id:
            continue
        path = raw_dir / f"{safe_slug(str(channel_id))}_uploads.json"
        if path.exists():
            return path
    return None


def _cached_channel_resolution(record: dict[str, Any]) -> dict[str, Any] | None:
    if not record.get("channelId") or not record.get("uploadsPlaylistId"):
        return None
    return {
        "channelId": record.get("channelId"),
        "title": record.get("title"),
        "description": record.get("description"),
        "publishedAt": record.get("publishedAt"),
        "customUrl": record.get("customUrl"),
        "uploadsPlaylistId": record.get("uploadsPlaylistId"),
        "source": record.get("source"),
    }


def _forced_video_type_from_channel(channel: dict[str, Any]) -> str | None:
    divisions = {_fold_text(value) for value in _split_values(channel.get("source_divisions"))}
    if "reaction" in divisions:
        return "reaction"
    return None


def build_video_archive(data_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    raw_dir = data_dir / "raw" / "video_archive"
    channel_rows = _merge_channel_rows(read_json(raw_dir / "channels.json", []))
    excluded_video_ids = _manual_excluded_video_ids(data_dir)
    teams = _read_csv(data_dir / "normalized" / "teams.csv")
    season_windows = _season_date_windows(_read_csv(data_dir / "normalized" / "seasons.csv"))
    matches = [
        row
        for row in _read_csv(data_dir / "normalized" / "matches.csv")
        if row.get("data_status") not in {"not_available", "source_video_only"}
    ]
    matches = _enrich_matches_with_team_names(matches, teams)

    archive_rows: list[dict[str, Any]] = []
    match_video_rows: list[dict[str, Any]] = []
    seen_videos: set[tuple[str, str]] = set()
    for channel in channel_rows:
        raw_path = channel.get("raw_path")
        if not raw_path:
            continue
        source_person_names = _normalized_source_person_names(channel.get("source_person_names"))
        source_person_ids = _normalized_source_person_ids(channel.get("source_person_ids"), source_person_names)
        videos = read_json(Path(raw_path), [])
        for video in videos:
            video_id = video.get("videoId")
            if video_id and video_id in excluded_video_ids:
                continue
            title = video.get("title")
            parsed = parse_gpl_video_title(title)
            if not parsed["is_gpl"]:
                continue
            inferred_season_id = parsed["season_id"] or _season_from_publish_date(
                video,
                season_windows,
                channel.get("source_seasons"),
            )
            video_type = _forced_video_type_from_channel(channel) or parsed["video_type"]
            key = (channel.get("channelId") or channel.get("canonical_url") or "", video_id or title or "")
            if key in seen_videos:
                continue
            seen_videos.add(key)

            video_row = {
                "video_id": video_id,
                "video_url": video_url(video_id),
                "title": title,
                "video_type": video_type,
                "published_at": video.get("publishedAt"),
                "channel_id": channel.get("channelId"),
                "channel_title": channel.get("title"),
                "channel_url": channel.get("canonical_url"),
                "source_person_ids": source_person_ids,
                "source_person_names": source_person_names,
                "source_team_names": channel.get("source_team_names"),
                "source_seasons": channel.get("source_seasons"),
                "division": parsed["division"],
                "detected_season_id": inferred_season_id,
                "detected_week": str(parsed["week_number"]) if parsed["week_number"] is not None else None,
                "detected_stage": parsed["stage"],
                "detected_round": parsed["round"],
                "source_urls": _join_unique([video_url(video_id), channel.get("source_urls"), channel.get("canonical_url")]),
            }
            match = None
            if video_type == "game":
                match = match_video_to_matches(
                    {
                        **video_row,
                        "channel_person_name": source_person_names,
                        "channel_team_name": channel.get("source_team_names"),
                    },
                    matches,
                )
            if match:
                video_row["detected_season_id"] = video_row.get("detected_season_id") or match.get("season_id")
                video_row["division"] = video_row.get("division") or match.get("division")
                video_row["detected_week"] = video_row.get("detected_week") or (
                    str(_week_number(match.get("week"))) if _week_number(match.get("week")) is not None else None
                )
                video_row["detected_stage"] = video_row.get("detected_stage") or match.get("stage")
                video_row.update(
                    {
                        "match_status": "matched",
                        "best_match_id": match["match_id"],
                        "confidence": str(match["confidence"]),
                        "confidence_tier": _confidence_tier(match["confidence"]),
                        "match_basis": match.get("match_basis"),
                        "confidence_explanation": match.get("confidence_explanation"),
                        "perspective_person": match["perspective_person"],
                        "opponent": match["opponent"],
                    }
                )
                match_video_rows.append(_match_video_row(match, video_row))
            else:
                video_row.update(
                    {
                        "match_status": video_type if video_type != "game" else "unmatched",
                        "best_match_id": None,
                        "confidence": None,
                        "confidence_tier": None,
                        "match_basis": None,
                        "confidence_explanation": None,
                        "perspective_person": _first_nonempty(_split_values(source_person_names)),
                        "opponent": None,
                    }
                )
            archive_rows.append(video_row)

    existing_video_ids = {row.get("video_id") for row in archive_rows if row.get("video_id")}
    for video_row in _manual_archive_rows(data_dir):
        if video_row.get("video_id") in existing_video_ids:
            continue
        archive_rows.append(video_row)
        if video_row.get("video_id"):
            existing_video_ids.add(video_row.get("video_id"))

    archive_rows.sort(
        key=lambda row: (
            _season_order(row.get("detected_season_id")),
            _week_order(row.get("detected_week")),
            row.get("published_at") or "",
            row.get("title") or "",
        )
    )
    archive_rows = enrich_video_rows_with_stats(archive_rows, load_video_stats(data_dir))
    archive_by_video_id = {row.get("video_id"): row for row in archive_rows if row.get("video_id")}
    match_video_rows.extend(_manual_reference_match_rows(data_dir, archive_by_video_id, matches))
    for row in match_video_rows:
        stats = archive_by_video_id.get(row.get("video_id"), {})
        for field in VIDEO_STATS_FIELDS:
            row[field] = stats.get(field, "")
    match_video_rows = _dedupe_match_video_rows(match_video_rows)
    out_dir = ensure_dir(data_dir / "normalized")
    _write_csv(out_dir / "video_archive.csv", VIDEO_ARCHIVE_FIELDS, archive_rows)
    _write_csv(out_dir / "match_videos.csv", MATCH_VIDEO_FIELDS, match_video_rows)
    _write_video_url_list(out_dir / "video_urls.txt", archive_rows)
    return archive_rows, match_video_rows


def _manual_excluded_video_ids(data_dir: Path) -> set[str]:
    return {
        str(row.get("video_id") or "").strip()
        for row in _read_csv(data_dir / "manual" / "video_exclusions.csv")
        if str(row.get("video_id") or "").strip()
    }


def _merge_channel_rows(channel_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    order: list[tuple[str, str]] = []

    for row in channel_rows:
        channel_id = str(row.get("channelId") or "").strip()
        key = ("channel_id", channel_id) if channel_id else (
            str(row.get("kind") or ""),
            str(row.get("value") or row.get("canonical_url") or ""),
        )
        if key not in grouped:
            grouped[key] = dict(row)
            grouped[key]["_source_person_ids"] = set()
            grouped[key]["_source_person_names"] = set()
            grouped[key]["_source_team_names"] = set()
            grouped[key]["_source_seasons"] = set()
            grouped[key]["_source_divisions"] = set()
            grouped[key]["_source_urls"] = set()
            order.append(key)

        current = grouped[key]
        for field, target in (
            ("source_person_ids", "_source_person_ids"),
            ("source_person_names", "_source_person_names"),
            ("source_team_names", "_source_team_names"),
            ("source_seasons", "_source_seasons"),
            ("source_divisions", "_source_divisions"),
        ):
            for value in _split_values(row.get(field)):
                current[target].add(value)

        for value in _split_values(row.get("source_urls")):
            current["_source_urls"].add(value)
        if row.get("canonical_url"):
            current["_source_urls"].add(row["canonical_url"])

        for field in ("raw_path", "channelId", "title", "canonical_url"):
            if not current.get(field) and row.get(field):
                current[field] = row[field]

    merged_rows: list[dict[str, Any]] = []
    for key in order:
        row = grouped[key]
        merged = {field: value for field, value in row.items() if not field.startswith("_")}
        merged["source_person_ids"] = _join_sorted(row["_source_person_ids"])
        merged["source_person_names"] = _join_display_names(row["_source_person_names"])
        merged["source_team_names"] = _join_sorted(row["_source_team_names"])
        merged["source_seasons"] = _join_sorted(row["_source_seasons"])
        merged["source_divisions"] = _join_sorted(row["_source_divisions"])
        merged["source_urls"] = _join_sorted(row["_source_urls"])
        merged_rows.append(merged)
    return merged_rows


def _manual_archive_rows(data_dir: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in _read_csv(data_dir / "manual" / "video_archive.csv"):
        video_id = row.get("video_id")
        title = row.get("title")
        parsed = parse_gpl_video_title(title)
        video_type = row.get("video_type") or parsed["video_type"]
        source_person_names = _normalized_source_person_names(row.get("source_person_names"))
        rows.append(
            {
                "video_id": video_id,
                "video_url": row.get("video_url") or video_url(video_id),
                "title": title,
                "video_type": video_type,
                "published_at": row.get("published_at"),
                "channel_id": row.get("channel_id"),
                "channel_title": row.get("channel_title"),
                "channel_url": row.get("channel_url"),
                "source_person_ids": row.get("source_person_ids") or _normalized_source_person_ids(row.get("source_person_ids"), source_person_names),
                "source_person_names": source_person_names,
                "source_team_names": row.get("source_team_names"),
                "source_seasons": row.get("source_seasons") or row.get("detected_season_id") or parsed["season_id"],
                "division": row.get("division") or parsed["division"],
                "detected_season_id": row.get("detected_season_id") or parsed["season_id"],
                "detected_week": row.get("detected_week") or (str(parsed["week_number"]) if parsed["week_number"] is not None else None),
                "detected_stage": row.get("detected_stage") or parsed["stage"],
                "detected_round": row.get("detected_round") or parsed["round"],
                "match_status": row.get("match_status") or ("unmatched" if video_type == "game" else video_type),
                "best_match_id": row.get("best_match_id"),
                "confidence": row.get("confidence"),
                "confidence_tier": _confidence_tier(row.get("confidence")),
                "match_basis": row.get("match_basis"),
                "confidence_explanation": row.get("confidence_explanation"),
                "perspective_person": row.get("perspective_person") or _first_nonempty(_split_values(source_person_names)),
                "opponent": row.get("opponent"),
                "source_urls": _join_unique([row.get("source_urls"), row.get("video_url"), video_url(video_id), row.get("channel_url")]),
            }
        )
    return rows


def _manual_reference_match_rows(
    data_dir: Path,
    archive_by_video_id: dict[str | None, dict[str, Any]],
    matches: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for reference in _read_csv(data_dir / "manual" / "video_references.csv"):
        video = archive_by_video_id.get(reference.get("video_id"))
        if not video:
            continue
        for match in matches:
            if not _reference_applies_to_match(reference, match):
                continue
            reference_video = {
                **video,
                "video_type": reference.get("video_type") or video.get("video_type"),
                "perspective_person": reference.get("perspective_person") or video.get("perspective_person"),
                "opponent": reference.get("opponent") or video.get("opponent"),
            }
            reference_match = {
                **match,
                "confidence": reference.get("confidence") or "100",
                "match_basis": reference.get("match_basis") or "manual_reference",
                "confidence_explanation": reference.get("confidence_explanation") or "manual video reference",
            }
            rows.append(_match_video_row(reference_match, reference_video))
    return rows


def _reference_applies_to_match(reference: dict[str, str], match: dict[str, Any]) -> bool:
    match_id = reference.get("match_id")
    if match_id:
        return match.get("match_id") == match_id
    for field in ("season_id", "division", "stage"):
        if reference.get(field) and reference.get(field) != match.get(field):
            return False
    if reference.get("week") and not _same_week(reference.get("week"), match.get("week")):
        return False
    if reference.get("round") and _round_label_from_text(match.get("week")) != reference.get("round"):
        return False
    return True


def _same_week(left: str | None, right: str | None) -> bool:
    left_week = _week_number(left)
    right_week = _week_number(right)
    if left_week is not None or right_week is not None:
        return left_week == right_week
    return _fold_text(left) == _fold_text(right)


def match_video_to_matches(video: dict[str, Any], matches: list[dict[str, Any]]) -> dict[str, Any] | None:
    parsed = parse_gpl_video_title(video.get("title"))
    if parsed["video_type"] != "game":
        return None
    title_key = _name_key(video.get("title"))
    source_seasons = {season for season in _split_values(video.get("source_seasons")) if re.fullmatch(r"season_\d{3}", season)}
    channel_people = [_display_name(value) for value in _split_values(video.get("channel_person_name") or video.get("source_person_names"))]
    channel_teams = _split_values(video.get("channel_team_name") or video.get("source_team_names"))

    candidates: list[dict[str, Any]] = []
    for match in matches:
        if parsed["season_id"] and match.get("season_id") != parsed["season_id"]:
            continue
        date_delta = _publish_date_match_delta_days(video, match) if not parsed["season_id"] else None
        if not parsed["season_id"] and date_delta is not None and date_delta > _PUBLISH_DATE_TOLERANCE_DAYS:
            continue
        if not parsed["season_id"] and source_seasons and match.get("season_id") not in source_seasons and date_delta is None:
            continue
        if parsed["division"] and match.get("division") != parsed["division"]:
            continue
        score = 0
        reasons: list[str] = []
        explanations: list[str] = []

        if parsed["season_id"]:
            score += 35
            reasons.append("season")
            explanations.append(f"matched season {parsed['season_id']}")
        elif source_seasons and match.get("season_id") in source_seasons:
            score += 35
            reasons.append("source_season")
            explanations.append(f"matched source season {match.get('season_id')}")
        elif date_delta is not None:
            score += 10
            reasons.append("publish_date")
            explanations.append(f"publish date is within {date_delta} days of match week")
        if parsed["stage"] == "playoffs" and match.get("stage") == "playoffs":
            score += 15
            reasons.append("stage")
            explanations.append("playoff title matched playoff match")
        elif parsed["stage"] == "playoffs" and match.get("stage") != "playoffs":
            continue

        parsed_round = parsed["round"]
        if parsed_round:
            match_round = _round_label_from_text(match.get("week"))
            if match_round != parsed_round:
                continue
            score += 25
            reasons.append("round")
            explanations.append(f"matched playoff round {parsed_round}")

        parsed_week = parsed["week_number"]
        match_week = _week_number(match.get("week"))
        if parsed_week is not None and match_week != parsed_week:
            continue
        if parsed_week is not None:
            score += 25
            reasons.append("week")
            explanations.append(f"matched week {parsed_week}")

        participants = _match_participants(match)
        channel_side = _find_channel_participant(channel_people, channel_teams, participants)
        title_sides = [
            side
            for side in participants
            if _participant_in_title(side, title_key)
            and (not channel_side or side["side"] != channel_side["side"] or side["key"] != channel_side["key"])
        ]
        if channel_side:
            score += 25
            reasons.append("channel")
            explanations.append(f"channel identifies {channel_side.get('person') or channel_side.get('team')}")
        if title_sides:
            score += 25
            reasons.append("title")
            explanations.append(
                "title names "
                + " and ".join(side.get("person") or side.get("team") or "opponent" for side in title_sides)
                + " as opponent"
            )
        if channel_side and title_sides:
            score += 10
            reasons.append("both_sides")
            explanations.append("channel and title identify opposite sides")
        if not channel_side and len(title_sides) >= 2:
            score += 10
            reasons.append("title_both_sides")
            explanations.append("title identifies both match sides")

        has_match_context = bool(parsed["season_id"] or source_seasons or parsed_week is not None or parsed["round"])
        has_participant_evidence = bool(channel_side or title_sides)
        has_title_or_round_context = bool(title_sides or parsed_week is not None or parsed["round"])
        if score < 60 or not has_match_context or not has_title_or_round_context or not has_participant_evidence:
            continue

        if not parsed["season_id"] and match.get("season_id"):
            explanations.insert(0, f"matched season {match.get('season_id')} from normalized match")

        perspective = channel_side["person"] if channel_side else None
        opponent = _opponent_name(participants, channel_side, title_sides)
        result = {
            **match,
            "confidence": min(score, 100),
            "perspective_person": perspective,
            "opponent": opponent,
            "match_basis": ",".join(reasons),
            "confidence_explanation": "; ".join(dict.fromkeys(explanations)),
        }
        candidates.append(result)

    if not candidates:
        return None
    candidates.sort(key=lambda row: row["confidence"], reverse=True)
    best = candidates[0]
    if parsed["week_number"] is None and not parsed["round"]:
        similarly_good = [row for row in candidates if row["confidence"] >= best["confidence"] - 5]
        if len(similarly_good) > 1:
            return None
    return best


def _resolve_channel_candidate(client: YouTubeClient, candidate: dict[str, Any]) -> dict[str, Any]:
    if candidate["kind"] == "channel_id":
        return client.resolve_channel(channel_id=candidate["value"])
    return client.resolve_channel(query=candidate["value"])


def _match_video_row(match: dict[str, Any], video: dict[str, Any]) -> dict[str, Any]:
    return {
        "season_id": match.get("season_id"),
        "match_id": match.get("match_id"),
        "division": match.get("division"),
        "stage": match.get("stage"),
        "week": match.get("week"),
        "player_a": match.get("player_a"),
        "player_b": match.get("player_b"),
        "score": f"{match.get('score_a') or '?'} - {match.get('score_b') or '?'}"
        if match.get("score_a") or match.get("score_b")
        else None,
        "video_id": video.get("video_id"),
        "video_url": video.get("video_url"),
        "video_title": video.get("title"),
        "video_type": video.get("video_type"),
        "published_at": video.get("published_at") or video.get("publishedAt") or video.get("videoPublishedAt"),
        "perspective_person": video.get("perspective_person"),
        "opponent": video.get("opponent"),
        "confidence": video.get("confidence"),
        "match_basis": match.get("match_basis"),
        "confidence_explanation": match.get("confidence_explanation"),
        "channel_title": video.get("channel_title"),
        "channel_url": video.get("channel_url"),
        "source_urls": video.get("source_urls"),
    }


def _confidence_tier(value: str | int | None) -> str | None:
    score = int(value or 0)
    if score >= 85:
        return "high"
    if score >= 70:
        return "medium"
    if score:
        return "low"
    return None


def _dedupe_match_video_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    for row in rows:
        key = (row.get("match_id") or "", row.get("video_id") or "", _name_key(row.get("perspective_person")))
        current = best_by_key.get(key)
        if current is None or int(row.get("confidence") or 0) > int(current.get("confidence") or 0):
            best_by_key[key] = row
    return sorted(best_by_key.values(), key=lambda row: (row.get("season_id") or "", row.get("week") or "", row.get("match_id") or "", row.get("perspective_person") or ""))


def _enrich_matches_with_team_names(matches: list[dict[str, Any]], teams: list[dict[str, str]]) -> list[dict[str, Any]]:
    teams_by_person: dict[tuple[str, str], set[str]] = defaultdict(set)
    for row in teams:
        if row.get("data_status") == "not_available":
            continue
        season_id = row.get("season_id")
        person_key = _name_key(row.get("person_name"))
        team_name = row.get("team_name")
        if season_id and person_key and team_name:
            teams_by_person[(season_id, person_key)].add(team_name)

    enriched = []
    for row in matches:
        current = dict(row)
        for side, player_field, team_field in (("a", "player_a", "team_a"), ("b", "player_b", "team_b")):
            if current.get(team_field):
                continue
            team_names = teams_by_person.get((current.get("season_id") or "", _name_key(current.get(player_field))), set())
            if team_names:
                current[team_field] = ";".join(sorted(team_names))
        enriched.append(current)
    return enriched


def _match_participants(match: dict[str, Any]) -> list[dict[str, str]]:
    return [
        _participant("a", match.get("player_a"), match.get("team_a")),
        _participant("b", match.get("player_b"), match.get("team_b")),
    ]


def _participant(side: str, person: str | None, team: str | None) -> dict[str, Any]:
    aliases = [person or "", *_split_values(team)]
    return {"side": side, "person": person or "", "team": team or "", "aliases": aliases, "key": _name_key(person or team)}


def _find_participant(names: list[str], participants: list[dict[str, str]]) -> dict[str, str] | None:
    keys = {_name_key(name) for name in names if name}
    keys.discard("")
    for participant in participants:
        participant_keys = {_name_key(alias) for alias in participant.get("aliases", [])}
        if keys.intersection(participant_keys):
            return participant
    return None


def _find_channel_participant(
    channel_people: list[str],
    channel_teams: list[str],
    participants: list[dict[str, str]],
) -> dict[str, str] | None:
    person_side = _find_participant(channel_people, participants)
    if person_side:
        return person_side
    if channel_people:
        return None
    return _find_participant(channel_teams, participants)


def _participant_in_title(participant: dict[str, str], title_key: str) -> bool:
    return any(_contains_name(title_key, value) for value in participant.get("aliases", []))


def _opponent_name(participants: list[dict[str, str]], channel_side: dict[str, str] | None, title_sides: list[dict[str, str]]) -> str | None:
    if channel_side:
        for participant in participants:
            if participant["side"] != channel_side["side"]:
                return participant.get("person") or participant.get("team")
    if title_sides:
        return title_sides[0].get("person") or title_sides[0].get("team")
    return None


def _contains_name(haystack_key: str, value: str | None) -> bool:
    key = _name_key(value)
    if not key or len(key) < 3:
        return False
    compact_haystack = haystack_key.replace(" ", "")
    compact_key = key.replace(" ", "")
    return key in haystack_key or compact_key in compact_haystack


def _publish_date_match_delta_days(video: dict[str, Any], match: dict[str, Any]) -> int | None:
    published = _published_date(video)
    match_date = _date_from_text(match.get("week")) or _date_from_text(match.get("date"))
    if not published or not match_date:
        return None
    return abs((published - match_date).days)


def _season_date_windows(rows: list[dict[str, str]]) -> list[tuple[str, datetime.date, datetime.date]]:
    windows: list[tuple[str, datetime.date, datetime.date]] = []
    for row in rows:
        season_id = row.get("season_id")
        start = _published_date({"published_at": row.get("start_date")})
        end = _published_date({"published_at": row.get("end_date")})
        if not season_id or not start or not end:
            continue
        windows.append((season_id, start, end))
    return windows


def _season_from_publish_date(
    video: dict[str, Any],
    season_windows: list[tuple[str, datetime.date, datetime.date]],
    source_seasons: str | None = None,
) -> str | None:
    published = _published_date(video)
    if not published:
        return None
    allowed_seasons = {season for season in _split_values(source_seasons) if re.fullmatch(r"season_\d{3}", season)}
    best_season: str | None = None
    best_delta: int | None = None
    for season_id, start, end in season_windows:
        if allowed_seasons and season_id not in allowed_seasons:
            continue
        if start <= published <= end:
            delta = 0
        else:
            delta = min(abs((published - start).days), abs((published - end).days))
        if delta > _PUBLISH_DATE_TOLERANCE_DAYS:
            continue
        if best_delta is None or delta < best_delta:
            best_season = season_id
            best_delta = delta
    return best_season


def _published_date(video: dict[str, Any]) -> datetime.date | None:
    value = (
        video.get("published_at")
        or video.get("publishedAt")
        or video.get("videoPublishedAt")
        or video.get("playlistPublishedAt")
    )
    text = str(value or "").strip()
    if not text:
        return None
    if re.fullmatch(r"\d{8}", text):
        text = f"{text[:4]}-{text[4:6]}-{text[6:]}"
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return _date_from_text(text)


def _date_from_text(value: str | None) -> datetime.date | None:
    match = _DATE_RE.search(str(value or ""))
    if not match:
        return None
    day, month, year = (int(part) for part in match.groups())
    try:
        return datetime(year, month, day).date()
    except ValueError:
        return None


def _week_number(value: str | None) -> int | None:
    text = str(value or "")
    match = _WEEK_RE.search(text) or _WEEK_PREFIX_RE.search(text)
    return int(match.group(1)) if match else None


def _season_order(value: str | None) -> int:
    match = re.search(r"season_0*(\d+)", str(value or ""))
    return int(match.group(1)) if match else 999


def _week_order(value: str | None) -> int:
    parsed = _week_number(value) if value and not str(value).isdigit() else None
    if parsed is not None:
        return parsed
    number = int(value) if str(value or "").isdigit() else None
    return number if number is not None else 999


def _name_key(value: str | None) -> str:
    canonical = _canonical_name(value or "")
    return _fold_text(canonical)


def _fold_text(value: str | None) -> str:
    raw = (
        str(value or "")
        .lower()
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    text = unicodedata.normalize("NFD", raw)
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = (
        text.replace("Ã¤", "ae")
        .replace("Ã¶", "oe")
        .replace("Ã¼", "ue")
        .replace("ÃŸ", "ss")
        .replace("pokémon", "pokemon")
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})


def _write_video_url_list(path: Path, rows: list[dict[str, Any]]) -> None:
    urls = [row.get("video_url") for row in rows if row.get("video_url")]
    unique_urls = list(dict.fromkeys(urls))
    path.write_text("\n".join(unique_urls) + ("\n" if unique_urls else ""), encoding="utf-8")


def _add_nonempty(values: set[str], value: str | None) -> None:
    clean = str(value or "").strip()
    if clean:
        values.add(clean)


def _join_sorted(values: set[str]) -> str:
    return ";".join(sorted(values))


def _join_display_names(values: set[str]) -> str:
    names = sorted({_display_name(value) for value in values if value})
    return ";".join(name for name in names if name)


def _normalized_source_person_names(value: str | None) -> str:
    names = [_display_name(part) for part in _split_values(value)]
    return ";".join(dict.fromkeys(name for name in names if name))


def _normalized_source_person_ids(ids_value: str | None, names_value: str | None) -> str:
    ids: list[str] = []
    for name in _split_values(names_value):
        canonical = _canonical_name(name)
        if not canonical:
            continue
        person_id = f"person_{canonical.replace(' ', '_')}"
        if person_id not in ids:
            ids.append(person_id)
    if not ids:
        for person_id in _split_values(ids_value):
            if person_id not in ids:
                ids.append(person_id)
    return ";".join(ids)


def _join_unique(values: list[str | None]) -> str:
    seen = []
    for value in values:
        for part in str(value or "").split(";"):
            clean = part.strip()
            if clean and clean not in seen:
                seen.append(clean)
    return ";".join(seen)


def _split_values(value: str | None) -> list[str]:
    return [part.strip() for part in str(value or "").split(";") if part.strip()]


def _first_nonempty(values: list[str]) -> str | None:
    return next((value for value in values if value), None)
