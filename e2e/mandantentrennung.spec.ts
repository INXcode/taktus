import { expect, test } from "@playwright/test";
import { KONTEN, anmelden } from "./hilfen";

/**
 * Risiko 3: Die Mandantentrennung hält in der Datenbank, aber nicht im Weg
 * dorthin.
 *
 * > [!important] Ticketnummern sind **mandantenlokal**.
 * > Beide Mandanten im Seed haben ein Ticket `#1`, und die Titel sind
 * > verschieden. Genau das macht die Prüfung scharf: `/tickets/1` muss für
 * > jeden von beiden etwas anderes zeigen, und niemals das des anderen.
 * > Ohne fremde Zeilen hätten die pgTAP-Tests nichts, wogegen sie prüfen
 * > könnten -- und dieser Test hätte es auch nicht.
 *
 * pgTAP prüft die Policies. Was pgTAP **nicht** sieht: ob die Anwendung
 * überhaupt unter der richtigen Sitzung abfragt. Ein Aufruf über den
 * Admin-Client sähe in jedem Policy-Test gut aus und lieferte hier den
 * falschen Mandanten.
 */
test.describe("Mandantentrennung", () => {
  test("dieselbe Nummer zeigt in jedem Mandanten den eigenen Vorgang", async ({
    page,
  }) => {
    await anmelden(page, KONTEN.handwerkBearbeitung);
    await page.goto("/tickets/1");
    await expect(
      page.getByRole("heading", { name: /Etikettendrucker/ }),
    ).toBeVisible();
    // Nirgends auf der Seite steht der Vorgang des anderen Mandanten.
    await expect(page.getByText(/Auswertung weicht/)).toHaveCount(0);
  });

  test("eine Nummer, die es nur im anderen Mandanten gibt, ist nicht erreichbar", async ({
    page,
  }) => {
    // Der Mandant „Beispiel Steuerkanzlei" hat genau ein Ticket. Die Nummer 3
    // gibt es nur bei „Muster Handwerk GmbH".
    await anmelden(page, KONTEN.kanzleiBearbeitung);

    const antwort = await page.goto("/tickets/3");
    expect(antwort?.status()).toBe(404);

    /*
     * Nicht gefunden, nicht „kein Zugriff".
     *
     * Die Unterscheidung wäre selbst eine Auskunft: „Kein Zugriff" verriete,
     * dass es die Nummer gibt. Die Datenbank liefert für beide Fälle stumm
     * null Zeilen, und die Oberfläche gibt genau so viel weiter, wie sie
     * weiss.
     */
    await expect(
      page.getByRole("heading", { name: "Diese Seite gibt es nicht." }),
    ).toBeVisible();

    // Und der Quelltexthinweis steht auch hier -- Paragraph 13 kennt keine
    // Ausnahme für Fehlerseiten.
    await expect(page.getByRole("link", { name: "Quellcode" })).toBeVisible();
  });

  test("die Liste zeigt ausschliesslich Vorgänge des eigenen Mandanten", async ({
    page,
  }) => {
    await anmelden(page, KONTEN.kanzleiBearbeitung);
    await page.goto("/tickets");

    // `.first()`, weil die Liste zweimal im Markup steht: als Tabelle für
    // breite und als Karten für schmale Bildschirme, die jeweils andere per
    // CSS verborgen. Für die Frage „steht der eigene Vorgang da" genügt einer
    // von beiden -- für die Gegenprobe darunter zählt dagegen **jedes**
    // Vorkommen, und genau deshalb steht dort `toHaveCount(0)`.
    await expect(page.getByText(/Auswertung weicht/).first()).toBeVisible();
    await expect(page.getByText(/Etikettendrucker/)).toHaveCount(0);
    await expect(page.getByText(/Hebebuehne|Ersatzteilkatalog/)).toHaveCount(0);
  });

  test("die Auskunft über ein fremdes Profil bleibt verschlossen", async ({
    page,
  }) => {
    await anmelden(page, KONTEN.handwerkAdmin);

    // Die Kennung gehört zur Verwaltung des anderen Mandanten. Sie steht im
    // Seed und ist damit ein realistischer Fall: Wer sie kennt, ist nicht
    // aufgehalten, wenn nur die Oberfläche prüft.
    const antwort = await page.goto(
      "/admin/members/22222222-0000-4000-8000-000000000001/data/download",
    );
    expect(antwort?.status()).toBe(403);
  });
});
