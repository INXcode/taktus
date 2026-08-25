"use server";

import { revalidatePath } from "next/cache";
import { changedFields, logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  deleteTimeEntrySchema,
  timeEntrySchema,
  updateTimeEntrySchema,
} from "@/lib/validation/time-entry";
import { type FormResult } from "@/types";

/**
 * Zeitbuchungen -- Bildschirme 12, 13, 14 und 14 B.
 *
 * Für den Melder gibt es diesen Bereich **nicht**: Er hat auf `time_entries`
 * keinerlei Zugriff, auch nicht lesend, und die Tabelle hat für ihn keine
 * einzige Policy. Alle drei Actions prüfen deshalb auf `admin` und `agent`.
 *
 * Wer welche Buchung ändern oder löschen darf, entscheiden dagegen die
 * Policies und nicht diese Datei:
 *
 * - `time_entries_update_eigene` -- ändern die eigene
 * - `time_entries_update_admin` -- die Verwaltung zusätzlich fremde (seit
 *   20260809000000)
 * - `time_entries_delete_eigene` -- löschen die eigene
 * - `time_entries_delete_admin` -- die Verwaltung zusätzlich fremde
 *
 * Die Oberfläche zeigt die Abstufung an; durchgesetzt wird sie darunter.
 * **Geändert wird ausschliesslich im Ticketdetail** -- die Zeitlisten sind
 * Anzeigelisten und bieten nur noch das Löschen an.
 */

export async function createTimeEntry(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin", "agent"]);

  const parsed = timeEntrySchema.safeParse({
    ticketId: formData.get("ticketId"),
    duration: formData.get("duration") ?? "",
    workedOn: formData.get("workedOn") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      tenant_id: viewer.tenantId,
      user_id: viewer.userId,
      ticket_id: parsed.data.ticketId,
      minutes: parsed.data.duration,
      worked_on: parsed.data.workedOn,
      note: parsed.data.note,
    })
    .select("id, ticket:tickets (ticket_number)")
    .single();

  if (error) {
    console.error("Zeitbuchung konnte nicht angelegt werden", {
      code: error.code,
    });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "time_entry.create", "time_entry", data.id);

  const ticketNumber = data.ticket?.ticket_number;
  if (ticketNumber !== undefined) revalidatePath(paths.ticket(ticketNumber));
  revalidatePath(paths.myTime);
  revalidatePath(paths.tenantTime);
  revalidatePath(paths.customerTime);

  return ok(undefined);
}

export async function updateTimeEntry(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(["admin", "agent"]);

  const parsed = updateTimeEntrySchema.safeParse({
    entryId: formData.get("entryId"),
    duration: formData.get("duration") ?? "",
    workedOn: formData.get("workedOn") ?? "",
    note: formData.get("note") ?? "",
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data: before, error: readError } = await supabase
    .from("time_entries")
    .select("minutes, worked_on, note, ticket:tickets (ticket_number)")
    .eq("id", parsed.data.entryId)
    .maybeSingle();

  if (readError) {
    console.error("Buchung konnte nicht gelesen werden", {
      code: readError.code,
    });
    return fail(mapDatabaseError(readError));
  }
  if (!before) return fail("Diese Buchung ist nicht erreichbar.");

  const patch = {
    minutes: parsed.data.duration,
    worked_on: parsed.data.workedOn,
    note: parsed.data.note,
  };
  const fields = changedFields(before, patch);
  if (fields.length === 0) return ok(undefined);

  const { error } = await supabase
    .from("time_entries")
    .update(patch)
    .eq("id", parsed.data.entryId);

  if (error) {
    // Hier landet auch der Versuch eines Bearbeiters, eine FREMDE Buchung zu
    // ändern: Ihm lässt die Policy nur die eigene, der Verwaltung auch fremde.
    // Die Oberfläche bietet es gar nicht erst an -- diese Zeile ist die Grenze
    // für alle anderen Wege.
    console.error("Buchung konnte nicht geändert werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "time_entry.update",
    "time_entry",
    parsed.data.entryId,
    fields,
  );

  const ticketNumber = before.ticket?.ticket_number;
  if (ticketNumber !== undefined) revalidatePath(paths.ticket(ticketNumber));
  revalidatePath(paths.myTime);
  revalidatePath(paths.tenantTime);
  revalidatePath(paths.customerTime);

  return ok(undefined);
}

export async function deleteTimeEntry(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(["admin", "agent"]);

  const parsed = deleteTimeEntrySchema.safeParse({
    entryId: formData.get("entryId"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("time_entries")
    .select("ticket:tickets (ticket_number)")
    .eq("id", parsed.data.entryId)
    .maybeSingle();

  // Vor dem Löschen protokollieren -- der Eintrag überlebt die Zeile, aber
  // `log_audit` braucht den Mandantenbezug, solange sie noch steht.
  await logAudit(
    supabase,
    "time_entry.delete",
    "time_entry",
    parsed.data.entryId,
  );

  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", parsed.data.entryId);

  if (error) {
    console.error("Buchung konnte nicht gelöscht werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  const ticketNumber = before?.ticket?.ticket_number;
  if (ticketNumber !== undefined) revalidatePath(paths.ticket(ticketNumber));
  revalidatePath(paths.myTime);
  revalidatePath(paths.tenantTime);
  revalidatePath(paths.customerTime);

  return ok(undefined);
}
