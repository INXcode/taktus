# Zugriffsmatrix

> Diese Matrix und `supabase/tests/` sind deckungsgleich zu halten. Eine
> Zugriffsregel, die hier steht, aber nicht geprüft wird, ist eine Behauptung —
> und eine, die geprüft wird, aber hier fehlt, ist eine unbemerkte Entscheidung.
>
> Aktueller Stand: **130 pgTAP-Zusicherungen in 14 Dateien**, ausgeführt über
> `pnpm db:test` und im CI-Job `datenbank`.

## Rollen

| Rolle       | Aufgabe                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `admin`     | Verwaltet den Mandanten: Kunden, Profile, Rollen, Aufbewahrungsfristen, KI-Freigabe. Liest das Protokoll              |
| `agent`     | Bearbeitet Tickets, ordnet sie Kunden zu, bucht eigene Zeiten, liest die Gesamtzeiten                                 |
| `requester` | Meldet Tickets, sieht **nur die eigenen**, gehört zu **genau einem Kunden**, hat **keinen** Zugriff auf Zeitbuchungen |

**Es gibt bewusst keine mandantenübergreifende Rolle.** Jede solche Rolle wäre
eine Ausnahme in der Mandantentrennung, die in jeder Policy gesondert zu
behandeln wäre — also genau die Stelle, an der eine Trennung erfahrungsgemäss
bricht. Der Instanzbetreiber arbeitet über `service_role`, ausserhalb des
Rollenmodells der Anwendung.

**Und es gibt bewusst keine Trennung nach Kunden.** Der Kunde ist eine
Zuordnung — für wen ein Vorgang läuft und wer ihn abrechnet — keine
Sichtbarkeitsgrenze. Ein Melder sieht nur die selbst gemeldeten Vorgänge; dass
sie zufällig alle zu seinem Kunden gehören, ist eine Folge, keine Regel. Wer das
verwechselt, hält eine Zuordnung für einen Schutz. Einzige Ausnahme ist die
Lesbarkeit des Kundenstamms selbst: Ein Melder sieht dort genau eine Zeile,
seinen eigenen Kunden, damit „Mein Profil" einen Namen nennen kann statt einer
Kennung.

`anon` hat auf keiner Tabelle irgendein Recht.

## Matrix

S = SELECT · I = INSERT · U = UPDATE · D = DELETE · — = kein Zugriff

| Tabelle           | `admin` (eigener Mandant)             | `agent`                  | `requester`                                                  | **fremder Mandant** |
| ----------------- | ------------------------------------- | ------------------------ | ------------------------------------------------------------ | ------------------- |
| `tenants`         | S, U                                  | S                        | S                                                            | **—**               |
| `customers`       | S, I, U                               | S                        | S nur den eigenen                                            | **—**               |
| `profiles`        | S, I, U                               | S                        | S nur eigenes, U nur eigenes (ohne Rolle, Mandant und Kunde) | **—**               |
| `tickets`         | S, I, U, D                            | S, I, U                  | S/U nur wo `created_by = self` und `status = open`, I        | **—**               |
| `ticket_comments` | S, I, U alle, D                       | S, I, U nur eigene       | S/I nur zu eigenen Tickets                                   | **—**               |
| `time_entries`    | S alle, I nur eigene, U/D auch fremde | S alle, I/U/D nur eigene | **kein Zugriff**                                             | **—**               |
| `audit_log`       | S                                     | —                        | —                                                            | **—**               |
| `ai_config`       | —                                     | —                        | —                                                            | **—**               |

**Die letzte Spalte ist der Testschwerpunkt: Jede Zelle darin muss leer sein.**

`ai_config` ist für jede Anwendungsrolle unerreichbar — nicht durch RLS, sondern
durch entzogene Tabellenrechte. Der Unterschied ist bemerkenswert: RLS filtert
ein `SELECT` stumm auf null Zeilen, ein fehlendes Tabellenrecht wirft. Für den
Zugangsschlüssel des Betreibers ist „gibt es nicht" die ehrlichere Antwort als
„ist leer".

### Warum die Verwaltung fremde Beiträge und Buchungen ändern darf

Ursprünglich durfte sie es nicht, und die Begründung war die Beweiskraft: Ein
Verlauf, den ein Dritter nachträglich verändern kann, taugt weder als Nachweis
noch als Gedächtnis. Der vorgesehene Ausweg lautete löschen und neu anlegen
lassen.

Der Ausweg trägt nicht. Ein Tippfehler in einem Kommentar bleibt damit stehen,
bis dessen Urheber Zeit hat — und eine falsche Buchung verschwindet entweder
ganz aus der Auswertung oder gar nicht. Die Verantwortung für die Daten eines
Mandanten liegt aber bei dessen Verwaltung.

Die Erlaubnis kommt deshalb nicht allein, sondern mit dem Teil der alten Regel,
der die Beweiskraft tatsächlich trug — der **Zurechnung**:

| Was                                             | Wodurch                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| Urheber und buchende Person sind unveränderlich | Trigger `ticket_comments_before_update`, `time_entries_before_update` |
| Mandant und Ticket bleiben fest                 | dieselben Trigger                                                     |
| Jede Änderung ist zurechenbar                   | `log_audit` mit Akteur und Feldnamen — ohne Inhalte                   |
| Eine Berichtigung ist sichtbar                  | `updated_at`; die Oberfläche vermerkt „berichtigt"                    |

**Der Bearbeiter bekommt die Erlaubnis nicht.** Die Grenze zwischen Bearbeiter
und Verwaltung innerhalb eines Mandanten ist die schärfste im Schema und der
eigentliche Beleg dafür, dass hier mehr geprüft wird als eine Mandantentrennung.

> [!note] Warum ein Trigger und keine `WITH CHECK`-Klausel
> Eine Policy sieht ausschließlich die neue Zeile. „Dieser Wert darf sich nicht
> ändern" lässt sich darin gar nicht formulieren — dafür braucht es den
> Vergleich mit `OLD`, und den gibt es nur im Trigger. Der gilt zudem für jeden
> Weg in die Tabelle, nicht nur für den der Anwendung.

## Drei Fallstricke, die hier tatsächlich zugeschlagen haben

### 1. `WITH CHECK` wird oder-verknüpft — die schwächste Klausel entscheidet

Bei mehreren permissiven Policies verknüpft Postgres die `USING`-Klauseln mit
ODER **und die `WITH CHECK`-Klauseln separat ebenfalls mit ODER**. Eine Zeile
darf geschrieben werden, wenn _irgendeine_ Policy sie sichtbar macht und
_irgendeine_ `WITH CHECK`-Klausel den neuen Zustand erlaubt. Beide Seiten müssen
nicht aus derselben Policy stammen.

Das war ein echter Fehler in diesem Schema: `tickets_update_mandant` prüfte in
`WITH CHECK` zunächst nur `tenant_id`, ohne die Rollenbedingung zu wiederholen.
Ein Melder kam über die `USING`-Klausel von `tickets_update_eigene` an sein
Ticket heran und schrieb den neuen Zustand dann an der schwächeren Klausel
vorbei — womit er sein eigenes Ticket schliessen und die Aufbewahrungsfrist
starten konnte.

**Regel: Die Rollenbedingung steht in `USING` UND in `WITH CHECK`.** Das sieht
nach Redundanz aus und ist keine.

Gefunden hat das ein Test, nicht ein Review.

### 2. Verweigertes Lesen wirft nicht

RLS filtert ein `SELECT` **stumm**: Die Abfrage gelingt und liefert null Zeilen.
Dasselbe gilt für ein `UPDATE` auf eine über `USING` unsichtbare Zeile — es
trifft null Zeilen, ohne Fehler.

`42501` entsteht nur, wenn die Zeile über `USING` sichtbar ist und der **neue**
Zustand gegen `WITH CHECK` verstösst.

| Fall                                 | Assertion                                      |
| ------------------------------------ | ---------------------------------------------- |
| `SELECT` verweigert                  | `is_empty(...)`                                |
| `UPDATE` trifft unsichtbare Zeile    | Wirkung prüfen: Wert danach unverändert        |
| `INSERT`/`UPDATE` gegen `WITH CHECK` | `throws_ok(..., '42501')`                      |
| Entzogenes Tabellenrecht             | `throws_ok(..., '42501')` — auch beim `SELECT` |
| Erlaubt                              | `results_eq(...)` / `lives_ok(...)`            |

Wer verweigertes Lesen mit `throws_ok` prüft, schreibt einen Test, der immer
fehlschlägt. Wer es mit `lives_ok` prüft, einen, der nie etwas findet.

### 3. `FORCE ROW LEVEL SECURITY` und `SECURITY DEFINER`

Alle Mandantentabellen tragen `FORCE ROW LEVEL SECURITY` — sonst umginge der
Tabelleneigentümer die Policies, und eine Regel, die im Test greift, wirkte im
Betrieb nicht.

Das wirft die Frage auf, warum `current_tenant_id()` dann nicht in eine
Rekursion läuft, wenn eine Policy auf `profiles` die Funktion aufruft, die
`profiles` liest. Antwort: Die Funktion läuft als `SECURITY DEFINER` mit dem
Eigentümer `postgres`, und dieser Rolle ist `BYPASSRLS` zugeordnet. **`BYPASSRLS`
schlägt `FORCE ROW LEVEL SECURITY`.**

Das ist eine Eigenschaft der Rolle, keine des SQL-Standards — und damit etwas,
das sich mit einer künftigen Supabase-Version ändern könnte. Deshalb prüft
`supabase/tests/010_zugriffshelfer.test.sql` es ausdrücklich, statt sich darauf
zu verlassen.

## Zuordnung Test zu Regel

| Testdatei                                    | Prüft                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `000_setup.sql`                              | Testbasis: pgTAP, Hilfsfunktionen, Testdaten                                                                          |
| `010_zugriffshelfer.test.sql`                | Fail-closed der Helfer; sofortige Wirkung von Deaktivierung und Mandantensperre                                       |
| `100_rls_meta.test.sql`                      | **Strukturell über alle Tabellen** — siehe unten                                                                      |
| `110_profiles_rls.test.sql`                  | Rechteausweitung: Selbstbeförderung, Mandantenwechsel, Selbstreaktivierung                                            |
| `120_tickets_rls.test.sql`                   | Mandantengrenze, IDOR mit bekannter Kennung, Rollengrenze, Ticketnummern je Mandant                                   |
| `130_ticket_comments_rls.test.sql`           | Sichtbarkeit über das eigene Ticket; Berichtigung nur durch Urheber und Verwaltung; feste Zurechnung; Kaskade         |
| `140_time_entries_rls.test.sql`              | Melder ohne jeden Zugriff; keine Buchung im fremden Namen; Korrektur durch die Verwaltung ohne Umschreiben der Person |
| `150_audit_log_rls.test.sql`                 | Nur anhängend; einziger Weg über `log_audit()`                                                                        |
| `160_ai_config_rls.test.sql`                 | Unerreichbar für jede Anwendungsrolle; getrennte Freigabe je Mandant                                                  |
| `170_funktionsrechte.test.sql`               | `EXECUTE` auf den `SECURITY DEFINER`-Funktionen; Selbstprüfung in deren Rumpf                                         |
| `180_customers_rls.test.sql`                 | Mandantengrenze am Kundenstamm; Anlegen nur durch die Verwaltung; Melder sieht genau den eigenen Kunden               |
| `200_aufbewahrung.test.sql`                  | Tatsächliche Löschung; offene Vorgänge bleiben                                                                        |
| `210_auskunft.test.sql`                      | Vollständigkeit des Exports; keine Auskunft über die Mandantengrenze                                                  |
| `220_mandantentrennung_integritaet.test.sql` | Zusammengesetzte Fremdschlüssel — wirken auch ohne RLS                                                                |

## Der Meta-Test fängt, woran niemand gedacht hat

`100_rls_meta.test.sql` prüft nicht eine Tabelle, sondern **alle** — und zwar
als Ausschlussprüfung, deren Ergebnismenge leer sein muss. Eine neue Tabelle
taucht dort automatisch auf; niemand muss den Test erweitern.

1. Jede Tabelle in `public` hat RLS aktiviert
2. Jede Tabelle hat `FORCE ROW LEVEL SECURITY`
3. Jede Tabelle hat mindestens eine Policy — ausser `ai_config` auf der
   ausdrücklichen Ausnahmeliste
4. Keine Policy gilt für `PUBLIC` (das schlösse `anon` ein)
5. Jede Tabelle mit `tenant_id` hat einen Index mit `tenant_id` als erster
   Spalte — sonst wird aus der Trennung ein voller Tabellendurchlauf je Abfrage
6. Keine `SECURITY DEFINER`-Funktion ohne festgelegten `search_path`

Der typische Weg zur Datenpanne ist nicht die falsch geschriebene Policy — die
fällt beim Schreiben auf. Es ist die neue Tabelle, bei der jemand unter
Zeitdruck `ENABLE ROW LEVEL SECURITY` vergessen hat.

## Gegenprobe

Ein Testsatz, der nie rot war, sagt wenig. Gegenprobe:

```sql
ALTER POLICY tickets_select_mandant ON public.tickets USING (true);
```

Ergebnis: **sieben Zusicherungen schlagen fehl**, darunter beide
Mandantengrenzen (`120`, Test 1 und 2), die Rollentrennung (Test 5–7) sowie die
sofortige Wirkung von Deaktivierung und Mandantensperre (`010`, Test 9 und 11).

Diese Gegenprobe gehört bei jeder wesentlichen Änderung am Rollenmodell
wiederholt. Mit der Kundenebene ist sie ein zweites Mal geführt worden:

```sql
ALTER POLICY customers_select_eigener ON public.customers USING (true);
```

Ergebnis: **sechs von elf Zusicherungen in `180_customers_rls.test.sql` schlagen
fehl** — beide Mandantengrenzen samt IDOR-Fall, die Zählungen für Verwaltung und
Bearbeitung, und vor allem die beiden letzten: dass ein Melder genau eine Zeile
sieht und den zweiten Kunden **seines eigenen Mandanten** nicht.

Der letzte Punkt ist der eigentliche Zugewinn dieser Runde. Er lässt sich erst
prüfen, seit die Testbasis zwei Kunden mit je einem Melder im selben Mandanten
anlegt; vorher wäre „sieht nur den eigenen Kunden" nicht von „sieht alles seines
Mandanten" zu unterscheiden gewesen.
