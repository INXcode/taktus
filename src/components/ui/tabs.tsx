import Link from "next/link";

/**
 * Reiter über einem Abschnitt, etwa „Kommentare / Zeiten".
 *
 * Verweise, keine Knöpfe -- dieselbe Begründung wie bei `Segmented`: Die Wahl
 * gehört in die Adresse. Damit ist sie teilbar, der Zurück-Knopf stimmt, und
 * die Umschaltung funktioniert ohne JavaScript. Der aktive Reiter ist Text und
 * kein Verweis; ein Link auf den Zustand, in dem man ist, wäre für die
 * Tastatur nur ein Halt mehr.
 *
 * **Kein `role="tablist"`.** Die ARIA-Rolle verspricht zwei Dinge, die diese
 * Umsetzung nicht hält: Bedienung mit den Pfeiltasten und einen Inhaltsbereich,
 * der ohne Seitenwechsel tauscht. Hier lädt ein Reiter die Seite neu -- eine
 * Navigation aus Verweisen ist dafür die ehrliche Auszeichnung, und
 * Hilfsmittel kündigen sie dann auch als das an, was passiert.
 *
 * Die Anzahl steht **im** Reiter und nicht daneben: Sie ist der Grund, den
 * anderen Reiter überhaupt anzusehen.
 */
export function Tabs({
  label,
  options,
  current,
  hrefFor,
}: {
  readonly label: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
    readonly count?: number;
  }[];
  readonly current: string;
  readonly hrefFor: (value: string) => string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 border-b border-border">
      {options.map((option) => {
        const active = option.value === current;
        const classes =
          "-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-base no-underline hover:no-underline";
        const zahl =
          option.count === undefined ? null : (
            <span
              className={`rounded-[5px] px-[7px] py-0.5 text-[11.5px] font-semibold ${
                active
                  ? "bg-primary-soft text-primary-text"
                  : "bg-muted-surface text-muted"
              }`}
            >
              {option.count}
            </span>
          );

        return active ? (
          <span
            key={option.value}
            aria-current="page"
            className={`${classes} border-primary font-semibold text-foreground`}
          >
            {option.label}
            {zahl}
          </span>
        ) : (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            className={`${classes} border-transparent font-medium text-muted hover:border-border-strong hover:text-body`}
          >
            {option.label}
            {zahl}
          </Link>
        );
      })}
    </nav>
  );
}
