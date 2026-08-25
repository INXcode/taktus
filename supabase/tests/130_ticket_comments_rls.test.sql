-- Zugriffsregeln auf public.ticket_comments.

BEGIN;
SELECT plan(10);

SELECT tests.basis_anlegen();

INSERT INTO public.ticket_comments (tenant_id, ticket_id, author_id, body) VALUES
  (tests.mandant_a(), tests.a_ticket_vom_agent(),  tests.a_agent(),
   'A: Ursache eingegrenzt'),
  (tests.mandant_a(), tests.a_ticket_vom_melder(), tests.a_agent(),
   'A: Rueckfrage zum Zugang'),
  (tests.mandant_b(), tests.b_ticket(),            tests.b_agent(),
   'B: Zahlen geprueft');

-- ===========================================================================
-- Mandantengrenze
-- ===========================================================================

SELECT tests.anmelden(tests.a_agent());

SELECT results_eq(
  'SELECT count(*)::int FROM public.ticket_comments',
  ARRAY[2],
  'Bearbeiter sieht die Kommentare seines Mandanten'
);

SELECT is_empty(
  format('SELECT id FROM public.ticket_comments WHERE tenant_id = %L', tests.mandant_b()),
  'Kein Kommentar aus einem fremden Mandanten'
);

-- ===========================================================================
-- Der Melder sieht nur, was zu seinen eigenen Tickets gehört
-- ===========================================================================
--
-- Hier greift die einzige Policy im Schema, die auf eine andere Tabelle
-- zugreift: Ob das Ticket ihm gehört, steht nicht im Kommentar.

RESET ROLE;
SELECT tests.anmelden(tests.a_melder());

SELECT results_eq(
  'SELECT body FROM public.ticket_comments',
  ARRAY['A: Rueckfrage zum Zugang'],
  'Melder sieht ausschliesslich Kommentare zu seinem eigenen Ticket'
);

SELECT lives_ok(
  format(
    'INSERT INTO public.ticket_comments (ticket_id, author_id, body) VALUES (%L, (SELECT auth.uid()), ''Antwort des Melders'')',
    tests.a_ticket_vom_melder()
  ),
  'Melder darf zu seinem eigenen Ticket kommentieren'
);

-- ===========================================================================
-- Wer fremde Beiträge korrigieren darf -- und was dabei fest bleibt
-- ===========================================================================
--
-- Bis 20260809000000 durfte das niemand, auch die Verwaltung nicht. Die Regel
-- ist zurückgenommen: Ein Tippfehler blieb sonst stehen, bis sein Urheber Zeit
-- hatte, und die Verantwortung für die Daten des Mandanten liegt bei der
-- Verwaltung.
--
-- Der Bearbeiter bekommt die Erlaubnis NICHT -- die Grenze zwischen Bearbeiter
-- und Verwaltung ist die schärfste innerhalb eines Mandanten.

RESET ROLE;
SELECT tests.anmelden(tests.a_melder());

UPDATE public.ticket_comments SET body = 'vom Melder umgeschrieben'
 WHERE author_id = tests.a_agent();

RESET ROLE;
SELECT results_eq(
  format(
    'SELECT count(*)::int FROM public.ticket_comments WHERE author_id = %L AND body = ''vom Melder umgeschrieben''',
    tests.a_agent()
  ),
  ARRAY[0],
  'Ein Melder kann einen fremden Kommentar nicht umschreiben'
);

-- ---------------------------------------------------------------------------
-- Kommentieren setzt Sichtbarkeit voraus
-- ---------------------------------------------------------------------------
--
-- Diese Zusicherung fehlte, und die Luecke war keine Kleinigkeit: Der
-- WITH CHECK von ticket_comments_insert_mandant verlangt dem Wortlaut nach nur,
-- dass es das Ticket im eigenen Mandanten GIBT. Ein Melder duerfte danach auf
-- jeden fremden Vorgang schreiben.
--
-- Er darf es nicht -- aber das folgt nicht aus dem Policy-Text, sondern daraus,
-- dass die EXISTS-Unterabfrage auf public.tickets selbst unter RLS laeuft und
-- damit nur die eigenen Vorgaenge sieht. Der Schutz haengt also an einer
-- Eigenschaft, die im Ausdruck nirgends steht. Wer die Policy spaeter
-- umformuliert -- etwa den Mandanten direkt statt ueber die Unterabfrage prueft
-- --, oeffnet sie lautlos. Genau dagegen steht dieser Test.

RESET ROLE;
SELECT tests.anmelden(tests.a_melder());

SELECT throws_ok(
  format(
    'INSERT INTO public.ticket_comments (tenant_id, ticket_id, author_id, body) VALUES (%L, %L, %L, ''auf einen fremden Vorgang'')',
    tests.mandant_a(), tests.a_ticket_vom_agent(), tests.a_melder()
  ),
  '42501',
  NULL,
  'Ein Melder kann einen Vorgang, den er nicht sieht, auch nicht kommentieren'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_admin());

UPDATE public.ticket_comments SET body = 'von der Verwaltung berichtigt'
 WHERE author_id = tests.a_agent() AND tenant_id = tests.mandant_a();

RESET ROLE;
SELECT results_eq(
  format(
    'SELECT count(*)::int FROM public.ticket_comments WHERE author_id = %L AND body = ''von der Verwaltung berichtigt''',
    tests.a_agent()
  ),
  ARRAY[2],
  'Die Verwaltung darf fremde Kommentare berichtigen'
);

-- Die Zurechnung haelt der Trigger, nicht die Policy: Eine Policy sieht nur
-- NEW und kann „dieser Wert darf sich nicht aendern" gar nicht ausdruecken.
-- Ohne diese Zusicherung waere die Erlaubnis oben die Erlaubnis, jemandem eine
-- Aussage in den Mund zu legen.
SELECT tests.anmelden(tests.a_admin());
SELECT throws_ok(
  format(
    'UPDATE public.ticket_comments SET author_id = %L WHERE author_id = %L',
    tests.a_admin(), tests.a_agent()
  ),
  '42501',
  NULL,
  'Auch die Verwaltung kann einen Beitrag niemandem sonst zuschreiben'
);

-- Loeschen darf er -- etwa wenn ein Beitrag versehentlich personenbezogene
-- Daten enthaelt, die dort nicht hingehoeren.
SELECT tests.anmelden(tests.a_admin());
SELECT lives_ok(
  format(
    'DELETE FROM public.ticket_comments WHERE author_id = %L',
    tests.a_agent()
  ),
  'Der Administrator darf Kommentare loeschen'
);

-- ===========================================================================
-- Kommentare verschwinden mit ihrem Ticket
-- ===========================================================================
--
-- ON DELETE CASCADE. Ohne das bliebe nach dem Loeschlauf ein Kommentar ohne
-- Ticket zurueck -- personenbezogener Freitext, den kein Loeschkonzept mehr
-- erfasst.

RESET ROLE;
DELETE FROM public.tickets WHERE id = tests.a_ticket_vom_melder();

SELECT is_empty(
  format(
    'SELECT id FROM public.ticket_comments WHERE ticket_id = %L',
    tests.a_ticket_vom_melder()
  ),
  'Mit dem Ticket verschwinden auch seine Kommentare'
);

SELECT * FROM finish();
ROLLBACK;
