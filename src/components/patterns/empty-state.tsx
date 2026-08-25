import { type ReactNode } from "react";

/**
 * Der Leerzustand -- und zugleich die Darstellung für „Lesen nicht erlaubt".
 *
 * > [!important] Es gibt hier nur **eine** Darstellung, und das ist der Punkt.
 * >
 * > Fehlt einem Nutzer die Leseberechtigung, liefert die Datenbank **stumm
 * > null Zeilen**. Sie wirft keinen Fehler. Für die Oberfläche ist der Fall
 * > damit von einer wirklich leeren Liste nicht zu unterscheiden -- und
 * > deshalb darf ein Leerzustand niemals behaupten, dass es nichts gibt.
 * >
 * > Falsch: „Noch keine Tickets vorhanden — jetzt eins anlegen!"
 * > Richtig: „Diese Ansicht zeigt keine Tickets."
 * >
 * > Der erste Satz behauptet etwas über die Welt, der zweite beschreibt die
 * > Ansicht. Bei entzogenem Zugriff wäre der erste schlicht gelogen.
 *
 * Aufbau in drei Teilen, wie im Entwurf: *was die Ansicht zeigt* → *was das
 * nicht heißt* → *eine Handlung, falls die Rolle sie wirklich darf*.
 *
 * Keine Illustration, keine Aufmunterung, kein Ausrufezeichen.
 */
export function EmptyState({
  shows,
  doesNotMean,
  action,
}: {
  /** Ein Satz über die **Ansicht**, nie über die Existenz von Daten. */
  readonly shows: string;
  /** Was das Fehlen bedeuten kann -- und was zu tun ist, wenn es überrascht. */
  readonly doesNotMean: string;
  /** Nur setzen, wenn die Rolle die Handlung tatsächlich ausführen darf. */
  readonly action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-subtle p-6">
      {/* Drei Balken, keine Illustration: ein Hinweis auf die Form der Liste,
          die hier stünde -- nicht mehr. */}
      <div aria-hidden="true" className="mb-4 flex gap-2">
        <span className="h-1 w-[30px] rounded-[2px] bg-border-strong" />
        <span className="h-1 w-[54px] rounded-[2px] bg-border" />
        <span className="h-1 w-5 rounded-[2px] bg-border" />
      </div>

      <p className="text-lg font-semibold text-foreground">{shows}</p>
      <p className="mt-2 max-w-[34rem] text-base leading-6 text-field-label">
        {doesNotMean}
      </p>

      {action !== undefined ? (
        <div className="mt-4 flex flex-wrap gap-2.5">{action}</div>
      ) : null}
    </div>
  );
}
