-- Kein Modellvorschlag ohne Herkunftsnachweis.
--
-- ai_model und ai_generated_at stehen seit dem Basisschema als
-- "Herkunftsnachweis" da, mit Verweis auf die Rechenschaftspflicht nach
-- Art. 5 Abs. 2 DSGVO. Geschrieben hat sie beim Anlegen niemand -- die
-- Anwendung setzte nur ai_summary und die Kennzeichnung.
--
-- Die Anwendung fuellt sie inzwischen aus einem signierten Nachweis
-- (src/lib/ai/provenance.ts). Diese Datei prueft die Schranke DARUNTER: Auch
-- ein kuenftiger Schreibweg -- eine zweite Server Action, ein Skript, ein
-- Import -- kommt an ihr nicht vorbei.

BEGIN;
SELECT plan(5);

SELECT tests.basis_anlegen();

-- ===========================================================================
-- Zusammenfassung ohne Herkunft
-- ===========================================================================

SELECT throws_ok(
  format(
    $sql$UPDATE public.tickets SET ai_summary = 'Behauptung ohne Beleg' WHERE id = %L$sql$,
    tests.a_ticket_vom_agent()
  ),
  '23514',
  NULL,
  'Eine Zusammenfassung ohne Modellangabe wird abgewiesen'
);

SELECT throws_ok(
  format(
    $sql$UPDATE public.tickets SET ai_summary = 'Text', ai_model = 'modell-v1' WHERE id = %L$sql$,
    tests.a_ticket_vom_agent()
  ),
  '23514',
  NULL,
  'Auch mit Modell, aber ohne Zeitpunkt, wird abgewiesen'
);

SELECT lives_ok(
  format(
    $sql$UPDATE public.tickets SET ai_summary = 'Text', ai_model = 'modell-v1', ai_generated_at = now() WHERE id = %L$sql$,
    tests.a_ticket_vom_agent()
  ),
  'Mit vollstaendiger Herkunft geht es durch'
);

-- ===========================================================================
-- Kennzeichnung ohne Zusammenfassung
-- ===========================================================================
--
-- Die Schraffur in der Oberflaeche haengt an ai_marked_fields. Ein Eintrag
-- ohne Text waere eine Kennzeichnung ueber einem leeren Feld -- sichtbar,
-- unerklaerlich, und niemand koennte sie wegpruefen.

SELECT throws_ok(
  format(
    $sql$UPDATE public.tickets SET ai_summary = NULL, ai_model = NULL, ai_generated_at = NULL, ai_marked_fields = ARRAY['ai_summary'] WHERE id = %L$sql$,
    tests.a_ticket_vom_agent()
  ),
  '23514',
  NULL,
  'Eine Kennzeichnung ohne Zusammenfassung wird abgewiesen'
);

-- Das Zuruecknehmen muss dagegen jederzeit gehen: Es ist der Vorgang
-- "ein Mensch hat hingesehen".
SELECT lives_ok(
  format(
    $sql$UPDATE public.tickets SET ai_marked_fields = ARRAY[]::text[] WHERE id = %L$sql$,
    tests.a_ticket_vom_agent()
  ),
  'Die Kennzeichnung laesst sich jederzeit zuruecknehmen'
);

SELECT * FROM finish();
ROLLBACK;
