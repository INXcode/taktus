import { type TimeRow } from "@/components/time/time-entry-list";

/**
 * Was die drei Zeitansichten aus `time_entries` lesen -- an einer Stelle.
 *
 * Drei Seiten mit derselben Liste hatten dreimal dieselbe Auswahlzeile, und
 * dreimal fast dieselbe: Der Kunde fehlte überall, und beim Nachtragen wäre
 * genau eine davon vergessen worden.
 *
 * Der Beziehungsname zum Kunden muss ausgeschrieben werden, weil der
 * Fremdschlüssel zusammengesetzt ist (`tenant_id, customer_id`) -- die
 * Datenbank erzwingt damit, dass ein Ticket nur auf einen Kunden desselben
 * Mandanten zeigt. Der Name folgt daraus und lautet nicht, wie man vermuten
 * würde, `tickets_customer_id_fkey`.
 */
export const TIME_ENTRY_SELECT =
  "id, minutes, note, worked_on, user_id, person:profiles (display_name), ticket:tickets (ticket_number, title, customer:customers!tickets_tenant_id_customer_id_fkey (name))";

/** Die Gestalt, die `TIME_ENTRY_SELECT` zurückgibt. */
export type RawTimeEntry = {
  readonly id: string;
  readonly minutes: number;
  readonly note: string;
  readonly worked_on: string;
  readonly user_id: string;
  readonly person: { readonly display_name: string } | null;
  readonly ticket: {
    readonly ticket_number: number;
    readonly title: string;
    readonly customer: { readonly name: string } | null;
  } | null;
};

/**
 * Eine gelesene Zeile in die Zeile der Liste übersetzen.
 *
 * Fehlende Namen werden **nicht** erfunden. Ein Gedankenstrich sagt „hier
 * steht nichts"; „Unbekannt" klänge nach einer Feststellung über den Kunden.
 * Vorkommen kann es nur, wenn eine Zeile für den Lesenden nicht sichtbar ist
 * -- und dann ist die Lücke die ehrlichere Auskunft.
 */
export function toTimeRow(
  row: RawTimeEntry,
  viewer: { readonly personName?: string; readonly isOwn: boolean },
): TimeRow {
  return {
    id: row.id,
    minutes: row.minutes,
    note: row.note,
    workedOn: row.worked_on,
    ticketNumber: row.ticket?.ticket_number ?? 0,
    ticketTitle: row.ticket?.title ?? "—",
    customerName: row.ticket?.customer?.name ?? "—",
    personName: viewer.personName ?? row.person?.display_name ?? "—",
    isOwn: viewer.isOwn,
  };
}
