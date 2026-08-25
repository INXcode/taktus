-- ===========================================================================
-- Deaktivieren entzieht auch die Anmeldung
-- ===========================================================================
--
-- Gefunden bei derselben Durchsicht wie 20260812000000 und 20260812000100.
-- Fuer sich war das keine Luecke -- es war eine Zusage, die an einer
-- Gewohnheit hing statt an einer Regel.

-- Bisher setzte setMemberDeactivated ausschliesslich profiles.deactivated_at.
-- Die Zeile in auth.users blieb unberuehrt: kein Bann, keine Sitzung
-- entwertet. Fuer die Daten war das folgenlos -- current_tenant_id() liefert
-- sofort NULL, jede Policy faellt zu. Der Zugang selbst blieb aber bestehen.
--
-- Warum das trotzdem zaehlt: Ein deaktivierter Nutzer konnte sich weiterhin
-- ein gueltiges Token holen und blieb damit `authenticated`. Jede Funktion,
-- die sich auf den Mandantenbezug statt auf die Rolle verlaesst, stand ihm
-- offen -- genau der Fehler, den 20260812000000 in export_person_data()
-- behoben hat. Die Korrektur dort beseitigt den einen Fall; diese hier
-- beseitigt die Voraussetzung fuer den naechsten.
--
-- Der Entzug haengt an einem TRIGGER, nicht an der Server Action. Das ist der
-- Punkt: Er wirkt fuer jeden Weg, der deactivated_at setzt -- die
-- Nutzerverwaltung, anonymize_profile(), eine Korrektur von Hand am
-- Datenbestand. Eine Server Action kann man vergessen; einen Trigger nicht.
--
-- Was der Entzug NICHT leistet, damit es niemand fuer mehr haelt, als es ist:
-- Ein bereits ausgestelltes Zugriffstoken bleibt bis zu seinem Ablauf
-- signaturgueltig -- PostgREST prueft die Signatur, nicht GoTrues
-- Sitzungstabelle. Gelesen werden kann damit nichts mehr (RLS), und ein neues
-- Token gibt es nicht mehr: Der Bann verhindert die Anmeldung, die geloeschte
-- Sitzung die Auffrischung. Das Restfenster ist die Restlaufzeit des
-- Zugriffstokens.

CREATE OR REPLACE FUNCTION public.profiles_zugang_nachfuehren()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Zugang entzogen: anmelden und auffrischen beides sperren.
  IF NEW.deactivated_at IS NOT NULL AND OLD.deactivated_at IS NULL THEN
    UPDATE auth.users
       SET banned_until = timestamptz '9999-12-31 00:00:00+00'
     WHERE id = NEW.id;

    -- Beide Tabellen ausdruecklich. refresh_tokens.user_id ist in GoTrue
    -- varchar, nicht uuid -- daher die Umwandlung. Auf die Kaskade ueber
    -- session_id wird nicht gebaut: Sie haengt an einem Fremdschluessel, den
    -- eine kuenftige GoTrue-Fassung anders schneiden kann.
    DELETE FROM auth.refresh_tokens WHERE user_id = NEW.id::text;
    DELETE FROM auth.sessions WHERE user_id = NEW.id;

  -- Wieder aktiviert: Bann zuruecknehmen. Ohne diesen Zweig waere die
  -- Reaktivierung in der Oberflaeche wirkungslos -- das Profil waere aktiv,
  -- die Anmeldung weiterhin gesperrt, und niemand faende den Grund.
  ELSIF NEW.deactivated_at IS NULL AND OLD.deactivated_at IS NOT NULL THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_zugang_nachfuehren() IS
  'Haelt die Anmeldung mit profiles.deactivated_at gleich: Bann setzen und '
  'Sitzungen loeschen beim Entzug, Bann zuruecknehmen bei Reaktivierung. '
  'Als Trigger, damit kein Aufrufer ihn vergessen kann.';

CREATE TRIGGER profiles_zugang_nachfuehren
  AFTER UPDATE OF deactivated_at ON public.profiles
  FOR EACH ROW
  WHEN (OLD.deactivated_at IS DISTINCT FROM NEW.deactivated_at)
  EXECUTE FUNCTION public.profiles_zugang_nachfuehren();

-- Die Vorgabe entzieht jeder neuen Funktion das EXECUTE-Recht (siehe
-- 20260805000000). Eine Triggerfunktion braucht es fuer die Rolle, die das
-- UPDATE ausloest -- sonst haengt jede Deaktivierung daran.
GRANT EXECUTE ON FUNCTION public.profiles_zugang_nachfuehren() TO authenticated;
