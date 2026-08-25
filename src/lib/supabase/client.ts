import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { type Database } from "@/types/database";

/**
 * Supabase-Client für den Browser.
 *
 * In Release 1 liest die Anwendung **nicht** aus dem Browser -- jede Abfrage
 * läuft über eine Server-Komponente oder eine Server Action. Der Client wird
 * trotzdem gebraucht: Die Auffrischung des Zugriffstokens im Browser hängt an
 * ihm, und ohne ihn liefe eine Sitzung nach einer Stunde still aus, solange
 * niemand navigiert.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
