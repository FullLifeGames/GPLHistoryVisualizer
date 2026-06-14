from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

DEFAULT_DRIVE_FOLDER_ID = "1ERoSCU0FmsUASNc2PVBXuZvSZ3_LibNA"
DEFAULT_URLS_PATH = Path("gpl-video-urls.txt")
NORMALIZED_URLS_FALLBACK_PATH = Path("data/normalized/video_urls.txt")
DRIVE_UPLOAD_SCOPES = ["https://www.googleapis.com/auth/drive.file"]

_YOUTUBE_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_DRIVE_FOLDER_ID_RE = re.compile(r"^[A-Za-z0-9_-]{10,}$")
_IGNORED_DOWNLOAD_SUFFIXES = {
    ".description",
    ".json",
    ".jpg",
    ".jpeg",
    ".part",
    ".png",
    ".srt",
    ".vtt",
    ".webp",
    ".ytdl",
}
_MEDIA_SUFFIXES = {".avi", ".m4v", ".mkv", ".mov", ".mp4", ".webm"}


class ArchiveError(RuntimeError):
    pass


def load_dotenv(path: Path = Path(".env")) -> dict[str, str]:
    """Load simple KEY=VALUE pairs without overriding existing environment values."""
    if not path.exists():
        return {}

    loaded: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key.startswith("export "):
            key = key.removeprefix("export ").strip()
        if not key or key in os.environ:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ[key] = value
        loaded[key] = value
    return loaded


def extract_youtube_video_id(value: str) -> str | None:
    clean = value.strip().strip("<>()[]")
    if _YOUTUBE_VIDEO_ID_RE.fullmatch(clean):
        return clean

    parsed = urlparse(clean)
    host = parsed.netloc.lower().removeprefix("www.")
    path_parts = [part for part in parsed.path.split("/") if part]

    candidate: str | None = None
    if host in {"youtube.com", "m.youtube.com", "music.youtube.com"}:
        if path_parts[:1] == ["watch"]:
            candidate = (parse_qs(parsed.query).get("v") or [None])[0]
        elif path_parts and path_parts[0] in {"embed", "live", "shorts", "v"} and len(path_parts) >= 2:
            candidate = path_parts[1]
    elif host == "youtu.be" and path_parts:
        candidate = path_parts[0]

    if candidate and _YOUTUBE_VIDEO_ID_RE.fullmatch(candidate):
        return candidate
    return None


def read_video_jobs(path: Path) -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    seen: set[str] = set()
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        video_id = extract_youtube_video_id(line)
        if not video_id or video_id in seen:
            continue
        seen.add(video_id)
        jobs.append({"url": f"https://www.youtube.com/watch?v={video_id}", "video_id": video_id})
    return jobs


def resolve_urls_path(path: Path) -> Path:
    if path.exists():
        return path
    if path == DEFAULT_URLS_PATH and NORMALIZED_URLS_FALLBACK_PATH.exists():
        return NORMALIZED_URLS_FALLBACK_PATH
    return path


def parse_drive_folder_id(value: str) -> str | None:
    clean = value.strip()
    parsed = urlparse(clean)
    if parsed.scheme and parsed.netloc:
        match = re.search(r"/folders/([^/?#]+)", parsed.path)
        if match:
            return match.group(1)
        return None
    if _DRIVE_FOLDER_ID_RE.fullmatch(clean):
        return clean
    return None


def ensure_oauth_client_secrets_file(path: Path, oauth_json: str | None = None) -> Path:
    if path.exists():
        return path
    if not oauth_json:
        return path

    try:
        payload = json.loads(oauth_json)
    except json.JSONDecodeError as exc:
        raise ArchiveError(f"OAuth_Json is not valid JSON: {exc}") from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("installed"), dict):
        raise ArchiveError("OAuth_Json must be a Google OAuth Desktop client JSON with an 'installed' object.")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
    return path


def build_ytdlp_command(
    url: str,
    download_dir: Path,
    max_height: int | None = 1080,
    cookies_file: Path | None = None,
    extra_args: list[str] | None = None,
    python_executable: str = "python",
) -> list[str]:
    output_template = str(download_dir / "%(id)s - %(title).170B.%(ext)s")
    if max_height:
        format_selector = (
            f"bv*[height<={max_height}]+ba/"
            f"b[height<={max_height}]/"
            f"best[height<={max_height}]/best"
        )
    else:
        format_selector = "bv*+ba/best"

    command = [
        python_executable,
        "-m",
        "yt_dlp",
        "--no-playlist",
        "--continue",
        "--no-overwrites",
        "--restrict-filenames",
        "--merge-output-format",
        "mp4",
        "--format",
        format_selector,
        "--output",
        output_template,
    ]
    if cookies_file:
        command.extend(["--cookies", str(cookies_file)])
    command.extend(extra_args or [])
    command.append(url)
    return command


def find_downloaded_file(download_dir: Path, video_id: str) -> Path | None:
    candidates: list[Path] = []
    for path in download_dir.glob(f"{video_id}*"):
        if not path.is_file():
            continue
        suffixes = {suffix.lower() for suffix in path.suffixes}
        if suffixes.intersection(_IGNORED_DOWNLOAD_SUFFIXES):
            continue
        if path.suffix.lower() in _MEDIA_SUFFIXES:
            candidates.append(path)
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_size)


def download_video(
    job: dict[str, str],
    download_dir: Path,
    max_height: int | None,
    cookies_file: Path | None,
    extra_ytdlp_args: list[str],
) -> Path:
    download_dir.mkdir(parents=True, exist_ok=True)
    command = build_ytdlp_command(
        job["url"],
        download_dir=download_dir,
        max_height=max_height,
        cookies_file=cookies_file,
        extra_args=extra_ytdlp_args,
        python_executable=sys.executable,
    )
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise ArchiveError(f"yt-dlp failed for {job['video_id']}: {stderr[-2000:]}")
    downloaded = find_downloaded_file(download_dir, job["video_id"])
    if not downloaded:
        raise ArchiveError(f"yt-dlp finished but no media file was found for {job['video_id']}")
    return downloaded


def build_drive_service(client_secrets_path: Path, token_path: Path, drive_api_key: str | None = None) -> Any:
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise ArchiveError('Missing Drive dependencies. Install them with: python -m pip install -e ".[drive-archive]"') from exc

    if not client_secrets_path.exists():
        raise ArchiveError(
            "Google Drive upload needs OAuth client secrets, not only an API key. "
            f"Create an OAuth Desktop client JSON and save it at {client_secrets_path} "
            "or pass --drive-client-secrets."
        )

    credentials = None
    if token_path.exists():
        credentials = Credentials.from_authorized_user_file(str(token_path), DRIVE_UPLOAD_SCOPES)

    if not credentials or not credentials.valid:
        if credentials and credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets_path), DRIVE_UPLOAD_SCOPES)
            credentials = flow.run_local_server(port=0)
        token_path.parent.mkdir(parents=True, exist_ok=True)
        token_path.write_text(credentials.to_json(), encoding="utf-8")

    return build("drive", "v3", credentials=credentials, developerKey=drive_api_key, cache_discovery=False)


def upload_file_to_drive(service: Any, path: Path, folder_id: str) -> dict[str, str | None]:
    try:
        from googleapiclient.http import MediaFileUpload
    except ImportError as exc:
        raise ArchiveError('Missing Drive dependencies. Install them with: python -m pip install -e ".[drive-archive]"') from exc

    mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    media = MediaFileUpload(str(path), mimetype=mime_type, chunksize=16 * 1024 * 1024, resumable=True)
    request = service.files().create(
        body={"name": path.name, "parents": [folder_id]},
        media_body=media,
        fields="id,name,webViewLink",
        supportsAllDrives=True,
    )
    response = None
    while response is None:
        _, response = request.next_chunk()
    return {
        "id": response.get("id"),
        "name": response.get("name"),
        "webViewLink": response.get("webViewLink"),
    }


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"videos": {}}
    return json.loads(path.read_text(encoding="utf-8"))


def save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(manifest, ensure_ascii=True, indent=2, sort_keys=True), encoding="utf-8")


def process_jobs(args: argparse.Namespace) -> int:
    urls_path = resolve_urls_path(Path(args.urls))
    if not urls_path.exists():
        raise ArchiveError(f"URL file not found: {urls_path}")

    folder_id = parse_drive_folder_id(args.drive_folder_id)
    if not folder_id:
        raise ArchiveError(f"Could not parse Drive folder ID from {args.drive_folder_id!r}")

    jobs = read_video_jobs(urls_path)
    if args.limit is not None:
        jobs = jobs[: args.limit]

    print(f"Found {len(jobs)} unique YouTube video URLs.")
    print(f"Drive folder: {folder_id}")
    print(f"Download directory: {Path(args.download_dir)}")

    if args.dry_run:
        for job in jobs[:10]:
            print(f"- {job['video_id']} {job['url']}")
        if len(jobs) > 10:
            print(f"... {len(jobs) - 10} more")
        return 0

    drive_service = None
    if not args.no_upload:
        client_secrets_path = ensure_oauth_client_secrets_file(
            Path(args.drive_client_secrets),
            os.environ.get("OAuth_Json") or os.environ.get("OAUTH_JSON") or os.environ.get("GOOGLE_OAUTH_JSON"),
        )
        drive_service = build_drive_service(
            client_secrets_path,
            Path(args.token_path),
            drive_api_key=os.environ.get("DRIVE_API_KEY"),
        )

    manifest_path = Path(args.manifest)
    manifest = load_manifest(manifest_path)
    manifest.setdefault("drive_folder_id", folder_id)
    manifest.setdefault("videos", {})

    errors = 0
    for index, job in enumerate(jobs, start=1):
        video_id = job["video_id"]
        entry = manifest["videos"].setdefault(video_id, {"url": job["url"], "video_id": video_id})
        already_uploaded = entry.get("status") == "uploaded" and entry.get("drive_file_id")
        if already_uploaded and not args.force_upload:
            print(f"[{index}/{len(jobs)}] {video_id} already uploaded; skipping.")
            continue

        try:
            local_path_text = entry.get("local_path")
            local_path = Path(local_path_text) if local_path_text else None
            if args.force_download or local_path is None or not local_path.exists():
                print(f"[{index}/{len(jobs)}] downloading {video_id}")
                local_path = download_video(
                    job,
                    download_dir=Path(args.download_dir),
                    max_height=args.max_height,
                    cookies_file=Path(args.cookies) if args.cookies else None,
                    extra_ytdlp_args=args.extra_ytdlp_arg,
                )
                entry.update({"local_path": str(local_path), "status": "downloaded", "error": None})
                save_manifest(manifest_path, manifest)

            if args.no_upload:
                print(f"[{index}/{len(jobs)}] downloaded {video_id}: {local_path.name}")
                continue

            print(f"[{index}/{len(jobs)}] uploading {video_id}: {local_path.name}")
            uploaded = upload_file_to_drive(drive_service, local_path, folder_id)
            entry.update(
                {
                    "status": "uploaded",
                    "drive_file_id": uploaded.get("id"),
                    "drive_file_name": uploaded.get("name"),
                    "drive_web_view_link": uploaded.get("webViewLink"),
                    "error": None,
                }
            )
            save_manifest(manifest_path, manifest)

            if not args.keep_local and local_path.exists():
                local_path.unlink()
                entry["local_path"] = None
                save_manifest(manifest_path, manifest)
        except Exception as exc:
            errors += 1
            entry.update({"status": "error", "error": str(exc)})
            save_manifest(manifest_path, manifest)
            print(f"[{index}/{len(jobs)}] error for {video_id}: {exc}", file=sys.stderr)
            if args.stop_on_error:
                return 1

    return 1 if errors else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Download GPL YouTube videos from gpl-video-urls.txt and upload them to Google Drive."
    )
    parser.add_argument("--urls", default="gpl-video-urls.txt", help="Path to the GPL video URL list.")
    parser.add_argument(
        "--drive-folder-id",
        default=os.environ.get("DRIVE_FOLDER_ID", DEFAULT_DRIVE_FOLDER_ID),
        help="Google Drive destination folder ID or folder URL.",
    )
    parser.add_argument("--download-dir", default="output/gpl-video-downloads", help="Temporary download directory.")
    parser.add_argument("--manifest", default="output/gpl-video-drive-manifest.json", help="Resume/status manifest path.")
    parser.add_argument(
        "--drive-client-secrets",
        default=os.environ.get("GOOGLE_OAUTH_CLIENT_SECRETS", "output/google-drive-oauth-client.json"),
        help="OAuth Desktop client JSON for Drive uploads.",
    )
    parser.add_argument(
        "--token-path",
        default=os.environ.get("GOOGLE_DRIVE_TOKEN", "output/google-drive-token.json"),
        help="Local OAuth token cache path.",
    )
    parser.add_argument("--max-height", type=int, default=1080, help="Maximum downloaded video height; use 0 for best.")
    parser.add_argument("--cookies", default=None, help="Optional Netscape cookies.txt file for yt-dlp.")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N unique URLs.")
    parser.add_argument("--dry-run", action="store_true", help="Parse inputs and print what would happen.")
    parser.add_argument("--no-upload", action="store_true", help="Download videos but do not upload to Drive.")
    parser.add_argument("--force-download", action="store_true", help="Redownload even if a local path is in the manifest.")
    parser.add_argument("--force-upload", action="store_true", help="Upload even if the manifest says the video is uploaded.")
    parser.add_argument("--keep-local", action="store_true", help="Keep local video files after successful upload.")
    parser.add_argument("--stop-on-error", action="store_true", help="Stop after the first download or upload failure.")
    parser.add_argument(
        "--extra-ytdlp-arg",
        action="append",
        default=[],
        help="Extra argument passed through to yt-dlp. Repeat for multiple args.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    load_dotenv()
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.max_height == 0:
        args.max_height = None
    try:
        return process_jobs(args)
    except ArchiveError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
