import { type ReactNode } from "react";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";

/**
 * Wächterstufe 2 für alles Angemeldete.
 *
 * Der Rahmen aus Bildschirm 5 steht bewusst **nicht** hier, sondern in jeder
 * Seite: Kopfzeile und Hauptaktion sind je Bildschirm verschieden, und ein
 * Layout kann von seiner Seite nichts entgegennehmen. Der Preis sind zwei
 * Zeilen je Seite; der Gewinn ist, dass jeder Bildschirm für sich lesbar
 * bleibt.
 *
 * Diese Prüfung ersetzt nicht die in den Seiten. Bei clientseitiger
 * Navigation zwischen Geschwisterseiten rendert Next das Layout nicht neu --
 * wer sich darauf verliesse, prüfte einmal und danach nie wieder.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await requireRole(ALL_ROLES);
  return <>{children}</>;
}
