-- ===========================================================================
-- Kunden: die Ebene zwischen Mandant und Ticket
-- ===========================================================================
--
-- Das Wort „Mandant" trug in diesem Projekt zwei Bedeutungen, und gebaut
-- wurde nur eine davon. Diese Migration zieht die zweite nach und legt die
-- Begriffe fest:
--
--   MANDANT (public.tenants)   -- wer das Ticketsystem BETREIBT. Trennt auf
--                                 derselben Instanz Betriebe voneinander.
--   KUNDE   (public.customers) -- wer mit dem Ticketsystem VERWALTET wird.
--                                 Wessen Vorgaenge bearbeitet werden und wer
--                                 sie spaeter bezahlt.
--
-- Das Schema unterstellte bisher, ein Mandant fuehre Tickets fuer SICH
-- SELBST: Melder haengen am Mandanten, ein Ticket kennt nur created_by.
-- Tatsaechlich werden Tickets fuer Dritte gefuehrt. Ohne diese Ebene laesst
-- sich kein Vorgang zuordnen -- und damit spaeter keiner abrechnen.
--
-- ---------------------------------------------------------------------------
-- Was diese Migration ausdruecklich NICHT tut
-- ---------------------------------------------------------------------------
--
-- Der Kunde ist KEINE Sicherheitsgrenze. Ein Melder sieht weiterhin genau die
-- selbst gemeldeten Tickets -- nicht die seiner Kolleginnen und Kollegen beim
-- selben Kunden. Die einzige Trennachse im Schema bleibt der Mandant.
--
-- Das ist eine Entscheidung, keine Auslassung: Eine zweite Trennachse muesste
-- in jeder Policy, in jedem zusammengesetzten Fremdschluessel und in jedem
-- Test mitgefuehrt werden. Wenn ein Melder spaeter die Vorgaenge seines
-- Kunden sehen soll, ist das eine eigene Migration mit eigenen Tests -- und
-- nicht ein nachtraeglich aufgeweichtes USING.
--
-- Ebenfalls nicht hier: Kundenstammdaten. Ein Kunde hat einen Namen und ein
-- Aktiv-Kennzeichen. Keine Anschrift, keine Rufnummer, kein Freitext. Die
-- Begruendung aus docs/datenmodell.md gilt unveraendert -- ein Freitextfeld
-- fuer Kontaktdaten waere der schnellste Weg zu unkontrolliertem
-- Personenbezug.


-- =========================================================================
-- 1. Die Tabelle
-- =========================================================================

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,

  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),

  -- Deaktivieren statt Loeschen, wie bei tenants.is_active und
  -- profiles.deactivated_at. Ein Kunde mit Vorgaengen darf nicht
  -- verschwinden -- die Vorgaenge verloeren sonst ihre Zuordnung, und die
  -- Aufbewahrungsfrist liefe an einer Zeile ab, die niemand mehr einordnen
  -- kann.
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Zwei gleichnamige Kunden im selben Mandanten sind ein Bedienfehler, kein
  -- Zustand: In jeder Auswahlliste waeren sie nicht unterscheidbar.
  UNIQUE (tenant_id, name),

  -- Ziel fuer die zusammengesetzten Fremdschluessel aus profiles und tickets.
  -- Erzwingt auf Datenbankebene, dass ein Verweis auf einen Kunden immer
  -- denselben Mandanten meint wie der verweisende Datensatz -- dasselbe
  -- Muster wie profiles und tickets.
  UNIQUE (tenant_id, id)
);

COMMENT ON TABLE public.customers IS
  'Kunde eines Mandanten -- wer mit dem Ticketsystem VERWALTET wird, im '
  'Unterschied zum Mandanten, der es betreibt. Enthaelt bewusst keine '
  'Stammdaten: nur Name und Aktiv-Kennzeichen, kein Personenbezug. Keine '
  'Sicherheitsgrenze -- die Trennachse bleibt der Mandant.';
COMMENT ON COLUMN public.customers.is_active IS
  'False = kein neues Ticket mehr auf diesen Kunden. Bestehende Vorgaenge '
  'bleiben zugeordnet und lesbar.';

-- Erste Indexspalte ist ueberall tenant_id -- die Achse, nach der jede Policy
-- filtert. 100_rls_meta.test.sql erzwingt das strukturell.
CREATE INDEX customers_tenant_id_idx ON public.customers (tenant_id);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;


-- =========================================================================
-- 2. Kundenbezug am Profil
-- =========================================================================
--
-- Ein Melder gehoert zu genau einem Kunden. Bearbeiter und Verwaltung nicht:
-- Sie arbeiten quer ueber alle Kunden ihres Mandanten.

ALTER TABLE public.profiles ADD COLUMN customer_id uuid;

COMMENT ON COLUMN public.profiles.customer_id IS
  'Kunde, zu dem ein Melder gehoert. Bei Bearbeitern und der Verwaltung NULL '
  '-- sie haengen am Mandanten. Der CHECK erzwingt beide Richtungen.';

-- Zusammengesetzter Fremdschluessel statt eines einfachen Verweises auf
-- customers(id): Damit ist auf Datenbankebene ausgeschlossen, dass ein Profil
-- einem Kunden aus einem ANDEREN Mandanten zugeordnet wird -- unabhaengig
-- davon, was die Anwendung versucht. Dasselbe Muster wie
-- tickets(tenant_id, assignee_id).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tenant_id_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id)
  REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT;

CREATE INDEX profiles_tenant_customer_idx
  ON public.profiles (tenant_id, customer_id);


-- =========================================================================
-- 3. Zugriffshelfer: current_customer_id
-- =========================================================================
--
-- Vierter Helfer neben current_tenant_id(), current_app_role() und
-- is_tenant_admin(), mit derselben Fail-closed-Logik: deaktiviertes Profil
-- oder gesperrter Mandant liefern NULL.
--
-- Er wird an zwei Stellen gebraucht, und beide sind Zusicherungen, keine
-- Bequemlichkeit: Die Policy customers_select_eigener zeigt einem Melder
-- seinen Kunden, und profiles_update_eigenes friert den Wert ein, damit sich
-- niemand selbst auf einen anderen Kunden umhaengt.

CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.customer_id
  FROM public.profiles AS p
  JOIN public.tenants AS t ON t.id = p.tenant_id
  WHERE p.id = (SELECT auth.uid())
    AND p.deactivated_at IS NULL
    AND t.is_active
$$;

COMMENT ON FUNCTION public.current_customer_id() IS
  'Kunde des angemeldeten Melders, oder NULL. NULL auch fuer Bearbeiter und '
  'Verwaltung -- die haengen am Mandanten. Dieselbe Fail-closed-Logik wie '
  'current_tenant_id().';

-- Seit 20260805000000_funktionsrechte.sql entziehen die Default-Privilegien
-- jeder neuen Funktion das EXECUTE-Recht fuer anon und authenticated. Die
-- Vergabe muss deshalb ausdruecklich hier stehen -- und NACH der Definition,
-- weil CREATE OR REPLACE die Rechte zuruecksetzt.
REVOKE EXECUTE ON FUNCTION public.current_customer_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_customer_id()
  TO authenticated, service_role;


-- =========================================================================
-- 4. Policies: customers
-- =========================================================================
--
-- Namensschema <tabelle>_<verb>_<zielgruppe>, immer TO authenticated, ein
-- Statement je Verb und Zielgruppe.

-- Verwaltung und Bearbeitung sehen alle Kunden ihres Mandanten -- noetig fuer
-- die Auswahl am Ticket und fuer den Kundenfilter in der Liste.
CREATE POLICY customers_select_mandant ON public.customers
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Ein Melder sieht genau eine Zeile: seinen eigenen Kunden. Er braucht sie,
-- damit „Mein Profil" den Namen nennen kann statt einer Kennung. Eine Liste
-- der uebrigen Kunden seines Mandanten braucht er nicht, also bekommt er sie
-- nicht.
CREATE POLICY customers_select_eigener ON public.customers
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND id = (SELECT public.current_customer_id())
  );

-- Den Kundenstamm pflegt die Verwaltung. Ein Bearbeiter darf den Kunden eines
-- Tickets setzen und wechseln, aber keinen neuen anlegen -- sonst waechst der
-- Stamm bei jeder Tippvariante um einen Eintrag.
CREATE POLICY customers_insert_admin ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

-- Die WITH-CHECK-Klausel bindet die Zeile nach der Aenderung an denselben
-- Mandanten: Auch die Verwaltung kann einen Kunden nicht in einen fremden
-- Mandanten verschieben.
CREATE POLICY customers_update_admin ON public.customers
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

-- Kein DELETE, aus demselben Grund wie bei profiles: Ein Kunde mit Vorgaengen
-- wird stillgelegt (is_active = false), nicht geloescht. Der Fremdschluessel
-- ON DELETE RESTRICT ist der Rueckhalt fuer den Fall, dass jemand es ueber
-- den service_role-Schluessel dennoch versucht.


-- =========================================================================
-- 5. Kundenbezug am Ticket
-- =========================================================================
--
-- Dreischrittig -- Spalte, Nachtrag, NOT NULL -- damit die Migration auch
-- gegen eine Datenbank laeuft, in der bereits Tickets stehen.

ALTER TABLE public.tickets ADD COLUMN customer_id uuid;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_tenant_id_customer_id_fkey
  FOREIGN KEY (tenant_id, customer_id)
  REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT;

CREATE INDEX tickets_tenant_customer_idx
  ON public.tickets (tenant_id, customer_id);

-- ---------------------------------------------------------------------------
-- Nachtrag fuer bestehende Zeilen
-- ---------------------------------------------------------------------------
--
-- Jeder Mandant, der bereits Tickets oder Melder hat, bekommt einen Kunden
-- „Ohne Zuordnung". Der Name ist bewusst unbequem: Er soll in der Oberflaeche
-- auffallen und umgehaengt werden, nicht als stille Voreinstellung
-- weiterleben.
--
-- Ein Mandant ohne Tickets und ohne Melder bekommt nichts -- er faengt mit
-- einem leeren Kundenstamm an.

INSERT INTO public.customers (tenant_id, name)
SELECT DISTINCT tenant_id, 'Ohne Zuordnung'
FROM (
  SELECT t.tenant_id FROM public.tickets AS t
  UNION
  SELECT p.tenant_id FROM public.profiles AS p WHERE p.role = 'requester'
) AS betroffen
ON CONFLICT (tenant_id, name) DO NOTHING;

UPDATE public.tickets AS t
   SET customer_id = k.id
  FROM public.customers AS k
 WHERE k.tenant_id = t.tenant_id
   AND k.name = 'Ohne Zuordnung'
   AND t.customer_id IS NULL;

UPDATE public.profiles AS p
   SET customer_id = k.id
  FROM public.customers AS k
 WHERE k.tenant_id = p.tenant_id
   AND k.name = 'Ohne Zuordnung'
   AND p.role = 'requester'
   AND p.customer_id IS NULL;

-- Ab hier verbindlich.
ALTER TABLE public.tickets ALTER COLUMN customer_id SET NOT NULL;

COMMENT ON COLUMN public.tickets.customer_id IS
  'Kunde, fuer den der Vorgang gefuehrt wird. Pflicht -- ein Vorgang ohne '
  'Kunden liesse sich spaeter niemandem zuordnen. Beim Melder setzt ihn der '
  'Trigger aus dem Profil, nicht das Formular.';

-- Die Aussage im COMMENT der Tabelle stimmt so nicht mehr: Ein Kunde ist
-- jetzt zugeordnet. Was weiterhin gilt -- und der eigentliche Punkt der alten
-- Formulierung war -- sind die fehlenden KONTAKTdaten.
COMMENT ON TABLE public.tickets IS
  'Ticket. Traegt eine Zuordnung zu einem Kunden (customers), aber bewusst '
  'keine Kontaktdaten -- kein Name, keine Anschrift, keine Rufnummer. Wer '
  'meldet, steht in created_by.';

-- ---------------------------------------------------------------------------
-- Der CHECK am Profil, jetzt wo die Nachtraege stehen
-- ---------------------------------------------------------------------------
--
-- Uebersetzt „Melder gehoeren zu einem Kunden, Bearbeiter und Verwaltung
-- nicht" in eine Zusicherung. Er greift in beide Richtungen und zwingt damit
-- jeden Rollenwechsel, den Kunden mitzufuehren -- ein Melder, der zum
-- Bearbeiter wird, verliert ihn, und umgekehrt muss einer benannt werden.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_kunde_nur_beim_melder
  CHECK ((role = 'requester') = (customer_id IS NOT NULL));


-- =========================================================================
-- 6. Den Kunden am eigenen Profil einfrieren
-- =========================================================================
--
-- profiles_update_eigenes haelt bisher Mandant, Rolle und Aktivzustand fest.
-- Ohne customer_id in derselben WITH-CHECK-Klausel koennte sich ein Melder
-- per UPDATE auf einen anderen Kunden umhaengen -- und damit kuenftige
-- Vorgaenge auf fremde Rechnung buchen lassen. Derselbe Angriffsweg wie die
-- Selbstbefoerderung zum Administrator, nur eine Ebene tiefer.

DROP POLICY profiles_update_eigenes ON public.profiles;

CREATE POLICY profiles_update_eigenes ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.current_tenant_id())
    AND role = (SELECT public.current_app_role())
    AND customer_id IS NOT DISTINCT FROM (SELECT public.current_customer_id())
    AND deactivated_at IS NULL
  );


-- =========================================================================
-- 7. Den Kunden eines Meldertickets serverseitig setzen
-- =========================================================================
--
-- Ein Melder waehlt den Kunden seines Tickets NICHT aus -- er hat genau
-- einen, und der steht in seinem Profil. Die Datenbank setzt den Wert
-- deshalb selbst und ueberschreibt dabei, was mitgeliefert wurde.
--
-- Das gehoert hierher und nicht in die Server Action: Ein untergeschobenes
-- Formularfeld laeuft so ins Leere, statt auf die Sorgfalt der Anwendung zu
-- treffen. Fuer Bearbeitung und Verwaltung bleibt der Wert unangetastet --
-- sie waehlen aus, und der zusammengesetzte Fremdschluessel haelt die
-- Auswahl im eigenen Mandanten.

CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();

  -- service_role hat keinen Mandantenbezug und muss tenant_id selbst setzen --
  -- etwa beim Einspielen von Testdaten.
  IF v_tenant IS NULL AND NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id konnte nicht bestimmt werden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.tenant_id := COALESCE(v_tenant, NEW.tenant_id);

  IF NEW.created_by IS NULL THEN
    NEW.created_by := (SELECT auth.uid());
  END IF;

  -- Der Melder bestimmt den Kunden nicht -- sein Profil tut es. Die Bedingung
  -- greift nur bei angemeldeten Meldern; service_role liefert hier NULL und
  -- setzt den Wert selbst.
  IF public.current_app_role() = 'requester' THEN
    NEW.customer_id := public.current_customer_id();
  END IF;

  -- Naechste Nummer JE MANDANT. Die Sperre auf tenants serialisiert
  -- gleichzeitige Einfuegungen desselben Mandanten; ohne sie koennten zwei
  -- parallele Vorgaenge dieselbe Nummer berechnen und einer liefe in die
  -- UNIQUE-Bedingung. Andere Mandanten sind davon nicht betroffen.
  IF NEW.ticket_number IS NULL THEN
    PERFORM 1 FROM public.tenants WHERE id = NEW.tenant_id FOR UPDATE;
    SELECT COALESCE(MAX(t.ticket_number), 0) + 1
      INTO NEW.ticket_number
      FROM public.tickets AS t
     WHERE t.tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tickets_before_insert() IS
  'Setzt tenant_id, created_by, die mandantenweite Ticketnummer und -- beim '
  'Melder -- den Kunden serverseitig. Der Kunde ist hier eine Zusicherung: '
  'ein Melder kann ihn nicht mitliefern.';

-- CREATE OR REPLACE setzt die Rechte auf die Default-Privilegien zurueck, und
-- die entziehen anon und authenticated seit 20260805000000 das EXECUTE-Recht.
-- Fuer eine Triggerfunktion pruefen die meisten Pfade das Recht nicht -- aber
-- „meistens" ist keine Grundlage fuer eine Funktion, an der jedes Anlegen
-- eines Tickets haengt.
GRANT EXECUTE ON FUNCTION public.tickets_before_insert()
  TO authenticated, service_role;


-- =========================================================================
-- 8. Auskunft nach Art. 15 nachziehen
-- =========================================================================
--
-- Der Kunde ist eine Angabe UEBER die Person: zu welchem Auftraggeber sie
-- gehoert. Er gehoert damit in die Auskunft, und zwar mit Namen -- eine
-- Kennung beantwortet die Frage nicht, die ein Betroffener stellt.
--
-- Die Zahl der Bereiche bleibt sechs: customers selbst enthaelt keinen
-- Personenbezug und bekommt keinen eigenen Abschnitt.

CREATE OR REPLACE FUNCTION public.export_person_data(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
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

  v_tenant := public.current_tenant_id();

  -- Berechtigt ist, wer die eigenen Daten anfordert, oder der Administrator
  -- desselben Mandanten. Die Pruefung steht hier in der Funktion, weil
  -- SECURITY DEFINER die Policies umgeht -- ohne sie waere das ein Weg, fremde
  -- Daten zu lesen.
  --
  -- service_role ruft mit v_tenant IS NULL auf und ist damit ausgenommen; dort
  -- traegt die aufrufende Server Action die Autorisierung.
  IF v_tenant IS NOT NULL THEN
    IF v_ziel_tenant <> v_tenant THEN
      RAISE EXCEPTION 'Kein Zugriff auf Daten eines anderen Mandanten'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF p_profile_id <> (SELECT auth.uid()) AND NOT public.is_tenant_admin() THEN
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
  'die Berechtigung selbst, weil SECURITY DEFINER die Policies umgeht. Eine '
  'neue Tabelle mit Personenbezug gehoert hier ergaenzt.';

REVOKE EXECUTE ON FUNCTION public.export_person_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_person_data(uuid)
  TO authenticated, service_role;
