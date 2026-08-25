import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerOperations } from "@/components/customers/customer-operations";
import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guard";
import { formatDate } from "@/lib/format/datetime";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Kunde bearbeiten · Taktus Kontor",
};

/** Bildschirm 28 -- Kunde bearbeiten. */
export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireRole(["admin"]);
  const { id } = await params;

  const supabase = await createClient();

  // Unter RLS: Findet die Abfrage die Zeile nicht, gehört sie nicht zu diesem
  // Mandanten -- oder es gibt sie nicht. Beides endet hier gleich.
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!customer) notFound();

  // Was an diesem Kunden hängt. Zwei Zählungen, keine Zeilen.
  const [tickets, members] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id),
  ]);

  return (
    <AppShell viewer={viewer} title="Kunde bearbeiten">
      <nav
        aria-label="Brotkrumen"
        className="mb-3.5 flex items-center gap-2.5 text-sm text-muted"
      >
        <Link href={paths.customers} className="font-semibold">
          Kunden
        </Link>
        <span aria-hidden="true">/</span>
        <span>{customer.name}</span>
      </nav>

      <div className="mb-6 border-b border-border pb-5">
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Kunde seit {formatDate(customer.created_at)} ·{" "}
          {customer.is_active ? "aktiv" : "stillgelegt"} · {viewer.tenantName}
        </p>
      </div>

      <CustomerOperations
        customerId={customer.id}
        name={customer.name}
        isActive={customer.is_active}
        ticketCount={tickets.count ?? 0}
        memberCount={members.count ?? 0}
      />
    </AppShell>
  );
}
