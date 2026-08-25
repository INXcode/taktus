-- Ausfuehrungsrechte auf die SECURITY-DEFINER-Funktionen.
--
-- Diese Datei schliesst einen blinden Fleck: Die uebrigen elf Dateien pruefen
-- RLS-Policies auf Tabellen. Ein SECURITY-DEFINER-Aufruf geht daran vorbei --
-- die Funktion laeuft mit den Rechten ihres Eigentuemers, und ob jemand sie
-- ueberhaupt aufrufen darf, entscheidet allein das EXECUTE-Recht.
--
-- Die Luecke fand kein Test, sondern der Bau der Mitgliederverwaltung:
-- `REVOKE EXECUTE ... FROM PUBLIC` nimmt `anon` und `authenticated` nichts
-- weg, und Supabase vergibt beiden ueber Default-Privilegien EXECUTE auf
-- alles im Schema `public`. Ein Melder -- die Rolle mit den wenigsten
-- Rechten -- konnte damit den Loeschlauf ueber alle Mandanten ausloesen.
--
-- Jede kuenftige SECURITY-DEFINER-Funktion gehoert hier hinein.

BEGIN;
SELECT plan(20);

SELECT tests.basis_anlegen();

-- ===========================================================================
-- Teil 1: Wer darf die Funktion ueberhaupt aufrufen
-- ===========================================================================

SELECT ok(
  NOT has_function_privilege('anon', 'public.anonymize_profile(uuid)', 'EXECUTE'),
  'anon darf anonymize_profile nicht ausfuehren'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.anonymize_profile(uuid)', 'EXECUTE'),
  'authenticated darf anonymize_profile nicht ausfuehren'
);
SELECT ok(
  has_function_privilege('service_role', 'public.anonymize_profile(uuid)', 'EXECUTE'),
  'service_role darf anonymize_profile ausfuehren'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.purge_expired_data()', 'EXECUTE'),
  'anon darf den Loeschlauf nicht ausloesen'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.purge_expired_data()', 'EXECUTE'),
  'authenticated darf den Loeschlauf nicht ausloesen -- auch kein Administrator'
);
SELECT ok(
  has_function_privilege('service_role', 'public.purge_expired_data()', 'EXECUTE'),
  'service_role darf den Loeschlauf ausloesen'
);

-- Was die Anwendung mit dem Nutzer-Client aufruft. Beide pruefen selbst.
SELECT ok(
  has_function_privilege('authenticated', 'public.export_person_data(uuid)', 'EXECUTE'),
  'authenticated darf die Auskunft abrufen -- die Funktion prueft den Mandanten selbst'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.export_person_data(uuid)', 'EXECUTE'),
  'anon darf keine Auskunft abrufen'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.log_audit(text, text, uuid, text[])', 'EXECUTE'),
  'authenticated darf protokollieren'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.log_audit(text, text, uuid, text[])', 'EXECUTE'),
  'anon darf nicht protokollieren'
);

-- Die Zugriffshelfer. Seit 20260805000000 entziehen die Default-Privilegien
-- jeder neuen Funktion das EXECUTE-Recht -- current_customer_id() braucht die
-- Vergabe also ausdruecklich, sonst schlaegt jede Policy fehl, die ihn ruft.
SELECT ok(
  has_function_privilege('authenticated', 'public.current_customer_id()', 'EXECUTE'),
  'authenticated darf current_customer_id ausfuehren -- sonst greift keine Kundenpolicy'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.current_customer_id()', 'EXECUTE'),
  'anon darf current_customer_id nicht ausfuehren'
);

-- Die Triggerfunktion am Ticket: CREATE OR REPLACE hat ihre Rechte
-- zurueckgesetzt, und die Vorgabe entzieht sie inzwischen. Ohne die
-- ausdrueckliche Vergabe haenge jedes Anlegen eines Tickets daran.
SELECT ok(
  has_function_privilege('authenticated', 'public.tickets_before_insert()', 'EXECUTE'),
  'authenticated darf die Triggerfunktion am Ticket ausfuehren'
);

-- auth_email_vergeben() (20260812000100) liest auth.users und beantwortet,
-- ob es zu einer Adresse ein Konto gibt. Fuer eine Anwendungsrolle waere das
-- ein Orakel ueber den gesamten Instanzbestand -- ueber alle Mandanten
-- hinweg, denn auth.users kennt keine Mandantengrenze. Nur service_role.
SELECT ok(
  NOT has_function_privilege('anon', 'public.auth_email_vergeben(text)', 'EXECUTE'),
  'anon darf nicht abfragen, ob eine Adresse vergeben ist'
);
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.auth_email_vergeben(text)', 'EXECUTE'),
  'authenticated darf nicht abfragen, ob eine Adresse vergeben ist -- auch kein Administrator'
);
SELECT ok(
  has_function_privilege('service_role', 'public.auth_email_vergeben(text)', 'EXECUTE'),
  'service_role darf vor dem Einladen pruefen, ob die Adresse vergeben ist'
);

-- ===========================================================================
-- Teil 2: Die Selbstpruefung IM Rumpf
-- ===========================================================================
--
-- Das entzogene Recht ist eine Zeile, die jemand versehentlich wieder
-- vergeben kann -- ein spaeteres `GRANT ALL ON ALL FUNCTIONS` genuegt. Die
-- Pruefung in der Funktion greift auch dann noch.
--
-- Hier wird deshalb NUR der JWT-Anspruch gesetzt, ohne auf `authenticated`
-- umzuschalten: Sonst schlaege bereits das fehlende EXECUTE-Recht zu, und der
-- Test belegte etwas anderes als er behauptet. `auth.uid()` liefert den
-- Nutzer, das Recht steht (als postgres), und geprueft wird ausschliesslich
-- der Rumpf.

-- Ein Melder darf nicht anonymisieren, auch nicht im eigenen Mandanten.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', tests.a_melder()::text, 'role', 'authenticated')::text,
  true
);
SELECT throws_ok(
  format('SELECT public.anonymize_profile(%L)', tests.a_agent()),
  '42501',
  'Nur die Verwaltung darf anonymisieren',
  'Der Rumpf weist einen Melder ab'
);

-- Die Verwaltung eines FREMDEN Mandanten ebenfalls -- das ist der Fall, den
-- der Admin-Client sonst ungehindert durchliesse.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', tests.b_admin()::text, 'role', 'authenticated')::text,
  true
);
SELECT throws_ok(
  format('SELECT public.anonymize_profile(%L)', tests.a_agent()),
  '42501',
  'Kein Zugriff auf ein Profil eines anderen Mandanten',
  'Der Rumpf weist die Verwaltung eines anderen Mandanten ab'
);

-- Der Loeschlauf gehoert dem Instanzbetreiber, nicht dem Mandanten.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', tests.a_admin()::text, 'role', 'authenticated')::text,
  true
);
SELECT throws_ok(
  'SELECT public.purge_expired_data()',
  '42501',
  'Der Loeschlauf gehoert dem Instanzbetreiber',
  'Der Rumpf weist auch die Verwaltung des eigenen Mandanten ab'
);

-- Und der erlaubte Fall kommt durch.
SELECT lives_ok(
  format('SELECT public.anonymize_profile(%L)', tests.a_melder()),
  'Die Verwaltung darf im eigenen Mandanten anonymisieren'
);

SELECT * FROM finish();
ROLLBACK;
