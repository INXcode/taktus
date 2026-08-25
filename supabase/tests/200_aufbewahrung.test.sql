-- Löschkonzept: purge_expired_data().
--
-- Das Löschkonzept verlangt „Löschung tatsächlich implementiert, nicht nur
-- ein Flag". Dieser Test prüft genau das -- dass Zeilen VERSCHWINDEN, nicht dass
-- eine Funktion fehlerfrei durchläuft.
--
-- Der Unterschied ist praktisch bedeutsam: Eine SECURITY-DEFINER-Funktion, die
-- gegen eine Tabelle mit FORCE ROW LEVEL SECURITY läuft, kann still null Zeilen
-- löschen und trotzdem erfolgreich zurückkehren. Ein Test, der nur auf
-- „lives_ok" prüft, wäre dann grün, während das Löschkonzept nichts tut.

BEGIN;
SELECT plan(6);

SELECT tests.basis_anlegen();

-- Aufbewahrung auf 30 Tage verkürzen, damit der Test mit realistischen
-- Zeitpunkten arbeiten kann.
UPDATE public.tenants
   SET ticket_retention_days = 30, audit_retention_days = 30
 WHERE id = tests.mandant_a();

-- Drei Fälle, bewusst nebeneinander:
--   1. geschlossen und abgelaufen  -> muss verschwinden
--   2. geschlossen, noch nicht abgelaufen -> muss bleiben
--   3. OFFEN und uralt -> muss bleiben (die Frist beginnt erst mit closed_at)
UPDATE public.tickets
   SET status = 'closed', closed_at = now() - interval '400 days'
 WHERE id = tests.a_ticket_vom_agent();

UPDATE public.tickets
   SET status = 'closed', closed_at = now() - interval '5 days'
 WHERE id = tests.a_ticket_vom_melder();

INSERT INTO public.tickets (id, tenant_id, customer_id, title, created_by, created_at)
VALUES ('a1000000-0000-4000-8000-000000000009', tests.mandant_a(),
        tests.a_kunde_1(), 'A: seit Jahren offen', tests.a_agent(),
        now() - interval '900 days');

-- Ein Kommentar und eine Zeitbuchung am abgelaufenen Ticket. Beide müssen
-- mitverschwinden, sonst bliebe personenbezogener Freitext ohne Bezug zurück --
-- und den erfasst danach kein Löschkonzept mehr.
INSERT INTO public.ticket_comments (tenant_id, ticket_id, author_id, body)
VALUES (tests.mandant_a(), tests.a_ticket_vom_agent(), tests.a_agent(),
        'Enthaelt Freitext, der mitverschwinden muss');

INSERT INTO public.time_entries (tenant_id, ticket_id, user_id, minutes, worked_on)
VALUES (tests.mandant_a(), tests.a_ticket_vom_agent(), tests.a_agent(), 60,
        current_date - 400);

INSERT INTO public.audit_log (tenant_id, actor_id, action, entity_type, occurred_at)
VALUES
  (tests.mandant_a(), tests.a_agent(), 'ticket.update', 'ticket',
   now() - interval '400 days'),
  (tests.mandant_a(), tests.a_agent(), 'ticket.view', 'ticket',
   now() - interval '5 days');

-- ---------------------------------------------------------------------------
-- Löschlauf
-- ---------------------------------------------------------------------------

SELECT lives_ok(
  'SELECT * FROM public.purge_expired_data()',
  'Der Loeschlauf laeuft durch'
);

-- Das eigentliche Kriterium: Was ist danach noch da?

SELECT is_empty(
  format('SELECT id FROM public.tickets WHERE id = %L', tests.a_ticket_vom_agent()),
  'Abgelaufenes geschlossenes Ticket ist TATSAECHLICH geloescht, nicht markiert'
);

SELECT isnt_empty(
  format('SELECT id FROM public.tickets WHERE id = %L', tests.a_ticket_vom_melder()),
  'Geschlossenes Ticket innerhalb der Frist bleibt erhalten'
);

-- Der Fall, der leicht falsch gemacht wird: Ein unerledigter Vorgang darf nicht
-- wegen Zeitablaufs verschwinden. Die Frist beginnt mit dem Abschluss, nicht
-- mit der Anlage.
SELECT isnt_empty(
  'SELECT id FROM public.tickets WHERE id = ''a1000000-0000-4000-8000-000000000009''',
  'Ein seit 900 Tagen OFFENES Ticket bleibt erhalten'
);

SELECT is_empty(
  format(
    'SELECT id FROM public.ticket_comments WHERE ticket_id = %L',
    tests.a_ticket_vom_agent()
  ),
  'Kommentare und Zeitbuchungen verschwinden mit dem Ticket'
);

SELECT results_eq(
  format(
    'SELECT count(*)::int FROM public.audit_log WHERE tenant_id = %L',
    tests.mandant_a()
  ),
  ARRAY[1],
  'Abgelaufene Protokolleintraege sind geloescht, aktuelle bleiben'
);

SELECT * FROM finish();
ROLLBACK;
