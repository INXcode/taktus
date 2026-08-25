/**
 * Reine Logik der Trennung zwischen oeffentlichem und internem Teil.
 *
 * Getrennt vom Skript, das Dateien liest -- nach dem Vorbild von
 * license-policy.mjs. Die Tests liegen in public-export-policy.test.mjs.
 *
 * Ein Repository kann oeffentlich sein, ohne vollstaendig zu sein. Einige
 * Dokumente sind geschaeftlich oder beschreiben genau einen
 * Entwicklungsrechner; sie bleiben zurueck.
 *
 * Der teurere Fehler ist nicht die vergessene Datei. Es ist der VERWEIS: Eine
 * oeffentliche Datei, die auf ein internes Dokument zeigt, verraet dessen
 * Existenz und Kapitelstruktur, auch wenn das Dokument selbst nie mitgeht.
 * Deshalb prueft dieses Modul beides.
 *
 * ---------------------------------------------------------------------------
 * Mechanik hier, Namen woanders
 *
 * Diese Datei enthaelt keine konkreten Namen, und das ist der Punkt.
 *
 * Eine Sperrliste, die Namen fernhalten soll, fuehrt sie im Klartext -- und
 * steht damit selbst im oeffentlichen Repository. Ein Ausschluss ist aber
 * keine Entwarnung: Aus „dieser Name darf hier nicht stehen" folgt, dass es
 * eine Verbindung zu ihm gibt. Bei einem fremden Kunden ist genau dieser
 * Rueckschluss der Schaden.
 *
 * Die konkreten Namen stehen deshalb in einer Ergaenzungsdatei, die nie
 * mitgeht. Fehlt sie, arbeitet dieses Modul mit den allgemeinen Mustern
 * weiter -- was genuegt, denn das Tor steht ohnehin VOR der
 * Veroeffentlichung, also in der Ablage, in der die Ergaenzung liegt.
 *
 * Wer dieses Projekt uebernimmt, legt sich eine eigene an. Aufbau:
 *
 *     export const INTERNE_PFADE = Object.freeze(["docs/intern/", ...]);
 *     export const SPERRLISTE = Object.freeze([
 *       { muster: /kundenname/iu, grund: "Name eines fremden Projekts" },
 *     ]);
 * ---------------------------------------------------------------------------
 */

/**
 * Die Ergaenzung, falls vorhanden.
 *
 * Ein fehlender Import ist hier der Normalfall und kein Fehler: In der
 * oeffentlichen Ablage soll die Datei nicht liegen.
 */
let lokal = { INTERNE_PFADE: [], SPERRLISTE: [] };

try {
  lokal = await import("./public-export-policy.lokal.mjs");
} catch {
  // Absichtlich still. Eine Warnung bei jedem Lauf in der oeffentlichen Ablage
  // waere ein Dauer-Fehlalarm, und der bringt dem naechsten Lauf bei,
  // Meldungen zu ueberlesen.
}

/**
 * Pfade, die nie in den oeffentlichen Teil gehoeren.
 *
 * Kommen vollstaendig aus der Ergaenzung: Schon die Aufzaehlung interner
 * Dateinamen verraet, was es gibt. Ohne Ergaenzung ist die Liste leer, und das
 * ist richtig -- dort liegt dann nichts Internes mehr.
 */
export const INTERNE_PFADE = Object.freeze([...(lokal.INTERNE_PFADE ?? [])]);

/**
 * Zeichenketten, die im oeffentlichen Teil nichts zu suchen haben.
 *
 * Hier stehen die ALLGEMEINEN Muster -- die, die ohne Kenntnis eines konkreten
 * Namens auskommen und deshalb fuer jede Uebernahme dieses Projekts taugen.
 * Die konkreten kommen aus der Ergaenzung.
 *
 * Bewusst grob: Lieber ein Fehlalarm, den ein Mensch einmal begruendet
 * abschaltet, als eine Fundstelle, die durchrutscht. Jeder Eintrag steht fuer
 * einen Befund, der tatsaechlich im Repository lag -- keiner ist vorsorglich.
 */
export const SPERRLISTE = Object.freeze([
  // Heimatverzeichnis und Benutzername.
  { muster: /\/Users\/[a-z]/u, grund: "Pfad mit Benutzernamen" },
  // Jede Adresse ausser `kontakt@`. Zwei Fehlerarten, eine Regel:
  //
  //   1. Erfundene Meldewege -- `security@`, `conduct@`, `info@` standen
  //      tatsaechlich im Repository. Ein Meldeweg, der ins Leere laeuft, ist
  //      schlimmer als keiner
  //   2. Persoenliche Adressen -- eine Postfachadresse eines Mitarbeitenden in
  //      einem oeffentlichen Repository ist eine Personenangabe, die dort
  //      nichts zu suchen hat, und ueberlebt jeden Rollenwechsel
  //
  // Die erste Fassung zaehlte die drei erfundenen Adressen auf. Sie uebersah
  // damit die persoenliche -- eine Aufzaehlung versagt still bei jedem Fall,
  // den sie nicht kennt. Deshalb jetzt umgekehrt: alles ausser der einen
  // Adresse, die es gibt.
  {
    muster: /\b(?!kontakt@)[a-z0-9._%+-]+@inxsystems\.de\b/iu,
    grund:
      "E-Mail-Adresse; oeffentlich ist ausschliesslich kontakt@inxsystems.de",
  },
  // `inxsystems.de` ist die MAIL-Domain, nicht die Webseite. Die Webseite
  // lautet `inx.systems`. Ein Verweis auf https://inxsystems.de fuehrt ins
  // Leere -- und zwar in der Zeile, die im README auf den Hersteller zeigt.
  {
    muster: /https?:\/\/(?:www\.)?inxsystems\.de/iu,
    grund: "Mail-Domain als Webadresse; die Webseite ist inx.systems",
  },
  // Platzhalter, die vor der Veroeffentlichung zu ersetzen sind.
  //
  // `nurStreng` heisst: Diese Befunde brechen den gewoehnlichen Lauf nicht.
  // Ein Platzhalter ist kein Fehler im Zweig, sondern eine offene Aufgabe --
  // wuerde er jeden Pull Request rot faerben, waere die Pruefung nach zwei
  // Tagen abgeschaltet. Beim Lauf mit `--streng`, also am Tor zur
  // Veroeffentlichung, bricht er sehr wohl ab.
  {
    muster: /\[ANSCHRIFT\]/u,
    grund: "unersetzter Platzhalter",
    nurStreng: true,
  },
  {
    muster: /\[KONTAKT-E-MAIL\]/u,
    grund: "unersetzter Platzhalter",
    nurStreng: true,
  },
  ...(lokal.SPERRLISTE ?? []),
]);

/**
 * Gehoert dieser Pfad zum internen Teil?
 *
 * @param {string} pfad Repository-relativ, mit Schraegstrichen
 * @returns {boolean}
 */
export function istIntern(pfad) {
  const normal = String(pfad).replace(/^\.\//u, "");
  return INTERNE_PFADE.some((eintrag) =>
    eintrag.endsWith("/") ? normal.startsWith(eintrag) : normal === eintrag,
  );
}

/**
 * Findet Verweise auf interne Dokumente in oeffentlichem Text.
 *
 * Erfasst drei Formen, weil alle drei tatsaechlich vorkamen:
 *   - Markdown-Verweis      [Text](../CLAUDE.md) oder [x](docs/intern/y.md)
 *   - Klartext im Fliesstext  „CLAUDE.md, Kapitel 7"
 *   - Kommentar im Quelltext  „// CLAUDE.md, Kapitel 6: keine any-Abkuerzungen"
 *
 * Deshalb wird auf den blossen Dateinamen geprueft und nicht auf den Pfad:
 * Ein Verweis verraet die Existenz auch ohne korrekten Pfad.
 *
 * @param {string} inhalt
 * @returns {{ zeile: number, treffer: string, ziel: string }[]}
 */
export function findeInterneVerweise(inhalt) {
  const namen = INTERNE_PFADE.map((p) =>
    p.endsWith("/") ? p.slice(0, -1) : p,
  );
  const befunde = [];

  inhalt.split("\n").forEach((zeile, i) => {
    for (const name of namen) {
      // Der Punkt in `CLAUDE.md` muss maskiert werden, sonst passt er auf
      // jedes Zeichen -- und `docs/intern/` enthaelt Schraegstriche.
      const maskiert = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      const re = new RegExp(`(?:\\.\\./|\\./)?${maskiert}`, "u");
      const treffer = re.exec(zeile);
      if (treffer) {
        befunde.push({ zeile: i + 1, treffer: zeile.trim(), ziel: name });
      }
    }
  });

  return befunde;
}

/**
 * Findet gesperrte Zeichenketten in oeffentlichem Text.
 *
 * @param {string} inhalt
 * @returns {{ zeile: number, treffer: string, grund: string, nurStreng: boolean }[]}
 */
export function findeGesperrtes(inhalt) {
  const befunde = [];

  inhalt.split("\n").forEach((zeile, i) => {
    for (const { muster, grund, nurStreng } of SPERRLISTE) {
      if (muster.test(zeile)) {
        befunde.push({
          zeile: i + 1,
          treffer: zeile.trim(),
          grund,
          nurStreng: nurStreng === true,
        });
      }
    }
  });

  return befunde;
}
