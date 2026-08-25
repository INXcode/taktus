import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberOperations } from "@/components/members/member-operations";
import { AppShell } from "@/components/shell/app-shell";
import { RoleBadge } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/avatar";
import { requireRole } from "@/lib/auth/guard";
import { loadCustomerOptions } from "@/lib/customers";
import { formatDate } from "@/lib/format/datetime";
import { loadMemberEmails } from "@/lib/members";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Nutzer bearbeiten · Taktus Kontor",
};

/**
 * Bildschirm 17 -- Nutzer bearbeiten.
 *
 * Am eigenen Eintrag gibt es diese Seite nicht: Ein Administrator könnte
 * seine Rolle technisch selbst ändern, aber der Weg gehört nicht hierher. Wer
 * sich selbst die Verwaltung entzieht, sperrt sich möglicherweise aus -- und
 * „Mein Profil" ist der Ort für die eigenen Angaben, nicht für Rechtevergabe.
 */
export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireRole(["admin"]);
  const { id } = await params;

  const supabase = await createClient();

  // Unter RLS: Findet die Abfrage die Zeile nicht, gehört sie nicht zu diesem
  // Mandanten -- oder es gibt sie nicht. Beides endet hier gleich.
  const { data: member } = await supabase
    .from("profiles")
    .select(
      "id, display_name, role, customer_id, deactivated_at, created_at, customer:customers (name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!member) notFound();
  if (member.id === viewer.userId) notFound();

  const emails = await loadMemberEmails([member.id]);

  // Der bisherige Kunde bleibt wählbar, auch wenn er stillgelegt ist -- sonst
  // stünde das Feld auf einem Wert, den die Liste nicht kennt, und ein
  // Speichern setzte ihn stillschweigend um.
  const customers = await loadCustomerOptions(supabase, {
    zusaetzlich: member.customer_id,
  });

  // Was beim Anonymisieren erhalten bleibt. Drei Zählungen, keine Zeilen --
  // `head: true` holt nur die Anzahl.
  const [tickets, comments, timeEntries] = await Promise.all([
    supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("created_by", member.id),
    supabase
      .from("ticket_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", member.id),
    supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", member.id),
  ]);

  return (
    <AppShell viewer={viewer} title="Nutzer bearbeiten">
      <nav
        aria-label="Brotkrumen"
        className="mb-3.5 flex items-center gap-2.5 text-sm text-muted"
      >
        <Link href={paths.members} className="font-semibold">
          Nutzer
        </Link>
        <span aria-hidden="true">/</span>
        <span>{member.display_name}</span>
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-5">
        <Avatar displayName={member.display_name} size="xl" tone="other" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{member.display_name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-mono text-xs">
              Nutzer seit {formatDate(member.created_at)}
            </span>
            <RoleBadge role={member.role} />
            {member.customer === null ? null : (
              <span className="text-xs">Kunde: {member.customer.name}</span>
            )}
            {member.deactivated_at === null ? null : (
              <span className="text-xs">
                deaktiviert am {formatDate(member.deactivated_at)}
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-muted">
            {emails.get(member.id) ?? "—"}{" "}
            <span className="text-faint">aus der Anmeldung</span>
          </p>
        </div>
      </div>

      <MemberOperations
        profileId={member.id}
        displayName={member.display_name}
        role={member.role}
        customerId={member.customer_id}
        customers={customers}
        deactivatedAt={member.deactivated_at}
        counts={{
          tickets: tickets.count ?? 0,
          comments: comments.count ?? 0,
          timeEntries: timeEntries.count ?? 0,
        }}
      />

      {/*
        Der Weg zur Auskunft (Bildschirm 22) steht **unter** den drei
        Vorgängen und nicht zwischen ihnen: Sie ist keine Massnahme gegen einen
        Nutzer, sondern sein Anspruch, den die Verwaltung
        erfüllt. Ein Verweis neben „Anonymisieren" läse sich wie eine vierte
        Stufe derselben Leiter.
      */}
      <section className="mt-8 max-w-[34rem] border-t border-border pt-6">
        <h2 className="mb-2 text-xl font-bold">Auskunft erteilen</h2>
        <p className="mb-3 text-base leading-[1.55] text-body">
          Alle zu {member.display_name} gespeicherten Angaben — zum Ansehen und
          als Datei. Der Abruf wird protokolliert.
        </p>
        <Link href={paths.memberData(member.id)} className="font-semibold">
          Auskunft ansehen
        </Link>
      </section>
    </AppShell>
  );
}
