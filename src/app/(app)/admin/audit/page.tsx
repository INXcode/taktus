import { type Metadata } from "next";
import {
  AuditEntries,
  type AuditEntry,
} from "@/components/audit/audit-entries";
import { AuditFilterBar } from "@/components/audit/audit-filter-bar";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { Pagination } from "@/components/ui/pagination";
import {
  PAGE_SIZE,
  auditFiltersToQuery,
  parseAuditFilters,
  periodStart,
} from "@/lib/audit/filters";
import { requireRole } from "@/lib/auth/guard";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Protokoll · Taktus Kontor" };

/**
 * Bildschirm 19 -- Protokoll. Nur `admin`.
 *
 * Drei Abfragen statt einer eingebetteten: die Einträge selbst, die Namen der
 * Akteure, die Nummern der betroffenen Tickets. Der Grund ist nicht Vorliebe
 * -- `audit_log.actor_id` trägt bewusst **keinen** Fremdschlüssel auf
 * `profiles`, damit das Protokoll die Anonymisierung eines Profils überdauert.
 * Ohne Fremdschlüssel gibt es für PostgREST nichts einzubetten, und ein
 * nachträglich gesetzter würde genau die Eigenschaft zerstören, um
 * derentwillen er fehlt.
 */
export default async function AuditPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(["admin"]);
  const supabase = await createClient();

  const filters = parseAuditFilters(await searchParams);
  const since = periodStart(filters.period, new Date());
  const from = (filters.page - 1) * PAGE_SIZE;

  let query = supabase
    .from("audit_log")
    .select(
      "id, occurred_at, actor_id, action, entity_type, entity_id, changed_fields",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (since !== null) query = query.gte("occurred_at", since);
  if (filters.action !== null) query = query.eq("action", filters.action);
  if (filters.entityType !== null) {
    query = query.eq("entity_type", filters.entityType);
  }

  const { data, count } = await query;
  const entries = await withNames(supabase, data ?? []);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AppShell viewer={viewer} title="Protokoll">
      <h1 className="mb-2 text-4xl font-bold">Protokoll</h1>

      {/*
        Der Satz steht über der Liste und nicht als Fußnote darunter: Er
        erklärt, warum die Spalten so karg sind. Wer ihn erst nach dem Suchen
        liest, hat vorher nach etwas gesucht, das es nicht gibt.
      */}
      <p className="mb-4.5 max-w-[34rem] text-[13.5px] leading-[21px] text-field-label">
        Festgehalten wird,{" "}
        <strong className="font-semibold text-foreground">
          wer wann welches Feld verändert hat
        </strong>{" "}
        — nicht, welchen Wert es vorher oder nachher hatte. Inhalte, IP-Adressen
        und Browserkennungen werden bewusst nicht gespeichert. Einträge lassen
        sich nicht ändern und nicht löschen.
      </p>

      <AuditFilterBar filters={filters} />

      {entries.length === 0 ? (
        <EmptyState
          shows="Diese Ansicht zeigt keine Protokolleinträge."
          doesNotMean="Möglicherweise liegt im gewählten Zeitraum nichts vor, oder die Filter schränken zu eng ein. Setzen Sie den Zeitraum weiter und die Filter zurück."
        />
      ) : (
        <>
          <AuditEntries entries={entries} />

          <Pagination
            page={filters.page}
            pageCount={pageCount}
            total={total}
            pageSize={PAGE_SIZE}
            hrefForPage={(page) =>
              `${paths.auditLog}${auditFiltersToQuery(filters, { page })}`
            }
          />
        </>
      )}

      <p className="mt-3.5 max-w-[42rem] text-[12.5px] leading-[1.55] text-muted">
        Eine Zeile kann keine Einzelheiten aufklappen — es gibt keine. Statt
        eines leeren Aufklapppfeils steht deshalb gar keiner.
      </p>
    </AppShell>
  );
}

type Row = {
  readonly id: number;
  readonly occurred_at: string;
  readonly actor_id: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly changed_fields: string[] | null;
};

/**
 * Löst Akteure und Ticketnummern nach -- je eine Abfrage, nicht je Zeile.
 *
 * Beide laufen unter RLS. Findet ein Nachschlagen nichts, bleibt das Feld
 * leer, statt einen Ersatzwert zu erfinden: Ein anonymisiertes Profil trägt
 * keinen Namen mehr, und ein gelöschtes Ticket hat keine Nummer mehr. Beides
 * ist eine Tatsache über die Daten und kein Mangel der Anzeige.
 */
async function withNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: readonly Row[],
): Promise<readonly AuditEntry[]> {
  const actorIds = [
    ...new Set(
      rows.flatMap((row) => (row.actor_id === null ? [] : [row.actor_id])),
    ),
  ];
  const ticketIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.entity_type === "ticket" && row.entity_id !== null
          ? [row.entity_id]
          : [],
      ),
    ),
  ];

  const [actors, tickets] = await Promise.all([
    actorIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase.from("profiles").select("id, display_name").in("id", actorIds),
    ticketIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase
          .from("tickets")
          .select("id, ticket_number")
          .in("id", ticketIds),
  ]);

  const actorName = new Map(
    (actors.data ?? []).map((profile) => [profile.id, profile.display_name]),
  );
  const ticketNumber = new Map(
    (tickets.data ?? []).map((ticket) => [ticket.id, ticket.ticket_number]),
  );

  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorName:
      row.actor_id === null ? null : (actorName.get(row.actor_id) ?? null),
    action: row.action,
    entityType: row.entity_type,
    ticketNumber:
      row.entity_id === null ? null : (ticketNumber.get(row.entity_id) ?? null),
    changedFields: row.changed_fields ?? [],
  }));
}
