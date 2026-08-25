import { type Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guard";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kunden · Taktus Kontor" };

/**
 * Drei Spalten, im Zuschnitt von Bildschirm 15.
 *
 * Die vierte trug einmal einen Verweis „Bearbeiten". Seit die ganze Zeile
 * führt, wäre sie eine zweite Schaltfläche für dasselbe Ziel.
 */
const COLUMNS = "minmax(0,1fr) 140px 150px";

/**
 * Bildschirm 26 -- Kunden.
 *
 * > [!important] Mandant und Kunde sind zwei verschiedene Dinge.
 * > Der **Mandant** betreibt dieses Ticketsystem. Ein **Kunde** wird damit
 * > verwaltet: Für ihn werden Vorgänge geführt, und er wird sie später
 * > bezahlen. Beides „Kunde" zu nennen war der Fehler, den diese Ebene
 * > behebt.
 *
 * Wie bei den Nutzern verschwindet hier nichts: Ein Kunde wird
 * stillgelegt, nicht gelöscht. An ihm hängen Vorgänge, und die verlören sonst
 * ihre Zuordnung. Es gibt für `customers` deshalb keine DELETE-Policy.
 */
export default async function CustomersPage() {
  const viewer = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, name, is_active, tickets:tickets(count)")
    .order("name");

  if (error) {
    // Nur der Code. Die Meldung von PostgREST kann Zeileninhalte enthalten.
    console.error("Kundenliste konnte nicht geladen werden", {
      code: error.code,
    });
  }

  const customers = data ?? [];
  const aktiv = customers.filter((customer) => customer.is_active).length;
  const stillgelegt = customers.length - aktiv;

  return (
    <AppShell
      viewer={viewer}
      title="Kunden"
      action={
        <LinkButton href={paths.newCustomer} variant="primary">
          Kunde anlegen
        </LinkButton>
      }
    >
      <div className="mb-5">
        <h1 className="text-4xl font-bold">Kunden</h1>
        <p className="mt-1.5 text-sm text-muted">
          {aktiv} aktiv, {stillgelegt} stillgelegt · {viewer.tenantName}
        </p>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          shows="Dieser Mandant hat noch keinen Kunden."
          doesNotMean="Solange kein Kunde angelegt ist, lässt sich kein Ticket erfassen — jeder Vorgang gehört zu genau einem Kunden. Auch ein Melder braucht einen, zu dem er gehört. Wenn Sie Vorgänge nur für den eigenen Betrieb führen, legen Sie dafür einen Kunden an."
          action={
            <LinkButton href={paths.newCustomer} variant="primary">
              Kunde anlegen
            </LinkButton>
          }
        />
      ) : (
        <>
          <Table caption="Kunden dieses Mandanten">
            <TableHead columns={COLUMNS}>
              <TableCell>Name</TableCell>
              <TableCell>Vorgänge</TableCell>
              <TableCell>Zustand</TableCell>
            </TableHead>

            {customers.map((customer) => {
              const inaktiv = !customer.is_active;
              // PostgREST liefert die Anzahl als einelementige Liste.
              const vorgaenge = customer.tickets[0]?.count ?? 0;

              return (
                <TableRow
                  key={customer.id}
                  columns={COLUMNS}
                  href={paths.customer(customer.id)}
                >
                  <TableCell
                    className={`text-base ${inaktiv ? "text-muted" : "text-foreground"}`}
                  >
                    {customer.name}
                  </TableCell>

                  <TableCell className="text-sm text-muted">
                    {vorgaenge} {vorgaenge === 1 ? "Vorgang" : "Vorgänge"}
                  </TableCell>

                  <TableCell className="text-sm text-muted">
                    {inaktiv ? "stillgelegt" : "aktiv"}
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>

          <p className="mt-4 max-w-[42rem] text-[12.5px] leading-[1.5] text-muted">
            Stillgelegte Kunden sind gedämpft, aber vollständig lesbar — ihre
            Vorgänge bestehen weiter und brauchen eine Zuordnung. Neue Tickets
            lassen sich auf sie nicht mehr anlegen.
          </p>
        </>
      )}
    </AppShell>
  );
}
