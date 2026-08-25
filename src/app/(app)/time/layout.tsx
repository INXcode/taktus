import { type ReactNode } from "react";
import { requireRole } from "@/lib/auth/guard";

/**
 * Wächterstufe 2 für die Zeiterfassung.
 *
 * Für den Melder existiert dieser Bereich nicht -- kein Navigationspunkt,
 * kein Reiter, kein Nur-Lesen. Er hat auf `time_entries` **keinerlei**
 * Zugriff, auch nicht lesend; die Datenbank hat für ihn dort keine Policy.
 *
 * Die Prüfung steht zusätzlich in jeder Seite darunter, weil Next dieses
 * Layout bei clientseitiger Navigation zwischen Geschwisterseiten nicht neu
 * rendert.
 */
export default async function TimeLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole(["admin", "agent"]);
  return <>{children}</>;
}
