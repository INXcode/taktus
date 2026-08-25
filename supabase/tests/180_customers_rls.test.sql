-- Zugriffsregeln auf public.customers.
--
-- ===========================================================================
-- Was hier geprüft wird -- und was ausdrücklich nicht
-- ===========================================================================
--
-- Der Kunde ist eine ZUORDNUNG, keine Sicherheitsgrenze. Ein Melder sieht
-- weiterhin genau seine eigenen Tickets; er sieht sie nicht deshalb, weil sie
-- zu seinem Kunden gehören, sondern weil er sie gemeldet hat. Diese Datei
-- prüft deshalb nicht „Kunde A sieht nichts von Kunde B" auf Ticketebene --
-- diese Zusicherung gäbe es gar nicht -- sondern:
--
--   1. Die Mandantengrenze hält auch für die neue Tabelle.
--   2. Der Kundenstamm gehört der Verwaltung; die Bearbeitung liest ihn nur.
--   3. Ein Melder sieht GENAU EINE Zeile: seinen eigenen Kunden. Nicht die
--      Liste aller Kunden seines Mandanten.
--
-- Punkt 3 hat erst mit dem zweiten Melder eine Gegenprobe: `a_melder` hängt an
-- `a_kunde_1`, `a_melder_kunde_2` an `a_kunde_2`, beide im selben Mandanten.
-- Ohne diese Konstellation wäre die Zusicherung nicht unterscheidbar von
-- „sieht alles seines Mandanten".
--
-- Zur Assertionswahl siehe 120_tickets_rls.test.sql: verweigertes Lesen mit
-- is_empty(), verweigertes Schreiben mit throws_ok(..., '42501'), fehlende
-- Schreibpolicy über die Wirkung.

BEGIN;
SELECT plan(11);

SELECT tests.basis_anlegen();

-- ===========================================================================
-- Mandantengrenze
-- ===========================================================================

SELECT tests.anmelden(tests.a_admin());

SELECT results_eq(
  'SELECT count(*)::int FROM public.customers',
  ARRAY[2],
  'Verwaltung sieht die beiden Kunden ihres Mandanten'
);

SELECT is_empty(
  format('SELECT id FROM public.customers WHERE tenant_id = %L', tests.mandant_b()),
  'Verwaltung von A sieht keinen Kunden von Mandant B'
);

-- Der IDOR-Fall: Die Kennung zu kennen hilft nicht.
SELECT is_empty(
  format('SELECT id FROM public.customers WHERE id = %L', tests.b_kunde()),
  'Auch mit bekannter Kundenkennung: kein Zugriff ueber die Mandantengrenze'
);

-- Einen Kunden FUER einen fremden Mandanten anzulegen, muss scheitern.
SELECT throws_ok(
  format(
    'INSERT INTO public.customers (tenant_id, name) VALUES (%L, ''untergeschoben'')',
    tests.mandant_b()
  ),
  '42501',
  NULL,
  'Kein INSERT eines Kunden in einen fremden Mandanten'
);

-- Schreiben ueber die Grenze bleibt wirkungslos -- die fremde Zeile ist ueber
-- die USING-Klausel gar nicht erreichbar, das UPDATE trifft null Zeilen.
UPDATE public.customers SET name = 'uebernommen' WHERE id = tests.b_kunde();
RESET ROLE;
SELECT results_eq(
  format('SELECT name FROM public.customers WHERE id = %L', tests.b_kunde()),
  ARRAY['B: Kunde Eins'],
  'UPDATE ueber die Mandantengrenze bleibt wirkungslos'
);

-- ===========================================================================
-- Der Kundenstamm gehoert der Verwaltung
-- ===========================================================================

SELECT tests.anmelden(tests.a_admin());
SELECT lives_ok(
  'INSERT INTO public.customers (tenant_id, name) VALUES ((SELECT public.current_tenant_id()), ''A: Kunde Drei'')',
  'Die Verwaltung darf im eigenen Mandanten einen Kunden anlegen'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_agent());

-- Die Bearbeitung liest den Stamm -- sie braucht ihn fuer die Auswahl am
-- Ticket und fuer den Kundenfilter.
SELECT results_eq(
  'SELECT count(*)::int FROM public.customers',
  ARRAY[3],
  'Die Bearbeitung liest den Kundenstamm ihres Mandanten'
);

-- Anlegen darf sie nicht. Sonst waechst der Stamm bei jeder Tippvariante um
-- einen Eintrag, und die Auswertung je Kunde wird wertlos.
SELECT throws_ok(
  'INSERT INTO public.customers (tenant_id, name) VALUES ((SELECT public.current_tenant_id()), ''Von der Bearbeitung'')',
  '42501',
  NULL,
  'Die Bearbeitung darf keinen Kunden anlegen'
);

-- Und aendern auch nicht. Es gibt fuer sie keine UPDATE-Policy, also trifft
-- das UPDATE null Zeilen -- geprueft wird deshalb die Wirkung, nicht ein
-- Fehler.
UPDATE public.customers SET name = 'Umbenannt durch die Bearbeitung'
  WHERE id = tests.a_kunde_1();
RESET ROLE;
SELECT results_eq(
  format('SELECT name FROM public.customers WHERE id = %L', tests.a_kunde_1()),
  ARRAY['A: Kunde Eins'],
  'Die Bearbeitung kann einen Kunden nicht umbenennen'
);

-- ===========================================================================
-- Ein Melder sieht genau seinen eigenen Kunden
-- ===========================================================================

SELECT tests.anmelden(tests.a_melder());

SELECT results_eq(
  'SELECT name FROM public.customers',
  ARRAY['A: Kunde Eins'],
  'Ein Melder sieht genau eine Zeile: seinen eigenen Kunden'
);

-- Die eigentliche Gegenprobe: Der zweite Kunde liegt im SELBEN Mandanten. Ohne
-- die Bedingung id = current_customer_id() saehe der Melder ihn -- die Zeile
-- ist ja nicht ueber die Mandantengrenze geschuetzt.
SELECT is_empty(
  format('SELECT id FROM public.customers WHERE id = %L', tests.a_kunde_2()),
  'Ein Melder sieht den anderen Kunden seines Mandanten nicht'
);

SELECT * FROM finish();
ROLLBACK;
