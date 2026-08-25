"use client";

import { useFormStatus } from "react-dom";
import { Button, Spinner, type ButtonVariant } from "@/components/ui/button";

/**
 * Absendeknopf mit Ladezustand.
 *
 * Der einzige Grund, warum `Button` selbst eine Server-Komponente bleiben
 * kann: `useFormStatus` braucht den Browser, der Knopf sonst nicht.
 *
 * `pending` kommt vom umgebenden `<form>`, nicht aus eigenem Zustand. Damit
 * stimmt die Anzeige auch dann, wenn das Formular ohne JavaScript abgeschickt
 * wird — dann gibt es schlicht keinen Ladezustand, statt eines falschen.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  fullWidth = false,
}: {
  readonly children: string;
  readonly pendingLabel: string;
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      fullWidth={fullWidth}
      loading={pending}
      onClick={(event) => {
        // Der Knopf bleibt während des Sendens fokussierbar -- gesperrt wird
        // nur das Auslösen. `preventDefault` fängt auch Leertaste und
        // Eingabetaste ab, weil beide auf einem <button> ein Klickereignis
        // erzeugen.
        if (pending) event.preventDefault();
      }}
    >
      {pending ? (
        <>
          <Spinner variant={variant} />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
