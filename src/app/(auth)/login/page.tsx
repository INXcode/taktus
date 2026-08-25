import { type Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { FieldError } from "@/components/ui/field";
import { safeRedirectTarget, paths } from "@/lib/paths";

export const metadata: Metadata = { title: "Anmelden · Taktus Kontor" };

/**
 * Bildschirm 1 -- Anmeldung.
 *
 * Es gibt keinen Weg zur Registrierung, und das ist keine Auslassung:
 * `enable_signup = false` in `supabase/config.toml`. Konten legt die
 * Verwaltung des Mandanten an. Ein Registrierungslink wäre eine Tür, die es
 * nicht gibt.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const rawWeiter = params["weiter"];
  const weiter = safeRedirectTarget(
    typeof rawWeiter === "string" ? rawWeiter : null,
    paths.tickets,
  );

  // Zwei Hinweise, die aus einer Weiterleitung stammen können.
  const hinweis =
    params["zugang"] === "entzogen"
      ? "Dieser Zugang ist nicht mehr aktiv. Bitte wenden Sie sich an die Verwaltung Ihres Mandanten."
      : params["link"] === "ungueltig"
        ? "Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie einen neuen an."
        : null;

  return (
    <>
      <h1 className="text-2xl font-bold">Anmelden</h1>
      <p className="mt-2 mb-6 text-base text-muted">
        Mit der Adresse, die Ihre Verwaltung eingerichtet hat.
      </p>

      {hinweis !== null ? (
        <div className="mb-5">
          <FieldError>{hinweis}</FieldError>
        </div>
      ) : null}

      <LoginForm weiter={weiter} />
    </>
  );
}
