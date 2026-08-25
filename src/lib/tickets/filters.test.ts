import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  escapeLikePattern,
  filtersToQuery,
  hasActiveFilters,
  parseFilters,
  quoteForFilterExpression,
} from "@/lib/tickets/filters";

/**
 * Jeder Wert hier kommt aus einer Adresszeile und ist damit Nutzereingabe.
 * Was diese Funktion durchlässt, landet in einer Datenbankabfrage -- ein
 * ungeprüfter Enum-Wert quittiert PostgREST mit einem Fehler, und der Nutzer
 * sähe eine kaputte Seite statt einer ungefilterten Liste.
 */
describe("parseFilters", () => {
  it("nimmt leere Parameter als „nichts gefiltert“", () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("liest gültige Werte", () => {
    expect(
      parseFilters({
        suche: "Drucker",
        status: ["open", "in_progress"],
        kategorie: "stoerung",
        sortierung: "alt",
        seite: "3",
      }),
    ).toMatchObject({
      search: "Drucker",
      status: ["open", "in_progress"],
      category: "stoerung",
      sort: "alt",
      page: 3,
    });
  });

  it("verwirft erfundene Enum-Werte, statt sie durchzureichen", () => {
    const filters = parseFilters({
      status: ["open", "erfunden", "'; drop table tickets; --"],
      kategorie: "gibtsnicht",
      sortierung: "beliebig",
    });
    expect(filters.status).toEqual(["open"]);
    expect(filters.category).toBeNull();
    expect(filters.sort).toBe("neu");
  });

  it("lässt bei der Zuweisung nur „none“ oder eine UUID zu", () => {
    expect(parseFilters({ zuweisung: "none" }).assignee).toBe("none");
    expect(
      parseFilters({ zuweisung: "11111111-0000-4000-8000-000000000002" })
        .assignee,
    ).toBe("11111111-0000-4000-8000-000000000002");
    expect(parseFilters({ zuweisung: "kim" }).assignee).toBeNull();
    expect(parseFilters({ zuweisung: "*" }).assignee).toBeNull();
  });

  /*
   * Beim Kunden gibt es kein „none“ -- jedes Ticket hat einen, die Spalte ist
   * NOT NULL. Ein Filter „ohne Kunde“ verspräche eine Auswahl, die immer leer
   * bliebe, und wäre damit dieselbe Sorte Zusage ohne Deckung wie ein
   * Prioritätsfilter ohne Prioritätsfeld.
   */
  it("lässt beim Kunden nur eine UUID zu, nicht „none“", () => {
    expect(
      parseFilters({ kunde: "11111111-0001-4000-8000-000000000001" }).customer,
    ).toBe("11111111-0001-4000-8000-000000000001");
    expect(parseFilters({ kunde: "none" }).customer).toBeNull();
    expect(parseFilters({ kunde: "Beispielkunde Nord" }).customer).toBeNull();
    expect(parseFilters({ kunde: "*" }).customer).toBeNull();
  });

  it.each(["0", "-4", "abc", ""])(
    "faellt bei der Seitenzahl %s auf 1 zurück",
    (seite) => {
      expect(parseFilters({ seite }).page).toBe(1);
    },
  );

  it("begrenzt die Suche und schneidet Leerraum ab", () => {
    expect(parseFilters({ suche: "  Drucker  " }).search).toBe("Drucker");
    expect(parseFilters({ suche: "x".repeat(500) }).search).toHaveLength(200);
  });

  it("nimmt Status auch als kommagetrennte Liste", () => {
    expect(parseFilters({ status: "open,closed" }).status).toEqual([
      "open",
      "closed",
    ]);
  });
});

describe("filtersToQuery", () => {
  it("erzeugt für den leeren Filter gar keine Abfrage", () => {
    expect(filtersToQuery(EMPTY_FILTERS)).toBe("");
  });

  it("laesst Vorgabewerte weg", () => {
    const query = filtersToQuery(EMPTY_FILTERS, { search: "Drucker" });
    expect(query).toBe("?suche=Drucker");
    expect(query).not.toContain("sortierung");
    expect(query).not.toContain("seite");
  });

  it("setzt die Seite zurück, sobald sich ein Filter ändert", () => {
    const aufSeiteDrei = { ...EMPTY_FILTERS, page: 3 };
    expect(filtersToQuery(aufSeiteDrei, { search: "neu" })).not.toContain(
      "seite",
    );
  });

  it("behält die Seite, wenn genau sie geändert wird", () => {
    expect(filtersToQuery(EMPTY_FILTERS, { page: 2 })).toContain("seite=2");
  });

  it("laesst sich verlustfrei wieder einlesen", () => {
    const filters = {
      ...EMPTY_FILTERS,
      search: "Drucker & Rolle",
      status: ["open", "waiting"] as const,
      category: "stoerung" as const,
      assignee: "11111111-0000-4000-8000-000000000002",
      customer: "11111111-0001-4000-8000-000000000001",
      sort: "alt" as const,
    };
    const query = filtersToQuery(filters);
    const zurueck = parseFilters(
      Object.fromEntries(new URLSearchParams(query.slice(1))),
    );
    expect(zurueck).toMatchObject({
      search: filters.search,
      category: filters.category,
      assignee: filters.assignee,
      customer: filters.customer,
      sort: filters.sort,
    });
  });
});

describe("hasActiveFilters", () => {
  it("ist bei leeren Filtern falsch", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("zählt die Seitenzahl nicht als Filter", () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, page: 4 })).toBe(false);
  });

  it.each([
    ["search", { search: "x" }],
    ["status", { status: ["open"] as const }],
    ["category", { category: "wartung" as const }],
    ["assignee", { assignee: "none" }],
    ["customer", { customer: "11111111-0001-4000-8000-000000000001" }],
  ])("erkennt %s als aktiven Filter", (_name, teil) => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, ...teil })).toBe(true);
  });
});

/**
 * Die Suche der Ticketliste baut einen ROHEN PostgREST-Filterausdruck. Was
 * diese beiden Funktionen durchlassen, entscheidet PostgREST danach als
 * Syntax -- nicht als Wert.
 *
 * Die Kette hat zwei Ebenen mit einem Parser dazwischen, und genau das meldet
 * CodeQL als `js/double-escaping`. Die Meldung ist ein Fehlalarm; dieser Block
 * ist der Beleg dafür. Ohne ihn wäre die Begründung an der Funktion eine
 * Behauptung -- dasselbe Prinzip, das im Projekt für RLS-Policies gilt.
 */
describe("escapeLikePattern", () => {
  it("entschärft die LIKE-Platzhalter", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  // Der Backslash muss zuerst verdoppelt werden, sonst entkäme er als
  // Maskierzeichen für das nachfolgende Zeichen.
  it("verdoppelt den Backslash", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("lässt gewöhnlichen Text unangetastet", () => {
    expect(escapeLikePattern("Drucker defekt")).toBe("Drucker defekt");
  });
});

describe("quoteForFilterExpression", () => {
  // Der Fall, der die Quotierung überhaupt nötig gemacht hat: Unquotiert
  // erzeugte diese Eingabe einen dritten Term im `or()`, den der Aufrufer nie
  // gesetzt hat -- gegen die laufende Instanz nachgestellt.
  it("lässt Komma und Punkt unverändert -- sie sind in Anführungszeichen Text", () => {
    expect(quoteForFilterExpression("12,status.eq.closed")).toBe(
      "12,status.eq.closed",
    );
  });

  it("maskiert das Anführungszeichen, das die Zeichenkette beenden würde", () => {
    expect(quoteForFilterExpression('a"b')).toBe('a\\"b');
  });

  it("maskiert den Backslash", () => {
    expect(quoteForFilterExpression("a\\b")).toBe("a\\\\b");
  });
});

/**
 * Die vollständige Kette. `entpacke` ahmt nach, was PostgREST beim Zerlegen
 * einer quotierten Zeichenkette tut: **eine** Backslash-Ebene abtragen. Was
 * danach übrig bleibt, ist das Muster, das bei ILIKE ankommt.
 */
describe("Suchmuster von der Eingabe bis zu ILIKE", () => {
  const entpacke = (wert: string) => wert.replace(/\\(.)/gu, "$1");
  const kette = (eingabe: string) =>
    entpacke(quoteForFilterExpression(escapeLikePattern(eingabe)));

  it("liefert für einen Backslash genau das LIKE-Muster für ein literales Zeichen", () => {
    expect(kette("a\\b")).toBe("a\\\\b");
  });

  it("liefert für ein Prozentzeichen ein entschärftes Prozentzeichen", () => {
    expect(kette("a%b")).toBe("a\\%b");
  });

  it("reicht gewöhnlichen Text unverändert durch", () => {
    expect(kette("Drucker defekt")).toBe("Drucker defekt");
  });

  // Der ursprüngliche Befund. Nach der Kette ist der Ausdruck ein Suchwert und
  // kein zweiter Filterterm mehr.
  it("macht aus dem Einschleusversuch einen gewöhnlichen Suchwert", () => {
    expect(kette("12,status.eq.closed")).toBe("12,status.eq.closed");
  });
});
