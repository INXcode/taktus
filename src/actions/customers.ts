"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changedFields, logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  createCustomerSchema,
  setCustomerActiveSchema,
  updateCustomerSchema,
} from "@/lib/validation/customer";
import { type FormResult } from "@/types";

/**
 * Kundenstamm -- Bildschirme 26 bis 28. Nur `admin`.
 *
 * Wie die Mandanteneinstellungen und anders als die Nutzerverwaltung
 * **ohne** Admin-Client: Die Policies `customers_insert_admin` und
 * `customers_update_admin` erlauben genau diese Änderungen und binden die
 * Zeile über die WITH-CHECK-Klausel an denselben Mandanten. Der
 * Service-Role-Schlüssel bleibt hier weg -- er ist kein Werkzeug, das man
 * nimmt, weil es zur Hand liegt.
 *
 * Es gibt bewusst kein `deleteCustomer`. Ein Kunde mit Vorgängen darf nicht
 * verschwinden; der Fremdschlüssel `ON DELETE RESTRICT` würde es ohnehin
 * abweisen. Statt zu löschen wird stillgelegt -- siehe `setCustomerActive`.
 */
export async function createCustomer(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin"]);

  const parsed = createCustomerSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .insert({ tenant_id: viewer.tenantId, name: parsed.data.name })
    .select("id")
    .single();

  if (error) {
    console.error("Kunde konnte nicht angelegt werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "customer.create", "customer", data.id);

  // Auch die Ticketpfade: Dort steht der neue Kunde in der Auswahl und im
  // Filter. Ohne diese Zeile taucht er erst nach einem harten Neuladen auf --
  // was aussieht, als wäre er nicht angelegt worden.
  revalidatePath(paths.customers);
  revalidatePath(paths.tickets);
  revalidatePath(paths.newTicket);
  revalidatePath(paths.newMember);
  // `redirect` wirft -- kein `return` danach, und nichts in einem try/catch.
  redirect(paths.customers);
}

/** Umbenennen. Der Name ist das einzige Feld, das ein Kunde trägt. */
export async function updateCustomer(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(["admin"]);

  const parsed = updateCustomerSchema.safeParse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  // Vorher lesen, um die geänderten Feldnamen zu ermitteln. Die Werte selbst
  // verlassen diese Funktion nicht -- ins Protokoll gehen nur Namen.
  const { data: before, error: readError } = await supabase
    .from("customers")
    .select("name")
    .eq("id", parsed.data.customerId)
    .maybeSingle();

  if (readError) {
    console.error("Kunde konnte nicht gelesen werden", {
      code: readError.code,
    });
    return fail(mapDatabaseError(readError));
  }

  // Kein Treffer heisst hier nicht „gibt es nicht", sondern „für Sie nicht
  // sichtbar" -- die Policy liefert stumm null Zeilen.
  if (!before) return fail("Dieser Kunde ist nicht erreichbar.");

  const patch = { name: parsed.data.name };
  const fields = changedFields(before, patch);
  if (fields.length === 0) return ok(undefined);

  const { error } = await supabase
    .from("customers")
    .update(patch)
    .eq("id", parsed.data.customerId);

  if (error) {
    console.error("Kunde konnte nicht geändert werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "customer.update",
    "customer",
    parsed.data.customerId,
    fields,
  );

  revalidatePath(paths.customers);
  revalidatePath(paths.customer(parsed.data.customerId));
  revalidatePath(paths.tickets);

  return ok(undefined);
}

/**
 * Stilllegen und wieder aufnehmen.
 *
 * Das Gegenstück zum fehlenden Löschen. Ein stillgelegter Kunde verschwindet
 * aus jeder Auswahlliste, bleibt aber an seinen Vorgängen sichtbar -- sonst
 * trüge ein abgeschlossenes Ticket plötzlich eine leere Zuordnung, und die
 * Aufbewahrungsfrist liefe an einer Zeile ab, die niemand mehr einordnen kann.
 *
 * Kein Sonderfall für „letzter Kunde": Anders als bei der letzten Verwaltung
 * sperrt sich hier niemand aus. Ein Mandant ohne aktiven Kunden kann kein
 * neues Ticket anlegen, und das ist eine nachvollziehbare Folge, kein
 * verlorener Zugang.
 */
export async function setCustomerActive(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(["admin"]);

  const parsed = setCustomerActiveSchema.safeParse({
    customerId: formData.get("customerId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ is_active: parsed.data.active === "ja" })
    .eq("id", parsed.data.customerId);

  if (error) {
    console.error("Zustand des Kunden nicht geändert", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "customer.update",
    "customer",
    parsed.data.customerId,
    ["is_active"],
  );

  // Ein stillgelegter Kunde verschwindet aus den Auswahllisten, ein wieder
  // aufgenommener taucht dort auf -- beides gehört sofort sichtbar.
  revalidatePath(paths.customers);
  revalidatePath(paths.customer(parsed.data.customerId));
  revalidatePath(paths.tickets);
  revalidatePath(paths.newTicket);
  revalidatePath(paths.newMember);

  return ok(undefined);
}
