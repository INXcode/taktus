"use server";

import { revalidatePath } from "next/cache";
import { changedFields, logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { updateTenantSettingsSchema } from "@/lib/validation/tenant";
import { type FormResult } from "@/types";

/**
 * Mandanteneinstellungen -- Bildschirm 18. Nur `admin`.
 *
 * Anders als die Nutzerverwaltung braucht diese Datei **keinen**
 * Admin-Client: `tenants_update_admin` erlaubt genau diese Änderung und
 * bindet die Zeile über die WITH-CHECK-Klausel an denselben Mandanten. Die
 * Datenbank trägt hier also mit, und der Service-Role-Schlüssel bleibt weg --
 * er ist kein Werkzeug, das man nimmt, weil es zur Hand liegt.
 */
export async function updateTenantSettings(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin"]);

  const parsed = updateTenantSettingsSchema.safeParse({
    name: formData.get("name"),
    ticketRetentionDays: formData.get("ticketRetentionDays"),
    auditRetentionDays: formData.get("auditRetentionDays"),
    // Ein nicht angehaktes Kästchen fehlt im FormData. `=== "ja"` liest
    // deshalb beides richtig: fehlend und abgewählt sind dasselbe.
    aiEnabled: formData.get("aiEnabled") === "ja",
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  // Der Stand vor der Änderung -- nur, um die geänderten Feldnamen zu
  // ermitteln. Die Werte selbst verlassen diese Funktion nicht; ins Protokoll
  // gehen ausschliesslich Namen.
  const { data: before } = await supabase
    .from("tenants")
    .select("name, ticket_retention_days, audit_retention_days, ai_enabled")
    .eq("id", viewer.tenantId)
    .maybeSingle();

  if (!before) {
    return fail(
      "Der Mandant ist nicht erreichbar. Bitte melden Sie sich neu an.",
    );
  }

  const after = {
    name: parsed.data.name,
    ticket_retention_days: parsed.data.ticketRetentionDays,
    audit_retention_days: parsed.data.auditRetentionDays,
    ai_enabled: parsed.data.aiEnabled,
  };

  const changed = changedFields(before, after);
  if (changed.length === 0) {
    return ok(undefined);
  }

  const { error } = await supabase
    .from("tenants")
    .update(after)
    .eq("id", viewer.tenantId);

  if (error) {
    console.error("Mandanteneinstellungen nicht gespeichert", {
      code: error.code,
    });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "tenant.update", "tenant", viewer.tenantId, changed);

  // Der Mandantenname steht in der Seitenleiste jeder Seite, und die
  // KI-Freigabe entscheidet über einen Bildschirm im Ticketformular. Beides
  // hängt an `getViewer()`, also wird der ganze Baum neu geholt.
  revalidatePath("/", "layout");
  revalidatePath(paths.tenantSettings);

  return ok(undefined);
}
