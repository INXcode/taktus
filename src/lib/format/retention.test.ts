import { describe, expect, it } from "vitest";
import {
  RETENTION_MAX,
  RETENTION_MIN,
  describeRetention,
} from "@/lib/format/retention";

describe("describeRetention", () => {
  it.each([
    [365, "= 1 Jahr"],
    [730, "= 2 Jahre"],
    [1095, "= 3 Jahre"],
    [3650, "= 10 Jahre"],
  ])("%i Tage gehen ohne Rest auf: %s", (tage, erwartet) => {
    expect(describeRetention(tage)).toBe(erwartet);
  });

  it.each([
    [30, "= rund 1 Monat"],
    [60, "= rund 2 Monate"],
    [90, "= rund 3 Monate"],
    [364, "= rund 12 Monate"],
  ])(
    "unter einem Jahr wird in Monaten gerechnet: %i → %s",
    (tage, erwartet) => {
      expect(describeRetention(tage)).toBe(erwartet);
    },
  );

  it("nennt Bruchteile eines Jahres mit Komma und mit „rund“", () => {
    expect(describeRetention(800)).toBe("= rund 2,2 Jahre");
  });

  it("sagt „rund 1 Jahr“, wenn gerundet genau ein Jahr herauskommt", () => {
    expect(describeRetention(380)).toBe("= rund 1 Jahr");
  });

  it("bleibt bei unsinnigen Werten stumm, statt etwas zu behaupten", () => {
    expect(describeRetention(0)).toBe("");
    expect(describeRetention(-5)).toBe("");
    expect(describeRetention(Number.NaN)).toBe("");
  });

  /*
   * Der eigentliche Zweck dieser Datei: Die Grenzen der Anwendung müssen die
   * der Datenbank sein. Der `CHECK` steht in
   * `supabase/migrations/20260804000000_initial_schema.sql`:
   *
   *   ticket_retention_days integer NOT NULL DEFAULT 730
   *     CHECK (ticket_retention_days BETWEEN 30 AND 3650)
   *
   * Wandert er, schlägt diese Zusicherung fehl -- und nicht erst der Nutzer,
   * der eine gültige Eingabe abgelehnt bekommt oder eine ungültige durchreicht
   * und dafür einen Datenbankfehler sieht.
   */
  it("hält die Grenzen der Tabelle ein", () => {
    expect(RETENTION_MIN).toBe(30);
    expect(RETENTION_MAX).toBe(3650);
  });
});
