# Manual Overrides

These CSV files are safe insertion points for reviewed historical corrections.

Rules:
- Keep `source_urls` for every sourced claim.
- Use `manual_override` for rows that come from a reviewed local correction file.
- Leave unknown fields empty instead of guessing.
- After editing, run `gpl-history normalize --data-dir data`, then `gpl-history validate --data-dir data`.

The templates are header-only by default and do not change normalized output until rows are added.

## S3-S5 Pokémon Usage Entry

Use `web/manual-killlist-entry.html` to assign the old S3-S5 Pokémon kill rows to players with a select field.
The page exports rows for `data/manual/pokemon_killlists.csv` with `data_status=manual_override`.

When those rows are present, normalization replaces the trainerless generated S3-S5 row for the same season, division,
stage, and Pokémon, so the old kills are not counted twice.
