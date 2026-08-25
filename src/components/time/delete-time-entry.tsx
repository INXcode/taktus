"use client";

import { useActionState, useId, useRef } from "react";
import { deleteTimeEntry } from "@/actions/time-entries";
import { Notice } from "@/components/patterns/notice";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { type FormResult } from "@/types";

/**
 * Der Löschknopf einer Buchungszeile, mit Rückfrage.
 *
 * Ein eigenes Client-Blatt, damit die Liste darüber eine Server-Komponente
 * bleiben kann: Seit die Zeilen nicht mehr aufklappen, ist das Löschen das
 * einzige in ihnen, das überhaupt Zustand braucht.
 *
 * > [!important] Geklickt, nicht getippt -- anders als beim Ticket.
 * > Bildschirm 11 verlangt die getippte Ticketnummer, weil mit dem Ticket
 * > seine Kommentare und alle Buchungen daran verschwinden. Hier geht genau
 * > eine Zeile verloren, deren Inhalt im Dialog nochmals steht. Eine getippte
 * > Bestätigung für jede einzelne Buchung wäre nicht sicherer, sondern nur
 * > lästig -- und was lästig ist, wird zur Bewegung, die man ohne Hinsehen
 * > macht. Genau davor soll die Rückfrage schützen.
 *
 * Den Ausschlag gab die Zeile selbst: Sie ist auf ganzer Fläche anklickbar.
 * Ein Fehlklick daneben führt ins Ticket und kostet nichts; ein Fehlklick auf
 * „Löschen" kostete eine Buchung. Zwei Handlungen, die einen Millimeter
 * auseinanderliegen, dürfen nicht dieselbe Endgültigkeit haben.
 *
 * `relative z-10`, weil in derselben Zeile ein gedehnter Verweis liegt, der
 * die ganze Fläche abdeckt. Ohne die Stapelposition führe ein Klick auf
 * „Löschen" ins Ticket, statt zu fragen.
 *
 * Wer hier landen darf, entscheidet die Datenbank: `time_entries_delete_eigene`
 * für die eigene Buchung, `time_entries_delete_admin` zusätzlich für fremde.
 * Die Liste bietet den Knopf nur dort an, wo eine der beiden Policies greift --
 * das ist Höflichkeit, nicht die Grenze.
 */
export function DeleteTimeEntry({
  entryId,
  label,
  note,
}: {
  readonly entryId: string;
  /** Beschreibt die Buchung, damit „Löschen" nicht 30-mal gleich heisst. */
  readonly label: string;
  readonly note: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    deleteTimeEntry,
    null,
  );
  const titelId = useId();
  const failed = state !== null && !state.ok;

  return (
    <span className="relative z-10">
      <button
        type="button"
        data-variant="ghost"
        aria-label={`Buchung ${label} löschen`}
        onClick={() => dialog.current?.showModal()}
        className="rounded-md px-1.5 text-[12.5px] font-semibold text-destructive"
      >
        Löschen
      </button>

      {/*
        Ein natives `<dialog>` mit `showModal()`: Fokusfalle, Escape, `inert`
        für den Hintergrund und der Verdunkler kommen von der Plattform -- wie
        auf Bildschirm 11.

        `m-auto` ist nicht kosmetisch: Ein modales `<dialog>` zentriert sich
        über `margin: auto`, und Tailwinds Preflight setzt `margin: 0` auf
        jedes Element. Ohne die Klasse klebt der Dialog oben links.
      */}
      <dialog
        ref={dialog}
        aria-labelledby={titelId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 text-left shadow-lg backdrop:bg-overlay"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <h2 id={titelId} className="text-xl leading-[26px] font-bold">
          Buchung löschen?
        </h2>

        <p className="mt-2.5 text-base leading-[1.55] text-body">
          <strong className="font-semibold">{label}</strong>
          {note === "" ? null : <>, „{note}“</>}. Das lässt sich nicht
          zurückholen.
        </p>

        <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted">
          Im Protokoll bleibt der Vorgang{" "}
          <span className="font-mono">time_entry.delete</span> mit Zeitpunkt und
          Akteur erhalten — ohne Inhalte.
        </p>

        {failed ? (
          <div className="mt-4">
            <Notice kind="error">{state.error}</Notice>
          </div>
        ) : null}

        <form action={formAction} className="mt-5">
          <input type="hidden" name="entryId" value={entryId} />
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Abbrechen
            </Button>
            <SubmitButton pendingLabel="Löscht…" variant="destructive">
              Löschen
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </span>
  );
}
