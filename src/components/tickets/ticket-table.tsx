import { CategoryChip, StatusPill } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/avatar";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { formatRelativeDate } from "@/lib/format/datetime";
import { shortName } from "@/lib/format/name";
import { paths } from "@/lib/paths";
import { type TicketCategory, type TicketStatus } from "@/types";

/**
 * Aus dem Entwurf, Bildschirm 6 -- um die Kundenspalte erweitert.
 *
 * Der Kunde steht direkt hinter dem Titel und vor Status und Kategorie: Er
 * beantwortet die erste Frage bei einem fremden Vorgang -- für wen läuft das
 * überhaupt.
 */
const COLUMNS = "78px 1fr 150px 132px 124px 152px 108px";

export type TicketRow = {
  readonly ticketNumber: number;
  readonly title: string;
  readonly customerName: string | null;
  readonly status: TicketStatus;
  readonly category: TicketCategory;
  readonly assigneeName: string | null;
  readonly createdAt: string;
};

/**
 * Die Ticketliste für Bearbeiter und Verwaltung (Bildschirm 6).
 *
 * Auf Mobil eine Kartenliste statt einer umgebrochenen Tabelle -- beide
 * Breiten sind eigenständig entworfen, nicht dieselbe Ansicht in zwei
 * Größen.
 */
export function TicketTable({ rows }: { readonly rows: readonly TicketRow[] }) {
  return (
    <>
      {/* ---------- Desktop ---------- */}
      <div className="hidden md:block">
        <Table caption="Tickets dieses Mandanten">
          <TableHead columns={COLUMNS}>
            {/*
              Nur „Nr.". Dass die Nummer mandantenlokal vergeben wird, steht im
              Datenmodell und im Schema -- in der Spaltenüberschrift wäre es
              eine Auskunft über eine Trennung, die die meisten Betriebe gar
              nicht erleben: Wer einen Mandanten hat, liest dort einen
              Vorbehalt, den es für ihn nicht gibt.
            */}
            <TableCell>Nr.</TableCell>
            <TableCell>Titel</TableCell>
            <TableCell>Kunde</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Kategorie</TableCell>
            <TableCell>Zuweisung</TableCell>
            <TableCell>Angelegt</TableCell>
          </TableHead>

          {rows.map((row) => {
            // Geschlossene Tickets erscheinen gedämpft, aber nicht
            // durchgestrichen: Sie sind erledigt, nicht ungültig.
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

                {/*
                  Zwei Zeilen, dann Auslassung. Die Zeile wächst nicht mit --
                  sonst springt die Tabelle bei einem 200-Zeichen-Titel. Der
                  volle Titel steht im `title`-Attribut und im Detail.
                */}
                <TableCell
                  className={`line-clamp-2 text-base leading-5 ${closed ? "text-muted" : "text-foreground"}`}
                >
                  <span title={row.title}>{row.title}</span>
                </TableCell>

                <TableCell
                  className={`line-clamp-2 text-sm leading-5 ${closed ? "text-faint" : "text-muted"}`}
                >
                  <span title={row.customerName ?? undefined}>
                    {row.customerName}
                  </span>
                </TableCell>

                <TableCell className="justify-self-start">
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="justify-self-start">
                  <CategoryChip category={row.category} />
                </TableCell>
                <TableCell>
                  <AssigneeCell name={row.assigneeName} dimmed={closed} />
                </TableCell>
                <TableCell className="text-sm text-muted">
                  {formatRelativeDate(row.createdAt)}
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
                    #{row.ticketNumber}
                  </span>
                  <StatusPill status={row.status} />
                </span>
                <span
                  className={`mt-2 block text-md leading-6 font-semibold ${closed ? "text-muted" : "text-foreground"}`}
                >
                  {row.title}
                </span>
                <span
                  className={`mt-1 block text-sm ${closed ? "text-faint" : "text-muted"}`}
                >
                  {row.customerName}
                </span>
                <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <CategoryChip category={row.category} />
                  <AssigneeCell name={row.assigneeName} dimmed={closed} />
                  <span className="text-sm text-muted">
                    {formatRelativeDate(row.createdAt)}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Die Zuweisungsspalte.
 *
 * „nicht zugewiesen" steht kursiv und gedämpft an derselben Stelle, an der
 * sonst eine Person steht, und **ohne** Personenkreis. Keine Warnfarbe: Ein
 * unzugewiesenes Ticket ist ein Zustand, kein Fehler -- die Lücke soll als
 * Lücke sichtbar sein, nicht als Mangel.
 */
function AssigneeCell({
  name,
  dimmed,
}: {
  readonly name: string | null;
  readonly dimmed: boolean;
}) {
  if (name === null) {
    return <span className="text-sm text-muted italic">nicht zugewiesen</span>;
  }

  return (
    <span
      title={name}
      className={`inline-flex items-center gap-2 text-sm ${dimmed ? "text-muted" : "text-body"}`}
    >
      <Avatar displayName={name} size="xs" tone={dimmed ? "other" : "self"} />
      {shortName(name)}
    </span>
  );
}
