#!/usr/bin/env node
/**
 * Prueft, dass der oeffentliche Teil des Repositories oeffentlich sein kann.
 *
 * Drei Fragen, alle drei stehen fuer einen Befund, den es tatsaechlich gab:
 *
 *   1. Verweist eine oeffentliche Datei auf ein internes Dokument?
 *      Ein Verweis verraet Existenz und Kapitelstruktur, auch wenn das
 *      Dokument selbst nie mitgeht.
 *   2. Steht eine gesperrte Zeichenkette im oeffentlichen Teil?
 *      Benutzername, fremdes Projekt, eigene Demo-Instanz, erfundene
 *      E-Mail-Adresse, unersetzter Platzhalter.
 *   3. Existieren die internen Pfade ueberhaupt noch?
 *      Sonst prueft dieses Skript stillschweigend nichts mehr.
 *
 * Zwei Schweregrade:
 *
 *   ohne Schalter -- laeuft in der CI bei jedem Pull Request. Bricht ab bei
 *     Verweisen auf interne Dokumente und bei gesperrten Angaben.
 *   `--streng`    -- das Tor zur Veroeffentlichung. Bricht zusaetzlich bei
 *     unersetzten Platzhaltern ab.
 *
 * Der Unterschied ist keine Bequemlichkeit: Ein Platzhalter wie `[ANSCHRIFT]`
 * ist kein Fehler im Zweig, sondern eine offene Aufgabe. Wuerde er jeden Pull
 * Request rot faerben, waere die Pruefung nach zwei Tagen abgeschaltet -- und
 * dann faenge sie auch die echten Befunde nicht mehr.
 *
 * Bricht ab, statt zu warnen -- dieselbe Regel wie bei check-licenses.mjs. Eine
 * Warnung an dieser Stelle liest nach dem dritten Lauf niemand mehr, und der
 * Fehler faellt erst auf, wenn das Repository oeffentlich ist.
 *
 * Die reine Logik steht in public-export-policy.mjs und ist dort getestet.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";

import {
  INTERNE_PFADE,
  findeGesperrtes,
  findeInterneVerweise,
  istIntern,
} from "./public-export-policy.mjs";

/** Dateiendungen, die als Text gelesen werden. Alles andere wird uebersprungen. */
const TEXTENDUNGEN = new Set([
  ".md",
  ".ts",
  ".tsx",
  ".mjs",
  ".js",
  ".json",
  ".yml",
  ".yaml",
  ".sql",
  ".toml",
  ".css",
  ".txt",
  ".sh",
]);

/**
 * Dateien ohne Endung, die trotzdem Text sind.
 *
 * Eine Aufzaehlung ist hier die schwaechere Loesung -- sie versagt still bei
 * jeder neuen Datei. Genau das ist passiert: Der erste Entwurf uebersah
 * `.husky/commit-msg`, und dort stand ein Verweis auf ein internes Dokument.
 * Aufgefallen ist es erst beim Export-Probelauf, nicht bei der Pruefung.
 * Deshalb steht darunter zusaetzlich eine Verzeichnisregel.
 */
const TEXTDATEIEN = new Set([
  "Dockerfile",
  ".gitignore",
  ".gitattributes",
  ".dockerignore",
  ".editorconfig",
  ".nvmrc",
  ".prettierignore",
  "CODEOWNERS",
  "LICENSE",
]);

/** Verzeichnisse, deren Inhalt unabhaengig von der Endung Text ist. */
const TEXTVERZEICHNISSE = [".husky/", ".github/"];

/**
 * Verzeichnisse, die nicht ausgeliefert werden und deren Inhalt niemand
 * schreibt. `LICENSES/` enthaelt fremde Lizenztexte -- eine Sperrliste darauf
 * anzuwenden waere sinnlos.
 */
const UEBERSPRUNGEN = [
  "node_modules/",
  ".next/",
  ".git/",
  "LICENSES/",
  "public/fonts/",
  "pnpm-lock.yaml",
  "src/types/database.ts",
  "docs/design/",
  // Dieses Skript und seine Logik nennen die gesperrten Muster
  // notwendigerweise selbst.
  "scripts/public-export-policy.mjs",
  "scripts/public-export-policy.test.mjs",
  "scripts/check-public-export.mjs",
];

function endung(pfad) {
  const punkt = pfad.lastIndexOf(".");
  const schraeg = pfad.lastIndexOf("/");
  return punkt > schraeg ? pfad.slice(punkt) : "";
}

function istText(pfad) {
  if (TEXTVERZEICHNISSE.some((v) => pfad.startsWith(v))) return true;
  const name = pfad.slice(pfad.lastIndexOf("/") + 1);
  return TEXTENDUNGEN.has(endung(pfad)) || TEXTDATEIEN.has(name);
}

/**
 * Alle zu pruefenden Dateien.
 *
 * Bevorzugt ueber Git: Es kennt den Umfang genauer als jeder eigene
 * Verzeichnisdurchlauf, weil ignorierte Dateien gar nicht erst auftauchen.
 *
 * Faellt auf einen Verzeichnisdurchlauf zurueck, wenn kein Repository da ist.
 * Das ist kein Randfall, sondern der wichtigste Anwendungsfall: Der strenge
 * Lauf gehoert in das frisch erzeugte Exportverzeichnis -- also **vor**
 * `git init`. Ohne diesen Rueckfall waere die Pruefung genau dort nicht
 * ausfuehrbar, wo sie am meisten zaehlt.
 */
function zuPruefendeDateien() {
  try {
    const roh = execFileSync("git", ["ls-files", "-z"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { dateien: roh.split("\0").filter(Boolean), imQuellbaum: true };
  } catch {
    console.log("Kein Git-Repository -- Verzeichnisdurchlauf.\n");
    return { dateien: [...durchlaufen(".")], imQuellbaum: false };
  }
}

/** @returns {Generator<string>} */
function* durchlaufen(verzeichnis) {
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad =
      verzeichnis === "." ? eintrag.name : `${verzeichnis}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      if ([".git", "node_modules", ".next"].includes(eintrag.name)) continue;
      yield* durchlaufen(pfad);
    } else if (eintrag.isFile()) {
      yield pfad;
    }
  }
}

function main() {
  const streng = process.argv.includes("--streng");

  /** @type {string[]} */
  const fehler = [];
  /** @type {string[]} */
  const offen = [];

  const { dateien } = zuPruefendeDateien();

  // Frage 3 zuerst: Prueft dieses Skript ueberhaupt noch etwas?
  //
  // Eine Aufzaehlung interner Pfade, die ins Leere zeigt, prueft nichts mehr
  // und meldet trotzdem gruen. Deshalb wird ihre Existenz mitgeprueft.
  //
  // Nur gilt das ausschliesslich in der INTERNEN Linie. In der oeffentlichen
  // SOLLEN diese Pfade fehlen -- dort waere dieselbe Pruefung ein Dauer-
  // Fehlalarm, und ein Fehlalarm an einem Tor ist schlimmer als keine
  // Pruefung: Er bringt dem naechsten Lauf bei, dass rote Meldungen normal
  // sind.
  //
  // Unterschieden wird an der Belegung selbst, nicht am Vorhandensein eines
  // Git-Verzeichnisses. Der erste Anlauf fragte danach -- das trug, solange
  // der Export ein Verzeichnis ohne `.git` war, und fiel in dem Moment um, in
  // dem daraus ein echtes Repository wurde. Genau dort soll die Pruefung aber
  // laufen.
  //
  //   keiner vorhanden  -> oeffentliche Linie, die Frage stellt sich nicht
  //   alle vorhanden    -> interne Linie, alles in Ordnung
  //   einige vorhanden  -> interne Linie, und jemand hat etwas verschoben
  const vorhanden = INTERNE_PFADE.filter((pfad) =>
    existsSync(pfad.endsWith("/") ? pfad.slice(0, -1) : pfad),
  );

  if (vorhanden.length > 0) {
    for (const pfad of INTERNE_PFADE) {
      const ziel = pfad.endsWith("/") ? pfad.slice(0, -1) : pfad;
      if (!existsSync(ziel)) {
        fehler.push(
          `Der interne Pfad \`${pfad}\` existiert nicht mehr.\n` +
            `  Entweder wurde er verschoben -- dann gehoert INTERNE_PFADE in\n` +
            `  scripts/public-export-policy.mjs nachgezogen -- oder diese Pruefung\n` +
            `  laeuft seit einer Weile ins Leere.`,
        );
      }
    }
  } else {
    console.log(
      "Oeffentliche Linie -- die internen Pfade fehlen erwartungsgemaess.\n",
    );
  }

  let geprueft = 0;

  for (const pfad of dateien) {
    if (istIntern(pfad)) continue;
    if (UEBERSPRUNGEN.some((p) => pfad.startsWith(p))) continue;
    if (!istText(pfad)) continue;

    // Erst lesen, dann fragen. Ein `existsSync` davor waere eine zweite
    // Auskunft ueber denselben Pfad, die zum Zeitpunkt des Lesens schon
    // ueberholt sein kann -- und genau diese Luecke meldet CodeQL als
    // `js/file-system-race`. Praktisch ist das hier belanglos (ein lokales
    // Pruefskript ueber `git ls-files`), aber der Griff ist kuerzer als jede
    // Begruendung, warum die Luecke ausnahmsweise nicht stoert.
    //
    // Verzeichnisse und geloeschte Dateien fallen in denselben Fang: Beides
    // wirft beim Lesen, beides ist hier nichts zu pruefen.
    let inhalt;
    try {
      inhalt = readFileSync(pfad, "utf8");
    } catch {
      continue;
    }

    geprueft += 1;

    for (const b of findeInterneVerweise(inhalt)) {
      fehler.push(
        `${pfad}:${b.zeile} verweist auf das interne Dokument \`${b.ziel}\`\n` +
          `  ${b.treffer}`,
      );
    }

    for (const b of findeGesperrtes(inhalt)) {
      const meldung = `${pfad}:${b.zeile} ${b.grund}\n  ${b.treffer}`;
      if (b.nurStreng && !streng) offen.push(meldung);
      else fehler.push(meldung);
    }
  }

  if (offen.length > 0) {
    console.warn(
      `\nVor der Veroeffentlichung zu erledigen -- ${offen.length} offene(r) Punkt(e):\n`,
    );
    for (const o of offen) console.warn(`  ${o}\n`);
    console.warn(
      "Bricht diesen Lauf nicht ab. `node scripts/check-public-export.mjs --streng`\n" +
        "am Tor zur Veroeffentlichung tut es.\n",
    );
  }

  if (fehler.length > 0) {
    console.error(
      `\nDer oeffentliche Teil ist nicht veroeffentlichungsfaehig ` +
        `-- ${fehler.length} Befund(e):\n`,
    );
    for (const f of fehler) console.error(`  ${f}\n`);
    console.error(
      "Zwei Wege:\n" +
        "  - Die Fundstelle umschreiben, sodass sie ohne den Verweis auskommt.\n" +
        "    Meist genuegt es, die zitierte Aussage auszuschreiben, statt auf\n" +
        "    das interne Dokument zu zeigen.\n" +
        "  - Ist der Befund begruendet zulaessig, gehoert die Ausnahme nach\n" +
        "    scripts/public-export-policy.mjs -- mit Begruendung im Kommentar,\n" +
        "    nicht als stille Erweiterung der Sperrliste.\n",
    );
    return 1;
  }

  console.log(
    `OK -- ${geprueft} oeffentliche Dateien geprueft, ` +
      `keine Verweise auf interne Dokumente, keine gesperrten Angaben` +
      (streng ? ", keine offenen Platzhalter." : "."),
  );
  return 0;
}

process.exit(main());
