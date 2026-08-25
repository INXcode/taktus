/**
 * Datums- und Zeitformate der Oberfläche.
 *
 * Alles über `Intl`, keine Datumsbibliothek: Das Projekt braucht vier Formate,
 * und jede Abhängigkeit kostet eine Lizenzprüfung und einen Eintrag im SBOM.
 *
 * Jede Funktion, deren Ergebnis vom „jetzt" abhängt, nimmt es als Parameter
 * entgegen. Das ist nicht Zierde, sondern die einzige Art, „heute" und
 * „gestern" prüfbar zu machen -- ein Test, der die Systemuhr liest, ist um
 * Mitternacht ein anderer Test.
 */

const ZONE = "Europe/Berlin";

const DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: ZONE,
});

const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});

const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});

/** `02.08.2026` */
export function formatDate(value: string | Date): string {
  return DATE.format(new Date(value));
}

/** `02.08.2026, 09:14` */
export function formatDateTime(value: string | Date): string {
  return DATE_TIME.format(new Date(value));
}

/** `09:14` */
export function formatTime(value: string | Date): string {
  return TIME.format(new Date(value));
}

/**
 * `28.07.` -- Tag und Monat ohne Jahr.
 *
 * So kürzt der Entwurf die Spalte „Gemeldet" auf Bildschirm 7 ab. Bewusst mit
 * abschliessendem Punkt: „28.07" sähe nach einer abgeschnittenen Zahl aus.
 */
export function formatShortDate(value: string | Date): string {
  const [day = "", month = ""] = formatDate(value).split(".");
  return `${day}.${month}.`;
}

/**
 * Der Kalendertag in der Anzeigezone, als `YYYY-MM-DD`.
 *
 * Bewusst über `Intl` und nicht über `toISOString()`: Letzteres rechnet nach
 * UTC um, und um 23:00 deutscher Zeit wäre der ausgewiesene Tag dann schon
 * der nächste. Genau dieser Fehler fällt im Test nur auf, wenn man ihn sucht.
 */
export function calendarDay(value: string | Date): string {
  const parts = DATE.formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * `heute, 08:41` · `gestern, 16:20` · `02.08.2026`
 *
 * So steht es im Entwurf für die Spalte „Angelegt". Die relative Angabe
 * reicht nur zwei Tage zurück -- „vor 5 Tagen" zwingt zum Kopfrechnen, ein
 * Datum nicht.
 */
export function formatRelativeDate(
  value: string | Date,
  now: Date = new Date(),
): string {
  const day = calendarDay(value);

  if (day === calendarDay(now)) {
    return `heute, ${formatTime(value)}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === calendarDay(yesterday)) {
    return `gestern, ${formatTime(value)}`;
  }

  return formatDate(value);
}

/**
 * ISO-Kalenderwoche als `{ jahr, woche }`.
 *
 * Nach ISO 8601, wie in Deutschland üblich: Die Woche beginnt am Montag, und
 * Woche 1 ist die mit dem ersten Donnerstag des Jahres. Der 1. Januar kann
 * damit in Woche 52 oder 53 des VORjahres liegen -- deshalb wandert das Jahr
 * mit und wird nicht aus dem Datum abgelesen.
 */
export function isoWeek(value: string | Date): {
  readonly year: number;
  readonly week: number;
} {
  const day = calendarDay(value);
  const parts = day.split("-").map(Number);
  // Mittag in UTC, damit kein Sommerzeitsprung den Tag kippt.
  const date = new Date(
    Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1, 12),
  );

  // Auf den Donnerstag derselben Woche schieben: Er bestimmt das ISO-Jahr.
  const weekday = (date.getUTCDay() + 6) % 7; // Montag = 0
  date.setUTCDate(date.getUTCDate() - weekday + 3);

  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4, 12));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);

  const week =
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

  return { year, week };
}

/**
 * Höchstens ein Tag in der Zukunft -- die Grenze für `worked_on`.
 *
 * Sie spiegelt den `CHECK` der Datenbank. Die Datenbank rechnet in UTC
 * (`(now() AT TIME ZONE 'UTC')::date + 1`), diese Prüfung in Ortszeit. Die
 * beiden können sich um einen Tag unterscheiden -- deshalb ist die hier die
 * mildere: Was sie durchlässt und die Datenbank ablehnt, endet in einer
 * Fehlermeldung; umgekehrt entstünde eine Eingabe, die der Nutzer nicht
 * versteht.
 */
export function isWithinWorkedOnRange(
  day: string,
  now: Date = new Date(),
): boolean {
  const limit = new Date(now);
  limit.setDate(limit.getDate() + 1);
  return day <= calendarDay(limit);
}

const WEEKDAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  timeZone: ZONE,
});

/** `Di, 04.08.` -- die linke Spalte auf Bildschirm 13. */
export function formatWeekday(value: string | Date): string {
  const day = WEEKDAY.format(new Date(value)).replace(".", "");
  return `${day}, ${formatShortDate(value)}`;
}

/**
 * `03.–09.08.2026` -- die Spanne einer Kalenderwoche im Gruppenkopf.
 *
 * Das Jahr steht nur einmal, am Ende. Bei einer Woche über den
 * Jahreswechsel steht es zweimal, sonst wäre die Angabe falsch.
 */
export function formatWeekRange(year: number, week: number): string {
  const monday = mondayOfIsoWeek(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);

  const vonJahr = monday.getUTCFullYear();
  const bisJahr = sunday.getUTCFullYear();

  const von = formatDate(monday);
  const bis = formatDate(sunday);

  return vonJahr === bisJahr
    ? `${von.slice(0, 6)}\u2013${bis}`
    : `${von}\u2013${bis}`;
}

/** Montag der ISO-Woche, als UTC-Mittag (kein Sommerzeitsprung). */
export function mondayOfIsoWeek(year: number, week: number): Date {
  // Der 4. Januar liegt immer in Woche 1.
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const weekday = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - weekday + (week - 1) * 7);
  return monday;
}

/** `August 2026` -- der Gruppenkopf bei monatlicher Gruppierung. */
export function formatMonth(value: string | Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: ZONE,
  }).format(new Date(value));
}
