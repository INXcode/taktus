import { expect, test } from "@playwright/test";
import { KONTEN, anmelden } from "./hilfen";

/**
 * Risiko 1: Die Sitzungsauffrischung läuft nicht, und niemand merkt es.
 *
 * > [!important] Dieser Test existiert wegen eines Fehlers, der **keinen
 * > Fehler wirft**.
 * > In Next.js 16 heisst die Datei `src/proxy.ts` mit `export function
 * > proxy`. Hiesse sie weiterhin `middleware.ts`, oder wäre der Export anders
 * > benannt, würde sie schlicht **nie aufgerufen** -- ohne Warnung beim Bauen,
 * > ohne Zeile im Log. Die Anwendung liefe scheinbar normal, bis die Sitzung
 * > nach Ablauf des Zugriffstokens still ausläuft und Nutzer mitten in der
 * > Arbeit auf der Anmeldemaske stehen.
 * >
 * > Kein Unit-Test kann das sehen: Der Fehler liegt nicht im Code, sondern
 * > darin, ob das Rahmenwerk ihn findet. Nur ein echter Browser gegen einen
 * > echten Server beantwortet die Frage.
 *
 * `docs/architektur.md` fordert genau diesen Test.
 */
test.describe("Sitzung", () => {
  test("überlebt eine Navigation über mehrere Seiten", async ({ page }) => {
    await anmelden(page, KONTEN.handwerkBearbeitung);

    // Vier Wechsel quer durch die Anwendung, teils clientseitig, teils als
    // vollständiger Aufruf -- der Proxy läuft nur beim zweiten.
    await page.goto("/tickets");
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();

    // Aus der Seitenleiste heraus, nicht irgendein Verweis namens „Zeiten":
    // Auf Mobil trägt die untere Leiste denselben Namen, und die steht im
    // Markup auch dann, wenn sie hier nicht sichtbar ist.
    await page
      .getByRole("navigation")
      .first()
      .getByRole("link", { name: "Zeiten", exact: true })
      .click();
    await expect(page).toHaveURL(/\/time$/);

    await page.goto("/account");
    await expect(
      page.getByRole("heading", { name: "Mein Profil" }),
    ).toBeVisible();

    await page.goto("/tickets");
    // Entscheidend: **keine** Weiterleitung auf die Anmeldung.
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole("heading", { name: "Tickets" })).toBeVisible();
  });

  test("führt nach der Anmeldung an den ursprünglich gewünschten Ort", async ({
    page,
  }) => {
    // Der Proxy hängt den gewünschten Pfad an die Weiterleitung. Ohne ihn
    // landete jeder Lesezeichen-Aufruf auf einer Startseite -- ärgerlich, und
    // ein Hinweis darauf, dass der Proxy gar nicht läuft.
    await page.goto("/account/data");
    await expect(page).toHaveURL(/\/login\?weiter=%2Faccount%2Fdata/);

    await page.getByLabel("E-Mail").fill(KONTEN.handwerkBearbeitung);
    await page.getByLabel("Passwort").fill("Entwicklung-2026!");
    await page.getByRole("button", { name: "Anmelden" }).click();

    await expect(page).toHaveURL(/\/account\/data$/);
  });
});
