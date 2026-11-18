import { expect, test } from "@playwright/test";

/**
 * Der Bildoptimierer von Next ist nicht erreichbar.
 *
 * Taktus nutzt ihn nicht, Next lässt den Endpunkt `/_next/image` aber
 * trotzdem offen -- ohne Anmeldung. `images: { unoptimized: true }` in
 * `next.config.ts` schaltet ihn ab. Der Test sichert zwei Fehler ab, die
 * beide nichts kaputtmachen und deshalb niemandem auffielen:
 *
 * - Der Schalter verschwindet, etwa bei einem Umbau der Konfiguration. Dann
 *   ist der Endpunkt still wieder offen.
 * - Die Sperre trifft zu viel. Die Symbole, die Next aus `src/app/` verlinkt,
 *   müssen weiter ausgeliefert werden.
 */
test.describe("Bildoptimierer", () => {
  for (const pfad of [
    "/_next/image?url=%2Fapple-icon.png&w=64&q=75",
    "/_next/image?url=%2Ficon.svg&w=64&q=75",
    "/_next/image",
  ]) {
    test(`antwortet auf ${pfad} mit 404`, async ({ request }) => {
      const antwort = await request.get(pfad, { maxRedirects: 0 });
      expect(antwort.status()).toBe(404);
    });
  }

  for (const pfad of ["/apple-icon.png", "/icon.svg"]) {
    test(`liefert ${pfad} weiterhin aus`, async ({ request }) => {
      const antwort = await request.get(pfad, { maxRedirects: 0 });
      expect(antwort.status()).toBe(200);
    });
  }
});
