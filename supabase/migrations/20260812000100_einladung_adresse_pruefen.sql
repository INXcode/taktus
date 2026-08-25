-- ===========================================================================
-- Einladung: vorhandene Adresse erkennen, bevor GoTrue angefasst wird
-- ===========================================================================
--
-- Gefunden bei derselben Sicherheitsdurchsicht wie 20260812000000.
--
-- createMember() in src/actions/members.ts laedt per inviteUserByEmail ein und
-- raeumt bei einem fehlgeschlagenen Profil-Insert wieder auf, indem es das
-- eben eingeladene Konto loescht. Die Annahme dabei: Die zurueckgegebene
-- Kennung gehoert immer zu einem NEU angelegten Konto.
--
-- Die Annahme haelt nicht. In GoTrue v2.188.1 (internal/api/invite.go) faellt
-- eine bereits vorhandene, aber noch UNBESTAETIGTE Adresse durch beide Zweige:
-- kein Fehler, Einladung wird erneut verschickt, HTTP 200 mit der Kennung des
-- BESTEHENDEN Nutzers. Nur eine bestaetigte Adresse erzeugt `email_exists`.
--
-- Damit war folgender Ablauf moeglich: Mandant A laedt jemanden ein, die
-- Person hat den Link noch nicht angeklickt. Der Administrator von Mandant B
-- legt dieselbe Adresse an, bekommt die fremde Kennung, der Profil-Insert
-- scheitert am Primaerschluessel (23505) -- und das Aufraeumen loescht das
-- fremde Anmeldekonto. Ueber
--
--   id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
--
-- riss das die Profilzeile von Mandant A mit. Ein mandantenuebergreifender,
-- zerstoerender Schreibvorgang -- ausgeloest von jemandem ohne jede Beziehung
-- zu diesem Mandanten.
--
-- Die Anwendung kann das nicht selbst pruefen: auth-js 2.112.0 kennt nur
-- listUsers({page, perPage}) und keinen Filter nach Adresse, und das Schema
-- `auth` ist ueber PostgREST bewusst nicht freigegeben (config.toml:
-- schemas = ["public"]). Die Pruefung gehoert deshalb hierher, wo sie die
-- Adresse sehen kann -- und wo sie sich mit pgTAP belegen laesst.
--
-- Das Anwendungsschema speichert die Adresse weiterhin NICHT (profiles hat
-- bewusst keine Spalte dafuer). Diese Funktion liest sie nur, gibt sie nicht
-- heraus und antwortet ausschliesslich mit ja oder nein.

CREATE OR REPLACE FUNCTION public.auth_email_vergeben(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users AS u
     WHERE lower(u.email) = lower(trim(p_email))
       AND u.deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.auth_email_vergeben(text) IS
  'Gibt es zu dieser Adresse bereits ein Anmeldekonto? Nur fuer service_role, '
  'aufgerufen vor dem Einladen. Verhindert, dass GoTrue bei einer vorhandenen '
  'unbestaetigten Adresse die Kennung eines fremden Kontos zurueckgibt. '
  'Antwortet mit ja/nein und gibt die Adresse selbst nicht heraus.';

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------
--
-- Ausschliesslich service_role. Fuer `authenticated` waere das ein Orakel
-- ueber den gesamten Instanzbestand: Ein Melder koennte damit Adresse fuer
-- Adresse abfragen, ob sie irgendwo auf dieser Instanz ein Konto hat -- ueber
-- alle Mandanten hinweg.
--
-- REVOKE FROM PUBLIC allein genuegt nicht. Supabase vergibt `anon` und
-- `authenticated` ueber Default-Privilegien EXECUTE auf alles in `public`;
-- beide Rollen muessen namentlich genannt werden. Das war der Fehler, den
-- 20260805000000_funktionsrechte.sql behoben hat -- er wiederholt sich sonst
-- bei jeder neuen Funktion.
REVOKE EXECUTE ON FUNCTION public.auth_email_vergeben(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_email_vergeben(text) TO service_role;
