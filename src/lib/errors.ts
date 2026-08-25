/**
 * Übersetzt Datenbankfehler in deutsche Meldungen.
 *
 * Die Meldung von PostgREST wird **nie** durchgereicht. Zwei Gründe: Sie ist
 * englisch, und sie kann Zeileninhalte enthalten -- eine Fehlermeldung, die
 * den Wert nennt, an dem eine Bedingung scheiterte, gibt damit Daten preis,
 * die der Aufrufer möglicherweise gar nicht lesen darf.
 */

/** Die Fehlerform, die `@supabase/postgrest-js` liefert. */
export type DatabaseError = {
  readonly code?: string | undefined;
  readonly message?: string | undefined;
};

export function mapDatabaseError(error: DatabaseError): string {
  switch (error.code) {
    // Row Level Security hat den Schreibzugriff abgelehnt.
    //
    // Der Zusatz „es wurde nichts geändert" ist keine Höflichkeit: Er
    // beantwortet die Frage, die sich sonst jeder stellt -- und er
    // unterscheidet diesen Fall vom Lesen ohne Recht, das stumm null Zeilen
    // liefert und deshalb wie ein Leerzustand aussieht (Bildschirm 24).
    case "42501":
      return "Für diese Änderung fehlt die Berechtigung. Es wurde nichts geändert.";

    // Kein Treffer bei `.single()`.
    case "PGRST116":
      return "Der Eintrag wurde nicht gefunden. Möglicherweise wurde er inzwischen gelöscht.";

    // CHECK-Bedingung verletzt -- etwa ein Titel über 200 Zeichen, der die
    // Prüfung in der Anwendung umgangen hat.
    case "23514":
      return "Die Eingabe hält eine Regel der Datenbank nicht ein. Bitte prüfen Sie die Felder.";

    // Eindeutigkeit verletzt.
    case "23505":
      return "Diesen Eintrag gibt es bereits.";

    // Fremdschlüssel -- in diesem Schema fast immer ein Verweis über die
    // Mandantengrenze hinweg.
    case "23503":
      return "Der Verweis zeigt auf einen Eintrag, der nicht erreichbar ist.";

    default:
      return "Der Vorgang ist fehlgeschlagen. Bitte versuchen Sie es erneut.";
  }
}
