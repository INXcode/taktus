import { type ComponentPropsWithoutRef } from "react";

/**
 * Schalter und Kästchen.
 *
 * Beide sind ein `<input type="checkbox">` mit `peer`, kein nachgebautes
 * `div` mit `role`. Damit stimmen Tastatur, Formularübertragung und die
 * Ansage an unterstützende Technik von selbst -- und `:disabled` greift, ohne
 * dass ein Zustand doppelt geführt wird.
 *
 * Der Schalter trägt zusätzlich `role="switch"`: Für einen Screenreader ist
 * „ein/aus" etwas anderes als „angehakt", und der KI-Schalter auf
 * Bildschirm 18 entscheidet, ob Daten an einen Dritten gehen.
 */

type ToggleProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  readonly label: string;
  /** Sichtbarer Zusatz rechts, etwa „Aus" oder „Gesperrt". */
  readonly stateLabel?: string;
};

export function Toggle({
  label,
  stateLabel,
  className = "",
  ...props
}: ToggleProps) {
  return (
    <label className={`inline-flex items-center gap-2.5 ${className}`}>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        {...props}
      />
      <span
        aria-hidden="true"
        className="flex h-6 w-[42px] shrink-0 items-center rounded-full bg-border-strong p-[3px] transition-colors duration-[var(--duration-fast)] peer-checked:bg-primary peer-checked:[&>span]:translate-x-[18px] peer-disabled:border peer-disabled:border-border peer-disabled:bg-muted-surface peer-disabled:[&>span]:bg-border"
      >
        <span className="block size-[18px] rounded-full bg-card transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)]" />
      </span>
      <span className="text-base text-body peer-disabled:text-text-disabled">
        {stateLabel ?? label}
      </span>
    </label>
  );
}

type CheckboxProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  readonly label: string;
};

export function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2.5 ${className}`}>
      <input type="checkbox" className="peer sr-only" {...props} />
      {/*
        Das Häkchen wird über `[&>span]` angesprochen, nicht über
        `peer-checked:` am Kind selbst: Der Peer-Modifikator erzeugt einen
        Geschwister-Kombinator (`~`) und erreicht damit kein Nachkommen-
        Element. Als `peer-checked:opacity-100` am inneren span bliebe das
        Häkchen unsichtbar -- und zwar lautlos.
      */}
      <span
        aria-hidden="true"
        className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border-strong bg-card text-xs font-bold text-on-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:[&>span]:opacity-100 peer-disabled:bg-muted-surface"
      >
        <span className="opacity-0">✓</span>
      </span>
      <span className="text-base text-body peer-disabled:text-text-disabled">
        {label}
      </span>
    </label>
  );
}
