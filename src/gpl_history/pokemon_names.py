from __future__ import annotations

import csv
import io
import json
import re
import unicodedata
from pathlib import Path
from typing import Callable

import requests

from .storage import ensure_dir

POKEAPI_CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
SPECIES_NAMES_URL = f"{POKEAPI_CSV_BASE}/pokemon_species_names.csv"
LANGUAGES_URL = f"{POKEAPI_CSV_BASE}/languages.csv"
POKEMON_URL = f"{POKEAPI_CSV_BASE}/pokemon.csv"
POKEMON_FORMS_URL = f"{POKEAPI_CSV_BASE}/pokemon_forms.csv"
POKEMON_FORM_NAMES_URL = f"{POKEAPI_CSV_BASE}/pokemon_form_names.csv"
SOURCE_URLS = f"{SPECIES_NAMES_URL};{LANGUAGES_URL};{POKEMON_URL};{POKEMON_FORMS_URL};{POKEMON_FORM_NAMES_URL}"

TRANSLATION_FIELDS = ["species_id", "german", "english", "asset_id", "source_url"]

GERMAN_FORM_ALIASES = {
    "deoxys-speed": ["Deoxys-Geschwindigkeit", "Deoxys-Initiative", "Deoxys (Geschwindigkeit)"],
    "darmanitan-standard": ["Flampivian-Normal", "Flampivian-Standard"],
    "darmanitan-galar-standard": ["Galar-Flampivian", "Flampivian-Galar"],
    "enamorus-incarnate": ["Cupidos-I", "Cupidos-Inkarnationsform"],
    "enamorus-therian": ["Cupidos-T", "Cupidos-Therian", "Cupidos-Tiergeistform"],
    "indeedee-male": ["Servol (männlich)", "Servol-m", "Servol-M"],
    "indeedee-female": ["Servol (weiblich)", "Servol-w", "Servol-W"],
    "hoopa-unbound": ["Hoopa-Entfesselt", "Entfesseltes Hoopa", "Hoopa-Entfesseltes Hoopa"],
    "kyurem-black": ["Kyurem-Schwarz", "Schwarzes Kyurem", "Kyurem-Black", "Black Kyurem"],
    "kyurem-white": ["Kyurem-Weiss", "Weisses Kyurem", "Kyurem-White", "White Kyurem"],
    "landorus-incarnate": ["Demeteros-I", "Demeteros-Inkarnationsform"],
    "landorus-therian": ["Demeteros-T", "Demeteros-Therian", "Demeteros-Tiergeistform"],
    "lycanroc-dusk": ["Wolwerock-Dämmerungsform", "Wolwerock-Daemmerungsform", "Wolwerock-Zwielicht"],
    "lycanroc-midday": ["Wolwerock", "Wolwerock-Tag", "Wolwerock-Tagform"],
    "meowstic-male": ["Psiaugon (männlich)", "Psiaugon-m", "Psiaugon-M"],
    "meowstic-female": ["Psiaugon (weiblich)", "Psiaugon-w", "Psiaugon-W"],
    "ogerpon-cornerstone-mask": ["Ogerpon-Gestein"],
    "ogerpon-hearthflame-mask": ["Ogerpon-Feuer"],
    "ogerpon-wellspring-mask": ["Ogerpon-Wasser"],
    "rotom-fan": ["Rotom-Wirbel", "Rotom (Wirbel-Form)"],
    "rotom-frost": ["Rotom-Frost", "Rotom (Frost-Form)"],
    "rotom-heat": ["Rotom-H", "Rotom-Heat", "Rotom-Hitze", "Rotom (Hitze-Form)"],
    "rotom-mow": ["Rotom-Mow", "Rotom-Schneid", "Rotom-Schneide", "Rotom (Schneide-Form)"],
    "rotom-wash": ["Rotom-W", "Rotom-Wash", "Rotom-Wasch", "Rotom (Wasch-Form)"],
    "thundurus-incarnate": ["Voltolos-I", "Voltolos-Inkarnationsform"],
    "thundurus-therian": ["Voltolos-T", "Voltolos-Therian", "Voltolos-Tiergeistform"],
    "tornadus-incarnate": ["Boreos-I", "Boreos-Inkarnationsform"],
    "tornadus-therian": ["Boreos-T", "Boreos-Therian", "Boreos-Tiergeistform"],
    "toxtricity-amped": ["Riffex-Hoch", "Riffex-Hochform"],
    "toxtricity-low-key": ["Riffex-Tief", "Riffex-Tiefform"],
    "tyranitar-mega": ["Mega-Despotar"],
    "silvally-normal": ["Amigento-Normal", "Amigento-Typ:Normal"],
    "zygarde-50": ["Zygarde", "Zygarde-50", "Zygarde-50%"],
    "zygarde-50-power-construct": ["Zygarde-50", "Zygarde-50%"],
}

GERMAN_FORM_BASE_ALIASES = {
    "enamorus-incarnate": ["Cupidos"],
    "landorus-incarnate": ["Demeteros"],
    "thundurus-incarnate": ["Voltolos"],
    "tornadus-incarnate": ["Boreos"],
}

GERMAN_FORM_DISPLAY_NAMES = {
    "enamorus-incarnate": "Cupidos-I",
    "enamorus-therian": "Cupidos-T",
    "hoopa-unbound": "Hoopa-Entfesselt",
    "kyurem-black": "Kyurem-Schwarz",
    "kyurem-white": "Kyurem-Weiss",
    "landorus-incarnate": "Demeteros-I",
    "landorus-therian": "Demeteros-T",
    "lycanroc-dusk": "Wolwerock-Dämmerungsform",
    "lycanroc-midday": "Wolwerock-Tagform",
    "rotom-fan": "Rotom-Wirbel",
    "rotom-frost": "Rotom-Frost",
    "rotom-heat": "Rotom-Hitze",
    "rotom-mow": "Rotom-Schneide",
    "rotom-wash": "Rotom-Wasch",
    "thundurus-incarnate": "Voltolos-I",
    "thundurus-therian": "Voltolos-T",
    "tornadus-incarnate": "Boreos-I",
    "tornadus-therian": "Boreos-T",
    "zygarde-50": "Zygarde-50",
}

GERMAN_NAME_ALIASES = {
    "Drifzepeli": ["Drifzepli"],
    "Gallopa": ["Galoppa"],
    "Meistagrif": ["Meistergrif"],
    "Porygon2": ["Porygon 2", "Porygon-2"],
    "Schwalboss": ["Schwallbos"],
    "Shnurgarst": ["Shnurgast"],
}

FORM_ASSET_OVERRIDES = {
    "darmanitan-standard": "darmanitan",
    "darmanitan-galar-standard": "darmanitangalar",
    "indeedee-male": "indeedee",
    "indeedee-female": "indeedeef",
    "keldeo-ordinary": "keldeo",
    "lycanroc-midday": "lycanroc",
    "meowstic-male": "meowstic",
    "meowstic-female": "meowsticf",
    "toxtricity-amped": "toxtricity",
    "toxtricity-amped-gmax": "toxtricitygmax",
    "zygarde-10-power-construct": "zygarde10",
    "zygarde-50": "zygarde",
    "zygarde-50-power-construct": "zygarde",
}
BASE_FORM_IDENTIFIER_SUFFIXES = ("-incarnate", "-normal")


def fetch_and_write_pokemon_names(data_dir: Path, web_dir: Path = Path("web")) -> list[dict[str, str]]:
    species_names = _fetch_text(SPECIES_NAMES_URL)
    languages = _fetch_text(LANGUAGES_URL)
    pokemon = _fetch_text(POKEMON_URL)
    pokemon_forms = _fetch_text(POKEMON_FORMS_URL)
    pokemon_form_names = _fetch_text(POKEMON_FORM_NAMES_URL)
    rows = build_translation_rows(species_names, languages, pokemon, pokemon_forms, pokemon_form_names)
    write_translation_outputs(
        rows,
        data_dir / "normalized" / "pokemon_name_translations.csv",
        web_dir / "pokemon_names.js",
        source_url=SOURCE_URLS,
    )
    return rows


def build_translation_rows(
    species_names_csv: str,
    languages_csv: str,
    pokemon_csv: str | None = None,
    pokemon_forms_csv: str | None = None,
    pokemon_form_names_csv: str | None = None,
) -> list[dict[str, str]]:
    language_ids = _language_ids(languages_csv)
    german_id = language_ids["de"]
    english_id = language_ids["en"]

    by_species: dict[str, dict[str, str]] = {}
    for row in csv.DictReader(io.StringIO(species_names_csv)):
        species_id = row["pokemon_species_id"]
        current = by_species.setdefault(species_id, {"species_id": species_id})
        if row["local_language_id"] == german_id:
            current["german"] = row["name"]
        if row["local_language_id"] == english_id:
            current["english"] = row["name"]

    rows = []
    species_lookup: dict[str, dict[str, str]] = {}
    for species_id in sorted(by_species, key=lambda value: int(value)):
        current = by_species[species_id]
        german = current.get("german")
        english = current.get("english")
        if not german or not english:
            continue
        row = {
            "species_id": species_id,
            "german": german,
            "english": english,
            "asset_id": asset_id(english),
        }
        rows.append(row)
        species_lookup[species_id] = row

    if pokemon_csv and pokemon_forms_csv and pokemon_form_names_csv:
        rows.extend(
            _form_translation_rows(
                pokemon_csv=pokemon_csv,
                pokemon_forms_csv=pokemon_forms_csv,
                pokemon_form_names_csv=pokemon_form_names_csv,
                language_ids=language_ids,
                species_lookup=species_lookup,
            )
        )

    rows.extend(_manual_name_alias_rows(rows))
    return _dedupe_translation_rows(rows)


def write_translation_outputs(
    rows: list[dict[str, str]],
    csv_path: Path,
    js_path: Path,
    source_url: str = SOURCE_URLS,
) -> None:
    ensure_dir(csv_path.parent)
    ensure_dir(js_path.parent)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=TRANSLATION_FIELDS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({**row, "source_url": source_url})
    js_path.write_text(_js_module(rows), encoding="utf-8")


def asset_id(value: str) -> str:
    return _name_key(value)


def name_key(value: str) -> str:
    return _name_key(value)


def pokemon_display_name(value: str | None) -> str | None:
    clean = str(value or "").strip()
    if not clean:
        return None
    return POKEMON_DISPLAY_ALIASES_BY_KEY.get(_name_key(clean), clean)


def _language_ids(languages_csv: str) -> dict[str, str]:
    rows = list(csv.DictReader(io.StringIO(languages_csv)))
    result = {row["identifier"]: row["id"] for row in rows}
    missing = {"de", "en"} - set(result)
    if missing:
        raise ValueError(f"Missing required PokeAPI languages: {', '.join(sorted(missing))}")
    return result


def _form_translation_rows(
    pokemon_csv: str,
    pokemon_forms_csv: str,
    pokemon_form_names_csv: str,
    language_ids: dict[str, str],
    species_lookup: dict[str, dict[str, str]],
) -> list[dict[str, str]]:
    pokemon_by_id = {row["id"]: row for row in csv.DictReader(io.StringIO(pokemon_csv))}
    form_names = _form_names_by_id(pokemon_form_names_csv)
    german_id = language_ids["de"]
    english_id = language_ids["en"]
    rows: list[dict[str, str]] = []

    for form in csv.DictReader(io.StringIO(pokemon_forms_csv)):
        form_identifier = form.get("form_identifier")
        if not form_identifier:
            continue
        pokemon = pokemon_by_id.get(form.get("pokemon_id", ""))
        if not pokemon:
            continue
        base = species_lookup.get(pokemon.get("species_id", ""))
        if not base:
            continue

        identifier = form["identifier"]
        names = form_names.get(form["id"], {})
        english_aliases = _english_form_aliases(identifier, names.get(english_id), base["english"])
        german_aliases = _german_form_aliases(identifier, names.get(german_id), base["german"])
        if not english_aliases or not german_aliases:
            continue

        asset = _form_asset_id(identifier, form, base["asset_id"])
        english_display = english_aliases[0]
        for german in german_aliases:
            rows.append({"species_id": base["species_id"], "german": german, "english": english_display, "asset_id": asset})
        german_display = german_aliases[0]
        for english in english_aliases[1:]:
            rows.append({"species_id": base["species_id"], "german": german_display, "english": english, "asset_id": asset})

    return rows


def _form_names_by_id(pokemon_form_names_csv: str) -> dict[str, dict[str, dict[str, str]]]:
    names: dict[str, dict[str, dict[str, str]]] = {}
    for row in csv.DictReader(io.StringIO(pokemon_form_names_csv)):
        form_id = row["pokemon_form_id"]
        language_id = row["local_language_id"]
        names.setdefault(form_id, {})[language_id] = row
    return names


def _english_form_aliases(identifier: str, row: dict[str, str] | None, base_name: str) -> list[str]:
    aliases = [identifier]
    if row:
        aliases.append(row.get("pokemon_name", ""))
    return _unique_nonempty(aliases)


def _german_form_aliases(identifier: str, row: dict[str, str] | None, base_name: str) -> list[str]:
    aliases: list[str] = []
    if row:
        pokemon_name = row.get("pokemon_name", "")
        form_name = row.get("form_name", "")
        aliases.append(pokemon_name)
        if form_name:
            aliases.extend([f"{base_name}-{form_name}", f"{base_name} ({form_name})"])
    if identifier.endswith("-gmax"):
        aliases.extend([f"Giga-{base_name}", f"{base_name}-Giga"])
    aliases.extend(GERMAN_FORM_ALIASES.get(identifier, []))
    return _unique_nonempty(aliases)


def _form_asset_id(identifier: str, form: dict[str, str], base_asset_id: str) -> str:
    if identifier in FORM_ASSET_OVERRIDES:
        return FORM_ASSET_OVERRIDES[identifier]
    if identifier.endswith(BASE_FORM_IDENTIFIER_SUFFIXES):
        return base_asset_id
    if identifier.startswith("ogerpon-") and identifier.endswith("-mask"):
        return _name_key(identifier.removesuffix("-mask"))
    return _name_key(identifier)


def _manual_name_alias_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    by_german = {_name_key(row["german"]): row for row in rows}
    aliases: list[dict[str, str]] = []
    for canonical, alias_values in GERMAN_NAME_ALIASES.items():
        source = by_german.get(_name_key(canonical))
        if not source:
            continue
        for alias in alias_values:
            aliases.append(
                {
                    "species_id": source["species_id"],
                    "german": alias,
                    "english": source["english"],
                    "asset_id": source["asset_id"],
                }
            )
    return aliases


def _dedupe_translation_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    unique: list[dict[str, str]] = []
    for row in rows:
        key = (_name_key(row.get("german", "")), row.get("asset_id", ""))
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def _unique_nonempty(values: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for value in values:
        clean = str(value or "").strip()
        if not clean:
            continue
        key = _name_key(clean)
        if key in seen:
            continue
        seen.add(key)
        unique.append(clean)
    return unique


def _js_module(rows: list[dict[str, str]]) -> str:
    translations = [
        {
            "species_id": int(row["species_id"]),
            "german": row["german"],
            "english": row["english"],
            "asset_id": row["asset_id"],
        }
        for row in rows
    ]
    asset_ids: dict[str, str] = {}
    for row in rows:
        asset_ids[_name_key(row["german"])] = row["asset_id"]
        asset_ids[_name_key(row["english"])] = row["asset_id"]

    return (
        "// Generated by `gpl-history pokemon-names --data-dir data`.\n"
        "// Source: PokeAPI Pokémon species names and languages CSVs\n"
        f"export const POKEMON_NAME_TRANSLATIONS = {json.dumps(translations, ensure_ascii=False, indent=2)};\n\n"
        f"export const POKEMON_ASSET_IDS = {json.dumps(dict(sorted(asset_ids.items())), ensure_ascii=False, indent=2)};\n\n"
        "export function pokemonAssetKey(value) {\n"
        "  return String(value ?? \"\")\n"
        "    .trim()\n"
        "    .toLowerCase()\n"
        "    .normalize(\"NFD\")\n"
        "    .replace(/[\\u0300-\\u036f]/g, \"\")\n"
        "    .replaceAll(\"ß\", \"ss\")\n"
        "    .replaceAll(\"♀\", \"f\")\n"
        "    .replaceAll(\"♂\", \"m\")\n"
        "    .replace(/[^a-z0-9]+/g, \"\");\n"
        "}\n\n"
        "export function pokemonAssetId(value) {\n"
        "  const key = pokemonAssetKey(value);\n"
        "  return POKEMON_ASSET_IDS[key] || key;\n"
        "}\n"
    )


def _name_key(value: str) -> str:
    text = unicodedata.normalize("NFD", str(value or "").lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = text.replace("ß", "ss").replace("♀", "f").replace("♂", "m")
    return re.sub(r"[^a-z0-9]+", "", text)


GERMAN_NAME_ALIASES_BY_KEY = {
    _name_key(alias): canonical for canonical, aliases in GERMAN_NAME_ALIASES.items() for alias in aliases
}


def _form_display_aliases_by_key() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for identifier, values in GERMAN_FORM_ALIASES.items():
        display = GERMAN_FORM_DISPLAY_NAMES.get(identifier, values[0] if values else "")
        if not display:
            continue
        for alias in [display, *GERMAN_FORM_BASE_ALIASES.get(identifier, []), *values]:
            aliases[_name_key(alias)] = display
    return aliases


POKEMON_DISPLAY_ALIASES_BY_KEY = {
    **_form_display_aliases_by_key(),
    **GERMAN_NAME_ALIASES_BY_KEY,
}


def _fetch_text(url: str, fetcher: Callable[..., requests.Response] = requests.get) -> str:
    response = fetcher(url, timeout=30)
    response.raise_for_status()
    return response.text
