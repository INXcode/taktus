-- Basisschema Taktus Kontor.
--
-- Diese Datei legt das vollstaendige Schema an: Aufzaehlungstypen, Tabellen,
-- Zugriffshelfer, Row-Level-Security-Policies, Trigger und die Funktionen fuer
-- Aufbewahrung, Anonymisierung und Auskunft.
--
-- Aufbau in der Reihenfolge der Abhaengigkeiten:
--
--   1. Aufzaehlungstypen und Basisfunktionen
--   2. Mandanten
--   3. Profile
--   4. Zugriffshelfer sowie die Policies fuer tenants und profiles
--   5. Tickets
--   6. Kommentare
--   7. Zeitbuchungen
--   8. Protokoll
--   9. KI-Konfiguration
--  10. Aufbewahrung, Anonymisierung und Auskunft
--
-- Aenderungen am Schema kommen ab hier als eigene Migration hinzu; diese Datei
-- wird nicht mehr angefasst. Wer sie doch aendert, aendert den Ausgangszustand
-- unter bereits angewendeten Migrationen weg.


-- =========================================================================
-- 1. Aufzaehlungstypen und Basisfunktionen
-- =========================================================================

-- Aufzählungstypen und projektweite Hilfsfunktionen.
--
-- Aufzählungstypen statt Textspalten mit CHECK-Bedingung, weil die zulässigen
-- Werte damit auch im generierten TypeScript-Typ ankommen. Ein Tippfehler in
-- einem Statuswert fällt dann beim Übersetzen auf, nicht im Betrieb.

-- ---------------------------------------------------------------------------
-- Rollen
-- ---------------------------------------------------------------------------
--
-- Drei Rollen, nicht zwei. Erst durch `requester` entsteht eine Zugriffsmatrix,
-- die auch INNERHALB eines Mandanten unterscheidet -- und damit etwas, das die
-- pgTAP-Tests belegen können. Mit nur `admin` und `agent` wäre die einzige
-- geprüfte Grenze die zwischen Mandanten.
--
-- Bewusst KEINE mandantenübergreifende Rolle. Jede solche Rolle wäre eine
-- Umgehung der Mandantentrennung, die dann in Policies gesondert behandelt
-- werden müsste -- also genau die Ausnahme, an der eine Trennung erfahrungs-
-- gemäß bricht. Der Instanzbetreiber arbeitet über `service_role`, außerhalb
-- des Rollenmodells der Anwendung.
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'requester');

COMMENT ON TYPE public.app_role IS
  'Rolle innerhalb eines Mandanten. admin: Verwaltung des Mandanten. '
  'agent: Bearbeitung von Tickets und eigene Zeitbuchungen. '
  'requester: meldet Tickets, sieht ausschliesslich die eigenen, keine Zeiten.';

-- ---------------------------------------------------------------------------
-- Ticketstatus
-- ---------------------------------------------------------------------------
--
-- `closed` ist der einzige Status, der die Aufbewahrungsfrist startet -- siehe
-- tickets.closed_at.
CREATE TYPE public.ticket_status AS ENUM (
  'open',
  'in_progress',
  'waiting',
  'closed'
);

-- ---------------------------------------------------------------------------
-- Ticketkategorie
-- ---------------------------------------------------------------------------
--
-- Zugleich der Wertebereich, den die KI vorschlagen darf. Dass die Kategorie
-- ein Aufzählungstyp ist, ist die eigentliche Absicherung gegen Prompt
-- Injection: Was das Modell auch immer zurückgibt -- die Datenbank nimmt
-- ausschliesslich einen dieser fünf Werte an. Siehe docs/security.md, Kapitel G.
CREATE TYPE public.ticket_category AS ENUM (
  'stoerung',
  'anfrage',
  'wartung',
  'abrechnung',
  'sonstiges'
);

-- ---------------------------------------------------------------------------
-- KI-Anbieter
-- ---------------------------------------------------------------------------
--
-- `openai_compatible` deckt selbst betriebene Modelle ab. Der Anbieter ist
-- konfigurierbar und nicht fest verdrahtet, damit ein Betreiber die
-- Übermittlung an einen Dritten vollständig vermeiden kann -- die
-- Souveränitätsanforderung aus docs/architektur.md.
CREATE TYPE public.ai_provider AS ENUM (
  'openai',
  'anthropic',
  'openai_compatible'
);

-- ---------------------------------------------------------------------------
-- Zeitstempel fortschreiben
-- ---------------------------------------------------------------------------
--
-- `SET search_path = ''` und vollqualifizierte Namen: Ohne das könnte ein
-- Aufrufer mit eigenem Schema im Suchpfad steuern, welche Funktion tatsächlich
-- läuft. Bei SECURITY DEFINER wäre das eine Rechteausweitung; hier ist es
-- Gewohnheit, damit die Schreibweise im ganzen Projekt einheitlich bleibt.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'BEFORE-UPDATE-Trigger. Setzt updated_at serverseitig, damit der Wert nicht '
  'von der Anwendung mitgeliefert -- und damit auch nicht gefaelscht -- wird.';


-- =========================================================================
-- 2. Mandanten
-- =========================================================================

-- Mandanten.
--
-- Eine Instanz, mehrere Mandanten. Die Trennung wird über Row Level Security in
-- Postgres erzwungen, nicht in der Anwendungsschicht -- siehe
-- docs/architektur.md.
--
-- Datenminimierung: Kein `slug`, keine Anschrift, keine Umsatzsteuer-ID. Das
-- wäre erst mit einer Rechnungsstellung begründbar, und die ist ausdrücklich
-- nicht Teil von Release 1. Felder „für später" gibt es in diesem Projekt
-- nicht.

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Anzeigename. Der einzige Pflichtwert.
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),

  -- Sperrung ohne Löschung. Deckt die Einschränkung der Verarbeitung nach
  -- Art. 18 DSGVO ab: Die Daten bleiben, der Zugriff endet.
  is_active boolean NOT NULL DEFAULT true,

  -- KI je Mandant, standardmässig AUS.
  --
  -- Die Voreinstellung ist die eigentliche Entscheidung: Eine KI-Auswertung ist
  -- eine Übermittlung an einen Dritten. Sie darf nicht dadurch entstehen, dass
  -- niemand widersprochen hat. Der Schlüssel gehört dem Betreiber
  -- (public.ai_config), die Freigabe dem Mandanten -- diese Trennung ist
  -- beabsichtigt.
  ai_enabled boolean NOT NULL DEFAULT false,

  -- Aufbewahrungsfristen in Tagen.
  --
  -- Sie stehen hier und nicht als Konstante im Code, weil die angemessene Frist
  -- vom Mandanten abhängt und ein Betreiber sie belegen können muss. Ohne diese
  -- Felder liesse sich das Löschkonzept nicht umsetzen, sondern nur behaupten.
  -- Frist für Tickets läuft ab closed_at, nicht ab Anlage.
  ticket_retention_days integer NOT NULL DEFAULT 730
    CHECK (ticket_retention_days BETWEEN 30 AND 3650),
  audit_retention_days integer NOT NULL DEFAULT 365
    CHECK (audit_retention_days BETWEEN 30 AND 3650),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenants IS
  'Mandant. Eine Instanz traegt mehrere; die Trennung erzwingt RLS.';
COMMENT ON COLUMN public.tenants.ai_enabled IS
  'Opt-in je Mandant, Vorgabe false. KI-Nutzung ist eine Uebermittlung an '
  'einen Dritten und darf nicht durch Untaetigkeit entstehen.';
COMMENT ON COLUMN public.tenants.ticket_retention_days IS
  'Aufbewahrung ab tickets.closed_at. Grundlage von purge_expired_data().';

CREATE TRIGGER tenants_set_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS wird hier aktiviert, die Policies folgen erst in Abschnitt 4 -- sie
-- brauchen die Hilfsfunktionen, und die brauchen public.profiles.
--
-- Zwischen dieser Stelle und jener ist die Tabelle damit für `authenticated`
-- vollständig gesperrt: RLS aktiv, keine Policy, also kein Zugriff. Das ist die
-- sichere Richtung.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;


-- =========================================================================
-- 3. Profile
-- =========================================================================

-- Nutzerprofile.
--
-- Verbindet einen Anmeldedatensatz aus auth.users mit genau einem Mandanten und
-- einer Rolle. Diese Tabelle ist die Wurzel der gesamten Zugriffskontrolle:
-- public.current_tenant_id() liest sie, und jede Policy im Projekt hängt an
-- deren Ergebnis.

CREATE TABLE public.profiles (
  -- Gleiche Kennung wie in auth.users. Kein eigener Schlüssel, damit es
  -- keinen Zustand geben kann, in dem beide auseinanderlaufen.
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,

  role public.app_role NOT NULL DEFAULT 'requester',

  -- Anzeigename in Tickets, Kommentaren und Zeitauswertungen.
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),

  -- Sofortiger Zugriffsentzug ohne Datenverlust.
  --
  -- public.current_tenant_id() liefert für ein deaktiviertes Profil NULL, und
  -- weil jede Policy `tenant_id = (SELECT public.current_tenant_id())` prüft,
  -- endet damit sämtlicher Zugriff -- in derselben Sekunde, nicht erst mit dem
  -- nächsten Token. Genau das war das Argument gegen einen JWT-Claim.
  deactivated_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Ziel für zusammengesetzte Fremdschlüssel aus abhängigen Tabellen. Erzwingt
  -- auf Datenbankebene, dass ein Verweis auf ein Profil immer denselben
  -- Mandanten meint wie der verweisende Datensatz.
  UNIQUE (tenant_id, id)
);

-- ---------------------------------------------------------------------------
-- Was hier bewusst FEHLT
-- ---------------------------------------------------------------------------
--
-- Keine `email`-Spalte.
--
-- Die Adresse liegt bereits in auth.users. Eine Kopie im Anwendungsschema wäre
-- eine zweite Speicherung personenbezogener Daten ohne eigenen Zweck -- und
-- zugleich ein zweiter Ort, der beim Löschen und bei der Auskunft bedacht
-- werden muss. Genau die Art von Feld, die entsteht, weil sie „praktisch" ist.
--
-- Der Preis: Wer die Adresse anzeigen will, liest sie serverseitig über die
-- Admin-Schnittstelle, statt sie mit einem Join mitzunehmen. Das ist
-- umständlicher und beabsichtigt.
--
-- Ebenfalls nicht vorhanden: Telefonnummer, Abteilung, Personalnummer, Avatar.
-- Für Tickets und Zeitbuchungen wird nichts davon gebraucht.

COMMENT ON TABLE public.profiles IS
  'Nutzerprofil je Mandant. Wurzel der Zugriffskontrolle -- current_tenant_id() '
  'liest diese Tabelle. Enthaelt bewusst KEINE E-Mail-Adresse: die liegt in '
  'auth.users, eine Kopie waere Speicherung ohne eigenen Zweck.';
COMMENT ON COLUMN public.profiles.deactivated_at IS
  'Gesetzt = sofortiger Zugriffsentzug. current_tenant_id() liefert dann NULL, '
  'womit jede Policy fehlschlaegt -- ohne auf einen Token-Refresh zu warten.';

CREATE INDEX profiles_tenant_id_idx ON public.profiles (tenant_id);
CREATE INDEX profiles_tenant_role_idx ON public.profiles (tenant_id, role);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;


-- =========================================================================
-- 4. Zugriffshelfer sowie die Policies fuer tenants und profiles
-- =========================================================================

-- Zugriffshelfer und die Policies für tenants und profiles.
--
-- ===========================================================================
-- Drei Entwurfsentscheidungen, die den Rest des Schemas bestimmen
-- ===========================================================================
--
-- 1. MANDANTENBEZUG ÜBER EINE FUNKTION, NICHT ÜBER EINEN JWT-CLAIM
--
--    Ein Custom Claim im Zugriffstoken wäre schneller -- er kostet keine
--    Abfrage. Er wirkt aber erst nach dem nächsten Token-Refresh. Ein
--    deaktivierter Nutzer dürfte damit bis zu einer Stunde weiterlesen. Das
--    ist gegenüber einem prüfenden Interessenten nicht erklärbar, und
--    Zugriffsentzug ist genau der Fall, auf den es ankommt.
--
--    Der übliche Einwand gegen den Subselect ist ein Formulierungsproblem,
--    kein Architekturproblem -- siehe Punkt 2.
--
--    Die Funktion ist zugleich der Migrationspfad: Wird die Instanz später
--    gross, ändert man DIESE EINE Funktion auf
--      COALESCE(auth.jwt() -> 'app_metadata' ->> 'tenant_id', <Subselect>)
--    und keine einzige Policy muss angefasst werden.
--
-- 2. AUFRUFE IMMER IN (SELECT ...) EINSCHLIESSEN
--
--    `WHERE tenant_id = public.current_tenant_id()` wertet Postgres PRO ZEILE
--    aus. `WHERE tenant_id = (SELECT public.current_tenant_id())` erzeugt einen
--    InitPlan -- einmal je Abfrage. Bei zehntausend Zeilen ist das der
--    Unterschied zwischen einer und zehntausend Funktionsauswertungen.
--
--    Deshalb prüft eine Semgrep-Regel Migrationen auf `auth.uid()` ohne
--    umschliessendes SELECT.
--
-- 3. WARUM SECURITY DEFINER HIER KEINE REKURSION AUSLÖST
--
--    Eine Policy auf public.profiles, die public.profiles abfragt, wäre eine
--    Endlosschleife. Die Funktionen unten lesen profiles trotzdem.
--
--    Der Grund: Sie laufen als SECURITY DEFINER mit dem Eigentümer `postgres`,
--    und dieser Rolle ist BYPASSRLS zugeordnet. BYPASSRLS schlägt auch
--    FORCE ROW LEVEL SECURITY -- die Funktion sieht die Tabelle also ungefiltert
--    und ohne die Policies erneut auszuwerten.
--
--    Das ist eine Eigenschaft der Rolle, keine des SQL-Standards. Sie wird
--    deshalb in supabase/tests/010_zugriffshelfer.test.sql geprüft: Ändert sich
--    das Rollenmodell einer künftigen Supabase-Version, fällt es dort auf und
--    nicht im Betrieb.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- current_tenant_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.tenant_id
  FROM public.profiles AS p
  JOIN public.tenants AS t ON t.id = p.tenant_id
  WHERE p.id = (SELECT auth.uid())
    AND p.deactivated_at IS NULL
    AND t.is_active
$$;

COMMENT ON FUNCTION public.current_tenant_id() IS
  'Mandant des angemeldeten Nutzers, oder NULL. NULL fuehrt in jeder Policy zu '
  'einem fehlschlagenden Vergleich -- die Funktion faellt also geschlossen aus. '
  'Liefert auch dann NULL, wenn das Profil deaktiviert oder der Mandant '
  'gesperrt ist.';

-- ---------------------------------------------------------------------------
-- current_app_role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  JOIN public.tenants AS t ON t.id = p.tenant_id
  WHERE p.id = (SELECT auth.uid())
    AND p.deactivated_at IS NULL
    AND t.is_active
$$;

COMMENT ON FUNCTION public.current_app_role() IS
  'Rolle des angemeldeten Nutzers, oder NULL. Dieselbe Fail-closed-Logik wie '
  'current_tenant_id().';

-- ---------------------------------------------------------------------------
-- is_tenant_admin
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- COALESCE, damit NULL zu false wird: In einer USING-Klausel wuerde NULL
  -- zwar ebenfalls nicht zutreffen, aber ein ausdrueckliches false ist besser
  -- lesbar und in zusammengesetzten Ausdruecken eindeutig.
  SELECT COALESCE(public.current_app_role() = 'admin', false)
$$;

COMMENT ON FUNCTION public.is_tenant_admin() IS
  'True, wenn der angemeldete Nutzer Administrator SEINES Mandanten ist. Es '
  'gibt bewusst keine mandantenuebergreifende Administratorrolle.';

-- Ausfuehrungsrechte ausdruecklich setzen. Ohne REVOKE stuende die Funktion
-- auch `anon` offen -- fuer sich genommen harmlos, weil auth.uid() dort NULL
-- ist, aber die Rechtevergabe soll ablesbar sein und nicht auf einer Vorgabe
-- beruhen.
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_tenant_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated, service_role;

-- ===========================================================================
-- Policies: tenants
-- ===========================================================================
--
-- Namensschema: <tabelle>_<verb>_<zielgruppe>. Immer TO authenticated, nie
-- TO public. Ein Statement je Verb und Zielgruppe statt einer Sammel-Policy mit
-- ODER-Kette -- so lässt sich jede Zeile einzeln lesen und einzeln testen.

-- Jeder Angemeldete sieht seinen eigenen Mandanten. Braucht die Oberflaeche,
-- um Name und KI-Freigabe anzuzeigen.
CREATE POLICY tenants_select_eigener ON public.tenants
  FOR SELECT TO authenticated
  USING (id = (SELECT public.current_tenant_id()));

-- Aendern darf nur der Administrator des eigenen Mandanten -- und auch der
-- nicht den Mandanten wechseln: die WITH-CHECK-Klausel bindet die Zeile nach
-- der Aenderung an denselben Mandanten.
CREATE POLICY tenants_update_admin ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  )
  WITH CHECK (
    id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

-- Kein INSERT, kein DELETE: Mandanten legt der Instanzbetreiber an, nicht die
-- Anwendung. Es gibt in der Anwendung keinen Weg, einen Mandanten zu erzeugen
-- -- und damit auch keinen, versehentlich einen zweiten anzulegen.

-- ===========================================================================
-- Policies: profiles
-- ===========================================================================

-- Administrator und Bearbeiter sehen alle Profile ihres Mandanten -- noetig
-- fuer Zuweisung von Tickets und Zeitauswertung.
CREATE POLICY profiles_select_mandant ON public.profiles
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Ein Melder sieht ausschliesslich sich selbst. Er braucht keine Liste der
-- Kolleginnen und Kollegen, also bekommt er sie nicht.
CREATE POLICY profiles_select_eigenes ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- Jeder pflegt seinen eigenen Anzeigenamen.
--
-- Die WITH-CHECK-Klausel haelt Mandant und Rolle fest: Ohne sie koennte sich
-- jeder Nutzer per UPDATE selbst zum Administrator machen. Das ist der
-- klassische Weg der Rechteausweitung (docs/security.md, Kapitel A) -- die
-- Zeile bleibt sichtbar, aber die Rolle ist Teil der Bedingung.
CREATE POLICY profiles_update_eigenes ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND tenant_id = (SELECT public.current_tenant_id())
    AND role = (SELECT public.current_app_role())
    AND deactivated_at IS NULL
  );

-- Der Administrator verwaltet die Profile seines Mandanten.
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

-- Kein DELETE.
--
-- Ein Profil wird nicht geloescht, sondern ueber deactivated_at stillgelegt --
-- sonst verloeren Tickets und Zeitbuchungen ihren Urheber. Die tatsaechliche
-- Loeschung personenbezogener Daten laeuft ueber
-- public.anonymize_profile() plus Loeschung in auth.users, wo die eigentliche
-- personenbezogene Angabe liegt. Siehe docs/loeschkonzept.md.


-- =========================================================================
-- 5. Tickets
-- =========================================================================

-- Tickets.

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,

  -- Fortlaufende Nummer JE MANDANT, für Menschen.
  --
  -- Nicht global fortlaufend: Eine instanzweite Nummer würde verraten, wie
  -- viele Tickets die übrigen Mandanten anlegen. Das ist kein Geheimnis von
  -- Gewicht, aber es ist auch kein Grund, es preiszugeben.
  ticket_number integer NOT NULL,

  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 20000),

  status public.ticket_status NOT NULL DEFAULT 'open',
  category public.ticket_category NOT NULL DEFAULT 'sonstiges',

  -- Zusammengesetzte Fremdschlüssel statt einfacher Verweise auf profiles(id).
  -- Damit ist auf Datenbankebene ausgeschlossen, dass ein Ticket einem Profil
  -- aus einem anderen Mandanten zugewiesen wird -- unabhängig davon, was die
  -- Anwendung versucht.
  assignee_id uuid,
  created_by uuid NOT NULL,
  FOREIGN KEY (tenant_id, assignee_id) REFERENCES public.profiles (tenant_id, id)
    ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, created_by) REFERENCES public.profiles (tenant_id, id)
    ON DELETE RESTRICT,

  -- --- KI-Stufe 1 ---------------------------------------------------------
  --
  -- Die Zusammenfassung ist ein VORSCHLAG, kein Befund. Sie wird in der
  -- Oberfläche als solcher gekennzeichnet und nie automatisch übernommen
  -- (docs/security.md, Kapitel G).
  ai_summary text CHECK (ai_summary IS NULL OR length(ai_summary) <= 2000),

  -- Herkunftsnachweis: welches Modell wann. Ohne diese beiden Felder liesse
  -- sich später nicht mehr sagen, worauf ein Vorschlag beruhte -- und die
  -- Rechenschaftspflicht aus Art. 5 Abs. 2 DSGVO wäre nicht erfüllbar.
  ai_model text CHECK (ai_model IS NULL OR length(ai_model) <= 120),
  ai_generated_at timestamptz,

  -- Welche Felder das Modell zuletzt verändert hat. Die Oberfläche hebt sie
  -- hervor; sobald ein Mensch den Abschnitt speichert, gilt das Feld als
  -- geprüft und wird aus der Liste entfernt.
  ai_marked_fields text[] NOT NULL DEFAULT '{}',

  -- --- Aufbewahrung -------------------------------------------------------
  --
  -- Startpunkt der Löschfrist. Ohne dieses Feld wäre das Löschkonzept nicht
  -- umsetzbar: Ab Anlage zu rechnen wäre falsch, weil ein Ticket jahrelang
  -- offen sein kann.
  closed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, ticket_number),
  -- Ziel fuer zusammengesetzte Fremdschluessel aus Kommentaren und Zeiten.
  UNIQUE (tenant_id, id),

  -- Status und Abschlusszeitpunkt duerfen nicht auseinanderlaufen. Sonst
  -- entstuende ein Ticket, das geschlossen ist, dessen Frist aber nie beginnt
  -- -- eine stille Aufbewahrung ohne Ende.
  CONSTRAINT tickets_closed_at_passend_zum_status
    CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- Was hier bewusst FEHLT
-- ---------------------------------------------------------------------------
--
-- Keine `priority`: Die Kategorie genügt in Release 1. Eine zweite
-- Einordnungsachse ohne Auswertung, die sie nutzt, wäre ein Feld „für später".
--
-- Kein `due_date`: Setzt eine Fristenverwaltung voraus, die es nicht gibt.
--
-- Keine Kundenstammdaten -- kein Name, keine Anschrift, keine Rufnummer des
-- Meldenden. Release 1 ist ein INTERNES Ticketsystem; wer meldet, steht in
-- created_by. Ein Freitextfeld für Kontaktdaten wäre der schnellste Weg zu
-- unkontrolliertem Personenbezug.

COMMENT ON TABLE public.tickets IS
  'Ticket. Enthaelt bewusst keine Kundenstammdaten -- Release 1 ist ein '
  'internes System, der Melder steht in created_by.';
COMMENT ON COLUMN public.tickets.closed_at IS
  'Startpunkt der Aufbewahrungsfrist (tenants.ticket_retention_days). Per '
  'CHECK an status = closed gekoppelt.';
COMMENT ON COLUMN public.tickets.ai_marked_fields IS
  'Felder, die zuletzt vom Modell veraendert wurden. Die Oberflaeche '
  'kennzeichnet sie; Speichern durch einen Menschen entfernt den Eintrag.';

-- Erste Indexspalte ist ueberall tenant_id -- die Achse, nach der jede Policy
-- und praktisch jede Abfrage filtert.
CREATE INDEX tickets_tenant_status_idx ON public.tickets (tenant_id, status);
CREATE INDEX tickets_tenant_assignee_idx ON public.tickets (tenant_id, assignee_id);
CREATE INDEX tickets_tenant_created_by_idx ON public.tickets (tenant_id, created_by);
-- Fuer den Loeschlauf: findet abgelaufene Tickets, ohne die Tabelle zu lesen.
CREATE INDEX tickets_tenant_closed_at_idx ON public.tickets (tenant_id, closed_at)
  WHERE closed_at IS NOT NULL;

CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mandant und Ticketnummer serverseitig setzen
-- ---------------------------------------------------------------------------
--
-- Der Trigger ist nicht die Sicherheitsgrenze -- das ist die WITH-CHECK-Klausel
-- der Policy. Er sorgt dafuer, dass die Anwendung tenant_id gar nicht erst
-- mitliefern muss, womit sie auch nichts falsch mitliefern kann.
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
  'Setzt tenant_id, created_by und die mandantenweite Ticketnummer '
  'serverseitig. Keine Sicherheitsgrenze -- das ist die WITH-CHECK-Klausel der '
  'Policy -- sondern verhindert, dass die Anwendung diese Werte ueberhaupt '
  'mitliefern muss.';

-- ticket_number bleibt NOT NULL, obwohl der Trigger den Wert erst setzt:
-- BEFORE-ROW-Trigger laufen in Postgres VOR der Auswertung von NOT NULL und
-- CHECK. Die Spalte ist damit weiterhin verbindlich, ohne dass die Anwendung
-- eine Nummer mitliefern muss.
CREATE TRIGGER tickets_before_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_before_insert();

-- ---------------------------------------------------------------------------
-- closed_at aus dem Status ableiten
-- ---------------------------------------------------------------------------
--
-- closed_at ist der Startpunkt der Aufbewahrungsfrist. Muesste die Anwendung
-- es selbst setzen und beim Wiederoeffnen selbst zuruecksetzen, haenge das
-- gesamte Loeschkonzept an ihrer Sorgfalt -- und ein vergessenes Zuruecksetzen
-- fiele niemandem auf, weil das Ticket ja normal weiterlaeuft.
--
-- Der Trigger leitet den Wert deshalb aus dem Status ab. Die CHECK-Bedingung
-- tickets_closed_at_passend_zum_status bleibt als Rueckhalt bestehen: Sie
-- faengt den Fall ab, dass diese Ableitung selbst einmal fehlerhaft ist.
CREATE OR REPLACE FUNCTION public.tickets_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status IS DISTINCT FROM 'closed' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  ELSIF NEW.status <> 'closed' THEN
    -- Wiedereroeffnung: Die Frist beginnt spaeter neu, nicht rueckwirkend.
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.tickets_before_update() IS
  'Leitet closed_at aus dem Status ab. Verhindert, dass der Startpunkt der '
  'Aufbewahrungsfrist von der Sorgfalt der Anwendung abhaengt.';

CREATE TRIGGER tickets_before_update
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_before_update();

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets FORCE ROW LEVEL SECURITY;

-- Administrator und Bearbeiter sehen alle Tickets ihres Mandanten.
CREATE POLICY tickets_select_mandant ON public.tickets
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Ein Melder sieht ausschliesslich, was er selbst gemeldet hat.
CREATE POLICY tickets_select_eigene ON public.tickets
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND created_by = (SELECT auth.uid())
  );

-- Anlegen darf jede Rolle -- auch der Melder, das ist sein Zweck.
CREATE POLICY tickets_insert_mandant ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND created_by = (SELECT auth.uid())
  );

-- Bearbeiten: Administrator und Bearbeiter im ganzen Mandanten.
--
-- ACHTUNG -- die Rollenbedingung steht bewusst DOPPELT, in USING und in
-- WITH CHECK. Das ist keine Redundanz, sondern notwendig:
--
-- Bei mehreren permissiven Policies verknuepft Postgres die USING-Klauseln mit
-- ODER und die WITH-CHECK-Klauseln SEPARAT ebenfalls mit ODER. Eine Zeile darf
-- geschrieben werden, wenn IRGENDEINE Policy sie sichtbar macht UND
-- IRGENDEINE WITH-CHECK-Klausel den neuen Zustand erlaubt. Beide Seiten muessen
-- nicht aus derselben Policy stammen.
--
-- Stuende hier nur `tenant_id = current_tenant_id()`, koennte ein Melder ueber
-- die USING-Klausel von tickets_update_eigene an sein Ticket herankommen und
-- den neuen Zustand dann an DIESER schwaecheren WITH-CHECK-Klausel
-- vorbeischreiben -- also genau die Statusbeschraenkung umgehen, die
-- tickets_update_eigene durchsetzen soll.
--
-- Die schwaechste WITH-CHECK-Klausel bestimmt, was moeglich ist. Belegt in
-- supabase/tests/120_tickets_rls.test.sql.
CREATE POLICY tickets_update_mandant ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Der Melder darf sein eigenes Ticket nachbessern, solange es offen ist.
--
-- Die Statusbedingung steht in USING UND in WITH CHECK: In USING legt sie fest,
-- welche Zeilen er anfassen darf, in WITH CHECK, in welchem Zustand er sie
-- hinterlassen darf. Ohne Zweiteres koennte er sein Ticket selbst schliessen
-- und damit die Aufbewahrungsfrist starten.
CREATE POLICY tickets_update_eigene ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND created_by = (SELECT auth.uid())
    AND status = 'open'
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND created_by = (SELECT auth.uid())
    AND status = 'open'
  );

-- Endgueltiges Loeschen nur durch den Administrator. Der Regelfall ist der
-- fristgesteuerte Loeschlauf, nicht das Loeschen von Hand.
CREATE POLICY tickets_delete_admin ON public.tickets
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );


-- =========================================================================
-- 6. Kommentare zu Tickets
-- =========================================================================

-- Kommentare zu Tickets.

CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Denormalisiert, damit keine Policy über einen Join gehen muss.
  --
  -- Die Denormalisierung kann nicht auseinanderlaufen: Der zusammengesetzte
  -- Fremdschlüssel unten bindet (tenant_id, ticket_id) an dasselbe Paar in
  -- tickets. Ein Kommentar zu einem Ticket eines fremden Mandanten ist damit
  -- per Datenbankconstraint ausgeschlossen -- unabhängig von RLS und
  -- unabhängig davon, was die Anwendung versucht.
  tenant_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, ticket_id) REFERENCES public.tickets (tenant_id, id)
    ON DELETE CASCADE,

  author_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, author_id) REFERENCES public.profiles (tenant_id, id)
    ON DELETE RESTRICT,

  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 20000),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Kein `is_internal`: In Release 1 gibt es keine externen Nutzer, also auch
-- keinen Adressatenkreis, vor dem etwas zu verbergen wäre. Ein Flag, das
-- nichts trennt, ist ein Flag, auf das man sich später fälschlich verlässt.

COMMENT ON TABLE public.ticket_comments IS
  'Kommentar zu einem Ticket. tenant_id ist denormalisiert und ueber einen '
  'zusammengesetzten Fremdschluessel an das Ticket gebunden.';

CREATE INDEX ticket_comments_tenant_ticket_idx
  ON public.ticket_comments (tenant_id, ticket_id, created_at);

CREATE TRIGGER ticket_comments_set_updated_at
  BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mandant und Urheber serverseitig setzen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ticket_comments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();

  IF v_tenant IS NULL AND NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id konnte nicht bestimmt werden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.tenant_id := COALESCE(v_tenant, NEW.tenant_id);

  IF NEW.author_id IS NULL THEN
    NEW.author_id := (SELECT auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_comments_before_insert
  BEFORE INSERT ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.ticket_comments_before_insert();

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments FORCE ROW LEVEL SECURITY;

CREATE POLICY ticket_comments_select_mandant ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Der Melder sieht Kommentare zu SEINEN Tickets.
--
-- Diese Policy muss als einzige im Schema auf eine andere Tabelle zugreifen:
-- Ob das Ticket ihm gehoert, steht nicht im Kommentar. Der Zugriff ist
-- unbedenklich, weil die USING-Klausel von tickets zusaetzlich greift -- der
-- Melder sieht in diesem Unterausdruck also ohnehin nur seine eigenen Tickets.
CREATE POLICY ticket_comments_select_eigene_tickets ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND EXISTS (
      SELECT 1
      FROM public.tickets AS t
      WHERE t.id = ticket_comments.ticket_id
        AND t.tenant_id = ticket_comments.tenant_id
        AND t.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY ticket_comments_insert_mandant ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.tickets AS t
      WHERE t.id = ticket_comments.ticket_id
        AND t.tenant_id = ticket_comments.tenant_id
    )
  );

-- Aendern nur am eigenen Kommentar. Auch der Administrator schreibt fremde
-- Beitraege nicht um -- ein Kommentarverlauf, den ein Dritter nachtraeglich
-- veraendern kann, taugt weder als Nachweis noch als Gedaechtnis.
CREATE POLICY ticket_comments_update_eigene ON public.ticket_comments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND author_id = (SELECT auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND author_id = (SELECT auth.uid())
  );

CREATE POLICY ticket_comments_delete_admin ON public.ticket_comments
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );


-- =========================================================================
-- 7. Zeitbuchungen
-- =========================================================================

-- Zeitbuchungen.
--
-- ===========================================================================
-- Buchung statt Zeiterfassung -- eine bewusste Reduktion
-- ===========================================================================
--
-- Der naheliegende Entwurf wäre `started_at` und `ended_at`: eine Stoppuhr.
-- Dieses Schema speichert stattdessen `minutes` und `worked_on` -- also DASS
-- an einem Tag eine bestimmte Dauer auf ein Ticket entfiel, nicht WANN.
--
-- Der Unterschied ist datenschutzrechtlich erheblich. Aus minutengenauen
-- Start- und Endzeitpunkten lässt sich ein Tagesablauf rekonstruieren:
-- Arbeitsbeginn, Pausenlage, Arbeitsende. Das ist eine Verhaltens- und
-- Leistungskontrolle -- in Betrieben mit Betriebsrat mitbestimmungspflichtig,
-- und in jedem Fall mehr, als für die Auswertung von Aufwand je Ticket nötig
-- ist.
--
-- Datenminimierung heisst hier also nicht, ein Feld wegzulassen, sondern die
-- Erhebung gröber anzulegen, als sie technisch möglich wäre.
--
-- Für den Zweck „wie viel Aufwand steckt in diesem Ticket" reicht die Dauer.
-- ===========================================================================

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id uuid NOT NULL,

  -- NOT NULL: Zeitbuchungen laufen in Release 1 ausschliesslich über Tickets.
  -- Ticketfreie Buchungen sind ein Eigenbedarfsthema und gehören nach
  -- Release 2.
  ticket_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, ticket_id) REFERENCES public.tickets (tenant_id, id)
    ON DELETE CASCADE,

  user_id uuid NOT NULL,
  FOREIGN KEY (tenant_id, user_id) REFERENCES public.profiles (tenant_id, id)
    ON DELETE RESTRICT,

  -- Obergrenze 1440 = ein Tag. Fängt den vertippten Faktor ab, bevor er in
  -- eine Auswertung gerät.
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 1440),

  -- Tagesgenau, nicht minutengenau. Siehe Vorbemerkung.
  worked_on date NOT NULL,

  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Keine Buchung in der Zukunft.
  CONSTRAINT time_entries_worked_on_nicht_zukunft
    CHECK (worked_on <= (now() AT TIME ZONE 'UTC')::date + 1)
);

-- Kein `billable`-Kennzeichen: Es hätte nur mit einer Rechnungsstellung einen
-- Zweck, und die ist ausdrücklich nicht Teil von Release 1.

COMMENT ON TABLE public.time_entries IS
  'Zeitbuchung auf ein Ticket. Bewusst Dauer plus Tag statt Start- und '
  'Endzeitpunkt -- minutengenaue Zeitpunkte erlaubten die Rekonstruktion von '
  'Arbeitsbeginn, Pausen und Arbeitsende und waeren damit eine Verhaltens- und '
  'Leistungskontrolle.';

CREATE INDEX time_entries_tenant_ticket_idx
  ON public.time_entries (tenant_id, ticket_id);
CREATE INDEX time_entries_tenant_user_worked_on_idx
  ON public.time_entries (tenant_id, user_id, worked_on);

CREATE TRIGGER time_entries_set_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.time_entries_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();

  IF v_tenant IS NULL AND NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id konnte nicht bestimmt werden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.tenant_id := COALESCE(v_tenant, NEW.tenant_id);

  IF NEW.user_id IS NULL THEN
    NEW.user_id := (SELECT auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER time_entries_before_insert
  BEFORE INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.time_entries_before_insert();

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;

-- Der MELDER hat auf diese Tabelle ueberhaupt keinen Zugriff -- weder lesend
-- noch schreibend. Es gibt keine Policy fuer ihn, und ohne Policy gibt es
-- keinen Zugriff.
--
-- Das ist die schaerfste Grenze im Schema und zugleich die aussagekraeftigste:
-- Eine Zugriffskontrolle, die INNERHALB eines Mandanten trennt, laesst sich
-- nur mit mehr als zwei Rollen ueberhaupt zeigen.

-- Lesen: Administrator und Bearbeiter sehen alle Buchungen ihres Mandanten.
-- Ein Bearbeiter braucht die Zahlen seiner Kollegen fuer die Auswertung je
-- Ticket -- die Buchung nennt Dauer und Tag, nicht den Tagesablauf.
CREATE POLICY time_entries_select_mandant ON public.time_entries
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Buchen nur auf den eigenen Namen. Eine Buchung fuer jemand anderen waere
-- eine Aussage ueber dessen Arbeitszeit, die dieser nicht getroffen hat.
CREATE POLICY time_entries_insert_eigene ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND user_id = (SELECT auth.uid())
    AND (SELECT public.current_app_role()) IN ('admin', 'agent')
  );

-- Aendern nur an der eigenen Buchung -- auch fuer den Administrator. Er kann
-- eine falsche Buchung loeschen und neu anlegen lassen, aber er kann sie nicht
-- im Namen eines anderen umschreiben.
CREATE POLICY time_entries_update_eigene ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY time_entries_delete_eigene ON public.time_entries
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY time_entries_delete_admin ON public.time_entries
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );


-- =========================================================================
-- 8. Zugriffs- und Aenderungsprotokoll
-- =========================================================================

-- Zugriffs- und Änderungsprotokoll.
--
-- ===========================================================================
-- Nur Feldnamen, niemals Feldinhalte
-- ===========================================================================
--
-- Der übliche Entwurf eines Audit-Logs speichert `old_value` und `new_value`
-- oder ein `payload jsonb` mit der ganzen Zeile. Damit entsteht eine ZWEITE
-- Kopie aller personenbezogenen Daten -- eine, die typischerweise länger
-- aufbewahrt wird als das Original, in keinem Löschkonzept auftaucht und beim
-- Auskunftsersuchen vergessen wird.
--
-- docs/security.md, Kapitel F führt das als eigenes Risiko: „Protokollierung
-- ohne Grenze -- Logs werden selbst zum Datenschutzproblem."
--
-- Dieses Protokoll speichert deshalb nur, WELCHE Felder geändert wurden
-- (`changed_fields`), nicht WORAUF. Für den Zweck eines Audit-Logs -- wer hat
-- wann was angefasst -- genügt das. Wer den alten Wert braucht, braucht in
-- Wahrheit eine Versionierung, und die wäre eine eigene Entscheidung mit
-- eigenem Löschkonzept.
--
-- Ebenfalls nicht erhoben: IP-Adresse und User-Agent. Beides sind
-- personenbezogene Daten mit eigener Rechtsgrundlagenfrage, und beides trägt
-- zur Frage „wer hat was geändert" nichts bei -- der Handelnde steht in
-- actor_id.
-- ===========================================================================

CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

  -- NULL = System (Löschlauf, Wartung) oder ein inzwischen anonymisiertes
  -- Profil. Bewusst kein Fremdschlüssel auf profiles: Das Protokoll muss die
  -- Löschung eines Profils überdauern, sonst verschwände mit dem Nutzer auch
  -- die Spur dessen, was er getan hat.
  actor_id uuid,

  -- Punktnotation, etwa 'ticket.create', 'time_entry.update',
  -- 'export.person_data', 'ai.classify'.
  action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 80),

  entity_type text NOT NULL CHECK (length(btrim(entity_type)) BETWEEN 1 AND 60),
  entity_id uuid,

  -- Nur Namen. Siehe Vorbemerkung.
  changed_fields text[],

  occurred_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS
  'Protokoll. Nur anhaengend: keine UPDATE-, keine DELETE-Policy. Enthaelt '
  'ausschliesslich Feldnamen, niemals Feldinhalte -- und weder IP-Adresse noch '
  'User-Agent.';
COMMENT ON COLUMN public.audit_log.changed_fields IS
  'Namen der geaenderten Felder. Bewusst ohne Werte: sonst waere das Protokoll '
  'eine zweite, unbefristete Kopie personenbezogener Daten.';
COMMENT ON COLUMN public.audit_log.actor_id IS
  'Ohne Fremdschluessel, damit der Eintrag die Loeschung des Profils '
  'ueberdauert. anonymize_profile() setzt ihn auf NULL.';

CREATE INDEX audit_log_tenant_occurred_at_idx
  ON public.audit_log (tenant_id, occurred_at DESC);
CREATE INDEX audit_log_tenant_entity_idx
  ON public.audit_log (tenant_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Eintragen ausschliesslich ueber diese Funktion
-- ---------------------------------------------------------------------------
--
-- Es gibt bewusst KEINE INSERT-Policy. Wer protokollieren will, ruft diese
-- Funktion auf. Damit gibt es genau einen Weg in die Tabelle -- und genau eine
-- Stelle, an der zu pruefen ist, ob versehentlich Inhalte statt Feldnamen
-- geschrieben werden.
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_changed_fields text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  v_tenant := public.current_tenant_id();

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Protokolleintrag ohne Mandantenbezug'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.audit_log
    (tenant_id, actor_id, action, entity_type, entity_id, changed_fields)
  VALUES
    (v_tenant, (SELECT auth.uid()), p_action, p_entity_type, p_entity_id,
     p_changed_fields);
END;
$$;

COMMENT ON FUNCTION public.log_audit(text, text, uuid, text[]) IS
  'Einziger Weg in public.audit_log. Es gibt keine INSERT-Policy.';

REVOKE EXECUTE ON FUNCTION public.log_audit(text, text, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit(text, text, uuid, text[])
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Zugriffsregeln
-- ---------------------------------------------------------------------------

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- Nur der Administrator des eigenen Mandanten liest das Protokoll.
CREATE POLICY audit_log_select_admin ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

-- Kein INSERT (siehe log_audit), kein UPDATE, kein DELETE.
--
-- Ein Protokoll, das sein Gegenstand veraendern kann, ist kein Protokoll. Das
-- fristgesteuerte Loeschen alter Eintraege laeuft ueber
-- public.purge_expired_data() -- SECURITY DEFINER und damit an den Policies
-- vorbei, was hier die Absicht ist: Loeschen darf der Loeschlauf, nicht der
-- Nutzer.


-- =========================================================================
-- 9. Konfiguration der KI-Anbindung
-- =========================================================================

-- Konfiguration der KI-Anbindung.
--
-- ===========================================================================
-- Zwei getrennte Entscheidungen, zwei getrennte Orte
-- ===========================================================================
--
-- WOMIT verarbeitet wird -- Anbieter, Modell, Zugangsschlüssel -- entscheidet
-- der Instanzbetreiber. Das steht hier, in einer Tabelle mit genau einer Zeile.
--
-- OB verarbeitet wird, entscheidet der Mandant. Das steht in
-- tenants.ai_enabled, mit dem Vorgabewert false.
--
-- Die Trennung ist beabsichtigt: Ein Betreiber, der einen Schlüssel hinterlegt,
-- hat damit noch nicht die Einwilligung seiner Mandanten. Und ein Mandant, der
-- zustimmt, soll nicht wählen können, an welches Unternehmen die Daten gehen.
--
-- Dass der Anbieter überhaupt konfigurierbar ist -- statt fest im Code zu
-- stehen -- ist die praktische Umsetzung der Souveränitätsanforderung aus
-- docs/architektur.md: `openai_compatible` erlaubt ein selbst betriebenes
-- Modell, womit die Übermittlung an einen Dritten vollständig entfällt.
-- ===========================================================================

CREATE TABLE public.ai_config (
  -- Genau eine Zeile. Die CHECK-Bedingung macht eine zweite unmöglich --
  -- verlässlicher als die Verabredung, es bei einer zu belassen.
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- Hauptschalter des Betreibers. Auch bei aktivem Mandanten passiert nichts,
  -- solange dieser Schalter aus ist.
  enabled boolean NOT NULL DEFAULT false,

  provider public.ai_provider NOT NULL DEFAULT 'anthropic',

  -- Nur für `openai_compatible` -- etwa ein lokal betriebenes Modell.
  base_url text CHECK (base_url IS NULL OR length(base_url) <= 500),

  -- Zugangsschlüssel des Betreibers.
  --
  -- Er liegt in der Datenbank statt in einer Umgebungsvariablen, damit ein
  -- Betreiber ihn ohne Neustart wechseln kann. Erreichbar ist er
  -- ausschliesslich über `service_role`: Diese Tabelle hat RLS aktiviert und
  -- KEINE EINZIGE POLICY -- siehe unten.
  api_key text,

  -- Modellkennung als Datenfeld, nicht als Konstante im Code. Modelle werden
  -- häufiger abgelöst als Anwendungen ausgeliefert.
  model text CHECK (model IS NULL OR length(model) <= 120),

  -- Kostenbremse und Datenminimierung zugleich.
  --
  -- Begrenzt, wie viel Ticketinhalt überhaupt das Haus verlässt. Wirkt
  -- gleichzeitig gegen den Missbrauch, ein sehr langes Ticket anzulegen, um
  -- Kosten zu erzeugen (docs/security.md, Kapitel H).
  max_input_chars integer NOT NULL DEFAULT 8000
    CHECK (max_input_chars BETWEEN 500 AND 100000),

  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_config IS
  'Instanzweite KI-Konfiguration, genau eine Zeile. RLS aktiv und bewusst OHNE '
  'Policy: erreichbar ausschliesslich ueber service_role. Die Freigabe je '
  'Mandant sitzt getrennt davon in tenants.ai_enabled.';
COMMENT ON COLUMN public.ai_config.max_input_chars IS
  'Obergrenze des uebergebenen Textes. Datenminimierung und Kostenbremse.';

CREATE TRIGGER ai_config_set_updated_at
  BEFORE UPDATE ON public.ai_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Die eine Zeile anlegen, abgeschaltet und ohne Schluessel.
INSERT INTO public.ai_config (id) VALUES (1);

-- ---------------------------------------------------------------------------
-- Zugriffsregeln: keine
-- ---------------------------------------------------------------------------
--
-- RLS ist aktiviert, und es gibt KEINE Policy. Fuer `authenticated` und `anon`
-- ist die Tabelle damit vollstaendig unsichtbar -- kein Lesen, kein Schreiben.
-- Nur `service_role` (BYPASSRLS) kommt heran, also ausschliesslich
-- serverseitiger Code.
--
-- Das ist kein Versehen, sondern die Absicht. Der Zugangsschluessel des
-- Betreibers darf auch einem Mandanten-Administrator nicht zugaenglich sein:
-- Er wuerde damit auf dessen Rechnung Anfragen stellen koennen.
--
-- Der Meta-Test in supabase/tests/100_rls_meta.test.sql verlangt, dass jede
-- Tabelle mindestens eine Policy hat. ai_config steht dort auf einer
-- ausdruecklichen Ausnahmeliste -- damit ist die Abwesenheit dokumentiert und
-- nicht bloss unauffaellig.
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_config FROM anon, authenticated;


-- =========================================================================
-- 10. Aufbewahrung, Anonymisierung und Auskunft
-- =========================================================================

-- Löschung, Anonymisierung und Auskunft.
--
-- ===========================================================================
-- Tatsächliche Löschung, kein Kennzeichen
-- ===========================================================================
--
-- Grundsatz des Projekts: „Löschkonzept von Anfang an: Löschfristen definiert,
-- Löschung tatsächlich implementiert, nicht nur ein Flag."
--
-- Die Funktionen hier führen `DELETE` aus. Ein `deleted_at`-Kennzeichen wäre
-- keine Löschung, sondern eine Ausblendung -- die Daten lägen weiter in der
-- Tabelle, und bei einem Auskunftsersuchen wären sie herauszugeben.
--
-- Alle drei Funktionen laufen als SECURITY DEFINER und damit an den Policies
-- vorbei. Das ist hier die Absicht: Löschen darf der Löschlauf, nicht der
-- Nutzer. Die Funktionen prüfen ihre Berechtigung stattdessen selbst.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Fristgesteuerter Löschlauf
-- ---------------------------------------------------------------------------
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
  'Fristgesteuerter Loeschlauf. Fuehrt DELETE aus, kein Kennzeichen. Offene '
  'Tickets bleiben unberuehrt -- die Frist beginnt mit closed_at. Nur '
  'service_role darf ausfuehren; Einplanung siehe docs/loeschkonzept.md.';

REVOKE EXECUTE ON FUNCTION public.purge_expired_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_data() TO service_role;

-- ---------------------------------------------------------------------------
-- Profil anonymisieren
-- ---------------------------------------------------------------------------
--
-- Zwei Schritte, bewusst getrennt:
--   1. Diese Funktion loest den Personenbezug im Anwendungsschema.
--   2. Die eigentliche personenbezogene Angabe -- die E-Mail-Adresse -- liegt
--      in auth.users und wird serverseitig ueber die Admin-Schnittstelle
--      geloescht.
--
-- Tickets und Zeitbuchungen bleiben erhalten. Nach der Anonymisierung sind sie
-- keine personenbezogenen Daten mehr, sondern Betriebsdaten: Der Aufwand je
-- Ticket bleibt auswertbar, ohne dass er einer Person zuzuordnen waere.
CREATE OR REPLACE FUNCTION public.anonymize_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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
  'Loest den Personenbezug im Anwendungsschema. Die E-Mail-Adresse in '
  'auth.users ist gesondert zu loeschen -- dort liegt die eigentliche Angabe.';

REVOKE EXECUTE ON FUNCTION public.anonymize_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_profile(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Auskunft nach Art. 15 und Datenuebertragbarkeit nach Art. 20 DSGVO
-- ---------------------------------------------------------------------------
--
-- Betroffenenrechte muessen MASCHINELL erfuellbar sein. Eine Auskunft, die von
-- Hand aus mehreren Tabellen zusammengesucht wird, ist in der Praxis
-- unvollstaendig -- und die Unvollstaendigkeit faellt niemandem auf.
--
-- Wird eine Tabelle mit Personenbezug ergaenzt, gehoert sie hier hinein. Der
-- Test 210_auskunft.test.sql prueft, dass der Export alle vier Bereiche
-- enthaelt.
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

REVOKE EXECUTE ON FUNCTION public.export_person_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_person_data(uuid)
  TO authenticated, service_role;
