import { paths } from "@/lib/paths";
import { type AppRole } from "@/types";

/**
 * Die Navigation als reine Daten.
 *
 * Sie steht hier und nicht in einer Komponente, weil sie eine
 * Sicherheitsaussage trägt und deshalb prüfbar sein muss:
 *
 * > Rollen bauen die Navigation, nicht Rechte im Knopf. Was eine Rolle nicht
 * > darf, steht nicht da — auch nicht ausgegraut.
 *
 * Das ist keine Geschmacksfrage. Ein ausgegrauter Punkt verrät Struktur, die
 * den Melder nichts angeht, und verleitet dazu, die Berechtigung in der
 * Oberfläche zu vermuten statt im Server. `navigation.test.ts` schreibt die
 * Regel als Zusicherung fest.
 *
 * Die Navigation ist **keine** Zugriffskontrolle. Wer eine Adresse direkt
 * eintippt, kommt an ihr vorbei -- dafür steht `requireRole()` in jeder Seite
 * und darunter die RLS.
 */

export type NavItem = {
  readonly label: string;
  readonly href: string;
};

export type NavGroup = {
  /** Mono-Überschrift über der Gruppe. Fehlt sie, steht die Gruppe ohne. */
  readonly title?: string;
  readonly items: readonly NavItem[];
};

// Ein Punkt „Zeiten", nicht drei. Die drei Ansichten -- eigene, gesamte, nach
// Kunde -- sind Sichten auf denselben Bestand und stehen deshalb als
// Reiterleiste nebeneinander (`TimeTabs`), nicht untereinander im Menü. Der
// Punkt führt auf die eigene Ansicht: Sie ist die einzige, die jeder
// Bearbeiter täglich braucht.
const WORK_ITEMS: readonly NavItem[] = [
  { label: "Tickets", href: paths.tickets },
  { label: "Zeiten", href: paths.myTime },
];

const ADMIN_ITEMS: readonly NavItem[] = [
  // Kunden vor Nutzern: Ein Melder lässt sich erst anlegen, wenn es einen
  // Kunden gibt, zu dem er gehören kann. Die Reihenfolge im Menü folgt der
  // Reihenfolge beim Einrichten.
  { label: "Kunden", href: paths.customers },
  { label: "Nutzer", href: paths.members },
  { label: "Mandant", href: paths.tenantSettings },
  { label: "Protokoll", href: paths.auditLog },
];

export function navigationForRole(role: AppRole): readonly NavGroup[] {
  switch (role) {
    case "admin":
      return [
        { title: "Arbeit", items: WORK_ITEMS },
        { title: "Verwaltung", items: ADMIN_ITEMS },
      ];
    case "agent":
      // Kein Abschnitt „Verwaltung". Nicht ausgegraut -- nicht vorhanden.
      return [{ title: "Arbeit", items: WORK_ITEMS }];
    case "requester":
      // Zwei Punkte, keine Abschnittsüberschrift: Bei zwei Zielen wäre eine
      // Gliederung Beiwerk. Kein Zeit-, kein Protokoll-, kein
      // Verwaltungspunkt. „Meine Meldungen" zeigt auf dieselbe Adresse wie
      // „Tickets" -- die Seite verzweigt serverseitig nach Rolle, damit ein
      // Lesezeichen eines Melders nicht auf 403 läuft.
      return [
        {
          items: [
            { label: "Meine Meldungen", href: paths.tickets },
            { label: "Meldung anlegen", href: paths.newTicket },
          ],
        },
      ];
  }
}

/**
 * Die feste untere Leiste auf Mobil. Zwei bis drei Ziele je Rolle -- mehr
 * trägt die Breite nicht, und mehr braucht keine der Rollen.
 *
 * „Mehr" ist kein Ziel, sondern öffnet die Schublade; es trägt deshalb keine
 * Adresse.
 */
export type TabItem = {
  readonly label: string;
  readonly href: string | null;
  /** Der 18-px-Kasten aus dem Entwurf: eckig oder rund. */
  readonly shape: "square" | "round";
};

export function tabsForRole(role: AppRole): readonly TabItem[] {
  if (role === "requester") {
    return [
      { label: "Meldungen", href: paths.tickets, shape: "square" },
      { label: "Konto", href: paths.account, shape: "round" },
    ];
  }

  return [
    { label: "Tickets", href: paths.tickets, shape: "square" },
    { label: "Zeiten", href: paths.myTime, shape: "round" },
    { label: "Mehr", href: null, shape: "square" },
  ];
}
