import { type Metadata } from "next";
import { PersonDataView } from "@/components/account/person-data-view";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { loadPersonData } from "@/lib/export/load";
import { formatDate, formatTime } from "@/lib/format/datetime";
import { paths } from "@/lib/paths";

export const metadata: Metadata = { title: "Meine Daten · Taktus Kontor" };

/**
 * Bildschirm 21 -- Meine Daten.
 *
 * Ansicht und Download stehen gleichrangig oben, und der Download ist eine
 * Datei -- kein Warteschlangenvorgang mit einer E-Mail „in Kürze". Das ist
 * technisch möglich, weil `export_person_data` eine Abfrage ist; wo es geht,
 * ist die sofortige Antwort die bessere Erfüllung von Art. 15.
 */
export default async function MyDataPage() {
  const viewer = await requireRole(ALL_ROLES);

  const result = await loadPersonData({
    profileId: viewer.userId,
    isSelf: true,
    reason: "view",
  });

  if (!result.ok) {
    return (
      <AppShell viewer={viewer} title="Meine Daten">
        <h1 className="mb-5 text-4xl font-bold">Meine Daten</h1>
        <EmptyState
          shows="Diese Ansicht zeigt derzeit keine Auskunft."
          doesNotMean="Der Abruf ist fehlgeschlagen. Bitte laden Sie die Seite neu; bleibt es dabei, wenden Sie sich an den Betreiber der Instanz — Ihr Auskunftsanspruch besteht unabhängig davon, ob diese Ansicht funktioniert."
        />
      </AppShell>
    );
  }

  return (
    <AppShell viewer={viewer} title="Meine Daten">
      <PersonDataView
        data={result.data}
        header={
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="mb-1 text-4xl font-bold">Meine Daten</h1>
              <p className="text-[13.5px] text-muted">
                Stand {formatDate(result.data.erstellt_am)},{" "}
                {formatTime(result.data.erstellt_am)} ·{" "}
                {result.data.profil.display_name}
              </p>
            </div>
            <LinkButton href={paths.myDataDownload} variant="primary">
              Als Datei laden
            </LinkButton>
          </div>
        }
      />
    </AppShell>
  );
}
