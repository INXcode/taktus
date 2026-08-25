-- ===========================================================================
-- Die Verwaltung darf fremde Beitraege und Buchungen korrigieren
-- ===========================================================================
--
-- Bis hierher galt: Aendern nur am eigenen Kommentar, aendern nur an der
-- eigenen Buchung -- ausdruecklich auch fuer den Administrator. Die Begruendung
-- im Basisschema war die Beweiskraft: Ein Verlauf, den ein Dritter nachtraeglich
-- veraendern kann, taugt weder als Nachweis noch als Gedaechtnis.
--
-- Diese Entscheidung wird zurueckgenommen, und zwar aus dem Betrieb heraus. Der
-- vorgesehene Ausweg -- loeschen und neu anlegen lassen -- funktioniert genau
-- dann nicht, wenn er gebraucht wird: Ein Tippfehler in einem Kommentar bleibt
-- stehen, bis dessen Urheber Zeit hat; eine falsche Buchung verschwindet
-- entweder ganz aus der Auswertung oder gar nicht. Die Verantwortung fuer die
-- Daten des Mandanten liegt aber bei der Verwaltung, nicht bei dem, der zufaellig
-- als Erster getippt hat.
--
-- ---------------------------------------------------------------------------
-- Was von der alten Begruendung erhalten bleibt
-- ---------------------------------------------------------------------------
--
-- Die Beweiskraft ging nicht daran verloren, DASS jemand korrigiert, sondern
-- daran, dass es unsichtbar bliebe. Deshalb kommt die Erlaubnis nicht allein:
--
--   1. Zurechnung bleibt fest. Ein BEFORE-UPDATE-Trigger friert tenant_id,
--      ticket_id und den Urheber beziehungsweise die buchende Person ein. Die
--      Verwaltung korrigiert damit den INHALT einer Aussage, sie kann sie aber
--      niemandem sonst in den Mund legen -- und keine Buchung auf einen anderen
--      Namen umschreiben. Das ist der Teil der alten Regel, der tatsaechlich
--      die Beweiskraft trug.
--   2. Jede Aenderung steht im Protokoll, mit Akteur und Feldnamen (nicht mit
--      Inhalten -- siehe log_audit).
--   3. set_updated_at laeuft weiter, ein korrigierter Beitrag ist also an
--      updated_at > created_at erkennbar. Die Oberflaeche vermerkt das.
--
-- Die neuen Policies sind PERMISSIVE und treten neben die bestehenden
-- `*_update_eigene`. Postgres verodert sie: Wer die eigene Zeile aendert,
-- kommt weiterhin ueber die alte Policy durch, auch ohne Verwaltungsrolle.


-- ---------------------------------------------------------------------------
-- Zurechnung einfrieren
-- ---------------------------------------------------------------------------
--
-- Kein Umweg ueber WITH CHECK: Eine Policy sieht nur NEW, nicht OLD, und kann
-- deshalb gar nicht ausdruecken „dieser Wert darf sich nicht aendern". Ein
-- Trigger kann es -- und er gilt fuer jeden Weg in die Tabelle, nicht nur fuer
-- den der Anwendung.

CREATE OR REPLACE FUNCTION public.ticket_comments_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
     OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION
      'Mandant, Ticket und Urheber eines Kommentars sind unveraenderlich'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ticket_comments_before_update() IS
  'Friert die Zurechnung eines Kommentars ein. Die Verwaltung darf den Text '
  'korrigieren, aber den Beitrag niemandem sonst zuschreiben.';

CREATE TRIGGER ticket_comments_before_update
  BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.ticket_comments_before_update();


CREATE OR REPLACE FUNCTION public.time_entries_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION
      'Mandant, Ticket und buchende Person einer Zeitbuchung sind unveraenderlich'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.time_entries_before_update() IS
  'Friert die Zurechnung einer Zeitbuchung ein. Eine Korrektur bleibt eine '
  'Korrektur an der Buchung derselben Person.';

CREATE TRIGGER time_entries_before_update
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.time_entries_before_update();


-- ---------------------------------------------------------------------------
-- Die Erlaubnis selbst
-- ---------------------------------------------------------------------------
--
-- Der Bearbeiter bekommt sie NICHT. Die Grenze zwischen Bearbeiter und
-- Verwaltung ist die schaerfste innerhalb eines Mandanten und der eigentliche
-- Beleg dafuer, dass hier mehr als eine Mandantentrennung geprueft wird -- sie
-- bei dieser Gelegenheit einzuebnen, waere ein stiller Verlust.

CREATE POLICY ticket_comments_update_admin ON public.ticket_comments
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

COMMENT ON POLICY ticket_comments_update_admin ON public.ticket_comments IS
  'Die Verwaltung korrigiert fremde Beitraege. Die Zurechnung haelt der '
  'Trigger ticket_comments_before_update, das Protokoll haelt den Vorgang '
  'fest, updated_at macht ihn in der Oberflaeche sichtbar.';

CREATE POLICY time_entries_update_admin ON public.time_entries
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  )
  WITH CHECK (
    tenant_id = (SELECT public.current_tenant_id())
    AND (SELECT public.is_tenant_admin())
  );

COMMENT ON POLICY time_entries_update_admin ON public.time_entries IS
  'Die Verwaltung korrigiert fremde Buchungen, statt sie loeschen und neu '
  'anlegen zu lassen. Die buchende Person bleibt dieselbe -- dafuer sorgt '
  'der Trigger time_entries_before_update.';


-- ---------------------------------------------------------------------------
-- Die alten Policies richtigstellen, ohne das Basisschema anzufassen
-- ---------------------------------------------------------------------------
--
-- 20260804000000_initial_schema.sql traegt an beiden `*_update_eigene` noch die
-- alte Begruendung („auch der Administrator nicht"). Die Datei bleibt, wie sie
-- ist -- eine angewandte Migration wird nicht nachtraeglich umgeschrieben. Wer
-- die Datenbank befragt statt die Datei, soll den aktuellen Stand bekommen:

COMMENT ON POLICY ticket_comments_update_eigene ON public.ticket_comments IS
  'Aendern am eigenen Beitrag. Seit 20260809000000 nicht mehr die einzige '
  'UPDATE-Policy -- ticket_comments_update_admin tritt daneben. Der Kommentar '
  'im Basisschema ist insoweit ueberholt.';

COMMENT ON POLICY time_entries_update_eigene ON public.time_entries IS
  'Aendern an der eigenen Buchung. Seit 20260809000000 nicht mehr die einzige '
  'UPDATE-Policy -- time_entries_update_admin tritt daneben. Der Kommentar im '
  'Basisschema ist insoweit ueberholt.';
