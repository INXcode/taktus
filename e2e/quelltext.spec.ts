import { expect, test } from "@playwright/test";
import { KONTEN, anmelden } from "./hilfen";

/**
 * Risiko 5: Der Quelltexthinweis fehlt dort, wo er verlangt ist.
 *
 * > [!important] Paragraph 13 der AGPL-3.0 ist eine Lizenzpflicht, keine
 * > Höflichkeit.
 * > Wer über ein Netzwerk mit der Anwendung arbeitet, muss den Quelltext
 * > angeboten bekommen -- **auch unangemeldet.** Genau das ist die Stelle, an
 * > der ein Hinweis gern verlorengeht: Die Anmeldemaske hat ein eigenes
 * > Layout, und wer den Hinweis in die App-Shell legt, hat ihn für den
 * > gesamten unangemeldeten Bereich vergessen.
 * >
 * > Der Fehler ist unsichtbar. Die Anwendung funktioniert, niemand vermisst
 * > etwas -- und die Lizenz ist verletzt.
 *
 * Geprüft wird zusätzlich die **Versionsangabe**: Ohne sie liesse sich nicht
 * feststellen, welcher Stand läuft, und das Angebot des Quelltexts liefe ins
 * Leere. `NEXT_PUBLIC_GIT_SHA` wird bislang nur vom CI-Build gesetzt; lokal
 * steht dort „dev". Der Test prüft deshalb, dass **etwas** dasteht.
 */
test.describe("Quelltexthinweis nach Paragraph 13", () => {
  for (const pfad of ["/login", "/forgot-password", "/reset-password"]) {
    test(`steht auf ${pfad} -- ohne Anmeldung`, async ({ page }) => {
      await page.goto(pfad);

      const hinweis = page.getByRole("contentinfo");
      await expect(hinweis).toBeVisible();

      const verweis = hinweis.getByRole("link", { name: "Quellcode" });
      await expect(verweis).toBeVisible();
      await expect(verweis).toHaveAttribute("href", /^https?:\/\/./);

      // Lizenz und Fassung stehen daneben. „0.1.0 (dev)" lokal, in der CI der
      // Commit -- geprüft wird, dass die Angabe nicht leer ist.
      await expect(hinweis.getByText("AGPL-3.0")).toBeVisible();
      await expect(hinweis).toContainText(/\d+\.\d+\.\d+/);
    });
  }

  test("steht auch auf jedem angemeldeten Bildschirm", async ({ page }) => {
    await anmelden(page, KONTEN.handwerkAdmin);

    for (const pfad of ["/tickets", "/admin/tenant", "/account"]) {
      await page.goto(pfad);
      const hinweis = page.getByRole("contentinfo");
      await expect(
        hinweis.getByRole("link", { name: "Quellcode" }),
      ).toBeVisible();
    }
  });
});
