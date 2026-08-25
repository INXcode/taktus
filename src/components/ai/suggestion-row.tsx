"use client";

import { HATCHING } from "@/components/ai/hatching";
import { type ReactNode } from "react";

/**
 * Variante C -- der Vorschlag hängt als abgesetzte Zeile am betroffenen Feld.
 *
 * > [!important] Die Trennung leistet die Fläche, nicht die Nähe.
 * > Das ist der Einwand gegen diese Variante, und die Antwort darauf ist
 * > dreiteilig: schraffierte Fläche, eigene orange Kante mit der Marke
 * > „Vorschlag", und ein Feld darüber, das sichtbar seinen Wert behält. Fällt
 * > einer der drei weg, liest sich die angehängte Zeile als „gehört dazu" --
 * > und genau das darf sie nicht.
 *
 * Die Prüffrage aus dem Entwurf: Kann jemand, der den Bildschirm zwei
 * Sekunden sieht, den Vorschlag für einen gespeicherten Wert halten? Wer
 * hier etwas ändert, beantwortet sie neu.
 *
 * **Kein Vorbelegen.** Das Feld darüber behält seinen Wert, bis jemand
 * „Übernehmen" drückt. „Übernehmen" *ist* die menschliche Prüfung -- deshalb
 * entsteht bei der Kategorie kein Eintrag in `ai_marked_fields`.
 */
export function AiSuggestionRow({
  children,
  onAccept,
  onDismiss,
  provenance,
}: {
  /** Der vorgeschlagene Wert, als Text oder Marke. */
  readonly children: ReactNode;
  readonly onAccept: () => void;
  readonly onDismiss: () => void;
  /** Modell und Zeitpunkt. Steht offen daneben, nie in einem Aufklappbereich. */
  readonly provenance?: ReactNode;
}) {
  return (
    <div
      style={HATCHING}
      className="flex flex-wrap items-center gap-2.5 rounded-b-md border border-t-0 border-ai-border p-3"
    >
      <SuggestionTag />
      <span className="text-[13.5px] text-body">{children}</span>

      {provenance !== undefined ? (
        <span className="font-mono text-[11px] text-ai-text">{provenance}</span>
      ) : null}

      <span className="ml-auto flex gap-1.5">
        <button
          type="button"
          onClick={onAccept}
          className="min-h-9 rounded-md bg-primary px-2.5 text-[12.5px] font-semibold text-on-primary hover:bg-primary-hover"
        >
          Übernehmen
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9 rounded-md px-2.5 text-[12.5px] font-semibold text-muted hover:bg-muted-surface"
        >
          Verwerfen
        </button>
      </span>
    </div>
  );
}

/**
 * Der Vorschlag für die Zusammenfassung -- dieselbe Fläche, mehr Text.
 *
 * Eigene Komponente statt einer Zeile mit langem Inhalt: Ein Fliesstext von
 * zwei Zeilen zwischen zwei Knöpfen in einer Reihe bricht auf jeder zweiten
 * Breite anders um.
 */
export function AiSuggestionBlock({
  children,
  provenance,
  onAccept,
  onDismiss,
}: {
  readonly children: ReactNode;
  readonly provenance: ReactNode;
  readonly onAccept: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <div
      style={HATCHING}
      className="rounded-b-md border border-t-0 border-ai-border p-3"
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <SuggestionTag />
        <span className="font-mono text-[11px] text-ai-text">{provenance}</span>
      </div>

      <p className="mb-2.5 text-[13.5px] leading-[1.5] text-body">{children}</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="min-h-9 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-on-primary hover:bg-primary-hover"
        >
          Übernehmen
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9 rounded-md px-2.5 text-[12.5px] font-semibold text-muted hover:bg-muted-surface"
        >
          Verwerfen
        </button>
      </div>
    </div>
  );
}

/** Die Marke. Trägt das Wort, nicht nur die Farbe. */
function SuggestionTag() {
  return (
    <span className="rounded-sm bg-ai px-[7px] py-[3px] font-mono text-[10.5px] font-semibold tracking-[0.06em] text-on-ai uppercase">
      Vorschlag
    </span>
  );
}
