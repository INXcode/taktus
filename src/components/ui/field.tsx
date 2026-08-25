import { type ComponentPropsWithoutRef, type ReactNode } from "react";

/**
 * Beschriftung, Hilfstext und Fehlermeldung um ein Eingabefeld.
 *
 * Die Verdrahtung mit `aria-describedby` und `aria-invalid` passiert hier und
 * nicht an jeder Aufrufstelle — sonst fehlt sie irgendwann an einer, und
 * genau dort merkt es niemand.
 */
export function Field({
  id,
  label,
  hint,
  error,
  labelSuffix,
  children,
}: {
  readonly id: string;
  readonly label: string;
  // `| undefined` ausgeschrieben, weil `exactOptionalPropertyTypes` sonst
  // schon `error={undefined}` ablehnt -- und genau so ruft eine Aufrufstelle
  // auf, die den Fehler aus einem Formularzustand ableitet.
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  /** Rechts in der Beschriftungszeile, etwa „Vergessen?" oder ein Zähler. */
  readonly labelSuffix?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-field-label">
          {label}
        </label>
        {labelSuffix}
      </div>

      {children}

      {hint !== undefined && error === undefined ? (
        <p id={`${id}-hinweis`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}

      {error !== undefined ? (
        <FieldError id={`${id}-fehler`}>{error}</FieldError>
      ) : null}
    </div>
  );
}

/**
 * Die Fehlerzeile unter einem Feld. `role="alert"` sagt sie an, sobald sie
 * erscheint — ein Fehler, den nur die Farbe trägt, erreicht niemanden, der
 * das Formular per Tastatur und Screenreader ausfüllt.
 */
export function FieldError({
  id,
  children,
}: {
  readonly id?: string;
  readonly children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-[7px] text-sm leading-[1.45] text-destructive-text"
    >
      <span aria-hidden="true" className="font-bold">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}

const inputBase = [
  "w-full rounded-md border border-border-strong bg-card",
  "px-[13px] py-[11px] text-base text-foreground",
  "min-h-[var(--size-control-mobile)] sm:min-h-[var(--size-control)]",
  "placeholder:text-muted",
  // Der Fokusring steht in globals.css. Hier bewusst nichts davon wiederholen
  // — zwei Quellen für dieselbe Regel laufen auseinander.
  "disabled:border-border disabled:bg-subtle disabled:text-text-disabled",
  "aria-invalid:border-destructive",
].join(" ");

type TextInputProps = ComponentPropsWithoutRef<"input"> & {
  readonly invalid?: boolean;
  /** Nur für den Musterkatalog -- siehe `focusPreview` in `button.tsx`. */
  readonly focusPreview?: boolean;
};

export function TextInput({
  className = "",
  invalid = false,
  focusPreview = false,
  ...props
}: TextInputProps) {
  return (
    <input
      {...(invalid ? { "aria-invalid": true } : {})}
      {...(focusPreview ? { "data-fokus-vorschau": "" } : {})}
      className={`${inputBase} ${className}`}
      {...props}
    />
  );
}
