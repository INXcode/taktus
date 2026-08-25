"use client";

import { useState } from "react";
import { describeDuration, parseDuration } from "@/lib/format/duration";

/** Abkürzungen, kein Ersatz für das Feld -- sie schreiben nur hinein. */
const QUICK_VALUES = [15, 30, 45, 60, 90] as const;

/**
 * Das Dauerfeld aus Bildschirm 12.
 *
 * > „‚90' ist schneller als ‚1:30', aber ‚1,5 h' ist das, was Menschen
 * > denken."
 *
 * Deshalb nimmt das Feld alle drei Schreibweisen und zeigt **laufend** an,
 * was gespeichert wird. Die Zeile darunter ist der eigentliche Zweck: Wer
 * „1,5 h" tippt, sieht 90 Minuten, bevor er speichert -- nicht erst als
 * Fehlermeldung danach.
 *
 * Das Rechnen selbst steht in `parseDuration` und ist dort getestet. Diese
 * Komponente hält nur den Text und zeigt das Ergebnis; die Prüfung, die
 * zählt, läuft noch einmal serverseitig im Zod-Schema.
 *
 * **Kein Timer, kein Start/Stopp.** `time_entries` speichert Minuten und
 * einen Tag, keine Zeitpunkte -- minutengenaue Zeitpunkte erlaubten die
 * Rekonstruktion von Arbeitsbeginn, Pausenlage und Arbeitsende.
 */
export function DurationInput({
  id,
  defaultValue = "",
  invalid = false,
  describedBy,
}: {
  readonly id: string;
  readonly defaultValue?: string;
  readonly invalid?: boolean;
  readonly describedBy?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const parse = parseDuration(value);
  const hint = describeDuration(parse);

  const tone =
    parse.kind === "ok"
      ? "text-success-text"
      : parse.kind === "empty"
        ? "text-muted"
        : "text-destructive-text";

  return (
    <div>
      <input
        id={id}
        name="duration"
        type="text"
        inputMode="text"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={`${id}-umrechnung${describedBy ? ` ${describedBy}` : ""}`}
        {...(invalid ? { "aria-invalid": true } : {})}
        className="w-full rounded-md border border-border-strong bg-card px-[13px] py-3 font-mono text-lg text-foreground min-h-[46px] aria-invalid:border-destructive"
      />

      {/*
        `aria-live="polite"`: Die Umrechnung ändert sich beim Tippen, und wer
        das Feld nicht sieht, bekommt sie sonst nie mit. „polite" statt
        „assertive", damit sie nicht jedes Zeichen unterbricht.
      */}
      <p
        id={`${id}-umrechnung`}
        aria-live="polite"
        className={`mt-2 flex min-h-5 items-start gap-1.5 text-sm leading-[1.45] ${tone}`}
      >
        {hint === null ? null : (
          <>
            <span aria-hidden="true" className="font-bold">
              =
            </span>
            <span>{hint}</span>
          </>
        )}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_VALUES.map((minutes) => {
          const active = parse.kind === "ok" && parse.minutes === minutes;
          return (
            <button
              key={minutes}
              type="button"
              onClick={() => setValue(String(minutes))}
              aria-pressed={active}
              className={`min-h-8 rounded-full border px-3 font-mono text-[12.5px] ${
                active
                  ? "border-primary bg-primary-soft text-primary-text"
                  : "border-border-strong bg-card text-body hover:bg-subtle"
              }`}
            >
              {minutes}
            </button>
          );
        })}
      </div>
    </div>
  );
}
