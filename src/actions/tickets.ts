"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AI_FIELD_SUMMARY,
  applyReview,
  markField,
} from "@/lib/ai/marked-fields";
import { verifySuggestion } from "@/lib/ai/provenance";
import { changedFields, logAudit } from "@/lib/audit";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  createReportSchema,
  createTicketSchema,
  deleteTicketSchema,
  reviewAiSummarySchema,
  ticketContentSchema,
  ticketMetaSchema,
} from "@/lib/validation/ticket";
import { type FormResult } from "@/types";
import { type Database } from "@/types/database";

/**
 * Status, Kategorie und Zuweisung -- die rechte Spalte aus Bildschirm 9.
 *
 * Eine Action für alle drei Felder. Der Entwurf hält fest, dass Änderungen
 * „im Protokoll mit dem Feldnamen vermerkt" werden; drei getrennte Actions
 * ergäben drei Einträge für einen Vorgang, der fachlich einer ist.
 *
 * **Kein `closed_at`.** Das setzt der Trigger `tickets_before_update`, und
 * zwar genau dann, wenn der Status auf `closed` wechselt. Die Anwendung
 * schreibt es nicht mit -- sonst gäbe es zwei Stellen, die dieselbe Regel
 * kennen, und eine davon liefe irgendwann auseinander. Am Schließzeitpunkt
 * hängt die Aufbewahrungsfrist.
 */
export async function updateTicketMeta(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(["admin", "agent"]);

  const parsed = ticketMetaSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
    category: formData.get("category"),
    customerId: formData.get("customerId"),
    assigneeId: formData.get("assigneeId") ?? "",
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  // Vorher lesen, um die geänderten Feldnamen zu ermitteln. Die Werte selbst
  // verlassen diese Funktion nicht -- ins Protokoll gehen nur Namen.
  const { data: before, error: readError } = await supabase
    .from("tickets")
    .select("status, category, customer_id, assignee_id, ticket_number")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();

  if (readError) {
    console.error("Ticket konnte nicht gelesen werden", {
      code: readError.code,
    });
    return fail(mapDatabaseError(readError));
  }

  // Kein Treffer heisst hier nicht „gibt es nicht", sondern „für Sie nicht
  // sichtbar" -- die Policy liefert stumm null Zeilen. Beides fühlt sich für
  // den Aufrufer gleich an, und mehr lässt sich ehrlich nicht sagen.
  if (!before) {
    return fail("Dieses Ticket ist nicht erreichbar.");
  }

  // Ein Kunde aus einem fremden Mandanten kommt hier nicht durch: Der
  // zusammengesetzte Fremdschlüssel `(tenant_id, customer_id)` weist ihn ab.
  // Die Action prüft das deshalb nicht noch einmal nach -- eine zweite,
  // schwächere Prüfung neben der verbindlichen wäre nur eine weitere Stelle,
  // die veralten kann.
  const patch = {
    status: parsed.data.status,
    category: parsed.data.category,
    customer_id: parsed.data.customerId,
    assignee_id: parsed.data.assigneeId,
  };

  const fields = changedFields(before, patch);
  if (fields.length === 0) {
    return ok(undefined);
  }

  const { error } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", parsed.data.ticketId);

  if (error) {
    console.error("Ticket konnte nicht geändert werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "ticket.update",
    "ticket",
    parsed.data.ticketId,
    fields,
  );

  revalidatePath(paths.ticket(before.ticket_number));
  revalidatePath(paths.tickets);

  // `viewer` wird nicht weiter gebraucht -- die Rollenprüfung oben ist der
  // Zweck des Aufrufs, nicht sein Rückgabewert.
  void viewer;
  return ok(undefined);
}

/**
 * Ticket anlegen -- Bildschirm 8.
 *
 * Alle drei Rollen dürfen das. Für den Melder werden `customerId` und
 * `assigneeId` **gar nicht erst gelesen**, statt die Werte zu ignorieren: Was
 * nicht aus dem Formular kommt, kann auch nicht versehentlich durchrutschen,
 * wenn das Formular später einmal umgebaut wird. Deshalb zwei Schemata statt
 * eines mit Sonderfällen.
 *
 * Beim Kunden ist das mehr als Sorgfalt: Ein Melder gehört zu genau einem
 * Kunden, und der steht in seinem Profil. Verlässlich ist das aber erst durch
 * den Trigger `tickets_before_insert`, der den Wert setzt und dabei
 * überschreibt, was mitgeschickt wurde -- diese Action ist die bequeme
 * Hälfte, nicht die verbindliche.
 *
 * Nummer, Melder und Status setzt der Server. `ticket_number` vergibt ein
 * Trigger je Mandant fortlaufend; `status` steht per Vorgabe auf `open`.
 */
export async function createTicket(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(ALL_ROLES);
  const istMelder = viewer.role === "requester";

  const gemeinsam = {
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    aiSummary: formData.get("aiSummary") ?? "",
    aiToken: formData.get("aiToken") ?? "",
  };

  const parsed = istMelder
    ? createReportSchema.safeParse(gemeinsam)
    : createTicketSchema.safeParse({
        ...gemeinsam,
        customerId: formData.get("customerId"),
        assigneeId: formData.get("assigneeId") ?? "",
      });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  /*
   * Eine übernommene Zusammenfassung wird **gekennzeichnet**, nicht nur
   * gespeichert.
   *
   * `ai_marked_fields` heisst „von der KI und noch ungeprüft". Beim Anlegen
   * ist das zutreffend, obwohl gerade jemand „Übernehmen" gedrückt hat:
   * Übernehmen ist die Entscheidung, den Text zu behalten -- gelesen und für
   * richtig befunden ist er damit noch nicht. Die Kennzeichnung fällt beim
   * ersten Speichern durch einen Menschen.
   *
   * Die Kategorie bekommt **keinen** Eintrag: Für sie gibt es keine Spalte mit
   * Modellausgabe, der Vorschlag lebte nur im Formular, und dort *war*
   * „Übernehmen" bereits die Prüfung.
   *
   * > [!important] Gekennzeichnet wird nur, was sich als Modellausgabe
   * > **belegen** lässt.
   * > Das versteckte Feld allein belegt nichts -- zwischen Vorschlag und
   * > Absenden liegt der Rechner des Nutzers. Ohne gültigen Nachweis wäre
   * > „von der KI, ungeprüft" eine Angabe, die der Datensatz nicht halten
   * > kann, und `ai_model`/`ai_generated_at` blieben leer, obwohl das Schema
   * > sie als Herkunftsnachweis führt (Art. 5 Abs. 2 DSGVO).
   */
  const herkunft =
    parsed.data.aiSummary === ""
      ? null
      : verifySuggestion(parsed.data.aiToken, {
          summary: parsed.data.aiSummary,
          category: parsed.data.category,
          userId: viewer.userId,
        });

  /*
   * Abgewiesen statt stillschweigend entkennzeichnet.
   *
   * Die Alternative wäre, den Text ohne Kennzeichnung zu speichern. Das wäre
   * das schlechtere Ergebnis: Ein Modelltext ohne Hinweis darauf ist genau
   * das, wogegen die Kennzeichnung existiert. Wer den Vorschlag behalten
   * will, holt ihn neu -- der häufigste echte Grund hierfür ist ein
   * abgelaufener Nachweis, und das ist eine halbe Minute Arbeit.
   */
  if (parsed.data.aiSummary !== "" && herkunft === null) {
    return {
      ok: false,
      error:
        "Der Vorschlag konnte nicht als Modellausgabe bestätigt werden und wurde nicht übernommen.",
      fields: {
        aiSummary:
          "Bitte den Vorschlag erneut abrufen und übernehmen — oder das Ticket ohne Zusammenfassung anlegen.",
      },
    };
  }

  /*
   * `ticket_number` wird bewusst NICHT mitgeschickt.
   *
   * Die Spalte ist `NOT NULL` ohne DEFAULT; den Wert vergibt der Trigger
   * `tickets_before_insert` je Mandant fortlaufend, und zwar nur, wenn nichts
   * dasteht. Dass das trotz `NOT NULL` aufgeht, steht in der Migration:
   * BEFORE-ROW-Trigger laufen in Postgres VOR der Auswertung von NOT NULL.
   *
   * Der Typgenerator kennt keine Trigger und verlangt die Spalte deshalb. Der
   * Umweg über `satisfies Omit<…>` hält die übrigen Felder voll geprüft --
   * ein Tippfehler im Spaltennamen fiele weiterhin auf -- und die Ausnahme
   * bleibt auf genau diese eine Spalte begrenzt.
   */
  type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];

  /*
   * Kunde und Zuweisung nur, wenn sie überhaupt erhoben wurden.
   *
   * `customerId === null` heisst „aus dem Meldeformular" -- dort gibt es
   * beides nicht. Dann bleibt `assignee_id` bei der Vorgabe NULL, und
   * `customer_id` fehlt im Rumpf, damit der Trigger ihn aus dem Profil setzt.
   */
  const zuordnung: Partial<Pick<TicketInsert, "customer_id" | "assignee_id">> =
    parsed.data.customerId === null
      ? {}
      : {
          customer_id: parsed.data.customerId,
          assignee_id: parsed.data.assigneeId,
        };

  const payload = {
    tenant_id: viewer.tenantId,
    created_by: viewer.userId,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    ...zuordnung,
    ...(herkunft !== null
      ? {
          ai_summary: parsed.data.aiSummary,
          // Aus dem Nachweis, nicht aus dem Formular. Der CHECK
          // `tickets_ai_herkunft_vollstaendig` verlangt beide Spalten, sobald
          // eine Zusammenfassung dasteht.
          ai_model: herkunft.model,
          ai_generated_at: herkunft.generatedAt,
          ai_marked_fields: markField([], AI_FIELD_SUMMARY) as string[],
        }
      : {}),
  } satisfies Omit<TicketInsert, "ticket_number" | "customer_id"> &
    Partial<Pick<TicketInsert, "customer_id">>;

  const { data, error } = await supabase
    .from("tickets")
    .insert(payload as TicketInsert)
    .select("id, ticket_number")
    .single();

  if (error) {
    console.error("Ticket konnte nicht angelegt werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "ticket.create", "ticket", data.id);

  revalidatePath(paths.tickets);
  // `redirect` wirft -- kein `return` danach, und nichts in einem try/catch.
  redirect(paths.ticket(data.ticket_number));
}

/**
 * Titel und Beschreibung ändern.
 *
 * Für den Melder gilt zusätzlich: **nur solange der Status `open` ist.** Das
 * erzwingt die Policy `tickets_update_eigene`, nicht diese Action -- sie
 * schickt die Änderung ab und übersetzt die Ablehnung. Der Grund für die
 * Regel ist das Schließen: Es startet die Aufbewahrungsfrist, und deshalb
 * gehört es der Bearbeitung.
 */
export async function updateTicketContent(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(ALL_ROLES);

  const parsed = ticketContentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data: before, error: readError } = await supabase
    .from("tickets")
    .select("title, description, ticket_number")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();

  if (readError) {
    console.error("Ticket konnte nicht gelesen werden", {
      code: readError.code,
    });
    return fail(mapDatabaseError(readError));
  }
  if (!before) return fail("Dieses Ticket ist nicht erreichbar.");

  const patch = {
    title: parsed.data.title,
    description: parsed.data.description,
  };
  const fields = changedFields(before, patch);
  if (fields.length === 0) return ok(undefined);

  const { error } = await supabase
    .from("tickets")
    .update(patch)
    .eq("id", parsed.data.ticketId);

  if (error) {
    console.error("Ticket konnte nicht geändert werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(
    supabase,
    "ticket.update",
    "ticket",
    parsed.data.ticketId,
    fields,
  );

  revalidatePath(paths.ticket(before.ticket_number));
  revalidatePath(paths.tickets);
  return ok(undefined);
}

/**
 * Die KI-Zusammenfassung prüfen -- der Übergang markiert → geprüft.
 *
 * > [!important] Das Speichern **ist** die Prüfung.
 * > `ai_marked_fields` heisst „von der KI und noch ungeprüft". Wer den Text
 * > gelesen, gegebenenfalls berichtigt und gespeichert hat, hat hingesehen --
 * > und genau das belegt der Eintrag, der danach fehlt. Es gibt deshalb
 * > keinen zusätzlichen „Gelesen"-Knopf: Der belegte, dass jemand geklickt
 * > hat, nicht dass jemand hingesehen hat.
 *
 * Nur Bearbeitung und Verwaltung. Der Melder darf sein offenes Ticket ändern,
 * aber die Prüfung eines Modellvorschlags gehört zu dem, der den Vorgang
 * bearbeitet -- die Policy erlaubt ihm das Schreiben, diese Stufe nicht.
 */
export async function reviewAiSummary(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(["admin", "agent"]);

  const parsed = reviewAiSummarySchema.safeParse({
    ticketId: formData.get("ticketId"),
    aiSummary: formData.get("aiSummary"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("tickets")
    .select("ai_summary, ai_marked_fields, ticket_number")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();

  if (!before) return fail("Dieses Ticket ist nicht erreichbar.");

  /*
   * Diese Stufe prüft einen vorhandenen Vorschlag -- sie legt keinen an.
   *
   * Ohne die Abfrage liefe der Aufruf gegen den CHECK
   * `tickets_ai_herkunft_vollstaendig`: Eine Zusammenfassung ohne Modell und
   * Zeitpunkt lässt die Datenbank nicht mehr zu. Sie würde also ohnehin
   * scheitern, nur mit einer Datenbankmeldung statt mit einem Satz, der sagt,
   * was los ist. Erreichbar ist der Fall nur an der Oberfläche vorbei -- eine
   * Server Action ist ein offener Endpunkt, und dass Bildschirm 10 das
   * Formular gar nicht erst zeigt, ist keine Prüfung.
   */
  if (before.ai_summary === null) {
    return fail("Für dieses Ticket gibt es keinen Vorschlag zu prüfen.");
  }

  const marked = applyReview(before.ai_marked_fields, AI_FIELD_SUMMARY);
  const textGeaendert = before.ai_summary !== parsed.data.aiSummary;

  const { error } = await supabase
    .from("tickets")
    .update({
      ai_summary: parsed.data.aiSummary,
      ai_marked_fields: [...marked],
    })
    .eq("id", parsed.data.ticketId);

  if (error) {
    console.error("Zusammenfassung nicht gespeichert", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  // Protokolliert werden die Namen der Felder, die sich geändert haben --
  // `ai_marked_fields` immer, denn die Kennzeichnung ist der eigentliche
  // Vorgang; `ai_summary` nur, wenn der Text tatsächlich ein anderer ist.
  await logAudit(supabase, "ticket.update", "ticket", parsed.data.ticketId, [
    ...(textGeaendert ? ["ai_summary"] : []),
    "ai_marked_fields",
  ]);

  revalidatePath(paths.ticket(before.ticket_number));
  return ok(undefined);
}

/**
 * Ticket löschen -- Bildschirm 11, nur Verwaltung.
 *
 * Die Folgen werden **serverseitig nachgezählt** und die getippte Nummer
 * serverseitig verglichen. Beides könnte die Oberfläche auch, und beides
 * gehört trotzdem hierher: Die Zahlen im Dialog stammen aus einer früheren
 * Abfrage und können veraltet sein, und eine Bestätigung, die nur im Browser
 * geprüft wird, ist keine.
 *
 * Der Protokolleintrag entsteht **vor** dem Löschen. `audit_log` hängt nicht
 * am Ticket und überlebt es deshalb -- aber `log_audit` braucht einen
 * Mandantenbezug, und den soll es haben, solange die Zeile noch steht.
 */
export async function deleteTicket(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  await requireRole(["admin"]);

  const parsed = deleteTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    confirmation: formData.get("confirmation") ?? "",
  });

  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();

  const { data: ticket, error: readError } = await supabase
    .from("tickets")
    .select("ticket_number")
    .eq("id", parsed.data.ticketId)
    .maybeSingle();

  if (readError) {
    console.error("Ticket konnte nicht gelesen werden", {
      code: readError.code,
    });
    return fail(mapDatabaseError(readError));
  }
  if (!ticket) return fail("Dieses Ticket ist nicht erreichbar.");

  // „#12" und „12" sind beide gemeint -- der Entwurf zeigt die Raute im Feld.
  const getippt = parsed.data.confirmation.replace(/^#/u, "");
  if (getippt !== String(ticket.ticket_number)) {
    return {
      ok: false,
      error: "Die Nummer stimmt nicht. Es wurde nichts gelöscht.",
      fields: { confirmation: `Bitte ${ticket.ticket_number} eingeben.` },
    };
  }

  await logAudit(supabase, "ticket.delete", "ticket", parsed.data.ticketId);

  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", parsed.data.ticketId);

  if (error) {
    console.error("Ticket konnte nicht gelöscht werden", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  revalidatePath(paths.tickets);
  redirect(paths.tickets);
}
