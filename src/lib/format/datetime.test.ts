import { describe, expect, it } from "vitest";
import {
  calendarDay,
  formatDate,
  formatRelativeDate,
  isWithinWorkedOnRange,
  isoWeek,
  formatWeekday,
  formatWeekRange,
  mondayOfIsoWeek,
} from "@/lib/format/datetime";

/**
 * Die Tests geben „jetzt“ immer selbst vor. Ein Test, der die Systemuhr
 * liest, ist um Mitternacht ein anderer Test -- und ein Fehler, der nur
 * zwischen 23:00 und 00:00 auftritt, ist der teuerste, den es gibt.
 */
describe("calendarDay", () => {
  it("nennt den Tag in deutscher Zeit, nicht in UTC", () => {
    // 22:00 UTC am 4. August ist in Berlin bereits der 5. (Sommerzeit, UTC+2).
    // `toISOString().slice(0,10)` lieferte hier den 4. -- genau der Fehler,
    // gegen den diese Zeile steht.
    expect(calendarDay("2026-08-04T22:00:00Z")).toBe("2026-08-05");
    expect(calendarDay("2026-08-04T21:59:00Z")).toBe("2026-08-04");
  });

  it("kommt auch im Winter zurecht (UTC+1)", () => {
    expect(calendarDay("2026-01-15T23:30:00Z")).toBe("2026-01-16");
    expect(calendarDay("2026-01-15T22:30:00Z")).toBe("2026-01-15");
  });
});

describe("formatRelativeDate", () => {
  const jetzt = new Date("2026-08-04T09:00:00Z");

  it("sagt „heute“ mit Uhrzeit", () => {
    expect(formatRelativeDate("2026-08-04T06:41:00Z", jetzt)).toBe(
      "heute, 08:41",
    );
  });

  it("sagt „gestern“ mit Uhrzeit", () => {
    expect(formatRelativeDate("2026-08-03T14:20:00Z", jetzt)).toBe(
      "gestern, 16:20",
    );
  });

  it("nennt ab vorgestern das Datum", () => {
    expect(formatRelativeDate("2026-08-02T14:20:00Z", jetzt)).toBe(
      "02.08.2026",
    );
  });

  it("stolpert nicht über den Monatswechsel", () => {
    const amErsten = new Date("2026-09-01T09:00:00Z");
    expect(formatRelativeDate("2026-08-31T10:00:00Z", amErsten)).toBe(
      "gestern, 12:00",
    );
  });
});

describe("formatDate", () => {
  it("schreibt deutsch mit führenden Nullen", () => {
    expect(formatDate("2026-01-05T12:00:00Z")).toBe("05.01.2026");
  });
});

/**
 * Die Kalenderwoche gruppiert Bildschirm 13 und 14. Der Jahreswechsel ist
 * die einzige Stelle, an der eine naive Rechnung sichtbar falsch wird.
 */
describe("isoWeek", () => {
  it.each([
    ["2026-08-04T12:00:00Z", 2026, 32],
    // 1. Januar 2027 ist ein Freitag -> gehoert noch in Woche 53 von 2026.
    ["2027-01-01T12:00:00Z", 2026, 53],
    // 4. Januar liegt immer in Woche 1.
    ["2027-01-04T12:00:00Z", 2027, 1],
    // 31. Dezember 2024 ist ein Dienstag -> Woche 1 des Folgejahres.
    ["2024-12-31T12:00:00Z", 2025, 1],
  ])("ordnet %s der Woche %i/%i zu", (wert, jahr, woche) => {
    expect(isoWeek(wert)).toEqual({ year: jahr, week: woche });
  });

  it("gibt der Woche denselben Wert an jedem ihrer Tage", () => {
    const montag = isoWeek("2026-08-03T12:00:00Z");
    const sonntag = isoWeek("2026-08-09T12:00:00Z");
    expect(montag).toEqual(sonntag);
    // Der Folgetag beginnt eine neue Woche.
    expect(isoWeek("2026-08-10T12:00:00Z").week).toBe(montag.week + 1);
  });
});

describe("isWithinWorkedOnRange", () => {
  const jetzt = new Date("2026-08-04T09:00:00Z");

  it.each([
    ["2026-08-04", true, "heute"],
    ["2026-08-05", true, "morgen -- die Grenze"],
    ["2026-08-03", true, "gestern"],
    ["2020-01-01", true, "lange her"],
    ["2026-08-06", false, "übermorgen"],
  ])("%s ist %s (%s)", (tag, erlaubt) => {
    expect(isWithinWorkedOnRange(tag, jetzt)).toBe(erlaubt);
  });
});

describe("formatWeekday", () => {
  it("nennt Wochentag und Datum wie im Entwurf", () => {
    // 4. August 2026 ist ein Dienstag.
    expect(formatWeekday("2026-08-04T10:00:00Z")).toBe("Di, 04.08.");
  });
});

describe("formatWeekRange", () => {
  it("nennt das Jahr nur einmal, wenn die Woche in einem Jahr liegt", () => {
    expect(formatWeekRange(2026, 32)).toBe("03.08.–09.08.2026");
  });

  it("nennt beide Jahre, wenn die Woche über den Jahreswechsel geht", () => {
    // KW 53/2026 laeuft vom 28.12.2026 bis 03.01.2027.
    expect(formatWeekRange(2026, 53)).toBe("28.12.2026–03.01.2027");
  });

  it("passt zu isoWeek -- der Montag liegt in derselben Woche", () => {
    for (const woche of [1, 15, 32, 52]) {
      const montag = mondayOfIsoWeek(2026, woche);
      expect(isoWeek(montag)).toEqual({ year: 2026, week: woche });
    }
  });
});
