import { type ReactNode } from "react";

/**
 * Listen als CSS-Raster, nicht als `<table>`.
 *
 * Der Entwurf legt je Bildschirm eigene Spaltenbreiten fest und bricht auf
 * Mobil in Karten um -- beides trägt ein Raster, eine Tabelle nicht ohne
 * Verrenkungen. Die Spaltenvorlage kommt deshalb als Eigenschaft herein.
 *
 * Der Preis ist die Semantik: Ein Raster ist für einen Screenreader keine
 * Tabelle. Deshalb tragen Container und Zeilen ausdrücklich `role="table"`,
 * `role="row"` und `role="cell"` -- ohne die Rollen wäre die Liste eine Folge
 * zusammenhangloser Textblöcke.
 */
export function Table({
  caption,
  children,
}: {
  /** Wird nur angesagt, nicht angezeigt -- die Überschrift steht darüber. */
  readonly caption: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="table"
      aria-label={caption}
      className="tabular overflow-hidden rounded-lg border border-border"
    >
      {children}
    </div>
  );
}

export function TableHead({
  columns,
  children,
}: {
  readonly columns: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="row"
      style={{ gridTemplateColumns: columns }}
      className="grid gap-4 border-b border-border bg-subtle px-4.5 py-3.5 text-xs font-semibold text-muted"
    >
      {children}
    </div>
  );
}

export function TableRow({
  columns,
  children,
  href,
  emphasis = false,
  className = "",
}: {
  readonly columns: string;
  readonly children: ReactNode;
  /** Ist die Zeile anklickbar, wird sie ein Verweis statt eines `div`. */
  readonly href?: string;
  /** Eigene Zeile in einer Liste des Mandanten -- zarter violetter Grund. */
  readonly emphasis?: boolean;
  /**
   * Zusatzklassen der Zeile.
   *
   * Gebraucht dort, wo die Zeile nicht selbst der Verweis sein kann, weil in
   * ihr noch eine Schaltfläche steht -- ein `<button>` in einem `<a>` ist
   * ungültiges Markup. Die Zeitlisten legen deshalb einen gedehnten Verweis
   * hinein und brauchen dafür `relative` an der Zeile.
   */
  readonly className?: string;
}) {
  const classes = `grid items-center gap-4 border-b border-muted-surface px-4.5 py-4 last:border-b-0 ${
    emphasis ? "bg-primary-tint" : ""
  } ${href !== undefined ? "no-underline hover:bg-subtle hover:no-underline" : ""} ${className}`;

  if (href !== undefined) {
    return (
      // `data-row` schaltet in globals.css auf den nach innen gelegten
      // Fokusring -- ein äußerer Ring würde das Raster sprengen und über die
      // abgerundete Kante der Tabelle hinausstehen.
      <a
        href={href}
        role="row"
        data-row
        style={{ gridTemplateColumns: columns }}
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <div
      role="row"
      style={{ gridTemplateColumns: columns }}
      className={classes}
    >
      {children}
    </div>
  );
}

export function TableCell({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <span role="cell" className={`min-w-0 ${className}`}>
      {children}
    </span>
  );
}

/**
 * Skelett in der Form des kommenden Inhalts, nicht als graue Fläche.
 *
 * Der Entwurf verlangt das ausdrücklich: Balken dort, wo Text kommt, eine
 * Pillenform dort, wo der Status kommt. Ein Skelett, das anders aussieht als
 * das Ergebnis, lässt den Inhalt beim Eintreffen springen.
 */
export function TableSkeleton({
  columns,
  rows = 5,
  shapes,
}: {
  readonly columns: string;
  readonly rows?: number;
  /** Je Spalte die Form des Platzhalters. */
  readonly shapes: readonly ("text" | "short" | "pill" | "chip")[];
}) {
  const shapeClass = {
    text: "h-[13px] w-3/4 rounded",
    short: "h-[13px] w-7 rounded",
    pill: "h-5 w-[88px] rounded-full",
    chip: "h-5 w-[78px] rounded-sm",
  } as const;

  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          style={{ gridTemplateColumns: columns }}
          className="grid animate-pulse items-center gap-4 border-b border-muted-surface px-4.5 py-4 last:border-b-0"
        >
          {shapes.map((shape, column) => (
            <span
              key={column}
              className={`block bg-muted-surface ${shapeClass[shape]}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
