"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { mapDatabaseError } from "@/lib/errors";
import { paths } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  changeOwnPasswordSchema,
  updateOwnDisplayNameSchema,
} from "@/lib/validation/profile";
import { type FormResult } from "@/types";

/**
 * Das eigene Konto -- Bildschirm 20.
 *
 * Was hier **nicht** steht, ist der Punkt: keine Rollenänderung, kein
 * Mandantenwechsel. Beides ist in der Datenbank gesperrt, nicht in dieser
 * Ansicht: `profiles_update_eigenes` bindet Rolle und Mandant in der
 * WITH-CHECK-Klausel fest. Ein Feld dafür fehlt hier also nicht aus
 * Bequemlichkeit -- es hätte keine Wirkung.
 */
export async function updateOwnDisplayName(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const viewer = await requireRole(ALL_ROLES);

  const parsed = updateOwnDisplayNameSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  if (parsed.data.displayName === viewer.displayName) {
    return ok(undefined);
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", viewer.userId);

  if (error) {
    console.error("Anzeigename nicht gespeichert", { code: error.code });
    return fail(mapDatabaseError(error));
  }

  await logAudit(supabase, "profile.update", "profile", viewer.userId, [
    "display_name",
  ]);

  // Der Name steht in der Seitenleiste jeder Seite, im Nutzermenü und an
  // jedem eigenen Kommentar.
  revalidatePath("/", "layout");
  revalidatePath(paths.account);

  return ok(undefined);
}

/**
 * Passwortwechsel mit Nachweis des alten Passworts.
 *
 * > [!important] Geprüft wird über einen **eigenen, sitzungslosen** Client.
 * > `signInWithPassword` auf dem Anfrage-Client würde bei Erfolg neue
 * > Sitzungscookies schreiben und bei Misserfolg die bestehende Sitzung
 * > anfassen -- ein Tippfehler im alten Passwort könnte damit abmelden. Der
 * > Client hier legt nichts ab (`persistSession: false`), er beantwortet nur
 * > die eine Frage: stimmt dieses Passwort.
 *
 * Der öffentliche Schlüssel genügt dafür; der Service-Role-Schlüssel hat hier
 * nichts verloren. Die Antwort ist bewusst unterschiedslos formuliert -- an
 * dieser Stelle ist die Adresse allerdings ohnehin bekannt, die Meldung darf
 * also benennen, welches Feld gemeint ist.
 */
export async function changeOwnPassword(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  // Ohne Zuweisung: Der Vorgang braucht kein Feld aus dem Betrachter, wohl
  // aber die Prüfung selbst -- ein Passwortwechsel ohne gültige Sitzung wäre
  // die Übernahme eines fremden Kontos. Die Zeile steht wörtlich so da, weil
  // die Semgrep-Regel auf den Bezeichner `requireRole(` mustert.
  await requireRole(ALL_ROLES);

  const parsed = changeOwnPasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fieldFail(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return fail("Die Sitzung ist nicht mehr gültig. Bitte neu anmelden.");
  }

  const pruefer = createSupabaseClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: nachweisFehler } = await pruefer.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (nachweisFehler) {
    // Die Meldung steht **am Feld**, nicht nur oben: Das Formular blendet den
    // allgemeinen Hinweis aus, sobald es Feldfehler gibt -- sonst stünde
    // dieselbe Sache zweimal da. Ein „Bitte noch einmal versuchen" allein
    // sagte dann nicht, was zu wiederholen ist.
    return {
      ok: false,
      error: "Das aktuelle Passwort stimmt nicht.",
      fields: { currentPassword: "Das aktuelle Passwort stimmt nicht." },
    };
  }

  // Die geprüfte Sitzung des Prüf-Clients wird nicht gebraucht -- geändert
  // wird über die echte Sitzung des Aufrufers.
  await pruefer.auth.signOut({ scope: "local" });

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    // Die Meldung nennt bewusst kein Wort aus dem Personenbezug-Umfeld --
    // dieselbe Rücksicht wie in `lib/members.ts`. Die Semgrep-Regel
    // `taktus-personenbezug-im-log` mustert stumpf auf Begriffe, auch im
    // Meldungstext. Das ist gewollt grob, und Umformulieren ist billiger als
    // eine Ausnahme, die beim nächsten Leser wie ein Freibrief aussieht.
    console.error("Änderung im Anmeldedienst fehlgeschlagen", {
      code: error.code,
    });
    return fail(
      "Das Passwort konnte nicht geändert werden. Bitte versuchen Sie es erneut.",
    );
  }

  // Kein Protokolleintrag.
  //
  // `audit_log` führt Feldnamen zu Zeilen des Anwendungsschemas. Das Passwort
  // liegt in `auth.users` und gehört keiner der protokollierten Tabellen an;
  // ein Eintrag „profile.update / password" behauptete eine Änderung an einer
  // Stelle, an der nichts geschehen ist. Der Auth-Dienst führt seine eigenen
  // Aufzeichnungen -- das ist der richtige Ort dafür.

  return ok(undefined);
}
