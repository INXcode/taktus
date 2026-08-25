-- Mandantentrennung auf Ebene der Datenintegrität.
--
-- ===========================================================================
-- Warum RLS allein nicht genügt
-- ===========================================================================
--
-- Row Level Security schützt den Zugriff über die Anwendung. Sie schützt nicht
-- vor Code, der mit `service_role` läuft -- Serverfunktionen, Wartungsskripte,
-- Datenübernahmen. Genau dort passieren Zuordnungsfehler: nicht böswillig,
-- sondern durch eine vertauschte Variable.
--
-- `tenant_id` liegt auf ticket_comments und time_entries denormalisiert vor,
-- damit keine Policy über einen Join gehen muss. Damit die Denormalisierung
-- nicht auseinanderlaufen kann, bindet ein ZUSAMMENGESETZTER Fremdschlüssel
-- (tenant_id, ticket_id) an dasselbe Paar in tickets.
--
-- Diese Zusicherung gilt unabhängig von RLS, unabhängig von der Rolle und
-- unabhängig davon, was die Anwendung versucht. Die Tests laufen deshalb
-- bewusst als `postgres` -- also mit BYPASSRLS.
-- ===========================================================================

BEGIN;
SELECT plan(9);

SELECT tests.basis_anlegen();

-- ---------------------------------------------------------------------------
-- Kommentar am Ticket eines fremden Mandanten
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  format(
    'INSERT INTO public.ticket_comments (tenant_id, ticket_id, author_id, body) VALUES (%L, %L, %L, ''untergeschoben'')',
    tests.mandant_a(), tests.b_ticket(), tests.a_agent()
  ),
  '23503',
  NULL,
  'Kommentar zu einem Ticket eines fremden Mandanten scheitert am Fremdschluessel'
);

-- ---------------------------------------------------------------------------
-- Zeitbuchung auf ein Ticket eines fremden Mandanten
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  format(
    'INSERT INTO public.time_entries (tenant_id, ticket_id, user_id, minutes, worked_on) VALUES (%L, %L, %L, 30, current_date)',
    tests.mandant_a(), tests.b_ticket(), tests.a_agent()
  ),
  '23503',
  NULL,
  'Zeitbuchung auf ein fremdes Ticket scheitert am Fremdschluessel'
);

-- ---------------------------------------------------------------------------
-- Zuweisung an ein Profil eines fremden Mandanten
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  format(
    'UPDATE public.tickets SET assignee_id = %L WHERE id = %L',
    tests.b_agent(), tests.a_ticket_vom_agent()
  ),
  '23503',
  NULL,
  'Zuweisung an ein Profil aus einem fremden Mandanten scheitert'
);

-- ---------------------------------------------------------------------------
-- Ticket auf einen Kunden eines fremden Mandanten
-- ---------------------------------------------------------------------------
--
-- Der zusammengesetzte Fremdschluessel (tenant_id, customer_id). Ohne ihn
-- liesse sich ein Vorgang einem Kunden zuordnen, der einem anderen Betrieb
-- gehoert -- und in einer spaeteren Abrechnung landete er auf dessen
-- Rechnung.
SELECT throws_ok(
  format(
    'UPDATE public.tickets SET customer_id = %L WHERE id = %L',
    tests.b_kunde(), tests.a_ticket_vom_agent()
  ),
  '23503',
  NULL,
  'Ticket auf einen Kunden eines fremden Mandanten scheitert am Fremdschluessel'
);

-- ---------------------------------------------------------------------------
-- Melder an einem Kunden eines fremden Mandanten
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  format(
    'UPDATE public.profiles SET customer_id = %L WHERE id = %L',
    tests.b_kunde(), tests.a_melder()
  ),
  '23503',
  NULL,
  'Melder an einem Kunden aus einem fremden Mandanten scheitert am Fremdschluessel'
);

-- ---------------------------------------------------------------------------
-- Ein Kunde mit Vorgängen lässt sich nicht entfernen
-- ---------------------------------------------------------------------------
--
-- ON DELETE RESTRICT statt CASCADE. Ein Kunde ist ein Stammdatum; seine
-- Vorgaenge sind es nicht. Ein Kaskadenloeschen risse Tickets, Kommentare und
-- Zeitbuchungen mit -- an der Aufbewahrungsfrist vorbei, und ohne dass es im
-- Protokoll als Loeschung erschiene.
SELECT throws_ok(
  format('DELETE FROM public.customers WHERE id = %L', tests.a_kunde_1()),
  '23503',
  NULL,
  'Ein Kunde mit Vorgaengen laesst sich nicht loeschen'
);

-- ---------------------------------------------------------------------------
-- Ein Mandant mit Daten lässt sich nicht einfach entfernen
-- ---------------------------------------------------------------------------
--
-- ON DELETE RESTRICT auf profiles.tenant_id. Ohne das entstuenden verwaiste
-- Datensaetze -- oder, schlimmer, ein stilles Kaskadenloeschen quer durch die
-- Anwendung.
SELECT throws_ok(
  format('DELETE FROM public.tenants WHERE id = %L', tests.mandant_a()),
  '23503',
  NULL,
  'Ein Mandant mit Profilen laesst sich nicht loeschen'
);

-- ---------------------------------------------------------------------------
-- Status und Abschlusszeitpunkt bleiben konsistent
-- ---------------------------------------------------------------------------
--
-- Ohne diese Kopplung entstuende ein geschlossenes Ticket ohne closed_at --
-- also eines, dessen Aufbewahrungsfrist nie beginnt. Eine stille, unbefristete
-- Speicherung, die niemandem auffiele.
--
-- Der BEFORE-UPDATE-Trigger leitet closed_at aus dem Status ab; hier wird
-- geprueft, dass das Ergebnis stimmt.
UPDATE public.tickets SET status = 'closed' WHERE id = tests.a_ticket_vom_agent();
SELECT isnt(
  (SELECT closed_at FROM public.tickets WHERE id = tests.a_ticket_vom_agent()),
  NULL,
  'Schliessen setzt closed_at automatisch -- der Fristbeginn haengt nicht an der Anwendung'
);

UPDATE public.tickets SET status = 'open' WHERE id = tests.a_ticket_vom_agent();
SELECT is(
  (SELECT closed_at FROM public.tickets WHERE id = tests.a_ticket_vom_agent()),
  NULL,
  'Wiedereroeffnen setzt closed_at zurueck -- keine Loeschung eines offenen Vorgangs'
);

SELECT * FROM finish();
ROLLBACK;
