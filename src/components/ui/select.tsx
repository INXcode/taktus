import { type ComponentPropsWithoutRef, type ReactNode } from "react";

/**
 * Auswahlfeld -- ein natives `<select>`.
 *
 * > [!note] Bewusste Abweichung vom Entwurf, an genau einer Stelle
 * > Der Entwurf zeichnet Auslöser **und** Menü. Nachgebaut ist hier nur der
 * > Auslöser; das geöffnete Menü ist das des Systems.
 * >
 * > Jede Auswahl dieser Anwendung -- Status, Kategorie, Rolle, Zuweisung --
 * > ist eine Einfachauswahl über höchstens fünf bekannte Werte. Ein natives
 * > `<select>` bringt dafür Tastaturbedienung, Typeahead, die Rollenansage an
 * > den Screenreader, das Rad auf Mobil und das Absenden im Formular mit --
 * > ohne eine Zeile JavaScript. Eine handgebaute Listbox mit korrektem
 * > `aria-activedescendant`, Fokusrückgabe und Touch-Verhalten sind einige
 * > hundert Zeilen, die ein Prüfer als Risiko liest, nicht als Sorgfalt.
 * >
 * > Wo Nativ wirklich nicht trägt -- die Ticketsuche auf Bildschirm 12 --
 * > steht ein eigenes Widget. Eines, nicht zwei.
 *
 * `appearance-none` plus der Pfeil als Hintergrundbild bildet den Auslöser
 * des Entwurfs nach. Der Pfeil ist ein Data-URI, kein externes Bild: Die CSP
 * bleibt damit bei `img-src 'self' data:`.
 */
const CARET =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%235a5c60' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

type SelectProps = ComponentPropsWithoutRef<"select"> & {
  readonly invalid?: boolean;
  readonly children: ReactNode;
};

export function Select({
  className = "",
  invalid = false,
  children,
  ...props
}: SelectProps) {
  return (
    <select
      {...(invalid ? { "aria-invalid": true } : {})}
      style={{
        backgroundImage: `url("${CARET}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 13px center",
        backgroundSize: "10px 6px",
      }}
      className={`w-full appearance-none rounded-md border border-border-strong bg-card py-[11px] pr-9 pl-[13px] text-base text-foreground min-h-[var(--size-control-mobile)] sm:min-h-[var(--size-control)] disabled:border-border disabled:bg-subtle disabled:text-text-disabled aria-invalid:border-destructive ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
