import { type Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import {
  TicketForm,
  type AssigneeChoice,
} from "@/components/tickets/ticket-form";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { loadCustomerOptions, type CustomerOption } from "@/lib/customers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ticket anlegen · Taktus Kontor" };

/**
 * Bildschirm 8 -- Ticket anlegen.
 *
 * Für den Melder ist das Formular kürzer: weder Zuweisung noch Kunde. Nicht
 * gesperrt, sondern nicht vorhanden -- er sieht die Namen im Mandanten ohnehin
 * nicht, und ein ausgegrautes Feld verriete Struktur, die ihn nichts angeht.
 *
 * Beim Kunden kommt hinzu, dass er keine Wahl hat: Er gehört zu genau einem,
 * und der steht in seinem Profil. Gesetzt wird er in der Datenbank vom Trigger
 * `tickets_before_insert` -- ein untergeschobenes Formularfeld läuft ins Leere.
 */
export default async function NewTicketPage() {
  const viewer = await requireRole(ALL_ROLES);
  const istMelder = viewer.role === "requester";

  // Beides gibt es für den Melder nicht -- weder Zuweisung noch Kunde. Die
  // Abfragen bleiben deshalb aus, statt leere Listen zu erzeugen.
  let assignees: readonly AssigneeChoice[] = [];
  let customers: readonly CustomerOption[] = [];
  if (!istMelder) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .is("deactivated_at", null)
      .order("display_name");
    assignees = (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
    }));
    // Nur aktive Kunden: Ein stillgelegter Kunde soll keine neuen Vorgänge
    // mehr bekommen -- das ist der Zweck der Stilllegung.
    customers = await loadCustomerOptions(supabase);
  }

  return (
    <AppShell
      viewer={viewer}
      title={istMelder ? "Meldung anlegen" : "Ticket anlegen"}
    >
      <div className="mb-6">
        <h1 className="text-4xl font-bold">
          {istMelder ? "Meldung anlegen" : "Ticket anlegen"}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {viewer.tenantName} · Nummer wird beim Speichern vergeben
        </p>
      </div>

      {/*
        `aiEnabled` ist die Freigabe des **Mandanten** und kommt aus der
        Sitzung. Die des Betreibers steht in `ai_config` und wird erst in der
        Action geprüft -- sie hier zu lesen hiesse, den Admin-Client für einen
        Bildschirmzustand zu bemühen.
      */}
      <TicketForm
        mode="create"
        assignees={assignees}
        customers={customers}
        isRequester={istMelder}
        aiEnabled={viewer.aiEnabled}
      />
    </AppShell>
  );
}
