import { type ZodError } from "zod";
import { type FieldErrors, type FormResult } from "@/types";

/**
 * Hilfen um `FormResult`. Klein, aber an einer Stelle -- sonst formuliert
 * jede Action ihre eigene Fassung derselben Rückgabe.
 */

export function ok<T>(data: T): FormResult<T> {
  return { ok: true, data };
}

export function fail<T = void>(error: string): FormResult<T> {
  return { ok: false, error };
}

/**
 * Übersetzt einen Zod-Fehler in die Zuordnung Feld → Meldung.
 *
 * Je Feld bleibt die **erste** Meldung stehen. Drei Zeilen unter einem
 * Passwortfeld („zu kurz", „kein Großbuchstabe", „keine Ziffer") sind eine
 * Aufgabenliste, keine Rückmeldung.
 */
export function fieldFail<T = void>(
  error: ZodError,
  message = "Bitte prüfen Sie die markierten Felder.",
): FormResult<T> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in fields)) {
      fields[key] = issue.message;
    }
  }

  return { ok: false, error: message, fields: fields as FieldErrors };
}
