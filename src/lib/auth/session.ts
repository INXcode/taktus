import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type AppRole } from "@/types";

/**
 * Wer gerade arbeitet -- und in welchem Mandanten.
 *
 * Bewusst schmal: Anzeigename, Rolle, Mandant und die KI-Freigabe. Alles
 * andere holt die Seite, die es braucht. Ein breiter Sitzungsgegenstand
 * verführt dazu, Daten mitzuschleppen, deren Zweck niemand mehr benennen kann
 * -- und Datenminimierung ist hier kein Schmuck, sondern die Hausregel.
 */
export type Viewer = {
  readonly userId: string;
  readonly role: AppRole;
  readonly displayName: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly aiEnabled: boolean;
};

/**
 * Warum der Zugang entzogen ist. Bestimmt die Rückmeldung an der Anmeldung.
 *
 * `deactivated` und `none` auseinanderzuhalten geht, weil die Policy
 * `profiles_select_eigenes` nur `id = auth.uid()` prüft und **keinen**
 * Mandantenbezug -- ein deaktiviertes Profil liest seine eigene Zeile also
 * weiter. Der Mandant dahinter ist dann unsichtbar, weil
 * `current_tenant_id()` für ein deaktiviertes Profil NULL liefert.
 */
export type ViewerAbsence = "none" | "deactivated";

export type ViewerResult =
  | { readonly viewer: Viewer }
  | { readonly viewer: null; readonly reason: ViewerAbsence };

/**
 * In `cache()` gewickelt, damit Layout, Seite und verschachtelte
 * Server-Komponenten sich **einen** Datenbankzugriff teilen. Der Cache gilt
 * je Anfrage; eine Server Action bekommt ihren eigenen und sieht damit nie
 * den Stand einer fremden Anfrage.
 */
export const getViewerResult = cache(async (): Promise<ViewerResult> => {
  const supabase = await createClient();

  // Immer `getUser()`. `getSession()` liest das Cookie, ohne es zu prüfen --
  // und ein Cookie ist Nutzereingabe. Was hier herauskommt, ist die Grundlage
  // jeder Rollenentscheidung; sie darf nicht auf einem ungeprüften Wert
  // stehen.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { viewer: null, reason: "none" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, role, display_name, tenant_id, deactivated_at, tenants (name, ai_enabled)",
    )
    .eq("id", user.id)
    .maybeSingle();

  // Nur der Fehlercode. Die Meldung von PostgREST kann Zeileninhalte
  // zurückwerfen, und Personenbezug im Log ist ein eigenes Risiko
  // (docs/security.md, Kapitel F).
  if (error) {
    console.error("Profil konnte nicht geladen werden", { code: error.code });
    return { viewer: null, reason: "none" };
  }

  if (!data) {
    // Angemeldet, aber ohne Profil: ein Anmeldedatensatz ohne Mandanten. Das
    // ist kein Nutzer dieser Anwendung.
    return { viewer: null, reason: "none" };
  }

  // Zwei Wege in denselben Zustand: Das Profil ist stillgelegt, oder der
  // Mandant ist gesperrt. Im zweiten Fall bleibt die eingebettete Zeile leer,
  // weil `tenants_select_eigener` an `current_tenant_id()` hängt und diese
  // Funktion für einen gesperrten Mandanten NULL liefert.
  if (data.deactivated_at !== null || data.tenants === null) {
    return { viewer: null, reason: "deactivated" };
  }

  return {
    viewer: {
      userId: data.id,
      role: data.role,
      displayName: data.display_name,
      tenantId: data.tenant_id,
      tenantName: data.tenants.name,
      aiEnabled: data.tenants.ai_enabled,
    },
  };
});

/** Kurzform für Stellen, die den Grund einer Abwesenheit nicht brauchen. */
export async function getViewer(): Promise<Viewer | null> {
  return (await getViewerResult()).viewer;
}
