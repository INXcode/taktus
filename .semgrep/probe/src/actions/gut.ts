"use server";
export async function loescheTicketGut(id: string) {
  const { user } = await requireRole(["admin"]);
  const db = await createClient();
  return db.from("tickets").delete().eq("id", id).eq("created_by", user.id);
}
