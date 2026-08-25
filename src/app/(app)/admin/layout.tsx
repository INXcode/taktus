import { type ReactNode } from "react";
import { requireRole } from "@/lib/auth/guard";

/**
 * Wächterstufe 2 für die Verwaltung.
 *
 * Es gibt keine mandantenübergreifende Rolle: Ein Administrator verwaltet
 * ausschließlich den eigenen Mandanten, und die Trennung erzwingt die
 * Datenbank -- diese Prüfung entscheidet nur, wer den Bereich überhaupt
 * sieht.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole(["admin"]);
  return <>{children}</>;
}
