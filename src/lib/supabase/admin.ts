import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import { type Database } from "@/types/database";

/**
 * Supabase-Client mit dem Service-Role-Schlüssel.
 *
 * > [!danger] Dieser Client umgeht **sämtliche** RLS-Policies.
 * > Damit umgeht er auch die Mandantentrennung. Wer ihn benutzt, übernimmt die
 * > Autorisierung selbst -- die Datenbank hilft ab hier nicht mehr.
 *
 * Vier Schranken halten ihn an seinem Platz, und keine davon ersetzt die
 * anderen:
 *
 * 1. `import "server-only"` in Zeile 1 -- der Build bricht, sobald eine
 *    Client-Komponente diese Datei erreicht.
 * 2. Der Schlüssel trägt bewusst kein `NEXT_PUBLIC_`-Präfix, wird von Next
 *    also nicht ins Bundle übernommen.
 * 3. Eine Semgrep-Regel (`taktus-admin-client-ausserhalb-erlaubter-orte`)
 *    lässt `createAdminClient()` nur in `src/lib/` und `src/actions/` zu.
 * 4. Der CI-Job `bundle:check` durchsucht das gebaute Bundle nach
 *    Schlüsselmustern.
 *
 * Es gibt genau drei berechtigte Anlässe in Release 1:
 * - Lesen von `ai_config` (die Tabelle ist jeder Anwendungsrolle entzogen)
 * - Nachladen von E-Mail-Adressen aus `auth.users` für die Nutzerliste
 * - Anlegen und Anonymisieren von Nutzern
 *
 * In jedem dieser Fälle steht die Prüfung, dass der Vorgang den eigenen
 * Mandanten betrifft, in der aufrufenden Server Action -- ausgeschrieben, mit
 * Begründung darüber. Nicht implizit.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    supabaseServiceRoleKey(),
    {
      auth: {
        // Der Client gehört keiner Person. Er darf weder eine Sitzung
        // ablegen noch ein Token auffrischen -- beides wäre ein Zustand, der
        // über eine Anfrage hinaus bestehen bliebe.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
