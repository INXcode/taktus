import { redirect } from "next/navigation";
import { getViewerResult, type Viewer } from "@/lib/auth/session";
import { paths } from "@/lib/paths";
import { type AppRole } from "@/types";

/**
 * Alle drei Rollen. Für Seiten und Actions, die jeder Angemeldete erreichen
 * darf -- ausgeschrieben, damit auch dieser Fall sichtbar durch
 * `requireRole()` geht.
 */
export const ALL_ROLES = [
  "admin",
  "agent",
  "requester",
] as const satisfies readonly AppRole[];

/**
 * Die Rollenprüfung. **Erste Anweisung** jeder geschützten Seite, jedes
 * Layouts, jedes Route Handlers und jeder Server Action.
 *
 * Das ist Stufe 3 der vier Wächterstufen aus docs/architektur.md, und sie ist
 * die verbindliche. Die Stufen darüber sind Bequemlichkeit:
 *
 * - `src/proxy.ts` (Stufe 1) lässt sich über `x-middleware-subrequest`
 *   umgehen (CVE-2025-29927) und deckt Server Actions ohnehin nicht
 *   zuverlässig ab.
 * - Ein Layout (Stufe 2) rendert bei clientseitiger Navigation zwischen
 *   Geschwisterseiten **nicht** neu. Wer sich darauf verlässt, prüft beim
 *   ersten Aufruf und danach nie wieder.
 *
 * Darunter liegt Stufe 4, die RLS in Postgres. Sie ist das eigentliche Netz:
 * Selbst wenn diese Funktion vergessen würde, sähe ein Melder keine fremden
 * Tickets. Was sie dann sähe, wäre allerdings ein leerer Bildschirm statt
 * einer Auskunft -- deshalb gibt es beide Ebenen.
 *
 * > [!warning] Kein `requireSession()`-Kürzel hinzufügen
 * > Die Semgrep-Regel `taktus-server-action-ohne-rollenpruefung` mustert auf
 * > den Bezeichner `requireRole(...)`. Ein Alias mit anderem Namen bestünde
 * > die Prüfung nicht -- er würde sie stillschweigend abschalten.
 */
export async function requireRole(roles: readonly AppRole[]): Promise<Viewer> {
  const result = await getViewerResult();

  if (!result.viewer) {
    // Ohne Sitzung zur Anmeldung. Der Grund wandert mit, damit die Anmeldung
    // einen entzogenen Zugang benennen kann statt „Passwort falsch" nahezulegen.
    redirect(
      result.reason === "deactivated"
        ? `${paths.login}?zugang=entzogen`
        : paths.login,
    );
  }

  if (!roles.includes(result.viewer.role)) {
    // Angemeldet, aber falsche Rolle. Eigene Seite statt `forbidden()`:
    // Letzteres verlangt `experimental.authInterrupts`, und ein
    // Experimentalschalter ist in einem Repository, dessen Argument die
    // Prüfbarkeit ist, der schlechtere Tausch.
    redirect(paths.noAccess);
  }

  return result.viewer;
}
