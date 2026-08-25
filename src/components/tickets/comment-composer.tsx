"use client";

import { useActionState, useId, useRef } from "react";
import { createComment } from "@/actions/comments";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { COMMENT_MAX } from "@/lib/validation/comment";
import { type FormResult } from "@/types";

/**
 * Die Eingabe unter dem Kommentarverlauf.
 *
 * Client-Komponente wegen `useActionState` -- die Fehlermeldung soll ohne
 * Seitenwechsel erscheinen, und nach dem Absenden muss das Feld geleert
 * werden. Ohne JavaScript sendet das Formular trotzdem ab; dann kommt die
 * Antwort mit der neu gerenderten Seite.
 */
export function CommentComposer({
  ticketId,
  placeholder = "Kommentar schreiben…",
}: {
  readonly ticketId: string;
  readonly placeholder?: string;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    async (previous, formData) => {
      const result = await createComment(previous, formData);
      // Nur bei Erfolg leeren. Nach einem Fehlschlag bliebe der Text sonst
      // verloren -- und die Eingabe war Arbeit.
      if (result.ok) form.current?.reset();
      return result;
    },
    null,
  );

  const form = useRef<HTMLFormElement>(null);
  const fieldId = useId();
  const failed = state !== null && !state.ok;

  return (
    <form ref={form} action={formAction} className="mt-4">
      <input type="hidden" name="ticketId" value={ticketId} />

      <label htmlFor={fieldId} className="sr-only">
        Kommentar
      </label>
      <textarea
        id={fieldId}
        name="body"
        rows={3}
        maxLength={COMMENT_MAX}
        placeholder={placeholder}
        {...(failed ? { "aria-invalid": true } : {})}
        className="w-full rounded-md border border-border-strong bg-card px-[13px] py-[11px] text-base text-foreground placeholder:text-muted aria-invalid:border-destructive"
      />

      {failed ? (
        <FieldError>{state.fields?.["body"] ?? state.error}</FieldError>
      ) : null}

      <div className="mt-2.5 flex justify-end">
        <SubmitButton pendingLabel="Sendet…">Absenden</SubmitButton>
      </div>
    </form>
  );
}
