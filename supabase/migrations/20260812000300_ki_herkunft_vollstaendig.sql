-- ===========================================================================
-- Eine KI-Zusammenfassung ohne Herkunftsnachweis gibt es nicht mehr
-- ===========================================================================
--
-- ai_model und ai_generated_at stehen seit dem Basisschema als
-- "Herkunftsnachweis" da, mit Verweis auf die Rechenschaftspflicht nach
-- Art. 5 Abs. 2 DSGVO. createTicket() schrieb aber nur ai_summary und die
-- Kennzeichnung -- die Spalten blieben leer. Der Datensatz behauptete damit
-- "von der KI, ungeprueft" und konnte nicht sagen, von welcher.
--
-- Zwei CHECKs machen daraus eine Regel. Die Anwendung erfuellt sie ab
-- derselben Aenderung ueber einen signierten Herkunftsnachweis
-- (src/lib/ai/provenance.ts); der CHECK ist die Schranke darunter, damit ein
-- kuenftiger Schreibweg sie nicht umgehen kann.

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_ai_herkunft_vollstaendig CHECK (
    ai_summary IS NULL
    OR (ai_model IS NOT NULL AND ai_generated_at IS NOT NULL)
  );

-- Und umgekehrt: Gekennzeichnet werden kann nur, was es gibt. Ein Eintrag
-- 'ai_summary' in ai_marked_fields ohne Zusammenfassung waere eine Schraffur
-- ueber einem leeren Feld.
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_ai_kennzeichnung_setzt_vorschlag_voraus CHECK (
    NOT ('ai_summary' = ANY (ai_marked_fields)) OR ai_summary IS NOT NULL
  );

COMMENT ON CONSTRAINT tickets_ai_herkunft_vollstaendig ON public.tickets IS
  'Kein Modellvorschlag ohne Angabe, welches Modell wann. Art. 5 Abs. 2 DSGVO '
  'ist ohne diese Angabe nicht erfuellbar.';
