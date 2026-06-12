# Data Strategy

The repository currently keeps both normalized CSV output and the raw source snapshots used to build it. This makes the web app reproducible without requiring live YouTube or Google Sheets access.

## Tracked Data

- `data/raw/season_*`: playlist videos, resolved links, and fetched sheet tabs.
- `data/raw/video_archive`: participant channel upload snapshots used to build the video archive.
- `data/normalized`: CSVs consumed by the web app.
- `data/manual`: header-only correction templates for reviewed future fixes.
- `data/review`: generated review queues for missing killlists, low-confidence matched videos, and unmatched game videos.

## Large Files

The raw video archive JSON files are the largest tracked files. They are useful for reproducibility, but they also make the repository heavier. If this project is pushed to a remote and grows further, use one of these strategies:

- Keep the current layout for a self-contained historical snapshot.
- Move `data/raw/video_archive/*.json` to Git LFS if the remote supports it.
- Publish raw snapshots as release artifacts and keep only `data/normalized` in the main branch.

Do not enable Git LFS attributes unless Git LFS is installed and the remote is ready for it.

## Regeneration Flow

```powershell
gpl-history normalize --data-dir data
gpl-history build-video-archive --data-dir data
gpl-history report --data-dir data --out docs/gpl-history.md
gpl-history review-queue --data-dir data
gpl-history validate --data-dir data
```

For a fresh online collection, set `YOUTUBE_API_KEY` and optionally `SHEETS_API_KEY`, then run:

```powershell
gpl-history collect --data-dir data --resume
gpl-history scan-videos --data-dir data --include-description-channels
```

## Manual Overrides

Manual rows should be rare, sourced, and reviewable. The expected flow is:

1. Add a row to the matching `data/manual/*.csv` file.
2. Preserve source URLs and use empty cells for unknown fields.
3. Run normalization and validation.
4. Document unusual season-specific logic in `docs/gpl-season-adapters.md`.

## Review Queues

`gpl-history review-queue --data-dir data` writes:

- `data/review/missing_killlists.csv`: sourced killlist links that are unavailable in the current raw set.
- `data/review/low_confidence_videos.csv`: matched game videos with low or medium confidence.
- `data/review/ambiguous_matches.csv`: game-like GPL videos that remain unmatched.

Rows in these files are not source claims by themselves. They are worklists for adding sourced manual corrections or improving matching rules.
