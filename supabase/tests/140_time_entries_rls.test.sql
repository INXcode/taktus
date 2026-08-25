-- Zugriffsregeln auf public.time_entries.
--
-- Die schärfste Grenze im Schema: Der Melder hat auf diese Tabelle ÜBERHAUPT
-- keinen Zugriff. Für ihn existiert keine Policy, und ohne Policy gibt es
-- keinen Zugriff.
--
-- Das ist zugleich die aussagekräftigste Zusicherung des ganzen Projekts. Eine
-- Trennung zwischen Mandanten liesse sich auch mit getrennten Datenbanken
-- erreichen. Eine Trennung INNERHALB eines Mandanten, zwischen Rollen, gibt es
-- nur mit Row Level Security -- und nur dann, wenn sie geprüft ist.

BEGIN;
SELECT plan(10);

SELECT tests.basis_anlegen();

-- Zwei Buchungen anlegen: eine je Bearbeiter.
INSERT INTO public.time_entries (tenant_id, ticket_id, user_id, minutes, worked_on, note)
VALUES
  (tests.mandant_a(), tests.a_ticket_vom_agent(), tests.a_agent(), 90,
   current_date, 'Fehlersuche'),
  (tests.mandant_a(), tests.a_ticket_vom_melder(), tests.a_admin(), 30,
   current_date, 'Ruecksprache'),
  (tests.mandant_b(), tests.b_ticket(), tests.b_agent(), 45,
   current_date, 'Analyse');

-- ===========================================================================
-- Der Melder sieht nichts und kann nichts
-- ===========================================================================

SELECT tests.anmelden(tests.a_melder());

SELECT is_empty(
  'SELECT id FROM public.time_entries',
  'Melder sieht keine einzige Zeitbuchung -- auch nicht zu seinem eigenen Ticket'
);

SELECT throws_ok(
  format(
    'INSERT INTO public.time_entries (ticket_id, user_id, minutes, worked_on) VALUES (%L, (SELECT auth.uid()), 60, current_date)',
    tests.a_ticket_vom_melder()
  ),
  '42501',
  NULL,
  'Melder kann keine Zeit buchen'
);

-- ===========================================================================
-- Bearbeiter: lesen im Mandanten, schreiben nur auf den eigenen Namen
-- ===========================================================================

RESET ROLE;
SELECT tests.anmelden(tests.a_agent());

SELECT results_eq(
  'SELECT count(*)::int FROM public.time_entries',
  ARRAY[2],
  'Bearbeiter sieht alle Buchungen seines Mandanten -- noetig fuer die Auswertung je Ticket'
);

SELECT is_empty(
  format('SELECT id FROM public.time_entries WHERE tenant_id = %L', tests.mandant_b()),
  'Bearbeiter sieht keine Buchung eines fremden Mandanten'
);

SELECT lives_ok(
  format(
    'INSERT INTO public.time_entries (ticket_id, user_id, minutes, worked_on) VALUES (%L, (SELECT auth.uid()), 45, current_date)',
    tests.a_ticket_vom_agent()
  ),
  'Bearbeiter darf auf den eigenen Namen buchen'
);

-- Eine Buchung im Namen eines anderen waere eine Aussage ueber dessen
-- Arbeitszeit, die dieser nicht getroffen hat.
SELECT throws_ok(
  format(
    'INSERT INTO public.time_entries (ticket_id, user_id, minutes, worked_on) VALUES (%L, %L, 45, current_date)',
    tests.a_ticket_vom_agent(), tests.a_admin()
  ),
  '42501',
  NULL,
  'Niemand bucht Zeit im Namen einer anderen Person'
);

-- Fremde Buchungen sind sichtbar, aber nicht aenderbar. Die Zeile ist ueber
-- die USING-Klausel der UPDATE-Policy nicht erreichbar, das UPDATE trifft also
-- null Zeilen.
UPDATE public.time_entries SET minutes = 999
 WHERE user_id = tests.a_admin();

RESET ROLE;
SELECT results_eq(
  format('SELECT minutes FROM public.time_entries WHERE user_id = %L', tests.a_admin()),
  ARRAY[30],
  'Bearbeiter kann die Buchung eines Kollegen nicht veraendern'
);

-- ===========================================================================
-- Die Verwaltung korrigiert fremde Buchungen -- unter fester Zurechnung
-- ===========================================================================
--
-- Bis 20260809000000 durfte auch sie das nicht; der vorgesehene Ausweg war
-- loeschen und neu anlegen lassen. Der taugte nicht: Eine falsche Buchung
-- verschwand damit entweder ganz aus der Auswertung oder gar nicht.
--
-- Was bleibt, ist die Zurechnung. Die Verwaltung berichtigt die Zahl -- sie
-- schreibt die Buchung aber nicht auf einen anderen Namen um.

SELECT tests.anmelden(tests.a_admin());

UPDATE public.time_entries SET minutes = 75
 WHERE user_id = tests.a_agent() AND minutes = 90;

RESET ROLE;
SELECT results_eq(
  format(
    'SELECT minutes FROM public.time_entries WHERE user_id = %L AND note = ''Fehlersuche''',
    tests.a_agent()
  ),
  ARRAY[75],
  'Die Verwaltung darf eine fremde Buchung berichtigen'
);

SELECT tests.anmelden(tests.a_admin());
SELECT throws_ok(
  format(
    'UPDATE public.time_entries SET user_id = %L WHERE user_id = %L',
    tests.a_admin(), tests.a_agent()
  ),
  '42501',
  NULL,
  'Auch die Verwaltung kann eine Buchung nicht auf einen anderen Namen umschreiben'
);

SELECT tests.anmelden(tests.a_admin());
SELECT lives_ok(
  format(
    'DELETE FROM public.time_entries WHERE user_id = %L AND minutes = 75',
    tests.a_agent()
  ),
  'Der Administrator darf eine falsche Buchung loeschen'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
