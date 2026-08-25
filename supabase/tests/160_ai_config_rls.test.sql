-- public.ai_config: für die Anwendung vollständig unsichtbar.
--
-- Diese Tabelle enthält den Zugangsschlüssel des Instanzbetreibers. Sie hat RLS
-- aktiviert und KEINE Policy -- damit kommt ausschliesslich `service_role`
-- heran, also serverseitiger Code.
--
-- Die Trennung ist beabsichtigt: Auch ein Mandanten-Administrator darf den
-- Schlüssel nicht sehen. Er könnte damit auf Rechnung des Betreibers Anfragen
-- stellen.
--
-- Im Meta-Test (100_rls_meta.test.sql) steht ai_config deshalb auf einer
-- ausdrücklichen Ausnahmeliste. Diese Datei belegt, dass die Ausnahme das tut,
-- was sie soll.

BEGIN;
SELECT plan(5);

SELECT tests.basis_anlegen();

-- Der Betreiber hinterlegt einen Schluessel (als service_role, hier als
-- postgres -- beide umgehen RLS).
UPDATE public.ai_config
   SET enabled = true,
       provider = 'anthropic',
       model = 'ein-modellname',
       api_key = 'geheimer-testwert-kein-echter-schluessel'
 WHERE id = 1;

-- ===========================================================================
-- Für jede Anwendungsrolle unerreichbar
-- ===========================================================================
--
-- Hier greift ausnahmsweise NICHT die Row Level Security, sondern die
-- Rechtevergabe auf Tabellenebene: Die Migration entzieht `anon` und
-- `authenticated` sämtliche Rechte an dieser Tabelle.
--
-- Der Unterschied ist bemerkenswert und der Grund, warum diese Zusicherungen
-- anders aussehen als in allen übrigen Testdateien: RLS FILTERT ein SELECT
-- stumm auf null Zeilen, ein fehlendes Tabellenrecht WIRFT. Für den
-- Zugangsschlüssel des Betreibers ist die härtere Variante die richtige --
-- „gibt es nicht" ist hier eine ehrlichere Antwort als „ist leer".

SELECT tests.anmelden(tests.a_admin());
SELECT throws_ok(
  'SELECT id FROM public.ai_config',
  '42501',
  NULL,
  'Auch ein Mandanten-Administrator kommt an die KI-Konfiguration nicht heran'
);

SELECT throws_ok(
  'UPDATE public.ai_config SET api_key = ''untergeschoben'' WHERE id = 1',
  '42501',
  NULL,
  'Der Zugangsschluessel laesst sich aus der Anwendung nicht veraendern'
);

RESET ROLE;
SELECT tests.anmelden(tests.a_agent());
SELECT throws_ok(
  'SELECT id FROM public.ai_config',
  '42501',
  NULL,
  'Ein Bearbeiter kommt an die KI-Konfiguration nicht heran'
);

-- ===========================================================================
-- Die Freigabe je Mandant liegt getrennt davon
-- ===========================================================================
--
-- WOMIT verarbeitet wird, entscheidet der Betreiber (ai_config). OB verarbeitet
-- wird, entscheidet der Mandant (tenants.ai_enabled) -- und der Vorgabewert ist
-- false, weil eine Uebermittlung an einen Dritten nicht durch Untaetigkeit
-- entstehen darf.

RESET ROLE;
SELECT results_eq(
  format('SELECT ai_enabled FROM public.tenants WHERE id = %L', tests.mandant_a()),
  ARRAY[false],
  'KI ist je Mandant standardmaessig abgeschaltet'
);

SELECT tests.anmelden(tests.a_admin());
SELECT lives_ok(
  'UPDATE public.tenants SET ai_enabled = true WHERE id = (SELECT public.current_tenant_id())',
  'Der Mandanten-Administrator kann die KI fuer seinen Mandanten freigeben'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
