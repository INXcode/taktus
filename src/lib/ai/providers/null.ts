import { type AiOutcome, type AiProvider } from "@/lib/ai/provider";

/**
 * Der Anbieter, der nichts überträgt -- und der einzige in Release 1.
 *
 * > [!important] Das ist kein Platzhalter, den jemand vergessen hat.
 * > Die Anbieterwahl ist offen: `docs/ki-abwaegung.md` hält den Zwischenstand
 * > fest -- ein lokal betriebenes Modell wurde erprobt und reichte auf der
 * > vorhandenen Hardware nicht. Die Wahl und der Auftragsverarbeitungsvertrag
 * > gehören vor den **Produktivbetrieb**, nicht vor die Veröffentlichung.
 * >
 * > Bis dahin ist „nichts übertragen" die einzige Antwort, die sich
 * > verantworten lässt. Ein voreingestellter Anbieter im veröffentlichten
 * > Stand wäre eine Übermittlung an einen Dritten, die niemand entschieden
 * > hat -- und genau davor schützt die doppelte Freigabe (Betreiber und
 * > Mandant) an anderer Stelle.
 *
 * Wer einen Anbieter anbindet, legt eine Datei daneben und trägt sie in
 * `registry.ts` ein. Diese Naht ist der ganze Aufwand -- das ist der Zweck
 * der Übung.
 */
export const NULL_PROVIDER_NAME = "null";

export const nullProvider: AiProvider = {
  name: NULL_PROVIDER_NAME,

  /**
   * Antwortet `not_configured` und **nicht** `disabled`.
   *
   * Der Unterschied ist keine Feinheit: `disabled` heisst „jemand hat es
   * abgeschaltet", und die Oberfläche zeigt dann auf den Schalter des
   * Betreibers. Hat der gerade freigegeben, zeigte sie auf die falsche
   * Stelle. Erreicht wird dieser Zweig ohnehin nicht -- die Action fängt den
   * Fall vorher ab, weil sonst ein Protokolleintrag über eine Übermittlung
   * entstünde, die es nicht gab.
   */
  suggest(): Promise<AiOutcome> {
    return Promise.resolve({ status: "failed", reason: "not_configured" });
  },
};
