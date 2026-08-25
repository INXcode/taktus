"use client";

import { AiSummaryBlock } from "@/components/ai/summary-block";
import {
  AiSuggestionBlock,
  AiSuggestionRow,
} from "@/components/ai/suggestion-row";

/**
 * Das KI-Muster für den Musterkatalog.
 *
 * > [!important] Eigene Datei, und der Grund ist nicht Ordnungsliebe.
 * > `AiSuggestionRow` nimmt Rückrufe entgegen. Eine **Server**-Komponente darf
 * > einer Client-Komponente keine Funktion übergeben -- die Eigenschaften
 * > müssen serialisierbar sein, und ein `onAccept={() => {}}` direkt im
 * > Katalog liefe erst zur Laufzeit auf einen Fehler. TypeScript sieht das
 * > nicht; die Grenze ist eine des Rahmenwerks, keine des Typsystems.
 *
 * Die Rückrufe tun hier nichts. Der Katalog zeigt Formen, nicht Abläufe --
 * und in der laufenden Anwendung ist dieser Zustand mit dem ausgelieferten
 * Anbieter ohnehin nicht herbeizuführen.
 */
export function AiPatternCatalogue() {
  const nichts = () => {};

  // Dieselbe Uhrzeit wie im Übergang darunter. Zwei verschiedene Zeiten im
  // selben Beispiel lesen sich wie ein Widerspruch, obwohl beide erfunden
  // sind -- und der Katalog wird gelesen, um Formen zu vergleichen.
  const BEISPIEL_ZEITPUNKT = "2026-08-04T09:12:00.000Z";

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-semibold text-field-label">
            Kategorie
          </p>
          <p className="rounded-t-md border border-border-strong bg-card px-3 py-2.5 text-base">
            Sonstiges{" "}
            <span className="text-muted">— Ihr Wert, unverändert</span>
          </p>
          <AiSuggestionRow onAccept={nichts} onDismiss={nichts}>
            Störung
          </AiSuggestionRow>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-field-label">
            Zusammenfassung
          </p>
          <p className="rounded-t-md border border-dashed border-border-strong bg-card px-3 py-2.5 text-[13.5px] text-muted">
            Noch leer
          </p>
          <AiSuggestionBlock
            provenance="beispiel-modell · 11:12"
            onAccept={nichts}
            onDismiss={nichts}
          >
            Der Etikettendrucker zieht seit dem Morgen kein Papier ein; die
            Anzeige meldet weiterhin Bereitschaft.
          </AiSuggestionBlock>
        </div>
      </div>

      <p className="mt-5 mb-3 text-sm font-semibold text-field-label">
        Der Übergang markiert → geprüft
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <AiSummaryBlock
          summary="Der Etikettendrucker zieht kein Papier ein."
          model="beispiel-modell"
          generatedAt={BEISPIEL_ZEITPUNKT}
          unreviewed
        />
        <AiSummaryBlock
          summary="Der Etikettendrucker zieht kein Papier ein."
          model="beispiel-modell"
          generatedAt={BEISPIEL_ZEITPUNKT}
          unreviewed={false}
          reviewedBy="Kim M."
        />
      </div>
    </>
  );
}
