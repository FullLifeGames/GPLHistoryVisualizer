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

## S3-S5 Team Graphic Usage Entry

Use `web/team-graphics-entry.html` to review Pokémon crops from `output/team-graphics`.
The page exports rows for `data/manual/team_pokemon_usage.csv`.

Those rows are used as a manual source during normalization: trainerless S3-S5 killlist rows with a unique matching
season and Pokémon get the reviewed person/team assignment while keeping the original kill total.

After `gpl-history normalize --data-dir data`, open `web/manual-killlist-entry.html` for the remaining unassigned
killlist Pokémon. The page starts with the open-only filter enabled and exports rows for `data/manual/pokemon_killlists.csv`.
## Known Unassigned S5 Killlist Rows

The S5 manual import from `pokemon_killlists_s3_s5_manual(1).csv` assigns 40 of 42 previously open regular-season
Liga 1 killlist rows. These two rows intentionally remain unassigned because no reliable team/player assignment is
available yet:

- `Impergator`, 4 kills, `season_005`, `Liga 1`, `regular_season`
- `Togedemaru`, 3 kills, `season_005`, `Liga 1`, `regular_season`
