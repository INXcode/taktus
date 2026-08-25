/**
 * Zugriff auf die Umgebungsvariablen.
 *
 * Die Werte werden **in** den Funktionen gelesen, nicht auf Modulebene. Der
 * Grund ist konkret: `pnpm build` läuft in der CI ohne Supabase-Variablen (der
 * Build-Job setzt nur `GIT_SHA`). Ein Wurf beim Import würde den Build
 * abbrechen, obwohl zur Bauzeit niemand die Datenbank braucht.
 *
 * Fehlt ein Wert zur Laufzeit, bricht der Aufruf dagegen sofort und mit
 * Nennung des Namens ab. Ein stiller Ausfall wäre hier das größere Übel: Eine
 * Anwendung, die ohne Schlüssel startet und erst beim ersten Zugriff
 * merkwürdig wird, verschleiert die Ursache.
 *
 * Beschreibung jeder Variable und die Folgen ihres Fehlens: `.env.example`.
 */

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `Umgebungsvariable ${name} fehlt. Vorlage und Erläuterung stehen in .env.example.`,
    );
  }
  return value;
}

/** Basisadresse der Supabase-API. Auch im Browser sichtbar. */
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

/**
 * Öffentlicher Schlüssel. Darf im Browser landen -- er unterliegt
 * vollständig der Row Level Security.
 */
export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/**
 * Service-Role-Schlüssel. **Umgeht sämtliche RLS-Policies.**
 *
 * Bewusst ohne `NEXT_PUBLIC_`-Präfix, damit Next.js ihn nicht ins
 * Client-Bundle übernimmt. Diese Funktion wird ausschließlich aus
 * `src/lib/supabase/admin.ts` aufgerufen, das `server-only` importiert.
 */
export function supabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Öffentliche Adresse der Anwendung. Grundlage für die Rücksprungadressen in
 * Bestätigungs- und Zurücksetzen-Mails.
 */
export function siteUrl(): string {
  return required("NEXT_PUBLIC_SITE_URL");
}
