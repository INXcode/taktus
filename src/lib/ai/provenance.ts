import "server-only";

import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { supabaseServiceRoleKey } from "@/lib/env";
import { CATEGORY_ORDER } from "@/lib/labels/category";
import { type TicketCategory } from "@/types";

/**
 * Nachweisbare Herkunft eines Modellvorschlags.
 *
 * > [!important] Das Problem, das diese Datei löst.
 * > `suggestTicketFields` liefert den Vorschlag an den Browser, der Browser
 * > schickt ihn beim Anlegen zurück. Zwischen beiden Schritten liegt der
 * > Rechner des Nutzers -- der Server sieht am eingehenden Formular nicht, ob
 * > der Text vom Modell stammt oder selbst getippt wurde.
 * >
 * > Ohne Nachweis war `ai_marked_fields` deshalb eine **Behauptung des
 * > Absenders**, und `ai_model`/`ai_generated_at` blieben leer -- obwohl das
 * > Schema sie ausdrücklich als Herkunftsnachweis für die Rechenschaftspflicht
 * > nach Art. 5 Abs. 2 DSGVO führt. Ein Datensatz sagte „von der KI,
 * > ungeprüft" und konnte nicht sagen, von welcher.
 *
 * Der Vorschlag wird deshalb beim Ausliefern **signiert**. Wer ihn
 * zurückschickt, liefert den Nachweis mit; erst eine gültige Signatur schreibt
 * `ai_summary`, `ai_model`, `ai_generated_at` und die Kennzeichnung. Ohne
 * Nachweis wird die Zusammenfassung abgewiesen, nicht etwa ungekennzeichnet
 * gespeichert -- ein unmarkierter Modelltext wäre das schlechtere Ergebnis.
 *
 * Gebunden wird an **vier** Dinge, und jedes hat einen Grund:
 *
 * | Bindung        | Verhindert                                              |
 * | -------------- | ------------------------------------------------------- |
 * | Textinhalt     | den Nachweis auf einen anderen Text umhängen            |
 * | Kategorie      | dasselbe für die Einordnung                             |
 * | Nutzerkennung  | den Nachweis an jemand anderen weiterreichen            |
 * | Ablaufzeitpunkt| einen Vorrat an Nachweisen für später anlegen           |
 */

/**
 * Wie lange ein Nachweis gilt.
 *
 * Grosszügig genug für ein Ticket, das jemand in Ruhe zu Ende schreibt, und
 * kurz genug, dass sich kein Vorrat anlegen lässt. Ein Vorschlag, der älter
 * ist, wird nicht falsch -- er wird nur nicht mehr als frisch bezeugt, und der
 * Nutzer holt sich einen neuen.
 */
const GUELTIGKEIT_MS = 30 * 60 * 1000;

/**
 * Schlüsselableitung statt Schlüsselwiederverwendung.
 *
 * Das Ausgangsmaterial ist der Service-Role-Schlüssel -- serverseitig,
 * hochentropisch und ohnehin vorhanden, also keine zusätzliche Variable, die
 * ein Betreiber setzen und verwahren muss. HKDF mit fester Kennung trennt den
 * abgeleiteten Schlüssel sauber vom Original: Aus ihm lässt sich der
 * Service-Role-Schlüssel nicht zurückrechnen, und er taugt nirgendwo sonst.
 *
 * > [!note] Folge einer Schlüsselrotation
 * > Wird der Service-Role-Schlüssel getauscht, verlieren ausstehende Nachweise
 * > ihre Gültigkeit. Bei 30 Minuten Laufzeit heisst das: Wer in genau dem
 * > Moment ein Ticket offen hat, holt den Vorschlag einmal neu. Kein
 * > Datenverlust, kein Eingriff nötig.
 *
 * Ein Betreiber, der die Ableitung nicht mag, ersetzt diese eine Funktion
 * durch eine eigene Variable -- der Rest der Datei bleibt, wie er ist.
 */
function schluessel(): Buffer {
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(supabaseServiceRoleKey(), "utf8"),
      Buffer.alloc(0),
      Buffer.from("taktus/ki-herkunftsnachweis/v1", "utf8"),
      32,
    ),
  );
}

/** Was der Nachweis bezeugt. */
export type AiProvenance = {
  readonly model: string;
  readonly generatedAt: string;
};

type Nutzlast = {
  /** Streuwert des Textes -- der Text selbst gehört nicht in den Nachweis. */
  readonly s: string;
  readonly c: TicketCategory;
  readonly m: string;
  readonly g: string;
  readonly u: string;
  readonly e: number;
};

function textStreuwert(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("base64url");
}

function unterschreiben(nutzlast: string): string {
  return createHmac("sha256", schluessel())
    .update(nutzlast, "utf8")
    .digest("base64url");
}

/**
 * Stellt den Nachweis aus. Aufgerufen beim Ausliefern des Vorschlags.
 *
 * `jetzt` ist ein Parameter und keine Konstante, damit der Ablauf prüfbar ist,
 * ohne die Uhr des Rechners zu verstellen.
 */
export function signSuggestion(
  eingabe: {
    readonly summary: string;
    readonly category: TicketCategory;
    readonly model: string;
    readonly generatedAt: string;
    readonly userId: string;
  },
  jetzt: number = Date.now(),
): string {
  const nutzlast: Nutzlast = {
    s: textStreuwert(eingabe.summary),
    c: eingabe.category,
    m: eingabe.model,
    g: eingabe.generatedAt,
    u: eingabe.userId,
    e: jetzt + GUELTIGKEIT_MS,
  };

  const kodiert = Buffer.from(JSON.stringify(nutzlast), "utf8").toString(
    "base64url",
  );
  return `${kodiert}.${unterschreiben(kodiert)}`;
}

/**
 * Prüft den Nachweis. Gibt die bezeugte Herkunft zurück -- oder `null`.
 *
 * `null` heisst in jedem Fall dasselbe: Dieser Text ist kein bezeugter
 * Modellvorschlag. Die Gründe werden **nicht** unterschieden, und das ist
 * Absicht -- eine Rückmeldung „Signatur falsch" gegen „abgelaufen" wäre ein
 * Hinweis für den, der daran herumprobiert.
 */
export function verifySuggestion(
  token: string,
  erwartet: {
    readonly summary: string;
    readonly category: TicketCategory;
    readonly userId: string;
  },
  jetzt: number = Date.now(),
): AiProvenance | null {
  const teile = token.split(".");
  if (teile.length !== 2) return null;

  const [kodiert, unterschrift] = teile;
  if (kodiert === undefined || unterschrift === undefined) return null;

  // Zeitunabhängiger Vergleich. Beide Seiten müssen dieselbe Länge haben,
  // sonst wirft `timingSafeEqual` -- die Längenprüfung steht deshalb davor
  // und ist selbst unkritisch, weil die Länge einer HMAC-Ausgabe fest ist.
  const erwarteteUnterschrift = Buffer.from(unterschreiben(kodiert), "utf8");
  const gelieferteUnterschrift = Buffer.from(unterschrift, "utf8");
  if (erwarteteUnterschrift.length !== gelieferteUnterschrift.length) {
    return null;
  }
  if (!timingSafeEqual(erwarteteUnterschrift, gelieferteUnterschrift)) {
    return null;
  }

  let nutzlast: unknown;
  try {
    nutzlast = JSON.parse(Buffer.from(kodiert, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof nutzlast !== "object" || nutzlast === null) return null;
  const n = nutzlast as Partial<Nutzlast>;

  if (
    typeof n.s !== "string" ||
    typeof n.c !== "string" ||
    typeof n.m !== "string" ||
    typeof n.g !== "string" ||
    typeof n.u !== "string" ||
    typeof n.e !== "number"
  ) {
    return null;
  }

  if (n.e <= jetzt) return null;
  if (n.u !== erwartet.userId) return null;
  if (n.c !== erwartet.category) return null;
  if (!CATEGORY_ORDER.includes(n.c as TicketCategory)) return null;

  // Der Textvergleich ebenfalls zeitunabhängig: Beide Streuwerte haben feste
  // Länge, ein früher Abbruch verriete sonst die Länge des gemeinsamen
  // Präfixes.
  const erwarteterStreuwert = Buffer.from(
    textStreuwert(erwartet.summary),
    "utf8",
  );
  const bezeugterStreuwert = Buffer.from(n.s, "utf8");
  if (erwarteterStreuwert.length !== bezeugterStreuwert.length) return null;
  if (!timingSafeEqual(erwarteterStreuwert, bezeugterStreuwert)) return null;

  return { model: n.m, generatedAt: n.g };
}
