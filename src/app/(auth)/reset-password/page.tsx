import { type Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { FieldError } from "@/components/ui/field";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Neues Passwort festlegen · Taktus Kontor",
};

/**
 * Bildschirm 3 -- neues Passwort festlegen.
 *
 * Erreichbar nur über den Link aus der E-Mail: Der Rückruf hat daraus eine
 * Sitzung gemacht, bevor er hierher geleitet hat. Ohne diese Sitzung gibt es
 * nichts zu ändern, und die Seite sagt das, statt ein Formular anzubieten,
 * dessen Absenden scheitern muss.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <h1 className="text-2xl font-bold">Link nicht mehr gültig</h1>
        <div className="mt-4">
          <FieldError>
            Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern
            Sie einen neuen an.
          </FieldError>
        </div>
        <p className="mt-6">
          <Link href={paths.forgotPassword} className="text-base font-semibold">
            Neuen Link anfordern
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Neues Passwort festlegen</h1>
      <p className="mt-2 mb-6 text-base text-muted">
        Danach sind Sie angemeldet.
      </p>
      <ResetPasswordForm />
    </>
  );
}
