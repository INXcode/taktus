/**
 * Platzhalter für einen Bildschirm, der noch gebaut wird.
 *
 * > [!important] Diese Komponente verschwindet wieder.
 * > Sie existiert, damit der Rahmen aus Bildschirm 5 vollständig begehbar ist,
 * > bevor die Inhalte stehen -- die Navigation je Rolle und die Wächter lassen
 * > sich sonst nicht durchklicken. Jeder Bauabschnitt ersetzt einen dieser
 * > Aufrufe durch den echten Bildschirm; ist der letzte weg, gehört die Datei
 * > gelöscht.
 *
 * Bewusst nüchtern und ohne Fortschrittsversprechen: Der Entwurf verbietet
 * Zustände, die etwas schöner aussehen lassen, als sie sind.
 */
export function InArbeit({
  screen,
  title,
}: {
  /** Nummer aus dem Bildschirmverzeichnis, damit die Zuordnung klar bleibt. */
  readonly screen: string;
  readonly title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-subtle p-6">
      <p className="font-mono text-[11px] tracking-[0.08em] text-faint uppercase">
        Bildschirm {screen}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 max-w-[34rem] text-base leading-6 text-field-label">
        Dieser Bildschirm ist noch nicht gebaut. Der Rahmen, die Navigation und
        die Zugriffsprüfung stehen bereits — der Inhalt folgt im nächsten
        Bauabschnitt.
      </p>
    </div>
  );
}
