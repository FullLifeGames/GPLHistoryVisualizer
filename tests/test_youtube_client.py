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
