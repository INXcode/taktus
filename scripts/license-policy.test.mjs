import { describe, expect, it } from "vitest";
import {
  auswerten,
  buildExceptions,
  buildPolicy,
  classifyExpression,
} from "./license-policy.mjs";

const policy = buildPolicy({
  allow: [
    "MIT",
    "Apache-2.0",
    "ISC",
    "GPL-2.0-or-later",
    "GPL-3.0-only",
    "AGPL-3.0-or-later",
    "LGPL-3.0-or-later",
  ],
  allowMitBegruendung: {
    "CC-BY-4.0": "Datensatz, keine Software",
  },
  deny: ["GPL-2.0-only", "GPL-2.0", "SSPL-1.0", "UNLICENSED"],
});

describe("classifyExpression", () => {
  it("lässt einfache Positivlisten-Bezeichner zu", () => {
    expect(classifyExpression("MIT", policy).status).toBe("allow");
    expect(classifyExpression("Apache-2.0", policy).status).toBe("allow");
  });

  it("berücksichtigt Einträge aus allowMitBegruendung", () => {
    expect(classifyExpression("CC-BY-4.0", policy).status).toBe("allow");
  });

  it("weist Negativlisten-Bezeichner ab", () => {
    expect(classifyExpression("SSPL-1.0", policy).status).toBe("deny");
    expect(classifyExpression("UNLICENSED", policy).status).toBe("deny");
  });

  // Der Kern der ganzen Politik (CONTRIBUTING.md): Copyleft ist in diesem
  // Projekt zulässig -- ausser dieser einen Variante.
  describe("der GPL-2.0-Fallstrick", () => {
    it("weist GPL-2.0-only ab, weil mit AGPL-3.0 unvereinbar", () => {
      expect(classifyExpression("GPL-2.0-only", policy).status).toBe("deny");
    });

    it("lässt GPL-2.0-or-later zu, weil auf GPLv3 hochziehbar", () => {
      expect(classifyExpression("GPL-2.0-or-later", policy).status).toBe(
        "allow",
      );
    });

    it("behandelt die alte Schreibweise GPL-2.0+ wie or-later", () => {
      expect(classifyExpression("GPL-2.0+", policy).status).toBe("allow");
    });

    it("weist den mehrdeutigen Altbezeichner GPL-2.0 ab", () => {
      expect(classifyExpression("GPL-2.0", policy).status).toBe("deny");
    });
  });

  describe("zusammengesetzte Ausdrücke", () => {
    it("ODER: ein zulässiger Zweig genügt", () => {
      expect(classifyExpression("(MIT OR GPL-2.0-only)", policy).status).toBe(
        "allow",
      );
    });

    it("ODER: kein zulässiger Zweig führt zur Ablehnung", () => {
      expect(
        classifyExpression("(SSPL-1.0 OR GPL-2.0-only)", policy).status,
      ).toBe("deny");
    });

    it("UND: alle Zweige müssen zulässig sein", () => {
      expect(classifyExpression("(MIT AND Apache-2.0)", policy).status).toBe(
        "allow",
      );
      expect(classifyExpression("(MIT AND SSPL-1.0)", policy).status).toBe(
        "deny",
      );
    });

    it("UND mit unbekanntem Zweig ist nicht entscheidbar", () => {
      expect(classifyExpression("(MIT AND Irgendwas-1.0)", policy).status).toBe(
        "unknown",
      );
    });
  });

  // docs/security.md, Kapitel D: Das license-Feld ist eine Selbstauskunft.
  // Genau diese Angaben tauchen in der Praxis auf.
  describe("nicht auswertbare Angaben brechen den Build", () => {
    it.each([
      ["BSD", "veralteter, mehrdeutiger Bezeichner"],
      ["Apache", "ohne Versionsangabe"],
      ["SEE LICENSE IN README.md", "Verweis statt Bezeichner"],
      ["UNKNOWN", "pnpm-Platzhalter"],
      ["", "leer"],
    ])("%s → unknown (%s)", (eingabe) => {
      expect(classifyExpression(eingabe, policy).status).toBe("unknown");
    });

    it("behandelt null und undefined als unknown", () => {
      expect(classifyExpression(null, policy).status).toBe("unknown");
      expect(classifyExpression(undefined, policy).status).toBe("unknown");
    });
  });

  it("bewertet Lizenzausnahmen (WITH) nicht automatisch", () => {
    expect(
      classifyExpression("Apache-2.0 WITH LLVM-exception", policy).status,
    ).toBe("unknown");
  });
});

describe("buildPolicy", () => {
  it("weist eine widersprüchliche Konfiguration ab", () => {
    expect(() => buildPolicy({ allow: ["MIT"], deny: ["MIT"] })).toThrow(
      /widersprüchlich/,
    );
  });

  it("Negativliste schlägt Positivliste bei der Bewertung", () => {
    // buildPolicy wirft bei Überschneidung; classifyIdentifier prüft deny
    // zuerst. Der Test sichert die Reihenfolge über eine Menge ab, die
    // buildPolicy umgeht.
    const manuell = {
      allow: new Set(["Riskant-1.0"]),
      deny: new Set(["Riskant-1.0"]),
    };
    expect(classifyExpression("Riskant-1.0", manuell).status).toBe("deny");
  });
});

describe("buildExceptions", () => {
  const gueltig = {
    spdx: "Python-2.0",
    grund: "Dateikopfzeilen bestätigen die PSF-Lizenz",
    beleg: "node_modules/argparse/LICENSE",
    geprueft_von: "kontakt@inxsystems.de",
    geprueft_am: "2026-08-04",
  };

  it("nimmt vollständige Einträge an", () => {
    const map = buildExceptions({ freigaben: { "argparse@1.0.10": gueltig } });
    expect(map.has("argparse@1.0.10")).toBe(true);
  });

  it("weist Einträge ohne Versionsbindung ab", () => {
    expect(() => buildExceptions({ freigaben: { argparse: gueltig } })).toThrow(
      /name@version/,
    );
  });

  it("weist unvollständige Einträge ab — ohne Beleg ist es keine Prüfung", () => {
    const { beleg: _beleg, ...ohneBeleg } = gueltig;
    expect(() =>
      buildExceptions({ freigaben: { "argparse@1.0.10": ohneBeleg } }),
    ).toThrow(/beleg/);
  });

  it("liefert eine leere Menge, wenn keine Freigaben hinterlegt sind", () => {
    expect(buildExceptions({ freigaben: {} }).size).toBe(0);
    expect(buildExceptions({}).size).toBe(0);
  });
});

describe("auswerten", () => {
  const leereFreigaben = new Map();

  it("meldet Pakete mit unzulässiger Lizenz", () => {
    const { verletzungen } = auswerten(
      {
        MIT: [{ name: "gutes-paket", versions: ["1.0.0"] }],
        "SSPL-1.0": [{ name: "schlechtes-paket", versions: ["2.0.0"] }],
      },
      policy,
      leereFreigaben,
    );

    expect(verletzungen).toHaveLength(1);
    expect(verletzungen[0]?.paket).toBe("schlechtes-paket");
    expect(verletzungen[0]?.status).toBe("deny");
  });

  it("meldet unbekannte Bezeichner als Verletzung, nicht als Warnung", () => {
    const { verletzungen } = auswerten(
      { BSD: [{ name: "altes-paket", versions: ["0.1.0"] }] },
      policy,
      leereFreigaben,
    );

    expect(verletzungen).toHaveLength(1);
    expect(verletzungen[0]?.status).toBe("unknown");
  });

  // Der eigentliche Zweck der Versionsbindung.
  describe("Einzelfreigaben gelten nur für die geprüfte Version", () => {
    const freigaben = new Map([
      [
        "altes-paket@0.1.0",
        { geprueft_von: "jemand", geprueft_am: "2026-08-04" },
      ],
    ]);

    it("gibt die geprüfte Version frei", () => {
      const { verletzungen } = auswerten(
        { BSD: [{ name: "altes-paket", versions: ["0.1.0"] }] },
        policy,
        freigaben,
      );
      expect(verletzungen).toHaveLength(0);
    });

    it("greift nach einem Versionssprung nicht mehr", () => {
      const { verletzungen } = auswerten(
        { BSD: [{ name: "altes-paket", versions: ["0.2.0"] }] },
        policy,
        freigaben,
      );
      expect(verletzungen).toHaveLength(1);
      expect(verletzungen[0]?.version).toBe("0.2.0");
    });

    it("prüft jede installierte Version einzeln", () => {
      const { verletzungen } = auswerten(
        { BSD: [{ name: "altes-paket", versions: ["0.1.0", "0.2.0"] }] },
        policy,
        freigaben,
      );
      expect(verletzungen.map((v) => v.version)).toEqual(["0.2.0"]);
    });
  });
});
