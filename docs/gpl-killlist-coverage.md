# GPL Killlist Coverage

Review date: 2026-06-11

This audit checks which seasons have usable killlist data in `data/raw/season_*/sheets/` and where missing lists can be traced.

| Season | Status | Usable source | Gap / recovery lead |
| --- | --- | --- | --- |
| 1 | Available | Public sheet with one kill ranking. | None found. |
| 2 | Available | Public sheet with one kill ranking. | None found. |
| 3 | Missing | None usable. | PresentLP descriptions link to `https://docs.google.com/spreadsheets/d/1d7DpiW3aMjnYWiY9KSpk9nSi-gnEUnSFVAK-zGpy59Q/edit#gid=0`, but the current fetch is HTTP 410 / Google error HTML. Recovery would need the original sheet restored or manual reconstruction from battle videos. |
| 4 | Missing | None usable. | PresentLP descriptions link to `https://docs.google.com/spreadsheets/d/16OVT2YZN7gtsckJEMPSdMETsCiXuCs0HTSFl5xQGdwg/edit#gid=0`, but the file is deleted/unavailable. Recovery would need the original sheet restored or manual reconstruction from battle videos. |
| 5 | Missing | None usable. | PresentLP descriptions link to `https://docs.google.com/spreadsheets/d/1oXO8WjHo3Og1gncQWS7jEPaNyAFrkJhxL-xS57holc0/edit`, but the file is deleted/unavailable. Recovery would need the original sheet restored or manual reconstruction from battle videos. |
| 6 | Available | Sun Conference, Moon Conference, and Playoffs killlists. | None found. |
| 7 | Partially available | One regular-season `Killliste` sheet. | No separate playoff killlist table or playoff killlist link was found in the recovered sources. If playoff kills were tracked separately, the likely recovery source is battle footage or an external archived sheet. |
| 8 | Available | `Killliste L1` and `Killliste L2`. | None found. |
| 9 | Available | Overall, Singles, and Doubles killlists. | The adapter keeps `Overall` for aggregate kill summaries. Person details use Singles/Doubles rows; `Victory Instinct` Doubles is attributed to Bene, and `Victory Instinct` Singles is split by the sheet week columns between BelmontGabriel (weeks 1-7) and El Scizor (weeks 8-14). |
| 10 | Available with rule | `Playoffs Killliste` is used as canonical final killlist. | A regular `Killliste` exists in raw data, but it is intentionally not summed into the final Season 10 kill summary because the requested canonical source is playoffs-only. |

The normalized `pokemon_killlists.csv` preserves unavailable S3/S4/S5 source URLs as `not_available` rows, scoped to Bene's affected teams where the standings identify that context. Pokémon names and kill totals stay empty for those rows because the public individual killlist sheets currently return HTTP 410.
