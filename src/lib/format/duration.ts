/**
 * Dauern in Minuten.
 *
 * `time_entries.minutes` speichert eine Ganzzahl von 1 bis 1440 -- keine
 * Start- und Endzeitpunkte. Die Begründung steht in `docs/datenmodell.md` und
 * ist ungewöhnlich genug, um sie hier zu wiederholen: Minutengenaue
 * Zeitpunkte erlaubten die Rekonstruktion von Arbeitsbeginn, Pausenlage und
 * Arbeitsende -- eine Verhaltens- und Leistungskontrolle, in Betrieben mit
 * Betriebsrat mitbestimmungspflichtig. Für die Auswertung „Aufwand je Ticket"
 * genügt die Dauer.
 *
 * Deshalb gibt es hier auch keine Stoppuhr und keinen laufenden Zähler.
 */

/** Höchstens 24 Stunden je Buchung -- der `CHECK` der Tabelle. */
export const MINUTES_MAX = 1440;
export const MINUTES_MIN = 1;

/**
 * `45` → `45 min` · `75` → `1 h 15` · `120` → `2 h`
 *
 * So schreibt es der Entwurf: unter einer Stunde in Minuten, darüber mit
 * Stunden und Restminuten, und volle Stunden ohne Nullen.
 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/**
 * Das Ergebnis einer Dauereingabe.
 *
 * `outOfRange` trägt die erkannte Minutenzahl mit, weil der Entwurf sie in
 * der Fehlermeldung nennt: „‚1500' ergibt 1500 Minuten und liegt über der
 * Grenze." Eine Meldung, die den erkannten Wert verschweigt, zwingt zum
 * Raten, ob die Eingabe falsch verstanden oder nur abgelehnt wurde.
 */
export type DurationParse =
  | { readonly kind: "empty" }
  | { readonly kind: "invalid" }
  | { readonly kind: "outOfRange"; readonly minutes: number }
  | { readonly kind: "ok"; readonly minutes: number };

/**
 * Versteht „90", „1:30" und „1,5 h" als denselben Wert.
 *
 * Der Entwurf begründet das so: „‚90' ist schneller als ‚1:30', aber ‚1,5 h'
 * ist das, was Menschen denken." Statt eine Schreibweise vorzuschreiben,
 * nimmt das Feld alle drei -- und zeigt laufend an, was gespeichert wird.
 *
 * Erkannt werden:
 *
 * | Eingabe        | Minuten | Regel                        |
 * | -------------- | ------- | ---------------------------- |
 * | `90`, `90 min` | 90      | reine Minuten                |
 * | `1:30`         | 90      | Stunden:Minuten              |
 * | `1,5 h`, `1.5h`| 90      | Dezimalstunden, Komma oder Punkt |
 * | `2h15`         | 135     | Stunden mit Restminuten      |
 *
 * > [!note] `1:75` gilt als ungültig, nicht als 135 Minuten.
 * > In der Schreibweise `H:MM` steht rechts eine Minutenangabe, und 75
 * > Minuten gibt es dort nicht. Wer 1:75 tippt, hat sich fast sicher
 * > vertippt -- das stillschweigend als 2:15 zu deuten wäre eine Auslegung,
 * > die niemand angefordert hat.
 */
export function parseDuration(input: string): DurationParse {
  const text = input.trim().toLowerCase();
  if (text === "") return { kind: "empty" };

  const minutes = readMinutes(text);
  if (minutes === null) return { kind: "invalid" };

  // Nicht ganze Minuten entstehen aus Eingaben wie „1,51 h". Abrunden wäre
  // stillschweigender Datenverlust, aufrunden ebenso -- also gerundet, und
  // die Zeile unter dem Feld zeigt sofort, was daraus wird.
  const rounded = Math.round(minutes);

  if (rounded < MINUTES_MIN || rounded > MINUTES_MAX) {
    return { kind: "outOfRange", minutes: rounded };
  }
  return { kind: "ok", minutes: rounded };
}

function readMinutes(text: string): number | null {
  // 1:30
  const clock = /^(\d{1,2}):([0-5]?\d)$/u.exec(text);
  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  // 2h15 · 2 h 15 · 2std15
  const hoursMinutes = /^(\d{1,2})\s*(?:h|std)\s*([0-5]?\d)$/u.exec(text);
  if (hoursMinutes) {
    return Number(hoursMinutes[1]) * 60 + Number(hoursMinutes[2]);
  }

  // 1,5 h · 1.5h · 2 std
  const decimalHours = /^(\d+(?:[.,]\d+)?)\s*(?:h|std)$/u.exec(text);
  if (decimalHours) {
    return Number(decimalHours[1]?.replace(",", ".")) * 60;
  }

  // 90 · 90 min · 90m
  const plainMinutes = /^(\d+)\s*(?:m|min)?$/u.exec(text);
  if (plainMinutes) {
    return Number(plainMinutes[1]);
  }

  return null;
}

/**
 * Die Zeile unter dem Feld: „= 135 Minuten (2,25 h)".
 *
 * Sie steht **laufend** da, nicht erst nach dem Absenden. Der Entwurf nennt
 * das als Zweck des Feldes: Wer „1,5 h" tippt, soll sehen, dass 90 Minuten
 * gespeichert werden, bevor er speichert.
 */
export function describeDuration(parse: DurationParse): string | null {
  switch (parse.kind) {
    case "empty":
      return null;
    case "invalid":
      return "Nicht erkannt. Möglich sind etwa 90, 1:30 oder 1,5 h.";
    case "outOfRange":
      return parse.minutes < MINUTES_MIN
        ? "Mindestens eine Minute je Buchung."
        : `Ergibt ${parse.minutes} Minuten und liegt über der Grenze. Höchstens ${MINUTES_MAX} Minuten (24 Stunden) je Buchung — bitte auf mehrere Tage aufteilen.`;
    case "ok":
      return `${parse.minutes} Minuten (${formatHours(parse.minutes)})`;
  }
}

/**
 * `375` → `6,25 h` -- die Dezimalschreibweise für Summen.
 *
 * Mit deutschem Komma. Zwei Nachkommastellen genügen: Eine Minute ist
 * 0,0167 Stunden, und mehr Stellen suggerieren eine Genauigkeit, die die
 * Eingabe nicht hat.
 */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 100) / 100;
  return `${rounded.toLocaleString("de-DE", { maximumFractionDigits: 2 })} h`;
}

/**
 * `375` -> `375 min · 6,25 h`
 *
 * Der Entwurf zeigt Summen doppelt: "Minuten stehen in Mono und werden
 * zusätzlich als Stundenwert gezeigt, weil beides gelesen wird." Minuten
 * sind die gespeicherte Größe, Stunden die, in der abgerechnet wird.
 */
export function formatMinutesAndHours(minutes: number): string {
  return `${minutes} min · ${formatHours(minutes)}`;
}
