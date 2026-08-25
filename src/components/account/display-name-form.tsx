"use client";

import { useActionState, useId, useState } from "react";
import { updateOwnDisplayName } from "@/actions/profile";
import { Notice } from "@/components/patterns/notice";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISPLAY_NAME_MAX } from "@/lib/validation/profile";
import { type FormResult } from "@/types";

/**
 * Bildschirm 20 -- der eigene Anzeigename.
 *
 * Gesteuert, aus demselben Grund wie die Mandanteneinstellungen: React setzt
 * ein Formular nach der Action zurück, und die abgelehnte Eingabe verschwände
 * sonst genau dann, wenn daneben steht, was an ihr falsch war.
 */
export function DisplayNameForm({
  displayName,
}: {
  readonly displayName: string;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    updateOwnDisplayName,
    null,
  );
  const [name, setName] = useState(displayName);
  const fieldId = useId();
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {failed && state.fields === undefined ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}
      {state?.ok ? <Notice kind="success">Gespeichert.</Notice> : null}

      <Field
        id={fieldId}
        label="Anzeigename"
        hint={`Erscheint in Listen, Kommentaren und im Protokoll. 1–${DISPLAY_NAME_MAX} Zeichen.`}
        error={failed ? state.fields?.["displayName"] : undefined}
      >
        <TextInput
          id={fieldId}
          name="displayName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          invalid={failed && state.fields?.["displayName"] !== undefined}
        />
      </Field>

      <div>
        <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
      </div>
    </form>
  );
}
