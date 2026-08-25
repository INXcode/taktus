# Verzeichnis von Verarbeitungstätigkeiten — Muster

> Muster nach Art. 30 DSGVO für Betreiber einer Taktus-Kontor-Instanz.
> Datenmodell: [datenmodell.md](datenmodell.md) · Fristen und Löschung:
> [loeschkonzept.md](loeschkonzept.md) · Zugriffe: [rls-matrix.md](rls-matrix.md)
> · Maßnahmen: [tom.md](tom.md)

## Was dieses Dokument ist — und was nicht

**Es ist:** eine ausgefüllte Vorlage. Alles, was sich aus der Software selbst
ergibt — Datenkategorien, Zwecke, Fristen, technische Maßnahmen — steht hier
bereits. Diese Angaben sind aus dem Schema abgeleitet und lassen sich gegen den
Code prüfen; jedes genannte Feld existiert.

**Es ist nicht:** das Verzeichnis eines konkreten Betreibers. Wer eine Instanz
betreibt, ist selbst Verantwortlicher im Sinne der DSGVO und muss dieses Muster
um die Angaben ergänzen, die nur er kennt. Sie sind unten als **`[auszufüllen]`**
gekennzeichnet.

**Es ist keine Rechtsberatung.** Ob die Rechtsgrundlagen tragen und die Fristen
angemessen sind, entscheidet der Verantwortliche — gegebenenfalls mit fachlicher
Unterstützung.

> [!important] Wenn die Software erweitert wird, veraltet dieses Dokument
> Kommt ein Feld mit Personenbezug hinzu, gehört es hier hinein. Die
> Beitragsregeln verlangen bei jedem neuen Feld ohnehin eine Zeile in
> [datenmodell.md](datenmodell.md) mit Zweckangabe — diese Zeile ist die
> Vorlage für den Eintrag hier.

---

## 1. Verantwortlicher und Kontakte

| Angabe                                        | Wert            |
| --------------------------------------------- | --------------- |
| Verantwortlicher (Name, Anschrift)            | `[auszufüllen]` |
| Vertreter des Verantwortlichen, falls benannt | `[auszufüllen]` |
| Datenschutzbeauftragter, falls benannt        | `[auszufüllen]` |
| Kontakt für Betroffenenanfragen               | `[auszufüllen]` |
| Stand des Verzeichnisses                      | `[auszufüllen]` |

> [!note] Mandant ist nicht gleich Verantwortlicher
> Eine Instanz trägt mehrere **Mandanten** (`tenants`). Ob jeder Mandant ein
> eigener Verantwortlicher ist oder ob der Betreiber für alle verantwortlich
> zeichnet, hängt davon ab, wer über Zwecke und Mittel entscheidet — und nicht
> davon, wie die Datenbank aufgebaut ist. Betreibt ein Unternehmen die Instanz
> für Dritte, ist in der Regel ein Auftragsverarbeitungsverhältnis zu prüfen;
> siehe [avv-hinweise.md](avv-hinweise.md).

---

## 2. Verarbeitungstätigkeiten

Sechs Tätigkeiten. Sie decken alles ab, was die Anwendung tut.

### 2.1 Nutzerkonten und Zugriffsverwaltung

| Feld                           | Angabe                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zweck**                      | Anmeldung, Rechtezuweisung, Zuordnung von Vorgängen zu handelnden Personen                                                                                                          |
| **Rechtsgrundlage**            | `[auszufüllen]` — regelmäßig Art. 6 Abs. 1 lit. b (Vertrag) bzw. § 26 BDSG (Beschäftigtenverhältnis)                                                                                |
| **Betroffene Personen**        | Nutzer der Instanz: Verwaltung (`admin`), Bearbeitung (`agent`), Meldende (`requester`)                                                                                             |
| **Datenkategorien**            | E-Mail-Adresse und Passwort-Hash (in `auth.users`); Anzeigename, Rolle, Mandantenzuordnung, Kundenzuordnung bei Meldenden, Zeitpunkt der Deaktivierung (in `profiles`)              |
| **Ausdrücklich nicht erhoben** | Keine Kopie der E-Mail-Adresse im Anwendungsschema; keine Anschrift, keine Rufnummer, keine Personalnummer                                                                          |
| **Empfänger**                  | Keine außerhalb der Instanz                                                                                                                                                         |
| **Löschung**                   | Anzeigename wird durch `Anonymisierter Nutzer` ersetzt und der Protokollbezug gelöst (`anonymize_profile`). Die Löschung in `auth.users` erfolgt **organisatorisch beim Betreiber** |
| **Maßnahmen**                  | Row Level Security auf `profiles`; Passwortrichtlinie 12 Zeichen; TOTP-MFA vorbereitet; sofortiger Zugriffsentzug über `deactivated_at` ohne Datenverlust                           |

### 2.2 Vorgangsbearbeitung (Tickets und Beiträge)

| Feld                           | Angabe                                                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zweck**                      | Erfassung, Zuordnung und Bearbeitung von Vorgängen für einen Kunden des Mandanten                                                                                    |
| **Rechtsgrundlage**            | `[auszufüllen]` — regelmäßig Art. 6 Abs. 1 lit. b oder lit. f                                                                                                        |
| **Betroffene Personen**        | Meldende und Bearbeitende; **mittelbar Dritte**, die im Freitext genannt werden                                                                                      |
| **Datenkategorien**            | Titel und Beschreibung (Freitext), Status, Kategorie, Kunde, Urheber, Zuständigkeit, Zeitstempel; Beiträge mit Freitext und Urheber                                  |
| **Ausdrücklich nicht erhoben** | Keine Kontaktdaten am Vorgang: keine Anschrift, keine Rufnummer, kein Ansprechpartnerfeld. Keine Priorität, kein Fälligkeitsdatum                                    |
| **Empfänger**                  | Innerhalb des Mandanten. Ist die KI freigegeben, zusätzlich der KI-Anbieter — eigene Tätigkeit, siehe 2.5                                                            |
| **Löschung**                   | `tenants.ticket_retention_days` ab `tickets.closed_at`, Vorgabe **730 Tage**. Beiträge und Zeitbuchungen verschwinden mit dem Vorgang (`ON DELETE CASCADE`)          |
| **Maßnahmen**                  | Mandantentrennung über `tenant_id` in Postgres; Meldende sehen ausschließlich selbst gemeldete Vorgänge; zusammengesetzter Fremdschlüssel `(tenant_id, customer_id)` |

> [!warning] Der Freitext ist die eigentliche Datenschutzfrage dieser Tätigkeit
> `title`, `description` und `body` sind offene Felder. Menschen schreiben darin
> Namen von Kolleginnen, Gesundheitsangaben („fällt bis Freitag aus"),
> Leistungsbewertungen. Kein Schema verhindert das.
>
> Zwei Folgen, die in ein Verzeichnis gehören: Die Anonymisierung eines Profils
> **erfasst diese Felder nicht** (siehe [loeschkonzept.md](loeschkonzept.md)).
> Und ein Auskunftsersuchen nach Art. 15 durch eine im Freitext genannte Person
> lässt sich maschinell nicht vollständig beantworten. Wer eine Instanz
> betreibt, weist seine Nutzer darauf hin.

### 2.3 Zeiterfassung

| Feld                           | Angabe                                                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zweck**                      | Erfassung des Aufwands je Vorgang; Grundlage einer späteren Abrechnung gegenüber dem Kunden                                                                                                         |
| **Rechtsgrundlage**            | `[auszufüllen]` — bei Beschäftigten regelmäßig § 26 BDSG                                                                                                                                            |
| **Betroffene Personen**        | Bearbeitende und Verwaltung. Meldende haben **keinen** Zugriff auf Zeitbuchungen                                                                                                                    |
| **Datenkategorien**            | Dauer in Minuten (1–1440), **Kalendertag**, Vorgangsbezug, buchende Person, kurze Erläuterung                                                                                                       |
| **Ausdrücklich nicht erhoben** | **Kein Start- und kein Endzeitpunkt.** Minutengenaue Zeitpunkte erlaubten die Rekonstruktion von Arbeitsbeginn, Pausenlage und Arbeitsende — das ist der Unterschied zwischen Aufwand und Kontrolle |
| **Empfänger**                  | Innerhalb des Mandanten                                                                                                                                                                             |
| **Löschung**                   | Mit dem zugehörigen Vorgang (`ON DELETE CASCADE`)                                                                                                                                                   |
| **Maßnahmen**                  | Row Level Security; die buchende Person ist nach dem Anlegen unveränderlich (Trigger) — niemand kann im fremden Namen buchen                                                                        |

> [!important] Zwei Punkte, die der Betreiber selbst prüfen muss
> **Mitbestimmung:** Auch ohne Zeitpunkte ist eine Zeiterfassung in Betrieben
> mit Betriebsrat regelmäßig mitbestimmungspflichtig (§ 87 Abs. 1 Nr. 6 BetrVG).
>
> **Aufbewahrung:** Zeitbuchungen hängen als `ON DELETE CASCADE` am Vorgang und
> verschwinden mit ihm nach 730 Tagen. Handels- oder steuerrechtliche
> Aufbewahrungspflichten können dem entgegenstehen. Die Frist ist je Mandant
> einstellbar; 730 Tage sind eine Vorgabe, keine Empfehlung.

### 2.4 Protokollierung von Zugriffen und Änderungen

| Feld                           | Angabe                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zweck**                      | Rechenschaftspflicht nach Art. 5 Abs. 2 DSGVO: nachvollziehen, wer wann was geändert und wer auf personenbezogene Daten zugegriffen hat        |
| **Rechtsgrundlage**            | Art. 6 Abs. 1 lit. c in Verbindung mit Art. 5 Abs. 2, Art. 32 DSGVO                                                                            |
| **Betroffene Personen**        | Alle Nutzer der Instanz                                                                                                                        |
| **Datenkategorien**            | Handelnde Person, Vorgangsart (etwa `ticket.update`), betroffener Datensatz, **Namen der geänderten Felder**, Zeitpunkt                        |
| **Ausdrücklich nicht erhoben** | **Keine Feldinhalte** — weder alte noch neue Werte. Keine IP-Adresse, kein User-Agent                                                          |
| **Empfänger**                  | Lesbar ausschließlich für die Verwaltung des jeweiligen Mandanten                                                                              |
| **Löschung**                   | `tenants.audit_retention_days` ab `audit_log.occurred_at`, Vorgabe **365 Tage**                                                                |
| **Maßnahmen**                  | Nur anhängend — es gibt keine UPDATE- und keine DELETE-Policy. `actor_id` ohne Fremdschlüssel, damit der Eintrag die Anonymisierung überdauert |

> [!note] Warum das Protokoll keine Werte speichert
> Ein Protokoll mit Feldinhalten wäre eine zweite, typischerweise länger
> aufbewahrte Kopie aller personenbezogenen Daten — eine, die in keinem
> Löschkonzept auftaucht und bei jeder Auskunft vergessen wird. Der Preis: Aus
> dem Protokoll lässt sich nicht rekonstruieren, _was_ an einem Feld stand,
> sondern nur, _dass_ es geändert wurde.
>
> Zu prüfen ist die Frist in die andere Richtung: Ein Protokoll, das nach einem
> Jahr gelöscht wird, belegt nichts, was länger zurückliegt.

### 2.5 KI-gestützter Vorschlag beim Anlegen eines Vorgangs

> [!important] Diese Tätigkeit findet nur statt, wenn **zwei** Schalter stehen
> Der Betreiber hinterlegt einen Anbieter (`ai_config.enabled`), **und** der
> Mandant gibt die Verarbeitung frei (`tenants.ai_enabled`, Vorgabe `false`).
> Fehlt einer von beiden, verlässt kein Vorgangsinhalt die Instanz. Diese
> Tätigkeit ist dann ersatzlos zu streichen.

| Feld                            | Angabe                                                                                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zweck**                       | Vorschlag einer Zusammenfassung und einer Kategorie beim Anlegen eines Vorgangs                                                                                                                                                   |
| **Rechtsgrundlage**             | `[auszufüllen]` — Art. 6 Abs. 1 lit. f mit dokumentierter Abwägung, ggf. lit. a                                                                                                                                                   |
| **Betroffene Personen**         | Meldende; mittelbar im Freitext genannte Dritte                                                                                                                                                                                   |
| **Datenkategorien**             | Titel und Beschreibung des Vorgangs, **begrenzt auf `ai_config.max_input_chars`** (Vorgabe 8000 Zeichen). Keine Namen, keine Rollen, keine Kundenangaben                                                                          |
| **Empfänger**                   | `[auszufüllen]` — der gewählte Anbieter. Bei einem selbst betriebenen Modell (`openai_compatible`): keiner                                                                                                                        |
| **Drittlandbezug**              | `[auszufüllen]` — bei einem Anbieter außerhalb der EU sind Art. 44 ff. zu prüfen                                                                                                                                                  |
| **Aufbewahrung beim Empfänger** | `[auszufüllen]` — aus dem Auftragsverarbeitungsvertrag zu übernehmen                                                                                                                                                              |
| **Löschung in der Instanz**     | `ai_summary` verschwindet mit dem Vorgang                                                                                                                                                                                         |
| **Maßnahmen**                   | Vorgabe `false` je Mandant; Zeichenbegrenzung vor der Übermittlung; Herkunftsnachweis in `ai_model` und `ai_generated_at`; Vorschlag nie automatisch übernommen; Protokolleintrag `ai.suggest` nur bei tatsächlicher Übermittlung |

Die offene Abwägung zur Anbieterwahl steht in
[ki-abwaegung.md](ki-abwaegung.md). **Der Anbieter ist zum Stand dieses
Dokuments nicht gewählt** — vor einem Produktivbetrieb mit aktivierter KI ist er
zu wählen, ein Auftragsverarbeitungsvertrag zu schließen und dieser Abschnitt zu
vervollständigen.

> [!note] Keine automatisierte Entscheidung im Sinne des Art. 22
> Das Modell schlägt vor; ein Mensch übernimmt oder verwirft. Der Vorschlag ist
> in der Oberfläche als ungeprüft gekennzeichnet, bis jemand ihn speichert. Es
> entsteht keine rechtliche Wirkung und keine erhebliche Beeinträchtigung.

### 2.6 Betroffenenrechte: Auskunft und Datenübertragbarkeit

| Feld                    | Angabe                                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Zweck**               | Erfüllung von Art. 15 und Art. 20 DSGVO                                                                                                |
| **Rechtsgrundlage**     | Art. 6 Abs. 1 lit. c in Verbindung mit Art. 15, 20 DSGVO                                                                               |
| **Betroffene Personen** | Nutzer der Instanz                                                                                                                     |
| **Datenkategorien**     | Zusammenstellung der zu einer Person gespeicherten Daten aus Profil, Vorgängen, Beiträgen, Zeitbuchungen und Protokoll                 |
| **Empfänger**           | Die auskunftsberechtigte Person                                                                                                        |
| **Löschung**            | Der Export wird nicht gespeichert — er entsteht bei der Anfrage und wird ausgeliefert                                                  |
| **Maßnahmen**           | `export_person_data()` erzeugt die Auskunft maschinell; jeder Zugriff auf fremde Daten erzeugt einen Protokolleintrag `profile.export` |

Der Export enthält einen ausdrücklichen Hinweis darauf, dass die E-Mail-Adresse
in `auth.users` liegt und dort gesondert zu berücksichtigen ist.

---

## 3. Empfänger und Auftragsverarbeiter

| Empfänger                                         | Rolle               | Grundlage                                                 |
| ------------------------------------------------- | ------------------- | --------------------------------------------------------- |
| Hosting-Anbieter der Instanz                      | Auftragsverarbeiter | `[auszufüllen]` — AVV nach Art. 28                        |
| Betreiber der Supabase-Installation               | `[auszufüllen]`     | Entfällt beim Selbstbetrieb auf eigener Infrastruktur     |
| KI-Anbieter                                       | Auftragsverarbeiter | `[auszufüllen]` — entfällt ohne aktivierte KI             |
| E-Mail-Versand (Anmeldung, Passwortzurücksetzung) | Auftragsverarbeiter | `[auszufüllen]` — abhängig vom eingerichteten SMTP-Dienst |

**Keine weiteren Empfänger.** Die Anwendung überträgt nichts an Analyse-,
Werbe- oder Absturzberichtsdienste; es sind keine solchen Abhängigkeiten
enthalten. Nachprüfbar über die Content-Security-Policy und die
Abhängigkeitsliste.

## 4. Drittlandübermittlung

Ohne aktivierte KI und bei einem Hosting-Anbieter in der EU: **keine.**

Die Architektur ist ausdrücklich auf EU-inkorporierte Infrastruktur ausgelegt —
nicht nur auf eine EU-Region eines Anbieters aus einem Drittland. Die Begründung
steht in [architektur.md](architektur.md); sie betrifft den Unterschied zwischen
Datenresidenz und Datensouveränität.

Wer davon abweicht, ergänzt hier Empfänger, Land, Grundlage nach Art. 44 ff. und
die getroffenen Garantien.

## 5. Fristen im Überblick

| Daten                                     | Frist                           | Beginn                  | Vorgabe                             |
| ----------------------------------------- | ------------------------------- | ----------------------- | ----------------------------------- |
| Vorgänge samt Beiträgen und Zeitbuchungen | `tenants.ticket_retention_days` | `tickets.closed_at`     | **730 Tage**                        |
| Protokolleinträge                         | `tenants.audit_retention_days`  | `audit_log.occurred_at` | **365 Tage**                        |
| Nutzerprofile                             | Kein Automatismus               | Ausscheiden der Person  | Anonymisierung durch die Verwaltung |
| Kunden                                    | Keine Löschung                  | —                       | Stilllegung über `is_active`        |

**Ein offener Vorgang wird nie gelöscht.** Die Frist beginnt mit dem Abschluss,
nicht mit der Anlage — sonst verschwände ein unerledigter Vorgang wegen
Zeitablaufs.

Die Löschung ist ausgeführt, nicht nur vorgesehen: `purge_expired_data()` führt
`DELETE` aus. **Ihre regelmäßige Ausführung ist eine Betriebsentscheidung** —
[loeschkonzept.md](loeschkonzept.md) beschreibt die Einplanung.

## 6. Technische und organisatorische Maßnahmen

Siehe [tom.md](tom.md). Die dort genannten Maßnahmen gelten für alle sechs
Tätigkeiten; tätigkeitsspezifische Ergänzungen stehen jeweils oben.

---

## Was der Betreiber ergänzen muss — Kurzliste

- [ ] Verantwortlicher, Vertreter, Datenschutzbeauftragter, Kontaktweg (Abschnitt 1)
- [ ] Rechtsgrundlage je Tätigkeit (2.1 bis 2.3, 2.5)
- [ ] Hosting-Anbieter und AVV (Abschnitt 3)
- [ ] SMTP-Dienst und AVV (Abschnitt 3)
- [ ] KI-Anbieter, AVV, Drittlandbezug — oder Streichung von 2.5 (Abschnitt 3 und 4)
- [ ] Aufbewahrungsfristen fachlich bestätigen, insbesondere für Zeitbuchungen (Abschnitt 5)
- [ ] Mitbestimmung zur Zeiterfassung geklärt (2.3)
- [ ] Hinweis an die Nutzer zum Umgang mit Freitextfeldern (2.2)
