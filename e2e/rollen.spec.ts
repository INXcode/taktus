import { expect, test } from "@playwright/test";
import { KONTEN, anmelden } from "./hilfen";

/**
 * Risiko 2: Die Rollenprüfung greift nur dort, wo die Oberfläche sie zeigt.
 *
 * > [!important] Das ist die Stufe, die RLS **nicht** belegen kann.
 * > Ein Melder hat auf `time_entries` keine einzige Policy -- die Datenbank
 * > gäbe ihm also ohnehin nichts. Genau deshalb ist der Fall gefährlich: Eine
 * > Seite ohne `requireRole()` sähe für ihn aus wie eine leere Zeitübersicht,
 * > nicht wie eine gesperrte. Er erführe die Struktur der Anwendung, die
 * > Spaltennamen und die Zahl der Mitarbeitenden aus dem Auswahlfeld -- und
 * > ein Prüfer sähe eine Anwendung, die Rollen nur über Sichtbarkeit trennt.
 * >
 * > Der Unterschied zwischen „leer" und „nicht zuständig" lässt sich nur von
 * > aussen prüfen. Deshalb steht dieser Test hier und nicht in pgTAP.
 *
 * Geprüft wird der **direkte Aufruf**, nicht der Klick: Der Navigationspunkt
 * fehlt für den Melder ohnehin -- das prüft `lib/navigation.test.ts`. Hier
 * geht es um den, der die Adresse kennt.
 */
test.describe("Rollen", () => {
  test("Melder erreicht die Zeiten nicht -- auch nicht über die Adresse", async ({
    page,
  }) => {
    await anmelden(page, KONTEN.handwerkMeldung);

    for (const pfad of ["/time", "/time/tenant", "/time/customers"]) {
      await page.goto(pfad);
      await expect(page).toHaveURL(/\/no-access/);
    }
  });

  test("Melder erreicht die Verwaltung nicht", async ({ page }) => {
    await anmelden(page, KONTEN.handwerkMeldung);

    for (const pfad of [
      "/admin/customers",
      "/admin/members",
      "/admin/tenant",
      "/admin/audit",
    ]) {
      await page.goto(pfad);
      await expect(page).toHaveURL(/\/no-access/);
    }
  });

  test("Bearbeiter erreicht die Verwaltung nicht, die Zeiten aber schon", async ({
    page,
  }) => {
    await anmelden(page, KONTEN.handwerkBearbeitung);

    await page.goto("/admin/members");
    await expect(page).toHaveURL(/\/no-access/);

    // Den Kundenstamm pflegt die Verwaltung. Der Bearbeiter LIEST Kunden --
    // er braucht sie für die Auswahl am Ticket und für den Filter -- aber der
    // Bildschirm dahinter gehört ihm nicht.
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/no-access/);

    // Die Gegenprobe gehört dazu: Ein Wächter, der alles abweist, bestünde
    // die obere Hälfte dieses Tests ebenfalls.
    await page.goto("/time/tenant");
    await expect(page).toHaveURL(/\/time\/tenant$/);
  });

  test("der Melder sieht in seiner Navigation keinen gesperrten Punkt", async ({
    page,
  }) => {
    await anmelden(page, KONTEN.handwerkMeldung);
    await page.goto("/tickets");

    const navigation = page.getByRole("navigation").first();
    // Nicht vorhanden, nicht deaktiviert -- so verlangt es der Entwurf. Ein
    // ausgegrauter Punkt verriete, dass es den Bereich gibt.
    await expect(navigation.getByText("Zeiten")).toHaveCount(0);
    await expect(navigation.getByText("Protokoll")).toHaveCount(0);
    await expect(navigation.getByText("Nutzer")).toHaveCount(0);
    await expect(navigation.getByText("Kunden")).toHaveCount(0);
  });
});
