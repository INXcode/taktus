/**
 * Das Vokabular des Protokolls.
 *
 * > [!important] Diese Datei ist die einzige Quelle, und das ist ihr Zweck.
 * > `logAudit()` nimmt genau diese Werte an -- eine erfundene Aktion ist ein
 * > Typfehler, kein stiller Eintrag, den später niemand filtern kann. Das
 * > Filterband auf Bildschirm 19 liest dieselbe Liste. Ohne diese Bindung
 * > laufen Schreiber und Filter auseinander, und zwar lautlos: Ein Eintrag,
 * > den kein Filter kennt, ist einer, den niemand findet.
 *
 * Die Werte bleiben **englisch und technisch** -- so stehen sie in der
 * Datenbank, und so zeigt der Entwurf sie: als Mono-Marke, nicht übersetzt.
 * Ein Protokoll ist ein Nachweis; es ist wichtiger, dass die angezeigte Zeile
 * dem Datenbankinhalt gleicht, als dass sie sich schön liest.
 */

/**
 * Aufgeführt ist, was heute tatsächlich geschrieben wird -- nicht, was
 * denkbar wäre. Ein Filtereintrag ohne Schreiber verspricht eine Auswahl, die
 * immer leer bleibt. Wer eine Aktion ergänzt, ergänzt sie hier; der Typ
 * erzwingt es, und das Filterband bekommt sie im selben Zug.
 */
export const AUDIT_ACTIONS = [
  "ticket.create",
  "ticket.update",
  "ticket.delete",
  "comment.create",
  "comment.update",
  "time_entry.create",
  "time_entry.update",
  "time_entry.delete",
  "profile.create",
  "profile.update",
  "profile.anonymize",
  "profile.export",
  "tenant.update",
  "customer.create",
  "customer.update",
  // Eine Übermittlung an einen Dritten. Steht deshalb im Protokoll -- aber
  // nur, wenn tatsächlich gefragt wurde, nicht bei abgeschalteter Funktion.
  "ai.suggest",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_ENTITY_TYPES = [
  "ticket",
  "ticket_comment",
  "time_entry",
  "profile",
  "tenant",
  "customer",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * Wie ein leerer Akteur zu lesen ist.
 *
 * `actor_id` darf NULL sein, und das hat genau zwei Bedeutungen: der
 * Löschlauf des Betreibers, oder eine inzwischen anonymisierte Person. Die
 * Zeile sagt beides und entscheidet sich für keines -- eine erfundene
 * Zuordnung wäre schlimmer als eine offene Angabe.
 */
export const SYSTEM_ACTOR = "System oder anonymisierte Person";
