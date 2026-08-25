-- ===========================================================================
-- Ausfuehrungsrechte auf die SECURITY-DEFINER-Funktionen
-- ===========================================================================
--
-- Das Basisschema wollte `anonymize_profile` und `purge_expired_data` allein
-- dem `service_role` vorbehalten:
--
--   REVOKE EXECUTE ON FUNCTION public.anonymize_profile(uuid) FROM PUBLIC;
--   GRANT  EXECUTE ON FUNCTION public.anonymize_profile(uuid) TO service_role;
--
-- Das wirkt nicht. `REVOKE ... FROM PUBLIC` nimmt nur das Recht der
-- Pseudo-Rolle PUBLIC zurueck -- `anon` und `authenticated` sind eigene
-- Rollen, und Supabase vergibt ihnen ueber ALTER DEFAULT PRIVILEGES EXECUTE
-- auf alles, was im Schema `public` entsteht. Der nachfolgende GRANT liest
-- sich wie eine Einschraenkung, ist aber nur eine Ergaenzung.
--
-- Nachgemessen im laufenden Stack:
--
--   proacl = {postgres=X/postgres,anon=X/postgres,
--             authenticated=X/postgres,service_role=X/postgres}
--
-- Praktische Folge, beide belegt:
--
--   * Ein beliebiger Angemeldeter konnte `anonymize_profile` mit einer
--     fremden Profilkennung aufrufen. Die Funktion ist SECURITY DEFINER und
--     prueft selbst keinen Mandanten -- der Anzeigename eines Profils aus
--     einem ANDEREN Mandanten liess sich damit dauerhaft ersetzen und der
--     Protokollbezug loesen.
--   * Ein Melder -- die Rolle mit den wenigsten Rechten -- konnte
--     `purge_expired_data` ausloesen. Der Aufruf lieferte HTTP 200 mit
--     Ergebniszeilen fuer BEIDE Mandanten. Geloescht wurde nur deshalb
--     nichts, weil noch keine Aufbewahrungsfrist abgelaufen war.
--
-- `export_person_data` war nicht betroffen: Sie prueft den Mandanten selbst
-- und antwortet mit 42501. Genau diese Selbstpruefung fehlte den beiden
-- anderen -- und das ist der zweite Teil dieser Migration.
--
-- Warum die 90 pgTAP-Zusicherungen das nicht gefunden haben: Sie pruefen
-- RLS-Policies auf Tabellen. Keine einzige prueft ein Ausfuehrungsrecht auf
-- eine Funktion. `170_funktionsrechte.test.sql` schliesst diese Luecke.

-- ---------------------------------------------------------------------------
-- 1. Die beiden Funktionen, die die Anwendung braucht
-- ---------------------------------------------------------------------------
--
-- Beide Rollen werden namentlich genannt. Ein weiteres REVOKE FROM PUBLIC
-- waere wirkungslos -- das war der Fehler.
--
-- `anon` ist unangemeldet und hat in keiner dieser Funktionen etwas zu
-- suchen -- auch nicht in denen, die sich selbst pruefen.

REVOKE EXECUTE ON FUNCTION public.export_person_data(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, text[]) FROM anon;

-- Diese beiden ruft die Anwendung mit dem Nutzer-Client auf; sie bleiben
-- `authenticated` offen und pruefen selbst.
GRANT EXECUTE ON FUNCTION public.export_person_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, text[])
  TO authenticated;

-- Die Rechte fuer `anonymize_profile` und `purge_expired_data` stehen weiter
-- unten, NACH ihrer Neudefinition: `CREATE OR REPLACE FUNCTION` setzt die
-- Rechte einer Funktion zurueck, ein Entzug davor waere wirkungslos. Derselbe
-- Fallstrick in anderer Gestalt.

-- ---------------------------------------------------------------------------
-- 2. Die Funktionen pruefen zusaetzlich selbst
-- ---------------------------------------------------------------------------
--
-- Ein entzogenes Recht ist eine Zeile, die jemand versehentlich wieder
-- vergeben kann -- etwa ein spaeteres ALTER DEFAULT PRIVILEGES oder ein
-- `GRANT ALL ON ALL FUNCTIONS`. Deshalb steht die Regel zusaetzlich IN der
-- Funktion, wo sie nicht verlorengeht.
--
-- Aufrufe des `service_role` haben kein `auth.uid()`. Sie werden
-- durchgelassen, weil die aufrufende Server Action die Pruefung bereits
-- vorgenommen hat -- und weil der Service-Role-Schluessel ohnehin direkten
-- Schreibzugriff auf `profiles` hat: Dort etwas zu verbieten, was daneben
-- offensteht, waere Theater.

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
     SET display_name = 'Geloeschter Nutzer',
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

COMMENT ON FUNCTION public.anonymize_profile(uuid) IS
  'Loest den Personenbezug im Anwendungsschema. Prueft Rolle und Mandant '
  'selbst, sofern ein angemeldeter Nutzer aufruft. Die E-Mail-Adresse in '
  'auth.users ist gesondert zu loeschen -- dort liegt die eigentliche Angabe.';

-- `purge_expired_data` ist eine Betriebsaufgabe, kein Anwendungsvorgang. Sie
-- laeuft ueber ALLE Mandanten und gehoert damit ausschliesslich dem
-- Instanzbetreiber. Ein angemeldeter Nutzer hat hier nichts verloren -- auch
-- kein Administrator, denn sein Mandant ist nicht die Instanz.
--
-- Der Loeschteil ist unveraendert aus dem Basisschema uebernommen; neu sind
-- nur die fuenf Zeilen des Waechters am Anfang.
CREATE OR REPLACE FUNCTION public.purge_expired_data()
RETURNS TABLE (tenant_id uuid, tickets_geloescht bigint, protokoll_geloescht bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant record;
  v_tickets bigint;
  v_protokoll bigint;
BEGIN
  IF (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'Der Loeschlauf gehoert dem Instanzbetreiber'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  FOR v_tenant IN
    SELECT t.id, t.ticket_retention_days, t.audit_retention_days
    FROM public.tenants AS t
  LOOP
    -- Tickets, deren Frist ab dem Abschluss abgelaufen ist. Kommentare und
    -- Zeitbuchungen haengen per ON DELETE CASCADE daran und verschwinden mit.
    --
    -- Offene Tickets werden NIE geloescht: Die Frist beginnt mit closed_at,
    -- und ohne Abschluss gibt es keinen Fristbeginn. Das ist gewollt -- ein
    -- unerledigter Vorgang darf nicht wegen Zeitablaufs verschwinden.
    WITH geloescht AS (
      DELETE FROM public.tickets AS tk
      WHERE tk.tenant_id = v_tenant.id
        AND tk.closed_at IS NOT NULL
        AND tk.closed_at < now() - make_interval(days => v_tenant.ticket_retention_days)
      RETURNING 1
    )
    SELECT count(*) INTO v_tickets FROM geloescht;

    WITH geloescht AS (
      DELETE FROM public.audit_log AS al
      WHERE al.tenant_id = v_tenant.id
        AND al.occurred_at < now() - make_interval(days => v_tenant.audit_retention_days)
      RETURNING 1
    )
    SELECT count(*) INTO v_protokoll FROM geloescht;

    tenant_id := v_tenant.id;
    tickets_geloescht := v_tickets;
    protokoll_geloescht := v_protokoll;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_data() IS
  'Fristgesteuerter Loeschlauf ueber alle Mandanten. Fuehrt DELETE aus, kein '
  'Kennzeichen. Offene Vorgaenge bleiben. Nur fuer den Instanzbetreiber -- '
  'ein Aufruf mit angemeldetem Nutzer wird abgewiesen.';

-- CREATE OR REPLACE setzt die Rechte zurueck. Der Entzug muss deshalb NACH
-- der Neudefinition stehen, nicht davor.
REVOKE EXECUTE ON FUNCTION public.purge_expired_data()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_data() TO service_role;

REVOKE EXECUTE ON FUNCTION public.anonymize_profile(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_profile(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Kuenftige Funktionen erben das Problem nicht
-- ---------------------------------------------------------------------------
--
-- Ohne diese Zeile bekaeme die naechste Funktion im Schema `public` wieder
-- automatisch EXECUTE fuer `anon` und `authenticated` -- und der naechste
-- Leser der Migration wuerde denselben Trugschluss ziehen wie diese hier.
--
-- Ab jetzt wird jedes Recht ausdruecklich vergeben. Das ist unbequemer und
-- der einzige Zustand, in dem `GRANT` ueberhaupt etwas aussagt.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
