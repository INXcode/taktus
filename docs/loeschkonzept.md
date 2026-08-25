# Löschkonzept

> Grundsatz des Projekts: „Löschkonzept von Anfang an: Löschfristen definiert,
> **Löschung tatsächlich implementiert, nicht nur ein Flag**."
>
> Dieses Dokument beschreibt, was gelöscht wird, wann, und wodurch das belegt
> ist. Datenmodell: [datenmodell.md](datenmodell.md).

## Der Unterschied, auf den es ankommt

Ein `deleted_at`-Kennzeichen ist keine Löschung, sondern eine Ausblendung. Die
Daten liegen weiter in der Tabelle, sind bei einem Auskunftsersuchen
herauszugeben und tauchen im nächsten Backup wieder auf. Es sieht nur aus wie
eine Löschung.

`public.purge_expired_data()` führt `DELETE` aus.

Belegt wird das nicht dadurch, dass die Funktion fehlerfrei durchläuft, sondern
dadurch, dass Zeilen **verschwinden** — `supabase/tests/200_aufbewahrung.test.sql`
prüft den Zustand danach. Der Unterschied ist praktisch bedeutsam: Eine
`SECURITY DEFINER`-Funktion gegen eine Tabelle mit `FORCE ROW LEVEL SECURITY`
kann still null Zeilen löschen und trotzdem erfolgreich zurückkehren. Ein Test
mit `lives_ok` allein wäre grün, während das Löschkonzept nichts tut.

## Fristen

Je Mandant konfigurierbar, weil die angemessene Frist vom Mandanten abhängt und
ein Betreiber sie belegen können muss.

| Daten                                      | Frist                           | Beginn                  | Vorgabe  |
| ------------------------------------------ | ------------------------------- | ----------------------- | -------- |
| Tickets samt Kommentaren und Zeitbuchungen | `tenants.ticket_retention_days` | `tickets.closed_at`     | 730 Tage |
| Protokolleinträge                          | `tenants.audit_retention_days`  | `audit_log.occurred_at` | 365 Tage |

### Der Fristbeginn ist der Abschluss, nicht die Anlage

Ein Ticket, das seit Jahren offen ist, wird **nicht** gelöscht. Es gibt keinen
Fristbeginn, solange der Vorgang läuft — ein unerledigter Vorgang darf nicht
wegen Zeitablaufs verschwinden.

Damit das nicht an der Sorgfalt der Anwendung hängt, leitet ein
BEFORE-UPDATE-Trigger `closed_at` aus dem Status ab: Schliessen setzt den
Zeitpunkt, Wiedereröffnen setzt ihn zurück. Eine CHECK-Bedingung koppelt beide
zusätzlich aneinander.

Ohne diese Kopplung entstünde ein geschlossenes Ticket ohne `closed_at` — also
eines, dessen Frist nie beginnt. Eine stille, unbefristete Speicherung, die
niemandem auffiele.

Geprüft in `220_mandantentrennung_integritaet.test.sql`.

## Was mit dem Ticket verschwindet

Über `ON DELETE CASCADE`:

- `ticket_comments` — Freitext, häufig mit Personenbezug
- `time_entries` — wer wann wie lange

Ohne die Kaskade bliebe ein Kommentar ohne Ticket zurück: personenbezogener
Freitext, den danach kein Löschkonzept mehr erfasst, weil ihn niemand mehr
findet.

## Ein Kunde wird nicht gelöscht

`customers` hat **keine DELETE-Policy**, und der Fremdschlüssel von `tickets`
und `profiles` steht auf `ON DELETE RESTRICT`. Beides zusammen heisst: Ein
Kunde, an dem Vorgänge oder Melder hängen, lässt sich nicht entfernen — auch
nicht über den Service-Role-Schlüssel.

Das ist Absicht und die genaue Umkehrung der Ticket-Kaskade. Ein Ticket ist ein
Vorgang mit Frist; ein Kunde ist ein Stammdatum. Ein Kaskadenlöschen risse
Tickets, Kommentare und Zeitbuchungen mit — an der Aufbewahrungsfrist vorbei,
und ohne dass es im Protokoll als Löschung erschiene. Ein `RESTRICT` weist den
Versuch ab, statt ihn stillschweigend auszuweiten.

Statt zu löschen wird **stillgelegt** (`is_active = false`): keine neuen
Vorgänge, bestehende bleiben zugeordnet und lesbar. Die Vorgänge selbst
verschwinden dann über ihre eigene Frist, und mit dem letzten von ihnen wäre der
Kunde theoretisch löschbar — praktisch ist er dann nur noch ein Name ohne
Personenbezug, und dafür gibt es keinen Löschanlass.

## Ausscheiden einer Person

Zwei Schritte, bewusst getrennt:

**1. `public.anonymize_profile(p_profile_id)`**

- `display_name` → `'Anonymisierter Nutzer'`
- `deactivated_at` gesetzt
- `audit_log.actor_id` → `NULL`

**2. Löschung in `auth.users`** — **ausserhalb dieser Anwendung, beim Betreiber
der Instanz.**

Der zweite Schritt ist der eigentliche: Dort liegt die E-Mail-Adresse — die
personenbezogene Angabe, die im Anwendungsschema bewusst nicht gespeichert wird.

> [!important] Für Schritt 2 gibt es bewusst keinen Knopf
> Die Anwendung führt ihn nicht aus. Ein Löschvorgang in `auth.users` braucht
> den Service-Role-Schlüssel und umgeht damit sämtliche Zugriffsregeln — eine
> Verwaltung, die ihn mit einem Klick auslösen könnte, wäre eine zweite
> Vollzugriffsebene neben der Datenbank.
>
> **Verantwortlich ist der Betreiber der Instanz.** Er führt den Vorgang über
> die Verwaltungsschnittstelle seiner Supabase-Installation aus und hält fest,
> dass er ihn ausgeführt hat. Bildschirm 17 der Anwendung sagt das an genau
> dieser Stelle auch dem Anwender, statt eine Löschung anzudeuten, die nicht
> stattfindet.
>
> Wer eine Instanz betreibt, nimmt diesen Schritt in sein
> Verarbeitungsverzeichnis auf — als organisatorische Maßnahme mit benannter
> Zuständigkeit.

### Warum Tickets und Zeitbuchungen bleiben

Sie unterliegen weiterhin der regulären Aufbewahrungsfrist. Der Aufwand je
Vorgang bleibt auswertbar, auch wenn der Anzeigename der Person ersetzt ist.

Die Protokolleinträge bleiben ebenfalls — belegt bleibt, **dass** eine Änderung
stattfand, nur nicht mehr, durch wen.

> [!warning] Was die Anonymisierung **nicht** leistet
> `anonymize_profile()` ersetzt den Anzeigenamen und löst den Protokollbezug.
> **Freitexte fasst sie nicht an:** Ticketbeschreibungen und Kommentare bleiben
> unverändert.
>
> In einem Ticketsystem schreiben Menschen in ihren eigenen Worten. Sie nennen
> Kolleginnen beim Vornamen, unterschreiben mit Kürzeln und beschreiben
> Vorgänge, die eine Person identifizierbar machen. Ein anonymisiertes Profil
> heißt deshalb **nicht**, dass in den zugehörigen Vorgängen kein Personenbezug
> mehr steckt.
>
> Diese Grenze ist benannt, statt sie wegzuformulieren — die Aussage „danach
> sind es Betriebsdaten" wäre stärker als das, was der Code leistet. Für einen
> Betreiber heißt das konkret: Verlangt jemand die vollständige Löschung nach
> Art. 17, ist zu prüfen, ob Freitexte betroffen sind; die Anwendung nimmt ihm
> diese Prüfung nicht ab.
>
> Eine Freitextanonymisierung ist bewusst nicht gebaut. Sie müsste raten,
> welches Wort ein Name ist, und machte den Vorgang im Zweifel unbrauchbar —
> das gehört entschieden, nicht nebenbei eingeführt.

## Einschränkung der Verarbeitung (Art. 18 DSGVO)

Zwei Ebenen, beide ohne Datenverlust:

| Ebene   | Feld                        | Wirkung                                                               |
| ------- | --------------------------- | --------------------------------------------------------------------- |
| Person  | `profiles.deactivated_at`   | `current_tenant_id()` liefert NULL → jede Policy schlägt fehl         |
| Mandant | `tenants.is_active = false` | dasselbe für alle Nutzer des Mandanten, auch für dessen Administrator |

Der Kunde ist **keine** dritte Ebene. `customers.is_active = false` schränkt
keine Verarbeitung ein: Die Vorgänge des Kunden bleiben vollständig lesbar und
bearbeitbar, es kommen nur keine neuen dazu. Ein Kunde ist eine Organisation und
keine betroffene Person; Art. 18 greift auf ihn nicht. Der Satz steht hier,
damit die Stilllegung nicht später für eine Massnahme nach Art. 18 gehalten
wird — sie sieht aus wie eine und ist keine.

**Beides wirkt sofort**, nicht erst nach Ablauf eines Zugriffstokens. Genau das
war das Argument gegen einen JWT-Claim: Ein Claim wirkt erst nach dem nächsten
Refresh, ein deaktivierter Nutzer dürfte bis zu einer Stunde weiterlesen.

Geprüft in `010_zugriffshelfer.test.sql`.

**Der Zugang selbst fällt mit.** Bis `20260812000200` betraf die Deaktivierung
nur die Sichtbarkeit: Die Zeile in `auth.users` blieb unberührt, der Nutzer
konnte sich weiterhin anmelden und blieb `authenticated`. Ein Trigger auf
`profiles.deactivated_at` sperrt jetzt die Anmeldung und löscht Sitzung und
Auffrischungstoken; die Reaktivierung nimmt die Sperre zurück. Als Trigger und
nicht in der Server Action, damit **jeder** Weg ihn auslöst — die
Nutzerverwaltung, `anonymize_profile()`, eine Korrektur von Hand. Geprüft in
`230_zugangsentzug.test.sql`.

> [!note] Was auch damit nicht sofort endet
> Ein bereits ausgestelltes Zugriffstoken bleibt bis zu seinem Ablauf
> signaturgültig — PostgREST prüft die Signatur, nicht GoTrues Sitzungstabelle.
> Gelesen werden kann damit nichts mehr, dafür sorgt die Tabelle oben. Ein
> **neues** Token gibt es ebenfalls nicht mehr: Die Sperre verhindert die
> Anmeldung, die gelöschte Sitzung die Auffrischung. Das Restfenster ist die
> Restlaufzeit des ausgestellten Zugriffstokens, und es ist wirkungslos,
> solange keine Funktion den Mandantenbezug mit „kein angemeldeter Nutzer"
> verwechselt — siehe den Kasten darunter.

> [!warning] `current_tenant_id() IS NULL` ist **kein** Erkennungsmerkmal für den Betreiber
> Beide Ebenen wirken, indem `current_tenant_id()` NULL liefert. Genau das macht
> den Ausdruck als Unterscheidung untauglich: NULL bedeutet nicht „Aufruf ohne
> angemeldeten Nutzer", sondern „kein Mandantenbezug" — und das trifft
> `service_role` **und** die beiden Zustände in der Tabelle oben.
>
> Für Policies ist das harmlos, sie fallen darauf zu. Eine
> `SECURITY DEFINER`-Funktion, die den Betreiber von der Prüfung ausnehmen will,
> fällt darauf dagegen **auf**: Sie ließe genau die Aufrufer durch, denen gerade
> der Zugriff entzogen wurde. Eine Durchsicht hat das in `export_person_data()`
> gefunden; behoben in `20260812000000_auskunft_ohne_mandantenbezug.sql`.
>
> Das richtige Merkmal ist `auth.uid() IS NULL` — der Betreiber hat keinen
> angemeldeten Nutzer, ein deaktivierter Mitarbeiter schon. `anonymize_profile()`
> verwendet es von Anfang an. Wer eine neue `SECURITY DEFINER`-Funktion
> schreibt, hält sich daran und belegt beide Fälle in pgTAP.

## Auskunft und Übertragbarkeit (Art. 15 und 20)

`public.export_person_data(p_profile_id)` liefert JSON mit sechs Bereichen:
Profil, gemeldete Tickets, zugewiesene Tickets, Kommentare, Zeitbuchungen,
Protokolleinträge.

Beim Melder trägt der Bereich „Profil" zusätzlich seinen **Kunden** — Kennung
und Name. Zu welchem Auftraggeber jemand gehört, ist eine Angabe über ihn und
gehört damit in die Auskunft; der Name steht dabei, weil eine UUID die Frage
nicht beantwortet, die ein Betroffener stellt. `customers` selbst bekommt
**keinen** eigenen Bereich: Die Tabelle enthält keinen Personenbezug.

Die Funktion prüft ihre Berechtigung **selbst** — sie läuft als
`SECURITY DEFINER` und umgeht damit die Policies. Ohne eigene Prüfung wäre sie
ein Weg, fremde Daten zu lesen, also das Gegenteil dessen, wofür sie da ist.
Berechtigt ist, wer die eigenen Daten anfordert, oder der Administrator
desselben Mandanten.

Von der Prüfung ausgenommen ist ausschliesslich der Aufruf **ohne angemeldeten
Nutzer** (`auth.uid() IS NULL`), also der Betreiber über `service_role`; dort
trägt die aufrufende Server Action die Autorisierung. Ein angemeldeter Aufrufer
ohne Mandantenbezug — deaktiviert oder gesperrter Mandant — wird dagegen
abgewiesen, auch für die eigenen Daten. Eine Auskunft ist in dem Zustand über
den Betreiber zu erfüllen, nicht über die Anwendung. Geprüft in
`210_auskunft.test.sql`; die Begründung steht im Kasten weiter oben.

Der Export enthält einen ausdrücklichen **Hinweis auf `auth.users`**: Die
E-Mail-Adresse ist gesondert beizufügen. Ohne diesen Hinweis wäre die
Datenminimierung im Datenmodell zugleich eine Lücke in der Auskunft.

`210_auskunft.test.sql` prüft die Vollständigkeit aller sechs Bereiche. Wird
später eine Tabelle mit Personenbezug ergänzt, ohne sie in die Funktion
aufzunehmen, schlägt der Test fehl.

## Einplanung des Löschlaufs

Die Funktion existiert und ist geprüft; ihre regelmässige Ausführung ist eine
Betriebsentscheidung und noch offen.

Mit `pg_cron` auf der produktiven Instanz:

```sql
SELECT cron.schedule(
  'taktus-loeschlauf',
  '30 3 * * *',                      -- taeglich 03:30
  $$ SELECT public.purge_expired_data() $$
);
```

Alternativ ein Aufruf von aussen mit `service_role` — dann muss der Aufruf
überwacht werden. Ein Löschlauf, der seit Wochen nicht mehr läuft, fällt sonst
niemandem auf.

> **Offen vor dem Produktivbetrieb:**
>
> - Einplanung festlegen und einrichten
> - Überwachung: Meldung, wenn der Lauf ausbleibt
> - Löschfristen fachlich bestätigen (730 Tage sind ein Vorschlag, keine
>   Rechtsauskunft — massgeblich sind Zweck und etwaige handels- oder
>   steuerrechtliche Aufbewahrungspflichten des Betreibers)

## Was dieses Konzept nicht abdeckt

Ehrlichkeit an dieser Stelle ist der Punkt —
[security.md](security.md), Kapitel 3.

- **Sicherungen.** Eine gelöschte Zeile lebt in älteren Sicherungen weiter. Die
  Aufbewahrungsdauer der Sicherungen gehört ins Betriebskonzept und muss zu den
  Löschfristen passen.
- **Ausgelieferte Auskünfte.** Ein einmal erzeugter Export liegt ausserhalb des
  Systems.
- **Angemessenheit der Fristen.** Ob 730 Tage richtig sind, ist eine fachliche
  Bewertung, keine technische. Kein Werkzeug beantwortet das.
