import Link from "next/link";

/**
 * Segmentierte Umschaltung, etwa „Woche / Monat".
 *
 * Verweise, keine Knöpfe: Die Wahl gehört in die Adresse. Damit ist sie
 * teilbar, der Zurück-Knopf stimmt, und die Umschaltung funktioniert ohne
 * JavaScript. Das aktive Segment ist Text und kein Verweis -- ein Link auf
 * den Zustand, in dem man ist, wäre für die Tastatur nur ein Halt mehr.
 */
export function Segmented({
  label,
  options,
  current,
  hrefFor,
}: {
  readonly label: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly current: string;
  readonly hrefFor: (value: string) => string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-md bg-muted-surface p-[3px]"
    >
      {options.map((option) => {
        const active = option.value === current;
        const classes =
          "rounded-sm px-3.5 py-[7px] text-sm no-underline hover:no-underline";

        return active ? (
          <span
            key={option.value}
            aria-current="true"
            className={`${classes} bg-card font-semibold text-foreground shadow-sm`}
          >
            {option.label}
          </span>
        ) : (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            className={`${classes} font-medium text-muted`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
