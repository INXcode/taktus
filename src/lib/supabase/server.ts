import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { type Database } from "@/types/database";

/**
 * Supabase-Client für Server-Komponenten, Server Actions und Route Handler.
 *
 * Arbeitet mit dem öffentlichen Schlüssel und damit **unter** Row Level
 * Security. Das ist der Normalfall: Jede Abfrage dieser Anwendung geht über
 * diesen Client, und die Mandantentrennung wird dabei von der Datenbank
 * durchgesetzt, nicht von der Anwendungsschicht.
 *
 * Für jeden Aufruf ein neuer Client -- niemals einen über Anfragen hinweg
 * teilen. Der Client trägt die Sitzung des Aufrufers; ein geteilter Client
 * trüge die Sitzung irgendeines vorherigen Aufrufers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
          // Die Bibliothek reicht hier `Cache-Control: private, no-store` und
          // Verwandte durch. Ohne sie darf ein CDN eine Antwort mit
          // Set-Cookie zwischenspeichern -- und liefert dann die Sitzung des
          // einen Nutzers an den nächsten aus.
          for (const [key, value] of Object.entries(headers)) {
            cookieStore.set(key, value);
          }
        } catch {
          // Aus einer Server-Komponente heraus lassen sich keine Cookies
          // setzen; Next wirft dort. Das Schlucken ist an dieser Stelle
          // richtig und nicht bequem: src/proxy.ts hat die Sitzung vor dem
          // Rendern bereits aufgefrischt und die Cookies dort geschrieben.
          // Aus einer Server Action oder einem Route Handler greift der
          // Zweig gar nicht erst.
        }
      },
    },
  });
}
