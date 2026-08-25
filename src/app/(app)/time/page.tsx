import { type Metadata } from "next";
import { EmptyState } from "@/components/patterns/empty-state";
import { AppShell } from "@/components/shell/app-shell";
import { TimeEntryList, type TimeRow } from "@/components/time/time-entry-list";
import { TimeTabs } from "@/components/time/time-tabs";
import { LinkButton } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { requireRole } from "@/lib/auth/guard";
import { formatMonth, formatWeekRange, isoWeek } from "@/lib/format/datetime";
import { formatMinutesAndHours } from "@/lib/format/duration";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";
import { TIME_ENTRY_SELECT, toTimeRow } from "@/lib/time/rows";

export const metadata: Metadata = { title: "Meine Zeiten · Taktus Kontor" };

/**
 * Bildschirm 13 -- Meine Zeiten.
 *
 * Gruppiert nach Woche oder Monat, Summe je Gruppe im Gruppenkopf. Die Wahl
 * steht in der Adresse (`?gruppierung=`), damit sie teilbar ist und der
 * Zurück-Knopf stimmt -- das Segment sind Verweise, kein Zustand.
 *
 * Gezeigt werden nur eigene Buchungen. Nicht durch einen Filter in dieser
 * Datei: Die Abfrage schränkt auf `user_id` ein, weil der Bildschirm „meine"
 * heisst -- lesen dürfte ein Bearbeiter alle Buchungen des Mandanten, dafür
 * gibt es den Reiter daneben.
 *
 * **Keine Schaltfläche „Zeit buchen".** Gebucht wird im Ticket. Der Weg über
 * eine Auswahlliste aller Tickets war der schlechtere: Er verlangt, dass man
 * den Vorgang aus einer Zeile mit Nummer und Titel wiedererkennt, während im
 * Ticket selbst der ganze Zusammenhang steht -- und die Suche danach.
 */
export default async function MyTimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(["admin", "agent"]);
  const params = await searchParams;

  const raw = params["gruppierung"];
  const grouping = raw === "monat" ? "monat" : "woche";

  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select(TIME_ENTRY_SELECT)
    .eq("user_id", viewer.userId)
    .order("worked_on", { ascending: false });

  const rows: readonly TimeRow[] = (data ?? []).map((row) =>
    toTimeRow(row, { personName: viewer.displayName, isOwn: true }),
  );

  // Gruppierung in der Anwendung, nicht in der Datenbank: Es gibt bewusst
  // keine Views, und eine Handvoll eigener Buchungen je Person lohnt keine
  // eigene Funktion.
  const groups = new Map<string, { label: string; rows: TimeRow[] }>();
  for (const row of rows) {
    const { year, week } = isoWeek(row.workedOn);
    const key =
      grouping === "woche"
        ? `${year}-W${String(week).padStart(2, "0")}`
        : row.workedOn.slice(0, 7);
    const label =
      grouping === "woche"
        ? `KW ${week} · ${formatWeekRange(year, week)}`
        : formatMonth(row.workedOn);

    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { label, rows: [row] });
  }

  const total = rows.reduce((sum, row) => sum + row.minutes, 0);

  return (
    <AppShell viewer={viewer} title="Meine Zeiten">
      <div className="mb-5">
        <h1 className="text-4xl font-bold">Zeiten</h1>
        <p className="mt-1.5 text-sm text-muted">
          {rows.length} eigene {rows.length === 1 ? "Buchung" : "Buchungen"}
          {rows.length > 0 ? ` · ${formatMinutesAndHours(total)}` : ""}
        </p>
      </div>

      <TimeTabs current="eigene" />

      <div className="mt-5 flex justify-end">
        <Segmented
          label="Gruppierung"
          current={grouping}
          hrefFor={(value) => `${paths.myTime}?gruppierung=${value}`}
          options={[
            { value: "woche", label: "Woche" },
            { value: "monat", label: "Monat" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            shows="Diese Ansicht zeigt keine Buchungen von Ihnen."
            doesNotMean="Das kann bedeuten, dass Sie noch keine erfasst haben. Gebucht wird immer auf ein Ticket — im Ticket selbst, im Reiter „Gebuchte Zeiten“."
            action={
              <LinkButton href={paths.tickets} variant="primary">
                Zu den Tickets
              </LinkButton>
            }
          />
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-6">
          {[...groups.values()].map((group) => {
            const sum = group.rows.reduce((s, row) => s + row.minutes, 0);
            return (
              <section key={group.label}>
                <div className="flex flex-wrap items-baseline justify-between gap-3 pb-2.5">
                  <h2 className="text-md font-semibold text-foreground">
                    {group.label}
                  </h2>
                  <span className="font-mono text-sm text-muted">
                    {formatMinutesAndHours(sum)}
                  </span>
                </div>
                <TimeEntryList
                  rows={group.rows}
                  showPerson={false}
                  isAdmin={viewer.role === "admin"}
                />
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
