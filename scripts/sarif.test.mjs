import { describe, expect, it } from "vitest";
import {
  BEGRUENDETE_AUSNAHMEN,
  befunde,
  istUnterdrueckt,
  ohneUnterdrueckte,
  teileNachAusnahmen,
} from "./sarif.mjs";

/**
 * Nachgebaut nach der SARIF, die Semgrep 1.172.0 am 24.08.2026 fuer
 * `src/actions/auth.ts` geschrieben hat: vier Befunde, alle mit
 * `nosemgrep`-Zeile im Quelltext, alle trotzdem in der Datei.
 */
function sarifMitUnterdrueckten() {
  return {
    version: "2.1.0",
    runs: [
      {
        tool: { driver: { name: "Semgrep" } },
        results: [
          {
            ruleId: "taktus-server-action-ohne-rollenpruefung",
            level: "warning",
            message: { text: "Exportierte Server Action ohne requireRole()." },
            suppressions: [{ kind: "inSource" }],
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: "src/actions/auth.ts" },
                  region: { startLine: 34 },
                },
              },
            ],
          },
          {
            ruleId: "taktus-personenbezug-im-log",
            level: "error",
            message: { text: "Moeglicher Personenbezug in einer Ausgabe." },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: "src/lib/beispiel.ts" },
                  region: { startLine: 12 },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("istUnterdrueckt", () => {
  it("erkennt eine Unterdrueckung aus dem Quelltext", () => {
    expect(istUnterdrueckt({ suppressions: [{ kind: "inSource" }] })).toBe(
      true,
    );
  });

  // SARIF kennt beide Formen. Welcher Weg zur Unterdrueckung gefuehrt hat,
  // aendert nichts daran, dass sie vorliegt.
  it("erkennt auch eine externe Unterdrueckung", () => {
    expect(istUnterdrueckt({ suppressions: [{ kind: "external" }] })).toBe(
      true,
    );
  });

  it("haelt einen Befund ohne das Feld fuer offen", () => {
    expect(istUnterdrueckt({ ruleId: "irgendwas" })).toBe(false);
  });

  // Der gefaehrliche Fall: Ein leeres Feld ist keine Unterdrueckung. Wuerde es
  // als eine gelten, verschwaende ein echter Befund still aus dem Bericht.
  it("haelt ein leeres suppressions-Feld nicht fuer eine Unterdrueckung", () => {
    expect(istUnterdrueckt({ suppressions: [] })).toBe(false);
  });
});

describe("ohneUnterdrueckte", () => {
  it("entfernt den unterdrueckten Befund und behaelt den offenen", () => {
    const { sarif, entfernt } = ohneUnterdrueckte(sarifMitUnterdrueckten());

    expect(entfernt).toBe(1);
    expect(sarif.runs[0].results).toHaveLength(1);
    expect(sarif.runs[0].results[0].ruleId).toBe("taktus-personenbezug-im-log");
  });

  it("laesst den Rest des Dokuments unangetastet", () => {
    const { sarif } = ohneUnterdrueckte(sarifMitUnterdrueckten());

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].tool.driver.name).toBe("Semgrep");
  });

  it("kommt mit einer SARIF ohne Befunde zurecht", () => {
    const { sarif, entfernt } = ohneUnterdrueckte({
      version: "2.1.0",
      runs: [{ tool: { driver: { name: "CodeQL" } }, results: [] }],
    });

    expect(entfernt).toBe(0);
    expect(sarif.runs[0].results).toHaveLength(0);
  });

  // CodeQL schreibt mehrere Laeufe in eine Datei, wenn mehrere Sprachen
  // analysiert wurden.
  it("arbeitet ueber mehrere Laeufe hinweg", () => {
    const { entfernt } = ohneUnterdrueckte({
      runs: [
        { results: [{ suppressions: [{ kind: "inSource" }] }] },
        {
          results: [{ suppressions: [{ kind: "inSource" }] }, { ruleId: "x" }],
        },
      ],
    });

    expect(entfernt).toBe(2);
  });
});

describe("befunde", () => {
  it("listet nur die nicht unterdrueckten auf", () => {
    const liste = befunde(sarifMitUnterdrueckten());

    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({
      regel: "taktus-personenbezug-im-log",
      stufe: "error",
      datei: "src/lib/beispiel.ts",
      zeile: 12,
    });
  });

  // Ein Befund ohne Ortsangabe darf nicht dazu fuehren, dass die Auswertung
  // abbricht -- sonst entscheidet ein fehlendes Feld ueber die Jobfarbe.
  it("stolpert nicht ueber einen Befund ohne Ort", () => {
    const liste = befunde({ runs: [{ results: [{ ruleId: "js/beispiel" }] }] });

    expect(liste).toHaveLength(1);
    expect(liste[0].datei).toBe("(ohne Datei)");
    expect(liste[0].zeile).toBe(0);
  });

  // Die Meldung geht als Annotation ins Protokoll. Ein Zeilenumbruch darin
  // zerrisse den `::error`-Befehl.
  it("kuerzt eine mehrzeilige Meldung auf die erste Zeile", () => {
    const liste = befunde({
      runs: [{ results: [{ message: { text: "Erste Zeile\nZweite Zeile" } }] }],
    });

    expect(liste[0].text).toBe("Erste Zeile");
  });
});

describe("teileNachAusnahmen", () => {
  const AUSNAHME = [
    { regel: "js/beispiel", datei: "src/a.ts", anzahl: 2, grund: "geprueft" },
  ];
  const treffer = (n) =>
    Array.from({ length: n }, () => ({
      regel: "js/beispiel",
      datei: "src/a.ts",
    }));

  it("nimmt die begruendeten Befunde aus der offenen Liste", () => {
    const { offen, begruendet, probleme } = teileNachAusnahmen(
      [...treffer(2), { regel: "js/anderes", datei: "src/b.ts" }],
      AUSNAHME,
    );

    expect(begruendet).toBe(2);
    expect(probleme).toHaveLength(0);
    expect(offen).toHaveLength(1);
    expect(offen[0].regel).toBe("js/anderes");
  });

  // Der wichtigere der beiden Faelle: Eine Ausnahme ohne Treffer prueft nichts
  // mehr und meldet trotzdem gruen -- dieselbe Falle, gegen die INTERNE_PFADE
  // in public-export-policy.mjs abgesichert ist.
  it("meldet eine Ausnahme, die ins Leere zeigt", () => {
    const { probleme } = teileNachAusnahmen([], AUSNAHME);

    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain("keinen Treffer mehr");
  });

  // Ohne die Anzahl deckte die Ausnahme jeden kuenftigen Befund derselben
  // Regel in derselben Datei stillschweigend mit zu.
  it("meldet einen Befund mehr als erwartet", () => {
    const { probleme } = teileNachAusnahmen(treffer(3), AUSNAHME);

    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain("erwartet 2");
  });

  it("meldet einen Befund weniger als erwartet", () => {
    const { probleme } = teileNachAusnahmen(treffer(1), AUSNAHME);

    expect(probleme).toHaveLength(1);
    expect(probleme[0]).toContain("gefunden wurden 1");
  });

  // Regel UND Datei muessen passen. Sonst deckte eine Ausnahme denselben
  // Befund an einer ganz anderen Stelle mit ab.
  it("greift nicht bei gleicher Regel in einer anderen Datei", () => {
    const { offen } = teileNachAusnahmen(
      [{ regel: "js/beispiel", datei: "src/woanders.ts" }],
      AUSNAHME,
    );

    expect(offen).toHaveLength(1);
  });
});

describe("BEGRUENDETE_AUSNAHMEN", () => {
  // Eine Ausnahme ohne Begruendung ist eine Unterdrueckung, und die gehoert
  // hier ausdruecklich nicht her.
  it("traegt zu jedem Eintrag eine Begruendung und eine Anzahl", () => {
    for (const a of BEGRUENDETE_AUSNAHMEN) {
      expect(a.regel).toBeTruthy();
      expect(a.datei).toBeTruthy();
      expect(a.anzahl).toBeGreaterThan(0);
      expect(a.grund.length).toBeGreaterThan(40);
    }
  });
});
