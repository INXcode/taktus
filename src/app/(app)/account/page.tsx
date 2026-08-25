import { type Metadata } from "next";
import Link from "next/link";
import { DisplayNameForm } from "@/components/account/display-name-form";
import { PasswordForm } from "@/components/account/password-form";
import { AppShell } from "@/components/shell/app-shell";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { ROLE_LABEL } from "@/lib/labels/role";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mein Profil · Taktus Kontor" };

/**
 * Bildschirm 20 -- Mein Profil.
 *
 * > [!important] Rolle und Mandant stehen als Text, nicht als Feld.
 * > Kein gesperrtes Auswahlfeld, kein Feld, das je nach Rolle mal editierbar
 * > wäre: Die Sperre liegt in der Datenbank. `profiles_update_eigenes` bindet
 * > `role` und `tenant_id` in der WITH-CHECK-Klausel an ihre bisherigen Werte
 * > -- ein Formularfeld dafür hätte schlicht keine Wirkung, und ein Feld ohne
 * > Wirkung ist eine Zusage ohne Deckung.
 */
export default async function AccountPage() {
  const viewer = await requireRole(ALL_ROLES);

  /*
   * Der eigene Kunde -- nur beim Melder, und nur einer.
   *
   * `customers_select_eigener` liefert ihm genau diese eine Zeile. Für
   * Bearbeitung und Verwaltung ergäbe die Angabe keinen Sinn: Sie hängen am
   * Mandanten und arbeiten quer über alle Kunden. Deshalb wird für sie gar
   * nicht erst gefragt, statt ein leeres Kästchen zu zeigen.
   */
  let customerName: string | null = null;
  if (viewer.role === "requester") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("customers")
      .select("name")
      .maybeSingle();
    customerName = data?.name ?? null;
  }

  return (
    <AppShell viewer={viewer} title="Mein Profil">
      <div className="flex max-w-[34rem] flex-col gap-6">
        <h1 className="text-4xl font-bold">Mein Profil</h1>

        <DisplayNameForm displayName={viewer.displayName} />

        <section>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyFact label="Rolle" value={ROLE_LABEL[viewer.role]} />
            <ReadOnlyFact label="Mandant" value={viewer.tenantName} />
            {customerName === null ? null : (
              <ReadOnlyFact label="Kunde" value={customerName} />
            )}
          </div>

          <p className="mt-2 text-[12.5px] leading-[1.55] text-muted">
            {customerName === null ? "Beides" : "Alles davon"} ist hier nicht
            änderbar. Die Rolle vergibt die Verwaltung Ihres Mandanten; der
            Mandant steht fest
            {customerName === null
              ? ""
              : ", und der Kunde ergibt sich aus Ihrer Zuordnung"}
            . Diese Sperre liegt in der Datenbank, nicht in dieser Ansicht.
          </p>
        </section>

        <PasswordForm />

        <section className="border-t border-border pt-5">
          <h2 className="mb-1.5 text-xl font-bold">Meine Daten</h2>
          <p className="mb-3 text-base leading-[1.55] text-body">
            Welche Angaben zu Ihnen gespeichert sind, steht vollständig in einer
            eigenen Ansicht — mit der Möglichkeit, sie als Datei zu laden.
          </p>
          <Link href={paths.myData} className="font-semibold">
            Meine Daten ansehen
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

function ReadOnlyFact({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3.5">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
