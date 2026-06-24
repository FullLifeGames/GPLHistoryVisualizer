from __future__ import annotations

import pytest

from src.gpl_history import cli
from src.gpl_history import youtube
from src.gpl_history.youtube import YouTubeClient


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict, text: str = "") -> None:
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self) -> dict:
        return self._payload


def test_youtube_client_falls_back_to_second_key_on_quota_error(monkeypatch):
    responses = [
        _FakeResponse(403, {"error": {"message": "quota exceeded"}}),
        _FakeResponse(200, {"items": [{"id": "abc"}]}),
    ]
    used_keys = []

    def fake_get(url, params, timeout):
        used_keys.append(params["key"])
        return responses.pop(0)

    monkeypatch.setattr(youtube.requests, "get", fake_get)

    payload = YouTubeClient(api_key="first", api_keys=("second",))._get("videos", part="snippet")

    assert payload == {"items": [{"id": "abc"}]}
    assert used_keys == ["first", "second"]


def test_youtube_client_does_not_retry_non_quota_errors(monkeypatch):
    used_keys = []

    def fake_get(url, params, timeout):
        used_keys.append(params["key"])
        return _FakeResponse(404, {"error": {"message": "not found"}})

    monkeypatch.setattr(youtube.requests, "get", fake_get)

    with pytest.raises(youtube.YouTubeApiError, match="not found"):
        YouTubeClient(api_key="first", api_keys=("second",))._get("videos", part="snippet")

    assert used_keys == ["first"]


def test_youtube_api_keys_from_env_orders_primary_then_numbered(monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY_2", "second")
    monkeypatch.setenv("YOUTUBE_API_KEY", "first")
    monkeypatch.setenv("YOUTUBE_API_KEY_10", "tenth")
    monkeypatch.setenv("YOUTUBE_API_KEY_3", "third")

    assert cli._youtube_api_keys_from_env() == ["first", "second", "third", "tenth"]


def test_list_playlist_videos_prefers_original_video_snippet_and_video_timestamp(monkeypatch):
    calls = []

    def fake_get(url, params, timeout):
        calls.append((url.rsplit("/", 1)[-1], dict(params)))
        if url.endswith("/playlistItems"):
            return _FakeResponse(
                200,
                {
                    "items": [
                        {
                            "id": "playlist-item",
                            "snippet": {
                                "title": "I've waited 13 weeks for this moment... | GPL Matchday 13",
                                "description": "",
                                "publishedAt": "2026-01-01T10:00:00Z",
                                "position": 0,
                            },
                            "contentDetails": {
                                "videoId": "video-1",
                                "videoPublishedAt": "2025-12-28T16:00:04Z",
                            },
                            "status": {"privacyStatus": "public"},
                        }
                    ]
                },
            )
        return _FakeResponse(
            200,
            {
                "items": [
                    {
                        "id": "video-1",
                        "snippet": {
                            "title": "Auf diesen Moment habe ich 13 Wochen gewartet... | GPL Spieltag 13",
                            "description": "Originale deutsche Beschreibung",
                            "publishedAt": "2025-12-28T16:00:04Z",
                            "defaultLanguage": "de",
                            "defaultAudioLanguage": "de",
                        },
                    }
                ]
            },
        )

    monkeypatch.setattr(youtube.requests, "get", fake_get)

    [video] = YouTubeClient(api_key="key").list_playlist_videos("uploads")

    assert video["title"] == "Auf diesen Moment habe ich 13 Wochen gewartet... | GPL Spieltag 13"
    assert video["description"] == "Originale deutsche Beschreibung"
    assert video["publishedAt"] == "2025-12-28T16:00:04Z"
    assert video["videoPublishedAt"] == "2025-12-28T16:00:04Z"
    assert video["playlistPublishedAt"] == "2026-01-01T10:00:00Z"
    assert video["defaultLanguage"] == "de"
    assert ("videos", "de") in [(endpoint, params.get("hl")) for endpoint, params in calls]
