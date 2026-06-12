from __future__ import annotations

import argparse
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Callable

from .data_quality import check_generated_artifacts, generate_data_quality
from .normalize import normalize_all
from .playlists import group_gpl_playlists
from .pokemon_names import fetch_and_write_pokemon_names
from .report import generate_report
from .review import generate_review_queue
from .sheets import fetch_public_sheet_tables, resolve_redirect
from .sheets_api import SheetsApiClient, SheetsApiError
from .storage import ensure_dir, read_json, safe_slug, write_json
from .urls import extract_urls, resolve_google_sheets_id
from .validate import format_issues, validate_normalized_data
from .video_archive import build_video_archive, scan_video_archive
from .youtube import YouTubeApiError, YouTubeClient


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Reconstruct GPL history from normalized CSV and source-table data.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    collect = subparsers.add_parser("collect", help="Fetch playlists, videos, URLs, sheets, CSVs, and report.")
    collect.add_argument("--channel-query", default="PresentLP", help="YouTube channel query or handle.")
    collect.add_argument("--channel-id", default=None, help="Explicit YouTube channel ID.")
    collect.add_argument("--data-dir", default="data", help="Data output directory.")
    collect.add_argument("--skip-resolve", action="store_true", help="Skip HTTP redirect resolution.")
    collect.add_argument("--skip-sheets", action="store_true", help="Skip public Google Sheets CSV fetching.")
    collect.add_argument("--limit-playlists", type=int, default=None, help="Optional development limit.")
    collect.add_argument("--resume", action="store_true", help="Reuse existing raw season files when present.")
    collect.add_argument("--resolve-workers", type=int, default=12, help="Concurrent redirect resolver workers.")
    collect.add_argument("--resolve-timeout", type=int, default=5, help="Per-URL redirect resolver timeout in seconds.")

    normalize = subparsers.add_parser("normalize", help="Normalize existing raw data into CSVs.")
    normalize.add_argument("--data-dir", default="data")

    data_quality = subparsers.add_parser("data-quality", help="Generate normalized data quality and source claim CSVs.")
    data_quality.add_argument("--data-dir", default="data")

    report = subparsers.add_parser("report", help="Generate docs/gpl-history.md from normalized CSVs.")
    report.add_argument("--data-dir", default="data")
    report.add_argument("--out", default="docs/gpl-history.md")

    scan_videos = subparsers.add_parser("scan-videos", help="Scan participant YouTube channels and build GPL video archive CSVs.")
    scan_videos.add_argument("--data-dir", default="data")
    scan_videos.add_argument("--max-channels", type=int, default=None, help="Optional development limit.")
    scan_videos.add_argument("--max-pages-per-channel", type=int, default=None, help="Optional uploads playlist page limit.")
    scan_videos.add_argument(
        "--include-description-channels",
        action="store_true",
        help="Also scan channel URLs found in video descriptions, not just normalized participant team rows.",
    )

    build_videos = subparsers.add_parser("build-video-archive", help="Rebuild GPL video archive CSVs from raw scanned channel uploads.")
    build_videos.add_argument("--data-dir", default="data")

    validate = subparsers.add_parser("validate", help="Validate normalized CSV schema, keys, and source coverage.")
    validate.add_argument("--data-dir", default="data")
    validate.add_argument("--strict", action="store_true", help="Exit non-zero on warnings as well as errors.")

    review_queue = subparsers.add_parser("review-queue", help="Generate CSV review queues for missing and ambiguous data.")
    review_queue.add_argument("--data-dir", default="data")

    check_generated = subparsers.add_parser("check-generated", help="Regenerate derived CSVs and fail if tracked generated artifacts drift.")
    check_generated.add_argument("--data-dir", default="data")

    pokemon_names = subparsers.add_parser("pokemon-names", help="Fetch German/English Pokémon names and build frontend sprite mapping.")
    pokemon_names.add_argument("--data-dir", default="data")
    pokemon_names.add_argument("--web-dir", default="web")

    args = parser.parse_args(argv)

    if args.command == "collect":
        return collect_command(args)
    if args.command == "normalize":
        normalize_all(Path(args.data_dir))
        generate_data_quality(Path(args.data_dir))
        generate_review_queue(Path(args.data_dir))
        return 0
    if args.command == "data-quality":
        counts = generate_data_quality(Path(args.data_dir))
        for name, count in counts.items():
            print(f"{name}: {count}")
        return 0
    if args.command == "report":
        generate_report(Path(args.data_dir), Path(args.out))
        return 0
    if args.command == "scan-videos":
        api_key = os.environ.get("YOUTUBE_API_KEY")
        if not api_key:
            raise SystemExit("YOUTUBE_API_KEY is required for video scanning.")
        scan_video_archive(
            Path(args.data_dir),
            YouTubeClient(api_key=api_key),
            max_channels=args.max_channels,
            max_pages_per_channel=args.max_pages_per_channel,
            include_description_channels=args.include_description_channels,
        )
        return 0
    if args.command == "build-video-archive":
        build_video_archive(Path(args.data_dir))
        generate_data_quality(Path(args.data_dir))
        generate_review_queue(Path(args.data_dir))
        return 0
    if args.command == "validate":
        issues = validate_normalized_data(Path(args.data_dir))
        if issues:
            print(format_issues(issues))
        errors = [issue for issue in issues if issue.level == "error"]
        warnings = [issue for issue in issues if issue.level == "warning"]
        return 1 if errors or (args.strict and warnings) else 0
    if args.command == "review-queue":
        counts = generate_review_queue(Path(args.data_dir))
        for name, count in counts.items():
            print(f"{name}: {count}")
        return 0
    if args.command == "check-generated":
        changed = check_generated_artifacts(Path(args.data_dir))
        if changed:
            print("Generated artifacts are out of date:")
            for path in changed:
                print(f"- {path}")
            return 1
        print("Generated artifacts are up to date.")
        return 0
    if args.command == "pokemon-names":
        rows = fetch_and_write_pokemon_names(Path(args.data_dir), Path(args.web_dir))
        print(f"pokemon_name_translations: {len(rows)}")
        return 0
    parser.error(f"Unknown command {args.command}")
    return 2


def collect_command(args: argparse.Namespace) -> int:
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        raise SystemExit("YOUTUBE_API_KEY is required for collection.")
    sheets_api_key = os.environ.get("SHEETS_API_KEY")

    data_dir = Path(args.data_dir)
    raw_dir = ensure_dir(data_dir / "raw")
    client = YouTubeClient(api_key=api_key)

    try:
        channel = client.resolve_channel(query=args.channel_query, channel_id=args.channel_id)
        all_playlists = client.list_playlists(channel["channelId"])
    except YouTubeApiError as exc:
        raise SystemExit(str(exc)) from exc

    playlists = group_gpl_playlists(all_playlists)
    if args.limit_playlists:
        playlists = playlists[: args.limit_playlists]

    write_json(raw_dir / "channel.json", channel)
    write_json(raw_dir / "all_playlists.json", all_playlists)
    write_json(raw_dir / "gpl_playlists.json", playlists)

    for season in playlists:
        season_id = season["season_id"]
        season_dir = ensure_dir(raw_dir / season_id)
        write_json(season_dir / "season.json", season)
        write_json(season_dir / "playlists.json", season["playlists"])

        videos_path = season_dir / "videos.json"
        if args.resume and videos_path.exists():
            videos = read_json(videos_path, [])
        else:
            videos = []
            for playlist in season["playlists"]:
                playlist_id = playlist.get("playlistId")
                if not playlist_id:
                    continue
                playlist_slug = safe_slug(f"{playlist_id}_{playlist.get('title') or 'playlist'}")
                write_json(season_dir / f"playlist_{playlist_slug}.json", playlist)
                playlist_videos_path = season_dir / f"videos_{playlist_slug}.json"
                if args.resume and playlist_videos_path.exists():
                    playlist_videos = read_json(playlist_videos_path, [])
                else:
                    playlist_videos = client.list_playlist_videos(playlist_id)
                    for video in playlist_videos:
                        video["playlistId"] = playlist_id
                        video["playlistTitle"] = playlist.get("title")
                    write_json(playlist_videos_path, playlist_videos)
                videos.extend(playlist_videos)
            write_json(videos_path, videos)

        description_urls_path = season_dir / "description_urls.json"
        if args.resume and description_urls_path.exists():
            description_urls = read_json(description_urls_path, [])
        else:
            description_urls = _description_urls(videos)
            write_json(description_urls_path, description_urls)

        resolved_urls_path = season_dir / "resolved_urls.json"
        if args.skip_resolve:
            resolved_urls = [
                {"url": entry["url"], "resolved_url": entry["url"], "status_code": None, "ok": None, "error": None}
                for entry in description_urls
            ]
        elif args.resume and resolved_urls_path.exists():
            resolved_urls = read_json(resolved_urls_path, [])
        else:
            resolved_urls = _resolve_description_urls(
                description_urls,
                workers=args.resolve_workers,
                timeout=args.resolve_timeout,
            )
        write_json(resolved_urls_path, resolved_urls)

        sheets_index_path = season_dir / "sheets_index.json"
        if not args.skip_sheets:
            if args.resume and sheets_index_path.exists():
                sheets_index = read_json(sheets_index_path, [])
            else:
                sheets_index = []
                sheets_dir = ensure_dir(season_dir / "sheets")
                for sheet_url in _sheet_urls(resolved_urls):
                    tables = _fetch_sheet_tables(sheet_url, sheets_dir, sheets_api_key)
                    sheets_index.extend(tables)
        else:
            sheets_index = []
        write_json(sheets_index_path, sheets_index)

    normalize_all(data_dir)
    generate_data_quality(data_dir)
    generate_review_queue(data_dir)
    generate_report(data_dir, Path("docs/gpl-history.md"))
    return 0


def _fetch_sheet_tables(sheet_url: str, sheets_dir: Path, sheets_api_key: str | None) -> list[dict[str, Any]]:
    sheet_id = resolve_google_sheets_id(sheet_url)
    if sheets_api_key and sheet_id:
        try:
            return SheetsApiClient(api_key=sheets_api_key).fetch_visible_tabs(sheet_id, sheets_dir, sheet_url)
        except SheetsApiError as exc:
            fallback_rows = fetch_public_sheet_tables(sheet_url, sheets_dir)
            if fallback_rows:
                for row in fallback_rows:
                    row["api_error"] = str(exc)
                return fallback_rows
            return [
                {
                    "sheet_id": sheet_id,
                    "source_url": sheet_url,
                    "status": "unavailable",
                    "status_code": None,
                    "error": str(exc),
                    "rows": 0,
                    "columns": 0,
                    "fetch_method": "sheets_api",
                }
            ]
    return fetch_public_sheet_tables(sheet_url, sheets_dir)


def _description_urls(videos: list[dict]) -> list[dict]:
    rows: list[dict] = []
    seen: set[tuple[str | None, str]] = set()
    for video in videos:
        for url in extract_urls(video.get("description")):
            marker = (video.get("videoId"), url)
            if marker in seen:
                continue
            seen.add(marker)
            rows.append(
                {
                    "video_id": video.get("videoId"),
                    "video_title": video.get("title"),
                    "position": video.get("position"),
                    "url": url,
                }
            )
    return rows


def _resolve_description_urls(
    description_urls: list[dict[str, Any]],
    resolver: Callable[[str, int], dict[str, Any]] = resolve_redirect,
    workers: int = 12,
    timeout: int = 5,
) -> list[dict[str, Any]]:
    unique_urls = list(dict.fromkeys(entry["url"] for entry in description_urls if entry.get("url")))
    resolved_by_url: dict[str, dict[str, Any]] = {}

    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = {executor.submit(resolver, url, timeout): url for url in unique_urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                resolved_by_url[url] = future.result()
            except Exception as exc:
                resolved_by_url[url] = {
                    "url": url,
                    "resolved_url": None,
                    "status_code": None,
                    "ok": False,
                    "error": str(exc),
                    "redirect_chain": [],
                }

    resolved: list[dict[str, Any]] = []
    for entry in description_urls:
        result = dict(resolved_by_url.get(entry["url"], {"url": entry.get("url")}))
        result.update(
            {
                "video_id": entry.get("video_id"),
                "video_title": entry.get("video_title"),
                "position": entry.get("position"),
            }
        )
        resolved.append(result)
    return resolved


def _sheet_urls(resolved_urls: list[dict]) -> list[str]:
    urls: list[str] = []
    for entry in resolved_urls:
        for candidate in (entry.get("resolved_url"), entry.get("url")):
            if not candidate:
                continue
            if resolve_google_sheets_id(candidate) and candidate not in urls:
                urls.append(candidate)
    return urls


if __name__ == "__main__":
    raise SystemExit(main())
