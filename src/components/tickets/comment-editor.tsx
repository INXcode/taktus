"use client";

import { useActionState, useId } from "react";
import { updateComment } from "@/actions/comments";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { COMMENT_MAX } from "@/lib/validation/comment";
import { type FormResult } from "@/types";

/**
 * Ein Kommentar im Berichtigungszustand.
 *
 * Bewusst dasselbe Feld wie beim Schreiben -- gleiche Maße, gleiche Grenze,
 * gleicher Rahmen. Ein Berichtigen, das anders aussieht als ein Schreiben,
 * legt einen Unterschied nahe, den es nicht gibt.
 *
 * Kein „Abbrechen" als Formularknopf, sondern ein gewöhnlicher: Er verwirft
 * nichts in der Datenbank, sondern schließt nur die Ansicht.
 */
export function CommentEditor({
  commentId,
  body,
  onDone,
}: {
  readonly commentId: string;
  readonly body: string;
  readonly onDone: () => void;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    async (previous, formData) => {
      const result = await updateComment(previous, formData);
      if (result.ok) onDone();
      return result;
    },
    null,
  );

  const fieldId = useId();
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction}>
      <input type="hidden" name="commentId" value={commentId} />

      <label htmlFor={fieldId} className="sr-only">
        Kommentar berichtigen
      </label>
      <textarea
        id={fieldId}
        name="body"
        rows={3}
        maxLength={COMMENT_MAX}
        defaultValue={body}
        {...(failed ? { "aria-invalid": true } : {})}
        className="w-full rounded-md border border-border-strong bg-card px-[13px] py-[11px] text-base text-foreground placeholder:text-muted aria-invalid:border-destructive"
      />

      {failed ? (
        <FieldError>{state.fields?.["body"] ?? state.error}</FieldError>
      ) : null}

      <div className="mt-2.5 flex justify-end gap-2.5">
        <Button variant="ghost" type="button" onClick={onDone}>
          Abbrechen
        </Button>
        <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
      </div>
    </form>
  );
}
