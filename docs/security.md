# Risiken und Gegenmaßnahmen – Web-Applikationen

> Stand: August 2026 · Stack-Bezug: Next.js · Supabase (self-hosted, EU) · Postgres mit RLS
>
> Dieses Dokument ist die Sicherheitsarchitektur von Taktus Kontor: welche
> Risiken dieser Stack trägt, welche Maßnahme gegen welches wirkt, und wo die
> Grenzen der Automatisierung liegen. Der Meldeweg für gefundene Lücken steht
> in [SECURITY.md](../SECURITY.md).
>
> **Eine hier genannte Prüfung ist eine Zusicherung, keine Absicht.** Wer sie
> liest, darf annehmen, dass sie tatsächlich läuft. Deshalb steht in Kapitel 2
> neben jeder Zeile, wo sie belegt ist — und was nicht eingerichtet ist, steht
> getrennt und als solches gekennzeichnet. Sechs belegbare Punkte sind mehr
> wert als zwölf behauptete.

## 1. Risikomatrix

Sortiert nach Relevanz für diesen Stack, nicht nach OWASP-Nummerierung. Die OWASP-Zuordnung steht dabei, weil sie ein verbreiteter Bezugsrahmen ist und das Nachschlagen erleichtert.

### A. Zugriffskontrolle und Mandantentrennung

**Das mit Abstand größte Risiko dieser Architektur.**

| Risiko                     | Was konkret passiert                            | Gegenmaßnahme                                                      | Werkzeug/Methode                                                |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Fehlerhafte RLS-Policy     | Mandant A sieht Daten von Mandant B             | Policies als Sicherheitsgrenze, nicht die Anwendungsschicht        | **pgTAP-Testsatz**, der jede Policy aus jeder Rolle durchspielt |
| IDOR / BOLA                | Zugriff auf fremde Datensätze über geratene IDs | Autorisierung serverseitig pro Datensatz, nie über UI-Sichtbarkeit | RLS + E2E-Tests mit fremden IDs                                 |
| Rechteausweitung           | Nutzer erlangt Rollen, die ihm nicht zustehen   | Rollenmodell explizit, Rollenwechsel serverseitig                  | Rollentests, Audit-Log                                          |
| Service-Role-Key im Client | Vollzugriff auf die Datenbank aus dem Browser   | Strikte Trennung Client-/Server-Komponenten                        | Build-Prüfung auf Schlüssel im Bundle                           |

_OWASP A01 – Broken Access Control. Statistisch die häufigste Kategorie, und die, gegen die generische Scanner am wenigsten ausrichten._

> [!important] Der Kunde ist keine Trennebene — und das gehört hierher, nicht nur ins Datenmodell.
> Innerhalb eines Mandanten gibt es **Kunden** (`customers`): für wen ein Vorgang geführt wird und wer ihn abrechnet. Die Zuordnung sieht einer Trennung zum Verwechseln ähnlich, ist aber keine. Die einzige Trennachse bleibt `tenant_id`.
>
> Was der Kunde deshalb **nicht** leistet: Ein Melder sieht die Vorgänge seiner Kolleginnen und Kollegen beim selben Kunden nicht — das folgt aus `created_by = self`, nicht aus der Kundenzuordnung. Umgekehrt gilt: Würde diese Bedingung je gelockert, entstünde daraus **keine** Kundentrennung, sondern gar keine.
>
> Was er sehr wohl leistet, ist Integrität: Der zusammengesetzte Fremdschlüssel `(tenant_id, customer_id)` schliesst aus, dass ein Vorgang einem Kunden eines fremden Betriebs zugeordnet wird. Das ist ein Schutz gegen Zuordnungsfehler — in einer späteren Abrechnung landete ein solcher Vorgang sonst auf der falschen Rechnung — und wirkt auch unter `service_role`.
>
> Die Unterscheidung steht hier, weil ein Prüfer sie zuerst missversteht und die Anwendung sie sonst nirgends ausspricht.

### B. Authentifizierung und Sitzungen

| Risiko                     | Was konkret passiert                       | Gegenmaßnahme                                           | Werkzeug/Methode                   |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------- | ---------------------------------- |
| Schwache Anmeldung         | Übernahme von Konten                       | Passwortrichtlinie, MFA-Option, Brute-Force-Bremse      | Supabase Auth, Rate Limiting       |
| Sitzungsübernahme          | Gestohlenes Token bleibt gültig            | Kurze Token-Lebensdauer, Rotation, sichere Cookie-Flags | Auth-Konfiguration, Header-Prüfung |
| Fehlende Abmeldung überall | Token bleibt nach Kompromittierung nutzbar | Sitzungsverwaltung mit Widerruf                         | Funktionstest                      |

_OWASP A07_

### C. Eingaben und Injection

| Risiko                | Was konkret passiert              | Gegenmaßnahme                                                        | Werkzeug/Methode                                    |
| --------------------- | --------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| SQL-Injection         | Manipulierte Datenbankabfragen    | Parametrisierte Abfragen, kein String-Zusammenbau                    | **Semgrep**, CodeQL, `/security-review`             |
| XSS                   | Eingeschleustes Skript im Browser | React escapt standardmäßig; Gefahr nur bei `dangerouslySetInnerHTML` | **CodeQL**, Semgrep-Regel gegen genau dieses Muster |
| SSRF                  | Server ruft interne Adressen auf  | Ziel-Allowlist bei ausgehenden Anfragen                              | Semgrep, Code-Review                                |
| Unvalidierte Eingaben | Inkonsistente Daten, Folgefehler  | Schema-Validierung serverseitig (z. B. Zod), nicht nur im Formular   | Typprüfung, Tests                                   |

_OWASP A03_

### D. Abhängigkeiten und Lieferkette

**Drei Ebenen, die oft verwechselt werden.** Die eingesetzten Werkzeuge decken alle drei ab – das ist bewusst geschichtet, nicht redundant:

1. **Bekannte Schwachstellen** (CVE-basiert) → Snyk
2. **Bösartige Pakete** (verhaltensbasiert, oft bevor ein CVE existiert) → Socket.dev
3. **Aktualisierungs-Automatisierung** → Dependabot/Renovate

| Risiko                                   | Was konkret passiert                                                                                                                             | Gegenmaßnahme                                                                                 | Werkzeug/Methode                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Bekannte Schwachstelle in Paket          | Übernommene Lücke ohne eigenes Zutun                                                                                                             | Kontinuierliche Prüfung mit Priorisierung nach Erreichbarkeit                                 | **Snyk** – eigene Schwachstellendatenbank, Erreichbarkeitsanalyse, Fix-Vorschläge                |
| **Bösartiges Paket**                     | Schadcode, Hintertür, Datenabfluss über eine Abhängigkeit                                                                                        | Verhaltensanalyse jedes neuen Pakets zum Zeitpunkt des Pull Requests                          | **Socket.dev** – prüft Installationsskripte, Netzwerk- und Dateisystemzugriffe, Verschleierung   |
| **Typosquatting / Dependency Confusion** | `lodahs` statt `lodash` – für solche Pakete existiert nie ein CVE                                                                                | Namensähnlichkeitsanalyse vor der Installation                                                | **Socket.dev** – einziges Werkzeug der Kette, das diese Klasse überhaupt erfasst                 |
| Kompromittierter Maintainer              | Übernommenes Paket verändert sein Verhalten                                                                                                      | Verhaltensänderung zwischen Versionen erkennen                                                | **Socket.dev**                                                                                   |
| Veraltete Abhängigkeiten                 | Expositionsfenster wächst unbemerkt                                                                                                              | Automatisierte Aktualisierung                                                                 | Dependabot oder Renovate – mechanische Ergänzung, kein Scanner                                   |
| Lizenzverstoß                            | Inkompatible Lizenz im AGPL-Projekt                                                                                                              | Positivliste erlaubter Lizenzen                                                               | **`pnpm licenses list`** in der CI; Snyk deckt Lizenz-Policies zusätzlich ab                     |
| **Unbekannte Lieferkette**               | Transitive Abhängigkeiten und deren Lizenzen sind nicht dokumentiert – wenige direkte Pakete ziehen in Next.js schnell mehrere hundert nach sich | Maschinenlesbare Stückliste über die vollständige Abhängigkeitskette, bei jedem Build erzeugt | **SPDX-SBOM** (`npm sbom`, `spdx-sbom-generator` oder Syft), Allow-/Deny-Policy bricht den Build |
| Phantom-Dependency                       | Paket wird genutzt, ohne deklariert zu sein                                                                                                      | Strikte `node_modules`-Struktur                                                               | **pnpm** (verhindert das bauartbedingt)                                                          |
| Lockfile-Manipulation                    | Auflösung weicht von der Deklaration ab                                                                                                          | Lockfile verbindlich, Version gepinnt                                                         | `pnpm-lock.yaml` committet, Corepack-Pinning                                                     |

> [!important] Warum drei Ebenen und nicht eine
> Ein CVE-basierter Scanner meldet nur, was bereits jemand öffentlich gemeldet hat – das ist reaktiv und für einen laufenden Lieferkettenangriff zu langsam. Socket.dev setzt eine Ebene davor an und fragt, **was ein Paket tut**, nicht ob es gemeldet wurde. Diese Kombination – kommerzielle CVE-Analyse mit Erreichbarkeitsprüfung plus verhaltensbasierte Lieferkettenanalyse – ist deutlich mehr als der GitHub-Standard, den jedes Repository per Voreinstellung hat. Der Unterschied ist nicht „wir haben Dependabot an", sondern „Abhängigkeiten werden auf drei Ebenen geprüft, und hier ist, was jede davon sieht".

> [!note] SPDX ist ein Format, kein Werkzeug
> Häufige Verwechslung: SPDX und CycloneDX sind Formatstandards für Stücklisten. **CycloneDX ist auf Sicherheit und Schwachstellenverfolgung ausgerichtet, SPDX auf Lizenz-Compliance** – für die AGPL-Frage ist SPDX das passende Format. Erzeugt wird es von Werkzeugen wie `npm sbom` (First-Party in Node, kann beide Formate), `spdx-sbom-generator` oder Syft.
>
> **Praktische Befehle:**
>
> ```
> pnpm licenses list          # gruppiert nach Lizenztyp, gut lesbar
> pnpm licenses list --json   # maschinenlesbar, für CI-Auswertung
> ```
>
> **Warum das `license`-Feld der `package.json` nicht genügt:** Es ist eine Selbstauskunft des Paketautors, weder verpflichtend noch verlässlich. Pakete deklarieren `MIT` und liefern Dateien mit abweichenden Headern aus; dual-lizenzierte Pakete nennen oft nur die freundlichere Variante; ältere Pakete verwenden ungültige Bezeichner wie `BSD`, `Apache` oder `LICENSE IN README`, die kein Werkzeug automatisch bewerten kann; bei Monorepos weicht die Wurzel-Lizenz von der des veröffentlichten Unterpakets ab. Wer nur die deklarierten Felder prüft, prüft Behauptungen, nicht die Rechtslage. Ein SPDX-Scan liest stattdessen die tatsächlichen Lizenztexte und Datei-Header im installierten Paket und markiert unklare Fälle als solche.
>
> **Zwei Policies, nicht eine:** Die Deny-Liste hängt an der Lizenz des eigenen Projekts. In proprietärer Individualsoftware brechen GPL, AGPL und SSPL den Build. Im AGPL-lizenzierten Orchestrator sind GPL-3.0 und AGPL-3.0 dagegen zulässig – aber `GPL-2.0-only` nicht, weil es mit AGPL-3.0 unvereinbar ist. Die Regel lautet dort also nicht „Copyleft raus", sondern ist lizenzgenau. Detailtabelle in [CONTRIBUTING.md](../CONTRIBUTING.md), Abschnitt „Abhängigkeiten“; maschinenlesbar in `license-policy.json`, ausgewertet von `scripts/check-licenses.mjs`.
>
> **Der Unterschied zum reinen Lizenz-Check:** `pnpm licenses list` beantwortet die interne Frage „welche Lizenzen sind drin". Ein SBOM ist ein weitergebbares, maschinenlesbares Dokument über die vollständige transitive Kette – aushändigbar an einen Betreiber, prüfbar von dessen Compliance, und damit Bestandteil der Übergabe statt Extra. Für Produkte mit digitalen Elementen bewegt sich die EU-Regulatorik (Cyber Resilience Act) in Richtung verpflichtender Stücklisten.

_OWASP A06 · A08 (Software- und Datenintegrität)_

### E. Geheimnisse und Konfiguration

| Risiko                          | Was konkret passiert                           | Gegenmaßnahme                                   | Werkzeug/Methode                                      |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Zugangsdaten im Repository      | Dauerhafte Kompromittierung, auch nach Löschen | Verhindern statt bereinigen – Git löscht nichts | **GitHub Push Protection** (blockiert vor dem Commit) |
| Altlasten in der Historie       | Öffentlichschaltung legt alles offen           | Historien-Scan vor Veröffentlichung             | **gitleaks**, notfalls frisches Repository            |
| Unsichere Standardkonfiguration | Offene Ports, Debug-Modus, fehlende Header     | Härtung dokumentiert und geprüft                | Security-Header-Prüfung, Betriebsdokumentation        |

_OWASP A05 · Für ein öffentliches Repository die Kategorie mit dem höchsten Schadenspotenzial_

### F. Datenschutzspezifische Risiken

**Nicht Teil klassischer Sicherheits-Scans — und deshalb die Ebene, die sonst niemand prüft.**

| Risiko                      | Was konkret passiert                      | Gegenmaßnahme                                               | Werkzeug/Methode                                         |
| --------------------------- | ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| Übermäßige Datenerhebung    | Verstoß gegen Datenminimierung            | Jedes Feld begründet, keine Felder „für später"             | Datenmodell-Review, dokumentierte Zweckbindung           |
| Fehlende Löschung           | Aufbewahrung über den Zweck hinaus        | Löschkonzept implementiert, nicht nur Flag                  | Automatisierte Löschläufe + Test                         |
| Keine Auskunftsfähigkeit    | Betroffenenrechte nicht erfüllbar         | Maschineller Export aller Daten einer Person                | Funktion + Test                                          |
| Protokollierung ohne Grenze | Logs werden selbst zum Datenschutzproblem | Keine personenbezogenen Inhalte in Logs, Aufbewahrungsfrist | Log-Review, Semgrep-Regel gegen Logging sensibler Felder |
| Drittlandtransfer           | Daten unterliegen fremder Jurisdiktion    | EU-inkorporierte Anbieter, kein US-Betreiber                | Auswahl der Infrastruktur, Unterauftragsverzeichnis      |
| Fehlende Nachweise          | Rechenschaftspflicht nicht erfüllbar      | Verarbeitungsverzeichnis, TOM, AVV-Muster mitliefern        | Dokumente im Repository                                  |

_Kein OWASP-Punkt – DSGVO Art. 5, 17, 20, 25, 30, 32, 44 ff._

### G. KI-spezifische Risiken

**Junges Feld, für das es kaum eingespielte Prüfmuster gibt.**

| Risiko                         | Was konkret passiert                              | Gegenmaßnahme                                                                                | Werkzeug/Methode                                        |
| ------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Prompt Injection               | Inhalt eines Tickets steuert das Modell           | Fremdinhalte als Daten behandeln, nie als Anweisung; keine Werkzeugrechte aus Modellausgaben | Architekturentscheidung + Testfälle mit Angriffsmustern |
| Datenabfluss an Modellanbieter | Personenbezogene Daten verlassen die Verarbeitung | Minimierung vor Übergabe, Anbieter austauschbar halten, AVV                                  | Dokumentierte Abwägung, Pseudonymisierung               |
| Ausgabe ohne Prüfung           | Falsche Auswertung wird als Tatsache genutzt      | Modellausgaben als Vorschlag kennzeichnen, keine automatische Ausführung                     | UI-Kennzeichnung, kein Auto-Commit von Vorschlägen      |
| Übergriffige Berechtigungen    | Modell erhält mehr Datenzugriff als der Nutzer    | Modellzugriff läuft durch dieselbe RLS wie der Nutzer                                        | Rollenbindung der KI-Aufrufe                            |

_OWASP Top 10 for LLM Applications_

### H. Betrieb und Laufzeit

| Risiko                                          | Was konkret passiert                            | Gegenmaßnahme                                                                          | Werkzeug/Methode                                                                                          |
| ----------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Laufzeitfehler, die im Code nicht sichtbar sind | Fehlkonfiguration erst im Betrieb wirksam       | Dynamischer Test gegen laufende Instanz                                                | _Nicht eingerichtet_ — siehe Kapitel 2                                                                    |
| Fehlende Security-Header                        | CSP, HSTS, Frame-Options nicht gesetzt          | Header zentral gesetzt und geprüft                                                     | `src/lib/security/csp.test.ts`                                                                            |
| Kein Missbrauchsschutz                          | Automatisierte Angriffe, Kostenexplosion bei KI | Anmeldeversuche und E-Mail-Versand gebremst; KI-Eingabe auf `max_input_chars` begrenzt | `supabase/config.toml` `[auth.rate_limit]`, `ai_config`. **Kein Rate Limiting je Endpunkt** — siehe unten |
| Unbemerkter Vorfall                             | Angriff bleibt unentdeckt                       | Monitoring, Alarmierung, Audit-Log auswertbar                                          | Betriebskonzept                                                                                           |
| Backup ohne Wiederherstellungstest              | Sicherung existiert, funktioniert aber nicht    | Restore regelmäßig tatsächlich durchführen                                             | Dokumentierter Restore-Test                                                                               |

_OWASP A09 · Verfügbarkeit und Wiederherstellbarkeit sind auch DSGVO Art. 32_

> [!warning] Rate Limiting je Endpunkt gibt es nicht — und das gehört gesagt
> Gebremst ist, was Supabase Auth bremst: Anmeldeversuche und E-Mail-Versand,
> konfiguriert in `supabase/config.toml`. Die Server Actions der Anwendung haben
> **keine** eigene Begrenzung je Endpunkt oder je Mandant.
>
> Praktisch heißt das: Ein angemeldeter Nutzer kann Vorgänge, Beiträge und
> KI-Vorschläge in beliebiger Frequenz auslösen. Die Kostenseite der KI ist über
> `ai_config.max_input_chars` nach oben begrenzt, die Anzahl der Anfragen nicht.
>
> Für eine Instanz mit bekannten Nutzern ist das vertretbar; für eine offen
> zugängliche wäre es das nicht. Ein Betreiber, der die Anwendung breiter
> öffnet, ergänzt eine Begrenzung vorgelagert — im Reverse Proxy oder in einer
> WAF.

> [!note] Stand der Header
> Fünf statische Header stehen in `next.config.ts`. Die Content-Security-Policy
> steht getrennt davon in `src/lib/security/csp.ts` und wird in `src/proxy.ts`
> gesetzt, weil sie eine Nonce je Anfrage trägt. Geprüft wird sie als reine
> Funktion — dreizehn Zusicherungen, darunter „Skripte bekommen nie
> `'unsafe-inline'`" und „in der ganzen Richtlinie steht genau ein fremder
> Ursprung".
>
> Was diese Zusicherungen **nicht** leisten: den Nachweis, dass die Anwendung
> unter der Richtlinie noch funktioniert. Den führt nur ein Produktivbau im
> Browser, weil Entwicklung und Produktion sich genau hier unterscheiden. Er
> wurde geführt und gehört vor jede Veröffentlichung wiederholt —
> der Freigabeliste vor dem Oeffentlichmachen.
>
> Und er reicht nicht in einem Browser. `upgrade-insecure-requests` hob in
> WebKit jede Unteranfrage auf `https` an, wo lokal kein TLS lauscht: Die
> Anmeldemaske kam ungestaltet, in Chromium war alles in Ordnung. Seither läuft
> eine einzelne Stichprobe in WebKit mit (`e2e/darstellung.spec.ts`).

> [!note] Die Richtlinie nimmt für Browsererweiterungen nichts aus — geprüft,
> nicht angenommen
> Ein Passwortmanager füllte zeitweise nichts mehr aus, und `frame-src 'none'`
> war der naheliegende Verdächtige: Ein Auswahlmenü ist ein Iframe. Die
> Richtlinie wurde daraufhin für die Erweiterungsschemata geöffnet — und wieder
> geschlossen, als sich zeigte, dass das Menü unverändert erschien. Erweiterungen
> bauen ihre Oberfläche aus einer isolierten Welt, und die ist von der Seiten-CSP
> nicht betroffen. Die Ursache lag ausserhalb der Anwendung.
>
> Der Absatz bleibt stehen, obwohl er eine Fehldiagnose beschreibt. Er ist die
> Antwort auf eine Frage, die sich beim nächsten Mal genauso stellt — und eine
> Lockerung, die niemand mehr begründen kann, ist teurer als die Notiz darüber,
> warum es sie nicht gibt.

---

## 2. Werkzeugkette in Ausführungsreihenfolge

> [!important] Diese Tabelle führt nur, was nachweislich läuft
> Jede Zeile ist gegen `.github/workflows/` belegbar. Was vorgesehen, aber
> nicht eingerichtet ist, steht in der zweiten Tabelle und ist dort als solches
> gekennzeichnet. Der Grund ist derselbe wie in [SECURITY.md](../SECURITY.md):
> Eine genannte Prüfung ist eine Zusicherung. Sechs belegbare Zeilen sind mehr
> wert als zwölf behauptete.

| Zeitpunkt                  | Prüfung                                    | Wo belegt                                | Zweck                                                    |
| -------------------------- | ------------------------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| **Vor dem Commit**         | GitHub Secret Scanning mit Push Protection | Repository-Einstellung                   | Zugangsdaten gar nicht erst einchecken                   |
| **Vor dem Commit**         | gitleaks als husky-Hook                    | `.husky/pre-commit`, `.gitleaks.toml`    | Zugangsdaten gar nicht erst einchecken                   |
| **Vor dem Pull Request**   | `/security-review` in Claude Code, lokal   | Gewohnheit, siehe Hinweis unten          | Kontextbezogene Zweitmeinung über Dateigrenzen hinweg    |
| **Bei jedem Pull Request** | Vitest, pgTAP-RLS-Tests, Playwright        | `ci.yml`                                 | Zugriffskontrolle und Fachlogik                          |
| **Bei jedem Pull Request** | ESLint, `tsc --noEmit`, Prettier           | `ci.yml`                                 | Handwerk und Typen                                       |
| **Bei jedem Pull Request** | `pnpm licenses:check`                      | `ci.yml`, `license-policy.json`          | AGPL-Kompatibilität, bricht bei unklarer Angabe          |
| **Bei jedem Pull Request** | `pnpm bundle:check`                        | `ci.yml`                                 | Kein Service-Role-Schlüssel im Client-Bundle             |
| **Bei jedem Pull Request** | REUSE-Prüfung                              | `ci.yml`                                 | Lizenzangabe an jeder Datei                              |
| **Bei jedem Pull Request** | **Semgrep** — eigene Regeln, OWASP, React  | `semgrep.yml`, `.semgrep/taktus.yml`     | Statische Analyse; Befunde zusätzlich im Code Scanning   |
| **Bei jedem Pull Request** | **CodeQL**                                 | `codeql.yml`                             | Statische Analyse, zweiter Regelsatz neben Semgrep       |
| **Bei jedem Pull Request** | gitleaks über die gesamte Historie         | `gitleaks.yml`                           | Altlasten                                                |
| **Bei jedem Pull Request** | **Socket.dev**                             | GitHub-App auf Kontoebene                | Verhaltensanalyse neuer und geänderter Abhängigkeiten    |
| **Bei jedem Pull Request** | CLA-Zustimmung                             | `cla.yml`, `scripts/cla-signatures.mjs`  | Rechtelage der Beiträge                                  |
| **Laufend**                | **Snyk**                                   | GitHub-App auf Kontoebene                | Bekannte Schwachstellen, priorisiert nach Erreichbarkeit |
| **Wöchentlich**            | Dependabot                                 | `.github/dependabot.yml`                 | Aktualisierungs-Pull-Requests                            |
| **Wöchentlich**            | gitleaks über die gesamte Historie         | `gitleaks.yml`, `cron`                   | Altlasten, die ein Hook übersprungen hat                 |
| **Wöchentlich**            | CodeQL                                     | `codeql.yml`, `cron`                     | Neue Regelsätze auf unverändertem Code                   |
| **Zu jedem Release**       | SPDX-SBOM mit Syft, abgelegt am Release    | `sbom.yml`, Trigger `release: published` | Nachweisbare, weitergebbare Lieferkette                  |

### Vorgesehen, aber heute nicht eingerichtet

Diese Zeilen stehen getrennt, weil sonst genau der Fehler entstünde, vor dem
[SECURITY.md](../SECURITY.md) warnt: eine Prüfung zu nennen, die nicht läuft.

| Prüfung                                                           | Stand                                                                                                                                                               |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dynamischer Test gegen eine laufende Instanz** (etwa OWASP ZAP) | Nicht eingerichtet. Es gibt keine dauerhafte Testinstanz, gegen die er liefe                                                                                        |
| **Restore-Test in festem Rhythmus**                               | Setzt eine produktive Instanz mit Sicherungen voraus. Für Betreiber ist er in [betrieb.md](betrieb.md) als Empfehlung beschrieben, nicht als Zusage dieses Projekts |

**Werkzeuge, die nicht doppeln:** CodeQL und Semgrep überschneiden sich teilweise – das ist beabsichtigt, unterschiedliche Regelphilosophien finden unterschiedliche Dinge. Die Durchsicht mit `/security-review` ergänzt beide um Kontextverständnis über Dateigrenzen hinweg: Sie liest den Zusammenhang, den ein Regelsatz nicht kennt.

> [!note] `/security-review` läuft lokal, nicht in der CI
> Zunächst gab es dafür einen eigenen Workflow (`claude-security-review.yml`)
> mit der Action `anthropics/claude-code-security-review`. Der ist entfernt
> worden, und zwar aus einem einzigen Grund: Er hätte einen
> `ANTHROPIC_API_KEY` als Repository-Secret verlangt. Ein Schlüssel, der im
> Repository liegt, ist ein Schlüssel, der dort abhandenkommen kann – in einem
> Projekt, das seine Prüfkette als Leistung ausweist, ist das der falsche
> Handel für eine Prüfung, die es auch ohne ihn gibt.
>
> Stattdessen wird die Durchsicht **lokal** ausgeführt, gegen die Änderungen
> des aktuellen Branches, bevor der Pull Request aufgemacht wird. Rhythmus:
> vor jedem Pull Request, der Datenmodell, RLS-Policies, Authentifizierung,
> Server Actions oder die KI-Anbindung berührt – bei rein gestalterischen
> Änderungen genügt der Lauf vor dem Release.
>
> **Was dieser Tausch kostet, offen gesagt:** Ein lokaler Schritt ist eine
> Gewohnheit, keine erzwungene Bedingung. Die CI kann ihn nicht einfordern,
> und für Beiträge Dritter greift er gar nicht – dort bleiben CodeQL, Semgrep,
> Socket.dev und die pgTAP-Tests die einzige automatische Ebene. Das ist
> hinnehmbar, weil die Befunde dieser Durchsicht ohnehin ein menschliches
> Urteil brauchen; es wäre nicht hinnehmbar, wenn sie die einzige
> sicherheitsrelevante Prüfung wäre. Ist sie nicht.

**Werkzeuge, die tatsächlich doppeln – hier ist zu entscheiden:**

- **OSV-Scanner und Trivy sind neben Snyk verzichtbar.** Snyk deckt dieselbe CVE-Ebene mit größerer Datenbasis und Priorisierung ab. Kein Grund, kostenlose Zweitscanner danebenzustellen – sie erzeugen nur zusätzliche Befunde ohne zusätzliche Erkenntnis.
- **Snyk Code (SAST) überschneidet sich mit CodeQL und Semgrep.** Drei SAST-Werkzeuge parallel erzeugen mehr Triage-Aufwand als Sicherheitsgewinn; zwei genügen. Deshalb bleibt Snyk hier auf der Abhängigkeitsebene.
- **Socket.dev doppelt nichts.** Es ist die einzige verhaltensbasierte Ebene der Kette.

---

## 3. Was Werkzeuge nicht leisten

**Der wichtigste Abschnitt dieses Dokuments.**

Kein automatisierter Scanner findet:

- **Eine fachlich falsche RLS-Policy.** Sie ist syntaktisch korrekt und tut genau das, was dasteht – nur das Falsche. Nur ein Testsatz, der die gewünschte Zugriffsmatrix abbildet, deckt das auf.
- **Fehler in der Geschäftslogik.** Wenn eine Freigabe an der falschen Stelle greift, ist das kein Muster, sondern eine Fehlentscheidung.
- **Datenschutzverstöße durch Datenmodellierung.** Ein Feld zu viel ist kein technischer Fehler.
- **Fehlende Löschung.** Ein Scanner sieht nicht, was hätte gelöscht werden müssen.
- **Jurisdiktionsfragen.** Kein Werkzeug bewertet, ob ein Anbieter CLOUD-Act-Exposition mitbringt.
- **Angemessenheit der Maßnahmen** im Sinne von Art. 32 DSGVO.

Diese Punkte erfordern eine fachliche Bewertung durch einen Menschen mit Datenschutz- und Sicherheitsqualifikation.

> [!note] Ein Beispiel aus diesem Repository, nicht aus der Literatur
> `export_person_data()` prüft ihre Berechtigung selbst, weil `SECURITY DEFINER`
> die Policies umgeht. Die Prüfung stand vollständig in einem
> `IF current_tenant_id() IS NOT NULL` — gedacht als Ausnahme für den
> Betreiber, der keinen Mandantenbezug hat. Derselbe Ausdruck ist aber auch für
> ein deaktiviertes Profil und für einen gesperrten Mandanten NULL. Die
> Ausnahme griff damit für genau die zwei Zustände, die „kein Zugriff"
> bedeuten sollen.
>
> Weder CodeQL noch Semgrep konnten das finden: Es gibt kein Muster, gegen das
> man prüfen könnte. Das SQL ist einwandfrei, die Funktion tut, was dasteht.
> Die 130 pgTAP-Zusicherungen blieben grün, weil beide Verweigerungstests einen
> **aktiven** Nutzer in einem **aktiven** Mandanten verwendeten — sie konnten
> den Fehler bauartbedingt nicht sehen. Gefunden hat es eine Durchsicht mit
> `/security-review`, behoben in
> `20260812000000_auskunft_ohne_mandantenbezug.sql`, belegt durch drei neue
> Zusicherungen, die gegen die alte Fassung nachweislich fehlschlagen.
>
> Der Absatz steht hier, weil er die Behauptung dieses Kapitels einlöst, statt
> sie zu wiederholen. Eine Prüfkette, die nie etwas findet, ist entweder
> perfekt oder unehrlich — und das Erste ist unwahrscheinlich.

> [!tip] Worin der Unterschied tatsächlich liegt
> Werkzeuge kann jeder einschalten – sie sind kostenlos und in einer Stunde eingerichtet. Was fehlt, ist die Beurteilung dessen, was sie nicht abdecken. Diese Liste ist deshalb nicht nur eine Maßnahmenübersicht, sondern der Beleg, dass die Lücken benannt und bewertet wurden. Zwei identische CI-Konfigurationen sagen nichts darüber, ob jemand weiß, wogegen sie helfen.

---
