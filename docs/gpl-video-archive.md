# GPL Video Archive

Scan date: 2026-06-11

The video archive is generated from participant channel URLs in `data/normalized/teams.csv`.

## Current Scan

- Participant channel candidates: 74
- Reachable channel uploads: 62
- Unavailable channel uploads: 12
- GPL-looking public videos collected: 4,125
- Actual game videos: 3,514
- Teambuilding videos: 194
- Announcement videos: 35
- Update videos: 25
- Recap videos: 22
- Reaction videos: 9
- Draft-analysis videos: 3
- Tierlist videos: 3
- Other GPL videos kept for review: 320
- Videos matched to normalized matches: 3,290
- Download-manager URL list: `data/normalized/video_urls.txt`

Raw channel scan data is stored under `data/raw/video_archive/`. Normalized outputs are:

- `data/normalized/video_archive.csv`: every GPL-looking public video found on participant channels.
- `data/normalized/match_videos.csv`: actual game videos matched to a normalized `matches.csv` row.
- `data/normalized/video_urls.txt`: one URL per collected public GPL-looking video, intended for download managers.
- `data/review/low_confidence_videos.csv`: matched game videos whose confidence should be reviewed.
- `data/review/ambiguous_matches.csv`: game-like videos that remain unmatched.

## Matching Rules

The matcher uses conservative evidence:

- GPL title signal: `GPL` or `German Pokémon League`.
- Season signal: examples like `S7`, `Season 7`, `Saison 7`.
- Matchday signal: both `Spieltag 7` and `7. Spieltag`.
- Playoff signal: playoff/final/semifinal/quarterfinal wording.
- Participant signal: channel owner, player names, and team names from `teams.csv`.
- Video type signal: actual games, teambuildings, announcements, updates, recaps, reactions, draft analyses, tierlists, and other GPL videos are separated in `video_type`.
- Confidence explanation: `confidence_explanation` records why a row matched, for example season, week, channel-side, and title-side evidence.

If a title contains an explicit matchday, the normalized match must have the same matchday. Non-game categories are retained in `video_archive.csv` and `video_urls.txt` but are not added to `match_videos.csv`.

Older uploads, especially Season 1 videos, often do not include a season token in the title. When a video matches a sourced `matches.csv` row, the archive fills the detected season and matchday from that match evidence so season filtering still works.
