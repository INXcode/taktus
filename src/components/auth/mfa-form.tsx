"use client";

import { useActionState, useId, useRef, useState } from "react";
import { verifyMfaCode } from "@/actions/auth";
import { FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { type FormResult } from "@/types";

const DIGITS = 6;

/**
 * Bildschirm 4 -- Bestätigungscode (TOTP).
 *
 * Sechs Einzelfelder statt eines Feldes, wie im Entwurf. Der Grund, warum das
 * hier überhaupt Code braucht: Wer einen sechsstelligen Code aus einer App
 * kopiert, fügt ihn als **einen** Wert ein. Sechs Felder, von denen das erste
 * dann „123456" enthält und die übrigen leer bleiben, sind ein Ärgernis, das
 * man erst beim Benutzen bemerkt. `onPaste` verteilt ihn deshalb.
 */
export function MfaForm() {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    verifyMfaCode,
    null,
  );
  const [digits, setDigits] = useState<readonly string[]>(
    Array.from({ length: DIGITS }, () => ""),
  );
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const groupId = useId();

  const failed = state !== null && !state.ok;

  function write(index: number, value: string) {
    const clean = value.replace(/\D/gu, "");
    setDigits((current) => {
      const next = [...current];
      next[index] = clean.slice(-1);
      return next;
    });
    if (clean !== "") {
      inputs.current[index + 1]?.focus();
    }
  }

  function distribute(index: number, pasted: string) {
    const clean = pasted.replace(/\D/gu, "").slice(0, DIGITS - index);
    if (clean === "") return;
    setDigits((current) => {
      const next = [...current];
      for (let offset = 0; offset < clean.length; offset += 1) {
        next[index + offset] = clean[offset] ?? "";
      }
      return next;
    });
    inputs.current[Math.min(index + clean.length, DIGITS - 1)]?.focus();
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="code" value={digits.join("")} />

      {failed ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <p
          id={groupId}
          className="mb-1.5 text-sm font-semibold text-field-label"
        >
          Code
        </p>
        <div
          role="group"
          aria-labelledby={groupId}
          className="flex gap-2 sm:gap-2.5"
        >
          {digits.map((digit, index) => (
            <input
              // Die Stellen sind fest und unvertauschbar -- der Index ist hier
              // ausnahmsweise ein stabiler Schlüssel.
              key={index}
              ref={(element) => {
                inputs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              aria-label={`Stelle ${index + 1} von ${DIGITS}`}
              value={digit}
              autoFocus={index === 0}
              onChange={(event) => write(index, event.target.value)}
              onPaste={(event) => {
                event.preventDefault();
                distribute(index, event.clipboardData.getData("text"));
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && digit === "") {
                  inputs.current[index - 1]?.focus();
                }
              }}
              {...(failed ? { "aria-invalid": true } : {})}
              className="h-12 w-full rounded-md border border-border-strong bg-card text-center font-mono text-xl text-foreground aria-invalid:border-destructive sm:h-[52px]"
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Einfügen aus der Zwischenablage verteilt den Code auf alle sechs
          Stellen.
        </p>
      </div>

      <SubmitButton pendingLabel="Prüft…" fullWidth>
        Bestätigen
      </SubmitButton>
    </form>
  );
}
