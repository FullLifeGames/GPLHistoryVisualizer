from argparse import Namespace
from pathlib import Path

import gpl_history.drive_archive as drive_archive
from gpl_history.drive_archive import (
    DEFAULT_DRIVE_FOLDER_ID,
    build_ytdlp_command,
    extract_youtube_video_id,
    find_downloaded_file,
    ensure_oauth_client_secrets_file,
    load_dotenv,
    parse_drive_folder_id,
    process_jobs,
    read_video_jobs,
    resolve_urls_path,
)


def test_extract_youtube_video_id_accepts_common_youtube_url_shapes():
    assert extract_youtube_video_id("https://www.youtube.com/watch?v=1XaPObu2Qhg&t=12s") == "1XaPObu2Qhg"
    assert extract_youtube_video_id("https://youtu.be/36NOn-qcwws") == "36NOn-qcwws"
    assert extract_youtube_video_id("https://www.youtube.com/shorts/eQclMGoJf-Q") == "eQclMGoJf-Q"
    assert extract_youtube_video_id("https://www.youtube.com/embed/Dri89Vr84Ng") == "Dri89Vr84Ng"


def test_read_video_jobs_deduplicates_by_video_id_and_skips_non_video_lines(tmp_path):
    urls_path = tmp_path / "urls.txt"
    urls_path.write_text(
        "\n".join(
            [
                "# GPL archive",
                "https://www.youtube.com/watch?v=1XaPObu2Qhg",
                "https://youtu.be/1XaPObu2Qhg",
                "not a url",
                "https://www.youtube.com/watch?v=36NOn-qcwws",
            ]
        ),
        encoding="utf-8",
    )

    assert read_video_jobs(urls_path) == [
        {"url": "https://www.youtube.com/watch?v=1XaPObu2Qhg", "video_id": "1XaPObu2Qhg"},
        {"url": "https://www.youtube.com/watch?v=36NOn-qcwws", "video_id": "36NOn-qcwws"},
    ]


def test_resolve_urls_path_uses_normalized_fallback_for_default_missing_file(tmp_path, monkeypatch):
    fallback = tmp_path / "data" / "normalized" / "video_urls.txt"
    fallback.parent.mkdir(parents=True)
    fallback.write_text("https://www.youtube.com/watch?v=1XaPObu2Qhg\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)

    assert resolve_urls_path(Path("gpl-video-urls.txt")).resolve() == fallback


def test_parse_drive_folder_id_accepts_folder_url_and_plain_id():
    folder_url = "https://drive.google.com/drive/u/0/folders/1ERoSCU0FmsUASNc2PVBXuZvSZ3_LibNA"

    assert parse_drive_folder_id(folder_url) == DEFAULT_DRIVE_FOLDER_ID
    assert parse_drive_folder_id(DEFAULT_DRIVE_FOLDER_ID) == DEFAULT_DRIVE_FOLDER_ID


def test_build_ytdlp_command_uses_resumable_single_video_download(tmp_path):
    command = build_ytdlp_command(
        "https://www.youtube.com/watch?v=1XaPObu2Qhg",
        download_dir=tmp_path,
        max_height=720,
        cookies_file=Path("cookies.txt"),
    )

    assert command[:3] == ["python", "-m", "yt_dlp"]
    assert "--no-playlist" in command
    assert "--continue" in command
    assert "--cookies" in command
    assert str(tmp_path / "%(id)s - %(title).170B.%(ext)s") in command
    assert any("height<=720" in part for part in command)


def test_find_downloaded_file_prefers_media_file_for_video_id(tmp_path):
    sidecar = tmp_path / "1XaPObu2Qhg - title.info.json"
    partial = tmp_path / "1XaPObu2Qhg - title.mp4.part"
    media = tmp_path / "1XaPObu2Qhg - title.mp4"
    other = tmp_path / "36NOn-qcwws - other.mp4"
    sidecar.write_text("{}", encoding="utf-8")
    partial.write_bytes(b"partial")
    other.write_bytes(b"other")
    media.write_bytes(b"video")

    assert find_downloaded_file(tmp_path, "1XaPObu2Qhg") == media


def test_load_dotenv_sets_missing_values_without_overriding_existing(tmp_path, monkeypatch):
    env_path = tmp_path / ".env"
    env_path.write_text('YOUTUBE_API_KEY=from-file\nDRIVE_API_KEY="from file"\n', encoding="utf-8")
    monkeypatch.setenv("YOUTUBE_API_KEY", "already-set")

    loaded = load_dotenv(env_path)

    assert loaded == {"DRIVE_API_KEY": "from file"}
    assert __import__("os").environ["YOUTUBE_API_KEY"] == "already-set"
    assert __import__("os").environ["DRIVE_API_KEY"] == "from file"


def test_ensure_oauth_client_secrets_file_writes_oauth_json_env_value(tmp_path):
    secrets_path = tmp_path / "oauth-client.json"
    oauth_json = (
        '{"installed":{"client_id":"client-id.apps.googleusercontent.com",'
        '"client_secret":"client-secret","redirect_uris":["http://localhost"]}}'
    )

    assert ensure_oauth_client_secrets_file(secrets_path, oauth_json) == secrets_path

    assert secrets_path.read_text(encoding="utf-8").startswith("{\n")
    assert '"installed"' in secrets_path.read_text(encoding="utf-8")


def test_ensure_oauth_client_secrets_file_rejects_invalid_oauth_json(tmp_path):
    secrets_path = tmp_path / "oauth-client.json"

    try:
        ensure_oauth_client_secrets_file(secrets_path, '{"not_installed": {}}')
    except Exception as exc:
        assert "installed" in str(exc)
    else:
        raise AssertionError("expected invalid OAuth JSON to fail")


def test_process_jobs_downloads_when_manifest_has_no_local_path(tmp_path, monkeypatch):
    urls_path = tmp_path / "urls.txt"
    urls_path.write_text("https://www.youtube.com/watch?v=1XaPObu2Qhg\n", encoding="utf-8")
    downloaded_path = tmp_path / "downloads" / "1XaPObu2Qhg - title.mp4"
    calls = []

    def fake_download(job, download_dir, max_height, cookies_file, extra_ytdlp_args):
        calls.append(job)
        downloaded_path.parent.mkdir(parents=True, exist_ok=True)
        downloaded_path.write_bytes(b"video")
        return downloaded_path

    monkeypatch.setattr(drive_archive, "download_video", fake_download)
    args = Namespace(
        urls=str(urls_path),
        drive_folder_id=DEFAULT_DRIVE_FOLDER_ID,
        download_dir=str(tmp_path / "downloads"),
        manifest=str(tmp_path / "manifest.json"),
        drive_client_secrets=str(tmp_path / "client.json"),
        token_path=str(tmp_path / "token.json"),
        max_height=720,
        cookies=None,
        limit=None,
        dry_run=False,
        no_upload=True,
        force_download=False,
        force_upload=False,
        keep_local=True,
        stop_on_error=True,
        extra_ytdlp_arg=[],
    )

    assert process_jobs(args) == 0
    assert calls == [{"url": "https://www.youtube.com/watch?v=1XaPObu2Qhg", "video_id": "1XaPObu2Qhg"}]
