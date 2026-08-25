"use client";

import { useActionState, useId } from "react";
import { createTimeEntry, updateTimeEntry } from "@/actions/time-entries";
import { Notice } from "@/components/patterns/notice";
import { DurationInput } from "@/components/time/duration-input";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { MINUTES_MAX } from "@/lib/format/duration";
import { NOTE_MAX } from "@/lib/validation/time-entry";
import { type FormResult } from "@/types";

/**
 * Bildschirm 12 -- Zeit buchen und Buchung ändern.
 *
 * Beides ausschliesslich im Ticketdetail: als Dialog zum Anlegen, aufgeklappt
 * an der Buchung zum Ändern. Der Ticketbezug steht damit immer fest.
 *
 * > [!note] Die eigene Seite „Zeit buchen" ist entfallen.
 * > Sie liess das Ticket aus einer Auswahlliste aller Vorgänge wählen. Das
 * > funktioniert, solange die Liste kurz ist, und wird genau dann unbrauchbar,
 * > wenn die Anwendung sich lohnt. Im Ticket steht der Zusammenhang ohnehin --
 * > und die Ticketsuche ist die bessere Auswahl, als jede Auswahlliste es sein
 * > kann.
 */
export function TimeEntryForm({
  mode,
  ticketId,
  entryId,
  today,
  defaults,
  onDone,
}: {
  readonly mode: "create" | "edit";
  /** Steht fest, wenn aus dem Ticketdetail gebucht wird. */
  readonly ticketId?: string;
  readonly entryId?: string;
  /** Der heutige Tag als `YYYY-MM-DD`, vom Server bestimmt. */
  readonly today: string;
  readonly defaults?: {
    readonly duration: string;
    readonly workedOn: string;
    readonly note: string;
  };
  readonly onDone?: () => void;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    async (previous, formData) => {
      const result =
        mode === "create"
          ? await createTimeEntry(previous, formData)
          : await updateTimeEntry(previous, formData);
      if (result.ok) onDone?.();
      return result;
    },
    null,
  );

  const durationId = useId();
  const workedOnId = useId();
  const noteId = useId();

  const failed = state !== null && !state.ok;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {ticketId !== undefined ? (
        <input type="hidden" name="ticketId" value={ticketId} />
      ) : null}
      {entryId !== undefined ? (
        <input type="hidden" name="entryId" value={entryId} />
      ) : null}

      {failed && state.fields === undefined ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}
      {state?.ok && mode === "edit" ? (
        <Notice kind="success">Gespeichert.</Notice>
      ) : null}

      <Field
        id={durationId}
        label="Dauer"
        hint={`Minuten · 1–${MINUTES_MAX}`}
        error={failed ? state.fields?.["duration"] : undefined}
      >
        <DurationInput
          id={durationId}
          defaultValue={defaults?.duration ?? ""}
          invalid={failed && state.fields?.["duration"] !== undefined}
        />
      </Field>

      <Field
        id={workedOnId}
        label="Tag"
        hint="Höchstens ein Tag in der Zukunft."
        error={failed ? state.fields?.["workedOn"] : undefined}
      >
        {/*
          Ein natives `<input type="date">`: Kalender, Tastaturbedienung und
          das Format der Systemsprache kommen vom Browser. `max` setzt die
          Grenze schon im Auswahlfeld -- geprüft wird sie trotzdem noch einmal
          serverseitig, denn `max` ist eine Bequemlichkeit, keine Schranke.
        */}
        <TextInput
          id={workedOnId}
          name="workedOn"
          type="date"
          defaultValue={defaults?.workedOn ?? today}
          max={tomorrowOf(today)}
          invalid={failed && state.fields?.["workedOn"] !== undefined}
        />
      </Field>

      <Field
        id={noteId}
        label="Notiz"
        hint="Darf leer bleiben."
        error={failed ? state.fields?.["note"] : undefined}
      >
        <TextInput
          id={noteId}
          name="note"
          maxLength={NOTE_MAX}
          defaultValue={defaults?.note ?? ""}
          placeholder="Woran gearbeitet wurde"
        />
      </Field>

      <div className="flex justify-end">
        <SubmitButton
          pendingLabel={mode === "create" ? "Bucht…" : "Speichert…"}
        >
          {mode === "create" ? "Buchen" : "Speichern"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Ein Tag nach `today`, als `YYYY-MM-DD`. */
function tomorrowOf(today: string): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
