-- Testbasis: pgTAP, Hilfsfunktionen und Testdaten.
--
-- Diese Datei läuft OHNE Transaktion, damit Schema und Funktionen den
-- folgenden Testdateien zur Verfügung stehen. Alle übrigen Tests laufen in
-- einer Transaktion mit ROLLBACK und lassen nichts zurück.
--
-- Sie wirkt ausschliesslich auf die lokale Testdatenbank. Weder das Schema
-- `tests` noch die Testdaten sind Teil der Migrationen -- ein Produktivsystem
-- kennt sie nicht.

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

DROP SCHEMA IF EXISTS tests CASCADE;
CREATE SCHEMA tests;

-- ---------------------------------------------------------------------------
-- Feste Kennungen
-- ---------------------------------------------------------------------------
--
-- Feste UUIDs statt zufälliger: Eine fehlgeschlagene Zusicherung soll lesbar
-- sein. `a0000000-...-0003` ist als Melder von Mandant A erkennbar,
-- `b0000000-...-0001` als Administrator von Mandant B.
--
-- Zwei Mandanten mit je drei Rollen sind das Mindeste, mit dem sich beide
-- Grenzen prüfen lassen: die zwischen Mandanten und die zwischen Rollen
-- innerhalb eines Mandanten.
--
-- Seit der Kundenebene kommt eine dritte Konstellation dazu: zwei Kunden im
-- SELBEN Mandanten, mit je einem Melder. Erst damit gibt es einen fremden
-- Kunden, gegen den sich prüfen lässt -- vorher wäre jede Zusicherung über
-- Kundentrennung eine Behauptung ohne Gegenprobe.

CREATE OR REPLACE FUNCTION tests.mandant_a() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'aaaaaaaa-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION tests.mandant_b() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'bbbbbbbb-0000-4000-8000-000000000001'::uuid $$;

-- Kunden. `ac000000-...` liest sich als „Kunde von Mandant A".
CREATE OR REPLACE FUNCTION tests.a_kunde_1() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'ac000000-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION tests.a_kunde_2() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'ac000000-0000-4000-8000-000000000002'::uuid $$;
CREATE OR REPLACE FUNCTION tests.b_kunde() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'bc000000-0000-4000-8000-000000000001'::uuid $$;

CREATE OR REPLACE FUNCTION tests.a_admin() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'a0000000-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION tests.a_agent() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'a0000000-0000-4000-8000-000000000002'::uuid $$;
CREATE OR REPLACE FUNCTION tests.a_melder() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'a0000000-0000-4000-8000-000000000003'::uuid $$;
-- Zweiter Melder von Mandant A, aber beim ANDEREN Kunden.
CREATE OR REPLACE FUNCTION tests.a_melder_kunde_2() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'a0000000-0000-4000-8000-000000000004'::uuid $$;

CREATE OR REPLACE FUNCTION tests.b_admin() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'b0000000-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION tests.b_agent() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'b0000000-0000-4000-8000-000000000002'::uuid $$;
CREATE OR REPLACE FUNCTION tests.b_melder() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'b0000000-0000-4000-8000-000000000003'::uuid $$;

-- Tickets
CREATE OR REPLACE FUNCTION tests.a_ticket_vom_agent() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'a1000000-0000-4000-8000-000000000001'::uuid $$;
CREATE OR REPLACE FUNCTION tests.a_ticket_vom_melder() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'a1000000-0000-4000-8000-000000000002'::uuid $$;
CREATE OR REPLACE FUNCTION tests.b_ticket() RETURNS uuid
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'b1000000-0000-4000-8000-000000000001'::uuid $$;

-- ---------------------------------------------------------------------------
-- An- und Abmelden
-- ---------------------------------------------------------------------------
--
-- Bildet nach, was PostgREST bei einer Anfrage tut: Rolle auf `authenticated`
-- setzen und den Anspruch `sub` aus dem Zugriffstoken hinterlegen. `auth.uid()`
-- liest genau diesen Wert.
--
-- Der dritte Parameter von set_config ist `is_local` = true: Die Einstellung
-- gilt nur bis zum Ende der Transaktion und kann nicht in den nächsten Test
-- durchschlagen.
CREATE OR REPLACE FUNCTION tests.anmelden(p_user uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

COMMENT ON FUNCTION tests.anmelden(uuid) IS
  'Setzt Rolle und JWT-Anspruch wie PostgREST. Nach dem Aufruf laeuft alles '
  'unter Row Level Security -- weitere Testdaten lassen sich dann nicht mehr '
  'anlegen. Zum Zuruecksetzen: RESET ROLE.';

-- ---------------------------------------------------------------------------
-- Testdaten
-- ---------------------------------------------------------------------------
--
-- Wird innerhalb der Transaktion jeder Testdatei aufgerufen und mit dieser
-- zurückgerollt. Läuft als `postgres` und damit vor jedem `tests.anmelden`.
--
-- Der Einfügehelfer für auth.users setzt bewusst NUR `id`: Alle übrigen
-- Spalten haben Vorgabewerte. Damit überstehen die Testdaten ein Schema-Update
-- von GoTrue, das weitere Spalten hinzufügt.
CREATE OR REPLACE FUNCTION tests.basis_anlegen()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.tenants (id, name) VALUES
    (tests.mandant_a(), 'Muster Handwerk GmbH'),
    (tests.mandant_b(), 'Beispiel Steuerkanzlei');

  INSERT INTO public.customers (id, tenant_id, name) VALUES
    (tests.a_kunde_1(), tests.mandant_a(), 'A: Kunde Eins'),
    (tests.a_kunde_2(), tests.mandant_a(), 'A: Kunde Zwei'),
    (tests.b_kunde(),   tests.mandant_b(), 'B: Kunde Eins');

  INSERT INTO auth.users (id) VALUES
    (tests.a_admin()), (tests.a_agent()), (tests.a_melder()),
    (tests.a_melder_kunde_2()),
    (tests.b_admin()), (tests.b_agent()), (tests.b_melder());

  -- Nur Melder tragen einen Kunden. Der CHECK profiles_kunde_nur_beim_melder
  -- erzwingt beide Richtungen -- eine Zeile mit Rolle `agent` und gesetztem
  -- Kunden liesse sich hier gar nicht anlegen.
  INSERT INTO public.profiles (id, tenant_id, role, display_name, customer_id) VALUES
    (tests.a_admin(),  tests.mandant_a(), 'admin',     'A Adminperson', NULL),
    (tests.a_agent(),  tests.mandant_a(), 'agent',     'A Bearbeitung', NULL),
    (tests.a_melder(), tests.mandant_a(), 'requester', 'A Meldeperson',
     tests.a_kunde_1()),
    (tests.a_melder_kunde_2(), tests.mandant_a(), 'requester',
     'A Meldeperson beim zweiten Kunden', tests.a_kunde_2()),
    (tests.b_admin(),  tests.mandant_b(), 'admin',     'B Adminperson', NULL),
    (tests.b_agent(),  tests.mandant_b(), 'agent',     'B Bearbeitung', NULL),
    (tests.b_melder(), tests.mandant_b(), 'requester', 'B Meldeperson',
     tests.b_kunde());

  -- Das Ticket der Bearbeitung laeuft bewusst auf den ZWEITEN Kunden: So ist
  -- „Melder sieht das Ticket eines Kollegen nicht" nicht schon deshalb wahr,
  -- weil beide beim selben Kunden haengen.
  INSERT INTO public.tickets (id, tenant_id, customer_id, title, created_by) VALUES
    (tests.a_ticket_vom_agent(),  tests.mandant_a(), tests.a_kunde_2(),
     'A: Drucker klemmt', tests.a_agent()),
    (tests.a_ticket_vom_melder(), tests.mandant_a(), tests.a_kunde_1(),
     'A: Zugang fehlt', tests.a_melder()),
    (tests.b_ticket(),            tests.mandant_b(), tests.b_kunde(),
     'B: Auswertung stimmt nicht', tests.b_agent());
END;
$$;

-- Ausfuehrbar auch fuer `authenticated`, damit ein Test die Funktionen nach
-- dem Anmelden noch aufrufen kann (etwa die Kennungs-Helfer in Zusicherungen).
GRANT USAGE ON SCHEMA tests TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated, anon, service_role;

-- pg_prove erwartet in jeder Datei eine TAP-Ausgabe. Zugleich die Probe, dass
-- die Testbasis ueberhaupt steht.
BEGIN;
SELECT plan(2);

SELECT has_schema('tests', 'Schema tests wurde angelegt');
SELECT has_function(
  'tests', 'basis_anlegen', ARRAY[]::text[],
  'tests.basis_anlegen() steht den Testdateien zur Verfuegung'
);

SELECT * FROM finish();
ROLLBACK;
