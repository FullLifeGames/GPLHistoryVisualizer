# Navigation & Informationsarchitektur — Redesign

Datum: 2026-08-11
Status: abgesegnet (Brainstorming-Dialog, alle Abschnitte einzeln bestätigt)

## Problem

Die App ist auf 8 Nav-Gruppen mit 30 Haupt-Views (+6 Detail-Views) gewachsen. Vier bestätigte Symptome:

1. **Zuordnung unklar** — man weiß nicht, in welcher Gruppe ein View steckt (Zeitreise vs. Zeitstrahl vs. Zeitmaschine liegen in drei verschiedenen Gruppen und klingen gleich).
2. **Gruppen zu voll** — „Saisons & Kämpfe" hat 8 Tabs.
3. **Namen sagen nichts** — Orakel, Zeitmaschine, Spielbaum erklären sich nicht selbst.
4. **Kein Überblick übers Ganze** — es fehlt ein Ort, der zeigt, was die Seite alles kann.

## Rahmenentscheidungen (aus dem Dialog)

- Zielgruppe: **vor allem Besucher**; die Review-Werkzeuge sind Arbeitsgerät des Betreibers und dürfen in den Hintergrund.
- **Ewige Tabelle bleibt Startansicht** (keine neue Landing Page).
- Gewählter Ansatz: **A — Saison-Hub + Neuordnung** (kein Mega-Menü, keine globale Suche; Suche bleibt als möglicher späterer Ausbau).

## Zielstruktur

**6 sichtbare Gruppen, 17 sichtbare Tabs** (+ Werkstatt abgesetzt):

| Gruppe (de / en) | Tabs | Detail-Views |
| --- | --- | --- |
| **Bestenlisten** / Leaderboards (id `records`) | Ewige Tabelle (Start) · Kaderübersichten · Rekordbuch · Auszeichnungen · Hall of Fame · Upset-Index | person-details, roster-detail |
| **Saisons** / Seasons (id `seasons`) | Saison *(Hub)* · Chronik | — |
| **Duelle** / Head-to-Head (id `duels`) | Rivalitäten · Orakel · Zeitmaschine | rivalry-detail |
| **Pokémon** (id `pokemon`) | Killlisten · Drafts | pokemon-detail |
| **Videos** (id `videos`) | Video-Archiv · Kino-Modus · Highlightkämpfe · Publikum · Meilensteine | — |
| **Spiele** / Games (id `games`) | Übersicht + 5 Spiele | game |
| *Werkstatt* / Workshop (id `data`, `tool: true`) | Datenlage · Lückenübersicht · Kaderlücken · Einsatzlücken · Video-Review · Kampfvideo-Abdeckung · Review · Quellenclaims | — |

Umzüge gegenüber heute:

- Gruppe **`people` löst sich auf**: `all-time` → `records`, `team-rosters` → `records` (Kaderübersichten sind eine Bestenliste nach Kaderscore), `person-details` und `roster-detail` wandern als Detail-Views mit.
- `match-highlights` → `videos` (rankt Kämpfe nach Video-Aufmerksamkeit, gehört zur Video-Welt).
- Gruppenreihenfolge: records, seasons, duels, pokemon, videos, games, data.
- **Alle View-IDs und Gruppen-IDs bleiben unverändert** — nur Labels, Zuordnung und Reihenfolge ändern sich. Deep-Links (`#season-story`, `#/person/...`, `#data-coverage`, …) funktionieren unverändert; [web/router.js](../../web/router.js) braucht keine Änderung (Ausnahme: neue Route `#wegweiser`, s. u.).

## Saison-Hub

Ein Nav-Tab **„Saison"** in der Gruppe Saisons bündelt die sechs saisonbezogenen Views als Unter-Tabs:

**Akte · Spielplan · Spielbaum · Tabellenverlauf · Story · Wrapped**
(= `season-detail`, `match-plan`, `battle-history`, `table-history`, `season-story`, `season-wrapped`)

- Die sechs Views bleiben technisch eigenständig (eigene IDs, Sections, Renderer). Nur die Navigation fasst sie zusammen: Ist einer der sechs Views aktiv, ist der Hub-Tab aktiv und darunter erscheint eine zweite, kompaktere Tab-Zeile.
- **Gemeinsame Saisonwahl:** wie bisher über die globale Toolbar — die Saison bleibt beim Wechsel zwischen Unter-Tabs erhalten (Ist-Verhalten, wird nicht verändert, nur erlebbar gemacht).
- **Letzter Unter-Tab wird gemerkt:** Wer den Hub verlässt und zurückkommt, landet auf dem zuletzt offenen Unter-Tab (Session-State, kein localStorage nötig).
- Abbildung in [web/view_config.js](../../web/view_config.js) als **generisches `stacks`-Konzept**: eine Gruppe kann Tabs deklarieren, die einen Stapel mehrerer Views repräsentieren. Neue pure Helper (z. B. `stackForView(view)`, `stackViews(stackId)`, `isStackedView(view)`) — node-testbar.

## Umbenennungen

| Bisher | Neu (de / en) | i18n-Key |
| --- | --- | --- |
| Gruppe „Rekorde" / Records | **Bestenlisten** / Leaderboards | `navGroups.records` |
| Gruppe „Saisons & Kämpfe" / Seasons & Battles | **Saisons** / Seasons | `navGroups.seasons` |
| Zeitreise / Time Travel | **Chronik** / Chronicle | `nav.zeitreise` |
| Zeitstrahl / Timeline | **Meilensteine** / Milestones | `nav.zeitstrahl` |
| Gruppe „Daten & Review" / Data & Review | **Werkstatt** / Workshop | `navGroups.data` |
| Saisonakte (nur als Hub-Unter-Tab) | **Akte** / Overview | neuer Key für das Unter-Tab-Label; Section-Titel „Saisonakte" bleibt |

Section-Titel und -Beschreibungen der Views bleiben unverändert (die Zeitreise-Section darf „Chronik" übernehmen, damit Tab und Überschrift übereinstimmen — analog Zeitstrahl/Meilensteine). „Orakel", „Zeitmaschine", „Spielbaum", „Kino-Modus" behalten ihre Namen.

**Tab-Tooltips:** Jeder View-Tab (Haupt- und Unter-Tabs) erhält ein `title`-Attribut mit dem vorhandenen Einzeiler aus `sections.*Description` — kein neuer Text, nur Verdrahtung in der Nav-Logik von [web/app.js](../../web/app.js).

## Werkstatt

- Die Gruppe `data` bekommt in [web/view_config.js](../../web/view_config.js) das Flag `tool: true`.
- Ihr Gruppen-Tab bleibt in der Gruppenzeile, aber **rechtsbündig abgesetzt, kleiner und farblich gedämpft** (Label „Werkstatt" mit Werkzeug-Icon 🔧). CSS: eigener Modifier (z. B. `.nav-group-tab.is-tool` + `margin-left: auto`).
- Innerhalb der Werkstatt: unverändert die acht Tabs. Alle Deep-Links bleiben gültig.

## Wegweiser

Neue leichtgewichtige Übersichts-Ansicht **„Wegweiser"** / en **„Guide"** (View-ID `wegweiser`):

- **Zugang:** Link im Header neben dem Sprachumschalter, plus Deep-Link `#wegweiser`. Bewusst kein Gruppen-Tab — der Wegweiser steht über den Gruppen. Registrierung über eine neue Liste `STANDALONE_VIEWS = ["wegweiser"]` in `view_config.js`, die in `VALID_VIEW_IDS` einfließt; `viewGroupForView("wegweiser")` fällt auf die Standardgruppe zurück, die Gruppenzeile zeigt bei aktivem Wegweiser keine aktive Gruppe (Tab-Markierung wird unterdrückt).
- **Inhalt:** Kartenraster, gruppiert nach den sechs sichtbaren Gruppen; pro View eine Karte mit Titel (`sections.*Title` bzw. Nav-Label) und Einzeiler (`sections.*Description`); Klick navigiert zum View. Die Spiele-Gruppe verlinkt auf die Spiele-Übersicht (nicht fünf Einzelkarten). Der Hub erscheint als eine Karte „Saison" mit Nennung der sechs Kapitel.
- **Werkstatt:** ganz unten als kleine einzeilige Sektion (auffindbar, nicht prominent).
- **Kein zweiter Pflegeort:** Der Wegweiser rendert sich aus `VIEW_GROUPS` + i18n-Texten. Neue Views erscheinen automatisch, sobald sie registriert sind. Dafür braucht es eine Zuordnung View-ID → Section-Key (kleine Map oder Namenskonvention in app.js/i18n).

## Nicht im Scope

- Keine globale Suche/Befehlspalette (möglicher späterer Ausbau).
- Keine neue Landing Page; Start bleibt Ewige Tabelle.
- Keine Änderungen an Renderern, Datenflüssen oder Datensemantik der bestehenden Views.
- Keine URL-/Router-Migrationen außer der neuen Route `#wegweiser`.

## Tests & Gates

- [tests/web_view_config.test.mjs](../../tests/web_view_config.test.mjs): neue Gruppenzuschnitte, `stacks`-Helper (stackForView/stackViews/isStackedView), `tool`-Flag, `wegweiser` als gültiger View.
- [tests/web_shell.test.mjs](../../tests/web_shell.test.mjs): neue Tab-Struktur in index.html (Hub-Tab + Unter-Tab-Zeile, Werkstatt-Tab, Wegweiser-Link/-Section), Tooltip-Verdrahtung.
- i18n-Paritätstest erzwingt de/en für alle neuen/umbenannten Keys.
- Bestehende Gates bleiben grün: `node --test tests/*.mjs`, `python -m pytest -q`, `npm run validate`, `npm run check:generated`, `git diff --check`.
- Browser-Verifikation via Playwright: Gruppenwechsel, Hub-Unter-Tabs (Merken des letzten Unter-Tabs), Tooltips, Werkstatt-Zugang, Wegweiser-Karten, Sprachumschaltung.

## Doku

- README: Navigations-Absatz aktualisieren (Gruppen, Hub, Werkstatt, Wegweiser).
- `docs/known-limitations.md`: unverändert (keine Datensemantik betroffen).
