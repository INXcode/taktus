import { describe, expect, it } from "vitest";
import {
  describeDuration,
  formatHours,
  formatMinutes,
  parseDuration,
} from "@/lib/format/duration";

describe("formatMinutes", () => {
  it.each([
    [1, "1 min"],
    [45, "45 min"],
    [59, "59 min"],
    [60, "1 h"],
    [75, "1 h 15"],
    [120, "2 h"],
    [125, "2 h 05"],
    [1440, "24 h"],
  ])("%i Minuten werden zu %s", (minuten, erwartet) => {
    expect(formatMinutes(minuten)).toBe(erwartet);
  });

  it("füllt die Restminuten auf zwei Stellen -- sonst liest sich „2 h 5“ wie 2,5", () => {
    expect(formatMinutes(125)).toBe("2 h 05");
  });
});

describe("formatHours", () => {
  it.each([
    [45, "0,75 h"],
    [60, "1 h"],
    [375, "6,25 h"],
    [510, "8,5 h"],
  ])("%i Minuten werden zu %s", (minuten, erwartet) => {
    expect(formatHours(minuten)).toBe(erwartet);
  });

  it("schreibt mit deutschem Komma, nicht mit Punkt", () => {
    expect(formatHours(90)).toContain(",");
    expect(formatHours(90)).not.toContain(".");
  });
});

/**
 * Der Dauer-Parser ist die Stelle, an der der Entwurf am meisten verlangt:
 * „‚90', ‚1:30' und ‚1,5 h' führen zum selben Wert." Drei Schreibweisen, ein
 * Ergebnis -- und alles, was daneben liegt, muss als solches erkennbar sein
 * statt still zu etwas anderem zu werden.
 */
describe("parseDuration", () => {
  it.each([
    // Die drei Schreibweisen aus dem Entwurf, alle 90 Minuten
    ["90", 90],
    ["1:30", 90],
    ["1,5 h", 90],
    // Schreibvarianten derselben Regeln
    ["1.5h", 90],
    ["1,5h", 90],
    ["  90  ", 90],
    ["90 min", 90],
    ["90m", 90],
    ["2:15", 135],
    ["2h15", 135],
    ["2 h 15", 135],
    ["2 std", 120],
    ["0:45", 45],
    ["1440", 1440],
    ["24:00", 1440],
    ["1", 1],
  ])("liest %s als %i Minuten", (eingabe, minuten) => {
    expect(parseDuration(eingabe)).toEqual({ kind: "ok", minutes: minuten });
  });

  it("erkennt die leere Eingabe als leer, nicht als Fehler", () => {
    expect(parseDuration("")).toEqual({ kind: "empty" });
    expect(parseDuration("   ")).toEqual({ kind: "empty" });
  });

  it.each(["abc", "-30", "1:2:3", "h", ":30", "1,5,5 h", "90x", "1e3"])(
    "weist %s als ungültig ab",
    (eingabe) => {
      expect(parseDuration(eingabe).kind).toBe("invalid");
    },
  );

  it("hält 1:75 für einen Tippfehler und nicht für 2:15", () => {
    // Rechts von einem Doppelpunkt steht eine Minutenangabe. 75 gibt es dort
    // nicht -- das stillschweigend umzurechnen wäre eine Auslegung, die
    // niemand angefordert hat.
    expect(parseDuration("1:75").kind).toBe("invalid");
  });

  it("meldet zu grosse Werte samt erkannter Minutenzahl", () => {
    // Der Entwurf nennt die Zahl in der Fehlermeldung: „‚1500' ergibt 1500
    // Minuten und liegt über der Grenze."
    expect(parseDuration("1500")).toEqual({
      kind: "outOfRange",
      minutes: 1500,
    });
    expect(parseDuration("25 h")).toEqual({
      kind: "outOfRange",
      minutes: 1500,
    });
  });

  it("weist null Minuten ab -- eine Buchung über nichts ist keine", () => {
    expect(parseDuration("0")).toEqual({ kind: "outOfRange", minutes: 0 });
  });

  it("rundet Bruchteile von Minuten, statt sie stillschweigend zu verlieren", () => {
    // 1,51 h sind 90,6 Minuten.
    expect(parseDuration("1,51 h")).toEqual({ kind: "ok", minutes: 91 });
  });

  it("läuft im Kreis: was formatMinutes ausgibt, liest parseDuration zurück", () => {
    for (const minuten of [1, 45, 59, 60, 90, 135, 480, 1440]) {
      const text = formatMinutes(minuten);
      expect(parseDuration(text), `Rundlauf für ${text}`).toEqual({
        kind: "ok",
        minutes: minuten,
      });
    }
  });
});

describe("describeDuration", () => {
  it("beschreibt den Normalfall wie im Entwurf", () => {
    expect(describeDuration(parseDuration("2:15"))).toBe(
      "135 Minuten (2,25 h)",
    );
    expect(describeDuration(parseDuration("1,5 h"))).toBe("90 Minuten (1,5 h)");
  });

  it("sagt bei leerer Eingabe nichts", () => {
    expect(describeDuration(parseDuration(""))).toBeNull();
  });

  it("nennt bei Überschreitung die Grenze und den Ausweg", () => {
    const text = describeDuration(parseDuration("1500")) ?? "";
    expect(text).toContain("1500 Minuten");
    expect(text).toContain("1440");
    expect(text).toContain("mehrere Tage");
  });
});
