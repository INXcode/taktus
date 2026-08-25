import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@/types/database";

/**
 * Die Kundenliste für Auswahlfelder und Filter.
 *
 * An vier Stellen gebraucht -- Ticketliste, Ticket anlegen, Ticketdetail,
 * Nutzerverwaltung -- und deshalb hier und nicht viermal abgeschrieben.
 *
 * Läuft über den **normalen** Client und damit unter RLS: Die Policy
 * `customers_select_mandant` schneidet auf den eigenen Mandanten zu. Diese
 * Funktion filtert deshalb nicht nach `tenant_id`; sie fragt schlicht, und die
 * Antwort ist bereits zugeschnitten.
 *
 * Für einen Melder liefert sie genau seinen eigenen Kunden
 * (`customers_select_eigener`). Aufgerufen wird sie dort trotzdem nicht -- er
 * wählt nirgends einen Kunden aus.
 */
export type CustomerOption = {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
};

/*
 * Der Client kommt als Parameter und wird **nicht** hier erzeugt.
 *
 * Sonst zöge ein Client-Bauteil, das nur `CustomerOption` braucht,
 * `lib/supabase/server` ins Browser-Bündel -- und der Build bricht mit einer
 * Fehlermeldung, die auf die Komponente zeigt statt auf die Ursache. Der Typ
 * kommt deshalb aus `@supabase/supabase-js` und nicht über
 * `ReturnType<typeof createClient>`.
 */
export async function loadCustomerOptions(
  supabase: SupabaseClient<Database>,
  options: {
    /**
     * Ein stillgelegter Kunde, der an einem Ticket hängt. Er gehört in die
     * Auswahl, sonst stünde das Feld auf einem Wert, den es scheinbar nicht
     * gibt -- und ein Speichern setzte ihn stillschweigend um.
     */
    readonly zusaetzlich?: string | null;
  } = {},
): Promise<readonly CustomerOption[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, is_active")
    .order("name");

  if (error) {
    // Nur der Code. Die Meldung von PostgREST kann Zeileninhalte enthalten.
    console.error("Kundenliste konnte nicht geladen werden", {
      code: error.code,
    });
    return [];
  }

  return (data ?? [])
    .filter(
      (row) => row.is_active || row.id === (options.zusaetzlich ?? undefined),
    )
    .map((row) => ({ id: row.id, name: row.name, isActive: row.is_active }));
}
