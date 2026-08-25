import { type ReactNode } from "react";

export function Card({
  children,
  muted = false,
  className = "",
}: {
  readonly children: ReactNode;
  /** Gedämpfte Fläche statt Weiß, für nachgeordnete Blöcke. */
  readonly muted?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border p-4.5 ${muted ? "bg-subtle" : "bg-card"} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Kennzahl.
 *
 * Der Wert steht in Mono, weil er maschinell ist -- Minuten, Stunden,
 * Ticketzahlen. Zusammen mit `tabular-nums` aus dem Basis-Layer stehen
 * mehrere Kennzahlen dadurch auf der gleichen Ziffernbreite untereinander.
 *
 * Sparsam einsetzen: Ohne Datenbank-Views kostet jede Zahl eine eigene
 * Abfrage. Eine Kennzahl gehört dorthin, wo sie eine Entscheidung stützt --
 * ein Kachelfeld mit sechs Zahlen, die niemand braucht, ist teuer und sagt
 * nichts.
 */
export function Kpi({
  label,
  value,
  sub,
  muted = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly muted?: boolean;
}) {
  return (
    <Card muted={muted} className="flex-1">
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <p className="font-mono text-3xl font-semibold text-foreground">
        {value}
      </p>
      {sub !== undefined ? (
        <p className="mt-1 text-xs text-muted">{sub}</p>
      ) : null}
    </Card>
  );
}

/**
 * Mono-Überschrift über einem Abschnitt. Kein `<h_>`-Ersatz -- die Ebene
 * bestimmt die Seite; diese Komponente liefert nur die Form.
 */
export function SectionLabel({ children }: { readonly children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
      {children}
    </p>
  );
}
