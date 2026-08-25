import { type Metadata } from "next";
import Link from "next/link";
import { PersonDataView } from "@/components/account/person-data-view";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/guard";
import { loadPersonData } from "@/lib/export/load";
import { formatDate, formatTime } from "@/lib/format/datetime";
import { ROLE_LABEL } from "@/lib/labels/role";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { type AppRole } from "@/types";

export const metadata: Metadata = {
  title: "Auskunft für einen Nutzer · Taktus Kontor",
};

/**
 * Bildschirm 22 -- Auskunft für einen Nutzer. Nur `admin`.
 *
 * > [!important] Derselbe Aufbau, ein anderer Kopf -- und **kein** erweiterter
 * > Inhalt.
 * > Die Verwaltung sieht dieselben sechs Abschnitte wie die betroffene Person
 * > selbst. Es gibt hier bewusst keine zusätzliche Spalte, kein Feld mehr,
 * > keinen Abschnitt „intern": Eine Auskunft nach Art. 15 ist das, was der
 * > Person zusteht, und wer sie für jemanden abruft, ruft genau das ab.
 *
 * Der Kopf beantwortet drei Fragen, die eine Auskunft über einen anderen
 * aufwirft: für wen, von wem ausgelöst, wann. Und er nennt, dass der Vorgang
 * im Protokoll steht -- wer eine Auskunft über einen anderen abruft, soll
 * wissen, dass das nachvollziehbar ist.
 */
export default async function MemberDataPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const viewer = await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  // Erst unter RLS nachsehen, wen wir da vor uns haben. Findet die Abfrage
  // nichts, gehört das Profil nicht zu diesem Mandanten -- dann wird die
  // Auskunft gar nicht erst angefordert.
  const { data: member } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", id)
    .maybeSingle();

  if (member === null) {
    return (
      <AppShell viewer={viewer} title="Auskunft">
        <h1 className="mb-5 text-4xl font-bold">Auskunft</h1>
        <EmptyState
          shows="Diese Ansicht zeigt keinen Nutzer."
          doesNotMean="Die Kennung in der Adresse gehört zu keinem Nutzer dieses Mandanten, oder Ihr Zugang wurde zwischenzeitlich geändert."
          action={
            <LinkButton href={paths.members} variant="secondary">
              Zur Nutzerliste
            </LinkButton>
          }
        />
      </AppShell>
    );
  }

  const result = await loadPersonData({
    profileId: member.id,
    isSelf: member.id === viewer.userId,
    reason: "view",
  });

  if (!result.ok) {
    return (
      <AppShell viewer={viewer} title="Auskunft">
        <h1 className="mb-5 text-4xl font-bold">Auskunft</h1>
        <EmptyState
          shows="Diese Ansicht zeigt derzeit keine Auskunft."
          doesNotMean="Der Abruf ist fehlgeschlagen. Bitte laden Sie die Seite neu; bleibt es dabei, wenden Sie sich an den Betreiber der Instanz."
        />
      </AppShell>
    );
  }

  return (
    <AppShell viewer={viewer} title="Auskunft">
      <PersonDataView
        data={result.data}
        header={
          <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="mb-1">
                  <Link href={paths.member(member.id)} className="text-sm">
                    ← Zurück zum Nutzer
                  </Link>
                </p>
                <h1 className="text-4xl font-bold">
                  Auskunft für {member.display_name}
                </h1>
              </div>
              <LinkButton
                href={paths.memberDataDownload(member.id)}
                variant="primary"
              >
                Als Datei laden
              </LinkButton>
            </div>

            <div className="rounded-[10px] border border-role-border bg-primary-tint p-3.5">
              <p className="text-[12.5px] leading-[1.55] text-field-label">
                Ausgelöst von {viewer.displayName} am{" "}
                {formatDate(result.data.erstellt_am)},{" "}
                {formatTime(result.data.erstellt_am)} · Rolle{" "}
                {ROLE_LABEL[member.role as AppRole] ?? member.role} ·{" "}
                {viewer.tenantName}. Der Vorgang steht als{" "}
                <span className="font-mono text-xs">profile.export</span> im
                Protokoll. Dieselben sechs Abschnitte, kein zusätzlicher Inhalt.
              </p>
            </div>
          </div>
        }
      />
    </AppShell>
  );
}
