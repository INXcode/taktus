import { redirect } from "next/navigation";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { paths } from "@/lib/paths";

/**
 * Die Wurzel hat keinen eigenen Bildschirm.
 *
 * Alle drei Rollen landen auf `/tickets` -- der Melder sieht dort „Meine
 * Meldungen", weil die Seite serverseitig verzweigt. Ein eigenes Dashboard
 * gibt es bewusst nicht: Ohne Datenbank-Views kostet jede Kennzahl eine
 * eigene Abfrage, und sechs Zahlen, die niemand für eine Entscheidung
 * braucht, sind teuer und sagen nichts.
 */
export default async function AppIndexPage() {
  await requireRole(ALL_ROLES);
  redirect(paths.tickets);
}
