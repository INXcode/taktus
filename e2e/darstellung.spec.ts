import { expect, test } from "@playwright/test";

/**
 * Risiko 6: Ein Header schliesst einen Browser aus, und niemand merkt es.
 *
 * > [!important] Diese Spec bricht mit der Regel der übrigen fünf — absichtlich.
 * > Die anderen prüfen Entscheidungen, die auf dem Server fallen und deshalb
 * > in jedem Browser gleich ausgehen. Hier geht es um das Gegenteil: um die
 * > eine Stelle, an der Browser sich messbar unterscheiden.
 *
 * Der Anlass ist kein gedachter. `upgrade-insecure-requests` hob in WebKit
 * jede Unteranfrage auf `https://localhost:3100` an — dort lauscht kein TLS,
 * und Stylesheet, Schriften und sämtliche Bündel scheiterten. Die Anmeldemaske
 * kam ungestaltet und ohne Interaktion. **Weder die 239 Unit-Zusicherungen
 * noch die 16 E2E-Prüfungen haben das gesehen**, weil beide nur Chromium
 * fahren, und in der Serverausgabe stand nichts: Die Anfragen erreichten den
 * Server nie.
 *
 * Deshalb genau eine Prüfung, und eine grobe: Kommt die Seite vollständig an,
 * und wirkt das Stylesheet? Das ist die Frage, die eine falsche Kopfzeile
 * beantwortet, und sie kostet in WebKit zwei Sekunden.
 *
 * `@stichprobe` markiert sie für den zweiten Projekteintrag in
 * `playwright.config.ts`. Die Suite bleibt sonst einbrowsig — vollständig
 * doppelt zu fahren beantwortete keine zusätzliche Frage und verdoppelte die
 * Laufzeit.
 */
test.describe("Darstellung", () => {
  test("die Anmeldemaske lädt vollständig und ist gestaltet @stichprobe", async ({
    page,
  }) => {
    const gescheitert: string[] = [];
    page.on("requestfailed", (request) => {
      gescheitert.push(
        `${request.url()} -- ${request.failure()?.errorText ?? "ohne Angabe"}`,
      );
    });

    await page.goto("/login");

    // Keine einzige Unteranfrage darf scheitern. Ein angehobenes Schema, eine
    // zu enge CSP oder ein fehlender Ursprung fallen genau hier auf.
    expect(gescheitert).toEqual([]);

    /*
     * Und das Stylesheet muss auch wirken, nicht nur ankommen.
     *
     * Geprüft wird der Anmelden-Knopf: Ohne Gestaltung trägt er die Vorgabe
     * des Browsers -- grau und ohne Radius. Bewusst keine Farbe aus dem
     * Entwurf festgeschrieben, sonst wäre das hier ein Gestaltungstest, der
     * bei jeder Tokenänderung anschlägt. Gefragt ist nur: Greift überhaupt
     * eine eigene Regel?
     */
    const knopf = page.getByRole("button", { name: "Anmelden" });
    await expect(knopf).toBeVisible();

    const radius = await knopf.evaluate(
      (element) => getComputedStyle(element).borderRadius,
    );
    expect(radius).not.toBe("0px");
  });
});
