-- Testdaten für die lokale Entwicklung.
--
-- ===========================================================================
-- AUSSCHLIESSLICH SYNTHETISCH
-- ===========================================================================
--
-- Keine echten Namen, Anschriften, E-Mail-Adressen, Firmen- oder Kundenbezüge
-- -- auch nicht als „nur ein Beispiel". Die Regel steht in CONTRIBUTING.md:
--
--   „Gilt auch für die Historie: Git löscht nichts. Beim Umschalten auf
--    öffentlich wird die vollständige Historie sichtbar."
--
-- Was hier einmal committet wurde, ist beim Öffentlichmachen lesbar. Ein
-- Kundenname in einer Seed-Datei ist deshalb kein Schönheitsfehler, sondern
-- eine Datenpanne mit Vorlauf.
--
-- Alle verwendeten Domains liegen unter `.invalid` -- diese Endung ist per
-- RFC 2606 dauerhaft reserviert und kann niemandem gehören.
--
-- ===========================================================================
-- DIESER SEED GEHÖRT AUF KEINE ERREICHBARE INSTANZ
-- ===========================================================================
--
-- Alle sechs Konten bekommen unten dasselbe Kennwort, über ein einziges
-- crypt(). Zwei davon sind Administratoren. Das Kennwort steht im Klartext in
-- dieser Datei, und diese Datei ist öffentlich.
--
-- Als Entwicklungswert für einen Container auf dem eigenen Rechner ist das
-- richtig so: Die Werte sind zum Nachschlagen da, und die E2E-Tests hängen an
-- ihnen.
--
-- Eine frühere Fassung dieses Kopfes versicherte, die Anmeldedaten
-- funktionierten „ausschliesslich lokal". Das war falsch. Am 24.08.2026 lief
-- genau dieser Seed auf einer öffentlich erreichbaren Demo -- nachgewiesen
-- durch eine Anmeldung. Wer das Repository las, kam damit bis in die
-- Verwaltung. Die Instanz wurde abgeschaltet.
--
-- Wer diesen Seed auf einer Instanz einspielt, die jemand von aussen
-- erreichen kann, ändert die Kennwörter, BEVOR sie erreichbar wird:
--
--     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
--     NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
--       node scripts/demo-kennwoerter.mjs
--
-- Das Skript fragt ein Kennwort verdeckt ab, setzt es für alle Konten und
-- weist danach beides nach: dass die Anmeldung mit dem Kennwort von hier
-- scheitert und mit dem neuen gelingt. Einzelheiten in docs/betrieb.md.
-- ===========================================================================

-- Zwei Mandanten. Einer genügte für den Betrieb, aber nicht für die
-- Entwicklung: Ob die Trennung wirkt, sieht man nur, wenn es etwas zu trennen
-- gibt.
INSERT INTO public.tenants (id, name, ai_enabled) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Muster Handwerk GmbH', false),
  ('22222222-2222-4222-8222-222222222222', 'Beispiel Steuerkanzlei', false);

-- Kunden. Der Mandant betreibt das System, der Kunde wird damit verwaltet --
-- die Unterscheidung, die in der Anwendung ueberall durchgehalten wird.
--
-- Zwei Kunden je Mandant waeren das Mindeste; Mandant 1 bekommt vier, weil
-- sich nur damit alle vier Faelle ansehen lassen: zwei Kunden mit Vorgaengen,
-- die eigenen Vorgaenge des Betriebs, und ein stillgelegter Kunde, der in
-- keiner Auswahlliste mehr auftauchen darf.
INSERT INTO public.customers (id, tenant_id, name, is_active) VALUES
  ('11111111-0001-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111', 'Beispielkunde Nord',  true),
  ('11111111-0001-4000-8000-000000000002',
   '11111111-1111-4111-8111-111111111111', 'Beispielkunde Sued',  true),
  ('11111111-0001-4000-8000-000000000003',
   '11111111-1111-4111-8111-111111111111', 'Interne Vorgaenge',   true),
  ('11111111-0001-4000-8000-000000000004',
   '11111111-1111-4111-8111-111111111111', 'Beispielkunde Ost',   false),
  ('22222222-0001-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222', 'Musterkunde West',    true),
  ('22222222-0001-4000-8000-000000000002',
   '22222222-2222-4222-8222-222222222222', 'Interne Vorgaenge',   true);

-- Anmeldedaten: das Kennwort lautet bei allen `Entwicklung-2026!`.
-- Es erfuellt die Richtlinie (12 Zeichen, Gross, Klein, Ziffern).
--
-- > [!warning] Die Token-Spalten muessen '' sein, nicht NULL.
-- >
-- > `auth.users` erlaubt NULL in `confirmation_token`, `recovery_token` und
-- > den vier Wechsel-Spalten -- der Auth-Dienst liest sie aber in Go-Strings,
-- > die kein NULL kennen. Steht dort NULL, scheitert JEDE Anmeldung mit
-- > „Database error querying schema" und im Log mit
-- > „converting NULL to string is unsupported". Das Passwort spielt dabei
-- > keine Rolle, die Zeile wird gar nicht erst gelesen.
-- >
-- > Der Fehler entgeht den pgTAP-Tests vollstaendig: Die setzen `request.jwt.claims`
-- > und die Datenbankrolle direkt und melden sich nie ueber den Auth-Dienst an.
-- > Auffallen kann er nur an einer echten Anmeldemaske.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  reauthentication_token
)
SELECT
  d.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  d.email,
  crypt('Entwicklung-2026!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '',
  '', '', '',
  ''
FROM (VALUES
  ('11111111-0000-4000-8000-000000000001'::uuid, 'admin@handwerk.invalid'),
  ('11111111-0000-4000-8000-000000000002'::uuid, 'bearbeitung@handwerk.invalid'),
  ('11111111-0000-4000-8000-000000000003'::uuid, 'meldung@handwerk.invalid'),
  ('22222222-0000-4000-8000-000000000001'::uuid, 'admin@kanzlei.invalid'),
  ('22222222-0000-4000-8000-000000000002'::uuid, 'bearbeitung@kanzlei.invalid'),
  ('22222222-0000-4000-8000-000000000003'::uuid, 'meldung@kanzlei.invalid')
) AS d(id, email);

-- Melder tragen einen Kunden, Bearbeitung und Verwaltung nicht -- der CHECK
-- profiles_kunde_nur_beim_melder erzwingt beide Richtungen.
--
-- Mandant 2 bekommt jetzt ebenfalls einen Melder. Ohne ihn liesse sich der
-- interessanteste Fall nicht ansehen: zwei Melder, zwei Kunden, ein Mandant.
INSERT INTO public.profiles (id, tenant_id, role, display_name, customer_id) VALUES
  ('11111111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'admin',     'Alex Musterleitung',        NULL),
  ('11111111-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'agent',     'Kim Musterbearbeitung',     NULL),
  ('11111111-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'requester', 'Toni Mustermeldung',        '11111111-0001-4000-8000-000000000001'),
  ('22222222-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222',
   'admin',     'Sam Beispielleitung',       NULL),
  ('22222222-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222',
   'agent',     'Robin Beispielbearbeitung', NULL),
  ('22222222-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222',
   'requester', 'Jamie Beispielmeldung',     '22222222-0001-4000-8000-000000000001');

-- Tickets. ticket_number vergibt der Trigger -- je Mandant beginnend bei 1.
--
-- Reihenfolge und Titel sind gebunden: `e2e/mandantentrennung.spec.ts` haengt
-- daran, dass in beiden Mandanten die Nummer 1 vergeben ist und etwas
-- Verschiedenes bezeichnet. Wer hier ein Ticket einschiebt, verschiebt die
-- Nummern und bricht die Suite.
--
-- Der Kunde wird hier ausdruecklich gesetzt: Der Seed laeuft als `postgres`,
-- und der Trigger setzt ihn nur fuer angemeldete Melder.
INSERT INTO public.tickets (tenant_id, customer_id, title, description, status, category, created_by, assignee_id)
VALUES
  ('11111111-1111-4111-8111-111111111111',
   '11111111-0001-4000-8000-000000000001',
   'Etikettendrucker in der Werkstatt zieht kein Papier ein',
   'Seit heute Morgen. Die Anzeige bleibt auf "bereit" stehen.',
   'in_progress', 'stoerung',
   '11111111-0000-4000-8000-000000000003',
   '11111111-0000-4000-8000-000000000002'),

  ('11111111-1111-4111-8111-111111111111',
   '11111111-0001-4000-8000-000000000001',
   'Zugang zum Ersatzteilkatalog fehlt',
   'Neue Kollegin braucht Lesezugriff.',
   'open', 'anfrage',
   '11111111-0000-4000-8000-000000000003',
   NULL),

  -- Von der Bearbeitung angelegt, und fuer einen anderen Kunden als die
  -- beiden Meldungen -- der Fall, den ein Melder gar nicht erzeugen kann.
  ('11111111-1111-4111-8111-111111111111',
   '11111111-0001-4000-8000-000000000002',
   'Turnusmaessige Wartung Hebebuehne',
   'Termin mit dem Pruefdienst abstimmen.',
   'waiting', 'wartung',
   '11111111-0000-4000-8000-000000000002',
   '11111111-0000-4000-8000-000000000002'),

  ('22222222-2222-4222-8222-222222222222',
   '22222222-0001-4000-8000-000000000001',
   'Auswertung weicht von der Vorperiode ab',
   'Vermutlich eine geaenderte Kontenzuordnung.',
   'open', 'abrechnung',
   '22222222-0000-4000-8000-000000000002',
   '22222222-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Fülldaten für Mandant 1
-- ---------------------------------------------------------------------------
--
-- Die vier Tickets oben zeigen je einen Fall; sie zeigen nicht, wie die Liste
-- aussieht, wenn sie voll ist. Dafür stehen hier weitere 30 Vorgänge -- genug
-- für zwei Seiten bei 25 Zeilen (`PAGE_SIZE` in src/lib/tickets/filters.ts).
--
-- > [!warning] Nur Mandant 2 hat weiterhin GENAU EIN Ticket.
-- > `e2e/mandantentrennung.spec.ts` prüft, dass `/tickets/3` dort mit 404
-- > antwortet, weil es die Nummer nur bei Mandant 1 gibt. Ein zusätzlicher
-- > Vorgang für die Kanzlei bräche diese Zusicherung -- die Fülldaten bleiben
-- > deshalb vollständig bei Mandant 1, dessen Nummern 1 bis 3 unberührt sind.
--
-- Verteilt über alle vier Status, alle fünf Kategorien und alle vier Kunden --
-- einschliesslich des stillgelegten: An ihm hängen Vorgänge, und genau das
-- soll sich im Kundenfilter ansehen lassen.
--
-- `created_at` wird ausdrücklich gesetzt und über zwei Monate gestreut. Mit
-- dem Vorgabewert `now()` trügen alle 34 Zeilen denselben Zeitpunkt, und
-- weder die Sortierung noch die Spalte „Angelegt" liesse sich beurteilen.
--
-- `closed_at` muss bei geschlossenen Vorgängen mitgegeben werden: Der Trigger
-- leitet es nur beim UPDATE ab, der CHECK verlangt es aber ab dem INSERT.
INSERT INTO public.tickets (
  tenant_id, customer_id, title, description, status, category,
  created_by, assignee_id, created_at, updated_at, closed_at
)
-- Die Umwandlungen stehen hier und nicht in der Werteliste: Eine mehrzeilige
-- VALUES-Liste ohne Umwandlung loest jede Spalte als `text` auf, und `text` in
-- eine uuid- oder Aufzaehlungsspalte einzufuegen weist Postgres ab.
SELECT
  '11111111-1111-4111-8111-111111111111',
  d.customer_id::uuid,
  d.title,
  d.description,
  d.status::public.ticket_status,
  d.category::public.ticket_category,
  d.created_by::uuid,
  d.assignee_id::uuid,
  now() - make_interval(days => d.tage_her, hours => d.stunde),
  now() - make_interval(days => d.tage_her, hours => d.stunde),
  CASE WHEN d.status = 'closed'
       THEN now() - make_interval(days => greatest(d.tage_her - 2, 0))
  END
FROM (VALUES
  -- Kunde, Titel, Beschreibung, Status, Kategorie, angelegt von, zugewiesen an, Tage her, Stunde
  ('11111111-0001-4000-8000-000000000001', 'Kassenterminal nimmt keine Karten mehr an',        'Meldung aus dem Verkaufsraum, seit dem Vormittag.',                'in_progress', 'stoerung',   '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002',  1, 9),
  ('11111111-0001-4000-8000-000000000002', 'Zweiter Bildschirm bleibt dunkel',                 'Kabel getauscht, ohne Wirkung.',                                   'open',        'stoerung',   '11111111-0000-4000-8000-000000000002', NULL,                                    2, 14),
  ('11111111-0001-4000-8000-000000000003', 'Ablage der Lieferscheine neu ordnen',              'Vorschlag aus der Besprechung, ohne Termin.',                      'open',        'sonstiges',  '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',  3, 11),
  ('11111111-0001-4000-8000-000000000001', 'Rechnung enthaelt eine doppelte Position',         'Betrifft den Sammelbeleg des Vormonats.',                          'waiting',     'abrechnung', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001',  4, 16),
  ('11111111-0001-4000-8000-000000000004', 'Altbestand aus dem Aussenlager erfassen',          'Aufnahme laeuft, Rueckmeldung offen.',                             'waiting',     'sonstiges',  '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002',  5, 10),
  ('11111111-0001-4000-8000-000000000002', 'Wartungsintervall Kompressor vorziehen',           'Laufzeit ueber dem Richtwert.',                                    'open',        'wartung',    '11111111-0000-4000-8000-000000000002', NULL,                                    6, 8),
  ('11111111-0001-4000-8000-000000000001', 'Zugang fuer die Aushilfe einrichten',              'Befristet bis Quartalsende.',                                      'closed',      'anfrage',    '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002',  7, 13),
  ('11111111-0001-4000-8000-000000000003', 'Vorlage fuer Angebote ueberarbeiten',              'Kopfzeile und Fusszeile stimmen nicht ueberein.',                  'in_progress', 'sonstiges',  '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',  8, 15),
  ('11111111-0001-4000-8000-000000000002', 'Netzwerkdose im Lager ohne Verbindung',            'Nur die eine Dose betroffen.',                                     'in_progress', 'stoerung',   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002',  9, 9),
  ('11111111-0001-4000-8000-000000000001', 'Frage zur Abrechnung von Anfahrtszeiten',          'Wie werden Teilstunden gerundet?',                                 'closed',      'abrechnung', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 10, 12),
  ('11111111-0001-4000-8000-000000000004', 'Schluesselkasten neu beschriften',                 'Alte Beschriftung passt nicht mehr.',                              'open',        'sonstiges',  '11111111-0000-4000-8000-000000000002', NULL,                                   11, 17),
  ('11111111-0001-4000-8000-000000000002', 'Pruefplakette an der Leiter fehlt',                'Naechste Pruefung ansetzen.',                                      'open',        'wartung',    '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000002', 12, 7),
  ('11111111-0001-4000-8000-000000000001', 'Bestellung wurde zweimal ausgeloest',              'Nur eine Lieferung eingetroffen.',                                 'waiting',     'abrechnung', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 13, 11),
  ('11111111-0001-4000-8000-000000000003', 'Sicherung der Ablage einmal wiederherstellen',     'Probelauf, nicht im Ernstfall.',                                   'closed',      'wartung',    '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 14, 10),
  ('11111111-0001-4000-8000-000000000002', 'Telefonweiterleitung ausserhalb der Zeiten',       'Anrufe laufen ins Leere.',                                         'in_progress', 'stoerung',   '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 15, 16),
  ('11111111-0001-4000-8000-000000000001', 'Neues Ersatzteil in die Liste aufnehmen',          'Bezeichnung und Nummer liegen vor.',                               'closed',      'anfrage',    '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 16, 9),
  ('11111111-0001-4000-8000-000000000004', 'Restposten abschliessend bewerten',                'Vorgang laeuft aus, Kunde ist stillgelegt.',                       'waiting',     'abrechnung', '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 17, 14),
  ('11111111-0001-4000-8000-000000000002', 'Beleuchtung im Hof schaltet zu frueh ab',          'Zeitschaltuhr nachstellen.',                                       'open',        'stoerung',   '11111111-0000-4000-8000-000000000002', NULL,                                   18, 8),
  ('11111111-0001-4000-8000-000000000003', 'Aufstellung der offenen Vorgaenge zusammenstellen','Fuer die naechste Besprechung.',                                   'closed',      'sonstiges',  '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 19, 12),
  ('11111111-0001-4000-8000-000000000001', 'Ersatzgeraet fuer die Montage anfragen',           'Eigenes Geraet ist in Reparatur.',                                 'closed',      'anfrage',    '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 20, 15),
  ('11111111-0001-4000-8000-000000000002', 'Filter der Absauganlage wechseln',                 'Turnus erreicht.',                                                 'closed',      'wartung',    '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 22, 10),
  ('11111111-0001-4000-8000-000000000001', 'Zeitbuchung wurde auf den falschen Vorgang gesetzt','Bitte umbuchen, Datum stimmt.',                                   'closed',      'abrechnung', '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 24, 13),
  ('11111111-0001-4000-8000-000000000003', 'Kennwortrichtlinie im Team erlaeutern',            'Kurze Runde im naechsten Treffen.',                                'closed',      'sonstiges',  '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 26, 9),
  ('11111111-0001-4000-8000-000000000002', 'Anhaenger fuer die Pruefung anmelden',             'Termin steht noch aus.',                                           'closed',      'wartung',    '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 28, 11),
  ('11111111-0001-4000-8000-000000000001', 'Zweite Meldung zum Etikettendruck',                'Tritt nur bei kleinen Etiketten auf.',                             'closed',      'stoerung',   '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 31, 16),
  ('11111111-0001-4000-8000-000000000004', 'Abschlussrechnung fuer den Altvertrag',            'Vorgang aus dem Vorquartal.',                                      'closed',      'abrechnung', '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 34, 10),
  ('11111111-0001-4000-8000-000000000002', 'Zugang eines ausgeschiedenen Kollegen entziehen',  'Ist erledigt, zur Ablage.',                                        'closed',      'anfrage',    '11111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 38, 8),
  ('11111111-0001-4000-8000-000000000003', 'Ordnerstruktur auf dem Ablageserver bereinigen',   'Doppelte Ebenen zusammengefuehrt.',                                'closed',      'sonstiges',  '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000002', 43, 14),
  ('11111111-0001-4000-8000-000000000001', 'Schulungstermin fuer die Bedienung abstimmen',     'Zwei Termine vorgeschlagen.',                                      'closed',      'anfrage',    '11111111-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000002', 49, 12),
  ('11111111-0001-4000-8000-000000000002', 'Jahresablesung der Zaehlerstaende',                'Werte erfasst und weitergegeben.',                                 'closed',      'wartung',    '11111111-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 56, 9)
) AS d(
  customer_id, title, description, status, category,
  created_by, assignee_id, tage_her, stunde
);

INSERT INTO public.ticket_comments (tenant_id, ticket_id, author_id, body)
SELECT
  t.tenant_id, t.id,
  '11111111-0000-4000-8000-000000000002',
  'Einzugsrolle geprueft, wird gereinigt. Rueckmeldung folgt.'
FROM public.tickets AS t
WHERE t.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND t.ticket_number = 1;

INSERT INTO public.time_entries (tenant_id, ticket_id, user_id, minutes, worked_on, note)
SELECT
  t.tenant_id, t.id,
  '11111111-0000-4000-8000-000000000002',
  45, current_date, 'Fehlersuche vor Ort'
FROM public.tickets AS t
WHERE t.tenant_id = '11111111-1111-4111-8111-111111111111'
  AND t.ticket_number = 1;

-- ---------------------------------------------------------------------------
-- Zeitbuchungen zum Ansehen der drei Zeitansichten
-- ---------------------------------------------------------------------------
--
-- Eine einzige Buchung zeigt weder die Gruppierung nach Woche und Monat noch
-- die Bündelung nach Kunde und schon gar keine Monatsauswahl. Die folgenden
-- 36 verteilen sich auf beide buchenden Personen, auf Tickets mehrerer Kunden
-- und auf drei Monate.
--
-- Gebucht wird über die Ticketnummer statt über die Kennung: Die Nummern
-- stehen sichtbar in der Liste oben, Kennungen vergibt die Datenbank. Der
-- Kunde ergibt sich daraus von selbst -- er hängt am Ticket, nicht an der
-- Buchung.
--
-- `worked_on` liegt nie in der Zukunft; die CHECK-Bedingung
-- time_entries_worked_on_nicht_zukunft liesse das auch nicht zu.
INSERT INTO public.time_entries (
  tenant_id, ticket_id, user_id, minutes, worked_on, note
)
SELECT
  t.tenant_id,
  t.id,
  d.user_id::uuid,
  d.minutes,
  current_date - d.tage_her,
  d.note
FROM (VALUES
  -- Ticketnummer, buchende Person, Minuten, Tage her, Notiz
  ( 1, '11111111-0000-4000-8000-000000000002',  90,  1, 'Einzugsrolle gereinigt und Probedruck'),
  ( 1, '11111111-0000-4000-8000-000000000001',  30,  2, 'Ruecksprache mit dem Hersteller'),
  ( 4, '11111111-0000-4000-8000-000000000002', 120,  1, 'Terminal getauscht und eingerichtet'),
  ( 4, '11111111-0000-4000-8000-000000000002',  45,  3, 'Fehlerbild aufgenommen'),
  ( 5, '11111111-0000-4000-8000-000000000002',  60,  4, 'Anschluss und Kabel geprueft'),
  ( 6, '11111111-0000-4000-8000-000000000001',  75,  5, 'Ablage neu geordnet'),
  ( 7, '11111111-0000-4000-8000-000000000001', 105,  6, 'Belege abgeglichen'),
  ( 8, '11111111-0000-4000-8000-000000000002', 180,  7, 'Aufnahme im Aussenlager'),
  ( 8, '11111111-0000-4000-8000-000000000002', 150,  8, 'Aufnahme fortgesetzt'),
  ( 9, '11111111-0000-4000-8000-000000000002',  40,  9, 'Laufzeiten ausgelesen'),
  (10, '11111111-0000-4000-8000-000000000002',  25, 10, 'Zugang eingerichtet'),
  (11, '11111111-0000-4000-8000-000000000001',  95, 11, 'Vorlage ueberarbeitet'),
  (12, '11111111-0000-4000-8000-000000000002', 135, 12, 'Dose durchgemessen und neu aufgelegt'),
  (13, '11111111-0000-4000-8000-000000000001',  50, 13, 'Rundungsregel nachgesehen'),
  (14, '11111111-0000-4000-8000-000000000002',  35, 14, 'Beschriftung erneuert'),
  (15, '11111111-0000-4000-8000-000000000002',  70, 16, 'Pruefung angemeldet'),
  (16, '11111111-0000-4000-8000-000000000001', 110, 18, 'Bestellung nachvollzogen'),
  (17, '11111111-0000-4000-8000-000000000001',  85, 20, 'Wiederherstellung geprobt'),
  (18, '11111111-0000-4000-8000-000000000002', 145, 22, 'Weiterleitung neu geschaltet'),
  (19, '11111111-0000-4000-8000-000000000002',  30, 24, 'Teil aufgenommen'),
  (20, '11111111-0000-4000-8000-000000000001', 165, 26, 'Bewertung abgeschlossen'),
  (21, '11111111-0000-4000-8000-000000000002',  55, 28, 'Zeitschaltuhr eingestellt'),
  (22, '11111111-0000-4000-8000-000000000001', 120, 31, 'Aufstellung erarbeitet'),
  (23, '11111111-0000-4000-8000-000000000002',  90, 33, 'Ersatzgeraet beschafft'),
  (24, '11111111-0000-4000-8000-000000000002', 100, 35, 'Filter gewechselt'),
  (25, '11111111-0000-4000-8000-000000000001',  45, 37, 'Buchung umgesetzt'),
  (26, '11111111-0000-4000-8000-000000000001',  60, 39, 'Runde vorbereitet und gehalten'),
  (27, '11111111-0000-4000-8000-000000000002',  80, 41, 'Anmeldung erledigt'),
  (28, '11111111-0000-4000-8000-000000000002', 125, 44, 'Ursache eingegrenzt'),
  (29, '11111111-0000-4000-8000-000000000001', 140, 47, 'Abschluss gerechnet'),
  (30, '11111111-0000-4000-8000-000000000001',  35, 50, 'Zugang entzogen und vermerkt'),
  (31, '11111111-0000-4000-8000-000000000002', 190, 53, 'Struktur zusammengefuehrt'),
  (32, '11111111-0000-4000-8000-000000000002',  65, 56, 'Termine abgestimmt'),
  (33, '11111111-0000-4000-8000-000000000001', 115, 59, 'Zaehlerstaende erfasst'),
  (33, '11111111-0000-4000-8000-000000000002',  75, 62, 'Werte weitergegeben'),
  ( 3, '11111111-0000-4000-8000-000000000001',  95, 65, 'Pruefdienst angefragt')
) AS d(ticket_number, user_id, minutes, tage_her, note)
JOIN public.tickets AS t
  ON t.tenant_id = '11111111-1111-4111-8111-111111111111'
 AND t.ticket_number = d.ticket_number;
