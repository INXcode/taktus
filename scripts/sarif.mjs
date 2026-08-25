/**
 * Umgang mit SARIF-Dateien aus der statischen Analyse.
 *
 * Zwei Aufgaben, ein Modul, weil beide dasselbe Format lesen:
 *
 *   1. `ohneUnterdrueckte` -- entfernt Befunde, die das Werkzeug selbst
 *      bereits als unterdrueckt markiert hat
 *   2. `befunde` -- listet auf, was uebrig bleibt, fuer eine Auswertung ohne
 *      Code Scanning
 *
 * ---------------------------------------------------------------------------
 * Warum es Nummer 1 gibt
 *
 * Semgrep beachtet `nosemgrep`-Kommentare beim Zaehlen: Ein unterdrueckter
 * Befund macht den Lauf nicht rot. In die SARIF schreibt Semgrep ihn trotzdem,
 * mit `suppressions: [{ kind: "inSource" }]`.
 *
 * GitHub Code Scanning wertet dieses Feld nicht als Erledigung und legt einen
 * offenen Alert an. Am 24.08.2026 standen so vier Alerts fuer
 * `taktus-server-action-ohne-rollenpruefung` im oeffentlichen Repository --
 * fuer die vier Anmelde-Actions in `src/actions/auth.ts`, die
 * begruendungsgemaess keine Rolle pruefen koennen und ihre `nosemgrep`-Zeile
 * samt Begruendung tragen.
 *
 * Ohne diesen Filter erzeugt **jede** kuenftige begruendete Ausnahme einen
 * neuen Fehlalarm. Und ein Tor, an dem Fehlalarme normal sind, bringt dem
 * naechsten Lauf bei, rote Meldungen zu uebersehen -- dasselbe Argument, das
 * `check-public-export.mjs` gegen den Dauer-Fehlalarm in der oeffentlichen
 * Linie fuehrt.
 * ---------------------------------------------------------------------------
 */

/**
 * @typedef {{ ruleId?: string, suppressions?: unknown[], level?: string,
 *             message?: { text?: string },
 *             locations?: Array<{ physicalLocation?: {
 *               artifactLocation?: { uri?: string },
 *               region?: { startLine?: number } } }> }} SarifErgebnis
 */

/**
 * Ist dieser Befund vom Werkzeug selbst als unterdrueckt gekennzeichnet?
 *
 * Geprueft wird auf ein nicht-leeres `suppressions`-Feld, nicht auf einen
 * bestimmten `kind`. SARIF kennt `inSource` und `external`; welcher Weg zur
 * Unterdrueckung gefuehrt hat, aendert nichts daran, dass sie vorliegt.
 *
 * @param {SarifErgebnis} ergebnis
 */
export function istUnterdrueckt(ergebnis) {
  return (
    Array.isArray(ergebnis?.suppressions) && ergebnis.suppressions.length > 0
  );
}

/**
 * Entfernt unterdrueckte Befunde aus allen Laeufen der SARIF.
 *
 * Gibt das bereinigte Dokument **und** die Anzahl der entfernten Befunde
 * zurueck. Die Anzahl ist kein Beiwerk: Ein Filter, der stillschweigend
 * arbeitet, ist von einem kaputten Filter nicht zu unterscheiden.
 *
 * @param {{ runs?: Array<{ results?: SarifErgebnis[] }> }} sarif
 */
export function ohneUnterdrueckte(sarif) {
  let entfernt = 0;

  const runs = (sarif?.runs ?? []).map((lauf) => {
    if (!Array.isArray(lauf?.results)) return lauf;

    const behalten = lauf.results.filter((e) => !istUnterdrueckt(e));
    entfernt += lauf.results.length - behalten.length;

    return { ...lauf, results: behalten };
  });

  return { sarif: { ...sarif, runs }, entfernt };
}

/**
 * Befunde, die nach Durchsicht als Fehlalarm gelten.
 *
 * ---------------------------------------------------------------------------
 * Warum das hier steht und nicht als `// codeql[...]` im Quelltext
 *
 * Der naheliegende Weg waere ein Unterdrueckungskommentar an der Fundstelle.
 * Am 25.08.2026 gegen die eigene CI geprueft: Er wirkt nicht zuverlaessig.
 * Auf der gemeldeten Zeile schiebt Prettier ihn hinter die Klammer in die
 * naechste, und auch mit `prettier-ignore` an Ort und Stelle blieben die drei
 * Befunde in `auth/callback/route.ts` stehen.
 *
 * Eine Liste hat ohnehin die besseren Eigenschaften: Sie ist versioniert, sie
 * verlangt eine Begruendung, sie steht an EINER Stelle statt verstreut -- und
 * sie laesst sich pruefen. Genau das tut `pruefeAusnahmen` unten.
 *
 * ---------------------------------------------------------------------------
 * `anzahl` ist Absicht
 *
 * Eine Ausnahme aus Regel und Datei allein deckte auch jeden KUENFTIGEN
 * Befund derselben Regel in derselben Datei zu -- die Ausnahme wuechse
 * stillschweigend mit. Mit der Anzahl faellt beides auf: ein Befund mehr,
 * und ein Befund weniger.
 *
 * Weniger ist der wichtigere Fall. Er heisst, dass die Ausnahme ins Leere
 * zeigt, und eine Aufzaehlung ohne Treffer prueft nichts mehr und meldet
 * trotzdem gruen -- dieselbe Falle, gegen die `INTERNE_PFADE` in
 * `public-export-policy.mjs` abgesichert ist.
 *
 * Keine Zeilennummern: Die verschieben sich bei jeder Einrueckung und machten
 * die Liste zu einer Wartungsaufgabe ohne Gegenwert.
 * ---------------------------------------------------------------------------
 */
export const BEGRUENDETE_AUSNAHMEN = Object.freeze([
  {
    regel: "js/user-controlled-bypass",
    datei: "src/app/auth/callback/route.ts",
    anzahl: 3,
    grund:
      "Die beiden Verzweigungen entscheiden, WELCHER Rueckkehrweg aus dem " +
      "Mail-Link vorliegt, nicht OB jemand darf. Geprueft wird eine Zeile " +
      "spaeter vom Auth-Server: exchangeCodeForSession und verifyOtp lehnen " +
      "einen erfundenen Wert ab, und beide Fehlerpfade landen auf " +
      "?link=ungueltig -- ein erfundener Code kommt also nicht weiter als " +
      "ein fehlender. Ausfuehrlich im Kopf der Datei.",
  },
]);

/** Faellt dieser Befund unter eine begruendete Ausnahme? */
function passtAufAusnahme(befund, ausnahme) {
  return befund.regel === ausnahme.regel && befund.datei === ausnahme.datei;
}

/**
 * Teilt die Befunde in offene und begruendete -- und prueft dabei die Liste.
 *
 * Gibt `probleme` zurueck: Abweichungen zwischen erwarteter und tatsaechlicher
 * Anzahl. Sie wiegen so schwer wie ein offener Befund, denn eine Ausnahme, die
 * nicht mehr stimmt, ist entweder ein uebersehener neuer Befund oder eine
 * Zusicherung ohne Gegenstand.
 *
 * @param {ReturnType<typeof befunde>} liste
 * @param {typeof BEGRUENDETE_AUSNAHMEN} ausnahmen
 */
export function teileNachAusnahmen(liste, ausnahmen = BEGRUENDETE_AUSNAHMEN) {
  const offen = liste.filter(
    (b) => !ausnahmen.some((a) => passtAufAusnahme(b, a)),
  );

  const probleme = [];

  for (const a of ausnahmen) {
    const treffer = liste.filter((b) => passtAufAusnahme(b, a)).length;

    if (treffer === a.anzahl) continue;

    probleme.push(
      treffer === 0
        ? `Die Ausnahme fuer \`${a.regel}\` in ${a.datei} hat keinen Treffer mehr.\n` +
            "  Entweder ist der Befund behoben -- dann gehoert die Ausnahme geloescht --\n" +
            "  oder sie zeigt seit einer Weile ins Leere und prueft nichts."
        : `Die Ausnahme fuer \`${a.regel}\` in ${a.datei} erwartet ${a.anzahl} Befund(e),\n` +
            `  gefunden wurden ${treffer}. Bei mehr steckt ein NEUER Befund darunter, den\n` +
            "  niemand angesehen hat; bei weniger ist die Zahl veraltet. Beides gehoert\n" +
            "  geprueft, nicht angepasst.",
    );
  }

  return { offen, begruendet: liste.length - offen.length, probleme };
}

/**
 * Zaehlt die Befunde aller Laeufe -- unterdrueckte ausgenommen.
 *
 * @param {{ runs?: Array<{ results?: SarifErgebnis[] }> }} sarif
 */
export function befunde(sarif) {
  return (sarif?.runs ?? [])
    .flatMap((lauf) => lauf?.results ?? [])
    .filter((e) => !istUnterdrueckt(e))
    .map((e) => {
      const ort = e?.locations?.[0]?.physicalLocation;
      return {
        regel: e?.ruleId ?? "(ohne Regel)",
        stufe: e?.level ?? "warning",
        datei: ort?.artifactLocation?.uri ?? "(ohne Datei)",
        zeile: ort?.region?.startLine ?? 0,
        text: (e?.message?.text ?? "").split("\n")[0],
      };
    });
}
