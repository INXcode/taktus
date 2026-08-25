#!/usr/bin/env node
/**
 * Wertet eine SARIF-Datei im Job selbst aus und entscheidet ueber die Jobfarbe.
 *
 * ---------------------------------------------------------------------------
 * Wofuer das gebraucht wird
 *
 * Code Scanning ist auf oeffentlichen Repositories kostenlos, auf privaten
 * braeuchte es das Zusatzprodukt „Code Security" -- je aktivem Committer und
 * Monat, und nur fuer Organisationen zu haben. Ohne das gibt es keine
 * Alert-Oberflaeche, und CodeQL bliebe eine Analyse, deren Ergebnis niemand zu
 * sehen bekommt.
 *
 * Dafuer muss niemand zahlen: `analyze` schreibt die SARIF auch ohne Upload,
 * dieses Skript liest sie und bricht bei Befunden ab. Das ist sogar strenger
 * als die Oberflaeche -- ein Befund haelt den Zweig auf, statt einen Alert
 * anzulegen, den man wegklicken kann.
 * ---------------------------------------------------------------------------
 *
 * Aufruf: node scripts/sarif-auswerten.mjs <verzeichnis-oder-datei>...
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { befunde, teileNachAusnahmen } from "./sarif.mjs";

/** Sammelt SARIF-Dateien aus Verzeichnissen und Einzelpfaden. */
function dateienSammeln(pfade) {
  const gefunden = [];

  for (const pfad of pfade) {
    let art;
    try {
      art = statSync(pfad);
    } catch {
      // Ein Pfad, den CodeQL nicht angelegt hat, ist ein Fehler in der
      // Verdrahtung des Workflows -- und der faellt sonst niemandem auf.
      throw new Error(`${pfad} existiert nicht.`);
    }

    if (art.isDirectory()) {
      gefunden.push(
        ...readdirSync(pfad)
          .filter((n) => n.endsWith(".sarif"))
          .map((n) => join(pfad, n)),
      );
    } else {
      gefunden.push(pfad);
    }
  }

  return gefunden;
}

function main() {
  const pfade = process.argv.slice(2);

  if (pfade.length === 0) {
    console.error("Aufruf: node scripts/sarif-auswerten.mjs <pfad>...");
    return 2;
  }

  const dateien = dateienSammeln(pfade);

  if (dateien.length === 0) {
    console.error(
      "\nKeine SARIF-Datei gefunden. Die Analyse hat nichts geschrieben --\n" +
        "das ist kein gruenes Ergebnis, sondern ein kaputtes Tor.\n",
    );
    return 1;
  }

  const alle = [];
  for (const datei of dateien) {
    const gefunden = befunde(JSON.parse(readFileSync(datei, "utf8")));
    console.log(`${datei}: ${gefunden.length} Befund(e)`);
    alle.push(...gefunden);
  }

  const { offen, begruendet, probleme } = teileNachAusnahmen(alle);

  if (begruendet > 0) {
    console.log(
      `\n${begruendet} davon stehen als begruendete Ausnahme in\n` +
        "scripts/sarif.mjs, BEGRUENDETE_AUSNAHMEN -- mit Begruendung und\n" +
        "erwarteter Anzahl.",
    );
  }

  // Ein Problem mit der Liste wiegt so schwer wie ein offener Befund: Eine
  // Ausnahme, die nicht mehr stimmt, ist entweder ein uebersehener neuer
  // Befund oder eine Zusicherung ohne Gegenstand.
  if (probleme.length > 0) {
    console.error("\nDie Ausnahmeliste stimmt nicht mehr:\n");
    for (const p of probleme) console.error(`- ${p}\n`);
    return 1;
  }

  if (offen.length === 0) {
    console.log("\nOK -- keine offenen Befunde.\n");
    return 0;
  }

  console.log("");
  for (const b of offen) {
    // Zweimal ausgeben, und das ist kein Versehen.
    //
    // `::error` erzeugt die Annotation an der Codezeile -- gut zu sehen, aber
    // GitHub zeigt davon im Protokoll nur den Text, ohne Datei und Zeile. Wer
    // das Protokoll liest, weiss dann, DASS etwas gefunden wurde, aber nicht
    // wo. Deshalb zusaetzlich eine gewoehnliche Zeile.
    console.log(`  ${b.datei}:${b.zeile}  ${b.regel}  [${b.stufe}]`);
    console.log(
      `::error file=${b.datei},line=${b.zeile},title=${b.regel}::${b.text}`,
    );
  }

  console.error(
    `\n${offen.length} offene(r) Befund(e) aus der statischen Analyse.\n\n` +
      "Ist einer davon nach Durchsicht ein Fehlalarm, gehoert er mit\n" +
      "Begruendung in BEGRUENDETE_AUSNAHMEN in scripts/sarif.mjs. Dann traegt\n" +
      "die Begruendung jede Linie und jeden Klon, statt in einer Weboberflaeche\n" +
      "zu stehen, die nur eines der beiden Repositories hat.\n",
  );
  return 1;
}

try {
  process.exit(main());
} catch (fehler) {
  console.error(
    "\n" + String(fehler instanceof Error ? fehler.message : fehler) + "\n",
  );
  process.exit(1);
}
