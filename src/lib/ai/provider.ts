import { type TicketCategory } from "@/types";

/**
 * Die Naht zum Sprachmodell.
 *
 * > [!important] Diese Datei beschreibt, **was** die Oberfläche erfährt --
 * > nicht, wen sie fragt.
 * > Die Anbieterwahl ist offen (siehe `docs/ki-abwaegung.md`) und gehört mit
 * > dem Auftragsverarbeitungsvertrag vor den Produktivbetrieb, nicht vor die
 * > Veröffentlichung. Gebaut wird deshalb die Naht, nicht die Anbindung: Ein
 * > Betreiber, der später einen Anbieter einsetzt, ergänzt eine Datei unter
 * > `providers/` und ändert sonst nichts.
 *
 * Die vier Zustände der Oberfläche fallen mit dieser Union zusammen, und das
 * ist Absicht -- ein fünfter Zustand im Formular müsste hier zuerst
 * entstehen.
 */

export type AiSuggestionResult = {
  readonly summary: string;
  readonly category: TicketCategory;
};

/**
 * Warum es nicht geklappt hat.
 *
 * Die drei Gründe werden **unterschieden**, weil sie unterschiedliche
 * Handlungen nahelegen: Warten, später erneut versuchen, oder den Vorschlag
 * verwerfen. Eine einzige Meldung „hat nicht geklappt" liesse den Nutzer
 * raten, und geraten wird dann meistens falsch.
 */
export type AiFailureReason =
  /**
   * Beide Freigaben stehen, aber es ist kein Anbieter angebunden -- der Stand
   * von Release 1.
   *
   * Dieser Grund existiert, weil die Alternative eine Unwahrheit wäre: Ohne
   * ihn liefe der Fall in „abgeschaltet" und die Oberfläche meldete
   * „der Betreiber hat nicht freigegeben", obwohl er das gerade getan hat.
   * Eine Fehlermeldung, die auf die falsche Stelle zeigt, kostet mehr Zeit
   * als gar keine.
   */
  "not_configured" | "unavailable" | "rate_limited" | "invalid_output";

export type AiOutcome =
  /**
   * Der Normalfall. Kein Hinweis, keine Lücke, kein leerer Kasten -- das
   * Formular sieht aus wie ein Formular. `ai_enabled` steht bei jedem
   * Mandanten per Vorgabe auf `false`, und ein Bildschirm, der ständig auf
   * eine abgeschaltete Funktion hinweist, wirbt für sie.
   */
  | { readonly status: "disabled" }
  | {
      readonly status: "ok";
      readonly result: AiSuggestionResult;
      /** Herkunftsnachweis. Ohne ihn liesse sich später nicht mehr sagen,
       *  worauf ein Vorschlag beruhte -- Art. 5 Abs. 2 DSGVO. */
      readonly model: string;
      readonly generatedAt: string;
      /**
       * Unterschrift über Text, Kategorie, Modell, Zeitpunkt und Nutzer.
       *
       * Wird **nicht** vom Anbieter gesetzt, sondern von `suggestTicketFields`
       * ergänzt -- eine Provider-Datei kann und soll das nicht können. Deshalb
       * optional: Der Vertrag der `suggest`-Methode bleibt unverändert, und
       * beim Anlegen des Tickets wird der Nachweis ohnehin geprüft, nicht
       * geglaubt. Begründung in `lib/ai/provenance.ts`.
       */
      readonly token?: string;
    }
  | { readonly status: "failed"; readonly reason: AiFailureReason };

export type AiRequest = {
  readonly title: string;
  readonly description: string;
  /** Obergrenze aus `ai_config.max_input_chars`. Datenminimierung, und
   *  zugleich die Bremse gegen ein sehr langes Ticket als Kostenhebel. */
  readonly maxInputChars: number;
};

export type AiProvider = {
  readonly name: string;
  suggest(request: AiRequest): Promise<AiOutcome>;
};

/**
 * Kürzt die Eingabe auf das erlaubte Mass.
 *
 * Gekürzt wird **vor** dem Verlassen des Hauses, nicht beim Anbieter: Was
 * nicht übermittelt wird, muss auch nicht bei einem Dritten gelöscht werden.
 * Titel und Beschreibung werden zusammen gerechnet, weil zusammen übermittelt
 * wird.
 */
export function limitInput(request: AiRequest): {
  readonly title: string;
  readonly description: string;
} {
  const title = request.title.slice(0, request.maxInputChars);
  const rest = Math.max(0, request.maxInputChars - title.length);
  return { title, description: request.description.slice(0, rest) };
}
