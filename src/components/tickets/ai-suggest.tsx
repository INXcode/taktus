"use client";

import { useState, useTransition } from "react";
import { suggestTicketFields } from "@/actions/ai";
import {
  AiSuggestionBlock,
  AiSuggestionRow,
} from "@/components/ai/suggestion-row";
import { Notice } from "@/components/patterns/notice";
import { CATEGORY_LABEL } from "@/lib/labels/category";
import { formatTime } from "@/lib/format/datetime";
import { type AiFailureReason, type AiOutcome } from "@/lib/ai/provider";
import { type TicketCategory } from "@/types";

/**
 * Der KI-Teil von Bildschirm 8 -- die vier Zustände.
 *
 * | Zustand        | Was zu sehen ist                                    |
 * | -------------- | --------------------------------------------------- |
 * | abgeschaltet   | **nichts.** Keine Lücke, kein Kasten, kein Hinweis  |
 * | nicht gefragt  | ein Knopf, der fragt                                |
 * | Vorschlag da   | Variante C an Kategorie und Zusammenfassung          |
 * | fehlgeschlagen | ein Satz, der sagt was los ist -- ohne Schuldzuweisung |
 *
 * > [!important] Der abgeschaltete Zustand ist der Normalfall.
 * > `tenants.ai_enabled` steht per Vorgabe auf `false`. Ein Formular, das
 * > ständig auf eine abgeschaltete Funktion hinweist, wirbt für sie -- und
 * > eine Übermittlung an Dritte soll nicht dadurch entstehen, dass jemand des
 * > Hinweises müde wird.
 */
export function AiSuggest({
  enabled,
  title,
  description,
  category,
  onAcceptCategory,
  onAcceptSummary,
}: {
  /** Freigabe des Mandanten. Ist sie aus, rendert diese Komponente nichts. */
  readonly enabled: boolean;
  readonly title: string;
  readonly description: string;
  readonly category: TicketCategory;
  readonly onAcceptCategory: (category: TicketCategory) => void;
  /**
   * Der Nachweis reist mit dem Text.
   *
   * Beides gehört zusammen und darf nicht getrennt im Formular landen: Ein
   * Text ohne Nachweis wird beim Anlegen abgewiesen, ein Nachweis ohne den
   * dazugehörigen Text passt auf nichts. Deshalb ein Rückruf mit zwei
   * Werten statt zwei Rückrufen.
   */
  readonly onAcceptSummary: (summary: string, token: string) => void;
}) {
  const [outcome, setOutcome] = useState<AiOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState({
    category: false,
    summary: false,
  });

  if (!enabled) return null;

  function ask() {
    setDismissed({ category: false, summary: false });
    startTransition(async () => {
      setOutcome(await suggestTicketFields({ title, description }));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {outcome === null || outcome.status !== "ok" ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={ask}
            disabled={pending || title.trim() === ""}
            className="min-h-[var(--size-control)] rounded-md border border-border-strong bg-card px-4 text-base font-semibold text-body hover:border-primary hover:bg-subtle disabled:border-border disabled:text-text-disabled"
          >
            {pending ? "Fragt…" : "Zusammenfassung vorschlagen"}
          </button>
          <span className="text-[12.5px] text-muted">
            Titel und Beschreibung werden dabei an ein Sprachmodell übermittelt.
            Der Vorschlag wird nie automatisch übernommen.
          </span>
        </div>
      ) : null}

      {outcome?.status === "failed" ? (
        <Notice kind="info">{failureText(outcome.reason)}</Notice>
      ) : null}

      {outcome?.status === "disabled" && !pending ? (
        // Kann eintreten, obwohl der Mandant zugestimmt hat: Dann steht der
        // Schalter des Betreibers auf „aus". Der Satz sagt das, statt den
        // Knopf wirkungslos wirken zu lassen.
        <Notice kind="info">
          Die Funktion ist beim Betreiber dieser Instanz nicht freigegeben. Es
          wurde nichts übermittelt.
        </Notice>
      ) : null}

      {outcome?.status === "ok" ? (
        <div className="flex flex-col gap-4">
          {dismissed.category || outcome.result.category === category ? null : (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-field-label">
                Kategorie
              </p>
              {/*
                Das Feld darüber steht im Formular und behält sichtbar seinen
                Wert -- hier steht nur der Vorschlag. Genau diese Trennung
                trägt die Variante C.
              */}
              <p className="rounded-t-md border border-border-strong bg-card px-3 py-2.5 text-base">
                {CATEGORY_LABEL[category]}{" "}
                <span className="text-muted">— Ihr Wert, unverändert</span>
              </p>
              <AiSuggestionRow
                onAccept={() => {
                  onAcceptCategory(outcome.result.category);
                  setDismissed((d) => ({ ...d, category: true }));
                }}
                onDismiss={() =>
                  setDismissed((d) => ({ ...d, category: true }))
                }
              >
                {CATEGORY_LABEL[outcome.result.category]}
              </AiSuggestionRow>
            </div>
          )}

          {dismissed.summary ? null : (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-field-label">
                Zusammenfassung
              </p>
              <p className="rounded-t-md border border-dashed border-border-strong bg-card px-3 py-2.5 text-[13.5px] text-muted">
                Noch leer
              </p>
              <AiSuggestionBlock
                provenance={`${outcome.model} · ${formatTime(outcome.generatedAt)}`}
                onAccept={() => {
                  onAcceptSummary(outcome.result.summary, outcome.token ?? "");
                  setDismissed((d) => ({ ...d, summary: true }));
                }}
                onDismiss={() => setDismissed((d) => ({ ...d, summary: true }))}
              >
                {outcome.result.summary}
              </AiSuggestionBlock>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Die drei Gründe werden unterschieden, weil sie unterschiedliche Handlungen
 * nahelegen. Keiner der Sätze beschuldigt den Nutzer, und keiner verspricht,
 * dass ein erneuter Versuch klappt.
 */
function failureText(reason: AiFailureReason) {
  switch (reason) {
    case "not_configured":
      return "Für diese Instanz ist kein Sprachmodell angebunden. Es wurde nichts übermittelt — das Ticket lässt sich ganz normal anlegen.";
    case "unavailable":
      return "Das Sprachmodell war nicht erreichbar. Sie können ohne Vorschlag fortfahren — das Ticket lässt sich ganz normal anlegen.";
    case "rate_limited":
      return "Es wurden zu viele Anfragen gestellt. Versuchen Sie es später noch einmal oder fahren Sie ohne Vorschlag fort.";
    case "invalid_output":
      return "Die Antwort war nicht verwertbar und wurde verworfen. Das ist die eingebaute Prüfung — es wurde nichts übernommen.";
  }
}
