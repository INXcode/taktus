"use server";
export async function loescheTicket(id: string) {
  const db = await createClient();
  return db.from("tickets").delete().eq("id", id);
}
