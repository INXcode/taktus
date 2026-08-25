import { beforeAll, describe, expect, it } from "vitest";
import { signSuggestion, verifySuggestion } from "./provenance";

/**
 * Der Herkunftsnachweis ist die einzige Stelle im Projekt, an der eine
 * Kennzeichnung von einer Signatur abhängt. Ein stiller Fehler hier hiesse:
 * Ein selbst getippter Text trägt „von der KI, ungeprüft" -- oder ein echter
 * Vorschlag lässt sich nicht mehr übernehmen.
 *
 * Geprüft wird deshalb nicht nur der glückliche Fall, sondern **jede** der
 * vier Bindungen einzeln.
 */

const NUTZER = "11111111-1111-1111-1111-111111111111";
const ANDERER_NUTZER = "22222222-2222-2222-2222-222222222222";

const VORSCHLAG = {
  summary: "Drucker im zweiten Stock nimmt keine Aufträge an.",
  category: "stoerung",
  model: "beispiel-modell-v1",
  generatedAt: "2026-08-12T09:00:00.000Z",
  userId: NUTZER,
} as const;

const ERWARTET = {
  summary: VORSCHLAG.summary,
  category: VORSCHLAG.category,
  userId: NUTZER,
} as const;

beforeAll(() => {
  // Die Ableitung braucht Schlüsselmaterial. Ein Testwert genügt -- geprüft
  // wird die Bindung, nicht die Stärke des Schlüssels.
  process.env.SUPABASE_SERVICE_ROLE_KEY = "testschluessel-nur-fuer-vitest";
});

describe("signSuggestion / verifySuggestion", () => {
  it("bezeugt einen unveränderten Vorschlag", () => {
    const token = signSuggestion(VORSCHLAG);

    expect(verifySuggestion(token, ERWARTET)).toEqual({
      model: "beispiel-modell-v1",
      generatedAt: "2026-08-12T09:00:00.000Z",
    });
  });

  it("gibt Modell und Zeitpunkt aus dem Nachweis zurück, nicht aus der Eingabe", () => {
    // Das ist der eigentliche Zweck: Die Herkunftsangaben stammen aus der
    // signierten Nutzlast. Das Formular kann sie nicht setzen.
    const token = signSuggestion({ ...VORSCHLAG, model: "anderes-modell" });
    expect(verifySuggestion(token, ERWARTET)?.model).toBe("anderes-modell");
  });

  // --- Die vier Bindungen, einzeln ----------------------------------------

  it("weist einen veränderten Text ab", () => {
    const token = signSuggestion(VORSCHLAG);

    expect(
      verifySuggestion(token, {
        ...ERWARTET,
        summary: "Etwas ganz anderes, das ich selbst getippt habe.",
      }),
    ).toBeNull();
  });

  it("weist eine veränderte Kategorie ab", () => {
    const token = signSuggestion(VORSCHLAG);

    expect(
      verifySuggestion(token, { ...ERWARTET, category: "anfrage" }),
    ).toBeNull();
  });

  it("weist den Nachweis eines anderen Nutzers ab", () => {
    const token = signSuggestion(VORSCHLAG);

    expect(
      verifySuggestion(token, { ...ERWARTET, userId: ANDERER_NUTZER }),
    ).toBeNull();
  });

  it("weist einen abgelaufenen Nachweis ab", () => {
    const ausgestellt = 1_000_000;
    const token = signSuggestion(VORSCHLAG, ausgestellt);

    // Kurz davor gilt er noch.
    expect(
      verifySuggestion(token, ERWARTET, ausgestellt + 29 * 60 * 1000),
    ).not.toBeNull();

    // Eine halbe Stunde später nicht mehr.
    expect(
      verifySuggestion(token, ERWARTET, ausgestellt + 31 * 60 * 1000),
    ).toBeNull();
  });

  // --- Manipulation --------------------------------------------------------

  it("weist eine veränderte Nutzlast bei gültiger Form ab", () => {
    const token = signSuggestion(VORSCHLAG);
    const [, unterschrift] = token.split(".");

    // Eigene Nutzlast, fremde Unterschrift -- der klassische Versuch.
    const gefaelscht = Buffer.from(
      JSON.stringify({
        s: "egal",
        c: "stoerung",
        m: "erfundenes-modell",
        g: "2026-08-12T09:00:00.000Z",
        u: NUTZER,
        e: Date.now() + 60_000,
      }),
      "utf8",
    ).toString("base64url");

    expect(
      verifySuggestion(`${gefaelscht}.${unterschrift}`, ERWARTET),
    ).toBeNull();
  });

  it("weist eine veränderte Unterschrift ab", () => {
    const token = signSuggestion(VORSCHLAG);
    const [kodiert, unterschrift] = token.split(".");
    const verdreht =
      unterschrift!.slice(0, -1) + (unterschrift!.endsWith("A") ? "B" : "A");

    expect(verifySuggestion(`${kodiert}.${verdreht}`, ERWARTET)).toBeNull();
  });

  it("weist Unfug ab, ohne zu werfen", () => {
    for (const unfug of ["", ".", "a.b", "kein-punkt", "a.b.c"]) {
      expect(verifySuggestion(unfug, ERWARTET)).toBeNull();
    }
  });

  it("weist eine Kategorie ausserhalb der Aufzählung ab", () => {
    // Selbst mit gültiger Unterschrift: Was nicht in CATEGORY_ORDER steht,
    // käme sonst als Kategorie in die Spalte.
    const token = signSuggestion({
      ...VORSCHLAG,
      category: "erfunden" as unknown as typeof VORSCHLAG.category,
    });

    expect(
      verifySuggestion(token, {
        ...ERWARTET,
        category: "erfunden" as unknown as typeof VORSCHLAG.category,
      }),
    ).toBeNull();
  });
});
