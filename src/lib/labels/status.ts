import { type TicketStatus } from "@/types";

/**
 * Die vier Werte von `ticket_status`, deutsch beschriftet und eingefärbt.
 *
 * Die Klassennamen stehen **ausgeschrieben**, nicht zusammengesetzt. Tailwind
 * liest den Quelltext als Text: Ein `bg-status-${status}-soft` erzeugt zur
 * Bauzeit keine Klasse, und die Pille käme farblos heraus -- ein Fehler, der
 * erst im Browser auffällt und in keinem Test.
 */
export const STATUS_LABEL = {
  open: "Offen",
  in_progress: "In Bearbeitung",
  waiting: "Wartet",
  closed: "Geschlossen",
} as const satisfies Record<TicketStatus, string>;

/** Punktfarbe, Fläche und Text je Status. */
export const STATUS_CLASSES = {
  open: {
    dot: "bg-status-open",
    pill: "bg-status-open-soft text-status-open-text",
  },
  in_progress: {
    dot: "bg-status-progress",
    pill: "bg-status-progress-soft text-status-progress-text",
  },
  waiting: {
    dot: "bg-status-waiting",
    pill: "bg-status-waiting-soft text-status-waiting-text",
  },
  closed: {
    dot: "bg-status-closed",
    pill: "bg-status-closed-soft text-status-closed-text",
  },
} as const satisfies Record<TicketStatus, { dot: string; pill: string }>;

/**
 * Reihenfolge für Filter und Auswahlfelder. Der Lebenslauf eines Tickets,
 * nicht das Alphabet -- „Geschlossen" gehört ans Ende, nicht zwischen
 * „Offen" und „In Bearbeitung".
 */
export const STATUS_ORDER = [
  "open",
  "in_progress",
  "waiting",
  "closed",
] as const satisfies readonly TicketStatus[];
