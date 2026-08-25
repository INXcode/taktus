import { describe, expect, it } from "vitest";
import {
  bestandLesen,
  istGezeichnet,
  istZustimmung,
  signaturErgaenzen,
} from "./cla-signatures.mjs";

/** Ein Bestand, wie ihn die Datei .github/cla-signatures.json enthaelt. */
const roh = {
  cla_version: "1.0",
  allowlist: ["INXcode"],
  signatures: [
    {
      login: "beispielperson",
      user_id: 4711,
      cla_version: "1.0",
      pull_request: 42,
      comment_id: 900001,
      cla_sha256: "a".repeat(64),
      signed_at: "2026-08-20T10:00:00Z",
    },
  ],
};

describe("istZustimmung", () => {
  it("erkennt den deutschen und den englischen Satz", () => {
    expect(istZustimmung("Ich habe den CLA gelesen und stimme ihm zu.")).toBe(
      true,
    );
    expect(istZustimmung("I have read the CLA and I hereby accept it.")).toBe(
      true,
    );
  });

  it("erkennt den Satz auch in einem laengeren Kommentar", () => {
    expect(
      istZustimmung(
        "Danke fuer den Hinweis!\n\nIch habe den CLA gelesen und stimme ihm zu.\n\nGruesse",
      ),
    ).toBe(true);
  });

  it("laesst sich von Formatierung und Aufzaehlungspunkten nicht stoeren", () => {
    expect(
      istZustimmung("**Ich habe den CLA gelesen und stimme ihm zu.**"),
    ).toBe(true);
    expect(
      istZustimmung("- Ich  habe   den CLA gelesen und stimme ihm zu."),
    ).toBe(true);
  });

  // GitHubs "Quote reply" stellt jeder Zeile des zitierten Beitrags ein `>`
  // voran -- und die Anleitung, die dieses Projekt bei fehlender Zustimmung
  // hinterlaesst, fuehrt den Zustimmungssatz als Beispiel auf. Wuerde das
  // Zitatzeichen nur abgestreift, waere eine Rueckfrage mit zitierter
  // Anleitung eine Zustimmung. Genau davor soll der vollstaendige Satz
  // schuetzen.
  describe("zitierter Text ist keine Zustimmung", () => {
    it("wertet eine reine Zitat-Antwort nicht als Zustimmung", () => {
      expect(
        istZustimmung("> Ich habe den CLA gelesen und stimme ihm zu."),
      ).toBe(false);
    });

    it("wertet eine Rueckfrage mit zitierter Anleitung nicht als Zustimmung", () => {
      expect(
        istZustimmung(
          "> **Bitte lies den Text und antworte hier mit genau diesem Satz:**\n" +
            "> \n" +
            "> > Ich habe den CLA gelesen und stimme ihm zu.\n" +
            "\n" +
            "Was bedeutet das genau?",
        ),
      ).toBe(false);
    });

    it("erkennt die Zustimmung, wenn sie neben dem Zitat selbst geschrieben ist", () => {
      expect(
        istZustimmung(
          "> Bitte lies den Text und antworte hier mit genau diesem Satz:\n" +
            "\n" +
            "Ich habe den CLA gelesen und stimme ihm zu.",
        ),
      ).toBe(true);
    });
  });

  // Der Grund fuer den vollstaendigen Satz statt eines Schlagworts: Ein
  // beilaeufiges "agree" ist keine Willenserklaerung.
  it("wertet blosse Zustimmungswoerter nicht als Zustimmung", () => {
    expect(istZustimmung("agree")).toBe(false);
    expect(istZustimmung("Sieht gut aus, ich stimme zu.")).toBe(false);
    expect(istZustimmung("Ich habe den CLA gelesen.")).toBe(false);
  });

  it("behandelt leere und fehlende Eingaben als Ablehnung", () => {
    expect(istZustimmung("")).toBe(false);
    expect(istZustimmung(undefined)).toBe(false);
    expect(istZustimmung(null)).toBe(false);
  });
});

describe("bestandLesen", () => {
  it("liest einen gueltigen Bestand", () => {
    const bestand = bestandLesen(roh);
    expect(bestand.cla_version).toBe("1.0");
    expect(bestand.signatures).toHaveLength(1);
  });

  it("haelt erklaerte und eingebaute Ausnahmen auseinander", () => {
    const bestand = bestandLesen(roh);
    expect(bestand.allowlist).toEqual(["INXcode"]);
    expect(bestand.wirksameAllowlist).toContain("dependabot[bot]");
    expect(bestand.wirksameAllowlist).toContain("INXcode");
  });

  // Der Kern: ein kaputter Bestand darf nicht als leerer Bestand durchgehen.
  // Sonst entwertete ein Tippfehler in der Datei stillschweigend jede bisher
  // erteilte Zustimmung -- und der Nachweis waere weg, ohne dass es auffiele.
  describe("bricht ab, statt grosszuegig zu sein", () => {
    it("bei fehlender Fassungsangabe", () => {
      expect(() => bestandLesen({ signatures: [] })).toThrow(/cla_version/u);
    });

    it("bei fehlender Signaturliste", () => {
      expect(() => bestandLesen({ cla_version: "1.0" })).toThrow(/signatures/u);
    });

    it("bei einer Signatur ohne Konto-ID", () => {
      expect(() =>
        bestandLesen({
          cla_version: "1.0",
          signatures: [
            {
              login: "x",
              cla_version: "1.0",
              signed_at: "2026-08-20T10:00:00Z",
            },
          ],
        }),
      ).toThrow(/user_id/u);
    });

    it("bei einer Signatur ohne Zeitstempel", () => {
      expect(() =>
        bestandLesen({
          cla_version: "1.0",
          signatures: [{ login: "x", user_id: 1, cla_version: "1.0" }],
        }),
      ).toThrow(/signed_at/u);
    });

    it("bei etwas, das kein Objekt ist", () => {
      expect(() => bestandLesen(null)).toThrow();
      expect(() => bestandLesen([])).toThrow();
    });
  });
});

describe("istGezeichnet", () => {
  const bestand = bestandLesen(roh);

  it("erkennt eine vorliegende Zustimmung", () => {
    expect(
      istGezeichnet({ login: "beispielperson", user_id: 4711 }, bestand),
    ).toBe(true);
  });

  it("laesst Konten der Allowlist durch", () => {
    expect(istGezeichnet({ login: "INXcode", user_id: 1 }, bestand)).toBe(true);
    expect(
      istGezeichnet({ login: "dependabot[bot]", user_id: 2 }, bestand),
    ).toBe(true);
    expect(
      istGezeichnet({ login: "DEPENDABOT[BOT]", user_id: 2 }, bestand),
    ).toBe(true);
  });

  it("weist ein unbekanntes Konto ab", () => {
    expect(istGezeichnet({ login: "fremd", user_id: 9999 }, bestand)).toBe(
      false,
    );
  });

  // Der Grund, warum ueber user_id verglichen wird und nicht ueber den Namen:
  // GitHub gibt einen aufgegebenen Anmeldenamen wieder frei. Ein
  // Namensvergleich raeumte dem naechsten Inhaber die Zustimmung des
  // Vorgaengers ein.
  it("erkennt dieselbe Person nach einer Umbenennung", () => {
    expect(istGezeichnet({ login: "neuer-name", user_id: 4711 }, bestand)).toBe(
      true,
    );
  });

  it("erkennt einen fremden Uebernehmer des alten Namens nicht an", () => {
    expect(
      istGezeichnet({ login: "beispielperson", user_id: 5555 }, bestand),
    ).toBe(false);
  });

  // Wird der CLA-Text inhaltlich geaendert, wird die Fassung heraufgesetzt --
  // und dann gilt eine Zustimmung zur alten Fassung nicht mehr.
  it("erkennt eine Zustimmung zu einer aelteren Fassung nicht an", () => {
    const neuereFassung = bestandLesen({ ...roh, cla_version: "2.0" });
    expect(
      istGezeichnet({ login: "beispielperson", user_id: 4711 }, neuereFassung),
    ).toBe(false);
  });
});

describe("signaturErgaenzen", () => {
  const bestand = bestandLesen(roh);
  const neu = {
    login: "zweite-person",
    user_id: 1234,
    cla_version: "1.0",
    pull_request: 43,
    comment_id: 900002,
    cla_sha256: "b".repeat(64),
    signed_at: "2026-08-20T11:00:00Z",
  };

  it("ergaenzt eine neue Zustimmung", () => {
    const { bestand: danach, ergaenzt } = signaturErgaenzen(bestand, neu);
    expect(ergaenzt).toBe(true);
    expect(danach.signatures).toHaveLength(2);
  });

  it("laesst den uebergebenen Bestand unveraendert", () => {
    signaturErgaenzen(bestand, neu);
    expect(bestand.signatures).toHaveLength(1);
  });

  it("verdoppelt eine bereits vorliegende Zustimmung nicht", () => {
    const { bestand: danach, ergaenzt } = signaturErgaenzen(bestand, {
      ...neu,
      login: "beispielperson",
      user_id: 4711,
    });
    expect(ergaenzt).toBe(false);
    expect(danach.signatures).toHaveLength(1);
  });

  it("traegt fuer ein Konto der Allowlist nichts ein", () => {
    const { ergaenzt } = signaturErgaenzen(bestand, {
      ...neu,
      login: "INXcode",
      user_id: 1,
    });
    expect(ergaenzt).toBe(false);
  });
});
