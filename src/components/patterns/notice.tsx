import { type ReactNode } from "react";

/**
 * Rückmeldung nach dem Speichern -- Erfolg, Fehler, Hinweis.
 *
 * Die Art trägt drei Merkmale: die farbige Kante links, die Glyphe und den
 * Text. Nie die Farbe allein.
 *
 * `role` unterscheidet sich bewusst: Ein Fehler ist `alert` und wird sofort
 * angesagt, Erfolg und Hinweis sind `status` und warten, bis der Screenreader
 * gerade nichts anderes vorliest. Alles auf `alert` zu setzen macht den
 * Fehlerfall wertlos, weil er dann nicht mehr heraussticht.
 */
export type NoticeKind = "success" | "error" | "info";

const KINDS = {
  success: { edge: "border-l-success", glyph: "✓", tone: "text-success" },
  error: { edge: "border-l-destructive", glyph: "!", tone: "text-destructive" },
  info: { edge: "border-l-warning", glyph: "•", tone: "text-warning" },
} as const satisfies Record<
  NoticeKind,
  { edge: string; glyph: string; tone: string }
>;

export function Notice({
  kind,
  children,
  action,
}: {
  readonly kind: NoticeKind;
  readonly children: ReactNode;
  /** Rechtsbündig, etwa „Öffnen" nach dem Anlegen. */
  readonly action?: ReactNode;
}) {
  const style = KINDS[kind];

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-md border border-border border-l-[3px] bg-card px-4 py-3.5 shadow-md ${style.edge} ${kind === "success" ? "items-center" : "items-start"}`}
    >
      <span
        aria-hidden="true"
        className={`text-md leading-6 font-bold ${style.tone}`}
      >
        {style.glyph}
      </span>
      <span className="text-base leading-[1.5] text-foreground">
        {children}
      </span>
      {action !== undefined ? (
        <span className="ml-auto shrink-0 text-sm font-semibold">{action}</span>
      ) : null}
    </div>
  );
}

/**
 * Die zweite Hälfte von Bildschirm 24: Schreiben ohne Berechtigung.
 *
 * Anders als beim Lesen wirft die Datenbank hier einen Fehler -- es gibt also
 * etwas zu melden. Der Satz „nichts wurde geändert" gehört dazu und ist keine
 * Höflichkeit: Er beantwortet die Frage, die sich sonst jeder stellt.
 */
export function WriteDeniedNotice() {
  return (
    <Notice kind="error">
      Speichern nicht möglich: Für diese Änderung fehlt die Berechtigung. Die
      vorhandene Fassung ist unverändert — es wurde nichts geändert.
    </Notice>
  );
}
