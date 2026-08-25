-- Auskunft und Anonymisierung: export_person_data(), anonymize_profile().
--
-- Betroffenenrechte müssen MASCHINELL erfüllbar sein (DSGVO Art. 15 und 20).
-- Eine Auskunft, die von Hand aus mehreren Tabellen zusammengesucht wird, ist
-- in der Praxis unvollständig -- und die Unvollständigkeit fällt niemandem auf.
--
-- Der erste Test unten prüft deshalb die VOLLSTÄNDIGKEIT der Bereiche. Wird
-- später eine Tabelle mit Personenbezug ergänzt, ohne sie in
-- export_person_data() aufzunehmen, schlägt er fehl.

BEGIN;
SELECT plan(11);

SELECT tests.basis_anlegen();

INSERT INTO public.ticket_comments (tenant_id, ticket_id, author_id, body)
VALUES (tests.mandant_a(), tests.a_ticket_vom_agent(), tests.a_agent(),
        'Beitrag der betroffenen Person');

INSERT INTO public.time_entries (tenant_id, ticket_id, user_id, minutes, worked_on)
VALUES (tests.mandant_a(), tests.a_ticket_vom_agent(), tests.a_agent(), 75,
        current_date);

INSERT INTO public.audit_log (tenant_id, actor_id, action, entity_type)
VALUES (tests.mandant_a(), tests.a_agent(), 'ticket.update', 'ticket');

-- ===========================================================================
-- Vollständigkeit
-- ===========================================================================

SELECT is(
  (SELECT count(*)::int FROM jsonb_object_keys(
     public.export_person_data(tests.a_agent())
   ) AS k
   WHERE k IN ('profil', 'tickets_gemeldet', 'tickets_zugewiesen',
               'kommentare', 'zeitbuchungen', 'protokolleintraege')),
  6,
  'Der Export enthaelt alle sechs Bereiche mit Personenbezug'
);

SELECT is(
  jsonb_array_length(
    public.export_person_data(tests.a_agent()) -> 'kommentare'
  ),
  1,
  'Kommentare der betroffenen Person sind enthalten'
);

SELECT is(
  jsonb_array_length(
    public.export_person_data(tests.a_agent()) -> 'zeitbuchungen'
  ),
  1,
  'Zeitbuchungen sind enthalten'
);

SELECT is(
  jsonb_array_length(
    public.export_person_data(tests.a_agent()) -> 'tickets_gemeldet'
  ),
  1,
  'Gemeldete Tickets sind enthalten'
);

-- Der Hinweis auf auth.users gehoert in die Auskunft: Die E-Mail-Adresse wird
-- im Anwendungsschema bewusst nicht gespeichert, muss einer Auskunft aber
-- beigefuegt werden. Ohne diesen Hinweis waere die Datenminimierung im
-- Datenmodell zugleich eine Luecke in der Auskunft.
SELECT matches(
  public.export_person_data(tests.a_agent()) ->> 'hinweis',
  'auth\.users',
  'Der Export weist auf die gesondert beizufuegende E-Mail-Adresse hin'
);

-- ===========================================================================
-- Berechtigung
-- ===========================================================================
--
-- export_person_data() laeuft als SECURITY DEFINER und umgeht damit die
-- Policies. Ohne eigene Pruefung waere die Funktion ein Weg, fremde Daten zu
-- lesen -- also genau das Gegenteil dessen, wofuer sie da ist.

SELECT tests.anmelden(tests.a_melder());

SELECT throws_ok(
  format('SELECT public.export_person_data(%L)', tests.a_agent()),
  '42501',
  NULL,
  'Ein Melder kann nicht die Daten eines Kollegen exportieren'
);

RESET ROLE;
SELECT tests.anmelden(tests.b_admin());

SELECT throws_ok(
  format('SELECT public.export_person_data(%L)', tests.a_agent()),
  '42501',
  NULL,
  'Ein Administrator kann nicht ueber die Mandantengrenze exportieren'
);

-- ---------------------------------------------------------------------------
-- Angemeldet, aber ohne Mandantenbezug
-- ---------------------------------------------------------------------------
--
-- Die beiden Faelle oben pruefen einen AKTIVEN Nutzer in einem AKTIVEN
-- Mandanten -- beide haben also einen Mandantenbezug. Genau daran hing die
-- Pruefung bis 20260812000000, und deshalb konnten diese Tests gruen bleiben,
-- waehrend die Funktion fuer zwei weitere Aufrufergruppen offen stand:
-- ein deaktiviertes Profil und ein gesperrter Mandant liefern ebenfalls
-- current_tenant_id() = NULL, sind aber angemeldete Nutzer.
--
-- Die Ausnahme gilt ausschliesslich fuer den Aufruf ohne auth.uid(), also fuer
-- service_role. Wer angemeldet ist und keinen Mandantenbezug hat, hat gerade
-- keinen Zugriff -- auch nicht auf die eigenen Daten. Eine Auskunft ist in dem
-- Zustand ueber den Betreiber zu erfuellen, nicht ueber die Anwendung.

RESET ROLE;
UPDATE public.profiles
   SET deactivated_at = now()
 WHERE id = tests.a_melder();

SELECT tests.anmelden(tests.a_melder());

SELECT throws_ok(
  format('SELECT public.export_person_data(%L)', tests.a_melder()),
  '42501',
  NULL,
  'Deaktiviertes Profil exportiert nicht einmal die eigenen Daten'
);

SELECT throws_ok(
  format('SELECT public.export_person_data(%L)', tests.a_agent()),
  '42501',
  NULL,
  'Deaktiviertes Profil exportiert keine Daten von Kollegen'
);

RESET ROLE;
UPDATE public.tenants SET is_active = false WHERE id = tests.mandant_b();

SELECT tests.anmelden(tests.b_admin());

SELECT throws_ok(
  format('SELECT public.export_person_data(%L)', tests.b_admin()),
  '42501',
  NULL,
  'Gesperrter Mandant: auch der Administrator exportiert nichts'
);

RESET ROLE;
UPDATE public.tenants SET is_active = true WHERE id = tests.mandant_b();
UPDATE public.profiles
   SET deactivated_at = NULL
 WHERE id = tests.a_melder();

-- ===========================================================================
-- Anonymisierung
-- ===========================================================================
--
-- Loest den Personenbezug, ohne die Betriebsdaten zu zerstoeren: Der Aufwand je
-- Ticket bleibt auswertbar, ist aber keiner Person mehr zuzuordnen.

RESET ROLE;

-- Der JWT-Anspruch aus dem vorigen Abschnitt muss ausdruecklich weg.
--
-- `RESET ROLE` stellt die Datenbankrolle zurueck, nicht aber
-- `request.jwt.claims` -- das haelt bis zum Ende der Transaktion. Fuer
-- `auth.uid()` waere damit immer noch b_admin angemeldet, und
-- `anonymize_profile` weist seit 20260805000000_funktionsrechte.sql einen
-- Aufruf aus einem fremden Mandanten ab. Gemeint ist hier der Aufruf des
-- Instanzbetreibers, und der hat keinen Anspruch.
SELECT set_config('request.jwt.claims', NULL, true);
SELECT public.anonymize_profile(tests.a_agent());

SELECT results_eq(
  format(
    'SELECT display_name, (deactivated_at IS NOT NULL), (SELECT count(*)::int FROM public.audit_log WHERE actor_id = %L) FROM public.profiles WHERE id = %L',
    tests.a_agent(), tests.a_agent()
  ),
  $$ VALUES ('Anonymisierter Nutzer', true, 0) $$,
  'Anonymisierung: Name ersetzt, Profil deaktiviert, Protokollbezug geloest'
);

SELECT * FROM finish();
ROLLBACK;
