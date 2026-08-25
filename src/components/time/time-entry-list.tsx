import { DeleteTimeEntry } from "@/components/time/delete-time-entry";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import {
  formatDate,
  formatShortDate,
  formatWeekday,
} from "@/lib/format/datetime";
import { formatMinutes } from "@/lib/format/duration";
import { shortName } from "@/lib/format/name";
import { paths } from "@/lib/paths";

export type TimeRow = {
  readonly id: string;
  readonly minutes: number;
  readonly note: string;
  readonly workedOn: string;
  readonly ticketNumber: number;
  readonly ticketTitle: string;
  readonly customerName: string;
  readonly personName: string;
  readonly isOwn: boolean;
};

/**
 * Die Buchungsliste der drei Zeitansichten.
 *
 * > [!important] Eine Anzeigeliste, kein Formular.
 * > Bis dahin klappte jede Zeile ein Änderungsformular auf. Das war der
 * > kürzere Weg und der schlechtere: Geändert wurde eine Buchung an einer
 * > Stelle, an der ihr Vorgang gar nicht steht -- ohne Titel, ohne
 * > Kommentarverlauf, ohne die übrigen Buchungen desselben Tickets. Wer eine
 * > Zahl korrigiert, will genau das sehen.
 * >
 * > Die Zeile führt deshalb ins Ticket, und zwar auf den Reiter „Gebuchte
 * > Zeiten" und dort auf die Buchung selbst (`#buchung-<id>`). Geändert wird
 * > nur noch da -- eine Stelle statt drei.
 *
 * Gelöscht wird weiterhin hier. Löschen braucht den Zusammenhang nicht, den
 * Ändern braucht: Es ist keine Korrektur an einem Wert, sondern die Aussage,
 * dass die Zeile nicht hätte entstehen sollen.
 *
 * > [!note] Der gedehnte Verweis, und warum die Zeile nicht selbst einer ist
 * > Auf Bildschirm 6 ist die ganze Zeile ein `<a>`. Hier steht in der Zeile
 * > noch ein Löschknopf, und ein `<button>` in einem `<a>` ist ungültiges
 * > Markup -- Browser reparieren es, indem sie den Knopf aus dem Verweis
 * > herausbrechen, und was danach wo klickt, ist nicht mehr vorhersagbar.
 * > Der Verweis liegt deshalb in der Nummernspalte und dehnt sich über die
 * > Zeile (`after:absolute after:inset-0`), der Löschknopf steht mit `z-10`
 * > darüber. Der Fokusring gehört sichtbar der ganzen Zeile
 * > (`has-[a:focus-visible]`), nicht der kleinen Nummer.
 */
export function TimeEntryList({
  rows,
  showPerson,
  showCustomer = true,
  isAdmin,
}: {
  readonly rows: readonly TimeRow[];
  /** Die Gesamtzeiten zeigen die Person, die eigene Ansicht nicht. */
  readonly showPerson: boolean;
  /**
   * Aus in der Kundenansicht: Dort steht der Kunde in der Gruppenüberschrift,
   * und eine Spalte, die in jeder Zeile denselben Wert wiederholt, ist keine
   * Auskunft mehr, sondern Grundrauschen.
   */
  readonly showCustomer?: boolean;
  readonly isAdmin: boolean;
}) {
  // Person · Tag · Nr. · Kunde · Notiz · Dauer · Aktion
  const columns = [
    showPerson ? "132px" : null,
    "104px",
    "58px",
    showCustomer ? "150px" : null,
    "minmax(0,1fr)",
    "88px",
    "74px",
  ]
    .filter((track) => track !== null)
    .join(" ");

  return (
    <>
      {/* ---------- Desktop ---------- */}
      <div className="hidden md:block">
        <Table caption="Zeitbuchungen">
          <TableHead columns={columns}>
            {showPerson ? <TableCell>Person</TableCell> : null}
            <TableCell>Tag</TableCell>
            <TableCell>Nr.</TableCell>
            {showCustomer ? <TableCell>Kunde</TableCell> : null}
            <TableCell>Notiz</TableCell>
            <TableCell className="text-right">Dauer</TableCell>
            <TableCell>
              <span className="sr-only">Aktion</span>
            </TableCell>
          </TableHead>

          {rows.map((row) => (
            <TableRow
              key={row.id}
              columns={columns}
              className="relative has-[a:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-focus)] hover:bg-subtle"
            >
              {showPerson ? (
                <TableCell className="inline-flex items-center gap-2 text-sm text-body">
                  <Avatar
                    displayName={row.personName}
                    size="xs"
                    tone={row.isOwn ? "self" : "other"}
                  />
                  {row.isOwn ? "Sie" : shortName(row.personName)}
                </TableCell>
              ) : null}

              <TableCell className="text-sm text-muted">
                {formatWeekday(row.workedOn)}
              </TableCell>

              <TableCell className="font-mono text-sm text-muted">
                {/*
                  `outline-none` ausnahmsweise: Der Ersatz steht an der Zeile
                  darüber und ist deutlicher als ein Ring um zwei Ziffern.
                  Ohne Ersatz stünde er hier nicht.
                */}
                <a
                  href={paths.ticketTimeEntry(row.ticketNumber, row.id)}
                  className="text-muted no-underline outline-none after:absolute after:inset-0 after:content-[''] hover:no-underline"
                >
                  #{row.ticketNumber}
                  <span className="sr-only">
                    {" "}
                    — {beschreibe(row)}, im Ticket öffnen
                  </span>
                </a>
              </TableCell>

              {showCustomer ? (
                <TableCell className="truncate text-sm text-muted">
                  <span title={row.customerName}>{row.customerName}</span>
                </TableCell>
              ) : null}

              <TableCell className="truncate text-base text-body">
                {row.note === "" ? (
                  <span className="text-faint italic">ohne Notiz</span>
                ) : (
                  <span title={row.note}>{row.note}</span>
                )}
              </TableCell>

              <TableCell className="text-right font-mono text-base font-semibold text-foreground">
                {formatMinutes(row.minutes)}
              </TableCell>

              <TableCell className="justify-self-end">
                <RowAction row={row} isAdmin={isAdmin} />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>

      {/* ---------- Mobil ---------- */}
      <ul className="flex list-none flex-col gap-3 p-0 md:hidden">
        {rows.map((row) => (
          <li
            key={row.id}
            className="relative rounded-lg border border-border bg-card p-4 has-[a:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-focus)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <a
                href={paths.ticketTimeEntry(row.ticketNumber, row.id)}
                className="font-mono text-sm text-muted no-underline outline-none after:absolute after:inset-0 after:content-[''] hover:no-underline"
              >
                #{row.ticketNumber}
                <span className="sr-only">
                  {" "}
                  — {beschreibe(row)}, im Ticket öffnen
                </span>
              </a>
              <span className="font-mono text-base font-semibold text-foreground">
                {formatMinutes(row.minutes)}
              </span>
            </div>

            <p className="mt-1.5 text-base text-body">
              {row.note === "" ? (
                <span className="text-faint italic">ohne Notiz</span>
              ) : (
                row.note
              )}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
              <span>{formatShortDate(row.workedOn)}</span>
              {showCustomer ? <span>{row.customerName}</span> : null}
              {showPerson ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar
                    displayName={row.personName}
                    size="xs"
                    tone={row.isOwn ? "self" : "other"}
                  />
                  {row.isOwn ? "Sie" : shortName(row.personName)}
                </span>
              ) : null}
              <span className="ml-auto">
                <RowAction row={row} isAdmin={isAdmin} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Löschknopf oder beschriftete Lücke.
 *
 * Der Vermerk „fremde Buchung" bleibt, obwohl daneben kein Ändern-Knopf mehr
 * steht: Der Entwurf begründet ihn damit, dass eine leere Stelle sonst wie ein
 * Darstellungsfehler aussieht. Das gilt für einen fehlenden Knopf genauso wie
 * für zwei.
 */
function RowAction({
  row,
  isAdmin,
}: {
  readonly row: TimeRow;
  readonly isAdmin: boolean;
}) {
  if (!row.isOwn && !isAdmin) {
    return <span className="text-[12.5px] text-faint">fremde Buchung</span>;
  }

  return (
    <DeleteTimeEntry entryId={row.id} label={beschreibe(row)} note={row.note} />
  );
}

/**
 * „45 min am 04.08.2026, Ticket #12 · Titel" -- für Ansage und Beschriftung.
 *
 * Mit vollem Datum, nicht in der Kurzform der Spalte: Ein Screenreader liest
 * die Zeile ohne den Gruppenkopf, in dem der Monat steht, und „04.08." ohne
 * Jahr ist in einer Jahresauswertung keine Auskunft.
 */
function beschreibe(row: TimeRow): string {
  return `${formatMinutes(row.minutes)} am ${formatDate(row.workedOn)}, Ticket #${row.ticketNumber} · ${row.ticketTitle}`;
}
