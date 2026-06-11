# Manual Overrides

These CSV files are safe insertion points for reviewed historical corrections.

Rules:
- Keep `source_urls` for every sourced claim.
- Use `manual_override` for rows that come from a reviewed local correction file.
- Leave unknown fields empty instead of guessing.
- After editing, run `gpl-history normalize --data-dir data`, then `gpl-history validate --data-dir data`.

The templates are header-only by default and do not change normalized output until rows are added.
