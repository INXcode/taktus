<!--
SPDX-FileCopyrightText: 2026 INX Systems
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Beiträge zu Taktus Kontor

Danke für dein Interesse. Bevor du Zeit investierst, lies bitte die beiden
Abschnitte zur Lizenz und zum Funktionsumfang — sie entscheiden darüber, ob ein
Beitrag überhaupt aufgenommen werden kann.

## Contributor License Agreement — verpflichtend

Beiträge werden **nur nach Zustimmung zum [Contributor License Agreement](CLA.md)**
aufgenommen. Ein Developer Certificate of Origin genügt hier nicht.

Der Grund ist wirtschaftlich, nicht bürokratisch: INX Systems lizenziert diese
Software auf Anfrage auch kommerziell. Das ist nur möglich, solange die Rechte
an allen Bestandteilen in einer Hand liegen. Ein DCO belässt das Urheberrecht
beim Beitragenden — mit dem ersten zusammengeführten Beitrag entfiele die
Doppellizenzierung dauerhaft.

Grundlage ist die **Fiduciary License Agreement 2.0** der Free Software
Foundation Europe. Sie ist keine Abtretung ins Blaue hinein: Ziffer 4
verpflichtet uns, jeden Beitrag ausschließlich unter Lizenzen weiterzugeben,
die die Free Software Foundation als freie und die Open Source Initiative als
quelloffene Lizenzen einstuft. Ziffer 2.3 räumt dir dieselben Rechte an deinem
Beitrag zurück ein, die du uns einräumst. Urheberpersönlichkeitsrechte bleiben
ohnehin bei dir.

### So stimmst du zu

Lies [CLA.md](CLA.md) und antworte im Pull Request mit genau diesem Satz:

> Ich habe den CLA gelesen und stimme ihm zu.

Auf Englisch geht ebenso:

> I have read the CLA and I hereby accept it.

Schreib den Satz als eigene Zeile, nicht als Zitat — eine zitierte Zeile zählt
bewusst nicht, sonst wäre schon eine Rückfrage mit zitierter Anleitung eine
Zustimmung.

Die Prüfung `CLA` läuft daraufhin erneut und wird grün. Sie ist eine
Pflichtprüfung — ohne sie lässt sich der Pull Request nicht zusammenführen.

**Wie der Nachweis geführt wird.** Dein Kommentar trägt Konto und Zeitstempel
und bleibt dauerhaft am Vorgang; das ist der Nachweis. Zusätzlich kann die
Verwaltung dich in `.github/cla-signatures.json` vermerken — dann entfällt der
Kommentar bei späteren Beiträgen. Ändert sich der CLA-Text inhaltlich, wird die
Fassung heraufgesetzt und die Zustimmung erneut eingeholt.

Der Ablauf ist in [.github/workflows/cla.yml](.github/workflows/cla.yml) und
[scripts/cla-signatures.mjs](scripts/cla-signatures.mjs) nachlesbar. Der
Workflow schreibt bewusst nichts in das Repository — die Begründung steht im
Kopf beider Dateien.

Fragen zur Rechtelage: **kontakt@inxsystems.de**

## Was aufgenommen wird — und was nicht

Der Funktionsumfang von Release 1 ist bewusst eng geschnitten, und die Regel
dahinter ist keine Sparsamkeit, sondern eine Richtungsentscheidung: **Tiefe in
der Architektur, nicht Breite im Funktionsumfang.**

Mehrmandantenfähigkeit, Row Level Security mit Testabdeckung, Audit-Log,
Löschkonzept und eine vollständige Prüfkette gehören dazu. Zusätzliche
Funktionen nicht — jede davon vergrößert die Fläche, für die all das
mitgeführt werden muss.

Gern gesehen:

- Fehlerkorrekturen
- Zusätzliche Tests, besonders für Row-Level-Security-Regeln
- Verbesserungen an Dokumentation und Übersetzungen
- Sicherheits- und Datenschutzbefunde (Meldeweg: [SECURITY.md](SECURITY.md))
- Härtung bestehender Funktionen

Vor größeren Änderungen bitte **erst ein Issue eröffnen.** Neue Funktionen ohne
vorherige Abstimmung werden in der Regel abgelehnt — nicht wegen der Qualität,
sondern weil jede zusätzliche Funktion die Veröffentlichung verzögert.

## Ablauf

1. Issue eröffnen und abstimmen (außer bei kleinen Korrekturen)
2. Branch von `main`: `feature/<thema>` oder `fix/<thema>`
3. Änderungen umsetzen, Definition of Done abarbeiten
4. **`pnpm verify`** — führt lokal aus, was die CI prüft: Geheimnisse in der
   Historie, Format, Lint, Typen, Unit-Tests, Semgrep, Lizenzen, pgTAP. Rund
   15 Sekunden, und der pre-push-Hook ruft es ohnehin auf. Ohne laufenden
   Supabase-Stack werden die Datenbankschritte übersprungen und benannt
5. Pull Request eröffnen, dem CLA zustimmen, CI grün bekommen

> [!note] Was `pnpm verify` nicht prüft
> Build, Bundle-Prüfung und die Playwright-Suite. Sie brauchen einen
> vollständigen Build und mehrere Minuten — ein Tor, das so lange aufhält,
> wird umgangen, und ein umgangenes Tor prüft nichts. Diese drei laufen in der
> CI am Pull Request.

## Definition of Done

Jeder Pull Request erfüllt diese Punkte. Die Checkliste steht auch in der
Pull-Request-Vorlage.

1. **`requireRole()` als erste Anweisung** jeder Server Action und jeder
   geschützten Seite
2. **Zod-Validierung serverseitig** vor jedem Datenbankzugriff, Fehlermeldungen
   auf Deutsch direkt im Schema
3. **Neue Tabelle → RLS aktiviert**, mindestens eine Policy je Verb und
   Zielgruppe, **pgTAP-Test im selben Pull Request**
4. **Neues Feld → Zeile in [docs/datenmodell.md](docs/datenmodell.md)** mit
   Zweckangabe. Ein Feld ohne begründbaren Zweck wird nicht aufgenommen
5. **Keine personenbezogenen Daten in Logs** — keine E-Mail-Adressen, Namen,
   Freitexte oder Token
6. **Neue Abhängigkeit → Lizenz geprüft** und Notwendigkeit im Pull Request
   begründet
7. `pnpm db:types` ausgeführt und das Ergebnis committet
8. Deutsche Oberflächentexte, englischer Code, englische Commit-Nachrichten
9. **Datenschutzrelevante Entscheidungen in der Dokumentation nachgezogen** —
   nicht nur im Code. Punkt 4 deckt nur den Fall „neues Feld" ab; gemeint ist
   auch: eine geänderte Aufbewahrungsfrist, ein neuer Empfänger, eine neue
   Stelle, an der der Admin-Client eingesetzt wird, ein neuer Eintrag im
   Protokollvokabular. Eine Entscheidung, die nur im Diff steht, ist beim
   nächsten Lesen keine Entscheidung mehr, sondern eine Eigenart

## Handwerkliche Regeln

Kurz, aber nicht verhandelbar. Die meisten setzt die CI durch; hier stehen sie,
damit man den Grund kennt und nicht erst den fehlgeschlagenen Lauf liest. Wo
keine Prüfung greift, steht es dabei.

- **TypeScript strict, keine `any`-Abkürzungen.** Auch kein `as unknown as`,
  kein `@ts-expect-error` ohne Begründung in derselben Zeile. Wo der
  Typgenerator falsch liegt — etwa bei `ticket_number`, das ein Trigger setzt —
  steht die Ausnahme eng begrenzt und mit Kommentar da, nicht als weiter
  Typ über die ganze Funktion.
- **pnpm ausschliesslich, `pnpm-lock.yaml` wird committet.** Die Version legt
  `packageManager` in der `package.json` fest, durchgesetzt über Corepack. Ein
  Pull Request mit `package-lock.json` oder `yarn.lock` löst dieselben
  Abhängigkeiten anders auf als die CI — und dann prüft die CI etwas anderes,
  als der Beitragende gebaut hat. Abhängigkeiten werden **exakt** gepinnt,
  ohne `^`.
- **Der Service-Role-Schlüssel gehört nie ins Client-Bundle.**
  `createAdminClient()` ist ausserhalb von `src/lib/**` und `src/actions/**`
  nicht zulässig; eine Semgrep-Regel und `pnpm bundle:check` erzwingen das.
  Wer ihn einsetzt, übernimmt die Autorisierung selbst — die Datenbank hilft
  ab dort nicht mehr, und die Mandantenprüfung steht ausgeschrieben daneben.
- **Kein `outline: none`.** Der Fokusring ist die Rückfallebene für alles, was
  die Muster nicht mitbringt. Wer ihn entfernt, entfernt ihn für Menschen, die
  die Anwendung nur mit der Tastatur bedienen. **Hierfür gibt es keine
  automatische Prüfung** — die Regel trägt allein die Durchsicht.

## Zwei Wörter, die nicht dasselbe meinen

| Begriff     | Tabelle     | Bedeutung                                                                    |
| ----------- | ----------- | ---------------------------------------------------------------------------- |
| **Mandant** | `tenants`   | Wer das Ticketsystem **betreibt**. Die Trennachse der gesamten Anwendung     |
| **Kunde**   | `customers` | Wer damit **verwaltet** wird. Für ihn laufen Vorgänge, und er rechnet sie ab |

Umgangssprachlich sind beide oft dasselbe; hier nie. Ein Ticket gehört zu genau
einem Kunden, ein Melder ebenfalls. Bearbeitung und Verwaltung hängen am
Mandanten und arbeiten quer über alle Kunden.

**Der Kunde ist keine Sicherheitsgrenze.** `customer_id` ist eine Zuordnung,
nicht `tenant_id` in klein — wer daraus einen Schutz ableitet, verlässt sich auf
etwas, das keine Policy gibt. Einzelheiten in
[docs/datenmodell.md](docs/datenmodell.md) und
[docs/rls-matrix.md](docs/rls-matrix.md).

## Row Level Security ist die Sicherheitsgrenze

Der wichtigste Grundsatz des Projekts: **RLS ohne Test ist eine Behauptung.**
Die Anwendungsschicht ist Komfort, nicht Absicherung.

### Policy-Konventionen

- Name nach dem Muster `<tabelle>_<verb>_<zielgruppe>`, etwa
  `tickets_select_agent`
- Immer `TO authenticated`, niemals `TO public`
- Ein Statement je Verb **und** je Zielgruppe — keine Sammel-Policies mit langen
  `OR`-Ketten
- `WITH CHECK` immer ausschreiben, auch wenn es `USING` entspricht
- Deutscher Kommentar über jeder Policy, der das **Warum** erklärt, nicht das Was
- Mandantenbezug ausschließlich über `(SELECT public.current_tenant_id())` —
  nie ein direkter Subselect auf `profiles` in der Policy

### Zwei Fallstricke, die fast jeder trifft

**Das Wrapping in `(SELECT …)` ist nicht kosmetisch.** Ein nacktes
`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() …)` wird von Postgres
**pro Zeile** ausgewertet. In `(SELECT …)` gewrappt entsteht ein InitPlan, der
einmal je Abfrage läuft. Bei größeren Tabellen ist das ein Unterschied um
Größenordnungen.

**Verweigerter Lesezugriff wirft keinen Fehler.** RLS filtert bei `SELECT`
stumm — die Abfrage gelingt und liefert null Zeilen. Beim Test heißt das:

| Fall                                            | Assertion                              |
| ----------------------------------------------- | -------------------------------------- |
| `SELECT` verweigert                             | `is_empty(...)`                        |
| `INSERT`/`UPDATE` gegen `WITH CHECK` verweigert | `throws_ok(..., '42501')`              |
| Zugriff erlaubt                                 | `results_eq(...)` bzw. `lives_ok(...)` |

Wer verweigerten Lesezugriff mit `throws_ok` prüft, schreibt einen Test, der
immer fehlschlägt — und wer ihn mit `lives_ok` prüft, einen, der nie etwas
findet.

## Commit-Nachrichten

Conventional Commits, auf Englisch, per commitlint erzwungen:

```
feat(tickets): add category filter to list view
fix(rls): restrict time entry updates to the owning user
docs(datenmodell): document purpose of closed_at
test(rls): cover cross-tenant comment access
chore(deps): update supabase-js to 2.104.0
```

Kleine, nachvollziehbare Commits. Die Historie wird öffentlich und ist Teil des
Eindrucks, den das Projekt hinterlässt.

## Abhängigkeiten

Die Lizenzregel dieses Projekts ist **lizenzgenau, nicht pauschal** — Taktus
steht selbst unter AGPL-3.0, deshalb ist Copyleft hier zulässig.

| Lizenz                                        | Status                                    |
| --------------------------------------------- | ----------------------------------------- |
| MIT, ISC, BSD, Apache-2.0, MPL-2.0            | zulässig                                  |
| GPL-3.0, AGPL-3.0, LGPL, GPL-2.0-**or-later** | zulässig                                  |
| **GPL-2.0-only**                              | **abgelehnt** — nicht AGPL-3.0-kompatibel |
| SSPL, BUSL, proprietär                        | abgelehnt                                 |
| Kein oder unklarer Bezeichner                 | **abgelehnt** — bricht den Build          |

`GPL-2.0-only` ist der Fallstrick: Copyleft, aber mit AGPL-3.0 unvereinbar. Die
Prüfung läuft in der CI über `pnpm licenses:check`. Unklare Fälle brechen den
Build, statt eine Warnung zu erzeugen, die niemand liest — die Freigabe erfolgt
dann einmalig durch einen Menschen und wird in `license-exceptions.json` an die
exakte Version gebunden dokumentiert.

## Testdaten

**Ausschließlich synthetische Daten.** Keine echten Namen, Adressen,
E-Mail-Adressen, Firmennamen oder Kundenbezüge — auch nicht in Kommentaren,
Migrationen oder Testfixtures.

Git löscht nichts: Was einmal committet wurde, bleibt in der Historie sichtbar,
wenn das Repository öffentlich geschaltet wird.
