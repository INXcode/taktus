import { defineConfig, devices } from "@playwright/test";

/**
 * Fünf Specs, fünf benannte Risiken.
 *
 * > [!important] Diese Suite prüft nicht die Oberfläche, sondern die vier
 * > Wächterstufen und ihre Nahtstellen.
 * > Was sich in einem Unit-Test prüfen lässt, steht dort -- Vitest deckt 233
 * > Zusicherungen ab, pgTAP 104. Hierher gehört nur, was **erst im
 * > Zusammenspiel** von Browser, Proxy, Server Action und Datenbank sichtbar
 * > wird. Jede weitere Spec müsste dieselbe Frage beantworten: Welches
 * > Risiko wird sonst nirgends gesehen?
 *
 * Die Suite **schreibt nichts.** Sie meldet sich an, navigiert und liest --
 * damit lässt sie sich beliebig oft gegen denselben Seed-Stand laufen, ohne
 * ihn zurückzusetzen. Ein E2E-Lauf, der erst aufräumen muss, wird
 * irgendwann übersprungen.
 */
export default defineConfig({
  testDir: "./e2e",

  // Kein `retries`. Ein Test, der beim zweiten Versuch durchgeht, hat einen
  // Fehler gefunden -- entweder im Test oder in der Anwendung. Ihn zu
  // wiederholen, bis er schweigt, ist die teuerste Art, ihn zu ignorieren.
  retries: 0,
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? "github" : "list",

  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3100",
    trace: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },

  /*
   * Chromium vollständig, WebKit als Stichprobe.
   *
   * Geprüft werden Zugriffsentscheidungen, keine Darstellungsunterschiede --
   * und die fallen in jedem Browser gleich aus, weil sie auf dem Server
   * getroffen werden. Für die fünf Risiken der Suite gilt das unverändert,
   * und deshalb läuft nur ein Browser über sie.
   *
   * > [!important] Eine Ausnahme, und der Grund dafür ist belegt.
   * > `upgrade-insecure-requests` hob in WebKit jede Unteranfrage auf `https`
   * > an, wo lokal kein TLS lauscht. Die Anmeldemaske kam ungestaltet und
   * > ohne Interaktion -- in Chromium war alles in Ordnung, in der
   * > Serverausgabe stand nichts, und keine der damals 239 Unit- und 16
   * > E2E-Zusicherungen hat es gesehen.
   * >
   * > Es gibt also eine Fehlerklasse, die genau hier hindurchfällt: eine
   * > Kopfzeile, die einen Browser aussperrt. Sie braucht keinen zweiten
   * > vollständigen Durchlauf, sondern eine Prüfung -- kommt die Seite an und
   * > wirkt sie.
   *
   * Vollständig doppelt zu fahren wäre der bequeme Reflex und der falsche:
   * Es verdoppelte die Laufzeit, ohne eine zusätzliche Frage zu beantworten.
   * Für den Rest -- den Fokusring, das Auswahlrad auf Mobil -- hilft ohnehin
   * nur ein Mensch mit einem Safari, und der testet weiterhin von Hand.
   */
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-stichprobe",
      use: { ...devices["Desktop Safari"] },
      grep: /@stichprobe/,
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3100/login",
    // Lokal wird ein laufender Server benutzt, in der CI immer ein eigener
    // gestartet. Sonst prüfte die CI gegen einen Stand, den niemand kennt.
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
