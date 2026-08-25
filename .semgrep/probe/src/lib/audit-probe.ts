export async function protokolliere(db: Client, alt: string, neu: string) {
  await db.from("audit_log").insert({
    action: "ticket.update",
    entity_type: "ticket",
    old_value: alt,
    new_value: neu,
  });
}
export async function protokolliereGut(db: Client) {
  await db.from("audit_log").insert({
    action: "ticket.update",
    entity_type: "ticket",
    changed_fields: ["title", "status"],
  });
}
