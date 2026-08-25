-- Meta-Test: strukturelle Zusicherungen über ALLE Tabellen.
--
-- ===========================================================================
-- Warum das der wichtigste Test im Projekt ist
-- ===========================================================================
--
-- Jeder andere Test prüft eine Tabelle, die jemand bewusst zu prüfen
-- beschlossen hat. Dieser prüft die Tabellen, an die niemand gedacht hat.
--
-- Der typische Weg zur Datenpanne ist nicht die falsch geschriebene Policy --
-- die fällt beim Schreiben auf. Es ist die neue Tabelle, bei der jemand unter
-- Zeitdruck `ENABLE ROW LEVEL SECURITY` vergessen hat. Ohne diesen Test bleibt
-- das unbemerkt, bis jemand von aussen darauf stösst.
--
-- Deshalb ist er als AUSSCHLUSSPRÜFUNG formuliert: Jede Zusicherung erwartet
-- eine leere Ergebnismenge. Was neu hinzukommt und die Regel verletzt, taucht
-- automatisch auf; niemand muss den Test erweitern.
-- ===========================================================================

BEGIN;
SELECT plan(6);

-- ---------------------------------------------------------------------------
-- 1. Row Level Security ist auf jeder Tabelle aktiviert
-- ---------------------------------------------------------------------------
SELECT is_empty(
  $$
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
  $$,
  'Jede Tabelle in public hat Row Level Security aktiviert'
);

-- ---------------------------------------------------------------------------
-- 2. FORCE ROW LEVEL SECURITY ist gesetzt
-- ---------------------------------------------------------------------------
--
-- Ohne FORCE umgeht der Tabelleneigentümer die Policies. Das betrifft
-- Migrationen und alles, was unter dieser Rolle läuft -- und ist genau der
-- Zustand, in dem eine Policy im Test greift, im Betrieb aber nicht.
SELECT is_empty(
  $$
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relforcerowsecurity
  $$,
  'Jede Tabelle in public hat FORCE ROW LEVEL SECURITY'
);

-- ---------------------------------------------------------------------------
-- 3. Jede Tabelle hat mindestens eine Policy -- oder steht begründet auf der
--    Ausnahmeliste
-- ---------------------------------------------------------------------------
--
-- Aktivierte RLS ohne Policy bedeutet: niemand kommt heran. Das ist bei
-- ai_config gewollt (nur service_role), sonst aber fast immer ein
-- unvollständiger Zwischenstand.
--
-- Die Ausnahmeliste steht ausdrücklich im Test. Eine Tabelle, die hier
-- auftaucht, ist eine bewusste Entscheidung -- keine Auffälligkeit, die
-- niemandem aufgefallen ist.
SELECT is_empty(
  $$
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname NOT IN ('ai_config')
      AND NOT EXISTS (
        SELECT 1 FROM pg_policy AS p WHERE p.polrelid = c.oid
      )
  $$,
  'Jede Tabelle hat eine Policy -- ausser ai_config (nur service_role)'
);

-- ---------------------------------------------------------------------------
-- 4. Keine Policy gilt für PUBLIC
-- ---------------------------------------------------------------------------
--
-- `TO public` schliesst `anon` ein -- also nicht angemeldete Aufrufe. In
-- pg_policy ist das an polroles = '{0}' erkennbar.
SELECT is_empty(
  $$
    SELECT c.relname || '.' || p.polname
    FROM pg_policy AS p
    JOIN pg_class AS c ON c.oid = p.polrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polroles = '{0}'::oid[]
  $$,
  'Keine Policy gilt fuer PUBLIC -- das schloesse anon ein'
);

-- ---------------------------------------------------------------------------
-- 5. Jede Tabelle mit tenant_id hat einen Index mit tenant_id an erster Stelle
-- ---------------------------------------------------------------------------
--
-- Kein Sicherheits-, sondern ein Wirksamkeitskriterium: tenant_id ist die
-- Achse, nach der jede Policy filtert. Ohne passenden Index wird aus der
-- Mandantentrennung ein vollständiger Tabellendurchlauf je Abfrage.
SELECT is_empty(
  $$
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_attribute AS a
      ON a.attrelid = c.oid AND a.attname = 'tenant_id' AND a.attnum > 0
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index AS i
        WHERE i.indrelid = c.oid
          AND i.indkey[0] = a.attnum
      )
  $$,
  'Jede Tabelle mit tenant_id hat einen Index mit tenant_id als erster Spalte'
);

-- ---------------------------------------------------------------------------
-- 6. Keine SECURITY-DEFINER-Funktion ohne festen search_path
-- ---------------------------------------------------------------------------
--
-- Eine SECURITY-DEFINER-Funktion läuft mit den Rechten ihres Eigentümers. Ohne
-- festgelegten Suchpfad kann ein Aufrufer über ein eigenes Schema steuern,
-- welche Funktion oder Tabelle darin tatsächlich angesprochen wird -- eine
-- Rechteausweitung, die im Quelltext völlig unauffällig aussieht.
SELECT is_empty(
  $$
    SELECT p.proname
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
      )
  $$,
  'Keine SECURITY-DEFINER-Funktion ohne festgelegten search_path'
);

SELECT * FROM finish();
ROLLBACK;
