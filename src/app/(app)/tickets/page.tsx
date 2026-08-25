import { type Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import {
  TicketFilterBar,
  type AssigneeOption,
} from "@/components/tickets/ticket-filter-bar";
import { MyReportsTable } from "@/components/tickets/my-reports-table";
import { TicketTable, type TicketRow } from "@/components/tickets/ticket-table";
import { LinkButton } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { loadCustomerOptions, type CustomerOption } from "@/lib/customers";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import {
  PAGE_SIZE,
  SORT_OPTIONS,
  escapeLikePattern,
  filtersToQuery,
  hasActiveFilters,
  parseFilters,
  quoteForFilterExpression,
} from "@/lib/tickets/filters";

export const metadata: Metadata = { title: "Tickets · Taktus Kontor" };

/**
 * Bildschirm 6 „Ticketliste" und Bildschirm 7 „Meine Meldungen" -- eine
 * Adresse, eine serverseitige Verzweigung.
 *
 * Bewusst nicht zwei Routen: Ein Melder, der `/tickets` als Lesezeichen hat,
 * muss bei seinen Meldungen landen und nicht auf „kein Zugriff". Die
 * Einschränkung auf eigene Zeilen macht ohnehin die Datenbank -- die Policy
 * `tickets_select_eigene` lässt einen Melder nur sehen, was er selbst
 * angelegt hat. Diese Seite filtert nicht danach; sie fragt schlicht, und die
 * Antwort ist bereits zugeschnitten.
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(ALL_ROLES);
  const params = await searchParams;
  const filters = parseFilters(params);
  const istMelder = viewer.role === "requester";

  const supabase = await createClient();

  // Zuweisungsauswahl nur, wo sie überhaupt hingehört. Ein Melder darf
  // `profiles` nur für sich selbst lesen -- eine Kollegenliste bekäme er
  // ohnehin nicht, und eine leere Auswahl anzubieten wäre irreführend.
  let assignees: readonly AssigneeOption[] = [];
  let customers: readonly CustomerOption[] = [];
  if (!istMelder) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .is("deactivated_at", null)
      .order("display_name");
    assignees = (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
    }));

    // Für den Filter auch stillgelegte Kunden: An ihnen hängen weiterhin
    // Tickets, und wer sie sucht, muss sie auswählen können.
    customers = await loadCustomerOptions(supabase, {
      zusaetzlich: filters.customer,
    });
  }

  const sort = SORT_OPTIONS[filters.sort];
  const from = (filters.page - 1) * PAGE_SIZE;

  // Der Beziehungsname muss ausgeschrieben werden, weil `tickets` **zwei**
  // Fremdschlüssel auf `profiles` hat: einen für die Zuweisung, einen für
  // „angelegt von". Ohne den Hinweis wüsste PostgREST nicht, welcher gemeint
  // ist, und antwortete mit einem Mehrdeutigkeitsfehler.
  //
  // Beide sind zusammengesetzt (`tenant_id, assignee_id`) -- die Datenbank
  // erzwingt damit, dass ein Verweis auf ein Profil denselben Mandanten meint
  // wie das Ticket. Der Name lautet deshalb `tickets_tenant_id_assignee_id_fkey`
  // und nicht, wie man vermuten würde, `tickets_assignee_id_fkey`.
  //
  // Beim Kunden stellt sich die Mehrdeutigkeit nicht -- es gibt nur einen
  // Fremdschlüssel dorthin -- aber er ist ebenfalls zusammengesetzt, und der
  // Name folgt derselben Regel.
  let query = supabase
    .from("tickets")
    .select(
      "ticket_number, title, status, category, created_at, assignee:profiles!tickets_tenant_id_assignee_id_fkey (display_name), customer:customers!tickets_tenant_id_customer_id_fkey (name)",
      { count: "exact" },
    )
    .order(sort.column, { ascending: sort.ascending })
    .range(from, from + PAGE_SIZE - 1);

  if (filters.search !== "") {
    const number = Number.parseInt(filters.search.replace(/^#/u, ""), 10);
    // Die Suche greift auf Titel UND Nummer: „12" trifft Ticket #12 und jeden
    // Titel mit „12". `%` und `_` werden entschärft, sonst wäre eine Eingabe
    // aus lauter Prozentzeichen ein Volltreffer auf alles.
    const pattern = escapeLikePattern(filters.search);
    // Für `or()` muss der Wert zusätzlich in Anführungszeichen. Die
    // Begründung samt Beispielkette steht bei der Funktion; hier stünde sie
    // ein zweites Mal und liefe beim nächsten Mal auseinander.
    const zitiert = quoteForFilterExpression(pattern);
    query = Number.isFinite(number)
      ? query.or(`title.ilike."%${zitiert}%",ticket_number.eq.${number}`)
      : query.ilike("title", `%${pattern}%`);
  }

  if (filters.status.length > 0) query = query.in("status", filters.status);
  if (filters.category !== null) query = query.eq("category", filters.category);
  if (filters.assignee === "none") query = query.is("assignee_id", null);
  else if (filters.assignee !== null)
    query = query.eq("assignee_id", filters.assignee);
  if (filters.customer !== null)
    query = query.eq("customer_id", filters.customer);

  const { data, count, error } = await query;

  if (error) {
    // Nur der Code. Die Meldung von PostgREST kann Zeileninhalte enthalten,
    // und Personenbezug im Protokoll ist ein eigenes Risiko.
    console.error("Ticketliste konnte nicht geladen werden", {
      code: error.code,
    });
  }

  const rows: readonly TicketRow[] = (data ?? []).map((row) => ({
    ticketNumber: row.ticket_number,
    title: row.title,
    status: row.status,
    category: row.category,
    assigneeName: row.assignee?.display_name ?? null,
    // Ein Melder liest `customers` nur für seinen eigenen Kunden -- für ihn
    // bleibt das Feld leer. Bildschirm 7 zeigt die Spalte deshalb gar nicht
    // erst, statt aus fehlender Leseberechtigung eine Tatsache zu formen.
    customerName: row.customer?.name ?? null,
    createdAt: row.created_at,
  }));

  const total = count ?? rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const gefiltert = hasActiveFilters(filters);

  return (
    <AppShell
      viewer={viewer}
      title={istMelder ? "Meine Meldungen" : "Tickets"}
      action={
        <LinkButton href={paths.newTicket} variant="primary">
          {istMelder ? "Meldung anlegen" : "Ticket anlegen"}
        </LinkButton>
      }
    >
      <div className="mb-5">
        <h1 className="text-4xl font-bold">
          {istMelder ? "Meine Meldungen" : "Tickets"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {gefiltert
            ? `${rows.length} von ${total} ${total === 1 ? "Ticket" : "Tickets"} — Filter aktiv`
            : istMelder
              ? `${total} ${total === 1 ? "Meldung" : "Meldungen"}`
              : `${total} ${total === 1 ? "Ticket" : "Tickets"}`}
        </p>
      </div>

      {/* Der Melder bekommt kein Filterband: vier Spalten, keine Zuweisung,
          und bei einer Handvoll eigener Meldungen wäre es Beiwerk. */}
      {istMelder ? null : (
        <TicketFilterBar
          filters={filters}
          assignees={assignees}
          customers={customers}
        />
      )}

      <div className="mt-5">
        {rows.length === 0 ? (
          <EmptyState
            shows={
              istMelder
                ? "Hier steht keine Meldung von Ihnen."
                : "Diese Ansicht zeigt keine Tickets."
            }
            doesNotMean={
              istMelder
                ? "Sie sehen an dieser Stelle ausschließlich Meldungen, die Sie selbst angelegt haben. Wenn Sie eine Meldung erwarten, die hier fehlt, fragen Sie in der Verwaltung Ihres Mandanten nach."
                : gefiltert
                  ? "Das kann bedeuten, dass keine angelegt sind — oder dass die aktiven Filter nichts treffen. Wenn Sie Tickets erwarten, die hier fehlen, wenden Sie sich an die Verwaltung Ihres Mandanten."
                  : "Das kann bedeuten, dass keine angelegt sind — oder dass Ihnen der Zugriff darauf entzogen wurde. Wenn Sie Tickets erwarten, die hier fehlen, wenden Sie sich an die Verwaltung Ihres Mandanten."
            }
            action={
              <>
                {gefiltert ? (
                  <LinkButton href={paths.tickets} variant="secondary">
                    Filter zurücksetzen
                  </LinkButton>
                ) : null}
                <LinkButton href={paths.newTicket} variant="primary">
                  {istMelder ? "Meldung anlegen" : "Ticket anlegen"}
                </LinkButton>
              </>
            }
          />
        ) : (
          <>
            {/*
              Zwei Tabellen, nicht eine mit ausgeblendeten Spalten.
              Bildschirm 7 hat vier Spalten und **keine Zuweisung** -- ein
              Melder darf `profiles` nur für sich selbst lesen, die
              eingebettete Abfrage liefert ihm also nichts, und die
              Ticketliste zeigte an der Stelle „nicht zugewiesen" für ein
              Ticket, das sehr wohl zugewiesen ist. Aus fehlender
              Leseberechtigung eine Tatsache zu formen ist genau der Fehler,
              den Bildschirm 24 beschreibt.
            */}
            {istMelder ? (
              <MyReportsTable rows={rows} />
            ) : (
              <TicketTable rows={rows} />
            )}
            <p className="mt-4 text-[12.5px] text-muted">
              {rows.length} {rows.length === 1 ? "Zeile" : "Zeilen"} ·
              geschlossene {istMelder ? "Meldungen" : "Tickets"} erscheinen
              gedämpft, aber nicht durchgestrichen
            </p>
            <Pagination
              page={filters.page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              hrefForPage={(page) =>
                `${paths.tickets}${filtersToQuery(filters, { page })}`
              }
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
