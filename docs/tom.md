# Technische und organisatorische Maßnahmen — Muster

> Muster nach Art. 32 DSGVO für Betreiber einer Taktus-Kontor-Instanz.
> Verarbeitungstätigkeiten: [verarbeitungsverzeichnis.md](verarbeitungsverzeichnis.md)
> · Risikomatrix: [security.md](security.md) · Zugriffe: [rls-matrix.md](rls-matrix.md)

## Die Regel für dieses Dokument

**Es steht nur drin, was im Code oder in der CI belegbar ist.** Jede Maßnahme
nennt die Stelle, an der sie nachzulesen ist. Was die Software nicht leistet,
steht als **Aufgabe des Betreibers** da — nicht als Maßnahme.

Der Grund ist derselbe wie bei der Werkzeugkette in
[security.md](security.md): Eine TOM-Liste ist eine Zusicherung gegenüber
Aufsichtsbehörden und Auftraggebern. Eine Maßnahme, die dort steht und nicht
existiert, entwertet die übrigen.

**Keine Rechtsberatung.** Ob die Maßnahmen für die konkrete Verarbeitung
angemessen sind, entscheidet der Verantwortliche.

> [!important] Zwei Ebenen, die nicht zu vermischen sind
> **Was die Software mitbringt** — Zugriffskontrolle, Trennung, Protokollierung,
> Löschung. Das steht hier ausgeschrieben und ist prüfbar.
>
> **Was der Betrieb beisteuern muss** — Rechenzentrum, Netzwerk, Sicherungen,
> Verschlüsselung im Transport, Notfallplanung. Dazu kann eine Anwendung nichts
> zusichern. Diese Punkte sind unten als `[Betreiber]` gekennzeichnet und
> gehören in die eigene TOM-Fassung übernommen.

---

## 1. Zutrittskontrolle — physischer Zugang

| Maßnahme                      | Umsetzung                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rechenzentrum, Zutrittsschutz | `[Betreiber]`                                                                                                       |
| Serverstandort, Rechtsraum    | `[Betreiber]` — die Architektur setzt EU-inkorporierte Infrastruktur voraus, siehe [architektur.md](architektur.md) |

Die Anwendung kann hierzu nichts beitragen. Der Abschnitt steht trotzdem drin,
weil eine TOM ohne ihn unvollständig wirkt und der Betreiber ihn füllen muss.

## 2. Zugangskontrolle — wer sich anmelden darf

| Maßnahme                                           | Umsetzung                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Anmeldung mit E-Mail und Passwort                  | Supabase Auth (GoTrue), keine Eigenimplementierung                                                              |
| **Passwortlänge mindestens 12 Zeichen**            | `supabase/config.toml`, `minimum_password_length = 12`                                                          |
| Zeichenklassen erzwungen                           | `password_requirements = "lower_upper_letters_digits"`                                                          |
| Abgleich gegen bekannte Leak-Passwörter            | **Nicht eingerichtet.** `[Betreiber]` — ob die eingesetzte GoTrue-Fassung das unterstützt, ist zu prüfen        |
| **Zwei-Faktor-Anmeldung (TOTP)**                   | Vorbereitet und aktivierbar, `[auth.mfa.totp]`. **Nicht erzwungen** — eine Erzwingung ist Betreiberentscheidung |
| Begrenzung von Anmeldeversuchen und E-Mail-Versand | `[auth.rate_limit]`                                                                                             |
| Sitzungsdauer begrenzt                             | `timebox = "24h"`, `inactivity_timeout = "8h"`                                                                  |
| Sofortiger Zugriffsentzug                          | `profiles.deactivated_at` — wirkt ohne Datenverlust und ohne Löschung                                           |
| Sichere Cookie-Eigenschaften                       | `@supabase/ssr`, serverseitige Sitzungsprüfung in `src/proxy.ts`                                                |
| Verschlüsselter Transport (TLS)                    | `[Betreiber]`. Die Anwendung sendet `Strict-Transport-Security`, kann TLS aber nicht selbst herstellen          |

## 3. Zugriffskontrolle — wer welche Daten sieht

**Das ist die tragende Maßnahme dieser Anwendung.**

| Maßnahme                                                    | Umsetzung                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Row Level Security auf allen Tabellen mit Personenbezug** | In den Migrationen aktiviert; ohne Ausnahme                                                                                                |
| Policies je Verb und je Zielgruppe                          | Keine Sammel-Policies mit `OR`-Ketten. Namensmuster `<tabelle>_<verb>_<zielgruppe>`                                                        |
| **Zugriffsregeln getestet**                                 | pgTAP-Testsatz gegen die echte Datenbank, je Rolle und gegen einen **fremden Mandanten**. `pnpm db:test`                                   |
| Rollenmodell explizit                                       | `admin`, `agent`, `requester` — [rls-matrix.md](rls-matrix.md). Keine mandantenübergreifende Rolle                                         |
| Meldende sehen nur eigene Vorgänge                          | `created_by = self`, nicht über die Kundenzuordnung                                                                                        |
| Autorisierung serverseitig, nicht über Sichtbarkeit         | `requireRole()` als erste Anweisung jeder Server Action und jeder geschützten Seite                                                        |
| `anon` ohne jedes Recht                                     | Keine Policy für die unangemeldete Rolle                                                                                                   |
| **Service-Role-Schlüssel nie im Client**                    | Semgrep-Regel plus `pnpm bundle:check`, beides in der CI. `createAdminClient()` ist außerhalb `src/lib/**` und `src/actions/**` unzulässig |
| KI-Zugangsschlüssel für niemanden lesbar                    | `ai_config` hat RLS aktiv und **keine einzige Policy** — erreichbar nur über `service_role`                                                |

> [!note] Warum der Test zur Maßnahme gehört
> Eine Zugriffsregel ohne Test ist eine Behauptung: Sie ist syntaktisch korrekt
> und tut genau das, was dasteht — möglicherweise das Falsche. Erst ein
> Testsatz, der die gewünschte Zugriffsmatrix aus jeder Rolle durchspielt,
> macht sie zu einer Maßnahme. Deshalb steht der Testsatz hier und nicht nur
> unter „Qualitätssicherung".

## 4. Weitergabekontrolle — Übermittlung nach außen

| Maßnahme                                   | Umsetzung                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Keine Übermittlung im Regelbetrieb**     | Die Anwendung überträgt nichts an Analyse-, Werbe- oder Absturzberichtsdienste. Es sind keine solchen Abhängigkeiten enthalten                               |
| Content-Security-Policy mit Nonce          | `src/lib/security/csp.ts`, geprüft in `csp.test.ts`. `default-src 'self'`, `frame-ancestors 'none'`                                                          |
| Weitere Sicherheitskopfzeilen              | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` — `next.config.ts`                   |
| **KI-Übermittlung nur mit zwei Freigaben** | Betreiber (`ai_config.enabled`) **und** Mandant (`tenants.ai_enabled`, Vorgabe `false`). Eine Übermittlung an einen Dritten entsteht nicht durch Untätigkeit |
| Datenminimierung vor der Übermittlung      | `ai_config.max_input_chars`, Vorgabe 8000 Zeichen. Übermittelt werden Titel und Beschreibung — keine Namen, Rollen oder Kundenangaben                        |
| Herkunftsnachweis                          | `tickets.ai_model` und `ai_generated_at` — ohne beide ließe sich später nicht sagen, worauf ein Vorschlag beruhte                                            |
| Protokollierung der Übermittlung           | Protokolleintrag `ai.suggest`, **nur bei tatsächlicher Übermittlung** — nicht bei fehlendem Anbieter                                                         |
| Auftragsverarbeitungsverträge              | `[Betreiber]` — siehe [avv-hinweise.md](avv-hinweise.md)                                                                                                     |

## 5. Eingabekontrolle — wer wann was geändert hat

| Maßnahme                                   | Umsetzung                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Protokoll über Änderungen und Zugriffe** | `audit_log` — handelnde Person, Vorgangsart, betroffener Datensatz, Namen der geänderten Felder, Zeitpunkt         |
| Protokoll nur anhängend                    | Keine UPDATE-, keine DELETE-Policy. Ein Eintrag lässt sich nicht nachträglich verändern                            |
| Protokoll überdauert die Anonymisierung    | `actor_id` bewusst **ohne Fremdschlüssel**                                                                         |
| Zugriff auf fremde Daten protokolliert     | Auskunft über eine andere Person erzeugt `profile.export` — `src/lib/export/load.ts`                               |
| Urheberschaft unveränderlich               | Trigger auf `ticket_comments.author_id` und `time_entries.user_id` — niemand kann etwas jemand anderem zuschreiben |
| Protokoll lesbar nur für die Verwaltung    | Policy auf `audit_log`, je Mandant                                                                                 |

> [!important] Was das Protokoll bewusst **nicht** enthält
> **Keine Feldinhalte** — nur Feldnamen. Ein Protokoll mit Werten wäre eine
> zweite, länger aufbewahrte Kopie aller personenbezogenen Daten. **Keine
> IP-Adresse, kein User-Agent** — zur Frage „wer hat was geändert" tragen sie
> nichts bei, werfen aber eine eigene Rechtsgrundlagenfrage auf.
>
> Der Preis ist benannt: Aus dem Protokoll lässt sich rekonstruieren, _dass_
> ein Feld geändert wurde, nicht _was_ darin stand.

## 6. Auftragskontrolle

| Maßnahme                                       | Umsetzung                                                                                       |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Verzeichnis der Auftragsverarbeiter            | `[Betreiber]` — Abschnitt 3 des [Verarbeitungsverzeichnisses](verarbeitungsverzeichnis.md)      |
| Auftragsverarbeitungsverträge                  | `[Betreiber]` — [avv-hinweise.md](avv-hinweise.md)                                              |
| Auswahlkriterien für Unterauftragnehmer        | `[Betreiber]`. Die Architektur gibt EU-Inkorporation vor, nicht nur EU-Region                   |
| **Herkunft aller Abhängigkeiten dokumentiert** | SPDX-SBOM zu jedem Release (`sbom.yml`, erzeugt mit Syft)                                       |
| Lizenzlage aller Abhängigkeiten geprüft        | `pnpm licenses:check` in der CI, gegen `license-policy.json`. Unklare Angaben brechen den Build |
| Verhaltensprüfung neuer Abhängigkeiten         | Socket.dev an jedem Pull Request                                                                |
| Bekannte Schwachstellen in Abhängigkeiten      | Snyk laufend, Dependabot wöchentlich                                                            |

## 7. Verfügbarkeit und Belastbarkeit

| Maßnahme                           | Umsetzung                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Datensicherung                     | `[Betreiber]`                                                                                                                         |
| **Wiederherstellungstest**         | `[Betreiber]` — Ablauf beschrieben in [betrieb.md](betrieb.md). Eine Sicherung, die nie zurückgespielt wurde, ist eine Annahme        |
| Monitoring und Alarmierung         | `[Betreiber]`                                                                                                                         |
| Notfall- und Wiederanlaufplanung   | `[Betreiber]`                                                                                                                         |
| Datenintegrität auf Datenbankebene | Fremdschlüssel, `CHECK`-Bedingungen, Trigger — etwa die Kopplung von `status` und `closed_at`, damit keine Frist ohne Beginn entsteht |
| Reproduzierbarer Bau               | `pnpm-lock.yaml` versioniert, Paketmanagerversion über Corepack festgelegt, Container-Abbild im Repository                            |

> [!warning] Kein Rate Limiting je Endpunkt
> Gebremst sind Anmeldeversuche und E-Mail-Versand über `[auth.rate_limit]`. Die
> Server Actions haben keine eigene Begrenzung je Endpunkt oder Mandant. Für
> eine Instanz mit bekannten Nutzern ist das vertretbar; wer breiter öffnet,
> setzt eine Begrenzung vorgelagert. Ausgeschrieben in
> [security.md](security.md), Abschnitt H.

## 8. Trennungskontrolle

| Maßnahme                                           | Umsetzung                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Mandantentrennung in der Datenbank**             | `tenant_id` auf jeder Tabelle mit Personenbezug, durchgesetzt über Row Level Security — nicht in der Anwendungsschicht |
| Trennung getestet, nicht behauptet                 | pgTAP prüft aus jeder Rolle gegen Zeilen eines **fremden Mandanten**                                                   |
| Mandantenbezug an einer einzigen Stelle            | Ausschließlich über `(SELECT public.current_tenant_id())` — kein direkter Subselect in einer Policy                    |
| Fehlzuordnung über Mandantengrenzen ausgeschlossen | Zusammengesetzter Fremdschlüssel `(tenant_id, customer_id)`. Wirkt **auch unter `service_role`**                       |
| Trennung von Test- und Produktivdaten              | Testdaten sind ausschließlich synthetisch — Beitragsregel, in der CI nicht automatisch prüfbar                         |

> [!note] Der Kunde ist keine Trennebene
> Innerhalb eines Mandanten gibt es **Kunden** (`customers`). Die Zuordnung
> sieht einer Trennung zum Verwechseln ähnlich, ist aber keine: Die einzige
> Trennachse bleibt `tenant_id`. Wer aus der Kundenzuordnung einen Schutz
> ableitet, verlässt sich auf etwas, das keine Policy gibt.

## 9. Datenschutz durch Technikgestaltung (Art. 25)

| Maßnahme                                    | Umsetzung                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Jedes Feld mit Zweckangabe**              | [datenmodell.md](datenmodell.md). Ein Feld ohne begründbaren Zweck wird nicht aufgenommen — Beitragsregel                       |
| Datensparsame Vorgaben                      | KI je Mandant auf `false`; keine E-Mail-Kopie im Anwendungsschema; keine Kontaktdaten am Vorgang; keine Stammdaten am Kunden    |
| **Keine minutengenaue Zeiterfassung**       | `time_entries` speichert Dauer und Kalendertag, nicht Beginn und Ende — der Unterschied zwischen Aufwand und Leistungskontrolle |
| Löschung ausgeführt, nicht nur vorgesehen   | `purge_expired_data()` führt `DELETE` aus. **Die Einplanung ist Betreiberaufgabe** — [loeschkonzept.md](loeschkonzept.md)       |
| Fristbeginn maschinell gesetzt              | Trigger leitet `closed_at` aus dem Status ab; die Frist hängt nicht an der Sorgfalt der Anwendung                               |
| Einschränkung der Verarbeitung (Art. 18)    | `tenants.is_active` und `profiles.deactivated_at` — Sperrung ohne Datenverlust                                                  |
| Auskunft maschinell erfüllbar (Art. 15, 20) | `export_person_data()` über alle Bereiche mit Personenbezug                                                                     |

## 10. Überprüfung der Wirksamkeit (Art. 32 Abs. 1 lit. d)

| Maßnahme                                                | Umsetzung                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Zugriffsregeln bei jeder Änderung geprüft               | pgTAP im Pflichtdurchlauf der CI                                                                  |
| Fachlogik und Oberfläche geprüft                        | Vitest und Playwright in der CI                                                                   |
| Statische Analyse                                       | Semgrep mit eigenen Regeln plus OWASP-, React- und TypeScript-Regelsätzen                         |
| Geheimnisse in der Historie                             | gitleaks als Pre-Commit-Hook, in der CI und wöchentlich                                           |
| Neue Tabelle ohne Zugriffsregel unmöglich               | Meta-Test, der jede Tabelle mit Personenbezug auf aktivierte RLS prüft                            |
| Wiederkehrende Durchsicht von Protokoll und Datenmodell | `[Betreiber]` — was keine Automatisierung abdeckt, steht in [security.md](security.md), Kapitel 3 |

Die vollständige Werkzeugkette samt der Prüfungen, die **nicht** eingerichtet
sind, steht in [security.md](security.md), Kapitel 2.

---

## Was der Betreiber ergänzen muss — Kurzliste

- [ ] Rechenzentrum, Zutrittsschutz, Serverstandort (1)
- [ ] TLS-Terminierung und Zertifikatsverwaltung (2)
- [ ] Leak-Passwort-Abgleich prüfen und ggf. aktivieren; Entscheidung über MFA-Pflicht (2)
- [ ] Auftragsverarbeitungsverträge und Unterauftragnehmer (6)
- [ ] Sicherungskonzept, Wiederherstellungstest, Monitoring, Notfallplanung (7)
- [ ] Einplanung des Löschlaufs samt Überwachung (9)
- [ ] Rhythmus für die Durchsicht von Protokoll und Datenmodell (10)
- [ ] Bei offener Zugänglichkeit: vorgelagerte Begrenzung der Anfragefrequenz (7)
