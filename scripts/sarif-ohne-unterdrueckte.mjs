#!/usr/bin/env node
/**
 * Entfernt unterdrueckte Befunde aus einer SARIF-Datei, bevor sie ins Code
 * Scanning geht.
 *
 * Begruendung im Kopf von scripts/sarif.mjs -- kurz: GitHub ehrt Semgreps
 * `nosemgrep` nicht und macht aus jeder begruendeten Ausnahme einen offenen
 * Alert.
 *
 * Aufruf: node scripts/sarif-ohne-unterdrueckte.mjs semgrep.sarif
 */

import { readFileSync, writeFileSync } from "node:fs";

import { ohneUnterdrueckte } from "./sarif.mjs";

function main() {
  const pfad = process.argv[2];

  if (!pfad) {
    console.error("Aufruf: node scripts/sarif-ohne-unterdrueckte.mjs <datei>");
    return 2;
  }

  const roh = readFileSync(pfad, "utf8");
  const { sarif, entfernt } = ohneUnterdrueckte(JSON.parse(roh));

  writeFileSync(pfad, JSON.stringify(sarif));

  // Immer melden, auch die Null. Ein Schritt, der nur bei Treffern etwas sagt,
  // ist im gruenen Protokoll von einem uebersprungenen nicht zu unterscheiden.
  console.log(
    entfernt === 0
      ? `${pfad}: keine unterdrueckten Befunde.`
      : `${pfad}: ${entfernt} unterdrueckte(n) Befund(e) entfernt.\n` +
          "  Sie sind im Quelltext begruendet abgeschaltet und gehoeren nicht\n" +
          "  als offener Alert ins Code Scanning.",
  );

  return 0;
}

try {
  process.exit(main());
} catch (fehler) {
  console.error(
    "\n" + String(fehler instanceof Error ? fehler.message : fehler) + "\n",
  );
  process.exit(1);
}
