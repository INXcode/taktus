import { type Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { TimeEntryList, type TimeRow } from "@/components/time/time-entry-list";
import { TimeTabs } from "@/components/time/time-tabs";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { requireRole } from "@/lib/auth/guard";
import { formatMinutesAndHours } from "@/lib/format/duration";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { TIME_ENTRY_SELECT, toTimeRow } from "@/lib/time/rows";

export const metadata: Metadata = {
  title: "Gesamtzeiten · Taktus Kontor",
};

/**
 * Bildschirm 14 -- Gesamtzeiten.
 *
 * Alle Buchungen des Mandanten sind lesbar. Gelöscht wird die eigene, von der
 * Verwaltung auch eine fremde; geändert wird gar nicht mehr hier, sondern im
 * Ticket. Die Abstufung zeigt `TimeEntryList`; durchgesetzt wird sie von den
 * Policies.
 *
 * > [!note] Nicht mehr „Zeiten des Mandanten"
 * > Die alte Beschriftung setzte zweierlei voraus: dass der Nutzer weiss, in
 * > einem Mandanten zu arbeiten, und dass er ihn nicht mit dem Kunden
 * > verwechselt. Beides trifft in der Regel nicht zu. „Gesamtzeiten"
 * > beantwortet dagegen genau die Frage, die vor dem Reiterwechsel steht:
 * > alles oder nur meins.
 *
 * **Eine Summe über der Tabelle, nicht sechs Kacheln.** Ohne Datenbank-Views
 * kostet jede Zahl eine eigene Abfrage. Der Entwurf hält dazu fest: Wird die
 * Abfrage teuer, kann die Summe ohne Schaden entfallen -- die Zeilenwerte
 * tragen den Bildschirm.
 */
export default async function TenantTimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(["admin", "agent"]);
  const params = await searchParams;

  const rawPerson = params["person"];
  const person =
    typeof rawPerson === "string" && rawPerson !== "" ? rawPerson : null;

  const supabase = await createClient();

  const { data: personRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .order("display_name");
  const people = (personRows ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
  }));

  let query = supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    .order("worked_on", { ascending: false });

  // Nur eine gültige Kennung wird durchgereicht -- alles andere käme als
  // Typfehler aus PostgREST zurück und zeigte dem Nutzer eine kaputte Seite
  // statt einer ungefilterten Liste.
  if (person !== null && people.some((entry) => entry.id === person)) {
    query = query.eq("user_id", person);
  }

  const { data } = await query;

  const rows: readonly TimeRow[] = (data ?? []).map((row) =>
    toTimeRow(row, { isOwn: row.user_id === viewer.userId }),
  );

  const total = rows.reduce((sum, row) => sum + row.minutes, 0);
  const personen = new Set(rows.map((row) => row.personName)).size;

  return (
    <AppShell viewer={viewer} title="Gesamtzeiten">
      <div className="mb-5">
        <h1 className="text-4xl font-bold">Zeiten</h1>
        <p className="mt-1.5 text-sm text-muted">
          {rows.length} {rows.length === 1 ? "Buchung" : "Buchungen"} ·{" "}
          {personen} {personen === 1 ? "Person" : "Personen"}
          {rows.length > 0 ? ` · ${formatMinutesAndHours(total)}` : ""}
        </p>
      </div>

      <TimeTabs current="gesamt" />

      {/*
        Ein Formular mit genau einem Auswahlfeld, das selbst auslöst -- wie im
        Filterband der Ticketliste. Ein Knopf „Anwenden" neben einer einzelnen
        Auswahl wäre ein Handgriff ohne Frage dahinter.
      */}
      <form
        method="get"
        action={paths.tenantTime}
        className="mt-5 flex flex-wrap items-end gap-3"
      >
        <div>
          <label
            htmlFor="filter-person"
            className="mb-1.5 block text-sm font-semibold text-field-label"
          >
            Person
          </label>
          <AutoSubmitSelect
            id="filter-person"
            name="person"
            defaultValue={person ?? ""}
            className="min-w-[14rem]"
          >
            <option value="">alle</option>
            {people.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.displayName}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        {/* Ohne Skripte bleibt das Formular bedienbar: Der Knopf schickt es ab.
            Mit Skripten löst die Auswahl selbst aus, und er wird nie gebraucht. */}
        <noscript>
          <button
            type="submit"
            data-variant="secondary"
            className="min-h-[var(--size-control)] rounded-md border border-border-strong bg-card px-4 text-base font-semibold text-body"
          >
            Anwenden
          </button>
        </noscript>
      </form>

      {rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            shows="Diese Ansicht zeigt keine Buchungen."
            doesNotMean="Das kann bedeuten, dass keine erfasst sind — oder dass der aktive Filter nichts trifft. Melder buchen keine Zeiten; sie tauchen hier grundsätzlich nicht auf."
          />
        </div>
      ) : (
        <div className="mt-5">
          <TimeEntryList
            rows={rows}
            showPerson
            isAdmin={viewer.role === "admin"}
          />
        </div>
      )}
    </AppShell>
  );
}
