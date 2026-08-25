-- Zugriffsregeln auf public.audit_log.
--
-- Zwei Eigenschaften werden geprüft, die ein Protokoll erst zu einem
-- Protokoll machen:
--
--   1. Es ist NUR ANHÄNGEND. Kein UPDATE, kein DELETE -- auch nicht für den
--      Administrator. Ein Protokoll, das sein Gegenstand verändern kann,
--      belegt nichts.
--   2. Es gibt genau EINEN Weg hinein: public.log_audit(). Direkte Einfügungen
--      scheitern, weil es keine INSERT-Policy gibt.

BEGIN;
SELECT plan(7);

SELECT tests.basis_anlegen();

INSERT INTO public.audit_log (tenant_id, actor_id, action, entity_type, entity_id, changed_fields)
VALUES
  (tests.mandant_a(), tests.a_agent(), 'ticket.update', 'ticket',
   tests.a_ticket_vom_agent(), ARRAY['status', 'assignee_id']),
  (tests.mandant_b(), tests.b_agent(), 'ticket.create', 'ticket',
   tests.b_ticket(), NULL);

-- ===========================================================================
-- Nur der Administrator liest, und nur seinen Mandanten
-- ===========================================================================

SELECT tests.anmelden(tests.a_admin());
SELECT results_eq(
  'SELECT count(*)::int FROM public.audit_log',
  ARRAY[1],
  'Administrator sieht ausschliesslich das Protokoll seines Mandanten'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_agent());
SELECT is_empty(
  'SELECT id FROM public.audit_log',
  'Ein Bearbeiter liest das Protokoll nicht'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_melder());
SELECT is_empty(
  'SELECT id FROM public.audit_log',
  'Ein Melder liest das Protokoll nicht'
);

-- ===========================================================================
-- Nur anhängend
-- ===========================================================================

RESET ROLE;
SELECT tests.anmelden(tests.a_admin());

-- Direktes Einfuegen scheitert: Es gibt keine INSERT-Policy.
SELECT throws_ok(
  format(
    'INSERT INTO public.audit_log (tenant_id, action, entity_type) VALUES (%L, ''erfunden'', ''ticket'')',
    tests.mandant_a()
  ),
  '42501',
  NULL,
  'Direktes Einfuegen ins Protokoll ist nicht moeglich -- nur ueber log_audit()'
);

-- Aendern und Loeschen treffen null Zeilen: keine UPDATE-, keine
-- DELETE-Policy, die Zeile ist fuer diese Befehle nicht erreichbar.
UPDATE public.audit_log SET action = 'geschoent' WHERE tenant_id = tests.mandant_a();
DELETE FROM public.audit_log WHERE tenant_id = tests.mandant_a();

RESET ROLE;
SELECT results_eq(
  format(
    'SELECT action FROM public.audit_log WHERE tenant_id = %L',
    tests.mandant_a()
  ),
  ARRAY['ticket.update'],
  'Protokolleintraege lassen sich weder aendern noch loeschen'
);

-- ===========================================================================
-- Der vorgesehene Weg funktioniert
-- ===========================================================================

SELECT tests.anmelden(tests.a_agent());
SELECT lives_ok(
  'SELECT public.log_audit(''ticket.view'', ''ticket'', NULL, NULL)',
  'log_audit() traegt einen Eintrag ein -- auch fuer einen Bearbeiter'
);

RESET ROLE;
SELECT results_eq(
  format(
    'SELECT actor_id FROM public.audit_log WHERE action = ''ticket.view'' AND tenant_id = %L',
    tests.mandant_a()
  ),
  ARRAY[tests.a_agent()],
  'log_audit() setzt Mandant und Handelnden serverseitig'
);

SELECT * FROM finish();
ROLLBACK;
