import { type Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { RoleBadge } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guard";
import { formatShortDate } from "@/lib/format/datetime";
import { loadMemberEmails } from "@/lib/members";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nutzer · Taktus Kontor" };

/** Aus dem Entwurf, Bildschirm 15 -- um den Kunden erweitert. */
const COLUMNS = "minmax(0,1fr) 200px 110px 150px 130px 110px";

/**
 * Bildschirm 15 -- Nutzer.
 *
 * > [!important] Deaktivierte verschwinden nicht.
 * > Sie stehen in derselben Liste, gedämpft, mit dem Datum -- ihre Tickets,
 * > Kommentare und Buchungen bestehen weiter und brauchen einen Namen. Ein
 * > Profil wird nie gelöscht; es gibt für `profiles` bewusst keine
 * > DELETE-Policy.
 *
 * Die E-Mail-Adresse erscheint **nur hier**. Sie steht nicht im Profil,
 * sondern wird für diese eine Liste aus der Anmeldung nachgeladen -- und ist
 * genau so gekennzeichnet.
 */
export default async function MembersPage() {
  const viewer = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role, deactivated_at, customer:customers (name)")
    .order("display_name");

  const members = data ?? [];

  // Erst RLS, dann die Verwaltungsschnittstelle: Nachgeladen werden nur
  // Kennungen, die die Abfrage oben bereits als zum eigenen Mandanten
  // gehörig ausgewiesen hat.
  const emails = await loadMemberEmails(members.map((member) => member.id));

  const aktiv = members.filter((m) => m.deactivated_at === null).length;
  const deaktiviert = members.length - aktiv;

  return (
    <AppShell
      viewer={viewer}
      title="Nutzer"
      action={
        <LinkButton href={paths.newMember} variant="primary">
          Nutzer anlegen
        </LinkButton>
      }
    >
      <div className="mb-5">
        <h1 className="text-4xl font-bold">Nutzer</h1>
        <p className="mt-1.5 text-sm text-muted">
          {aktiv} aktiv, {deaktiviert} deaktiviert · {viewer.tenantName}
        </p>
      </div>

      <Table caption="Nutzer dieses Mandanten">
        <TableHead columns={COLUMNS}>
          <TableCell>Anzeigename</TableCell>
          <TableCell>
            E-Mail{" "}
            <span className="font-normal text-faint">aus der Anmeldung</span>
          </TableCell>
          <TableCell>Rolle</TableCell>
          <TableCell>Kunde</TableCell>
          <TableCell>Zustand</TableCell>
          <TableCell>
            <span className="sr-only">Hinweis</span>
          </TableCell>
        </TableHead>

        {members.map((member) => {
          const inaktiv = member.deactivated_at !== null;
          const selbst = member.id === viewer.userId;

          return (
            /*
              Die ganze Zeile führt zum Nutzer -- wie in der Ticketliste und
              bei den Kunden. Ein Verweis „Bearbeiten" am rechten Rand war die
              vierte Bedienweise für dieselbe Sache in vier Listen.

              Die eigene Zeile ist bewusst keine: Rolle und Zustand des
              eigenen Kontos gehören nicht hierher.
            */
            <TableRow
              key={member.id}
              columns={COLUMNS}
              {...(selbst ? {} : { href: paths.member(member.id) })}
            >
              <TableCell>
                <span
                  className={`inline-flex items-center gap-2.5 ${inaktiv ? "text-muted" : "text-foreground"}`}
                >
                  <Avatar
                    displayName={member.display_name}
                    size="xs"
                    tone={selbst ? "self" : "other"}
                  />
                  <span className="text-base">{member.display_name}</span>
                  {selbst ? (
                    <span className="text-sm text-muted">(Sie)</span>
                  ) : null}
                </span>
              </TableCell>

              <TableCell
                className={`truncate text-sm ${inaktiv ? "text-faint" : "text-muted"}`}
              >
                {emails.get(member.id) ?? "—"}
              </TableCell>

              <TableCell className="justify-self-start">
                <RoleBadge role={member.role} />
              </TableCell>

              {/* Nur Melder gehören zu einem Kunden. Der Strich steht für
                  „gehört zum Mandanten", nicht für „fehlt noch" -- deshalb
                  gedämpft und ohne Hinweisfarbe. */}
              <TableCell
                className={`truncate text-sm ${inaktiv ? "text-faint" : "text-muted"}`}
              >
                {member.customer?.name ?? <span className="text-faint">—</span>}
              </TableCell>

              <TableCell className="text-sm text-muted">
                {inaktiv
                  ? `deaktiviert ${formatShortDate(member.deactivated_at ?? "")}`
                  : "aktiv"}
              </TableCell>

              {/*
                Die beschriftete Lücke, wie bei einer fremden Zeitbuchung: Ein
                Strich an dieser Stelle sähe nach einem fehlenden Wert aus,
                eine leere Zelle nach einem Fehler. „Mein Profil" ist der Ort
                für die eigenen Angaben -- nicht für Rechtevergabe, und die
                nimmt sich niemand selbst.
              */}
              <TableCell className="text-[12.5px] text-faint">
                {selbst ? "eigenes Konto" : ""}
              </TableCell>
            </TableRow>
          );
        })}
      </Table>

      <p className="mt-4 max-w-[42rem] text-[12.5px] leading-[1.5] text-muted">
        Deaktivierte Zeilen sind gedämpft, aber vollständig lesbar — ihre
        Tickets, Kommentare und Buchungen bestehen weiter und brauchen einen
        Namen.
      </p>
    </AppShell>
  );
}
