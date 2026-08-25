import { type TicketCategory } from "@/types";

/**
 * Die fünf Werte von `ticket_category`.
 *
 * Die Datenbank schreibt sie ohne Umlaut (`stoerung`); die Oberfläche nicht.
 * Das ist die einzige Stelle, an der beides zusammenkommt.
 */
export const CATEGORY_LABEL = {
  stoerung: "Störung",
  anfrage: "Anfrage",
  wartung: "Wartung",
  abrechnung: "Abrechnung",
  sonstiges: "Sonstiges",
} as const satisfies Record<TicketCategory, string>;

/**
 * Nur die Farbe des 7-px-Quadrats. Fläche und Text sind bei allen Kategorien
 * gleich neutral -- **das ist die Aussage**: Eine Kategorie ordnet ein, sie
 * warnt nicht. Der Status ist eine farbige Pille, die Kategorie ein gedecktes
 * Quadrat auf neutraler Fläche; die Form trennt die beiden Ebenen, nicht die
 * Farbe allein.
 */
export const CATEGORY_SQUARE = {
  stoerung: "bg-cat-stoerung",
  anfrage: "bg-cat-anfrage",
  wartung: "bg-cat-wartung",
  abrechnung: "bg-cat-abrechnung",
  sonstiges: "bg-cat-sonstiges",
} as const satisfies Record<TicketCategory, string>;

/** Reihenfolge in Auswahlfeldern. „Sonstiges" ist die Vorgabe und steht zuletzt. */
export const CATEGORY_ORDER = [
  "stoerung",
  "anfrage",
  "wartung",
  "abrechnung",
  "sonstiges",
] as const satisfies readonly TicketCategory[];
