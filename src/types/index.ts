import type { Database } from "./database";

/**
 * Handliche Namen für die generierten Typen.
 *
 * `database.ts` wird von `pnpm db:types` erzeugt und nie von Hand bearbeitet.
 * Der CI-Job `datenbank` bricht ab, sobald die Datei vom Schema abweicht --
 * ein nicht nachgezogener Typ führt sonst erfahrungsgemäss zu `any`-Umgehungen
 * an der Aufrufstelle, und die überleben jedes Review.
 */

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type TicketComment =
  Database["public"]["Tables"]["ticket_comments"]["Row"];
export type TimeEntry = Database["public"]["Tables"]["time_entries"]["Row"];
export type AuditLogEntry = Database["public"]["Tables"]["audit_log"]["Row"];

export type AppRole = Database["public"]["Enums"]["app_role"];
export type TicketStatus = Database["public"]["Enums"]["ticket_status"];
export type TicketCategory = Database["public"]["Enums"]["ticket_category"];
export type AiProvider = Database["public"]["Enums"]["ai_provider"];

/**
 * Einheitliche Rückgabe der Server Actions.
 *
 * Eine unterscheidbare Vereinigung statt geworfener Fehler: Der Aufrufer muss
 * `ok` prüfen, bevor TypeScript ihn an `data` lässt. Ein vergessener Fehlerfall
 * bricht damit die Übersetzung, statt zur Laufzeit `undefined` zu liefern.
 */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

/** Feldname aus dem Formular auf eine deutsche Meldung. */
export type FieldErrors = Readonly<Record<string, string>>;

/**
 * Rückgabe der formulargebundenen Actions.
 *
 * `ActionResult` trägt eine Meldung für den ganzen Vorgang und genügt für
 * imperative Aufrufe (löschen, verwerfen, bestätigen). Ein Formular braucht
 * zusätzlich die Zuordnung Feld → Meldung, damit der Fehler unter dem Feld
 * steht, um das es geht, statt gesammelt oben — der Entwurf zeigt ihn dort,
 * und eine Sammelmeldung zwingt zum Suchen.
 *
 * Bewusst ein zweiter Typ statt eines erweiterten `ActionResult`: Sonst
 * trügen alle Aufrufer ein optionales Feld mit, das die meisten nie füllen.
 */
export type FormResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fields?: FieldErrors };
