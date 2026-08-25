"use client";

import { useActionState, useId, useState } from "react";
import { reviewAiSummary } from "@/actions/tickets";
import { HATCHING } from "@/components/ai/hatching";
import { Notice } from "@/components/patterns/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/format/datetime";
import { AI_SUMMARY_MAX } from "@/lib/ai/schema";
import { type FormResult } from "@/types";

/**
 * Zustand 2 -- „im Prüfen".
 *
 * > [!important] Das ist kein „Gelesen"-Knopf.
 * > Der Text ist änderbar, und mit dem Speichern gilt der Abschnitt als
 * > geprüft. Prüfen heisst hinsehen und gegebenenfalls berichtigen; ein
 * > Knopf allein belegte, dass jemand geklickt hat, nicht dass jemand
 * > hingesehen hat.
 *
 * Der Übergang bekommt eine eigene, **ruhige** Form: violette Kante statt
 * orange, kein Ausrufezeichen, keine Erfolgsmeldung. Er ist der Normalfall
 * eines sorgfältigen Vorgangs und nicht ein Ereignis, das gefeiert gehört.
 */
export function AiSummaryReviewForm({
  ticketId,
  summary,
  model,
  generatedAt,
}: {
  readonly ticketId: string;
  readonly summary: string;
  readonly model: string | null;
  readonly generatedAt: string | null;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    reviewAiSummary,
    null,
  );
  const [text, setText] = useState(summary);
  const [editing, setEditing] = useState(false);
  const fieldId = useId();
  const failed = state !== null && !state.ok;

  const provenance = [
    model,
    generatedAt === null ? null : formatDateTime(generatedAt),
  ]
    .filter((part) => part !== null)
    .join(" · ");

  if (!editing) {
    return (
      <section
        style={HATCHING}
        className="rounded-md border border-ai-border border-l-[3px] border-l-ai p-3.5"
      >
        <div className="mb-2.5 flex items-center gap-[7px]">
          <span aria-hidden="true" className="block size-[7px] bg-ai" />
          <h2 className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-ai-text uppercase">
            Von der KI, ungeprüft
          </h2>
        </div>

        <p className="rounded-[6px] border border-ai-line bg-card p-2.5 text-[13.5px] leading-[1.5] text-body">
          {text}
        </p>

        {provenance === "" ? null : (
          <p className="mt-2.5 font-mono text-[10.5px] text-ai-text">
            {provenance}
          </p>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 min-h-9 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-on-primary hover:bg-primary-hover"
        >
          Prüfen
        </button>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-md border border-primary border-l-[3px] border-l-primary bg-card p-3.5 shadow-[0_0_0_4px_var(--color-primary-soft)]"
    >
      <input type="hidden" name="ticketId" value={ticketId} />

      <div className="mb-2.5 flex items-center gap-[7px]">
        <span aria-hidden="true" className="block size-[7px] bg-primary" />
        <h2 className="font-mono text-[10.5px] font-semibold tracking-[0.06em] text-primary-text uppercase">
          Wird bearbeitet
        </h2>
      </div>

      {failed ? (
        <div className="mb-2.5">
          <Notice kind="error">
            {state.fields?.["aiSummary"] ?? state.error}
          </Notice>
        </div>
      ) : null}

      <label htmlFor={fieldId} className="sr-only">
        Zusammenfassung
      </label>
      <textarea
        id={fieldId}
        name="aiSummary"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={AI_SUMMARY_MAX}
        rows={4}
        className="w-full rounded-[6px] border border-primary bg-card p-2.5 text-[13.5px] leading-[1.5] text-foreground"
      />

      <p className="mt-2.5 text-xs text-muted">
        Mit dem Speichern gilt der Abschnitt als geprüft.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Speichert…">
          Als geprüft speichern
        </SubmitButton>
        <button
          type="button"
          onClick={() => {
            setText(summary);
            setEditing(false);
          }}
          className="min-h-[var(--size-control)] rounded-md px-3 text-base font-semibold text-muted hover:bg-muted-surface"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
