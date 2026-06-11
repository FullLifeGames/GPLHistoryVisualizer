from gpl_history.cli import _resolve_description_urls


def test_resolve_description_urls_resolves_unique_urls_once_and_preserves_sources():
    calls = []

    def fake_resolver(url, timeout):
        calls.append((url, timeout))
        return {"url": url, "resolved_url": f"{url}/final", "status_code": 200, "ok": True, "error": None}

    rows = [
        {"video_id": "a", "video_title": "A", "url": "https://bit.ly/gpl"},
        {"video_id": "b", "video_title": "B", "url": "https://bit.ly/gpl"},
    ]

    resolved = _resolve_description_urls(rows, resolver=fake_resolver, workers=2, timeout=3)

    assert calls == [("https://bit.ly/gpl", 3)]
    assert [entry["video_id"] for entry in resolved] == ["a", "b"]
    assert [entry["resolved_url"] for entry in resolved] == [
        "https://bit.ly/gpl/final",
        "https://bit.ly/gpl/final",
    ]
