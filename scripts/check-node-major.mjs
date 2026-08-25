#!/usr/bin/env node
/**
 * Prüft, dass `.nvmrc`, `engines.node` und `@types/node` dieselbe
 * Node-Hauptversion nennen.
 *
 * Warum das existiert:
 * `@types/node` folgt der Node-Hauptversion, nicht dem neuesten
 * Veröffentlichungsstand. Typen aus einer höheren Hauptversion beschreiben
 * Schnittstellen, die es zur Laufzeit nicht gibt -- der Übersetzungslauf
 * bleibt grün, und der Fehler tritt erst im Betrieb auf.
 *
 * Dagegen stand eine Regel in `dependabot.yml`. Sie hat **viermal** nicht
 * gegriffen -- mit `update-types`, mit `exclude-patterns`, mit `versions` und
 * mit allen dreien zusammen; zuletzt sogar innerhalb einer Gruppe, für die
 * `exclude-patterns` gilt.
 *
 * Dependabot legt auf Nachfrage selbst offen, warum:
 *
 *   @dependabot show @types/node ignore conditions
 *   | @types/node | [>= 26.a, < 27] |
 *
 * Aus `dependabot.yml` kommt für diese Abhängigkeit **nichts** an. Die einzige
 * wirksame Sperre stammt aus einem `@dependabot ignore`-Kommentar an einem
 * Vorgang, liegt damit in Dependabots eigenem Zustand statt im Repository --
 * unsichtbar, nicht durchsehbar, und sie deckt genau einen Hauptzweig ab. Der
 * nächste kommt durch.
 *
 * > [!important] Warum diese Prüfung anders ist
 * > Sie hängt nicht davon ab, ob ein fremder Dienst seine Konfiguration
 * > beachtet. Ein Vorgang, der `@types/node` über die Laufzeit hebt, wird
 * > rot -- gleich ob Dependabot ihn erzeugt hat oder ein Mensch.
 *
 * Sie ersetzt die Regeln in `dependabot.yml` nicht, sie fängt sie ab. Die
 * Regeln blieben wünschenswert; verlassen kann man sich nur hierauf.
 *
 * **Beim Anheben von Node** werden alle drei Stellen im selben Commit
 * angehoben -- dann meldet diese Prüfung nichts. Genau das ist der Zweck: Sie
 * verbietet den Sprung nicht, sie verbietet den **einseitigen** Sprung.
 *
 * Aufruf: pnpm node:check
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Zieht die führende Hauptversion aus Angaben wie `24`, `v24.1.0`, `>=24.0.0`. */
function hauptversion(text) {
  const treffer = /(\d+)/.exec(String(text ?? ""));
  return treffer ? Number(treffer[1]) : null;
}

const paket = JSON.parse(readFileSync(join(wurzel, "package.json"), "utf8"));
const nvmrc = readFileSync(join(wurzel, ".nvmrc"), "utf8").trim();
const typen =
  paket.devDependencies?.["@types/node"] ?? paket.dependencies?.["@types/node"];

const stellen = [
  { name: ".nvmrc", rohwert: nvmrc, major: hauptversion(nvmrc) },
  {
    name: "package.json → engines.node",
    rohwert: paket.engines?.node,
    major: hauptversion(paket.engines?.node),
  },
  {
    name: "package.json → @types/node",
    rohwert: typen,
    major: hauptversion(typen),
  },
];

const unlesbar = stellen.filter((s) => s.major === null);
if (unlesbar.length > 0) {
  process.stderr.write("Node-Hauptversion nicht lesbar:\n");
  for (const s of unlesbar) {
    process.stderr.write(`  ${s.name}: ${JSON.stringify(s.rohwert)}\n`);
  }
  process.exit(1);
}

const majors = new Set(stellen.map((s) => s.major));

if (majors.size > 1) {
  process.stderr.write("Die Node-Hauptversion ist nicht einheitlich.\n\n");
  for (const s of stellen) {
    process.stderr.write(
      `  ${s.name.padEnd(30)} ${String(s.rohwert).padEnd(12)} → Major ${s.major}\n`,
    );
  }
  process.stderr.write(
    "\n" +
      "`@types/node` folgt der Node-Hauptversion. Typen aus einer hoeheren\n" +
      "Hauptversion beschreiben Schnittstellen, die es zur Laufzeit nicht gibt:\n" +
      "Der Uebersetzungslauf bleibt gruen, und der Fehler tritt erst im Betrieb\n" +
      "auf.\n\n" +
      "Soll Node angehoben werden, gehoeren ALLE drei Stellen in denselben\n" +
      "Commit -- dazu die Grenze fuer `@types/node` in `.github/dependabot.yml`.\n\n" +
      "Kommt diese Meldung aus einem Dependabot-Vorgang, ist sie kein Fehler,\n" +
      "sondern der Zweck dieser Pruefung: Dependabots eigene Regeln greifen\n" +
      "fuer `@types/node` nachweislich nicht. Den Vorgang schliessen.\n",
  );
  process.exit(1);
}

const [major] = majors;
process.stdout.write(
  `Node-Hauptversion einheitlich auf ${major} ` +
    `(.nvmrc ${nvmrc}, engines ${paket.engines?.node}, @types/node ${typen}).\n`,
);
