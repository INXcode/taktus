import { StatusPill } from "@/components/ui/badges";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { formatShortDate } from "@/lib/format/datetime";
import { paths } from "@/lib/paths";
import { type TicketStatus } from "@/types";

/** Aus dem Entwurf, Bildschirm 7. */
const COLUMNS = "58px 1fr 140px 96px";

export type ReportRow = {
  readonly ticketNumber: number;
  readonly title: string;
  readonly status: TicketStatus;
  readonly createdAt: string;
};

/**
 * „Meine Meldungen" (Bildschirm 7) -- die Liste des Melders.
 *
 * > [!important] Vier Spalten, und die fehlende fünfte ist der Punkt.
 * > Es gibt hier **keine Zuweisungsspalte**, und das ist keine Verkürzung aus
 * > Platzgründen: Ein Melder darf `profiles` nur für sich selbst lesen. Die
 * > eingebettete Abfrage nach dem Bearbeiter liefert ihm deshalb nichts --
 * > und die Ticketliste der Bearbeiter zeigte an derselben Stelle
 * > „nicht zugewiesen", obwohl das Ticket sehr wohl zugewiesen war.
 * >
 * > Das ist genau der Fehler, den Bildschirm 24 beschreibt: Die Datenbank
 * > antwortet bei fehlender Leseberechtigung stumm mit nichts, und wer daraus
 * > eine Aussage macht, behauptet etwas, das er nicht wissen kann. Die Spalte
 * > fehlt also nicht, weil sie unwichtig wäre, sondern weil ihr Inhalt hier
 * > nicht ermittelbar ist.
 * >
 * > Der Entwurf sagt dasselbe kürzer: „wer sie bearbeitet, ist nicht seine
 * > Frage."
 *
 * Der Status steht groß und links, weil er die Auskunft trägt, auf die es dem
 * Melder ankommt -- passiert etwas?
 */
export function MyReportsTable({
  rows,
}: {
  readonly rows: readonly ReportRow[];
}) {
  return (
    <>
      {/* ---------- Desktop ---------- */}
      <div className="hidden md:block">
        <Table caption="Meine Meldungen">
          <TableHead columns={COLUMNS}>
            <TableCell>Nr.</TableCell>
            <TableCell>Titel</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Gemeldet</TableCell>
          </TableHead>

          {rows.map((row) => {
            const closed = row.status === "closed";
            return (
              <TableRow
                key={row.ticketNumber}
                columns={COLUMNS}
                href={paths.ticket(row.ticketNumber)}
              >
                <TableCell
                  className={`font-mono text-sm ${closed ? "text-faint" : "text-muted"}`}
                >
                  #{row.ticketNumber}
                </TableCell>
                <TableCell>
                  <span
                    className={`block text-base leading-5 ${closed ? "text-muted" : "text-foreground"}`}
                    title={row.title}
                  >
                    {row.title}
                  </span>
                  <EditableHint status={row.status} />
                </TableCell>
                <TableCell className="justify-self-start">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="text-sm text-muted">
                  {formatShortDate(row.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </Table>
      </div>

      {/* ---------- Mobil ---------- */}
      <ul className="flex list-none flex-col gap-3 p-0 md:hidden">
        {rows.map((row) => {
          const closed = row.status === "closed";
          return (
            <li key={row.ticketNumber}>
              <a
                href={paths.ticket(row.ticketNumber)}
                data-row
                className="block rounded-lg border border-border bg-card p-4 no-underline hover:no-underline"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`font-mono text-sm ${closed ? "text-faint" : "text-muted"}`}
                  >
                    #{row.ticketNumber} · {formatShortDate(row.createdAt)}
                  </span>
                  <StatusPill status={row.status} />
                </span>
                <span
                  className={`mt-2 block text-md leading-6 font-semibold ${closed ? "text-muted" : "text-foreground"}`}
                >
                  {row.title}
                </span>
                <EditableHint status={row.status} />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Der Zusatz „bearbeitbar" an offenen Meldungen.
 *
 * Ein Melder darf sein Ticket **nur solange der Status `open` ist** ändern --
 * das erzwingt die Policy `tickets_update_eigene`, nicht die Oberfläche. Der
 * Hinweis steht schon in der Liste, damit der Wechsel nicht erst im Detail
 * auffällt: Er passiert für den Melder unangekündigt, sobald jemand anders
 * den Status ändert.
 */
function EditableHint({ status }: { readonly status: TicketStatus }) {
  if (status !== "open") return null;
  return <span className="block text-xs text-success-text">bearbeitbar</span>;
}
