from __future__ import annotations

import csv
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from .normalize import _canonical_name, _display_name
from .storage import ensure_dir, read_json, safe_slug, video_url, write_json
from .urls import extract_urls, normalize_url
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
    "perspective_person",
    "opponent",
    "confidence",
    "match_basis",
    "confidence_explanation",
    "channel_title",
    "channel_url",
    "source_urls",
]

_GPL_RE = re.compile(r"(?:\bgpl\b|german\s+pok[eé]mon\s+league)", re.IGNORECASE)
_SEASON_RE = re.compile(r"(?:season|saison|staffel|\bs)\s*0?([0-9]{1,2})\b", re.IGNORECASE)
_WEEK_RE = re.compile(r"(?:spieltag|sp\.?|st\.?|week|woche)\s*0?([0-9]{1,2})\b", re.IGNORECASE)
_WEEK_PREFIX_RE = re.compile(r"\b0?([0-9]{1,2})\.\s*(?:spieltag|st\.?|week|woche)\b", re.IGNORECASE)
_VERSUS_RE = re.compile(r"(?:\bvs\.?\b|\bversus\b|\bgegen\b)", re.IGNORECASE)
_TEAMBUILDING_TOKENS = {
    "teambuilding",
    "team building",
    "team build",
    "team preview",
    "teamvorstellung",
    "kaderanalyse",
}
_CATEGORY_TOKENS = {
    "announcement": {
        "ankundigung",
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
    "announcement",
    "reaction",
    "recap",
    "rueckblick",
}
_ROUND_LABELS = {
    "finale": "finale",
    "final": "finale",
    "halbfinale": "halbfinale",
    "semifinal": "halbfinale",
    "semi final": "halbfinale",
    "viertelfinale": "viertelfinale",
    "quarterfinal": "viertelfinale",
    "quarter final": "viertelfinale",
    "platz 3": "platz_3",
    "third place": "platz_3",
}


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
    round_label = None
    for token, label in _ROUND_LABELS.items():
        if token in folded:
            round_label = label
            stage = "playoffs"
            break

    season_match = _SEASON_RE.search(text)
    week_match = _WEEK_RE.search(text) or _WEEK_PREFIX_RE.search(text)
    return {
        "is_gpl": bool(_GPL_RE.search(text)),
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
    has_round = any(token in folded for token in _ROUND_LABELS)
    has_versus = bool(_VERSUS_RE.search(text))
    if (has_week or has_round) and has_versus:
        return "game"
    if any(token in folded for token in _TEAMBUILDING_TOKENS):
        return "teambuilding"
    for category, tokens in _CATEGORY_TOKENS.items():
        if any(token in folded for token in tokens):
            return category
    if has_week or has_round or has_versus:
        return "game"
    return "other"


def discover_channel_candidates(data_dir: Path, include_description_channels: bool = False) -> list[dict[str, Any]]:
    candidates: dict[tuple[str, str], dict[str, Any]] = {}
    team_rows = _read_csv(data_dir / "normalized" / "teams.csv")
    team_lookup = _team_rows_by_description_label(team_rows)

    for row in team_rows:
        candidate = channel_candidate_from_url(row.get("channel_url"))
        if not candidate:
            continue
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
        _add_nonempty(current["sources"], row.get("channel_url"))
        _add_nonempty(current["person_ids"], row.get("person_id"))
        _add_nonempty(current["person_names"], row.get("person_name"))
        _add_nonempty(current["team_names"], row.get("team_name"))
        _add_nonempty(current["seasons"], row.get("season_id"))
        _add_nonempty(current["divisions"], row.get("division"))
        candidates[key] = current

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
            _add_nonempty(current["sources"], mention.get("url"))
            for row in matched_rows:
                _add_nonempty(current["person_ids"], row.get("person_id"))
                _add_nonempty(current["person_names"], row.get("person_name"))
                _add_nonempty(current["team_names"], row.get("team_name"))
                _add_nonempty(current["seasons"], row.get("season_id"))
                _add_nonempty(current["divisions"], row.get("division"))
            candidates[key] = current

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
        if "alle teilnehmer" in folded:
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


def _looks_like_description_separator(value: str | None) -> bool:
    text = str(value or "").strip()
    return len(text) >= 8 and not re.search(r"[A-Za-z0-9]", text)


def scan_video_archive(
    data_dir: Path,
    client: YouTubeClient,
    max_channels: int | None = None,
    max_pages_per_channel: int | None = None,
    include_description_channels: bool = False,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    raw_dir = ensure_dir(data_dir / "raw" / "video_archive")
    candidates = discover_channel_candidates(data_dir, include_description_channels=include_description_channels)
    if max_channels is not None:
        candidates = candidates[:max_channels]

    channel_rows: list[dict[str, Any]] = []
    for candidate in candidates:
        record = dict(candidate)
        try:
            channel = _resolve_channel_candidate(client, candidate)
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
            record.update({"status": "unavailable", "error": str(exc), "video_count": 0, "raw_path": None})
        channel_rows.append(record)

    write_json(raw_dir / "channels.json", channel_rows)
    return build_video_archive(data_dir)


def build_video_archive(data_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    raw_dir = data_dir / "raw" / "video_archive"
    channel_rows = read_json(raw_dir / "channels.json", [])
    teams = _read_csv(data_dir / "normalized" / "teams.csv")
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
        videos = read_json(Path(raw_path), [])
        for video in videos:
            video_id = video.get("videoId")
            title = video.get("title")
            parsed = parse_gpl_video_title(title)
            if not parsed["is_gpl"]:
                continue
            key = (channel.get("channelId") or channel.get("canonical_url") or "", video_id or title or "")
            if key in seen_videos:
                continue
            seen_videos.add(key)

            video_row = {
                "video_id": video_id,
                "video_url": video_url(video_id),
                "title": title,
                "video_type": parsed["video_type"],
                "published_at": video.get("publishedAt"),
                "channel_id": channel.get("channelId"),
                "channel_title": channel.get("title"),
                "channel_url": channel.get("canonical_url"),
                "source_person_ids": channel.get("source_person_ids"),
                "source_person_names": channel.get("source_person_names"),
                "source_team_names": channel.get("source_team_names"),
                "source_seasons": channel.get("source_seasons"),
                "division": parsed["division"],
                "detected_season_id": parsed["season_id"],
                "detected_week": str(parsed["week_number"]) if parsed["week_number"] is not None else None,
                "detected_stage": parsed["stage"],
                "detected_round": parsed["round"],
                "source_urls": _join_unique([video_url(video_id), channel.get("source_urls"), channel.get("canonical_url")]),
            }
            match = match_video_to_matches(
                {
                    **video_row,
                    "channel_person_name": channel.get("source_person_names"),
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
                video_type = parsed["video_type"]
                video_row.update(
                    {
                        "match_status": video_type if video_type != "game" else "unmatched",
                        "best_match_id": None,
                        "confidence": None,
                        "confidence_tier": None,
                        "match_basis": None,
                        "confidence_explanation": None,
                        "perspective_person": _first_nonempty(_split_values(channel.get("source_person_names"))),
                        "opponent": None,
                    }
                )
            archive_rows.append(video_row)

    archive_rows.sort(
        key=lambda row: (
            _season_order(row.get("detected_season_id")),
            _week_order(row.get("detected_week")),
            row.get("published_at") or "",
            row.get("title") or "",
        )
    )
    match_video_rows = _dedupe_match_video_rows(match_video_rows)
    out_dir = ensure_dir(data_dir / "normalized")
    _write_csv(out_dir / "video_archive.csv", VIDEO_ARCHIVE_FIELDS, archive_rows)
    _write_csv(out_dir / "match_videos.csv", MATCH_VIDEO_FIELDS, match_video_rows)
    _write_video_url_list(out_dir / "video_urls.txt", archive_rows)
    return archive_rows, match_video_rows


def match_video_to_matches(video: dict[str, Any], matches: list[dict[str, Any]]) -> dict[str, Any] | None:
    parsed = parse_gpl_video_title(video.get("title"))
    if parsed["video_type"] != "game":
        return None
    title_key = _name_key(video.get("title"))
    channel_people = [_display_name(value) for value in _split_values(video.get("channel_person_name") or video.get("source_person_names"))]
    channel_teams = _split_values(video.get("channel_team_name") or video.get("source_team_names"))

    candidates: list[dict[str, Any]] = []
    for match in matches:
        if parsed["season_id"] and match.get("season_id") != parsed["season_id"]:
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
        if parsed["stage"] == "playoffs" and match.get("stage") == "playoffs":
            score += 15
            reasons.append("stage")
            explanations.append("playoff title matched playoff match")
        elif parsed["stage"] == "playoffs" and match.get("stage") != "playoffs":
            continue

        parsed_week = parsed["week_number"]
        match_week = _week_number(match.get("week"))
        if parsed_week is not None and match_week != parsed_week:
            continue
        if parsed_week is not None:
            score += 25
            reasons.append("week")
            explanations.append(f"matched week {parsed_week}")

        participants = _match_participants(match)
        channel_side = _find_participant(channel_people + channel_teams, participants)
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

        has_match_context = bool(parsed["season_id"] or parsed_week is not None or parsed["round"])
        has_title_or_round_context = bool(title_sides or parsed_week is not None or parsed["round"])
        if score < 60 or not has_match_context or not has_title_or_round_context:
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
    text = unicodedata.normalize("NFD", str(value or "").lower())
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
