import csv

from gpl_history.pokemon_names import SOURCE_URLS, build_translation_rows, name_key, pokemon_display_name, write_translation_outputs


SPECIES_NAMES = """pokemon_species_id,local_language_id,name,genus
149,6,Dragoran,Drache
149,9,Dragonite,Dragon Pokémon
439,6,Pantimimi,}
439,9,Mime Jr.,Mime Pokémon
122,6,Pantimos,Pantomime
122,9,Mr. Mime,Barrier Pokémon
887,6,Katapuldra,
887,9,Dragapult,Stealth Pokémon
714,6,UHaFnir,
714,9,Noibat,Sound Wave Pokémon
715,6,UHaFniR,
715,9,Noivern,Sound Wave Pokémon
29,6,Nidoran♀,
29,9,Nidoran♀,Poison Pin Pokémon
32,6,Nidoran♂,
32,9,Nidoran♂,Poison Pin Pokémon
"""

LANGUAGES = """id,identifier,official,iso639,iso3166,order
6,de,1,de,de,6
9,en,1,en,us,9
"""

FORM_SPECIES_NAMES = (
    SPECIES_NAMES
    + """248,6,Despotar,
248,9,Tyranitar,
386,6,Deoxys,
386,9,Deoxys,
479,6,Rotom,
479,9,Rotom,
641,6,Boreos,
641,9,Tornadus,
645,6,Demeteros,
645,9,Landorus,
720,6,Hoopa,
720,9,Hoopa,
1017,6,Ogerpon,
1017,9,Ogerpon,
"""
)

POKEMON_ROWS = """id,identifier,species_id,height,weight,base_experience,order,is_default
248,tyranitar,248,20,2020,270,342,1
386,deoxys-normal,386,17,608,270,514,1
479,rotom,479,3,3,154,587,1
641,tornadus-incarnate,641,15,630,261,764,1
645,landorus-incarnate,645,15,680,270,770,1
720,hoopa,720,5,90,270,820,1
10086,hoopa-unbound,720,65,4900,306,821,0
1017,ogerpon,1017,12,398,275,1101,1
10003,deoxys-speed,386,17,608,270,517,0
10008,rotom-heat,479,3,3,182,588,0
10009,rotom-wash,479,3,3,182,589,0
10012,rotom-mow,479,3,3,182,592,0
10019,tornadus-therian,641,14,630,290,765,0
10021,landorus-therian,645,13,680,300,771,0
10049,tyranitar-mega,248,25,2550,315,343,0
10273,ogerpon-wellspring-mask,1017,12,398,275,,0
10275,ogerpon-cornerstone-mask,1017,12,398,275,,0
"""

POKEMON_FORMS = """id,identifier,form_identifier,pokemon_id,introduced_in_version_group_id,is_default,is_battle_only,is_mega,form_order,order
386,deoxys-normal,normal,386,5,1,0,0,1,554
641,tornadus-incarnate,incarnate,641,11,1,0,0,1,847
645,landorus-incarnate,incarnate,645,11,1,0,0,1,853
10033,deoxys-speed,speed,10003,6,1,0,0,4,557
10058,rotom-heat,heat,10008,9,1,0,0,2,638
10059,rotom-wash,wash,10009,9,1,0,0,3,639
10062,rotom-mow,mow,10012,9,1,0,0,6,642
10079,tornadus-therian,therian,10019,14,1,0,0,2,848
10081,landorus-therian,therian,10021,14,1,0,0,2,854
10235,hoopa-unbound,unbound,10086,16,0,0,0,2,822
10149,tyranitar-mega,mega,10049,15,1,1,1,2,380
10442,ogerpon-wellspring-mask,wellspring-mask,10273,26,1,0,0,2,1430
10444,ogerpon-cornerstone-mask,cornerstone-mask,10275,26,1,0,0,4,1432
"""

POKEMON_FORM_NAMES = """pokemon_form_id,local_language_id,form_name,pokemon_name
386,6,Normalform,Deoxys
386,9,Normal Forme,Normal Deoxys
641,6,Inkarnationsform,Boreos
641,9,Incarnate Forme,Incarnate Tornadus
645,6,Inkarnationsform,Demeteros
645,9,Incarnate Forme,Incarnate Landorus
10033,6,Initiativeform,Deoxys (Initiative)
10033,9,Speed Forme,Speed Deoxys
10058,6,Hitze-Rotom,Hitze-Rotom
10058,9,Heat Rotom,Heat Rotom
10059,6,Wasch-Rotom,Wasch-Rotom
10059,9,Wash Rotom,Wash Rotom
10062,6,Schneid-Rotom,Schneid-Rotom
10062,9,Mow Rotom,Mow Rotom
10079,6,Tiergeistform,Boreos (Tiergeist)
10079,9,Therian Forme,Therian Tornadus
10081,6,Tiergeistform,Demeteros (Tiergeist)
10081,9,Therian Forme,Therian Landorus
10235,6,Entfesseltes Hoopa,Hoopa
10235,9,Unbound,Hoopa Unbound
10149,6,Mega-Form,Mega-Despotar
10149,9,Mega Tyranitar,Mega Tyranitar
10442,9,Wellspring Mask,Wellspring Mask Ogerpon
10444,9,Cornerstone Mask,Cornerstone Mask Ogerpon
"""


def test_build_translation_rows_maps_german_names_to_showdown_asset_ids():
    rows = build_translation_rows(SPECIES_NAMES, LANGUAGES)
    by_german = {row["german"]: row for row in rows}

    assert by_german["Katapuldra"]["english"] == "Dragapult"
    assert by_german["Katapuldra"]["asset_id"] == "dragapult"
    assert by_german["UHaFniR"]["asset_id"] == "noivern"
    assert by_german["Pantimos"]["asset_id"] == "mrmime"
    assert by_german["Nidoran♀"]["asset_id"] == "nidoranf"
    assert by_german["Nidoran♂"]["asset_id"] == "nidoranm"


def test_pokemon_display_name_corrects_known_source_typos():
    assert pokemon_display_name("Meistergrif") == "Meistagrif"
    assert pokemon_display_name("Drifzepli") == "Drifzepeli"
    assert pokemon_display_name("Schwallbos") == "Schwalboss"
    assert pokemon_display_name("Shnurgast") == "Shnurgarst"
    assert pokemon_display_name("Keldeo") == "Keldeo"


def test_build_translation_rows_adds_gpl_form_and_typo_aliases():
    species_names = """pokemon_species_id,local_language_id,name,genus
68,6,Machomei,
68,9,Machamp,
277,6,Schwalboss,
277,9,Swellow,
426,6,Drifzepeli,
426,9,Drifblim,
432,6,Shnurgarst,
432,9,Purugly,
534,6,Meistagrif,
534,9,Conkeldurr,
555,6,Flampivian,
555,9,Darmanitan,
647,6,Keldeo,
647,9,Keldeo,
678,6,Psiaugon,
678,9,Meowstic,
718,6,Zygarde,
718,9,Zygarde,
745,6,Wolwerock,
745,9,Lycanroc,
773,6,Amigento,
773,9,Silvally,
849,6,Riffex,
849,9,Toxtricity,
876,6,Servol,
876,9,Indeedee,
879,6,Patinaraja,
879,9,Copperajah,
905,6,Cupidos,
905,9,Enamorus,
"""
    pokemon_rows = """id,identifier,species_id,height,weight,base_experience,order,is_default
68,machamp,68,16,1300,227,100,1
277,swellow,277,7,198,159,300,1
426,drifblim,426,12,150,174,500,1
432,purugly,432,10,438,158,510,1
534,conkeldurr,534,14,870,227,620,1
555,darmanitan-standard,555,13,929,168,650,1
647,keldeo-ordinary,647,14,485,261,750,1
678,meowstic-male,678,6,85,163,790,1
718,zygarde-50,718,50,3050,300,850,1
745,lycanroc-midday,745,8,250,170,880,1
773,silvally-normal,773,23,1005,285,910,1
849,toxtricity-amped,849,16,400,176,980,1
876,indeedee-male,876,9,280,166,1010,1
10074,meowstic-female,678,6,85,163,791,0
10152,lycanroc-dusk,745,8,250,170,881,0
10190,indeedee-female,876,9,280,166,1011,0
10226,copperajah-gmax,879,230,10000,187,1030,0
10249,enamorus-therian,905,16,480,290,1100,0
"""
    pokemon_forms = """id,identifier,form_identifier,pokemon_id,introduced_in_version_group_id,is_default,is_battle_only,is_mega,form_order,order
555,darmanitan-standard,standard,555,11,1,0,0,1,650
647,keldeo-ordinary,ordinary,647,15,1,0,0,1,750
678,meowstic-male,male,678,15,1,0,0,1,790
718,zygarde-50,50,718,16,1,0,0,1,850
745,lycanroc-midday,midday,745,17,1,0,0,1,880
773,silvally-normal,normal,773,17,1,0,0,1,910
849,toxtricity-amped,amped,849,20,1,0,0,1,980
876,indeedee-male,male,876,20,1,0,0,1,1010
10123,meowstic-female,female,10074,15,0,0,0,2,791
10210,lycanroc-dusk,dusk,10152,17,0,0,0,3,881
10370,indeedee-female,female,10190,20,0,0,0,2,1011
10396,copperajah-gmax,gmax,10226,20,0,0,0,2,1030
10492,enamorus-therian,therian,10249,26,0,0,0,2,1100
"""
    form_names = """pokemon_form_id,local_language_id,form_name,pokemon_name
647,6,Standardform,Keldeo
647,9,Ordinary Form,Keldeo
"""

    rows = build_translation_rows(species_names, LANGUAGES, pokemon_rows, pokemon_forms, form_names)
    by_german = {row["german"]: row for row in rows}
    by_key = {name_key(row["german"]): row for row in rows}

    assert by_german["Cupidos-Therian"]["asset_id"] == "enamorustherian"
    assert by_german["Keldeo"]["asset_id"] == "keldeo"
    assert by_german["Amigento-Normal"]["asset_id"] == "silvally"
    assert by_german["Flampivian"]["asset_id"] == "darmanitan"
    assert by_german["Giga-Patinaraja"]["asset_id"] == "copperajahgmax"
    assert by_german["Riffex-Hoch"]["asset_id"] == "toxtricity"
    assert by_german["Wolwerock-Dämmerungsform"]["asset_id"] == "lycanrocdusk"
    assert by_german["Wolwerock-Tag"]["asset_id"] == "lycanroc"
    assert by_key[name_key("Zygarde-50%")]["asset_id"] == "zygarde"
    assert by_german["Psiaugon (männlich)"]["asset_id"] == "meowstic"
    assert by_german["Servol-w"]["asset_id"] == "indeedeef"
    assert by_german["Meistergrif"]["asset_id"] == "conkeldurr"
    assert by_german["Drifzepli"]["asset_id"] == "drifblim"
    assert by_german["Schwallbos"]["asset_id"] == "swellow"
    assert by_german["Shnurgast"]["asset_id"] == "purugly"


def test_build_translation_rows_maps_german_form_aliases_to_showdown_asset_ids():
    rows = build_translation_rows(
        FORM_SPECIES_NAMES,
        LANGUAGES,
        POKEMON_ROWS,
        POKEMON_FORMS,
        POKEMON_FORM_NAMES,
    )
    by_german = {row["german"]: row for row in rows}

    assert by_german["Ogerpon-Gestein"]["asset_id"] == "ogerponcornerstone"
    assert by_german["Ogerpon-Wasser"]["asset_id"] == "ogerponwellspring"
    assert by_german["Demeteros-T"]["asset_id"] == "landorustherian"
    assert by_german["Demeteros-I"]["asset_id"] == "landorus"
    assert by_german["Mega-Despotar"]["asset_id"] == "tyranitarmega"
    assert by_german["Rotom (Hitze-Form)"]["asset_id"] == "rotomheat"
    assert by_german["Rotom-Schneide"]["asset_id"] == "rotommow"
    assert by_german["Boreos-Tiergeistform"]["asset_id"] == "tornadustherian"
    assert by_german["Deoxys-Geschwindigkeit"]["asset_id"] == "deoxysspeed"
    assert by_german["Hoopa-Entfesselt"]["asset_id"] == "hoopaunbound"


def test_js_module_keeps_base_species_aliases_when_forms_share_the_same_name(tmp_path):
    rows = [
        {"species_id": "487", "german": "Giratina", "english": "Giratina", "asset_id": "giratina"},
        {"species_id": "487", "german": "Giratina", "english": "giratina-altered", "asset_id": "giratinaaltered"},
        {"species_id": "493", "german": "Arceus", "english": "Arceus", "asset_id": "arceus"},
        {"species_id": "493", "german": "Arceus", "english": "arceus-unknown", "asset_id": "arceusunknown"},
        {"species_id": "746", "german": "Lusardin", "english": "Wishiwashi", "asset_id": "wishiwashi"},
        {"species_id": "746", "german": "Lusardin", "english": "wishiwashi-solo", "asset_id": "wishiwashisolo"},
        {"species_id": "487", "german": "Giratina-Urform", "english": "giratina-origin", "asset_id": "giratinaorigin"},
    ]
    csv_path = tmp_path / "pokemon_name_translations.csv"
    js_path = tmp_path / "pokemon_names.js"

    write_translation_outputs(rows, csv_path, js_path, source_url=SOURCE_URLS)
    js = js_path.read_text(encoding="utf-8")

    assert '"arceus": "arceus"' in js
    assert '"giratina": "giratina"' in js
    assert '"lusardin": "wishiwashi"' in js
    assert '"giratinaurform": "giratinaorigin"' in js


def test_pokemon_display_name_canonicalizes_form_aliases_for_stats_merging():
    assert pokemon_display_name("Demeteros") == "Demeteros-I"
    assert pokemon_display_name("Demeteros-Inkarnationsform") == "Demeteros-I"
    assert pokemon_display_name("Demeteros-Tiergeistform") == "Demeteros-T"
    assert pokemon_display_name("Boreos-Therian") == "Boreos-T"
    assert pokemon_display_name("Voltolos-Therian") == "Voltolos-T"
    assert pokemon_display_name("Kyurem-Black") == "Kyurem-Schwarz"
    assert pokemon_display_name("Kyurem-Schwarz") == "Kyurem-Schwarz"
    assert pokemon_display_name("Rotom-Wash") == "Rotom-Wasch"
    assert pokemon_display_name("Rotom (Wasch-Form)") == "Rotom-Wasch"
    assert pokemon_display_name("Galoppa") == "Gallopa"
    assert pokemon_display_name("Wolwerock") == "Wolwerock-Tagform"
    assert pokemon_display_name("Wolwerock-Tag") == "Wolwerock-Tagform"
    assert pokemon_display_name("Porygon-2") == "Porygon2"
    assert pokemon_display_name("Zygarde") == "Zygarde-50"
    assert pokemon_display_name("Hoopa-Entfesseltes Hoopa") == "Hoopa-Entfesselt"
    assert pokemon_display_name("hoopa entfesseltes hoopa") == "Hoopa-Entfesselt"


def test_write_translation_outputs_writes_review_csv_and_frontend_module(tmp_path):
    csv_path = tmp_path / "pokemon_name_translations.csv"
    js_path = tmp_path / "pokemon_names.js"

    write_translation_outputs(
        [
            {"species_id": "887", "german": "Katapuldra", "english": "Dragapult", "asset_id": "dragapult"},
            {"species_id": "122", "german": "Pantimos", "english": "Mr. Mime", "asset_id": "mrmime"},
        ],
        csv_path,
        js_path,
        source_url="https://example.test/pokemon_species_names.csv",
    )

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        csv_rows = list(csv.DictReader(handle))

    assert csv_rows[0] == {
        "species_id": "887",
        "german": "Katapuldra",
        "english": "Dragapult",
        "asset_id": "dragapult",
        "source_url": "https://example.test/pokemon_species_names.csv",
    }
    text = js_path.read_text(encoding="utf-8")
    assert '"german": "Katapuldra"' in text
    assert '"katapuldra": "dragapult"' in text
    assert '"mrmime": "mrmime"' in text


def test_write_translation_outputs_preserves_pokeapi_source_urls_by_default(tmp_path):
    csv_path = tmp_path / "pokemon_name_translations.csv"
    js_path = tmp_path / "pokemon_names.js"

    write_translation_outputs(
        [{"species_id": "714", "german": "UHaFnir", "english": "Noibat", "asset_id": "noibat"}],
        csv_path,
        js_path,
    )

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        [row] = list(csv.DictReader(handle))

    assert row["source_url"] == SOURCE_URLS
