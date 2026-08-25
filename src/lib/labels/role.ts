import { type AppRole } from "@/types";

/**
 * Deutsche Beschriftungen der drei Rollen.
 *
 * `satisfies Record<AppRole, string>` ist hier die eigentliche Absicherung:
 * Käme ein vierter Enum-Wert in die Datenbank, bräche `pnpm typecheck` an
 * dieser Zeile -- statt dass irgendwo ein leeres Etikett erscheint.
 */
export const ROLE_LABEL = {
  admin: "Verwaltung",
  agent: "Bearbeiter",
  requester: "Melder",
} as const satisfies Record<AppRole, string>;

/**
 * Der erklärende Satz je Rolle. Aus Bildschirm 16: Die Auswahl beschreibt,
 * was eine Rolle tut, statt ein Kürzel zu zeigen.
 */
export const ROLE_DESCRIPTION = {
  admin: "Zusätzlich Nutzer, Mandanteneinstellungen und Protokoll.",
  agent: "Bearbeitet alle Tickets, bucht eigene Zeiten, liest alle Zeiten.",
  requester:
    "Meldet Tickets und sieht nur die eigenen. Kein Zugriff auf Zeiten.",
} as const satisfies Record<AppRole, string>;
