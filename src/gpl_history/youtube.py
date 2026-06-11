from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests


class YouTubeApiError(RuntimeError):
    pass


@dataclass(frozen=True)
class YouTubeClient:
    api_key: str
    timeout: int = 30

    base_url = "https://www.googleapis.com/youtube/v3"

    def _get(self, endpoint: str, **params: Any) -> dict[str, Any]:
        query = {key: value for key, value in params.items() if value not in (None, "")}
        query["key"] = self.api_key
        response = requests.get(f"{self.base_url}/{endpoint}", params=query, timeout=self.timeout)
        try:
            payload = response.json()
        except ValueError as exc:
            raise YouTubeApiError(f"YouTube API returned non-JSON response for {endpoint}") from exc

        if response.status_code >= 400:
            error = payload.get("error", {})
            message = error.get("message") or response.text[:300]
            raise YouTubeApiError(f"YouTube API error {response.status_code}: {message}")
        return payload

    def resolve_channel(self, query: str = "PresentLP", channel_id: str | None = None) -> dict[str, Any]:
        if channel_id:
            payload = self._get("channels", part="snippet,contentDetails", id=channel_id, maxResults=1)
            items = payload.get("items", [])
            if not items:
                raise YouTubeApiError(f"No YouTube channel found for id {channel_id}")
            return _channel_item(items[0], source="channel_id")

        for_handle = query if query.startswith("@") else f"@{query}"
        for params, source in (
            ({"forHandle": for_handle}, "for_handle"),
            ({"forUsername": query.lstrip("@")}, "for_username"),
        ):
            try:
                payload = self._get("channels", part="snippet,contentDetails", maxResults=1, **params)
            except YouTubeApiError:
                continue
            items = payload.get("items", [])
            if items:
                return _channel_item(items[0], source=source)

        payload = self._get("search", part="snippet", type="channel", q=query, maxResults=5)
        items = payload.get("items", [])
        if not items:
            raise YouTubeApiError(f"No YouTube channel found for query {query!r}")

        ranked = sorted(
            items,
            key=lambda item: _channel_rank(item.get("snippet", {}).get("title", ""), query),
        )
        channel_id_from_search = ranked[0].get("id", {}).get("channelId")
        if not channel_id_from_search:
            raise YouTubeApiError(f"Search result for {query!r} did not include a channelId")
        payload = self._get("channels", part="snippet,contentDetails", id=channel_id_from_search, maxResults=1)
        return _channel_item(payload["items"][0], source="search")

    def list_playlists(self, channel_id: str) -> list[dict[str, Any]]:
        playlists: list[dict[str, Any]] = []
        page_token: str | None = None

        while True:
            payload = self._get(
                "playlists",
                part="snippet,contentDetails",
                channelId=channel_id,
                maxResults=50,
                pageToken=page_token,
            )
            for item in payload.get("items", []):
                snippet = item.get("snippet", {})
                playlists.append(
                    {
                        "playlistId": item.get("id"),
                        "title": snippet.get("title"),
                        "description": snippet.get("description"),
                        "publishedAt": snippet.get("publishedAt"),
                        "channelId": snippet.get("channelId"),
                        "channelTitle": snippet.get("channelTitle"),
                        "itemCount": item.get("contentDetails", {}).get("itemCount"),
                    }
                )
            page_token = payload.get("nextPageToken")
            if not page_token:
                break

        playlists.sort(key=lambda item: item.get("publishedAt") or "")
        return playlists

    def list_playlist_videos(self, playlist_id: str, max_pages: int | None = None) -> list[dict[str, Any]]:
        playlist_items: list[dict[str, Any]] = []
        page_token: str | None = None
        page_count = 0

        while True:
            payload = self._get(
                "playlistItems",
                part="snippet,contentDetails,status",
                playlistId=playlist_id,
                maxResults=50,
                pageToken=page_token,
            )
            playlist_items.extend(payload.get("items", []))
            page_count += 1
            page_token = payload.get("nextPageToken")
            if not page_token or (max_pages is not None and page_count >= max_pages):
                break

        video_ids = [
            item.get("contentDetails", {}).get("videoId")
            for item in playlist_items
            if item.get("contentDetails", {}).get("videoId")
        ]
        snippets_by_id = self._video_snippets(video_ids)

        videos: list[dict[str, Any]] = []
        for item in playlist_items:
            snippet = item.get("snippet", {})
            content = item.get("contentDetails", {})
            video_id = content.get("videoId")
            video_snippet = snippets_by_id.get(video_id, {})
            title = video_snippet.get("title") or snippet.get("title")
            description = video_snippet.get("description")
            if description is None:
                description = snippet.get("description")
            videos.append(
                {
                    "title": title,
                    "videoId": video_id,
                    "position": snippet.get("position"),
                    "description": description,
                    "publishedAt": video_snippet.get("publishedAt") or content.get("videoPublishedAt"),
                    "playlistItemId": item.get("id"),
                    "privacyStatus": item.get("status", {}).get("privacyStatus"),
                }
            )

        videos.sort(key=lambda item: item.get("position") if item.get("position") is not None else 999999)
        return videos

    def _video_snippets(self, video_ids: list[str]) -> dict[str, dict[str, Any]]:
        snippets: dict[str, dict[str, Any]] = {}
        for start in range(0, len(video_ids), 50):
            chunk = video_ids[start : start + 50]
            if not chunk:
                continue
            payload = self._get("videos", part="snippet", id=",".join(chunk), maxResults=50)
            for item in payload.get("items", []):
                snippets[item["id"]] = item.get("snippet", {})
        return snippets


def _channel_item(item: dict[str, Any], source: str) -> dict[str, Any]:
    snippet = item.get("snippet", {})
    content = item.get("contentDetails", {})
    related = content.get("relatedPlaylists", {})
    return {
        "channelId": item.get("id"),
        "title": snippet.get("title"),
        "description": snippet.get("description"),
        "publishedAt": snippet.get("publishedAt"),
        "customUrl": snippet.get("customUrl"),
        "uploadsPlaylistId": related.get("uploads"),
        "source": source,
    }


def _channel_rank(title: str, query: str) -> tuple[int, str]:
    title_lower = title.lower()
    query_lower = query.lstrip("@").lower()
    if title_lower == query_lower:
        return (0, title_lower)
    if query_lower in title_lower:
        return (1, title_lower)
    return (2, title_lower)
