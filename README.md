# GPL History Visualizer

CSV-first reconstruction and visualization of German Pokémon League history from public YouTube playlists, video descriptions, Google Sheets, and reviewed correction data.

Report data issues, missing videos, or UI problems through [GitHub Issues](https://github.com/FullLifeGames/GPLHistoryVisualizer/issues).

## What Is Included

- Python CLI for collecting PresentLP GPL playlists, resolving description URLs, fetching public Google Sheets, normalizing data, scanning participant channels, and validating CSVs.
- Normalized CSVs under `data/normalized/`.
- Raw collected source data under `data/raw/`.
- Static web app under `web/` with all-time table, killlists, Pokémon detail pages, table history, match plans, battle history, video archive, person details, data coverage, and season detail. Navigation groups: Bestenlisten, Saisons, Duelle, Pokémon, Videos, Spiele, plus a tucked-away Werkstatt tab for data review. The six season views are bundled into one Saison hub with chapter sub-tabs (Akte, Spielplan, Spielbaum, Tabellenverlauf, Story, Wrapped), and a Wegweiser page (`#/wegweiser`, linked from the header) lists every area with one-line descriptions.
- Elo-derived views computed client-side from the match chronology: an Upset-Index (matches ranked by the winner's pregame Elo win chance) and, on person detail pages, a career Elo curve with team stints plus a per-match Elo ledger.
- A records-and-honors cluster in the Rekorde group: a Rekordbuch (record progressions with a match finder and streak tables), retroactively computed Auszeichnungen with a trophy shelf on person pages, and a Hall of Fame with the Holzlöffel chronicle. Backed by generated `streaks.csv`, `records_progression.csv`, and `awards.csv`.
- A head-to-head cluster in the Duelle group: ranked Rivalitäten with per-pair detail pages (meeting ledger, Elo-gap chart, most-watched meeting) and pair pickers that replace the former matchup checker (old `#/matchup` links redirect), plus the Orakel der GPL, which finds the shortest chain of transitive wins between any two people and ranks everyone by win-chain dominance, and the Zeitmaschinen-Duell, which lets two rosters from any seasons face off on paper with generation-correct base stats, a defensive type matrix, interleaved speed tiers, and a clearly labeled hypothetical Elo outcome.
- A Videos-and-time cluster in the Videos group: the Publikums-Geschichte (monthly upload and view charts stacked by channel, with shaded season windows, champion annotations, and a per-season attention strip of weekly view z-scores) and the Zeitstrahl (a calendar timeline of season starts and ends, champions, record hand-offs, top-viewed uploads, and archive milestones, with a full-history scrubber spanning 2014–2026 that snaps to event days, shows that day's events, and jumps the timeline on release). All dates in both views are video upload dates.
- A Spiele group with five mini-games generated from the archive data, routed as `#/spiel/<id>`: Kader-Raten (a date-seeded daily roster puzzle with sprite-by-sprite reveal plus free play), the Tipp-Spiel (predict historic match winners and exact scores against the Elo forecast), the Klick-Duell (higher/lower on video views or career stats), the GPL-Quizshow (templated multiple choice over champions, standings, killlists, drafts, and head-to-heads in three modes), and Wer bin ich? (a staged career riddle). Every reveal cites its source rows; only the daily Kader-Raten progress persists in the browser's localStorage — all other scores are session-only.
- A season-narratives cluster in the Saisons group: the Titelrennen (a dashed, Simulation-badged probability chart above the table history from Monte-Carlo `title_odds.csv`, with a "rechnerisch entschieden" marker and playoff-odds charts for seasons 6 and 10), the Season Story (`#/saison-story/<season>`, a scroll-driven recap with a sticky standings table advancing through intro, race checkpoints, top highlight matches, the simulated decided moment, playoff beats, and the champion reveal — all narration templated from data), and GPL Wrapped (`#/wrapped/<season>`, a swipeable card deck of champion, upset, MVP, kill leader, most-watched video, closest match, and Holzlöffel, with per-card PNG downloads once `gpl-history wrapped-cards` has run; `#/wrapped/person/<person>` shows the DOM-only career variant).
- Aggregated season-count tables also show an explicit season list, so counts can be checked against the exact seasons represented.
- Markdown source report under `docs/gpl-history.md`.
- Review queue CSVs under `data/review/` for missing killlists, missing appearances, and video matches that need human cleanup.
- Data quality and source claim CSVs for per-season coverage and sourced claim inspection.
- Precomputed aggregate CSVs for heavy frontend summaries: all-time player rows, all-time Pokémon rows, matchup summaries, roster score audit rows, and season storylines.
- Known limitations and correction workflow under `docs/known-limitations.md`.

## Setup

```powershell
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Add API keys to `.env` or your shell environment:

```powershell
$env:YOUTUBE_API_KEY="..."
$env:SHEETS_API_KEY="..."
```

Do not commit `.env`. The checked-in `.gitignore` keeps it local.

For Drive video archiving, install the optional downloader/uploader dependencies:

```powershell
python -m pip install -e ".[drive-archive]"
```

## Common Commands

All CLI entry points are mirrored in `package.json` for release work:

```powershell
npm run setup:py
npm run collect
npm run collect:resume
npm run normalize
npm run data-quality
npm run aggregates
npm run report
npm run scan-videos
npm run scan-videos:description-channels
npm run build-video-archive
npm run fetch-video-stats
npm run fetch-video-stats:force
npm run validate
npm run validate:strict
npm run review-queue
npm run check:generated
npm run pokemon-names
npm run pokemon-draft-overview
npm run pokemon-draft-overview:refresh
npm run team-rosters
npm run roster-matchdays
npm run team-graphic-slots
npm run test
npm run release:check
npm run serve
```

Drive archive helpers are also available after `npm run setup:drive`:

```powershell
npm run drive:dry-run
npm run drive:limit
npm run drive:no-upload
npm run drive:archive
```

Normalize existing raw data:

```powershell
gpl-history normalize --data-dir data
```

Generate the Markdown report:

```powershell
gpl-history report --data-dir data --out docs/gpl-history.md
```

Generate data quality and source claim CSVs:

```powershell
gpl-history data-quality --data-dir data
```

Generate only the precomputed frontend aggregate CSVs:

```powershell
gpl-history aggregates --data-dir data
```

Regenerate the retro Titelrennen probabilities (`data/normalized/title_odds.csv`, seeded Monte-Carlo — not part of `check-generated` because simulation is expensive; rerun after match data changes):

```powershell
gpl-history title-odds --data-dir data [--sims N --seed S]
```

Render shareable GPL Wrapped PNG cards into `web/assets/wrapped/` (optional dependency: `pip install .[wrapped]`; German-only, not drift-checked):

```powershell
gpl-history wrapped-cards --data-dir data --web-dir web
```

Validate normalized CSV files:

```powershell
gpl-history validate --data-dir data
```

Rebuild the video archive from already scanned channel uploads:

```powershell
gpl-history build-video-archive --data-dir data
```

Download `gpl-video-urls.txt` videos and upload them to the AllGPLVideos Drive folder:

```powershell
gpl-drive-archive --dry-run
gpl-drive-archive --limit 5
gpl-drive-archive
```

The YouTube Data API does not provide video file downloads, so this command uses `yt-dlp` for the video bytes and the Google Drive API for uploads. Drive uploads require OAuth Desktop client JSON, not just an API key. Put it in ignored `.env` as a single-line `OAuth_Json={...}` value, or save it to `output/google-drive-oauth-client.json` and keep `output/` local. The command writes a resumable manifest to `output/gpl-video-drive-manifest.json` and skips videos already marked uploaded.
If `gpl-video-urls.txt` is absent, the command falls back to `data/normalized/video_urls.txt`.

Generate review queue CSVs:

```powershell
gpl-history review-queue --data-dir data
```

Check generated data-quality, aggregate, and review artifacts for drift:

```powershell
gpl-history check-generated --data-dir data
```

Fetch German and English Pokémon names from PokeAPI and rebuild the frontend sprite mapping:

```powershell
gpl-history pokemon-names --data-dir data --web-dir web
```

Run tests:

```powershell
python -m pytest -q
node --test tests/*.mjs
```

Or use the npm convenience scripts:

```powershell
npm test
npm run check:generated
npm run validate
```

Serve the web app locally:

```powershell
python -m http.server 8000
```

Open `http://127.0.0.1:8000/web/index.html`.

The web app uses Tabulator from unpkg for interactive tables and `@pkmn/img` from unpkg for Pokémon sprites/icons. German and English Pokémon name mappings are generated from PokeAPI into `data/normalized/pokemon_name_translations.csv` and `web/pokemon_names.js`. If those CDNs are unavailable, the data tables still render and Pokémon images fall back to text badges.

## Deployment

`.github/workflows/pages.yml` publishes a lean GitHub Pages artifact containing `web/` including release assets, `data/normalized/`, `data/review/`, and `docs/`. It intentionally excludes `data/raw/`.

## Manual Corrections

See `docs/known-limitations.md` for the public review and correction workflow.

Reviewed corrections can be added as CSV rows under `data/manual/`. Keep every correction sourced and use `manual_override` in `data_status`. After editing manual files, run:

```powershell
gpl-history normalize --data-dir data
gpl-history data-quality --data-dir data
gpl-history review-queue --data-dir data
gpl-history validate --data-dir data
```

For S3-S5 Pokémon usage assignment, open `web/manual-killlist-entry.html` through a local HTTP server and export rows for
`data/manual/pokemon_killlists.csv`. The form keeps old kill totals and source URLs, and only adds the reviewed player/team
assignment.

For S3-S5 team-graphic assignment, run `gpl-history team-graphic-slots --data-dir data --graphics-dir output/team-graphics`,
then open `web/team-graphics-entry.html`. It shows cropped Pokémon slots from the local graphics and exports reviewed
rows for `data/manual/team_pokemon_usage.csv`.
After those rows are in place, rerun `gpl-history normalize --data-dir data` and use `web/manual-killlist-entry.html`
for the remaining killlist Pokémon that still have no team/person assignment.

`gpl-history normalize --data-dir data` also rebuilds `data/normalized/pokemon_draft_overview.csv`, a form-level Pokémon
draft overview with Pokémon Showdown tiers. Use `gpl-history pokemon-draft-overview --data-dir data --refresh` to refresh
the cached tier source under `data/raw/pokemon_showdown/`.

## Data Principles

- Never infer champions without source evidence.
- Preserve source URLs for every claim.
- Mark unavailable or uncertain data instead of guessing.
- Keep team and person statistics separate when controller stints differ.
- Use the data coverage page to inspect missing or partial season data before adding corrections.

## Security Note

API keys were used locally during collection. Rotate any keys that were shared outside a private environment before publishing this repository.
