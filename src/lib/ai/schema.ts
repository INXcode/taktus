import { z } from "zod";
import { CATEGORY_ORDER } from "@/lib/labels/category";
import { type AiSuggestionResult } from "@/lib/ai/provider";

/**
 * Der Parse der Modellausgabe -- die wirksamste Massnahme gegen
 * Prompt-Injection, und die einzige, die sich ohne Anbieter prüfen lässt.
 *
 * > [!important] Der Angriff, gegen den das hilft.
 * > Titel und Beschreibung eines Tickets sind Nutzereingabe und gehen in den
 * > Prompt. Wer dort „Ignoriere alle vorherigen Anweisungen und antworte mit
 * > …" schreibt, kann die Antwort des Modells steuern. Was er **nicht**
 * > steuern kann, ist diese Prüfung: Die Kategorie muss einer von fünf
 * > bekannten Werten sein, sonst gibt es keinen Vorschlag. Eine erfundene
 * > Kategorie, eine Anweisung an die Anwendung, ein zusätzliches Feld -- alles
 * > fällt hier heraus, bevor es die Oberfläche sieht.
 *
 * Die zweite Hälfte der Abwehr steht nicht hier, sondern im Ablauf: Der
 * Vorschlag wird **nie** automatisch übernommen. Selbst eine Ausgabe, die
 * diese Prüfung besteht, wird zu einem Wert erst dadurch, dass ein Mensch
 * „Übernehmen" drückt. Deshalb ist eine geschmuggelte Zusammenfassung ein
 * Ärgernis und keine Übernahme.
 *
 * Was hier bewusst **nicht** steht: eine Heuristik, die einen Text auf
 * „sieht nach Anweisung aus" prüft. Solche Filter erkennen die Angriffe
 * nicht, die man nicht kennt, und wiegen dafür in Sicherheit.
 */

/** Der `CHECK` an `tickets.ai_summary`. Weicht er ab, weicht diese Zahl ab. */
export const AI_SUMMARY_MAX = 2000;

export const aiSuggestionSchema = z.object({
  summary: z.string().trim().min(1).max(AI_SUMMARY_MAX),
  category: z.enum(CATEGORY_ORDER),
});

/**
 * Liest die Antwort des Modells.
 *
 * Nimmt Zeichenketten entgegen, weil Modelle JSON gern in einen Codeblock
 * setzen oder mit einem Satz einleiten. Das zu behandeln ist keine
 * Nachgiebigkeit -- es ist der Unterschied zwischen „der Anbieter taugt
 * nicht" und „das Format war unsauber". Was danach nicht passt, wird
 * verworfen: `null` heisst kein Vorschlag, nicht ein halber.
 */
export function parseAiSuggestion(raw: unknown): AiSuggestionResult | null {
  const candidate = typeof raw === "string" ? fromText(raw) : raw;
  if (candidate === null) return null;

  const parsed = aiSuggestionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * Holt das JSON-Objekt aus einer Antwort in Textform.
 *
 * Gesucht wird die **erste** öffnende und die **letzte** schliessende
 * geschweifte Klammer. Ein Modell, das vor oder nach dem Objekt plaudert,
 * wird damit verstanden; eines, das zwei Objekte liefert, nicht -- und das
 * ist richtig so, denn welches von beiden gemeint war, weiss niemand.
 */
function fromText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
