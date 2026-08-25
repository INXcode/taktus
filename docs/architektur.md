# Architektur

> Warum dieser Stack, warum self-hosted, und was daraus für den Betrieb folgt.
> Sicherheitsarchitektur: [security.md](security.md). Betrieb und lokale
> Umgebung: [betrieb.md](betrieb.md).

## Warum der Stack größer ist, als der Funktionsumfang verlangt

SQLite plus ein Minimal-Framework würde für Tickets und Zeitbuchungen genügen.
Es würde aber auch keine der Eigenschaften tragen, um derentwillen dieses
Projekt existiert: Mandantentrennung, die eine Datenbank durchsetzt statt einer
Anwendungsschicht, und eine Zugriffsmatrix, gegen die sich testen lässt.

**„Größer" heißt dabei Tiefe in der Architektur, nicht Breite im
Funktionsumfang.** Mehrmandantenfähigkeit, Row Level Security mit
Testabdeckung, Audit-Log, Löschkonzept, CI-Prüfkette — ja. Zusätzliche
Funktionen — nein. Diese Unterscheidung ist der einzige Weg, den
Architekturanspruch mit der Regel „weniger drin, früher draußen" zu vereinbaren.

| Baustein     | Wahl                                   | Begründung                                                                                         |
| ------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Framework    | Next.js, App Router, TypeScript strict | Server Actions halten die Autorisierung serverseitig; ein bewährter Stack ohne Eigenbau            |
| Datenbank    | Supabase — Postgres, Auth, RLS         | Postgres mit RLS als Kern; Auth ohne Eigenbau                                                      |
| Paketmanager | pnpm                                   | Strikte `node_modules` verhindern Phantom-Dependencies; `pnpm licenses list` trägt den Lizenzcheck |
| Styling      | Tailwind                               | Verbreitet, wartbar                                                                                |
| Tests        | Vitest, pgTAP, Playwright              | RLS ohne Test ist eine Behauptung — pgTAP prüft die Policies gegen die echte Datenbank             |
| CI           | GitHub Actions                         | Öffentlich sichtbare Qualitätssicherung                                                            |
| Laufzeit     | **Node 24**                            | Aktives LTS bis 04/2028 — siehe unten                                                              |

## Laufzeit: Node 24, nicht 22 und nicht 26

Die Wahl der Laufzeit ist hier festgehalten, weil sie ein Verfallsdatum hat:
Jede Node-Hauptversion hat ein Ende, und eine Entscheidung, die nur in einer
`.nvmrc` steht, wird beim nächsten Mal nicht abgewogen, sondern fortgeschrieben.

Die Abwägung, Stand August 2026, nach dem offiziellen Releaseplan:

| Version | Phase                      | Ende       | verbleibend |
| ------- | -------------------------- | ---------- | ----------- |
| 22      | **Wartung**                | 2027-04-30 | ~9 Monate   |
| **24**  | **Aktives LTS**            | 2028-04-30 | ~21 Monate  |
| 26      | Current, LTS ab 28.10.2026 | 2029-04-30 | ~33 Monate  |

**Gegen Node 22** spricht, dass es bereits in der Wartungsphase steht und nur
noch kritische Korrekturen erhält. Ein Projekt, das mit einer belastbaren
Sicherheitsarchitektur antritt, kann nicht auf einer Laufzeit stehen, deren
Unterstützung in neun Monaten endet — die `.nvmrc` ist die erste Datei, in der
ein solcher Widerspruch auffällt.

**Gegen Node 26** spricht der Zeitpunkt: Es wird erst am 28.10.2026 zum LTS.
Bis dahin sind Korrekturen weniger konservativ und die Unterstützung im
Ökosystem weniger erprobt. Ein Wechsel auf 26 ist nach dem LTS-Datum jederzeit
möglich und dann eine eigene Entscheidung.

Alle Abhängigkeiten tragen 24: `next >=20.9`, `@supabase/supabase-js >=22`,
`vitest ^20 || ^22 || >=24`.

Festgelegt an drei Stellen, die zusammen gehalten werden müssen:
`.nvmrc` (liest die Versionsverwaltung und die CI über `node-version-file`),
`engines.node` in der `package.json`, und `@types/node` — dessen Hauptversion
der Laufzeit folgt, weil Typen einer neueren Version Schnittstellen
beschreiben, die zur Laufzeit nicht existieren. Der Übersetzungslauf bliebe
grün, der Fehler träte erst im Betrieb auf. Eine `ignore`-Regel in
`.github/dependabot.yml` verhindert deshalb automatische Hauptversionssprünge
bei `@types/node`.

> [!note] Nächster Prüfzeitpunkt
> Vor April 2028, besser mit dem LTS-Datum von Node 26 im Oktober 2026. Ein
> Wechsel der Laufzeit gehört geplant, nicht aus einer auslaufenden Frist
> heraus erzwungen.

## Souveränitätsentscheidung: self-hosted, nicht Supabase Cloud

Self-Hosting ist bestehende Praxis in allen bisherigen Projekten. Die Begründung
steht hier trotzdem ausgeschrieben: Eine Betriebsentscheidung dieser Tragweite
ist begründungspflichtig, und eine unbegründete Gewohnheit lässt sich später
weder verteidigen noch revidieren.

**Supabase Inc. ist eine Delaware C-Corp.** Die Wahl der Region `eu-central-1`
(Frankfurt) löst die **Datenresidenz**, nicht die **Datensouveränität**: Ein
US-Unternehmen kann unter dem CLOUD Act zur Herausgabe von Daten verpflichtet
werden, auch wenn diese physisch in der EU liegen. Standardvertragsklauseln
heilen das nicht — das ist der Kern von Schrems II.

Für dieses Projekt ist das ein Ausschlusskriterium, und zwar aus einem sachlichen
Grund: Das Repository stellt seine Architektur ausdrücklich als prüfbar aus. Wer
das tut, wird geprüft, und wer prüft, setzt an der schwächsten Stelle an.
**Eine Architektur, die genau dort nachgibt, wo sie ihre Prüfbarkeit behauptet,
ist schlechter als eine, die nichts behauptet.**

Daraus folgt:

- Supabase wird selbst betrieben — die Komponenten sind quelloffen, überwiegend
  Apache-2.0
- Hosting auf EU-inkorporierter Infrastruktur, nicht nur in der EU-Region eines
  US-Anbieters
- Gleiches für das Deployment der Anwendung: **kein Vercel** in der öffentlich
  betriebenen Instanz, aus demselben Grund

**Ausnahme:** Für die lokale Entwicklung ist die Supabase-CLI mit lokalem
Container-Stack der Normalfall. Dort stellt sich die Frage nicht.

### Beim KI-Anbieter ist dieselbe Prüfung offen

Für das eingesetzte Sprachmodell gilt dieselbe Abwägung. Eine vollständig
souveräne Lösung ist hier möglicherweise nicht praktikabel. Die Anforderung
lautet dann: Die Verarbeitung ist **dokumentiert, minimiert und für Betreiber
austauschbar.**

Umgesetzt wird das über drei Entscheidungen:

1. Der Anbieter ist zur Laufzeit konfigurierbar (`ai_config`-Tabelle), nicht
   fest verdrahtet. Ein Betreiber kann ein lokales Modell hinterlegen.
2. Die KI ist **je Mandant abschaltbar und standardmäßig aus**
   (`tenants.ai_enabled` mit Vorgabewert `false`) — eine Übermittlung an einen
   Dritten geschieht nur nach ausdrücklicher Freigabe.
3. Der übergebene Text ist längenbegrenzt (`ai_config.max_input_chars`).

Diese Abwägung offen zu dokumentieren ist glaubwürdiger, als sie zu verschweigen.
Der Zwischenstand steht in [ki-abwaegung.md](ki-abwaegung.md) — einschliesslich
des Befunds, dass ein lokal betriebenes Modell auf der vorhandenen Hardware
erprobt wurde und für diese Aufgabe nicht ausreichte. Die Anbieterwahl ist noch
offen; sie gehört vor den Produktivbetrieb, nicht vor die Veröffentlichung des
Quelltextes.

## Mandantenmodell: eine Instanz, mehrere Mandanten

`tenant_id` liegt auf jeder Tabelle mit
Personenbezug; die Trennung wird über Row Level Security in Postgres erzwungen,
nicht in der Anwendungsschicht.

Die Alternative — eine Instanz je Mandant — wäre einfacher gewesen, hätte den
Anspruch aber ausgehöhlt: „Mandantentrennung auf Datenbankebene" reduzierte sich
damit auf „getrennte Server", und die pgTAP-Tests hätten keine fremden Zeilen,
gegen die sie prüfen könnten. Eine Trennung, die sich nicht prüfen lässt, ist
eine Behauptung.

### Innerhalb des Mandanten: Kunden

Ein **Mandant** betreibt das Ticketsystem. Ein **Kunde** (`customers`) wird damit
verwaltet: Für ihn werden Vorgänge geführt, und er wird sie abrechnen. Jedes
Ticket gehört zu genau einem Kunden, jeder Melder ebenfalls; Bearbeitung und
Verwaltung hängen am Mandanten und arbeiten quer über alle Kunden.

Die beiden Wörter meinen umgangssprachlich oft dasselbe. Die Festlegung steht
deshalb ausgeschrieben in [datenmodell.md](datenmodell.md).

> [!important] Der Kunde ist **keine** zweite Trennachse.
> `customer_id` ist eine Zuordnung, nicht `tenant_id` in klein. Ein Melder sieht
> die Vorgänge seiner Kolleginnen und Kollegen beim selben Kunden nicht — aber
> nicht, weil der Kunde sie trennte, sondern weil er ohnehin nur die selbst
> gemeldeten sieht.
>
> Wer daraus eine Sicherheitsgrenze macht, verlässt sich auf einen Schutz, den
> keine Policy gibt. Soll ein Melder später die Vorgänge seines Kunden sehen,
> ist das eine eigene Migration mit eigenen Tests — nicht ein erweitertes
> `USING`.

### Mandantenbezug in Policies

Policies schreiben ausnahmslos `tenant_id = (SELECT public.current_tenant_id())`.
Die Funktion kapselt den Zugriff:

```sql
CREATE FUNCTION public.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT tenant_id FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND deactivated_at IS NULL
  $$;
```

**Gegen einen Custom-JWT-Claim entschieden**, aus drei Gründen:

1. **Der naheliegende Performance-Einwand trifft nicht die Architektur, sondern
   die Formulierung.** Ein nacktes `EXISTS (SELECT 1 FROM profiles WHERE
id = auth.uid() …)` wird von Postgres pro Zeile ausgewertet. In `(SELECT …)`
   gewrappt entsteht ein InitPlan, der einmal je Abfrage läuft.
2. **Korrektheit schlägt Performance beim Zugriffsentzug.** Ein Claim wirkt erst
   nach dem Token-Refresh; ein deaktivierter Nutzer dürfte bis zu einer Stunde
   weiterlesen. Eine Stunde Nachlauf beim Zugriffsentzug ist nicht vertretbar.
3. **Die Funktion ist der Migrationspfad.** Wird die Instanz groß, ändert man
   _eine_ Funktion auf
   `COALESCE(auth.jwt() -> 'app_metadata' ->> 'tenant_id', <Subselect>)` —
   keine einzige Policy muss angefasst werden.

### Integrität zusätzlich in der Datenbank

`tenant_id` liegt denormalisiert auch auf `ticket_comments` und `time_entries`,
damit keine Policy über einen Join gehen muss. Dass die Denormalisierung nicht
auseinanderlaufen kann, sichert ein zusammengesetzter Fremdschlüssel:

```sql
FOREIGN KEY (tenant_id, ticket_id) REFERENCES tickets(tenant_id, id)
```

Ein Kommentar kann damit **per Datenbankconstraint** nicht zu einem Ticket eines
fremden Mandanten gehören — unabhängig davon, was die Anwendung versucht.

Dasselbe Muster trägt die Kundenebene:

```sql
FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id)
```

auf `tickets` und auf `profiles`. Ein Vorgang lässt sich damit nicht einem
Kunden eines fremden Betriebs zuordnen — in einer späteren Abrechnung landete er
sonst auf dessen Rechnung. Der Fall ist geprüft
(`220_mandantentrennung_integritaet.test.sql`), und zwar als `postgres` mit
`BYPASSRLS`: Die Zusicherung gilt auch dort, wo RLS nicht mehr hilft.

Ergänzend erzwingt ein `CHECK` auf `profiles`, dass Rolle und Kundenbindung
zusammenpassen:

```sql
CHECK ((role = 'requester') = (customer_id IS NOT NULL))
```

Er greift in beide Richtungen. Ein Rollenwechsel muss den Kunden deshalb im
selben Vorgang mitführen — es gibt keinen Zwischenzustand, in dem ein Bearbeiter
noch an einem Kunden hängt.

## Verteidigung in der Tiefe

Autorisierung findet auf drei Ebenen statt. Keine ist für sich allein
ausreichend:

| Ebene | Ort                                                  | Wirkung                                   |
| ----- | ---------------------------------------------------- | ----------------------------------------- |
| 1     | `src/proxy.ts`                                       | Session-Auffrischung, grober Routenschutz |
| 2     | Layout der geschützten Route Group                   | Rollenabhängige Weiterleitung             |
| 3     | `requireRole()` in **jeder** Server Action und Seite | Verbindliche Prüfung                      |
| 4     | **Row Level Security in Postgres**                   | Die eigentliche Sicherheitsgrenze         |

Die Middleware ist ausdrücklich **nie** die einzige Autorisierung — diese
Fehlerklasse hat mit CVE-2025-29927 einen prominenten Vertreter. Ebene 4 hält
auch dann, wenn die Ebenen 1 bis 3 umgangen werden.

> [!note] In Next.js 16 heißt die Middleware `src/proxy.ts`
> Mit `export function proxy(request)`, nicht `middleware.ts`. Die falsche Datei
> führt dazu, dass die Session nicht aufgefrischt wird — was im Alltag zunächst
> nicht auffällt. Deshalb ein E2E-Test auf Session-Persistenz
> (`e2e/sitzung.spec.ts`).

Ebene 2 hat eine Einschränkung, die man kennen muss: **Bei clientseitiger
Navigation zwischen Geschwisterseiten unter demselben Layout rendert Next das
Layout nicht neu.** Ein Wächter im Layout greift dann nicht. Er bleibt
trotzdem stehen, weil er den Direktaufruf früh abfängt — verbindlich ist aber
Ebene 3, und deshalb steht `requireRole()` als erste Anweisung in jeder Seite
**und** jeder Server Action, nicht nur in den Layouts.

## Die Oberfläche

28 Bildschirme, gebaut nach den Entwürfen aus dem Gestaltungsbriefing. Die
Bildschirme 26 bis 28 — Kundenliste, Kunde anlegen, Kunde bearbeiten — sind mit
der Kundenebene dazugekommen und folgen dem Zuschnitt der Nutzerverwaltung.

### Routengruppen

| Gruppe   | Inhalt                                     | Wächter                        |
| -------- | ------------------------------------------ | ------------------------------ |
| `(auth)` | Anmeldung, Passwort, MFA                   | keiner — muss öffentlich sein  |
| `(app)`  | alles Angemeldete                          | `requireRole()` je Seite       |
| `(dev)`  | Musterkatalog unter `/muster`              | `notFound()` in der Produktion |
| Wurzel   | `not-found.tsx`, Auth-Rückläufer, Abmelden | teils öffentlich               |

Die Segmente sind **englisch** (`/tickets`, `/time/tenant`, `/admin/customers`,
`/admin/members`).
Verzeichnisse im App Router sind Code, und die Regel des Projekts lautet
deutsche Oberflächentexte bei englischem Code. Beschriftet wird deutsch; das
entscheidet `src/lib/navigation.ts`, nicht der Verzeichnisname.

`/tickets` ist **eine** Route mit serverseitiger Rollenverzweigung, nicht zwei.
Ein Melder mit einem Lesezeichen darauf muss auf „Meine Meldungen" landen, nicht
auf 403 — und RLS garantiert ohnehin, dass er nur eigene Zeilen sieht.

### Ticketnummern sind mandantenlokal

`tickets/[number]` liest über `ticket_number` innerhalb des Mandanten. Eine
fremde Nummer liefert null Zeilen und damit `not-found.tsx` — **nicht**
„kein Zugriff". Der Unterschied ist die ganze Begründung für zwei getrennte
Fehlerseiten: „Kein Zugriff" verriete, dass es die Nummer anderswo gibt.

### Content-Security-Policy

Sie steht in `src/lib/security/csp.ts` als reine Funktion und wird in
`src/proxy.ts` gesetzt — nicht in `next.config.ts`, weil sie eine **Nonce je
Anfrage** trägt und ein statischer Header das nicht kann. Die übrigen fünf
Sicherheits-Header bleiben in `next.config.ts`; sie ändern sich nie.

Zwei Entscheidungen darin sind erklärungsbedürftig:

- **Skripte bekommen eine Nonce, nie `'unsafe-inline'`.** Der App Router
  streamt seine Nutzlast über eingebettete `<script>`-Elemente; ohne Nonce
  bleibt die Seite weiss. Next liest die Nonce aus dem
  `Content-Security-Policy`-Header der **eingehenden** Anfrage — deshalb setzt
  der Proxy ihn auf Anfrage und Antwort.
- **`style-src-attr 'unsafe-inline'` ist eine Wiederherstellung, keine
  Aufweichung.** Sobald `style-src` eine Nonce trägt, entfällt der
  stillschweigende Rückfall für Stil-Attribute — und die Anwendung setzt
  Spaltenvorlagen, die KI-Schraffur und den Pfeil des Auswahlfelds als
  Attribut. Für `<style>`-**Elemente** bleibt die Regel dadurch strenger als
  ein pauschales `'unsafe-inline'`.

`CSP_REPORT_ONLY=true` schaltet auf Beobachten um. Die Vorgabe ist scharf.

### Kein Dunkelmodus in Release 1

Das Gestaltungsbriefing hatte einen Dunkelmodus vorgesehen; die Entwürfe haben
ihn zurückgenommen. Die Tokens dafür stehen in `globals.css` **auskommentiert
mit Begründung** — nicht gelöscht, damit die spätere Entscheidung nicht bei
null anfängt, und nicht aktiv, damit niemand eine Fassung pflegt, die niemand
prüft.

## Der Service-Role-Key umgeht RLS

Jeder Aufruf von `createAdminClient()` ist eine potenzielle Mandantenlücke, weil
der Service-Role-Key sämtliche Policies umgeht. Vier Maßnahmen greifen
gleichzeitig:

- `import "server-only"` in `src/lib/supabase/admin.ts` — der Import aus einer
  Client-Komponente bricht den Build
- Die Umgebungsvariable trägt **kein** `NEXT_PUBLIC_`-Präfix
- Eine eigene Semgrep-Regel meldet Aufrufe außerhalb von `src/lib/**` und
  `src/actions/**`
- Der CI-Job `bundle-secrets` durchsucht `.next/static` nach Schlüsselmustern

Wo der Admin-Client eingesetzt wird, steht **im Code begründet**, warum die
Autorisierung stattdessen beim `requireRole()` der aufrufenden Stelle liegt.
