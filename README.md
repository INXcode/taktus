<!--
SPDX-FileCopyrightText: 2026 INX Systems
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Taktus Kontor

Ein schlanker Orchestrator für Kleinunternehmen: Ticketsystem, Zeiterfassung und
KI-Integration in einer Anwendung. Mehrmandantenfähig, mit Mandantentrennung auf
Datenbankebene.

> **Hinweis zum Entwicklungsstand:** Dieses Repository befindet sich im Aufbau.
> Release 1 ist noch nicht veröffentlicht.

## Warum es dieses Projekt gibt

Ticketsysteme gibt es genug. Was in dieser Größenklasse selten mitgeliefert wird,
ist eine Datenschutz- und Sicherheitsarchitektur, die einer fachlichen Prüfung
durch Dritte standhält — und die man **nachlesen** kann, statt sie geschildert
zu bekommen.

Der Anspruch ist deshalb bewusst asymmetrisch verteilt — **Tiefe in der
Architektur, nicht Breite im Funktionsumfang.** Mehrmandantenfähigkeit, Row Level
Security mit Testabdeckung, Audit-Log, Löschkonzept und eine vollständige
CI-Prüfkette gehören dazu. Zusätzliche Funktionen nicht.

Was das praktisch heißt: Jedes Feld im Datenmodell trägt eine Zweckbegründung,
jede Zugriffsregel einen Test gegen einen fremden Mandanten, und jede Prüfung in
[docs/security.md](docs/security.md) einen Verweis darauf, wo sie läuft. Was
nicht läuft, steht dort getrennt und als solches gekennzeichnet.

## Funktionsumfang Release 1

- **Ticketsystem** — Erfassung, Zuordnung, Status, Kommentare
- **Kunden** — jeder Vorgang gehört zu genau einem Kunden des Mandanten. Der
  **Mandant** betreibt das System, der **Kunde** wird damit verwaltet; die
  Unterscheidung steht in [docs/datenmodell.md](docs/datenmodell.md). Ein Kunde
  trägt einen Namen und ein Aktiv-Kennzeichen, sonst nichts — Stammdaten wären
  erst mit einer Rechnungsstellung zu begründen
- **Zeiterfassung** — Zeitbuchung auf Tickets, Auswertung
- **KI-Integration** — Zusammenfassung und Kategorisierung beim Anlegen eines
  Tickets. Modellausgaben sind stets als Vorschlag gekennzeichnet und werden nie
  automatisch übernommen. Die Freigabe braucht **zwei** Zustimmungen: die des
  Betreibers und die des Mandanten. Ausgeliefert wird ein Anbieter, der nichts
  überträgt — die Anbieterwahl ist offen, siehe
  [docs/ki-abwaegung.md](docs/ki-abwaegung.md).
- **Mandantenfähigkeit** — eine Instanz, mehrere Mandanten, Trennung über Row
  Level Security in Postgres

Ausdrücklich **nicht** in Release 1: Schnittstellen zu Rechnungsprogramm oder
Steuerberater, Ticket-Anhänge, ticketfreie Zeitbuchungen, SSO.

## Technischer Aufbau

| Baustein     | Wahl                                             |
| ------------ | ------------------------------------------------ |
| Framework    | Next.js (App Router), React, TypeScript strict   |
| Datenbank    | Supabase — Postgres mit Row Level Security, Auth |
| Paketmanager | pnpm, Version über Corepack festgelegt           |
| Styling      | Tailwind CSS                                     |
| Tests        | Vitest (Unit), pgTAP (RLS), Playwright (E2E)     |
| CI           | GitHub Actions                                   |

**Betriebsmodell: Supabase self-hosted auf EU-inkorporierter Infrastruktur.**
Das ist keine Betriebsgewohnheit, sondern eine begründete Entscheidung — die
Wahl einer EU-Region bei einem US-Anbieter löst die Datenresidenz, nicht die
Datensouveränität. Die vollständige Begründung steht in
[docs/architektur.md](docs/architektur.md).

## Dokumentation

| Dokument                                                             | Inhalt                                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| [docs/security.md](docs/security.md)                                 | Risikomatrix, Werkzeugkette, und was Werkzeuge _nicht_ leisten |
| [docs/architektur.md](docs/architektur.md)                           | Aufbau und Souveränitätsentscheidung                           |
| [docs/datenmodell.md](docs/datenmodell.md)                           | Jedes Feld mit Zweckbegründung                                 |
| [docs/rls-matrix.md](docs/rls-matrix.md)                             | Zugriffsmatrix, 1:1 zu den pgTAP-Tests                         |
| [docs/loeschkonzept.md](docs/loeschkonzept.md)                       | Löschfristen und deren Umsetzung                               |
| [docs/verarbeitungsverzeichnis.md](docs/verarbeitungsverzeichnis.md) | Muster nach Art. 30 DSGVO für Betreiber                        |
| [docs/tom.md](docs/tom.md)                                           | Technische und organisatorische Maßnahmen, Art. 32             |
| [docs/avv-hinweise.md](docs/avv-hinweise.md)                         | Auftragsverarbeitung: Rollen, Unterauftragnehmer, Grenzen      |
| [docs/ki-abwaegung.md](docs/ki-abwaegung.md)                         | Anbieterwahl beim Sprachmodell — Abwägung, offen               |
| [docs/betrieb.md](docs/betrieb.md)                                   | Lokale Entwicklung, Ports, Restore-Test                        |
| [SECURITY.md](SECURITY.md)                                           | Meldeweg für Sicherheitslücken                                 |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                   | Beitragsregeln, CLA-Pflicht, Definition of Done                |
| [CLA.md](CLA.md)                                                     | Contributor License Agreement, Wortlaut                        |

## Lokale Entwicklung

Voraussetzungen: Node 24 (aktives LTS), Corepack, Docker, Supabase CLI.

```bash
pnpm install
cp .env.example .env.local   # Werte aus `pnpm db:start` eintragen
pnpm db:start                # lokaler Supabase-Stack
pnpm dev                     # http://localhost:3100
```

Der lokale Stack belegt einen eigenen Portblock (**44420–44429**, Anwendung auf
**3100**) statt der Supabase-Standardports. Das ist Absicht: Wer mehrere
Supabase-Projekte auf einem Rechner hält, bekommt sonst Kollisionen, und die
Standardports liegen zudem ungünstig zur Ephemeral-Range von macOS. Einzelheiten
und die dabei zu vermeidenden Befehle stehen in
[docs/betrieb.md](docs/betrieb.md).

```bash
pnpm db:test          # pgTAP: Row-Level-Security-Regeln
pnpm test             # Vitest
pnpm test:e2e         # Playwright: Sitzung, Wächter, Mandantentrennung
pnpm typecheck        # tsc --noEmit
pnpm semgrep          # eigene Regeln plus OWASP, React, TypeScript, Secrets
pnpm bundle:check     # durchsucht das gebaute Bundle nach Schlüsselmustern
pnpm licenses:check   # Lizenzkompatibilität der Abhängigkeiten
```

`pnpm test:e2e` braucht den laufenden Supabase-Stack mit eingespieltem Seed und
startet den Entwicklungsserver selbst, falls keiner läuft. Beim ersten Lauf
lädt Playwright einmalig Chromium:

```bash
pnpm exec playwright install chromium
```

Die Suite **schreibt nichts** — sie meldet sich an, navigiert und liest. Damit
lässt sie sich beliebig oft gegen denselben Seed-Stand laufen.

## Lizenz

**AGPL-3.0-or-later** — siehe [LICENSE](LICENSE).

Kommerzielle Nutzung ist erlaubt. Wer den Code verändert und verbreitet **oder
über ein Netzwerk anbietet**, muss die Veränderungen unter denselben Bedingungen
offenlegen (§13 AGPL).

**Abweichende kommerzielle Lizenzierung ist auf Anfrage möglich.** INX Systems
ist alleiniger Rechteinhaber und an die eigene Lizenz nicht gebunden. Beiträge
Dritter setzen deshalb die Zustimmung zum [Contributor License Agreement](CLA.md)
voraus — wie sie erteilt wird, steht in [CONTRIBUTING.md](CONTRIBUTING.md).

Die Lizenzen aller Abhängigkeiten werden in der CI maschinell gegen eine
Positivliste geprüft; unklare Angaben brechen den Build, statt eine Warnung zu
erzeugen. Zu jedem Release gehört eine SPDX-Stückliste über die vollständige
transitive Abhängigkeitskette.

---

Ein Projekt von [INX Systems](https://inx.systems).
