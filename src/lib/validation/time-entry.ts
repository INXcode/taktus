import { z } from "zod";
import { MINUTES_MAX, MINUTES_MIN, parseDuration } from "@/lib/format/duration";
import { isWithinWorkedOnRange } from "@/lib/format/datetime";

/**
 * Zeitbuchungen.
 *
 * `ticket_id` ist **Pflicht** -- ticketfreie Buchungen gibt es nicht, und die
 * Spalte ist `NOT NULL`. Das ist eine Entscheidung aus dem Funktionsschnitt:
 * Ticketfreies Buchen ist ein Eigenbedarfsthema und gehört nach Release 2.
 */
export const NOTE_MAX = 2_000;

/**
 * Die Dauer kommt als **Text** herein, nicht als Zahl.
 *
 * Das Feld nimmt „90", „1:30" und „1,5 h" entgegen; die Umrechnung gehört
 * deshalb in die Prüfung und nicht in die Oberfläche. Käme hier bereits eine
 * Zahl an, hätte der Browser sie ausgerechnet -- und was der Browser rechnet,
 * prüft niemand.
 */
export const durationFieldSchema = z.string().transform((value, ctx) => {
  const parse = parseDuration(value);

  if (parse.kind === "empty") {
    ctx.addIssue({ code: "custom", message: "Bitte eine Dauer eingeben." });
    return z.NEVER;
  }
  if (parse.kind === "invalid") {
    ctx.addIssue({
      code: "custom",
      message: "Nicht erkannt. Möglich sind etwa 90, 1:30 oder 1,5 h.",
    });
    return z.NEVER;
  }
  if (parse.kind === "outOfRange") {
    ctx.addIssue({
      code: "custom",
      message:
        parse.minutes < MINUTES_MIN
          ? "Mindestens eine Minute je Buchung."
          : `Höchstens ${MINUTES_MAX} Minuten (24 Stunden) je Buchung — bitte auf mehrere Tage aufteilen.`,
    });
    return z.NEVER;
  }

  return parse.minutes;
});

/**
 * Der Tag, an dem gearbeitet wurde -- ein Datum ohne Uhrzeit.
 *
 * Höchstens einen Tag in der Zukunft, wie der `CHECK` der Tabelle. Die Grenze
 * steht als Hilfstext am Feld, bevor ein Fehler entsteht.
 */
export const workedOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, "Bitte ein Datum wählen.")
  .refine(
    (value) => isWithinWorkedOnRange(value),
    "Höchstens ein Tag in der Zukunft.",
  );

export const timeEntrySchema = z.object({
  ticketId: z.uuid({ message: "Bitte ein Ticket wählen." }),
  duration: durationFieldSchema,
  workedOn: workedOnSchema,
  note: z.string().max(NOTE_MAX, `Höchstens ${NOTE_MAX} Zeichen.`),
});

export const updateTimeEntrySchema = z.object({
  entryId: z.uuid({ message: "Ungültige Buchungskennung." }),
  duration: durationFieldSchema,
  workedOn: workedOnSchema,
  note: z.string().max(NOTE_MAX, `Höchstens ${NOTE_MAX} Zeichen.`),
});

export const deleteTimeEntrySchema = z.object({
  entryId: z.uuid({ message: "Ungültige Buchungskennung." }),
});
