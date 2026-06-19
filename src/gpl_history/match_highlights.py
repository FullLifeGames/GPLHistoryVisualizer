from __future__ import annotations

import csv
import math
from pathlib import Path
from typing import Any

from .storage import ensure_dir

MATCH_HIGHLIGHT_FIELDS = [
    "season_id",
    "match_id",
    "division",
    "stage",
    "week",
    "player_a",
    "player_b",
    "score",
    "winner",
    "video_count",
    "view_peak",
    "view_total",
    "view_median",
    "view_multiplier_peak",
    "views_percentile_peak",
    "views_z_score_peak",
    "view_expected_peak",
    "view_trend_multiplier_peak",
    "views_trend_percentile_peak",
    "views_trend_z_score_peak",
    "view_expected_total",
    "view_trend_multiplier_match",
    "views_trend_percentile_match",
    "views_trend_z_score_match",
    "views_total_percentile_match",
    "like_peak",
    "comment_peak",
    "engagement_rate_peak",
    "engagement_multiplier_peak",
    "engagement_percentile_peak",
    "engagement_z_score_peak",
    "peak_perspective",
    "both_sides_spiked",
    "close_match",
    "playoff_match",
    "highlight_score",
    "highlight_reasons",
    "video_urls",
    "source_urls",
    "stats_fetched_at",
]

SINGLE_SOURCE_SCORE_FACTOR = 0.85


def build_and_write_match_highlights(data_dir: Path) -> list[dict[str, Any]]:
    rows = build_match_highlights(data_dir)
    out_path = data_dir / "normalized" / "match_highlights.csv"
    ensure_dir(out_path.parent)
    _write_csv(out_path, MATCH_HIGHLIGHT_FIELDS, rows)
    return rows


def build_match_highlights(data_dir: Path) -> list[dict[str, Any]]:
    matches = {
        row.get("match_id"): row
        for row in _read_csv(data_dir / "normalized" / "matches.csv")
        if row.get("match_id") and row.get("data_status") not in {"not_available", "source_video_only"}
    }
    videos_by_match: dict[str, list[dict[str, str]]] = {}
    for row in _read_csv(data_dir / "normalized" / "match_videos.csv"):
        match_id = row.get("match_id")
        if row.get("video_type") and row.get("video_type") != "game":
            continue
        if not match_id:
            continue
        videos_by_match.setdefault(match_id, []).append(row)

    engagement_stats = _engagement_stats(videos_by_match.values())
    aggregates: list[dict[str, Any]] = []
    for match_id in dict.fromkeys([*matches.keys(), *videos_by_match.keys()]):
        videos = videos_by_match.get(match_id, [])
        match = matches.get(match_id, {})
        fallback_video = videos[0] if videos else {}
        peak = max(videos, key=lambda row: _int(row.get("view_count")), default={})
        peak_engagement_row = max(videos, key=lambda row: engagement_stats.get(id(row), {}).get("multiplier", 0), default={})
        views = [_int(row.get("view_count")) for row in videos if _int(row.get("view_count")) > 0]
        peak_multiplier = max((_float(row.get("views_multiplier")) for row in videos), default=0)
        peak_percentile = max((_float(row.get("views_percentile")) for row in videos), default=0)
        peak_z = max((_float(row.get("views_z_score")) for row in videos), default=0)
        peak_trend_row = max(videos, key=lambda row: _float(row.get("views_trend_multiplier")), default={})
        peak_trend_multiplier = max((_float(row.get("views_trend_multiplier")) for row in videos), default=0)
        peak_trend_percentile = max((_float(row.get("views_trend_percentile")) for row in videos), default=0)
        peak_trend_z = max((_float(row.get("views_trend_z_score")) for row in videos), default=0)
        expected_values = [_float(row.get("views_expected")) for row in videos if _float(row.get("views_expected")) > 0]
        view_total = sum(views)
        view_expected_total = sum(expected_values)
        match_trend_multiplier = view_total / view_expected_total if view_expected_total else peak_trend_multiplier
        trend_view_share = _int(peak_trend_row.get("view_count")) / view_total if view_total else 0
        perspectives = {
            _key(row.get("perspective_person") or row.get("channel_title"))
            for row in videos
            if _float(row.get("views_trend_multiplier")) >= 1.5
        }
        close_match = _is_close_match(match, videos)
        playoff_match = (match.get("stage") or fallback_video.get("stage")) == "playoffs" or (match.get("division") or fallback_video.get("division")) == "Playoffs"
        engagement_peak = engagement_stats.get(id(peak_engagement_row), {})
        aggregates.append(
            {
                "match_id": match_id,
                "match": match,
                "videos": videos,
                "peak": peak,
                "peak_trend_row": peak_trend_row,
                "peak_multiplier": peak_multiplier,
                "peak_percentile": peak_percentile,
                "peak_z": peak_z,
                "peak_trend_multiplier": peak_trend_multiplier,
                "peak_trend_percentile": peak_trend_percentile,
                "peak_trend_z": peak_trend_z,
                "trend_view_share": trend_view_share,
                "views": views,
                "view_total": view_total,
                "view_expected_total": view_expected_total,
                "match_trend_multiplier": match_trend_multiplier,
                "perspectives": perspectives,
                "close_match": close_match,
                "playoff_match": playoff_match,
                "engagement_peak": engagement_peak,
            }
        )

    match_stats = _match_trend_stats(aggregates)
    rows: list[dict[str, Any]] = []
    for aggregate in aggregates:
        match = aggregate["match"]
        videos = aggregate["videos"]
        peak = aggregate["peak"]
        peak_trend_row = aggregate["peak_trend_row"]
        views = aggregate["views"]
        match_trend_percentile = _percentile_rank(match_stats["sorted"], aggregate["match_trend_multiplier"])
        match_trend_z = _robust_log_z_score(aggregate["match_trend_multiplier"], match_stats["median_log"], match_stats["mad_log"])
        match_total_percentile = _percentile_rank(match_stats["sorted_view_totals"], aggregate["view_total"])
        score, reasons = _highlight_score(
            match_view_multiplier=aggregate["match_trend_multiplier"],
            match_views_percentile=match_trend_percentile,
            match_views_z_score=match_trend_z,
            raw_attention_percentile=match_total_percentile,
            perspective_multiplier=aggregate["peak_trend_multiplier"],
            perspective_views_percentile=aggregate["peak_trend_percentile"],
            perspective_views_z_score=aggregate["peak_trend_z"],
            perspective_view_share=aggregate["trend_view_share"],
            engagement_multiplier=aggregate["engagement_peak"].get("multiplier", 0),
            engagement_percentile=aggregate["engagement_peak"].get("percentile", 0),
            engagement_z_score=aggregate["engagement_peak"].get("z_score", 0),
            close_match=aggregate["close_match"],
            playoff_match=aggregate["playoff_match"],
            both_sides_spiked=len(aggregate["perspectives"]) >= 2,
            videos=videos,
        )
        fallback_video = videos[0] if videos else {}
        rows.append(
            {
                "season_id": match.get("season_id") or fallback_video.get("season_id"),
                "match_id": aggregate["match_id"],
                "division": match.get("division") or fallback_video.get("division"),
                "stage": match.get("stage") or fallback_video.get("stage"),
                "week": match.get("week") or fallback_video.get("week"),
                "player_a": match.get("player_a") or fallback_video.get("player_a"),
                "player_b": match.get("player_b") or fallback_video.get("player_b"),
                "score": _score(match, fallback_video),
                "winner": match.get("winner"),
                "video_count": len(videos),
                "view_peak": _int(peak.get("view_count")),
                "view_total": aggregate["view_total"],
                "view_median": _format_number(_median(views)),
                "view_multiplier_peak": _format_decimal(aggregate["peak_multiplier"]),
                "views_percentile_peak": _format_decimal(aggregate["peak_percentile"]),
                "views_z_score_peak": _format_decimal(aggregate["peak_z"]),
                "view_expected_peak": _format_number(_float(peak_trend_row.get("views_expected"))) if peak_trend_row.get("views_expected") else "",
                "view_trend_multiplier_peak": _format_decimal(aggregate["peak_trend_multiplier"]),
                "views_trend_percentile_peak": _format_decimal(aggregate["peak_trend_percentile"]),
                "views_trend_z_score_peak": _format_decimal(aggregate["peak_trend_z"]),
                "view_expected_total": _format_number(aggregate["view_expected_total"]),
                "view_trend_multiplier_match": _format_decimal(aggregate["match_trend_multiplier"]),
                "views_trend_percentile_match": _format_decimal(match_trend_percentile),
                "views_trend_z_score_match": _format_decimal(match_trend_z),
                "views_total_percentile_match": _format_decimal(match_total_percentile),
                "like_peak": max((_int(row.get("like_count")) for row in videos), default=0),
                "comment_peak": max((_int(row.get("comment_count")) for row in videos), default=0),
                "engagement_rate_peak": _format_decimal(aggregate["engagement_peak"].get("rate", 0)),
                "engagement_multiplier_peak": _format_decimal(aggregate["engagement_peak"].get("multiplier", 0)),
                "engagement_percentile_peak": _format_decimal(aggregate["engagement_peak"].get("percentile", 0)),
                "engagement_z_score_peak": _format_decimal(aggregate["engagement_peak"].get("z_score", 0)),
                "peak_perspective": peak_trend_row.get("perspective_person") or peak_trend_row.get("channel_title") or peak.get("perspective_person") or peak.get("channel_title"),
                "both_sides_spiked": "1" if len(aggregate["perspectives"]) >= 2 else "0",
                "close_match": "1" if aggregate["close_match"] else "0",
                "playoff_match": "1" if aggregate["playoff_match"] else "0",
                "highlight_score": _format_decimal(score),
                "highlight_reasons": "; ".join(reasons),
                "video_urls": _join_unique(row.get("video_url") for row in videos),
                "source_urls": _join_unique([*(row.get("source_urls") or row.get("video_url") for row in videos), match.get("source_urls")]),
                "stats_fetched_at": _join_unique(row.get("stats_fetched_at") for row in videos),
            }
        )

    return sorted(
        rows,
        key=lambda row: (
            -_float(row.get("highlight_score")),
            -_int(row.get("view_peak")),
            row.get("season_id") or "",
            row.get("match_id") or "",
        ),
    )


def _highlight_score(
    *,
    match_view_multiplier: float,
    match_views_percentile: float,
    match_views_z_score: float,
    raw_attention_percentile: float,
    perspective_multiplier: float,
    perspective_views_percentile: float,
    perspective_views_z_score: float,
    perspective_view_share: float,
    engagement_multiplier: float,
    engagement_percentile: float,
    engagement_z_score: float,
    close_match: bool,
    playoff_match: bool,
    both_sides_spiked: bool,
    videos: list[dict[str, str]],
) -> tuple[float, list[str]]:
    reasons: list[str] = []
    share_weight = min(1.0, max(0.0, perspective_view_share) / 0.5)
    perspective_signal = 1 + max(0.0, perspective_multiplier - 1) * share_weight * 0.6
    view_signal = max(match_view_multiplier, perspective_signal)
    raw_weight = 0.35 + min(1.0, max(0.0, raw_attention_percentile)) * 0.65
    view_score = min(42, max(0, view_signal - 1) / 1.5 * 42)
    view_score += min(24, match_views_percentile * 24)
    view_score += min(10, max(0, match_views_z_score) / 3 * 10)
    if perspective_multiplier >= 1.5 and share_weight >= 0.5:
        view_score += min(8, max(0, perspective_multiplier - 1) * share_weight / 1.5 * 8)
    score = view_score * raw_weight
    score += min(10, raw_attention_percentile * 10)
    engagement_score = 0.0
    if engagement_multiplier >= 1.25 or engagement_percentile >= 0.9:
        engagement_score += min(8, max(0, engagement_multiplier - 1) / 1.5 * 8)
        engagement_score += min(4, max(0, engagement_z_score) / 3 * 4)
        score += engagement_score
    community_score = 0.0
    if raw_attention_percentile >= 0.9 and engagement_multiplier >= 1.25:
        reach_component = min(8, max(0, raw_attention_percentile - 0.9) / 0.1 * 8)
        engagement_component = min(10, max(0, engagement_multiplier - 1.25) / 1.75 * 10)
        community_score = min(18, reach_component + engagement_component)
        score += community_score
    if close_match:
        score += 8
        reasons.append("knapper Kampf")
    if playoff_match:
        score += 8
        reasons.append("Playoff-Kontext")
    if both_sides_spiked:
        score += 8
        reasons.append("beide Perspektiven über Erwartung")
    if len(videos) >= 2:
        score += 4
        reasons.append("mehrere Perspektiven")
    elif len(videos) == 1:
        score *= SINGLE_SOURCE_SCORE_FACTOR
        reasons.append("nur eine Quelle (-15%)")

    if match_view_multiplier >= 2:
        reasons.insert(0, f"Match-Ausreißer {match_view_multiplier:.1f}x")
    elif match_view_multiplier >= 1.5:
        reasons.insert(0, f"über Match-Erwartung {match_view_multiplier:.1f}x")
    elif perspective_multiplier >= 2 and share_weight >= 0.5:
        reasons.insert(0, f"Perspektiv-Spike {perspective_multiplier:.1f}x")
    if engagement_score >= 4:
        reasons.append(f"Engagement-Ausreißer {engagement_multiplier:.1f}x")
    if community_score >= 10:
        reasons.append("Community-Magnet")
    if match_views_percentile >= 0.95:
        reasons.append("Top 5% matchbereinigt")
    elif match_views_percentile >= 0.9:
        reasons.append("Top 10% matchbereinigt")
    if match_views_z_score >= 2.5:
        reasons.append(f"Match-Z-Score {match_views_z_score:.1f}")
    if raw_attention_percentile >= 0.95:
        reasons.append("Top 5% Reichweite")
    elif raw_attention_percentile >= 0.9:
        reasons.append("Top 10% Reichweite")
    if perspective_views_percentile >= 0.95 and share_weight >= 0.5:
        reasons.append("starke Einzelperspektive")
    return min(100, score), list(dict.fromkeys(reasons))


def _match_trend_stats(aggregates: list[dict[str, Any]]) -> dict[str, Any]:
    values = [_float(aggregate.get("match_trend_multiplier")) for aggregate in aggregates]
    safe_values = [value for value in values if value > 0]
    if not safe_values:
        safe_values = [1]
    log_values = [math.log(value) for value in safe_values]
    median_log = _median(log_values)
    mad_log = _median([abs(value - median_log) for value in log_values])
    return {
        "sorted": sorted(safe_values),
        "sorted_view_totals": sorted(_int(aggregate.get("view_total")) for aggregate in aggregates if _int(aggregate.get("view_total")) > 0),
        "median_log": median_log,
        "mad_log": mad_log,
    }


def _robust_log_z_score(value: float, median_log: float, mad_log: float) -> float:
    if value <= 0 or mad_log == 0:
        return 0
    return (math.log(value) - median_log) / (1.4826 * mad_log)


def _engagement_stats(video_groups: Any) -> dict[int, dict[str, float]]:
    grouped: dict[tuple[str, str], list[tuple[dict[str, str], float]]] = {}
    for videos in video_groups:
        for row in videos:
            views = _int(row.get("view_count"))
            if views <= 0:
                continue
            season_id = row.get("season_id")
            person = _key(row.get("perspective_person") or row.get("channel_title"))
            if not season_id or not person:
                continue
            rate = _engagement_rate(row)
            if rate <= 0:
                continue
            grouped.setdefault((season_id, person), []).append((row, rate))

    stats: dict[int, dict[str, float]] = {}
    for group_rows in grouped.values():
        if len(group_rows) < 3:
            continue
        rates = [rate for _, rate in group_rows]
        median_rate = _median(rates)
        sorted_rates = sorted(rates)
        log_rates = [math.log(max(0.01, rate)) for rate in rates]
        median_log = _median(log_rates)
        mad_log = _median([abs(value - median_log) for value in log_rates])
        for row, rate in group_rows:
            stats[id(row)] = {
                "rate": rate,
                "multiplier": rate / median_rate if median_rate else 0,
                "percentile": _percentile_rank(sorted_rates, rate),
                "z_score": 0 if mad_log == 0 else (math.log(max(0.01, rate)) - median_log) / (1.4826 * mad_log),
            }
    return stats


def _engagement_rate(row: dict[str, str]) -> float:
    views = _int(row.get("view_count"))
    if views <= 0:
        return 0
    likes = _int(row.get("like_count"))
    comments = _int(row.get("comment_count"))
    return (likes + comments * 2) / views * 1000


def _is_close_match(match: dict[str, str], video: list[dict[str, str]]) -> bool:
    score = _score(match, video[0] if video else {})
    numbers = [int(value) for value in score.replace("-", " ").split() if value.isdigit()]
    return len(numbers) >= 2 and abs(numbers[0] - numbers[1]) <= 1


def _score(match: dict[str, str], fallback: dict[str, str]) -> str:
    if match.get("score_a") or match.get("score_b"):
        return f"{match.get('score_a') or '?'} - {match.get('score_b') or '?'}"
    return fallback.get("score") or ""


def _median(values: list[int]) -> float:
    sorted_values = sorted(values)
    if not sorted_values:
        return 0
    middle = len(sorted_values) // 2
    if len(sorted_values) % 2:
        return float(sorted_values[middle])
    return (sorted_values[middle - 1] + sorted_values[middle]) / 2


def _int(value: Any) -> int:
    try:
        return int(float(str(value or "").strip()))
    except ValueError:
        return 0


def _float(value: Any) -> float:
    try:
        parsed = float(str(value or "").strip())
    except ValueError:
        return 0
    return parsed if math.isfinite(parsed) else 0


def _format_number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:.1f}".rstrip("0").rstrip(".")


def _format_decimal(value: float) -> str:
    if not math.isfinite(value):
        return ""
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _percentile_rank(sorted_values: list[float], value: float) -> float:
    if not sorted_values:
        return 0
    below_or_equal = sum(1 for item in sorted_values if item <= value)
    return below_or_equal / len(sorted_values)


def _key(value: str | None) -> str:
    return " ".join(str(value or "").lower().split())


def _join_unique(values: Any) -> str:
    seen: list[str] = []
    for value in values:
        for part in str(value or "").split(";"):
            clean = part.strip()
            if clean and clean not in seen:
                seen.append(clean)
    return ";".join(seen)


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
