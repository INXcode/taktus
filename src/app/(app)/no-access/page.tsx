import { type Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { paths } from "@/lib/paths";

export const metadata: Metadata = { title: "Kein Zugriff · Taktus Kontor" };

/**
 * Bildschirm 25, zweite Hälfte -- kein Zugriff.
 *
 * Sachlich, ohne Verniedlichung, und ohne zu verraten, was hinter der Adresse
 * läge. Der Unterschied zu „nicht gefunden" ist Absicht: Hier steht fest,
 * dass es die Seite gibt und die Rolle sie nicht erreichen darf.
 */
export default async function NoAccessPage() {
  const viewer = await requireRole(ALL_ROLES);

  return (
    <AppShell viewer={viewer} title="Kein Zugriff">
      <div className="max-w-[34rem]">
        <h1 className="text-2xl font-bold">
          Diese Seite ist Ihnen nicht zugänglich.
        </h1>
        <p className="mt-3 text-base leading-6 text-field-label">
          Ihre Rolle in diesem Mandanten schließt diesen Bereich aus. Das ist
          keine Störung — die Berechtigung wird in der Datenbank entschieden,
          nicht in der Oberfläche.
        </p>
        <p className="mt-3 text-base leading-6 text-field-label">
          Wenn Sie hier etwas erwarten, wenden Sie sich an die Verwaltung Ihres
          Mandanten.
        </p>
        <p className="mt-6">
          <LinkButton href={paths.tickets} variant="secondary">
            Zur Übersicht
          </LinkButton>
        </p>
      </div>
    </AppShell>
  );
}
