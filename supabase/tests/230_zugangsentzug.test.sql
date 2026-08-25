-- Deaktivieren entzieht auch die Anmeldung, nicht nur die Sichtbarkeit.
--
-- 010_zugriffshelfer.test.sql belegt bereits, dass ein deaktiviertes Profil
-- nichts mehr SIEHT -- current_tenant_id() liefert NULL, jede Policy faellt zu.
-- Was dort NICHT geprueft wurde: ob der Zugang selbst noch besteht.
--
-- Er bestand. Die Zeile in auth.users blieb unberuehrt, der Nutzer konnte sich
-- weiterhin anmelden und blieb `authenticated`. Folgenlos, solange jede
-- Funktion den Mandantenbezug richtig auswertet -- und genau das tat
-- export_person_data() nicht (20260812000000). Diese Datei prueft die
-- Voraussetzung, nicht den Einzelfall.

BEGIN;
SELECT plan(7);

SELECT tests.basis_anlegen();

-- Eine Sitzung und ein Auffrischungstoken, wie GoTrue sie nach einer
-- Anmeldung anlegt. Ohne sie liefe der Test ins Leere: Geloescht wuerde
-- nichts, und die Zusicherung waere erfuellt, ohne etwas zu belegen.
INSERT INTO auth.sessions (id, user_id, created_at)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', tests.a_melder(), now());

INSERT INTO auth.refresh_tokens (token, user_id, session_id, revoked)
VALUES ('probe-token', tests.a_melder()::text,
        'aaaaaaaa-0000-4000-8000-000000000001', false);

-- ===========================================================================
-- Ausgangslage
-- ===========================================================================

SELECT is(
  (SELECT banned_until FROM auth.users WHERE id = tests.a_melder()),
  NULL::timestamptz,
  'Vor dem Entzug ist niemand gesperrt'
);

SELECT is(
  (SELECT count(*)::int FROM auth.sessions WHERE user_id = tests.a_melder()),
  1,
  'Vor dem Entzug besteht eine Sitzung'
);

-- ===========================================================================
-- Zugang entziehen
-- ===========================================================================

UPDATE public.profiles
   SET deactivated_at = now()
 WHERE id = tests.a_melder();

SELECT ok(
  (SELECT banned_until > now() FROM auth.users WHERE id = tests.a_melder()),
  'Deaktivieren sperrt die Anmeldung'
);

SELECT is(
  (SELECT count(*)::int FROM auth.sessions WHERE user_id = tests.a_melder()),
  0,
  'Deaktivieren entwertet die Sitzung -- kein Auffrischen mehr'
);

SELECT is(
  (SELECT count(*)::int FROM auth.refresh_tokens
    WHERE user_id = tests.a_melder()::text),
  0,
  'Deaktivieren entfernt auch das Auffrischungstoken'
);

-- Der Nachbar bleibt unberuehrt. Ohne diese Zusicherung koennte der Trigger
-- die Tabellen leerraeumen und die vier Pruefungen oben blieben gruen.
SELECT is(
  (SELECT count(*)::int FROM auth.users
    WHERE banned_until IS NOT NULL AND id <> tests.a_melder()),
  0,
  'Der Entzug trifft ausschliesslich das deaktivierte Profil'
);

-- ===========================================================================
-- Und wieder zurueck
-- ===========================================================================
--
-- Ohne diesen Zweig waere die Reaktivierung in der Oberflaeche wirkungslos:
-- Das Profil waere aktiv, die Anmeldung weiterhin gesperrt, und niemand
-- faende den Grund.

UPDATE public.profiles
   SET deactivated_at = NULL
 WHERE id = tests.a_melder();

SELECT is(
  (SELECT banned_until FROM auth.users WHERE id = tests.a_melder()),
  NULL::timestamptz,
  'Reaktivieren nimmt die Sperre zurueck'
);

SELECT * FROM finish();
ROLLBACK;
