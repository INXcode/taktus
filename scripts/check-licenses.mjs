#!/usr/bin/env node
/**
 * Lizenz-Gate.
 *
 * Zwei Läufe mit unterschiedlicher Härte:
 *
 *   1. Produktivabhängigkeiten -- BRICHT den Build.
 *      Nur was verbreitet oder über das Netzwerk angeboten wird, ist für die
 *      AGPL-Frage überhaupt erheblich.
 *
 *   2. Entwicklungsabhängigkeiten -- nur Bericht.
 *      Ein Testwerkzeug wird nicht mitgeliefert. Es zu melden schafft
 *      Transparenz, es zu blockieren wäre sachlich falsch.
 *
 * Grenzen dieses Werkzeugs, ausdrücklich benannt:
 * `pnpm licenses list` liest das `license`-Feld der package.json -- eine
 * SELBSTAUSKUNFT des Paketautors, weder verpflichtend noch verlässlich. Pakete
 * deklarieren MIT und liefern Dateien mit abweichenden Kopfzeilen; bei
 * Monorepos weicht die Wurzel-Lizenz vom veröffentlichten Unterpaket ab.
 *
 * Deshalb ist dieses Gate nur die erste Ebene. Die zweite ist das SPDX-SBOM
 * (Syft, siehe .github/workflows/sbom.yml): Es liest die tatsächlich
 * installierten Dateien samt Lizenztexten statt der Deklaration zu glauben.
 * Siehe docs/security.md, Kapitel D.
 *
 * Aufruf: pnpm licenses:check
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { auswerten, buildExceptions, buildPolicy } from "./license-policy.mjs";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");

function lesen(datei) {
  return JSON.parse(readFileSync(join(wurzel, datei), "utf8"));
}

/**
 * `pnpm licenses list` liefert bei Erfolg JSON auf stdout. Ohne installierte
 * Abhängigkeiten schlägt der Aufruf fehl -- das ist ein Bedienfehler und soll
 * als solcher gemeldet werden, nicht als leerer Bericht durchgehen.
 */
function berichtHolen(nurProduktiv) {
  const args = ["licenses", "list", "--json"];
  if (nurProduktiv) args.push("--prod");

  let roh;
  try {
    roh = execFileSync("pnpm", args, {
      cwd: wurzel,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (fehler) {
    throw new Error(
      `\`pnpm ${args.join(" ")}\` fehlgeschlagen. Wurde \`pnpm install\` ausgefuehrt?\n` +
        String(fehler instanceof Error ? fehler.message : fehler),
    );
  }

  try {
    return JSON.parse(roh);
  } catch {
    throw new Error(
      `Ausgabe von \`pnpm ${args.join(" ")}\` ist kein gueltiges JSON.`,
    );
  }
}

function zusammenfassung(text) {
  const datei = process.env["GITHUB_STEP_SUMMARY"];
  if (typeof datei === "string" && datei !== "") {
    appendFileSync(datei, text + "\n");
  }
}

function main() {
  const policy = buildPolicy(lesen("license-policy.json"));
  const exceptions = buildExceptions(lesen("license-exceptions.json"));

  // --- Lauf 1: Produktivabhaengigkeiten, bricht den Build ------------------

  const prod = auswerten(berichtHolen(true), policy, exceptions);

  const nachLizenz = new Map();
  for (const b of prod.befunde) {
    const eintrag = nachLizenz.get(b.lizenz) ?? { anzahl: 0, status: b.status };
    eintrag.anzahl += 1;
    nachLizenz.set(b.lizenz, eintrag);
  }

  const zeichen = { allow: "zulaessig", deny: "ABGELEHNT", unknown: "UNKLAR" };

  console.log("\nProduktivabhaengigkeiten\n");
  const tabelle = ["| Lizenz | Pakete | Status |", "| --- | --- | --- |"];
  for (const [lizenz, { anzahl, status }] of [...nachLizenz].sort()) {
    console.log(
      `  ${lizenz.padEnd(24)} ${String(anzahl).padStart(3)}  ${zeichen[status]}`,
    );
    tabelle.push(`| \`${lizenz}\` | ${anzahl} | ${zeichen[status]} |`);
  }
  zusammenfassung("### Lizenzpruefung\n\n" + tabelle.join("\n"));

  // --- Lauf 2: Entwicklungsabhaengigkeiten, nur Bericht --------------------

  const alle = auswerten(berichtHolen(false), policy, exceptions);
  const nurDev = alle.verletzungen.filter(
    (v) =>
      !prod.verletzungen.some(
        (p) => p.paket === v.paket && p.version === v.version,
      ),
  );

  if (nurDev.length > 0) {
    console.log(
      `\nHinweis: ${nurDev.length} Entwicklungsabhaengigkeit(en) mit ` +
        `unzulaessiger oder unklarer Lizenz. Bricht den Build nicht -- ` +
        `Entwicklungswerkzeuge werden nicht mitgeliefert:`,
    );
    for (const v of nurDev) {
      console.log(`  - ${v.paket}@${v.version}  (${v.lizenz})`);
    }
  }

  // --- Ergebnis -----------------------------------------------------------

  if (prod.verletzungen.length === 0) {
    console.log(
      `\nOK -- ${prod.befunde.length} Produktivabhaengigkeiten geprueft, keine Beanstandung.\n`,
    );
    return 0;
  }

  console.error("\nLizenzpruefung fehlgeschlagen.\n");
  for (const v of prod.verletzungen) {
    console.error(`  ${v.paket}@${v.version}`);
    console.error(`    Lizenz: ${v.lizenz}`);
    console.error(`    Grund:  ${v.grund}\n`);
  }

  const unklar = prod.verletzungen.filter((v) => v.status === "unknown");
  if (unklar.length > 0) {
    console.error(
      "Unklare Angaben brechen den Build absichtlich, statt eine Warnung zu\n" +
        "erzeugen, die niemand liest. Zwei Wege:\n" +
        "\n" +
        "  a) Die Lizenz ist zulaessig -- dann gehoert der Bezeichner nach\n" +
        "     license-policy.json.\n" +
        "  b) Die Angabe ist unklar -- dann die Lizenzdatei im installierten\n" +
        "     Paket lesen und das Ergebnis in license-exceptions.json\n" +
        "     dokumentieren, gebunden an die exakte Version.\n",
    );
  }

  zusammenfassung(
    `\n**Fehlgeschlagen:** ${prod.verletzungen.length} Produktivabhaengigkeit(en) ` +
      `mit unzulaessiger oder unklarer Lizenz.`,
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
