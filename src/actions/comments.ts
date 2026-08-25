"use server";

import { revalidatePath } from "next/cache";
import { changedFields, logAudit } from "@/lib/audit";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  createCommentSchema,
  updateCommentSchema,
} from "@/lib/validation/comment";
import { type FormResult } from "@/types";

/**
 * Einen Kommentar schreiben.
 *
 * Alle drei Rollen dürfen das -- der Melder allerdings nur an seinen eigenen
 * Tickets, und **auch dann, wenn sie nicht mehr bearbeitbar sind**. Das ist
 * Absicht: Nach dem Statuswechsel verliert er das Recht, Titel und
 * Beschreibung zu ändern, aber Ergänzungen erreichen die Bearbeitung weiterhin
 * auf diesem Weg.
 *
 * Die Einschränkung erzwingt die Policy `ticket_comments_insert_mandant` samt
 * `ticket_comments_select_eigene_tickets`, nicht diese Action. Sie prüft nur,
 * dass überhaupt jemand angemeldet ist, und lässt die Datenbank entscheiden.
 */
export async function createComment(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(ALL_ROLES);

  const parsed = createCommentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  // Mandant und Urheber werden mitgeschickt, obwohl der Trigger
  // `ticket_comments_before_insert` sie ohnehin setzt -- die erzeugten Typen
  // kennen den Trigger nicht und verlangen die Spalten.
  //
  // Das ist unbedenklich, und zwar wegen der Policy, nicht wegen des
  // Triggers: `ticket_comments_insert_mandant` prüft in WITH CHECK
  // ausdrücklich `author_id = auth.uid()` und `tenant_id =
  // current_tenant_id()`. Ein gefälschter Urheber wird also abgewiesen.
  //
  // Der Trigger allein trüge das nicht: Er setzt `author_id` nur, WENN es
  // NULL ist -- ein mitgeschickter Wert bliebe stehen. Erst die Policy macht
  // daraus eine Grenze.
  const { data, error } = await supabase
    .from("ticket_comments")
    .insert({
      ticket_id: parsed.data.ticketId,
      body: parsed.data.body,
      tenant_id: viewer.tenantId,
      author_id: viewer.userId,
    })
    .select("id, ticket:tickets (ticket_number)")
    .single();

  if (error) {
    // Kein Kommentartext ins Protokoll -- er ist Nutzereingabe und damit
    // potenziell personenbezogen.
    console.error("Kommentar konnte nicht angelegt werden", {
      code: error.code,
    });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "comment.create", "ticket_comment", data.id);

  const ticketNumber = data.ticket?.ticket_number;
  if (ticketNumber !== undefined) {
    revalidatePath(paths.ticket(ticketNumber));
  }

  return ok(undefined);
}

/**
 * Einen Kommentar berichtigen.
 *
 * Wer das darf, steht wie überall in den Policies und nicht hier: der Urheber
 * über `ticket_comments_update_eigene`, die Verwaltung zusätzlich über
 * `ticket_comments_update_admin`. Diese Action prüft nur, dass jemand
 * angemeldet ist, und lässt die Datenbank entscheiden.
 *
 * > [!important] Die Erlaubnis der Verwaltung ist seit 20260809000000 neu und
 * > kommt nicht allein.
 * > Der frühere Stand -- niemand ändert fremde Beiträge -- war mit der
 * > Beweiskraft des Verlaufs begründet. Was davon trägt, ist die **Zurechnung**,
 * > nicht die Unveränderlichkeit des Textes: Der Trigger
 * > `ticket_comments_before_update` friert den Urheber ein, dieser Aufruf
 * > protokolliert die Berichtigung mit Akteur, und `updated_at` macht sie in
 * > der Oberfläche als solche sichtbar. Eine Aussage lässt sich damit
 * > korrigieren, aber niemandem in den Mund legen.
 */
export async function updateComment(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(ALL_ROLES);

  const parsed = updateCommentSchema.safeParse({
    commentId: formData.get("commentId"),
    body: formData.get("body"),
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data: before, error: readError } = await supabase
    .from("ticket_comments")
    .select("body, ticket:tickets (ticket_number)")
    .eq("id", parsed.data.commentId)
    .maybeSingle();

  if (readError) {
    console.error("Kommentar konnte nicht gelesen werden", {
      code: readError.code,
    });
    return fail(mapDatabaseError(readError));
  }
  if (!before) return fail("Dieser Kommentar ist nicht erreichbar.");

  const patch = { body: parsed.data.body };
  // Nur die Feldnamen, nie der Text -- er ist Nutzereingabe und damit
  // potenziell personenbezogen (siehe `logAudit`).
  const fields = changedFields(before, patch);
  if (fields.length === 0) return ok(undefined);

  const { error } = await supabase
    .from("ticket_comments")
    .update(patch)
    .eq("id", parsed.data.commentId);

  if (error) {
    // Hier landet auch der Versuch eines Bearbeiters, einen fremden Beitrag zu
    // ändern: Für ihn gilt weiterhin nur `*_update_eigene`. Die Oberfläche
    // bietet es ihm nicht an -- diese Zeile ist die Grenze für alle anderen
    // Wege.
    console.error("Kommentar konnte nicht geändert werden", {
      code: error.code,
    });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "comment.update",
    "ticket_comment",
    parsed.data.commentId,
    fields,
  );

  const ticketNumber = before.ticket?.ticket_number;
  if (ticketNumber !== undefined) {
    revalidatePath(paths.ticket(ticketNumber));
  }

  return ok(undefined);
}
