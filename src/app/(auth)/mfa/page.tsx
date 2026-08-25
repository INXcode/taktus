import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaForm } from "@/components/auth/mfa-form";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Bestätigungscode · Taktus Kontor",
};

/**
 * Bildschirm 4 -- Bestätigungscode (TOTP).
 *
 * **Vorbereitet, in Release 1 nicht im Regelweg.** TOTP ist in
 * `supabase/config.toml` aktivierbar, aber niemand hat einen Faktor
 * hinterlegt -- eine Einrichtungsstrecke ist ausdrücklich nicht Teil von
 * Release 1 (docs/design-brief.md, Bildschirm 4).
 *
 * Die Seite existiert trotzdem, und zwar ohne tote Route zu sein: Sie prüft
 * die tatsächliche Sicherungsstufe der Sitzung und schickt weiter, wenn keine
 * Bestätigung ansteht. Sobald ein Faktor hinterlegt wird, greift der Ablauf
 * ohne weiteres Zutun -- genau das war der Zweck, ihn jetzt mitzudenken.
 */
export default async function MfaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(paths.login);
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Nichts zu bestätigen: entweder gibt es keinen Faktor (`nextLevel` bleibt
  // `aal1`) oder die Sitzung ist bereits bestätigt.
  if (aal?.nextLevel !== "aal2" || aal.currentLevel === "aal2") {
    redirect(paths.tickets);
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Bestätigungscode</h1>
      <p className="mt-2 mb-6 text-base text-muted">
        Sechsstelliger Code aus Ihrer Authenticator-App.
      </p>
      <MfaForm />
    </>
  );
}
