# GPL History Visualizer

CSV-first reconstruction and visualization of German Pokémon League history from public YouTube playlists, video descriptions, Google Sheets, and reviewed correction data.

## What Is Included

- Python CLI for collecting PresentLP GPL playlists, resolving description URLs, fetching public Google Sheets, normalizing data, scanning participant channels, and validating CSVs.
- Normalized CSVs under `data/normalized/`.
- Raw collected source data under `data/raw/`.
- Static web app under `web/` with all-time table, killlists, Pokémon detail pages, table history, match plans, battle history, video archive, person details, data coverage, season detail, and matchup checker.
- Markdown source report under `docs/gpl-history.md`.
- Review queue CSVs under `data/review/` for missing killlists, missing appearances, and video matches that need human cleanup.
- Data quality and source claim CSVs for per-season coverage and sourced claim inspection.

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

## Common Commands

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

Validate normalized CSV files:

```powershell
gpl-history validate --data-dir data
```

Rebuild the video archive from already scanned channel uploads:

```powershell
gpl-history build-video-archive --data-dir data
```

Generate review queue CSVs:

```powershell
gpl-history review-queue --data-dir data
```

Check generated data-quality and review artifacts for drift:

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
node --test tests/web_i18n.test.mjs tests/web_pokemon_names.test.mjs tests/web_router.test.mjs tests/web_stats.test.mjs
```

Serve the web app locally:

```powershell
python -m http.server 8000
```

Open `http://127.0.0.1:8000/web/index.html`.

The web app uses Tabulator from unpkg for interactive tables and `@pkmn/img` from unpkg for Pokémon sprites/icons. German and English Pokémon name mappings are generated from PokeAPI into `data/normalized/pokemon_name_translations.csv` and `web/pokemon_names.js`. If those CDNs are unavailable, the data tables still render and Pokémon images fall back to text badges.

## Deployment

`.github/workflows/pages.yml` publishes a lean GitHub Pages artifact containing `web/`, `data/normalized/`, `data/review/`, `docs/`, and the GPL Season 10 logo. It intentionally excludes `data/raw/`.

## Manual Corrections

Reviewed corrections can be added as CSV rows under `data/manual/`. Keep every correction sourced and use `manual_override` in `data_status`. After editing manual files, run:

```powershell
gpl-history normalize --data-dir data
gpl-history data-quality --data-dir data
gpl-history review-queue --data-dir data
gpl-history validate --data-dir data
```

## Data Principles

- Never infer champions without source evidence.
- Preserve source URLs for every claim.
- Mark unavailable or uncertain data instead of guessing.
- Keep team and person statistics separate when controller stints differ.
- Use the data coverage page to inspect missing or partial season data before adding corrections.

## Security Note

API keys were used locally during collection. Rotate any keys that were shared outside a private environment before publishing this repository.
