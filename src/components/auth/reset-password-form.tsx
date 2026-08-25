"use client";

import { useActionState, useId, useState } from "react";
import { resetPassword } from "@/actions/auth";
import { Field, FieldError, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { type FormResult } from "@/types";

/**
 * Die Richtlinie steht **am Feld**, bevor jemand tippt -- nicht erst in der
 * Fehlermeldung. So verlangt es das Briefing für Bildschirm 3.
 *
 * > [!warning] Abweichung vom Entwurf, mit Grund
 * > Der Entwurf führt hier zusätzlich „Keines Ihrer letzten drei Passwörter".
 * > Eine Passwort-Historie gibt es in Supabase nicht, und in
 * > `supabase/config.toml` steht sie folglich auch nicht. Die Zeile wäre eine
 * > Zusage, die niemand einlöst -- also genau das, was dieses Projekt an
 * > anderer Stelle ausdrücklich vermeidet.
 * >
 * > Stattdessen steht hier die Regel, die **tatsächlich** durchgesetzt wird:
 * > `password_requirements = "lower_upper_letters_digits"`. Der Entwurf nennt
 * > sie nicht, der Auth-Server lehnt aber danach ab.
 */
const RULES: readonly {
  readonly label: string;
  readonly test: (value: string) => boolean;
}[] = [
  {
    label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: "Groß- und Kleinbuchstaben",
    test: (value) => /\p{Ll}/u.test(value) && /\p{Lu}/u.test(value),
  },
  {
    label: "Mindestens eine Ziffer",
    test: (value) => /\d/u.test(value),
  },
];

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    resetPassword,
    null,
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const passwordId = useId();
  const repeatId = useId();
  const rulesId = useId();

  const failed = state !== null && !state.ok;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {failed && state.fields === undefined ? (
        <FieldError>{state.error}</FieldError>
      ) : null}

      <div>
        <Field
          id={passwordId}
          label="Neues Passwort"
          error={failed ? state.fields?.["password"] : undefined}
        >
          <div className="relative">
            <TextInput
              id={passwordId}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-describedby={rulesId}
              className="pr-20"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              invalid={failed && state.fields?.["password"] !== undefined}
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

        <ul id={rulesId} className="mt-2.5 flex flex-col gap-1.5">
          {RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-sm ${met ? "text-success-text" : "text-muted"}`}
              >
                <span aria-hidden="true" className="font-bold">
                  ✓
                </span>
                <span>{rule.label}</span>
                {/* Für Screenreader: das Häkchen allein sagt nichts aus. */}
                <span className="sr-only">
                  {met ? " — erfüllt" : " — noch offen"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <Field
        id={repeatId}
        label="Wiederholen"
        error={failed ? state.fields?.["passwordRepeat"] : undefined}
      >
        <TextInput
          id={repeatId}
          name="passwordRepeat"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          invalid={failed && state.fields?.["passwordRepeat"] !== undefined}
        />
      </Field>

      <SubmitButton pendingLabel="Speichert…" fullWidth>
        Passwort speichern
      </SubmitButton>
    </form>
  );
}
