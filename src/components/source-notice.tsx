const REPOSITORY_URL = "https://github.com/INXcode/taktus";

/**
 * Erfuellt Paragraph 13 der AGPL-3.0.
 *
 * Wer ueber ein Netzwerk mit dieser Anwendung interagiert, muss den Quelltext
 * angeboten bekommen. Der Punkt wird haeufig uebersehen, weil er ueber die
 * uebliche Copyleft-Pflicht bei Verbreitung hinausgeht: Hier genuegt schon der
 * Betrieb als Dienst.
 *
 * Praktisch heisst das ein dauerhaft erreichbarer Verweis aus der laufenden
 * Anwendung heraus -- zusammen mit Version und Commit, damit erkennbar ist,
 * welcher Stand tatsaechlich laeuft. Ein Link auf den Hauptzweig allein wuerde
 * das nicht leisten.
 *
 * Die Werte stammen aus `next.config.ts` und werden zur Bauzeit gesetzt.
 *
 * Seit dem Entwurf liegt die Zeile im Layout und nicht mehr auf der
 * Startseite -- sie muss auf **jedem** Bildschirm stehen, auch auf den
 * unangemeldeten. Version und Commit in Mono, weil sie maschinelle Angaben
 * sind und nicht Fliesstext.
 */
export function SourceNotice() {
  const version = process.env["NEXT_PUBLIC_APP_VERSION"] ?? "0.0.0";
  const gitSha = process.env["NEXT_PUBLIC_GIT_SHA"] ?? "dev";

  return (
    <footer className="border-t border-border text-xs text-muted">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-7 py-3.5">
        <span className="font-mono">
          Taktus Kontor {version} ({gitSha})
        </span>
        <span>— freie Software unter</span>
        <a
          href={`${REPOSITORY_URL}/blob/main/LICENSE`}
          className="font-semibold"
          rel="license noreferrer"
          target="_blank"
        >
          AGPL-3.0
        </a>
        <span>.</span>
        <a
          href={REPOSITORY_URL}
          className="font-semibold"
          rel="noreferrer"
          target="_blank"
        >
          Quellcode
        </a>
      </p>
    </footer>
  );
}
