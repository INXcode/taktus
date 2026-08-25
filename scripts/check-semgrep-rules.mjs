#!/usr/bin/env node
/**
 * Prüft, ob die projektspezifischen Semgrep-Regeln tatsächlich auslösen.
 *
 * Warum es das gibt: Beim Schreiben dieser Regeln sind zwei stumm geblieben.
 * `dangerouslySetInnerHTML={...}` als freistehendes Muster erkennt Semgrep
 * nicht -- es braucht das umgebende JSX-Element. Und eine ganze Regel scheiterte
 * an einem Sprachbezeichner (`tsx` gibt es nicht, `typescript` deckt .tsx mit
 * ab). Beides fiel nur auf, weil gegen absichtlich verletzenden Code geprüft
 * wurde.
 *
 * `semgrep --validate` hätte das nicht gefunden: Die Regeln waren syntaktisch
 * einwandfrei und trafen bloß nichts. Eine Regel, die nie ausgelöst hat, ist
 * eine Behauptung -- dasselbe Prinzip, das im Projekt für RLS-Policies gilt.
 *
 * Semgreps eigenes Testverfahren (`semgrep --test`) scheidet hier aus, weil
 * mehrere Regeln über `paths.include` an Verzeichnisse gebunden sind
 * (src/actions/, src/lib/ai/). Ein Testverzeichnis läge außerhalb und die
 * Regeln griffen nie. Deshalb spiegelt .semgrep/probe/ die Projektstruktur
 * nach, und geprüft wird gegen dieses Verzeichnis.
 *
 * Aufruf: node scripts/check-semgrep-rules.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const regeldatei = join(wurzel, ".semgrep", "taktus.yml");
const probeVerzeichnis = join(wurzel, ".semgrep", "probe");

/**
 * Regeln, die in der Probe KEINEN Treffer erzeugen dürfen.
 *
 * Bislang leer: Jede Regel hat eine verletzende Probe. Wird künftig eine Regel
 * ergänzt, für die absichtlich kein Fall existiert, gehört ihre ID hierher --
 * zusammen mit der Begründung, warum sie ungeprüft bleibt.
 */
const OHNE_PROBE = new Set([]);

function regelIdsLesen() {
  const inhalt = readFileSync(regeldatei, "utf8");
  const ids = [...inhalt.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map((m) => m[1]);
  if (ids.length === 0) {
    throw new Error(`Keine Regel-IDs in ${regeldatei} gefunden.`);
  }
  return ids;
}

function semgrepLaufen() {
  let roh;
  try {
    roh = execFileSync(
      "semgrep",
      [
        "scan",
        "--config",
        regeldatei,
        "--json",
        "--quiet",
        "--no-git-ignore",
        "--metrics",
        "off",
        probeVerzeichnis,
      ],
      { cwd: probeVerzeichnis, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (fehler) {
    // Semgrep beendet sich mit 1, wenn Befunde vorliegen -- hier der Normalfall.
    const ausgabe = /** @type {any} */ (fehler)?.stdout;
    if (typeof ausgabe !== "string" || ausgabe === "") {
      throw new Error(
        "semgrep konnte nicht ausgefuehrt werden. Installiert? `brew install semgrep`\n" +
          String(fehler instanceof Error ? fehler.message : fehler),
      );
    }
    roh = ausgabe;
  }

  return JSON.parse(roh);
}

function main() {
  const erwartet = regelIdsLesen().filter((id) => !OHNE_PROBE.has(id));
  const ergebnis = semgrepLaufen();

  const ausgeloest = new Set(
    (ergebnis.results ?? []).map((r) =>
      // Semgrep stellt der ID den Konfigurationspfad voran.
      String(r.check_id).split(".").pop(),
    ),
  );

  const stumm = erwartet.filter((id) => !ausgeloest.has(id));

  console.log(`\nRegeln in .semgrep/taktus.yml: ${erwartet.length}`);
  for (const id of erwartet) {
    console.log(`  ${ausgeloest.has(id) ? "loest aus " : "STUMM    "} ${id}`);
  }

  if (stumm.length === 0) {
    console.log("\nOK -- jede Regel loest gegen die Probe aus.\n");
    return 0;
  }

  console.error(
    `\n${stumm.length} Regel(n) ohne Treffer. Entweder trifft das Muster nicht,\n` +
      `oder in .semgrep/probe/ fehlt der verletzende Fall. Beides muss vor dem\n` +
      `Zusammenfuehren geklaert sein -- eine stumme Regel schuetzt nichts und\n` +
      `erweckt trotzdem den Eindruck, sie taete es.\n`,
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
