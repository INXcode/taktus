-- Zugriffsregeln auf public.profiles.
--
-- Diese Tabelle ist die Wurzel der Zugriffskontrolle: current_tenant_id() und
-- current_app_role() lesen sie. Wer hier seine eigene Zeile frei ändern könnte,
-- könnte seine Rolle ändern -- und damit jede Policy im Schema aushebeln.

BEGIN;
SELECT plan(12);

SELECT tests.basis_anlegen();

-- ===========================================================================
-- Sichtbarkeit
-- ===========================================================================

SELECT tests.anmelden(tests.a_admin());
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles',
  ARRAY[4],
  'Administrator sieht die vier Profile seines Mandanten'
);

SELECT is_empty(
  format('SELECT id FROM public.profiles WHERE tenant_id = %L', tests.mandant_b()),
  'Administrator sieht kein Profil eines fremden Mandanten'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_melder());
SELECT results_eq(
  'SELECT count(*)::int FROM public.profiles',
  ARRAY[1],
  'Melder sieht ausschliesslich sich selbst -- keine Kollegenliste'
);

-- ===========================================================================
-- Rechteausweitung
-- ===========================================================================
--
-- Der wichtigste Test dieser Datei. Ohne die Rollenbedingung in der
-- WITH-CHECK-Klausel von profiles_update_eigenes koennte sich jeder Nutzer
-- selbst zum Administrator machen -- ein einzeiliges UPDATE auf die eigene,
-- ohnehin sichtbare Zeile.

SELECT throws_ok(
  'UPDATE public.profiles SET role = ''admin'' WHERE id = (SELECT auth.uid())',
  '42501',
  NULL,
  'Melder kann sich nicht selbst zum Administrator machen'
);

SELECT throws_ok(
  format(
    'UPDATE public.profiles SET tenant_id = %L WHERE id = (SELECT auth.uid())',
    tests.mandant_b()
  ),
  '42501',
  NULL,
  'Niemand kann sich selbst in einen anderen Mandanten versetzen'
);

-- Dieselbe Rechteausweitung eine Ebene tiefer: Wer sich selbst auf einen
-- anderen Kunden umhaengen koennte, liesse kuenftige Vorgaenge auf fremde
-- Rechnung buchen. Die WITH-CHECK-Klausel friert den Kunden ueber
-- current_customer_id() ein.
SELECT throws_ok(
  format(
    'UPDATE public.profiles SET customer_id = %L WHERE id = (SELECT auth.uid())',
    tests.a_kunde_2()
  ),
  '42501',
  NULL,
  'Ein Melder kann sich nicht selbst auf einen anderen Kunden umhaengen'
);

-- Und der Kunde laesst sich auch nicht einfach abstreifen.
SELECT throws_ok(
  'UPDATE public.profiles SET customer_id = NULL WHERE id = (SELECT auth.uid())',
  '42501',
  NULL,
  'Ein Melder kann seinen Kunden nicht entfernen'
);

-- Eine Deaktivierung laesst sich nicht selbst aufheben. Ohne diese Bedingung
-- waere der Zugriffsentzug wirkungslos: Wer noch ein gueltiges Token hat,
-- koennte sich reaktivieren.
RESET ROLE;
UPDATE public.profiles SET deactivated_at = now() WHERE id = tests.a_agent();
SELECT tests.anmelden(tests.a_agent());
SELECT throws_ok(
  'UPDATE public.profiles SET deactivated_at = NULL WHERE id = (SELECT auth.uid())',
  '42501',
  NULL,
  'Ein deaktiviertes Profil kann sich nicht selbst reaktivieren'
);

-- Der eigene Anzeigename bleibt aenderbar -- das ist der Zweck der Policy.
RESET ROLE;
UPDATE public.profiles SET deactivated_at = NULL WHERE id = tests.a_agent();
SELECT tests.anmelden(tests.a_agent());
SELECT lives_ok(
  'UPDATE public.profiles SET display_name = ''Neuer Name'' WHERE id = (SELECT auth.uid())',
  'Der eigene Anzeigename laesst sich aendern'
);

-- ===========================================================================
-- Verwaltung durch den Administrator
-- ===========================================================================

RESET ROLE;
SELECT tests.anmelden(tests.a_admin());

-- Der Kunde muss beim Rollenwechsel mitgefuehrt werden: Ein Bearbeiter haengt
-- am Mandanten, nicht an einem Kunden. Der CHECK
-- profiles_kunde_nur_beim_melder erzwingt das -- ohne `customer_id = NULL`
-- scheitert dieses UPDATE, und zwar mit 23514 statt stillschweigend.
SELECT lives_ok(
  format(
    'UPDATE public.profiles SET role = ''agent'', customer_id = NULL WHERE id = %L',
    tests.a_melder()
  ),
  'Administrator darf die Rolle innerhalb seines Mandanten aendern'
);

-- Die Gegenprobe zum CHECK: Rolle wechseln und den Kunden stehen lassen geht
-- nicht. Sonst entstuende ein Bearbeiter mit Kundenbindung -- ein Zustand,
-- den weder die Oberflaeche noch die Auswertung kennt.
SELECT throws_ok(
  format(
    'UPDATE public.profiles SET role = ''agent'' WHERE id = %L',
    tests.a_melder_kunde_2()
  ),
  '23514',
  NULL,
  'Ein Bearbeiter kann nicht an einem Kunden haengen bleiben'
);

-- Aber nur innerhalb des eigenen Mandanten. Der Versuch trifft null Zeilen --
-- die fremde Zeile ist ueber die USING-Klausel gar nicht erreichbar.
UPDATE public.profiles SET role = 'admin' WHERE id = tests.b_melder();
RESET ROLE;
SELECT results_eq(
  format('SELECT role::text FROM public.profiles WHERE id = %L', tests.b_melder()),
  ARRAY['requester'],
  'Administrator von A kann die Rolle in Mandant B nicht veraendern'
);

SELECT * FROM finish();
ROLLBACK;
