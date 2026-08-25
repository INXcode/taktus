import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, originOf } from "@/lib/security/csp";

const basis = {
  nonce: "abc123",
  supabaseOrigin: "https://db.beispiel.invalid",
  isDevelopment: false,
};

/** Zerlegt die Richtlinie in Direktive → Werte. */
function directives(policy: string): Record<string, readonly string[]> {
  const map: Record<string, readonly string[]> = {};
  for (const part of policy.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name !== undefined && name !== "") map[name] = values;
  }
  return map;
}

describe("contentSecurityPolicy", () => {
  it("trägt die Nonce in script-src", () => {
    const d = directives(contentSecurityPolicy(basis));
    expect(d["script-src"]).toContain("'nonce-abc123'");
    expect(d["script-src"]).toContain("'strict-dynamic'");
  });

  /*
   * Der App Router streamt seine Nutzlast über eingebettete
   * `<script>self.__next_f.push(…)</script>`. Ohne Nonce bleibt die Seite
   * weiss -- und ein `'unsafe-inline'` statt der Nonce machte die ganze
   * Richtlinie wertlos, weil dann jedes eingeschleuste Skript liefe.
   */
  it("erlaubt Skripten **nie** `unsafe-inline`", () => {
    for (const dev of [true, false]) {
      const d = directives(
        contentSecurityPolicy({ ...basis, isDevelopment: dev }),
      );
      expect(d["script-src"]).not.toContain("'unsafe-inline'");
    }
  });

  /*
   * Der Fall, den kein Test gefunden hat, sondern Safari.
   *
   * `upgrade-insecure-requests` hebt jede unsichere Unteranfrage auf `https`.
   * Die Spezifikation nimmt `localhost` davon aus, Chromium hält sich daran --
   * WebKit nicht. Auf dem Entwicklungsserver scheitern dort Stylesheet,
   * Schriften und jedes Bündel an einem TLS-Fehler, und die Anmeldemaske kommt
   * ungestaltet.
   *
   * Über HTTPS ist die Richtlinie sinnvoll und muss bleiben. Beide Hälften
   * stehen hier, damit niemand die eine ohne die andere ändert.
   */
  it("hebt in der Produktion an, in der Entwicklung nicht", () => {
    expect(contentSecurityPolicy(basis)).toContain("upgrade-insecure-requests");
    expect(
      contentSecurityPolicy({ ...basis, isDevelopment: true }),
    ).not.toContain("upgrade-insecure-requests");
  });

  it("erlaubt `unsafe-eval` nur in der Entwicklung", () => {
    const prod = directives(contentSecurityPolicy(basis));
    const dev = directives(
      contentSecurityPolicy({ ...basis, isDevelopment: true }),
    );
    expect(prod["script-src"]).not.toContain("'unsafe-eval'");
    expect(dev["script-src"]).toContain("'unsafe-eval'");
  });

  /*
   * Stilelemente streng, Stil-Attribute offen. Die zweite Zeile ist keine
   * Aufweichung: Sobald `style-src` eine Nonce trägt, entfällt der
   * stillschweigende Rückfall für Attribute -- und die Anwendung setzt
   * Spaltenvorlagen, die Schraffur und den Pfeil des Auswahlfelds als
   * Attribut.
   */
  it("gibt Stilelementen in der Produktion eine Nonce", () => {
    const d = directives(contentSecurityPolicy(basis));
    expect(d["style-src"]).toContain("'nonce-abc123'");
    expect(d["style-src"]).not.toContain("'unsafe-inline'");
    expect(d["style-src-attr"]).toEqual(["'unsafe-inline'"]);
  });

  it("lässt Stile in der Entwicklung offen -- dort setzt Next sie per Skript", () => {
    const d = directives(
      contentSecurityPolicy({ ...basis, isDevelopment: true }),
    );
    expect(d["style-src"]).toContain("'unsafe-inline'");
  });

  it("nennt genau einen fremden Ursprung, und zwar Supabase", () => {
    const policy = contentSecurityPolicy(basis);
    const d = directives(policy);
    expect(d["connect-src"]).toEqual(["'self'", "https://db.beispiel.invalid"]);

    // Sonst steht in der ganzen Richtlinie keine fremde Adresse.
    const fremde = policy
      .split(/[\s;]+/)
      .filter((token) => token.startsWith("http"));
    expect(fremde).toEqual(["https://db.beispiel.invalid"]);
  });

  it("verbietet Einbetten, Plug-ins und ein fremdes <base>", () => {
    const d = directives(contentSecurityPolicy(basis));
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["frame-src"]).toEqual(["'none'"]);
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'none'"]);
  });

  /*
   * Diese Zusicherung hat einmal für kurze Zeit anders gelautet.
   *
   * `frame-src` und `img-src` standen den Erweiterungsschemata offen, weil ein
   * Passwortmanager nichts mehr ausfüllte und die Richtlinie der naheliegende
   * Grund schien. Sie war es nicht: Erweiterungen bauen ihre Oberfläche aus
   * einer isolierten Welt, die von der Seiten-CSP nicht betroffen ist.
   *
   * Die Zeile hält den engen Zustand fest, damit die Fährte nicht ein zweites
   * Mal aufgenommen wird.
   */
  it("nimmt für Erweiterungen nichts aus", () => {
    const policy = contentSecurityPolicy(basis);
    for (const schema of [
      "safari-web-extension:",
      "chrome-extension:",
      "moz-extension:",
    ]) {
      expect(policy).not.toContain(schema);
    }
    expect(directives(policy)["img-src"]).toEqual(["'self'", "data:"]);
  });

  it("bindet Formulare an die eigene Herkunft", () => {
    const d = directives(contentSecurityPolicy(basis));
    expect(d["form-action"]).toEqual(["'self'"]);
  });

  it("enthält kein Sternchen -- nirgends", () => {
    expect(contentSecurityPolicy(basis)).not.toContain("*");
  });

  it("erzeugt für zwei Nonces zwei Richtlinien", () => {
    const eins = contentSecurityPolicy({ ...basis, nonce: "eins" });
    const zwei = contentSecurityPolicy({ ...basis, nonce: "zwei" });
    expect(eins).not.toBe(zwei);
  });
});

describe("originOf", () => {
  it("schneidet den Pfad ab", () => {
    expect(originOf("https://db.beispiel.invalid/rest/v1/")).toBe(
      "https://db.beispiel.invalid",
    );
  });

  it("behält den Port", () => {
    expect(originOf("http://127.0.0.1:44421")).toBe("http://127.0.0.1:44421");
  });

  it("liefert null statt einer unbrauchbaren Angabe", () => {
    // Lieber kein Eintrag als ein kaputter: Ohne `connect-src`-Eintrag
    // scheitern die Abfragen sichtbar, statt dass etwas Unerwartetes
    // durchrutscht.
    expect(originOf("kein-url")).toBeNull();
    expect(originOf("")).toBeNull();
  });
});
