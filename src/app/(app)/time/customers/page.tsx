import { type Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { TimeEntryList, type TimeRow } from "@/components/time/time-entry-list";
import { TimeTabs } from "@/components/time/time-tabs";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { requireRole } from "@/lib/auth/guard";
import { formatMonth } from "@/lib/format/datetime";
import { formatMinutesAndHours } from "@/lib/format/duration";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { TIME_ENTRY_SELECT, toTimeRow } from "@/lib/time/rows";

export const metadata: Metadata = {
  title: "Zeiten nach Kunde · Taktus Kontor",
};

/** `?monat=alle` -- alle Zeiträume statt eines Monats. */
const ALLE = "alle";

/**
 * Bildschirm 14 B -- Zeiten nach Kunde.
 *
 * Dieselben Buchungen wie im Reiter daneben, nur anders gebündelt: je Kunde
 * eine Gruppe mit eigener Summe. Das ist die Sicht, aus der abgerechnet wird
 * -- auch solange eine Rechnung von Hand geschrieben wird, und erst recht
 * bevor es eine Schnittstelle dorthin gibt.
 *
 * > [!important] Der Monat ist die Einheit einer Abrechnung, nicht „seit
 * > Beginn".
 * > Die Auswahl bietet deshalb nur Monate an, in denen tatsächlich gebucht
 * > wurde, und steht zunächst auf dem jüngsten davon. Ein leerer Vorgabemonat
 * > -- etwa ein frisch begonnener -- sähe aus wie eine kaputte Seite. „Alle
 * > Zeiträume" bleibt erreichbar, für den Blick auf einen Kunden im Ganzen.
 *
 * **Kein eigener Kundenfilter.** Die Gruppen sind der Filter: Wer einen Kunden
 * sucht, findet ihn in der Überschrift, und bei der Zahl der Kunden eines
 * Kleinbetriebs ist eine zweite Auswahl daneben Beiwerk.
 */
export default async function CustomerTimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(["admin", "agent"]);
  const params = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    // Innerhalb eines Kunden aufsteigend: Eine Aufstellung, aus der abgerechnet
    // wird, liest sich der Reihe nach vom Monatsanfang -- anders als die
    // Arbeitslisten daneben, bei denen das Jüngste zuerst gefragt ist.
    .order("worked_on", { ascending: true })
    .order("created_at", { ascending: true });

  const alle: readonly TimeRow[] = (data ?? []).map((row) =>
    toTimeRow(row, { isOwn: row.user_id === viewer.userId }),
  );

  // Angeboten wird nur, was es gibt. Eine Liste der letzten zwölf Monate wäre
  // schneller geschrieben und zeigte zur Hälfte leere Auswertungen.
  const monate = [...new Set(alle.map((row) => row.workedOn.slice(0, 7)))].sort(
    (a, b) => b.localeCompare(a),
  );

  const raw = params["monat"];
  const gewaehlt =
    typeof raw === "string" && (raw === ALLE || monate.includes(raw))
      ? raw
      : (monate[0] ?? ALLE);

  const rows =
    gewaehlt === ALLE
      ? alle
      : alle.filter((row) => row.workedOn.startsWith(gewaehlt));

  // Gruppen nach Kundenname, alphabetisch. Nicht nach Summe absteigend: Wer
  // einen bestimmten Kunden abrechnet, sucht ihn -- und eine Reihenfolge, die
  // sich mit jeder Buchung ändert, lässt sich nicht suchen.
  const gruppen = new Map<string, TimeRow[]>();
  for (const row of rows) {
    const vorhanden = gruppen.get(row.customerName);
    if (vorhanden) vorhanden.push(row);
    else gruppen.set(row.customerName, [row]);
  }
  const sortiert = [...gruppen.entries()].sort(([a], [b]) =>
    a.localeCompare(b, "de"),
  );

  const total = rows.reduce((sum, row) => sum + row.minutes, 0);

  return (
    <AppShell viewer={viewer} title="Zeiten nach Kunde">
      <div className="mb-5">
        <h1 className="text-4xl font-bold">Zeiten</h1>
        <p className="mt-1.5 text-sm text-muted">
          {sortiert.length} {sortiert.length === 1 ? "Kunde" : "Kunden"} ·{" "}
          {rows.length} {rows.length === 1 ? "Buchung" : "Buchungen"}
          {rows.length > 0 ? ` · ${formatMinutesAndHours(total)}` : ""}
        </p>
      </div>

      <TimeTabs current="kunde" />

      {alle.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            shows="Diese Ansicht zeigt keine Buchungen."
            doesNotMean="Das kann bedeuten, dass in diesem Mandanten noch nichts gebucht wurde. Gebucht wird immer auf ein Ticket, und jedes Ticket gehört zu einem Kunden — die Zuordnung entsteht also von selbst."
          />
        </div>
      ) : (
        <>
          <form
            method="get"
            action={paths.customerTime}
            className="mt-5 flex flex-wrap items-end gap-3"
          >
            <div>
              <label
                htmlFor="filter-monat"
                className="mb-1.5 block text-sm font-semibold text-field-label"
              >
                Zeitraum
              </label>
              <AutoSubmitSelect
                id="filter-monat"
                name="monat"
                defaultValue={gewaehlt}
                className="min-w-[14rem]"
              >
                {monate.map((monat) => (
                  <option key={monat} value={monat}>
                    {formatMonth(`${monat}-01`)}
                  </option>
                ))}
                <option value={ALLE}>alle Zeiträume</option>
              </AutoSubmitSelect>
            </div>
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

          <div className="mt-5 flex flex-col gap-6">
            {sortiert.map(([kunde, gebucht]) => {
              const summe = gebucht.reduce((sum, row) => sum + row.minutes, 0);
              return (
                <section key={kunde}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3 pb-2.5">
                    <h2 className="text-md font-semibold text-foreground">
                      {kunde}
                    </h2>
                    <span className="font-mono text-sm text-muted">
                      {gebucht.length}{" "}
                      {gebucht.length === 1 ? "Buchung" : "Buchungen"} ·{" "}
                      {formatMinutesAndHours(summe)}
                    </span>
                  </div>
                  <TimeEntryList
                    rows={gebucht}
                    showPerson
                    showCustomer={false}
                    isAdmin={viewer.role === "admin"}
                  />
                </section>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
