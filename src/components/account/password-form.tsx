"use client";

import { useActionState, useId, useState } from "react";
import { changeOwnPassword } from "@/actions/profile";
import { Notice } from "@/components/patterns/notice";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { type FormResult } from "@/types";

/**
 * Bildschirm 20 -- Passwort ändern.
 *
 * > [!note] Der Entwurf legt das hierher und **nicht** auf einen eigenen
 * > Bildschirm.
 * > Die Begründung steht im Entwurf daneben: Der Vorgang braucht das alte
 * > Passwort und gehört damit zum Konto, nicht zur Anmeldestrecke. Die
 * > Anmeldestrecke kennt den Nutzer noch nicht -- hier ist er bekannt, und
 * > genau deshalb kann etwas verlangt werden, das nur er weiss.
 *
 * Die Felder werden nach Erfolg geleert. Ein Passwort, das nach dem Speichern
 * im Feld stehen bleibt, steht dort auch noch, wenn jemand anders auf den
 * Bildschirm sieht.
 */
export function PasswordForm() {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    changeOwnPassword,
    null,
  );
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const currentId = useId();
  const nextId = useId();
  const failed = state !== null && !state.ok;

  function clear() {
    setCurrent("");
    setNext("");
  }

  // Nach einem erfolgreichen Wechsel stehen die Felder leer da. Das ist kein
  // Nebeneffekt des Zurücksetzens durch React -- auf das ist kein Verlass,
  // sobald ein Feld gesteuert ist.
  if (state?.ok && (current !== "" || next !== "")) clear();

  return (
    <form action={formAction} className="border-t border-border pt-5">
      <div className="mb-3.5">
        <SectionLabel>Passwort ändern</SectionLabel>
      </div>

      <div className="flex flex-col gap-3.5">
        {failed && state.fields === undefined ? (
          <Notice kind="error">{state.error}</Notice>
        ) : null}
        {state?.ok ? (
          <Notice kind="success">
            Das Passwort wurde geändert. Bei der nächsten Anmeldung gilt das
            neue.
          </Notice>
        ) : null}

        <Field
          id={currentId}
          label="Aktuelles Passwort"
          error={failed ? state.fields?.["currentPassword"] : undefined}
        >
          <TextInput
            id={currentId}
            name="currentPassword"
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            invalid={failed && state.fields?.["currentPassword"] !== undefined}
          />
        </Field>

        <Field
          id={nextId}
          label="Neues Passwort"
          hint={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen, mit Groß- und Kleinbuchstaben und einer Ziffer.`}
          error={failed ? state.fields?.["password"] : undefined}
        >
          <TextInput
            id={nextId}
            name="password"
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            placeholder={`Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`}
            invalid={failed && state.fields?.["password"] !== undefined}
          />
        </Field>

        <div className="flex flex-wrap gap-2.5">
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
          <Button variant="secondary" type="button" onClick={clear}>
            Abbrechen
          </Button>
        </div>
      </div>
    </form>
  );
}
