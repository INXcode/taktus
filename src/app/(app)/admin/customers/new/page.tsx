import { type Metadata } from "next";
import { CreateCustomerForm } from "@/components/customers/create-customer-form";
import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Kunde anlegen · Taktus Kontor" };

/** Bildschirm 27 -- Kunde anlegen. */
export default async function NewCustomerPage() {
  const viewer = await requireRole(["admin"]);

  return (
    <AppShell viewer={viewer} title="Kunde anlegen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Kunde anlegen</h1>
        <p className="mt-1.5 text-sm text-muted">{viewer.tenantName}</p>
      </div>
      <CreateCustomerForm />
    </AppShell>
  );
}
