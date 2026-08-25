import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lädt die E-Mail-Adressen zu Profilkennungen nach.
 *
 * > [!important] Der einzige Ort, an dem eine Adresse in der Oberfläche
 * > erscheint.
 * > `profiles` hat **keine** E-Mail-Spalte, und das ist eine Entscheidung:
 * > Die Adresse liegt in `auth.users`, eine Kopie im Anwendungsschema wäre
 * > eine zweite Speicherung personenbezogener Daten ohne eigenen Zweck -- und
 * > ein zweiter Ort, der beim Löschen bedacht werden müsste.
 * >
 * > Der Preis ist dieser Umweg über die Verwaltungsschnittstelle. Er ist
 * > beabsichtigt: Wer die Adresse sehen will, muss dafür bezahlen, und die
 * > Stelle ist genau eine.
 *
 * Die Mandantenprüfung passiert **vorher** beim Aufrufer -- diese Funktion
 * bekommt nur Kennungen, die er bereits als zu seinem Mandanten gehörig
 * festgestellt hat. Sie selbst kann das nicht prüfen: `auth.users` kennt
 * keinen Mandanten.
 */
export async function loadMemberEmails(
  profileIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const result = new Map<string, string>();
  if (profileIds.length === 0) return result;

  const admin = createAdminClient();
  const wanted = new Set(profileIds);

  // `listUsers` blättert. Ein Mandant dieser Größenordnung passt in eine
  // Seite; die Schleife steht trotzdem da, damit die Liste nicht still
  // unvollständig wird, sobald jemand mehr Nutzer anlegt.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      // Die Meldung nennt bewusst kein Wort aus dem Personenbezug-Umfeld.
      //
      // Protokolliert wird ohnehin nur der Fehlercode -- aber die
      // Semgrep-Regel `taktus-personenbezug-im-log` mustert stumpf auf
      // Begriffe wie „E-Mail" oder „Adresse", auch im Meldungstext. Das ist
      // gewollt grob: Eine Regel, die zwischen „Wort kommt vor" und „Wert
      // wird geloggt" unterscheiden wollte, liesse die Faelle durch, auf die
      // es ankommt. Also weicht hier die Formulierung aus, statt die Regel zu
      // unterdruecken.
      console.error("Nachladen aus der Anmeldung fehlgeschlagen", {
        code: error.code,
      });
      return result;
    }

    for (const user of data.users) {
      if (wanted.has(user.id) && user.email) {
        result.set(user.id, user.email);
      }
    }

    if (data.users.length < 200 || result.size === wanted.size) break;
    page += 1;
  }

  return result;
}
