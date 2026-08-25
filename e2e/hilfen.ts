import { expect, type Page } from "@playwright/test";

/**
 * Die Konten aus `supabase/seed.sql`.
 *
 * Alle Adressen liegen unter `.invalid` -- die Kennung ist nach RFC 2606
 * dauerhaft für genau diesen Zweck reserviert und kann nie jemandem gehören.
 * Ein Testdatensatz mit `@example.com` wäre ein Datensatz mit einer fremden
 * Domain darin.
 *
 * Zwei Mandanten, und das ist der Punkt: Ohne fremde Zeilen hätte die
 * Mandantentrennung nichts, wogegen sie geprüft werden könnte.
 */
export const KONTEN = {
  handwerkAdmin: "admin@handwerk.invalid",
  handwerkBearbeitung: "bearbeitung@handwerk.invalid",
  handwerkMeldung: "meldung@handwerk.invalid",
  kanzleiBearbeitung: "bearbeitung@kanzlei.invalid",
} as const;

/** Steht so in `supabase/seed.sql`; erfüllt die Richtlinie aus der config.toml. */
export const KENNWORT = "Entwicklung-2026!";

/**
 * Meldet an und wartet, bis die Zielseite steht.
 *
 * Bewusst über die echte Maske statt über ein vorbereitetes Cookie: Die
 * Anmeldung ist der Weg, auf dem die Sitzung entsteht, und mehrere dieser
 * Tests prüfen genau das Entstehen und Überleben dieser Sitzung. Ein
 * untergeschobenes Cookie wäre eine Abkürzung an der Frage vorbei.
 */
export async function anmelden(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(KENNWORT);
  await page.getByRole("button", { name: "Anmelden" }).click();

  // Die Anmeldung leitet je nach Rolle woandershin -- gemeinsam ist nur, dass
  // die Anmeldemaske verschwindet.
  await expect(page).not.toHaveURL(/\/login/);
}
