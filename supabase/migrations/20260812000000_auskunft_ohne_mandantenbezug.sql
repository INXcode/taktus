-- ===========================================================================
-- Auskunft: Berechtigungspruefung nicht mehr am Mandantenbezug aufhaengen
-- ===========================================================================
--
-- Gefunden bei einer Sicherheitsdurchsicht des Bestands.
--
-- export_person_data() laeuft als SECURITY DEFINER und umgeht damit saemtliche
-- Policies. Die Berechtigung prueft die Funktion deshalb selbst -- bisher aber
-- vollstaendig innerhalb von
--
--   IF v_tenant IS NOT NULL THEN ... END IF;
--
-- wobei v_tenant := public.current_tenant_id(). Gemeint war damit die Ausnahme
-- fuer service_role: Der Instanzbetreiber hat kein auth.uid(), bekommt also
-- NULL, und die aufrufende Server Action traegt dort die Autorisierung.
--
-- current_tenant_id() liefert aber fuer DREI Aufrufergruppen NULL, nicht fuer
-- eine. Die Definition (20260804000000_initial_schema.sql) verlangt eine Zeile
-- in profiles JOIN tenants mit `p.deactivated_at IS NULL AND t.is_active`.
-- Damit ist das Ergebnis auch NULL fuer
--
--   1. ein deaktiviertes Profil            (profiles.deactivated_at gesetzt)
--   2. einen gesperrten Mandanten          (tenants.is_active = false)
--
-- und beide sind gewoehnliche `authenticated`-Aufrufer mit gueltigem Token.
-- Fuer sie entfielen der Mandantenvergleich UND die Pruefung auf eigene Daten
-- beziehungsweise Administratorrolle.
--
-- Die Wirkung war damit genau invertiert: Die zwei Zustaende, die
-- "kein Zugriff" bedeuten -- der Entzug nach 20260804000000_initial_schema.sql
-- ("Gesetzt = sofortiger Zugriffsentzug") und die Einschraenkung der
-- Verarbeitung nach Art. 18 -- waren die zwei Zustaende, die die Pruefung
-- abschalteten. Der Rest des Schemas faellt auf demselben NULL korrekt zu:
-- jede Policy vergleicht tenant_id = (SELECT current_tenant_id()).
--
-- Erreichbar war das ohne die Oberflaeche: Eine Deaktivierung setzt nur
-- profiles.deactivated_at (src/actions/members.ts), die Zeile in auth.users
-- bleibt unberuehrt. Ein ausgeschiedener Nutzer konnte sich also weiterhin ein
-- Token holen und POST /rest/v1/rpc/export_person_data direkt aufrufen -- mit
-- den Profilkennungen, die er im aktiven Zustand rechtmaessig gesehen hat.
--
-- Die Korrektur unterscheidet auf auth.uid() statt auf den Mandantenbezug.
-- Das ist dasselbe Muster, das anonymize_profile() in
-- 20260805000000_funktionsrechte.sql bereits verwendet -- und der Grund, warum
-- jene Funktion den Fehler nicht hatte. Ein angemeldeter Aufrufer ohne
-- Mandantenbezug wird jetzt ausdruecklich abgewiesen, statt durchgelassen.
--
-- Der Rumpf ist unveraendert; CREATE OR REPLACE verlangt die vollstaendige
-- Definition.

CREATE OR REPLACE FUNCTION public.export_person_data(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_aufrufer uuid;
  v_tenant uuid;
  v_ziel_tenant uuid;
  v_ergebnis jsonb;
BEGIN
  SELECT p.tenant_id INTO v_ziel_tenant
    FROM public.profiles AS p WHERE p.id = p_profile_id;

  IF v_ziel_tenant IS NULL THEN
    RAISE EXCEPTION 'Profil % nicht gefunden', p_profile_id
      USING ERRCODE = 'no_data_found';
  END IF;

  v_aufrufer := (SELECT auth.uid());
  v_tenant := public.current_tenant_id();

  -- Berechtigt ist, wer die eigenen Daten anfordert, oder der Administrator
  -- desselben Mandanten. Die Pruefung steht hier in der Funktion, weil
  -- SECURITY DEFINER die Policies umgeht -- ohne sie waere das ein Weg, fremde
  -- Daten zu lesen.
  --
  -- Ausgenommen ist ausschliesslich der Aufruf ohne angemeldeten Nutzer, also
  -- service_role; dort traegt die aufrufende Server Action die Autorisierung.
  -- Die Unterscheidung laeuft ueber auth.uid() und NICHT ueber
  -- current_tenant_id(): Letzteres ist auch fuer ein deaktiviertes Profil und
  -- fuer einen gesperrten Mandanten NULL, und das sind angemeldete Nutzer, die
  -- gerade KEINEN Zugriff haben sollen.
  IF v_aufrufer IS NOT NULL THEN
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'Kein Mandantenbezug: Zugriff entzogen oder Mandant gesperrt'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_ziel_tenant <> v_tenant THEN
      RAISE EXCEPTION 'Kein Zugriff auf Daten eines anderen Mandanten'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_profile_id <> v_aufrufer AND NOT public.is_tenant_admin() THEN
      RAISE EXCEPTION 'Nur eigene Daten oder Administrator'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'erstellt_am', now(),
    'hinweis',
      'Die E-Mail-Adresse liegt in auth.users und ist gesondert beizufuegen. '
      || 'Sie wird im Anwendungsschema bewusst nicht gespeichert.',

    'profil', (
      SELECT to_jsonb(x) FROM (
        SELECT p.id, p.tenant_id, p.role, p.display_name,
               p.customer_id,
               (SELECT k.name FROM public.customers AS k
                 WHERE k.id = p.customer_id) AS customer_name,
               p.deactivated_at, p.created_at, p.updated_at
        FROM public.profiles AS p WHERE p.id = p_profile_id
      ) AS x
    ),

    'tickets_gemeldet', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
      FROM (
        SELECT t.id, t.ticket_number, t.title, t.description, t.status,
               t.category, t.created_at, t.closed_at
        FROM public.tickets AS t WHERE t.created_by = p_profile_id
      ) AS x
    ), '[]'::jsonb),

    'tickets_zugewiesen', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
      FROM (
        SELECT t.id, t.ticket_number, t.title, t.status, t.created_at
        FROM public.tickets AS t WHERE t.assignee_id = p_profile_id
      ) AS x
    ), '[]'::jsonb),

    'kommentare', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at)
      FROM (
        SELECT c.id, c.ticket_id, c.body, c.created_at, c.updated_at
        FROM public.ticket_comments AS c WHERE c.author_id = p_profile_id
      ) AS x
    ), '[]'::jsonb),

    'zeitbuchungen', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.worked_on)
      FROM (
        SELECT z.id, z.ticket_id, z.minutes, z.worked_on, z.note, z.created_at
        FROM public.time_entries AS z WHERE z.user_id = p_profile_id
      ) AS x
    ), '[]'::jsonb),

    'protokolleintraege', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.occurred_at)
      FROM (
        SELECT a.action, a.entity_type, a.entity_id, a.changed_fields,
               a.occurred_at
        FROM public.audit_log AS a WHERE a.actor_id = p_profile_id
      ) AS x
    ), '[]'::jsonb)
  ) INTO v_ergebnis;

  RETURN v_ergebnis;
END;
$$;

COMMENT ON FUNCTION public.export_person_data(uuid) IS
  'Maschineller Export aller Daten einer Person (DSGVO Art. 15 und 20). Prueft '
  'die Berechtigung selbst, weil SECURITY DEFINER die Policies umgeht. '
  'Ausgenommen ist nur der Aufruf ohne auth.uid() (service_role) -- NICHT der '
  'Aufruf ohne Mandantenbezug. Eine neue Tabelle mit Personenbezug gehoert '
  'hier ergaenzt.';

-- CREATE OR REPLACE erhaelt die Rechte zwar, aber die Kette steht in jeder
-- Migration ausgeschrieben da, wo die Funktion angefasst wird -- sonst haengt
-- die Zugriffslage an einer Eigenschaft, die man nachschlagen muss.
REVOKE EXECUTE ON FUNCTION public.export_person_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_person_data(uuid)
  TO authenticated, service_role;
