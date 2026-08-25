"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { signIn } from "@/actions/auth";
import { Field, FieldError, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { paths } from "@/lib/paths";
import { type FormResult } from "@/types";

/**
 * Bildschirm 1.
 *
 * Client-Komponente allein wegen `useActionState` -- die Fehlermeldung soll
 * ohne vollständigen Seitenwechsel erscheinen und die eingegebene Adresse
 * stehen lassen. Ohne JavaScript sendet das Formular trotzdem ab; dann kommt
 * die Meldung mit der neu gerenderten Seite.
 */
export function LoginForm({ weiter }: { readonly weiter?: string }) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    signIn,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  // Gesteuert, damit die Adresse einen Fehlschlag überlebt. Ein Formular mit
  // Server Action setzt seine unkontrollierten Felder beim Absenden zurück --
  // wer sich beim Passwort vertippt, tippt sonst auch die Adresse neu.
  // Das Passwort bleibt bewusst unkontrolliert und wird geleert.
  const [email, setEmail] = useState("");

  const emailId = useId();
  const passwordId = useId();

  const failed = state !== null && !state.ok;
  const emailError = failed ? state.fields?.["email"] : undefined;
  const passwordError = failed ? state.fields?.["password"] : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {weiter !== undefined ? (
        <input type="hidden" name="weiter" value={weiter} />
      ) : null}

      {failed ? <FieldError>{state.error}</FieldError> : null}

      <Field id={emailId} label="E-Mail" error={emailError}>
        <TextInput
          id={emailId}
          name="email"
          type="email"
          autoComplete="username"
          // `required` bleibt weg: Die Browsermeldung wäre englisch und
          // stünde neben den deutschen Meldungen des Servers. Geprüft wird
          // ohnehin serverseitig.
          autoFocus
          placeholder="name@beispiel.invalid"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          // Nur dann als fehlerhaft ausgezeichnet, wenn der Fehler wirklich an
          // diesem Feld hängt. Bei „E-Mail oder Passwort stimmen nicht" weiß
          // niemand, welches von beiden es war -- beide Felder rot zu färben
          // behauptete eine Genauigkeit, die es nicht gibt, und meldete einem
          // Screenreader zwei Fehler statt einem.
          invalid={emailError !== undefined}
        />
      </Field>

      <Field
        id={passwordId}
        label="Passwort"
        error={passwordError}
        labelSuffix={
          <Link href={paths.forgotPassword} className="text-xs font-semibold">
            Vergessen?
          </Link>
        }
      >
        <div className="relative">
          <TextInput
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-20"
            invalid={passwordError !== undefined}
          />
          <button
            type="button"
            data-variant="ghost"
            onClick={() => setShowPassword((shown) => !shown)}
            className="absolute inset-y-0 right-0 rounded-md px-3 text-sm font-semibold text-primary"
          >
            {showPassword ? "Verbergen" : "Zeigen"}
          </button>
        </div>
      </Field>

      <SubmitButton pendingLabel="Meldet an…" fullWidth>
        Anmelden
      </SubmitButton>
    </form>
  );
}
