# Datenmodell und Zweckbindung

> **Die Regel dieses Dokuments:** Jede Spalte hat hier eine Zeile mit ihrem
> Zweck. Was sich hier nicht begründen lässt, existiert nicht im Schema.
>
> Das ist keine Dokumentationspflicht, sondern die Umsetzung der
> Datenminimierung aus Art. 5 Abs. 1 lit. c DSGVO. Ein Feld „für später" gibt
> es nicht — es wäre eine Erhebung ohne Zweck.
>
> Quelle: `supabase/migrations/`. Zugriffsregeln: [rls-matrix.md](rls-matrix.md).
> Löschung: [loeschkonzept.md](loeschkonzept.md).

## Begriffe: Mandant und Kunde

Zwei Wörter, die umgangssprachlich dasselbe meinen können und hier ausdrücklich
nicht dasselbe meinen. Ohne diese Festlegung liest sich das halbe Schema falsch.

| Begriff     | Tabelle     | Bedeutung                                                                                                                   |
| ----------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Mandant** | `tenants`   | Wer das Ticketsystem **betreibt**. Trennt auf derselben Instanz Betriebe voneinander. Die Trennachse der gesamten Anwendung |
| **Kunde**   | `customers` | Wer mit dem Ticketsystem **verwaltet** wird. Für ihn werden Vorgänge geführt, und er wird sie abrechnen                     |

Die Beziehung ist einstufig: Ein Mandant hat Kunden, ein Kunde gehört zu genau
einem Mandanten. Ein Ticket gehört zu genau einem Kunden, ein Melder ebenfalls.
Bearbeitung und Verwaltung hängen dagegen am Mandanten — sie arbeiten quer über
alle Kunden.

> [!important] Der Kunde ist keine Sicherheitsgrenze.
> Die Trennachse bleibt der Mandant, und zwar allein. Ein Melder sieht die
> Vorgänge seiner Kolleginnen und Kollegen beim selben Kunden **nicht** — nicht
> weil der Kunde sie trennte, sondern weil er nur die selbst gemeldeten sieht.
>
> Das ist eine Entscheidung, keine Auslassung. Eine zweite Trennachse müsste in
> jeder Policy, in jedem zusammengesetzten Fremdschlüssel und in jedem Test
> mitgeführt werden; sie nachträglich einzuziehen ist eine eigene Migration mit
> eigenen Tests, nicht ein aufgeweichtes `USING`.

## Was das Schema NICHT enthält

Aussagekräftiger als die Liste der Felder ist die Liste dessen, was bewusst
fehlt. Diese Entscheidungen sind der eigentliche Beleg.

| Nicht vorhanden                            | Warum                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`profiles.email`**                       | Die Adresse liegt in `auth.users`. Eine Kopie wäre eine zweite Speicherung personenbezogener Daten ohne eigenen Zweck — und ein zweiter Ort, der beim Löschen und bei der Auskunft bedacht werden müsste. Der Preis: Die Anzeige läuft serverseitig über die Admin-Schnittstelle statt über einen Join. Das ist umständlicher und beabsichtigt. |
| **Start- und Endzeitpunkt der Arbeit**     | `time_entries` speichert Dauer plus Tag. Minutengenaue Zeitpunkte erlaubten die Rekonstruktion von Arbeitsbeginn, Pausenlage und Arbeitsende — eine Verhaltens- und Leistungskontrolle, in Betrieben mit Betriebsrat mitbestimmungspflichtig. Für die Auswertung „Aufwand je Ticket" genügt die Dauer.                                          |
| **Feldinhalte im Protokoll**               | `audit_log` speichert nur `changed_fields`, also Namen. `old_value`/`new_value`/`payload` wären eine zweite, typischerweise länger aufbewahrte Kopie aller personenbezogenen Daten — die in keinem Löschkonzept auftaucht und bei der Auskunft vergessen wird.                                                                                  |
| **IP-Adresse, User-Agent**                 | Personenbezogene Daten mit eigener Rechtsgrundlagenfrage. Zur Frage „wer hat was geändert" tragen sie nichts bei — der Handelnde steht in `actor_id`.                                                                                                                                                                                           |
| **Kontaktdaten am Ticket**                 | Ein Ticket trägt eine Zuordnung zu einem Kunden (`customer_id`), aber keine Anschrift, keine Rufnummer und keinen Ansprechpartner. Wer meldet, steht in `created_by`. Ein Freitextfeld für Kontaktdaten wäre der schnellste Weg zu unkontrolliertem Personenbezug.                                                                              |
| **Stammdaten am Kunden**                   | `customers` trägt einen Namen und ein Aktiv-Kennzeichen. Anschrift, Steuernummer, Ansprechpartner und Notizfeld gäbe es erst mit einer Rechnungsstellung zu begründen — und ein Notizfeld neben einem Firmennamen füllt sich binnen Wochen mit Namen, Durchwahlen und Krankmeldungen.                                                           |
| **`tickets.priority`, `tickets.due_date`** | Ohne Auswertung, die sie nutzt, sind das Felder „für später".                                                                                                                                                                                                                                                                                   |
| **`time_entries.billable`**                | Hätte nur mit einer Rechnungsstellung einen Zweck — die ist nicht Teil von Release 1.                                                                                                                                                                                                                                                           |
| **`ticket_comments.is_internal`**          | Es gibt keine externen Nutzer, also keinen Adressatenkreis, vor dem etwas zu verbergen wäre. Ein Flag, das nichts trennt, ist eines, auf das man sich später fälschlich verlässt.                                                                                                                                                               |
| **`tenants`: Anschrift, USt-ID, Slug**     | Erst mit einer Rechnungsstellung begründbar.                                                                                                                                                                                                                                                                                                    |

---

## `tenants` — Mandant

Kein Personenbezug.

| Spalte                     | Typ                     | Zweck                                                                                                 |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`                       | uuid                    | Schlüssel. Achse der gesamten Mandantentrennung                                                       |
| `name`                     | text                    | Anzeige                                                                                               |
| `is_active`                | bool                    | Sperrung ohne Löschung — Einschränkung der Verarbeitung, Art. 18 DSGVO                                |
| `ai_enabled`               | bool, **Vorgabe false** | Freigabe der KI je Mandant. Eine Übermittlung an einen Dritten darf nicht durch Untätigkeit entstehen |
| `ticket_retention_days`    | int, Vorgabe 730        | Aufbewahrung ab `tickets.closed_at`. Ohne dieses Feld wäre das Löschkonzept nicht umsetzbar           |
| `audit_retention_days`     | int, Vorgabe 365        | Aufbewahrung der Protokolleinträge                                                                    |
| `created_at`, `updated_at` | timestamptz             | Nachvollziehbarkeit                                                                                   |

## `customers` — Kunde

Kein Personenbezug. Ein Kunde ist eine Organisation, kein Mensch — deshalb steht
er nicht im Auskunftsexport als eigener Bereich, sondern nur als Angabe im
Profil des Melders, der zu ihm gehört.

| Spalte                     | Typ                | Zweck                                                                                                                                    |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | uuid               | Schlüssel                                                                                                                                |
| `tenant_id`                | uuid               | Mandantenzuordnung. Grundlage jeder Policy                                                                                               |
| `name`                     | text               | Anzeige an jedem Vorgang. Eindeutig je Mandant — zwei gleichnamige Kunden wären in keiner Auswahlliste zu unterscheiden                  |
| `is_active`                | bool, Vorgabe true | Stilllegung ohne Löschung: keine neuen Vorgänge, bestehende bleiben zugeordnet. Ein Kunde wird nie gelöscht, es gibt keine DELETE-Policy |
| `created_at`, `updated_at` | timestamptz        | Nachvollziehbarkeit                                                                                                                      |

## `profiles` — Nutzerprofil

**Personenbezug: ja.** Rechtsgrundlage beim Betreiber: Vertragserfüllung bzw.
Beschäftigtenverhältnis.

| Spalte                     | Typ                 | Zweck                                                                                                                                               |
| -------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | uuid → `auth.users` | Identität. Kein eigener Schlüssel, damit beide nicht auseinanderlaufen können                                                                       |
| `tenant_id`                | uuid                | Mandantenzuordnung. Grundlage jeder Policy                                                                                                          |
| `role`                     | `app_role`          | Rechtezuweisung                                                                                                                                     |
| `customer_id`              | uuid, NULL erlaubt  | Kunde, für den ein **Melder** Vorgänge meldet. Bei Bearbeitung und Verwaltung NULL — sie hängen am Mandanten. Ein `CHECK` erzwingt beide Richtungen |
| `display_name`             | text                | Anzeige in Tickets, Kommentaren, Zeitauswertung                                                                                                     |
| `deactivated_at`           | timestamptz         | Sofortiger Zugriffsentzug ohne Datenverlust                                                                                                         |
| `created_at`, `updated_at` | timestamptz         | Nachvollziehbarkeit                                                                                                                                 |

## `tickets` — Vorgang

**Personenbezug: mittelbar**, über `created_by` und `assignee_id`. Der Freitext
in `description` kann personenbezogene Angaben enthalten — das ist der Grund für
die Aufbewahrungsfrist.

| Spalte                        | Typ                | Zweck                                                                                                                                                                                            |
| ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                          | uuid               | Schlüssel                                                                                                                                                                                        |
| `tenant_id`                   | uuid               | Mandantentrennung                                                                                                                                                                                |
| `ticket_number`               | int                | Kurzreferenz für Menschen, fortlaufend **je Mandant** — nicht je Kunde. Global fortlaufend verriete das Vorgangsaufkommen der übrigen Mandanten                                                  |
| `customer_id`                 | uuid, **NOT NULL** | Für wen der Vorgang geführt wird. Grundlage jeder späteren Abrechnung; ohne ihn liesse sich ein Vorgang niemandem zuordnen. Beim Melder setzt ihn ein Trigger aus dem Profil, nicht das Formular |
| `title`, `description`        | text               | Sachverhalt                                                                                                                                                                                      |
| `status`                      | `ticket_status`    | Bearbeitungsstand                                                                                                                                                                                |
| `category`                    | `ticket_category`  | Einordnung. Zugleich der Wertebereich, den die KI vorschlagen darf                                                                                                                               |
| `assignee_id`, `created_by`   | uuid               | Zuständigkeit und Urheberschaft                                                                                                                                                                  |
| `ai_summary`                  | text               | Vorschlag des Modells. In der Oberfläche als solcher gekennzeichnet, nie automatisch übernommen                                                                                                  |
| `ai_model`, `ai_generated_at` | text, timestamptz  | **Herkunftsnachweis.** Ohne beide liesse sich später nicht sagen, worauf ein Vorschlag beruhte — Rechenschaftspflicht, Art. 5 Abs. 2 DSGVO                                                       |
| `ai_marked_fields`            | text[]             | Welche Felder das Modell zuletzt änderte. Speichern durch einen Menschen entfernt den Eintrag = geprüft                                                                                          |
| `closed_at`                   | timestamptz        | **Startpunkt der Löschfrist.** Per Trigger aus dem Status abgeleitet, damit der Fristbeginn nicht an der Sorgfalt der Anwendung hängt                                                            |
| `created_at`, `updated_at`    | timestamptz        | Nachvollziehbarkeit                                                                                                                                                                              |

## `ticket_comments` — Beitrag

**Personenbezug: ja**, über `author_id` und den Freitext in `body`.

| Spalte                     | Typ         | Zweck                                                                                          |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `id`                       | uuid        | Schlüssel                                                                                      |
| `tenant_id`                | uuid        | Mandantentrennung. Denormalisiert, per zusammengesetztem Fremdschlüssel an das Ticket gebunden |
| `ticket_id`                | uuid        | Zuordnung. `ON DELETE CASCADE`                                                                 |
| `author_id`                | uuid        | Urheberschaft. Nach dem Anlegen unveränderlich (Trigger)                                       |
| `body`                     | text        | Beitrag                                                                                        |
| `created_at`, `updated_at` | timestamptz | Nachvollziehbarkeit. `updated_at > created_at` heisst: berichtigt                              |

Die Verwaltung darf fremde Beiträge berichtigen, ein Bearbeiter nicht — und
niemand kann einen Beitrag jemand anderem zuschreiben. Begründung und
Absicherung stehen in [rls-matrix.md](rls-matrix.md).

## `time_entries` — Zeitbuchung

**Personenbezug: ja.** Zugleich der Bereich mit dem grössten Missbrauchspotenzial
— siehe die Vorbemerkung zur bewussten Ungenauigkeit.

| Spalte                     | Typ                | Zweck                                                      |
| -------------------------- | ------------------ | ---------------------------------------------------------- |
| `id`                       | uuid               | Schlüssel                                                  |
| `tenant_id`                | uuid               | Mandantentrennung                                          |
| `ticket_id`                | uuid, **NOT NULL** | Bezug. Ticketfreie Buchungen sind nicht Teil von Release 1 |
| `user_id`                  | uuid               | Wer gebucht hat. Nach dem Anlegen unveränderlich (Trigger) |
| `minutes`                  | int, 1–1440        | Dauer. Obergrenze fängt den vertippten Faktor ab           |
| `worked_on`                | **date**           | Tag — bewusst nicht Zeitpunkt                              |
| `note`                     | text               | Kurze Erläuterung                                          |
| `created_at`, `updated_at` | timestamptz        | Nachvollziehbarkeit                                        |

## `audit_log` — Protokoll

**Personenbezug: ja**, über `actor_id`. Nur anhängend: keine UPDATE-, keine
DELETE-Policy.

| Spalte                     | Typ                       | Zweck                                                                                                                                     |
| -------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | bigint                    | Schlüssel                                                                                                                                 |
| `tenant_id`                | uuid                      | Mandantentrennung                                                                                                                         |
| `actor_id`                 | uuid, ohne Fremdschlüssel | Handelnde Person. NULL = System oder anonymisiert. **Bewusst ohne Fremdschlüssel**, damit der Eintrag die Löschung des Profils überdauert |
| `action`                   | text                      | Was geschah, etwa `ticket.update`                                                                                                         |
| `entity_type`, `entity_id` | text, uuid                | Woran                                                                                                                                     |
| `changed_fields`           | text[]                    | **Nur Namen, keine Werte**                                                                                                                |
| `occurred_at`              | timestamptz               | Wann                                                                                                                                      |

## `ai_config` — KI-Konfiguration

Kein Personenbezug. Genau eine Zeile. RLS aktiv und **ohne jede Policy** —
erreichbar ausschliesslich über `service_role`.

| Spalte              | Typ                 | Zweck                                                                                                                                       |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | smallint, CHECK = 1 | Erzwingt die Einzelzeile                                                                                                                    |
| `enabled`           | bool, Vorgabe false | Hauptschalter des Betreibers                                                                                                                |
| `provider`          | `ai_provider`       | Anbieter. `openai_compatible` erlaubt ein selbst betriebenes Modell — die praktische Umsetzung der Souveränitätsanforderung                 |
| `base_url`, `model` | text                | Adresse und Modellkennung. Datenfelder statt Konstanten: Modelle werden häufiger abgelöst als Anwendungen ausgeliefert                      |
| `api_key`           | text                | Zugangsschlüssel des Betreibers. Auch einem Mandanten-Administrator nicht zugänglich — er könnte sonst auf fremde Rechnung Anfragen stellen |
| `max_input_chars`   | int, Vorgabe 8000   | Datenminimierung vor der Übermittlung und zugleich Kostenbremse                                                                             |

---

## Die beiden KI-Entscheidungen sind bewusst getrennt

**WOMIT** verarbeitet wird — Anbieter, Modell, Schlüssel — entscheidet der
Instanzbetreiber in `ai_config`.

**OB** verarbeitet wird, entscheidet der Mandant in `tenants.ai_enabled`, mit
dem Vorgabewert `false`.

Ein Betreiber, der einen Schlüssel hinterlegt, hat damit noch nicht die
Einwilligung seiner Mandanten. Und ein Mandant, der zustimmt, soll nicht wählen
können, an welches Unternehmen die Daten gehen.

## Wenn ein Feld hinzukommt

1. Zeile in dieser Datei — mit Zweck, nicht mit Beschreibung
2. Personenbezug? Dann gehört das Feld in `export_person_data()` und in
   [loeschkonzept.md](loeschkonzept.md)
3. Freitext? Dann prüfen, ob eine Aufbewahrungsfrist greift
4. Der Pull Request wird ohne diese Zeile nicht zusammengeführt
