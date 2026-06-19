from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .storage import ensure_dir
from .youtube import YouTubeApiError, YouTubeClient

VIDEO_STATS_FIELDS = [
    "view_count",
    "like_count",
    "comment_count",
    "duration",
    "duration_seconds",
    "stats_fetched_at",
    "views_baseline_median",
    "views_multiplier",
    "views_percentile",
    "views_z_score",
    "video_highlight_reasons",
    "views_week_factor",
    "views_opponent_factor",
    "views_expected",
    "views_trend_multiplier",
    "views_trend_percentile",
    "views_trend_z_score",
    "views_trend_highlight_reasons",
]

OPENING_WEEK = 1
OPENING_WEEK_FACTOR_QUANTILE = 0.85


@dataclass(frozen=True)
class VideoStatsFetchResult:
    rows: list[dict[str, Any]]
    requested: int
    fetched: int
    unprocessed: int
    error: str | None = None


def fetch_and_write_video_stats(data_dir: Path, client: YouTubeClient, force: bool = False) -> VideoStatsFetchResult:
    video_ids = _video_ids_from_archive(data_dir)
    existing = {row.get("video_id"): row for row in load_video_stats(data_dir) if row.get("video_id")}
    missing = video_ids if force else [video_id for video_id in video_ids if video_id not in existing]
    fetched_at = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    fetched = 0
    processed = 0
    error: str | None = None

    for start in range(0, len(missing), 50):
        chunk = missing[start : start + 50]
        try:
            details = client.video_details(chunk)
        except YouTubeApiError as exc:
            error = str(exc)
            break
        processed += len(chunk)
        for video_id, detail in details.items():
            existing[video_id] = _stats_row(detail, fetched_at)
            fetched += 1
        _write_video_stats_cache(data_dir, existing)

    rows = _write_video_stats_cache(data_dir, existing)
    return VideoStatsFetchResult(
        rows=rows,
        requested=len(missing),
        fetched=fetched,
        unprocessed=max(0, len(missing) - processed),
        error=error,
    )


def load_video_stats(data_dir: Path) -> list[dict[str, Any]]:
    path = data_dir / "raw" / "video_stats" / "video_stats.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def enrich_video_rows_with_stats(rows: list[dict[str, Any]], stats_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    stats_by_id = {row.get("video_id"): row for row in stats_rows if row.get("video_id")}
    enriched = []
    for row in rows:
        stats = stats_by_id.get(row.get("video_id"), {})
        enriched.append({**row, **{field: stats.get(field, "") for field in VIDEO_STATS_FIELDS[:6]}})
    _add_video_anomaly_fields(enriched)
    return enriched


def _stats_row(detail: dict[str, Any], fetched_at: str) -> dict[str, Any]:
    stats = detail.get("statistics", {})
    content = detail.get("contentDetails", {})
    duration = content.get("duration", "")
    return {
        "video_id": detail.get("video_id"),
        "view_count": _number(stats.get("viewCount")),
        "like_count": _number(stats.get("likeCount")),
        "comment_count": _number(stats.get("commentCount")),
        "duration": duration,
        "duration_seconds": _duration_seconds(duration),
        "stats_fetched_at": fetched_at,
    }


def _add_video_anomaly_fields(rows: list[dict[str, Any]]) -> None:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        if row.get("video_type") != "game" or row.get("match_status") != "matched":
            continue
        views = _int(row.get("view_count"))
        season_id = row.get("detected_season_id") or row.get("season_id")
        person = row.get("perspective_person") or row.get("channel_title")
        if views <= 0 or not season_id or not person:
            continue
        groups.setdefault((season_id, _key(person)), []).append(row)

    modeled_rows: list[dict[str, Any]] = []
    base_by_row: dict[int, float] = {}
    week_by_row: dict[int, int] = {}
    norm_by_row: dict[int, float] = {}

    for group_rows in groups.values():
        if len(group_rows) < 3:
            continue
        views = [_int(row.get("view_count")) for row in group_rows]
        log_views = [math.log(max(1, value)) for value in views]
        median_views = _median(views)
        median_log = _median(log_views)
        mad_log = _median([abs(value - median_log) for value in log_views])
        sorted_views = sorted(views)

        for row in group_rows:
            view_count = _int(row.get("view_count"))
            multiplier = view_count / median_views if median_views else 0
            percentile = _percentile_rank(sorted_views, view_count)
            z_score = 0 if mad_log == 0 else (math.log(max(1, view_count)) - median_log) / (1.4826 * mad_log)
            row["views_baseline_median"] = _format_number(median_views)
            row["views_multiplier"] = _format_decimal(multiplier)
            row["views_percentile"] = _format_decimal(percentile)
            row["views_z_score"] = _format_decimal(z_score)
            row["video_highlight_reasons"] = _video_reasons(multiplier, percentile, z_score)
            week = _week_number(row.get("detected_week") or row.get("week"))
            if week is not None:
                row_id = id(row)
                modeled_rows.append(row)
                base_by_row[row_id] = median_views
                week_by_row[row_id] = week
                norm_by_row[row_id] = multiplier

    _add_trend_adjusted_video_anomaly_fields(modeled_rows, base_by_row, week_by_row, norm_by_row)

    for row in rows:
        for field in VIDEO_STATS_FIELDS[6:]:
            row.setdefault(field, "")


def _add_trend_adjusted_video_anomaly_fields(
    rows: list[dict[str, Any]],
    base_by_row: dict[int, float],
    week_by_row: dict[int, int],
    norm_by_row: dict[int, float],
) -> None:
    if not rows:
        return

    global_week_factor = _week_factor_by_group(rows, lambda row: week_by_row[id(row)], norm_by_row, min_count=10)
    season_week_factor = _week_factor_by_group(rows, lambda row: (row.get("detected_season_id") or row.get("season_id"), week_by_row[id(row)]), norm_by_row, min_count=8)
    season_division_week_factor = _week_factor_by_group(
        rows,
        lambda row: (
            row.get("detected_season_id") or row.get("season_id"),
            row.get("division") or "",
            week_by_row[id(row)],
        ),
        norm_by_row,
        min_count=4,
    )

    residual_by_row: dict[int, float] = {}
    week_factor_by_row: dict[int, float] = {}
    for row in rows:
        row_id = id(row)
        season_id = row.get("detected_season_id") or row.get("season_id")
        division = row.get("division") or ""
        week = week_by_row[row_id]
        factor = (
            season_division_week_factor.get((season_id, division, week))
            or season_week_factor.get((season_id, week))
            or global_week_factor.get(week)
            or 1
        )
        if week == OPENING_WEEK and global_week_factor.get(OPENING_WEEK):
            factor = max(factor, global_week_factor[OPENING_WEEK])
        week_factor_by_row[row_id] = factor
        expected = base_by_row[row_id] * factor
        residual = _int(row.get("view_count")) / expected if expected else 0
        residual_by_row[row_id] = residual
        row["views_week_factor"] = _format_decimal(factor)

    opponent_factor_by_key = _opponent_factor_by_group(rows, residual_by_row, min_count=5)
    adjusted_residual_by_row: dict[int, float] = {}
    for row in rows:
        row_id = id(row)
        season_id = row.get("detected_season_id") or row.get("season_id")
        opponent_factor = opponent_factor_by_key.get((season_id, _key(row.get("opponent"))), 1)
        expected = base_by_row[row_id] * week_factor_by_row[row_id] * opponent_factor
        residual = _int(row.get("view_count")) / expected if expected else 0
        adjusted_residual_by_row[row_id] = residual
        row["views_opponent_factor"] = _format_decimal(opponent_factor)
        row["views_expected"] = _format_number(expected)
        row["views_trend_multiplier"] = _format_decimal(residual)

    global_stats = _residual_stats([adjusted_residual_by_row[id(row)] for row in rows])
    season_stats = _residual_stats_by_group(rows, lambda row: row.get("detected_season_id") or row.get("season_id"), adjusted_residual_by_row, min_count=30)
    season_division_stats = _residual_stats_by_group(
        rows,
        lambda row: (row.get("detected_season_id") or row.get("season_id"), row.get("division") or ""),
        adjusted_residual_by_row,
        min_count=30,
    )

    for row in rows:
        row_id = id(row)
        season_id = row.get("detected_season_id") or row.get("season_id")
        division = row.get("division") or ""
        stats = season_division_stats.get((season_id, division)) or season_stats.get(season_id) or global_stats
        residual = adjusted_residual_by_row[row_id]
        percentile = _percentile_rank(stats["sorted"], residual)
        z_score = _robust_log_z_score(residual, stats["median_log"], stats["mad_log"])
        row["views_trend_percentile"] = _format_decimal(percentile)
        row["views_trend_z_score"] = _format_decimal(z_score)
        row["views_trend_highlight_reasons"] = _trend_video_reasons(residual, percentile, z_score)


def _opponent_factor_by_group(
    rows: list[dict[str, Any]],
    residual_by_row: dict[int, float],
    *,
    min_count: int,
) -> dict[tuple[str | None, str], float]:
    grouped: dict[tuple[str | None, str], list[float]] = {}
    for row in rows:
        opponent_key = _key(row.get("opponent"))
        if not opponent_key:
            continue
        season_id = row.get("detected_season_id") or row.get("season_id")
        grouped.setdefault((season_id, opponent_key), []).append(residual_by_row[id(row)])

    factors: dict[tuple[str | None, str], float] = {}
    for key, values in grouped.items():
        if len(values) < min_count:
            continue
        median_residual = _median([value for value in values if value > 0])
        # Only model positive opponent pull. A low-draw opponent should not make
        # otherwise normal videos look artificially surprising.
        factors[key] = min(2.0, max(1.0, median_residual))
    return factors


def _video_reasons(multiplier: float, percentile: float, z_score: float) -> str:
    reasons = []
    if multiplier >= 2:
        reasons.append(f"View-Ausrei\u00dfer {multiplier:.1f}x")
    elif multiplier >= 1.5:
        reasons.append(f"\u00fcber Baseline {multiplier:.1f}x")
    if percentile >= 0.95:
        reasons.append("Top 5% der Person/Saison")
    elif percentile >= 0.9:
        reasons.append("Top 10% der Person/Saison")
    if z_score >= 2.5:
        reasons.append(f"robuster Z-Score {z_score:.1f}")
    return "; ".join(reasons)


def _trend_video_reasons(multiplier: float, percentile: float, z_score: float) -> str:
    reasons = []
    if multiplier >= 2:
        reasons.append(f"Trend-Ausrei\u00dfer {multiplier:.1f}x")
    elif multiplier >= 1.5:
        reasons.append(f"\u00fcber Erwartung {multiplier:.1f}x")
    if percentile >= 0.95:
        reasons.append("Top 5% trendbereinigt")
    elif percentile >= 0.9:
        reasons.append("Top 10% trendbereinigt")
    if z_score >= 2.5:
        reasons.append(f"Trend-Z-Score {z_score:.1f}")
    return "; ".join(reasons)


def _video_ids_from_archive(data_dir: Path) -> list[str]:
    rows = _read_csv(data_dir / "normalized" / "video_archive.csv")
    return sorted({row.get("video_id", "").strip() for row in rows if row.get("video_id")})


def _write_video_stats_cache(data_dir: Path, existing: dict[str | None, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [existing[video_id] for video_id in sorted(existing) if video_id]
    out_path = data_dir / "raw" / "video_stats" / "video_stats.json"
    ensure_dir(out_path.parent)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return rows


def _week_factor_by_group(
    rows: list[dict[str, Any]],
    key_fn: Any,
    value_by_row: dict[int, float],
    *,
    min_count: int,
) -> dict[Any, float]:
    grouped: dict[Any, list[float]] = {}
    for row in rows:
        grouped.setdefault(key_fn(row), []).append(value_by_row[id(row)])
    return {
        key: _opening_week_factor(values) if _group_week(key) == OPENING_WEEK else _median(values)
        for key, values in grouped.items()
        if len(values) >= min_count
    }


def _opening_week_factor(values: list[float]) -> float:
    # GPL opening videos are expected to overperform. Using an upper quantile
    # prevents normal Spieltag-1 attention from becoming a highlight.
    return max(_median(values), _quantile(values, OPENING_WEEK_FACTOR_QUANTILE))


def _group_week(key: Any) -> int | None:
    value = key[-1] if isinstance(key, tuple) and key else key
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _quantile(values: list[float], quantile: float) -> float:
    sorted_values = sorted(values)
    if not sorted_values:
        return 0
    index = min(len(sorted_values) - 1, math.ceil(quantile * len(sorted_values)) - 1)
    return float(sorted_values[index])


def _residual_stats_by_group(
    rows: list[dict[str, Any]],
    key_fn: Any,
    residual_by_row: dict[int, float],
    *,
    min_count: int,
) -> dict[Any, dict[str, Any]]:
    grouped: dict[Any, list[float]] = {}
    for row in rows:
        grouped.setdefault(key_fn(row), []).append(residual_by_row[id(row)])
    return {key: _residual_stats(values) for key, values in grouped.items() if len(values) >= min_count}


def _residual_stats(values: list[float]) -> dict[str, Any]:
    safe_values = [value for value in values if value > 0]
    if not safe_values:
        safe_values = [1]
    log_values = [math.log(value) for value in safe_values]
    median_log = _median(log_values)
    mad_log = _median([abs(value - median_log) for value in log_values])
    return {
        "sorted": sorted(safe_values),
        "median_log": median_log,
        "mad_log": mad_log,
    }


def _robust_log_z_score(value: float, median_log: float, mad_log: float) -> float:
    if value <= 0 or mad_log == 0:
        return 0
    return (math.log(value) - median_log) / (1.4826 * mad_log)


def _duration_seconds(value: str | None) -> str:
    text = str(value or "")
    if not text:
        return ""
    match = re.fullmatch(r"P(?:(?P<days>\d+)D)?T?(?:(?P<hours>\d+)H)?(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?", text)
    if not match:
        return ""
    total = (
        int(match.group("days") or 0) * 86400
        + int(match.group("hours") or 0) * 3600
        + int(match.group("minutes") or 0) * 60
        + int(match.group("seconds") or 0)
    )
    return str(total)


def _week_number(value: str | None) -> int | None:
    match = re.search(r"(\d+)\.\s*Spieltag", str(value or ""), re.IGNORECASE)
    if match:
        return int(match.group(1))
    text = str(value or "").strip()
    return int(text) if text.isdigit() else None


def _median(values: list[float | int]) -> float:
    sorted_values = sorted(values)
    if not sorted_values:
        return 0
    middle = len(sorted_values) // 2
    if len(sorted_values) % 2:
        return float(sorted_values[middle])
    return (float(sorted_values[middle - 1]) + float(sorted_values[middle])) / 2


def _percentile_rank(sorted_values: list[int], value: int) -> float:
    if not sorted_values:
        return 0
    less_or_equal = sum(1 for item in sorted_values if item <= value)
    return less_or_equal / len(sorted_values)


def _number(value: Any) -> str:
    try:
        return str(int(value))
    except (TypeError, ValueError):
        return ""


def _int(value: Any) -> int:
    try:
        return int(float(str(value or "").strip()))
    except ValueError:
        return 0


def _format_number(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:.1f}".rstrip("0").rstrip(".")


def _format_decimal(value: float) -> str:
    if not math.isfinite(value):
        return ""
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))
