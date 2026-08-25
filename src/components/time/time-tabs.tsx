import { Tabs } from "@/components/ui/tabs";
import { paths } from "@/lib/paths";

export type TimeView = "eigene" | "gesamt" | "kunde";

/**
 * Die Reiterleiste über den drei Zeitansichten.
 *
 * Drei Sichten auf denselben Bestand: die eigenen Buchungen, alle Buchungen,
 * und dieselben Buchungen nach Kunde gebündelt. Als drei Menüpunkte gelesen
 * sähen sie aus wie drei Bereiche; als Reiter sieht man, dass es einer ist.
 *
 * **Kein „Zeiten des Mandanten".** Wer die Anwendung benutzt, weiss in aller
 * Regel nicht, dass er in einem Mandanten arbeitet -- und wer es weiss,
 * verwechselt ihn leicht mit dem Kunden. Beides zusammen macht die
 * Beschriftung zu einer Erklärung, die niemand angefordert hat. „Gesamtzeiten"
 * beantwortet die Frage, die tatsächlich gestellt wird: alles oder nur meins.
 *
 * Die Bezeichner der Reiter stehen hier an einer Stelle, damit die drei Seiten
 * sie nicht je für sich schreiben -- und die Reihenfolge bleibt: vom Engsten
 * zum Weitesten.
 */
export function TimeTabs({ current }: { readonly current: TimeView }) {
  return (
    <Tabs
      label="Zeitansichten"
      current={current}
      hrefFor={(value) => HREFS[value as TimeView]}
      options={[
        { value: "eigene", label: "Meine Zeiten" },
        { value: "gesamt", label: "Gesamtzeiten" },
        { value: "kunde", label: "Zeiten nach Kunde" },
      ]}
    />
  );
}

const HREFS: Record<TimeView, string> = {
  eigene: paths.myTime,
  gesamt: paths.tenantTime,
  kunde: paths.customerTime,
};
