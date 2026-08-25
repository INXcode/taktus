-- Zugriffshelfer: current_tenant_id, current_app_role, is_tenant_admin.
--
-- Diese drei Funktionen tragen die gesamte Zugriffskontrolle. Jede Policy im
-- Schema hängt an ihrem Ergebnis -- ein Fehler hier wirkt überall zugleich.
--
-- Geprüft wird vor allem, dass sie GESCHLOSSEN ausfallen: Im Zweifel NULL,
-- nicht irgendein Mandant.

BEGIN;
SELECT plan(11);

SELECT tests.basis_anlegen();

-- ---------------------------------------------------------------------------
-- Ohne Anmeldung
-- ---------------------------------------------------------------------------
SELECT is(
  public.current_tenant_id(), NULL,
  'Ohne Anmeldung liefert current_tenant_id() NULL'
);
SELECT is(
  public.current_app_role(), NULL,
  'Ohne Anmeldung liefert current_app_role() NULL'
);
SELECT is(
  public.is_tenant_admin(), false,
  'Ohne Anmeldung ist is_tenant_admin() false, nicht NULL'
);

-- ---------------------------------------------------------------------------
-- Angemeldet
-- ---------------------------------------------------------------------------
SELECT tests.anmelden(tests.a_agent());

SELECT is(
  public.current_tenant_id(), tests.mandant_a(),
  'Bearbeiter aus A bekommt Mandant A'
);
SELECT is(
  public.current_app_role(), 'agent'::public.app_role,
  'Rolle wird korrekt geliefert'
);
SELECT is(
  public.is_tenant_admin(), false,
  'Ein Bearbeiter ist kein Administrator'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_admin());
SELECT is(
  public.is_tenant_admin(), true,
  'Ein Administrator wird als solcher erkannt'
);

-- ---------------------------------------------------------------------------
-- Zugriffsentzug wirkt SOFORT
-- ---------------------------------------------------------------------------
--
-- Das war das Argument gegen einen JWT-Claim: Ein Claim wirkt erst nach dem
-- nächsten Token-Refresh, ein deaktivierter Nutzer dürfte also bis zu einer
-- Stunde weiterlesen. Hier ist der Beleg, dass es anders läuft.
RESET ROLE;
UPDATE public.profiles
   SET deactivated_at = now()
 WHERE id = tests.a_melder();

SELECT tests.anmelden(tests.a_melder());
SELECT is(
  public.current_tenant_id(), NULL,
  'Deaktiviertes Profil: current_tenant_id() liefert sofort NULL'
);

-- Und das wirkt sich unmittelbar auf die Sichtbarkeit aus.
SELECT is_empty(
  'SELECT id FROM public.tickets',
  'Deaktiviertes Profil sieht keine Tickets mehr'
);

-- ---------------------------------------------------------------------------
-- Gesperrter Mandant
-- ---------------------------------------------------------------------------
--
-- tenants.is_active = false soll die Verarbeitung einschränken (Art. 18 DSGVO),
-- ohne Daten zu löschen. Das wirkt nur, wenn die Helfer den Mandantenstatus
-- mit prüfen.
RESET ROLE;
UPDATE public.tenants SET is_active = false WHERE id = tests.mandant_b();

SELECT tests.anmelden(tests.b_admin());
SELECT is(
  public.current_tenant_id(), NULL,
  'Gesperrter Mandant: auch der Administrator bekommt NULL'
);
SELECT is_empty(
  'SELECT id FROM public.tickets',
  'Gesperrter Mandant: keine Daten sichtbar, aber nichts geloescht'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
