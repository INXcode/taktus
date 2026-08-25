-- ===========================================================================
-- Anonymisierung: der Ersatzname behauptet eine Loeschung, die nicht stattfand
-- ===========================================================================
--
-- `anonymize_profile` setzte den Anzeigenamen auf 'Geloeschter Nutzer'. Das
-- ist an zwei Stellen falsch.
--
-- Sachlich: Der Vorgang heisst Anonymisierung, und er ist eine. Geloescht wird
-- der Nutzer im zweiten Schritt, in auth.users, und dieser Schritt findet
-- ausserhalb der Anwendung statt -- beim Betreiber der Instanz, moeglicherweise
-- spaeter, moeglicherweise gar nicht (docs/loeschkonzept.md, Abschnitt
-- „Loeschung"). Ein Anzeigename, der „geloescht" behauptet, belegt damit einen
-- Vorgang, den die Anwendung weder ausgefuehrt hat noch pruefen kann.
--
-- Sprachlich: 'Geloeschter Nutzer' steht in einer deutschsprachigen Oberflaeche
-- und traegt ein aufgeloestes Umlautzeichen. Der Wert steht in der Ticketliste,
-- im Protokoll und im Bestaetigungsdialog -- also dort, wo ihn jemand liest,
-- und nicht in einem SQL-Kommentar, wo die ASCII-Schreibweise dieses
-- Repositories ihren Grund hat.
--
-- 'Anonymisierter Nutzer' loest beides: Es benennt den Vorgang zutreffend,
-- liest sich an der Stelle eines Namens wie einer -- und kommt ohne Umlaut aus.
--
-- Der Entwurf schrieb an dieser Stelle „Anonymisiert". Das war als Zustand
-- gemeint und nicht als Name; als Anzeigename in einer Liste von Personen
-- ergaenzt „Nutzer" das fehlende Substantiv.
--
-- Bestandsdaten werden mitgezogen: Wer bereits anonymisiert wurde, traegt sonst
-- dauerhaft den alten Wert, und in derselben Liste stuenden zwei Woerter fuer
-- denselben Zustand. Der Rueckschluss auf eine Person ist dabei nicht moeglich
-- -- der Name ist in beiden Faellen bereits fort.
--
-- Das Basisschema bleibt unberuehrt; die Aenderung kommt als eigene Migration.
-- ---------------------------------------------------------------------------

UPDATE public.profiles
   SET display_name = 'Anonymisierter Nutzer'
 WHERE display_name = 'Geloeschter Nutzer';

-- Vollstaendig neu definiert statt gepatcht: `CREATE OR REPLACE FUNCTION`
-- ersetzt den Rumpf als Ganzes. Der uebrige Inhalt ist unveraendert aus
-- 20260805000000_funktionsrechte.sql uebernommen -- geaendert ist genau die
-- eine Zeile mit dem Ersatznamen.
CREATE OR REPLACE FUNCTION public.anonymize_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_aufrufer   uuid;
  v_ziel_tenant uuid;
BEGIN
  v_aufrufer := (SELECT auth.uid());

  -- Kein angemeldeter Nutzer = service_role. Die Autorisierung liegt dann
  -- bei der aufrufenden Stelle (src/actions/members.ts).
  IF v_aufrufer IS NOT NULL THEN
    IF NOT (SELECT public.is_tenant_admin()) THEN
      RAISE EXCEPTION 'Nur die Verwaltung darf anonymisieren'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    SELECT p.tenant_id INTO v_ziel_tenant
      FROM public.profiles AS p
     WHERE p.id = p_profile_id;

    IF v_ziel_tenant IS DISTINCT FROM (SELECT public.current_tenant_id()) THEN
      RAISE EXCEPTION 'Kein Zugriff auf ein Profil eines anderen Mandanten'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  UPDATE public.profiles
     SET display_name = 'Anonymisierter Nutzer',
         deactivated_at = COALESCE(deactivated_at, now())
   WHERE id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profil % nicht gefunden', p_profile_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Die Protokolleintraege bleiben; nur der Bezug zur Person entfaellt. Damit
  -- ist weiterhin belegt, DASS eine Aenderung stattfand -- nur nicht mehr,
  -- durch wen.
  UPDATE public.audit_log
     SET actor_id = NULL
   WHERE actor_id = p_profile_id;
END;
$$;

-- `CREATE OR REPLACE FUNCTION` setzt die Rechte einer Funktion zurueck. Der
-- Entzug aus 20260805000000_funktionsrechte.sql muss deshalb erneut gesetzt
-- werden -- sonst stuende die Funktion nach dieser Migration wieder allen
-- offen, und zwar lautlos.
REVOKE EXECUTE ON FUNCTION public.anonymize_profile(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_profile(uuid) TO service_role;

COMMENT ON FUNCTION public.anonymize_profile(uuid) IS
  'Loest den Personenbezug im Anwendungsschema. Prueft Rolle und Mandant '
  'selbst, sofern ein angemeldeter Nutzer aufruft. Die E-Mail-Adresse in '
  'auth.users ist gesondert zu loeschen -- dort liegt die eigentliche Angabe.';
