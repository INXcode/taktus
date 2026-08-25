import { expect, test, type Page } from "@playwright/test";
import { KENNWORT, KONTEN } from "./hilfen";

/**
 * Risiko 4: Die Anmeldung verrät, welche Adressen es gibt.
 *
 * > [!important] Zwei verschiedene Meldungen sind ein Kontenverzeichnis.
 * > Antwortet die Maske auf eine unbekannte Adresse anders als auf ein
 * > falsches Passwort, lässt sich mit einer Liste von Adressen in Ruhe
 * > ermitteln, wer in dieser Instanz ein Konto hat. Bei einem Werkzeug, das
 * > nach Mandanten getrennt ist, ist schon diese Liste eine Auskunft: Sie
 * > sagt, wer mit wem arbeitet.
 * >
 * > Der Unterschied entsteht selten mit Absicht. Er entsteht dadurch, dass
 * > jemand eine hilfreiche Meldung ergänzt -- und deshalb ist er einen
 * > eigenen Test wert, der bei der nächsten Verbesserung anschlägt.
 *
 * Geprüft wird auch die **Dauer** nicht: Ein Zeitunterschied verriete
 * dasselbe. Ihn zuverlässig zu messen, ist in einem E2E-Test aber nicht
 * möglich -- das gehört in eine Betrachtung des Auth-Dienstes, nicht hierher.
 * Diese Grenze steht hier, damit niemand den Test für mehr hält, als er ist.
 */
test.describe("Anmeldung", () => {
  async function meldungBei(
    page: Page,
    email: string,
    kennwort: string,
  ): Promise<string> {
    await page.goto("/login");
    await page.getByLabel("E-Mail").fill(email);
    await page.getByLabel("Passwort").fill(kennwort);
    await page.getByRole("button", { name: "Anmelden" }).click();

    /*
     * Auf das Formular eingegrenzt, und das ist nicht Kosmetik.
     *
     * Next hängt eine Routen-Ansage in die Seite: ein `role="alert"` im
     * Shadow DOM eines `<next-route-announcer>`. Playwright durchdringt
     * Shadow-Wurzeln, `document.querySelectorAll` nicht -- ein
     * `getByRole("alert").first()` traf deshalb die leere Ansage statt der
     * Fehlermeldung, und der Test verglich zweimal die leere Zeichenkette
     * miteinander. Er wäre grün geblieben, wenn die Anwendung **gar keine**
     * Meldung mehr angezeigt hätte.
     */
    const hinweis = page.locator("form").getByRole("alert").first();
    await expect(hinweis).toBeVisible();
    return (await hinweis.textContent())?.trim() ?? "";
  }

  test("antwortet auf unbekannte Adresse und falsches Passwort gleich", async ({
    page,
  }) => {
    const beiUnbekannt = await meldungBei(
      page,
      "gibt-es-nicht@handwerk.invalid",
      KENNWORT,
    );
    const beiFalschemKennwort = await meldungBei(
      page,
      KONTEN.handwerkAdmin,
      "Falsches-Kennwort-1",
    );

    expect(beiUnbekannt).toBe(beiFalschemKennwort);
    expect(beiUnbekannt).not.toBe("");
  });

  test("bleibt auf der Anmeldemaske und nennt keine Einzelheiten", async ({
    page,
  }) => {
    const meldung = await meldungBei(
      page,
      KONTEN.handwerkAdmin,
      "Falsches-Kennwort-1",
    );

    await expect(page).toHaveURL(/\/login/);
    // Kein Hinweis auf die Länge, keine englische Meldung aus dem
    // Auth-Dienst, kein Fehlercode.
    expect(meldung).not.toMatch(/12 Zeichen|invalid|credentials|400|password/i);
  });
});
