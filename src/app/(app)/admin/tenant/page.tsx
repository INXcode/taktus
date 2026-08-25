import { type Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { TenantSettingsForm } from "@/components/tenant/tenant-settings-form";
import { operatorAiEnabled } from "@/lib/ai/config";
import { requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mandant · Taktus Kontor" };

/**
 * Bildschirm 18 -- Mandanteneinstellungen. Nur `admin`.
 *
 * Zwei Quellen, und die Trennung ist beabsichtigt: Die Freigabe des Mandanten
 * steht in `tenants` und ist über RLS erreichbar; der Schalter des Betreibers
 * steht in `ai_config` und ist es nicht. Deshalb kommt das eine über den
 * Nutzer-Client und das andere über genau eine gekapselte Funktion.
 */
export default async function TenantSettingsPage() {
  const viewer = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, ticket_retention_days, audit_retention_days, ai_enabled")
    .eq("id", viewer.tenantId)
    .maybeSingle();

  const operatorEnabled = await operatorAiEnabled();

  return (
    <AppShell viewer={viewer} title="Mandant">
      <h1 className="mb-5 text-4xl font-bold">Mandant</h1>

      {tenant === null ? (
        // Nicht „den Mandanten gibt es nicht" -- ein entzogenes Leserecht
        // liefert dieselben null Zeilen wie eine fehlende Zeile. Die
        // Formulierung beschreibt deshalb die Ansicht, nicht die Welt.
        <EmptyState
          shows="Diese Ansicht zeigt keine Mandanteneinstellungen."
          doesNotMean="Das kann daran liegen, dass Ihr Zugang zwischenzeitlich geändert wurde. Melden Sie sich neu an; bleibt die Ansicht leer, wenden Sie sich an den Betreiber der Instanz."
        />
      ) : (
        <TenantSettingsForm
          settings={{
            name: tenant.name,
            ticketRetentionDays: tenant.ticket_retention_days,
            auditRetentionDays: tenant.audit_retention_days,
            aiEnabled: tenant.ai_enabled,
          }}
          operatorAiEnabled={operatorEnabled}
        />
      )}
    </AppShell>
  );
}
