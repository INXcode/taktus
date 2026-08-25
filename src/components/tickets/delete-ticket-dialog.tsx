"use client";

import { useActionState, useId, useRef } from "react";
import { deleteTicket } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatMinutes } from "@/lib/format/duration";
import { type FormResult } from "@/types";

/**
 * Bildschirm 11 -- Ticket löschen.
 *
 * Ein natives `<dialog>` mit `showModal()`: Fokusfalle, Escape, `inert` für
 * den Hintergrund und der Verdunkler kommen von der Plattform.
 *
 * > [!important] Die Bestätigung ist getippt, nicht geklickt.
 * > Mit dem Ticket verschwinden seine Kommentare und Zeitbuchungen, und das
 * > lässt sich nicht zurückholen. Der Entwurf verlangt deshalb, die Nummer
 * > einzutippen -- ein `confirm()` wäre eine Bewegung, die man aus Gewohnheit
 * > macht.
 * >
 * > Die Zahlen unten stammen aus dem Seitenaufbau und können veraltet sein;
 * > die Action zählt vor dem Löschen selbst nach und vergleicht die Nummer
 * > serverseitig. Eine Bestätigung, die nur im Browser geprüft wird, ist
 * > keine.
 */
export function DeleteTicketDialog({
  ticketId,
  ticketNumber,
  commentCount,
  timeEntryCount,
  totalMinutes,
}: {
  readonly ticketId: string;
  readonly ticketNumber: number;
  readonly commentCount: number;
  readonly timeEntryCount: number;
  readonly totalMinutes: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    deleteTicket,
    null,
  );
  const confirmId = useId();
  const failed = state !== null && !state.ok;

  return (
    <>
      {/* Über die volle Breite der Seitenschiene, wie „Speichern" darüber.
          Als schmaler Knopf sass er linksbündig unter einem Kasten, zu dem er
          nicht gehört, und las sich wie ein Rest -- übersehen wurde er
          zuverlässiger als der Vorgang verdient. Die Breite macht ihn nicht
          harmloser: Der Dialog dahinter verlangt weiterhin die getippte
          Nummer. */}
      <Button
        variant="destructive"
        type="button"
        fullWidth
        onClick={() => dialog.current?.showModal()}
      >
        Löschen
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={`${confirmId}-titel`}
        // `m-auto` ist nicht kosmetisch: Ein modales `<dialog>` zentriert sich
        // über `margin: auto`, und Tailwinds Preflight setzt `margin: 0` auf
        // jedes Element. Ohne diese Klasse klebt der Dialog oben links -- was
        // wie ein Layoutfehler aussieht und keiner ist.
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 shadow-lg backdrop:bg-overlay"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <h2
          id={`${confirmId}-titel`}
          className="text-xl leading-[26px] font-bold"
        >
          Ticket #{ticketNumber} endgültig löschen?
        </h2>

        <p className="mt-2.5 text-base leading-[1.55] text-body">
          Gelöscht werden mit dem Ticket:{" "}
          <strong className="font-semibold">
            {commentCount} {commentCount === 1 ? "Kommentar" : "Kommentare"}
          </strong>{" "}
          und{" "}
          <strong className="font-semibold">
            {timeEntryCount}{" "}
            {timeEntryCount === 1 ? "Zeitbuchung" : "Zeitbuchungen"}
            {timeEntryCount > 0 ? ` (${formatMinutes(totalMinutes)})` : ""}
          </strong>
          . Das lässt sich nicht zurückholen.
        </p>

        <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted">
          Im Protokoll bleibt der Vorgang{" "}
          <span className="font-mono">ticket.delete</span> mit Zeitpunkt und
          Akteur erhalten — ohne Inhalte.
        </p>

        <form action={formAction} className="mt-5">
          <input type="hidden" name="ticketId" value={ticketId} />

          <Field
            id={confirmId}
            label="Zur Bestätigung die Nummer tippen"
            error={
              failed
                ? (state.fields?.["confirmation"] ?? state.error)
                : undefined
            }
          >
            <TextInput
              id={confirmId}
              name="confirmation"
              inputMode="numeric"
              autoComplete="off"
              placeholder={`#${ticketNumber}`}
              invalid={failed}
            />
          </Field>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
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
    </>
  );
}
