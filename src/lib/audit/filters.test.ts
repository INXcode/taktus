import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERIOD,
  EMPTY_FILTERS,
  auditFiltersToQuery,
  hasActiveAuditFilters,
  parseAuditFilters,
  periodStart,
} from "@/lib/audit/filters";

describe("parseAuditFilters", () => {
  it("liefert ohne Parameter die Voreinstellung", () => {
    expect(parseAuditFilters({})).toEqual(EMPTY_FILTERS);
    expect(EMPTY_FILTERS.period).toBe(DEFAULT_PERIOD);
  });

  it("übernimmt bekannte Werte", () => {
    expect(
      parseAuditFilters({
        zeitraum: "30",
        aktion: "ticket.update",
        objektart: "ticket",
        seite: "3",
      }),
    ).toEqual({
      period: "30",
      action: "ticket.update",
      entityType: "ticket",
      page: 3,
    });
  });

  /*
   * Der eigentliche Zweck dieser Datei. Ein unbekannter Wert darf **nicht**
   * bis in die Abfrage durchkommen: `eq("action", "foo")` wäre noch harmlos,
   * `eq("entity_type", …)` mit einem Wert aus der Adresse ist der Anfang
   * jeder Einschleusung. Verworfen heisst hier: der Filter gilt als nicht
   * gesetzt, die Seite zeigt ungefiltert -- statt eine Fehlerseite.
   */
  it("verwirft unbekannte Werte, statt sie durchzureichen", () => {
    const filters = parseAuditFilters({
      zeitraum: "999",
      aktion: "ticket.drop-table",
      objektart: "geheim",
    });

    expect(filters.period).toBe(DEFAULT_PERIOD);
    expect(filters.action).toBeNull();
    expect(filters.entityType).toBeNull();
  });

  it("nimmt bei mehrfachem Parameter den ersten", () => {
    expect(
      parseAuditFilters({ aktion: ["ticket.create", "ticket.delete"] }),
    ).toMatchObject({ action: "ticket.create" });
  });

  it.each([["0"], ["-2"], ["abc"], [""]])(
    "fällt bei Seite %s auf 1 zurück",
    (seite) => {
      expect(parseAuditFilters({ seite }).page).toBe(1);
    },
  );
});

describe("auditFiltersToQuery", () => {
  it("lässt die Voreinstellung weg", () => {
    expect(auditFiltersToQuery(EMPTY_FILTERS)).toBe("");
  });

  it("schreibt gesetzte Filter aus", () => {
    expect(
      auditFiltersToQuery(EMPTY_FILTERS, {
        period: "90",
        entityType: "profile",
      }),
    ).toBe("?zeitraum=90&objektart=profile");
  });

  it("setzt die Seite zurück, sobald ein Filter wechselt", () => {
    const auf3 = { ...EMPTY_FILTERS, page: 3 };
    expect(auditFiltersToQuery(auf3, { action: "ticket.create" })).toBe(
      "?aktion=ticket.create",
    );
  });

  it("behält die Seite, wenn ausdrücklich geblättert wird", () => {
    expect(auditFiltersToQuery(EMPTY_FILTERS, { page: 2 })).toBe("?seite=2");
  });

  it("baut aus einer Marke die Adresse ohne diesen Filter", () => {
    const gesetzt = {
      ...EMPTY_FILTERS,
      action: "ticket.update" as const,
      entityType: "ticket" as const,
    };
    expect(auditFiltersToQuery(gesetzt, { entityType: null })).toBe(
      "?aktion=ticket.update",
    );
  });
});

describe("hasActiveAuditFilters", () => {
  it("zählt auch einen abweichenden Zeitraum als Einschränkung", () => {
    expect(hasActiveAuditFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveAuditFilters({ ...EMPTY_FILTERS, period: "alle" })).toBe(
      true,
    );
  });
});

describe("periodStart", () => {
  const jetzt = new Date("2026-08-05T12:00:00.000Z");

  it("rechnet vom übergebenen Jetzt zurück", () => {
    expect(periodStart("7", jetzt)).toBe("2026-07-29T12:00:00.000Z");
    expect(periodStart("30", jetzt)).toBe("2026-07-06T12:00:00.000Z");
  });

  it("liefert für „Gesamter Zeitraum“ keine Grenze", () => {
    expect(periodStart("alle", jetzt)).toBeNull();
  });
});
