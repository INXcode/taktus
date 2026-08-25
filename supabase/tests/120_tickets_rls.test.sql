-- Zugriffsregeln auf public.tickets.
--
-- Zwei Grenzen werden geprüft:
--   1. Zwischen Mandanten -- niemand sieht etwas von einem anderen Mandanten.
--   2. Zwischen Rollen INNERHALB eines Mandanten -- ein Melder sieht nur
--      seine eigenen Tickets.
--
-- Die zweite ist der eigentliche Referenzwert. Die erste liesse sich auch mit
-- getrennten Datenbanken erreichen; die zweite nicht.
--
-- Zur Assertionswahl: RLS filtert bei SELECT STUMM -- die Abfrage gelingt und
-- liefert null Zeilen. Verweigertes Lesen wird deshalb mit is_empty() geprüft,
-- verweigertes Schreiben mit throws_ok(..., '42501'). Wer das verwechselt,
-- schreibt einen Test, der entweder immer fehlschlägt oder nie etwas findet.

BEGIN;
SELECT plan(17);

SELECT tests.basis_anlegen();

-- ===========================================================================
-- Mandantengrenze
-- ===========================================================================

SELECT tests.anmelden(tests.a_admin());

SELECT is_empty(
  format(
    'SELECT id FROM public.tickets WHERE tenant_id = %L',
    tests.mandant_b()
  ),
  'Administrator von A sieht kein Ticket von Mandant B'
);

-- Auch der gezielte Zugriff über eine bekannte Kennung führt zu nichts. Das
-- ist der IDOR-Fall aus docs/security.md, Kapitel A: Wer die UUID kennt, kommt
-- trotzdem nicht heran, weil die Autorisierung nicht an der Unkenntnis der
-- Kennung hängt.
SELECT is_empty(
  format('SELECT id FROM public.tickets WHERE id = %L', tests.b_ticket()),
  'Auch mit bekannter Ticket-Kennung: kein Zugriff ueber die Mandantengrenze'
);

-- Schreiben über die Grenze bleibt wirkungslos.
--
-- Hier NICHT throws_ok: Ist eine Zeile über die USING-Klausel gar nicht
-- sichtbar, trifft das UPDATE schlicht null Zeilen -- Postgres meldet keinen
-- Fehler. Ein Test mit throws_ok wäre hier immer rot und würde nichts über die
-- Sicherheit aussagen. Geprüft wird deshalb die Wirkung: Der Wert steht danach
-- unverändert da.
UPDATE public.tickets SET title = 'uebernommen' WHERE id = tests.b_ticket();

RESET ROLE;
SELECT results_eq(
  format('SELECT title FROM public.tickets WHERE id = %L', tests.b_ticket()),
  ARRAY['B: Auswertung stimmt nicht'],
  'UPDATE ueber die Mandantengrenze bleibt wirkungslos'
);
SELECT tests.anmelden(tests.a_admin());

-- Ein Ticket FÜR einen fremden Mandanten anzulegen, muss ebenfalls scheitern.
SELECT throws_ok(
  format(
    'INSERT INTO public.tickets (tenant_id, title, created_by) VALUES (%L, ''untergeschoben'', %L)',
    tests.mandant_b(), tests.b_agent()
  ),
  '42501',
  NULL,
  'Kein INSERT in einen fremden Mandanten'
);

-- ===========================================================================
-- Rollengrenze innerhalb eines Mandanten
-- ===========================================================================

RESET ROLE;
SELECT tests.anmelden(tests.a_agent());

SELECT results_eq(
  'SELECT count(*)::int FROM public.tickets',
  ARRAY[2],
  'Bearbeiter sieht beide Tickets seines Mandanten'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_melder());

SELECT results_eq(
  'SELECT count(*)::int FROM public.tickets',
  ARRAY[1],
  'Melder sieht ausschliesslich das selbst gemeldete Ticket'
);

SELECT is_empty(
  format(
    'SELECT id FROM public.tickets WHERE id = %L',
    tests.a_ticket_vom_agent()
  ),
  'Melder sieht das Ticket eines Kollegen nicht -- auch im selben Mandanten'
);

-- Der Melder darf melden. Das ist sein Zweck. Den Kunden liefert er nicht mit
-- -- der Trigger setzt ihn aus dem Profil.
SELECT lives_ok(
  'INSERT INTO public.tickets (title, created_by) VALUES (''Neue Meldung'', (SELECT auth.uid()))',
  'Melder darf ein Ticket anlegen, ohne einen Kunden zu nennen'
);

-- ===========================================================================
-- Der Kunde eines Meldertickets ist keine Eingabe
-- ===========================================================================
--
-- Ein Melder gehoert zu genau einem Kunden. Wuerde das Formular den Kunden
-- bestimmen, liesse sich ein Vorgang per untergeschobenem Feld auf fremde
-- Rechnung buchen -- ein Fehler, der niemandem auffiele, weil das Ticket
-- voellig normal aussieht. Der Trigger ueberschreibt den Wert deshalb.
SELECT lives_ok(
  format(
    'INSERT INTO public.tickets (title, created_by, customer_id) VALUES (''Untergeschobener Kunde'', (SELECT auth.uid()), %L)',
    tests.a_kunde_2()
  ),
  'Ein Melder darf ein Ticket mit fremdem Kunden ABSENDEN -- ohne Fehler'
);

SELECT results_eq(
  'SELECT customer_id FROM public.tickets WHERE title = ''Untergeschobener Kunde''',
  ARRAY[tests.a_kunde_1()],
  'Der Trigger setzt den Kunden aus dem Profil -- die Eingabe bleibt wirkungslos'
);

-- Er darf es aber nicht auf einen Kollegen ausstellen.
SELECT throws_ok(
  format(
    'INSERT INTO public.tickets (title, created_by) VALUES (''Fremdmeldung'', %L)',
    tests.a_agent()
  ),
  '42501',
  NULL,
  'Melder kann kein Ticket im Namen eines anderen anlegen'
);

-- Er darf sein Ticket nicht selbst schliessen: Das setzt closed_at und startet
-- damit die Aufbewahrungsfrist -- eine Entscheidung, die der Bearbeitung
-- vorbehalten ist.
SELECT throws_ok(
  format(
    'UPDATE public.tickets SET status = ''closed'', closed_at = now() WHERE id = %L',
    tests.a_ticket_vom_melder()
  ),
  '42501',
  NULL,
  'Melder kann sein Ticket nicht selbst schliessen'
);

-- ===========================================================================
-- Rechteausweitung über die Zuweisung
-- ===========================================================================

RESET ROLE;
SELECT tests.anmelden(tests.a_agent());

SELECT lives_ok(
  format(
    'UPDATE public.tickets SET status = ''in_progress'' WHERE id = %L',
    tests.a_ticket_vom_melder()
  ),
  'Bearbeiter darf den Status aendern'
);

-- Ein Ticket lässt sich nicht in einen anderen Mandanten verschieben. Ohne die
-- WITH-CHECK-Klausel wäre das der einfachste Weg, Daten über die Grenze zu
-- bewegen -- lesend käme man nicht heran, schreibend aber sehr wohl.
SELECT throws_ok(
  format(
    'UPDATE public.tickets SET tenant_id = %L WHERE id = %L',
    tests.mandant_b(), tests.a_ticket_vom_agent()
  ),
  NULL,
  NULL,
  'Ein Ticket laesst sich nicht in einen fremden Mandanten verschieben'
);

-- Der Kunde eines fremden Mandanten ist ebenfalls kein gueltiges Ziel. Hier
-- greift nicht RLS, sondern der zusammengesetzte Fremdschluessel
-- (tenant_id, customer_id): Ein Bearbeiter SIEHT den fremden Kunden gar
-- nicht, aber seine Kennung zu kennen genuegte sonst.
SELECT throws_ok(
  format(
    'UPDATE public.tickets SET customer_id = %L WHERE id = %L',
    tests.b_kunde(), tests.a_ticket_vom_agent()
  ),
  '23503',
  NULL,
  'Ein Ticket laesst sich nicht auf einen Kunden aus einem fremden Mandanten setzen'
);

-- ===========================================================================
-- Ticketnummern laufen je Mandant, nicht global
-- ===========================================================================

RESET ROLE;

SELECT results_eq(
  format(
    'SELECT ticket_number FROM public.tickets WHERE tenant_id = %L ORDER BY ticket_number',
    tests.mandant_a()
  ),
  ARRAY[1, 2, 3, 4],
  'Mandant A zaehlt 1, 2, 3, 4'
);

-- Der erste Vorgang von Mandant B traegt ebenfalls die 1. Eine global
-- fortlaufende Nummer wuerde verraten, wie viele Vorgaenge die uebrigen
-- Mandanten anlegen.
SELECT results_eq(
  format(
    'SELECT ticket_number FROM public.tickets WHERE tenant_id = %L',
    tests.mandant_b()
  ),
  ARRAY[1],
  'Mandant B beginnt unabhaengig davon ebenfalls bei 1'
);

SELECT * FROM finish();
ROLLBACK;
