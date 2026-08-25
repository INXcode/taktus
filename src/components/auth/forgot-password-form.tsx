"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { Field, FieldError, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { paths } from "@/lib/paths";
import { type FormResult } from "@/types";

/**
 * Bildschirm 2 -- Passwort zurücksetzen, mit der Bestätigung als zweitem
 * Zustand derselben Seite.
 *
 * Die Bestätigung fällt **gleich aus, ob die Adresse existiert oder nicht**.
 * Das ist der ganze Punkt dieses Bildschirms: Eine Unterscheidung wäre eine
 * Auskunft darüber, wer hier ein Konto hat -- an jeden, der das Formular
 * abschicken kann.
 */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    requestPasswordReset,
    null,
  );
  const emailId = useId();

  if (state?.ok) {
    return (
      <>
        <p
          aria-hidden="true"
          className="mb-4 flex size-9 items-center justify-center rounded-full bg-success-soft text-lg font-bold text-success-text"
        >
          ✓
        </p>
        <h1 className="text-2xl font-bold">Prüfen Sie Ihr Postfach</h1>
        <p className="mt-3 text-base leading-[22px] text-body">
          Falls für diese Adresse ein Zugang besteht, ist eine E-Mail mit einem
          Link unterwegs. Der Link gilt 60&nbsp;Minuten.
        </p>
        <p className="mt-6">
          <Link href={paths.login} className="text-base font-semibold">
            Zurück zur Anmeldung
          </Link>
        </p>
      </>
    );
  }

  const failed = state !== null && !state.ok;

  return (
    <>
      <h1 className="text-2xl font-bold">Passwort zurücksetzen</h1>
      <p className="mt-2 mb-6 text-base text-muted">
        Wir senden einen Link an diese Adresse.
      </p>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {failed && state.fields?.["email"] === undefined ? (
          <FieldError>{state.error}</FieldError>
        ) : null}

        <Field
          id={emailId}
          label="E-Mail"
          error={failed ? state.fields?.["email"] : undefined}
        >
          <TextInput
            id={emailId}
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="name@beispiel.invalid"
            invalid={failed}
          />
        </Field>

        <SubmitButton pendingLabel="Sendet…" fullWidth>
          Link senden
        </SubmitButton>
      </form>

      <p className="mt-5">
        <Link href={paths.login} className="text-base font-semibold">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}
