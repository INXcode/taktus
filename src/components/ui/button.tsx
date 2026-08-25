import { type ComponentPropsWithoutRef, type ReactNode } from "react";

/**
 * Die vier Knopfarten aus dem Komponenteninventar.
 *
 * `data-variant` steht nicht zur Zierde im Markup: `globals.css` hängt die
 * Fokusfarbe daran. Ein gefährlicher Knopf bekommt einen roten Ring, ein
 * flacher gar keinen Halo — beides über `:where([data-variant=…])`, damit die
 * Regel keine Utility-Klasse überstimmt.
 */
export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const base = [
  "inline-flex items-center justify-center gap-[9px]",
  "rounded-md text-base font-semibold",
  // 44 px auf Mobil, 40 px ab Tablet — Mindestziel für den Finger, wie im
  // Entwurf festgelegt.
  "min-h-[var(--size-control-mobile)] sm:min-h-[var(--size-control)]",
  // 8 px senkrecht, nicht 10: Zusammen mit der Zeilenhöhe von 22 px und dem
  // Rahmen ergibt das exakt die 40 px des Entwurfs. Mit 10 px waren es 42.
  "px-[18px] py-2",
  // Nur die Rahmenbreite. Die FARBE setzt jede Variante selbst -- auch dort,
  // wo sie durchsichtig ist.
  //
  // Der Rahmen muss bei jeder Art stehen, sonst waren Primär und Flach 42 px
  // hoch und Sekundär und Gefährlich 44, weil die beiden mit Rahmen um dessen
  // 2 px wuchsen. Ein primärer neben einem sekundären Knopf stand damit nicht
  // auf einer Linie.
  //
  // Die Farbe hier NICHT mitzugeben ist kein Stil, sondern notwendig: Stünde
  // `border-transparent` in dieser Zeichenkette, gewänne es gegen das
  // `border-border-strong` der Variante -- Tailwind entscheidet solche
  // Konflikte über die Reihenfolge im erzeugten Stylesheet, nicht über die im
  // Klassenattribut. Genau so waren die Rahmen einmal alle unsichtbar.
  "border",
  // Bewusst NICHT `transition-colors`: Das schliesst in Tailwind v4 auch
  // `outline-color` ein, und der Fokusring blendete dann ueber 120 ms ein --
  // waehrend der Halo als box-shadow sofort dasteht. Das Auseinanderlaufen
  // laesst den Ring weich und schwer fassbar wirken. Ein Fokusindikator soll
  // sofort da sein; die Aufzaehlung nimmt ihn deshalb aus.
  "transition-[color,background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
  "disabled:cursor-not-allowed",
].join(" ");

/**
 * Ruhe und Überfahren je Art -- getrennt von den Deaktiviert-Klassen darunter.
 *
 * Die Trennung ist nicht kosmetisch: **Ladend ist nicht deaktiviert.** Der
 * Entwurf zeigt den ladenden Knopf in voller Farbe mit Laufring; ein grau
 * eingefärbter Knopf sähe aus, als sei die Aktion abgewiesen worden. Der
 * Knopf ist während des Ladens trotzdem gesperrt -- gegen das zweite Klicken
 * --, nur eben ohne die Färbung.
 */
const variants: Record<ButtonVariant, string> = {
  primary: [
    "border-transparent bg-primary text-on-primary",
    "hover:not-disabled:bg-primary-hover",
  ].join(" "),
  secondary: [
    "border-border-strong bg-card text-body",
    "hover:not-disabled:border-primary hover:not-disabled:bg-subtle",
  ].join(" "),
  destructive: [
    "border-destructive-border bg-card text-destructive",
    "hover:not-disabled:border-destructive hover:not-disabled:bg-destructive hover:not-disabled:text-on-primary",
  ].join(" "),
  ghost: [
    "border-transparent bg-transparent px-3 text-primary",
    "hover:not-disabled:bg-primary-soft hover:not-disabled:text-primary-active",
  ].join(" "),
};

const disabledVariants: Record<ButtonVariant, string> = {
  primary: "disabled:bg-muted-surface disabled:text-text-disabled",
  secondary: "disabled:border-border disabled:text-text-disabled",
  destructive: "disabled:border-border disabled:text-text-disabled",
  ghost: "disabled:bg-transparent disabled:text-text-disabled",
};

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
  /**
   * Der Vorgang läuft.
   *
   * > [!important] Ladend wird **nicht** über `disabled` gesperrt.
   * > Ein `disabled`-Knopf fällt aus der Tab-Reihenfolge. Wer ihn gerade mit
   * > der Tastatur ausgelöst hat, verliert den Fokus in dem Moment ans
   * > Dokument und weiß nicht mehr, wo er steht -- ausgerechnet während er
   * > auf eine Antwort wartet.
   * >
   * > Stattdessen `aria-disabled` plus `aria-busy`: Der Knopf bleibt
   * > fokussierbar und ansagbar, die Auslösung wird unterbunden. Das ist der
   * > Grund, warum der Ladezustand im Musterkatalog keinen Fokusring zeigte
   * > und jetzt einen bekommt.
   */
  readonly loading?: boolean;
  /**
   * Zeigt den Fokusring, ohne dass der Knopf fokussiert ist.
   *
   * **Nur für den Musterkatalog.** `:focus-visible` trifft bei einem Mausklick
   * absichtlich nicht, und in Safari erreicht der Tabulator Knöpfe erst, wenn
   * „Press Tab to highlight each item" eingeschaltet ist -- der wichtigste
   * Zustand des Inventars wäre sonst je nach Browser gar nicht vorführbar.
   * Die Regel dazu steht in `globals.css` im selben Selektor wie der echte
   * Fokus, damit Vorschau und Wirklichkeit nicht auseinanderlaufen.
   */
  readonly focusPreview?: boolean;
  readonly children: ReactNode;
};

export function Button({
  variant = "primary",
  fullWidth = false,
  loading = false,
  disabled = false,
  focusPreview = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      data-variant={variant}
      disabled={disabled}
      {...(loading ? { "aria-disabled": true, "aria-busy": true } : {})}
      {...(focusPreview ? { "data-fokus-vorschau": "" } : {})}
      className={`${base} ${variants[variant]} ${loading ? "aria-disabled:cursor-progress" : disabledVariants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/*
 * Hier steht bewusst **keine** Sperre gegen das zweite Klicken.
 *
 * Diese Datei ist eine Server-Komponente, und ein `onClick` darin liesse sich
 * nicht an den Browser übertragen -- Next bricht die Seite dann mit „Event
 * handlers cannot be passed to Client Component props" ab. Die Sperre gehört
 * deshalb in `submit-button.tsx`, das ohnehin ein Client-Blatt ist.
 *
 * Wer `Button` direkt mit `loading` verwendet, bekommt die Kennzeichnung für
 * unterstützende Technik und die Optik, muss das Auslösen aber selbst
 * unterbinden.
 */

type LinkButtonProps = ComponentPropsWithoutRef<"a"> & {
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
  readonly children: ReactNode;
};

/**
 * Ein Verweis, der wie ein Knopf aussieht.
 *
 * Getrennt von `Button`, statt über eine `as`-Eigenschaft: Ein `<a>` ohne
 * `href` ist für die Tastatur nicht erreichbar, und ein `<button>`, das
 * navigiert, meldet dem Screenreader die falsche Rolle. Die Trennung macht
 * den Unterschied an der Aufrufstelle sichtbar.
 */
export function LinkButton({
  variant = "secondary",
  fullWidth = false,
  className = "",
  children,
  ...props
}: LinkButtonProps) {
  return (
    <a
      data-variant={variant}
      className={`${base} no-underline hover:no-underline ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * Der Laufring aus dem Inventar. Rein dekorativ — die Ansage an
 * unterstützende Technik macht die Beschriftung des Knopfes („Speichert…"),
 * nicht dieses Element.
 */
export function Spinner({ variant = "primary" }: { variant?: ButtonVariant }) {
  const track =
    variant === "primary"
      ? "border-white/45 border-t-white"
      : variant === "destructive"
        ? "border-destructive-track border-t-destructive"
        : "border-border border-t-primary";

  return (
    <span
      aria-hidden="true"
      className={`inline-block size-[13px] shrink-0 animate-spin rounded-full border-2 ${track}`}
    />
  );
}
