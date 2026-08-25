"use server";

import { redirect } from "next/navigation";
import { requireRole, ALL_ROLES } from "@/lib/auth/guard";
import { getViewerResult } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { paths, safeRedirectTarget } from "@/lib/paths";
import { fail, fieldFail, ok } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  passwordResetRequestSchema,
  signInSchema,
} from "@/lib/validation/auth";
import { type FormResult } from "@/types";

/**
 * Die Anmeldestrecke.
 *
 * Drei der vier Actions hier haben keine Rolle zu prüfen -- sie sind der Weg
 * **zu** einer Rolle. Sie tragen deshalb je ein `nosemgrep` mit Begründung,
 * wie die Regel `taktus-server-action-ohne-rollenpruefung` es selbst vorsieht.
 * Ohne die Ausnahmen bräche `pnpm semgrep`, weil das Skript mit `--error`
 * läuft und schon eine Warnung den Lauf rot macht.
 */

/** Aus dem Entwurf, Bildschirm 1. Unterscheidet keine Fehlerursache. */
const SIGN_IN_FAILED =
  "Anmeldung nicht möglich. Bitte prüfen Sie E-Mail und Passwort.";

// Oeffentlich und notwendigerweise ohne Rollenpruefung: Diese Action stellt
// die Sitzung erst her, aus der eine Rolle folgt.
// nosemgrep: taktus-server-action-ohne-rollenpruefung
export async function signIn(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return fieldFail(parsed.error, SIGN_IN_FAILED);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Eine einzige Meldung für jeden Fehlschlag.
  //
  // Unbekannte Adresse und falsches Passwort auseinanderzuhalten wäre
  // freundlicher und wäre zugleich eine Auskunft darüber, wer hier ein Konto
  // hat -- an jeden, der die Anmeldemaske aufrufen kann. Der Entwurf hält das
  // ausdrücklich fest; hier steht der Grund dazu.
  //
  // Protokolliert wird nichts: Die Adresse ist personenbezogen
  // (docs/security.md, Kapitel F), und die Fehlschläge zählt der Auth-Server
  // ohnehin für seine Brute-Force-Bremse.
  if (error) {
    return fail(SIGN_IN_FAILED);
  }

  // Angemeldet ist noch nicht zugelassen. Ein stillgelegtes Profil oder ein
  // gesperrter Mandant kommt bis hierher -- die Anmeldedaten stimmen ja.
  // Ohne diese Prüfung liefe der Nutzer in eine Weiterleitungskette, die ihn
  // wortlos wieder an der Anmeldung ablieferte.
  const viewer = await getViewerResult();
  if (!viewer.viewer) {
    await supabase.auth.signOut();
    return fail(
      viewer.reason === "deactivated"
        ? "Dieser Zugang ist nicht mehr aktiv. Bitte wenden Sie sich an die Verwaltung Ihres Mandanten."
        : SIGN_IN_FAILED,
    );
  }

  const weiter = formData.get("weiter");
  redirect(
    safeRedirectTarget(
      typeof weiter === "string" ? weiter : null,
      paths.tickets,
    ),
  );
}

// Oeffentlich: Wer sein Passwort vergessen hat, ist definitionsgemaess nicht
// angemeldet und hat keine Rolle, die sich pruefen liesse.
// nosemgrep: taktus-server-action-ohne-rollenpruefung
export async function requestPasswordReset(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return fieldFail(parsed.error);
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}${paths.authCallback}?weiter=${encodeURIComponent(paths.resetPassword)}`,
  });

  // Das Ergebnis wird bewusst **nicht** ausgewertet.
  //
  // Eine Fehlermeldung an dieser Stelle sagte aus, ob es zu der Adresse einen
  // Zugang gibt -- dieselbe Auskunft, die die Anmeldung oben verweigert. Sie
  // hier herauszugeben, machte die dortige Zurückhaltung wertlos.
  return ok(undefined);
}

// Oeffentlich im Sinne der Rollenpruefung: Die Berechtigung stammt aus dem
// Wiederherstellungs-Token in der Sitzung, das der Auth-Server ausgestellt
// hat, nicht aus einer Anwendungsrolle.
// nosemgrep: taktus-server-action-ohne-rollenpruefung
export async function resetPassword(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordRepeat: formData.get("passwordRepeat"),
  });

  if (!parsed.success) {
    return fieldFail(parsed.error);
  }

  const supabase = await createClient();

  // Ohne gültige Sitzung aus dem Mail-Link gibt es nichts zu ändern. Der
  // Auth-Server würde das ebenfalls ablehnen; die eigene Prüfung liefert nur
  // eine verständliche deutsche Meldung statt einer englischen.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail(
      "Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie einen neuen an.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return fail(
      "Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    );
  }

  redirect(paths.tickets);
}

// Oeffentlich im Sinne der Rollenpruefung: Der Nutzer ist hier auf AAL1
// angemeldet, aber noch nicht auf AAL2. Die Anwendungsrolle steht ihm erst
// nach dieser Bestaetigung offen -- eine Pruefung davor waere zirkulaer.
// nosemgrep: taktus-server-action-ohne-rollenpruefung
export async function verifyMfaCode(
  _previous: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  const code = formData.get("code");

  if (typeof code !== "string" || !/^\d{6}$/u.test(code)) {
    return fail("Bitte alle sechs Stellen eingeben.");
  }

  const supabase = await createClient();
  const { data: factors, error: factorError } =
    await supabase.auth.mfa.listFactors();

  const factor = factors?.totp[0];
  if (factorError || !factor) {
    return fail(
      "Für dieses Konto ist keine Bestätigungs-App hinterlegt. Bitte wenden Sie sich an die Verwaltung Ihres Mandanten.",
    );
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });

  if (error) {
    // Wie bei der Anmeldung: eine Meldung für jeden Fehlschlag. Ob der Code
    // falsch oder abgelaufen war, ändert für den Nutzer nichts und wäre für
    // einen Angreifer eine Rückmeldung über seine Versuche.
    return fail("Der Code stimmt nicht. Bitte erneut aus der App ablesen.");
  }

  redirect(paths.tickets);
}

export async function signOut(): Promise<never> {
  await requireRole(ALL_ROLES);

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect(paths.login);
}
