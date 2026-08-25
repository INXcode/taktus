import { type Metadata } from "next";
import { CreateMemberForm } from "@/components/members/create-member-form";
import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guard";
import { loadCustomerOptions } from "@/lib/customers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nutzer anlegen · Taktus Kontor" };

/** Bildschirm 16 -- Nutzer anlegen. */
export default async function NewMemberPage() {
  const viewer = await requireRole(["admin"]);
  const supabase = await createClient();

  // Nur aktive Kunden: Einen neuen Nutzer an einen stillgelegten Kunden zu
  // hängen wäre das Gegenteil dessen, wozu die Stilllegung da ist.
  const customers = await loadCustomerOptions(supabase);

  return (
    <AppShell viewer={viewer} title="Nutzer anlegen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold">Nutzer anlegen</h1>
        <p className="mt-1.5 text-sm text-muted">{viewer.tenantName}</p>
      </div>
      <CreateMemberForm customers={customers} />
    </AppShell>
  );
}
