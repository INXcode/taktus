#!/usr/bin/env node
/**
 * Durchsucht das gebaute Client-Bundle nach Geheimnissen.
 *
 * Warum das trotz aller anderen Vorkehrungen existiert:
 * docs/security.md, Kapitel A führt "Service-Role-Key im Client" als eigenes
 * Risiko -- mit der Folge "Vollzugriff auf die Datenbank aus dem Browser, über
 * alle Mandanten hinweg". Der Schlüssel umgeht sämtliche RLS-Policies; die
 * gesamte Mandantentrennung hängt daran, dass er den Server nicht verlässt.
 *
 * Drei Vorkehrungen greifen davor: `import "server-only"` als Build-Barriere,
 * die fehlende `NEXT_PUBLIC_`-Vorsilbe, und eine Semgrep-Regel. Alle drei
 * prüfen die ABSICHT im Quelltext. Dieses Skript prüft das ERGEBNIS -- was
 * tatsächlich ausgeliefert wird.
 *
 * Der Unterschied ist nicht theoretisch: Eine Umgebungsvariable, die
 * versehentlich mit `NEXT_PUBLIC_` benannt wird, passiert alle drei
 * Vorkehrungen und landet trotzdem im Bundle.
 *
 * Aufruf: pnpm build && pnpm bundle:check
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleVerzeichnis = join(wurzel, ".next", "static");

/**
 * Jedes Muster beschreibt etwas, das im Browser NIE auftauchen darf.
 *
 * Bewusst eng gefasst: Ein falscher Alarm hier bedeutet, dass jemand die Regel
 * abschwächt -- und danach schützt sie gar nichts mehr.
 */
const MUSTER = [
  {
    id: "service-role-jwt",
    beschreibung: "JWT mit role=service_role",
    // Der Rollenanspruch steht base64-kodiert im mittleren JWT-Abschnitt.
    // `InNlcnZpY2Vfcm9sZSI` ist die Kodierung von `"service_role"`.
    regex: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*InNlcnZpY2Vfcm9sZSI/,
  },
  {
    id: "service-role-variablenname",
    beschreibung: "Name der Service-Role-Variablen im Bundle",
    // Taucht der Name auf, hat der Bundler die Variable eingesetzt --
    // unabhaengig davon, ob gerade ein Wert gesetzt war.
    regex: /SUPABASE_SERVICE_ROLE_KEY/,
  },
  {
    id: "anthropic-api-key",
    beschreibung: "Anthropic API-Schluessel",
    regex: /sk-ant-(?:api|admin)[A-Za-z0-9_-]{20,}/,
  },
  {
    id: "postgres-verbindung",
    beschreibung: "Postgres-Verbindungszeichenkette",
    regex: /postgres(?:ql)?:\/\/[^:\s"']+:[^@\s"']{3,}@/,
  },
];

/** @param {string} verzeichnis @returns {string[]} */
function dateienSammeln(verzeichnis) {
  /** @type {string[]} */
  const gefunden = [];
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      gefunden.push(...dateienSammeln(pfad));
    } else if (/\.(js|mjs|css|map|json)$/.test(eintrag)) {
      gefunden.push(pfad);
    }
  }
  return gefunden;
}

function main() {
  let dateien;
  try {
    dateien = dateienSammeln(bundleVerzeichnis);
  } catch {
    console.error(
      `\nKein Bundle gefunden unter ${relative(wurzel, bundleVerzeichnis)}.\n` +
        `Zuerst \`pnpm build\` ausfuehren.\n`,
    );
    return 1;
  }

  if (dateien.length === 0) {
    console.error(
      "\nBundle-Verzeichnis ist leer. Das Ergebnis waere 'nichts gefunden' --\n" +
        "und damit wertlos. Zuerst `pnpm build` ausfuehren.\n",
    );
    return 1;
  }

  /** @type {Array<{ datei: string, muster: string, beschreibung: string }>} */
  const treffer = [];

  for (const datei of dateien) {
    const inhalt = readFileSync(datei, "utf8");
    for (const m of MUSTER) {
      if (m.regex.test(inhalt)) {
        treffer.push({
          datei: relative(wurzel, datei),
          muster: m.id,
          beschreibung: m.beschreibung,
        });
      }
    }
  }

  if (treffer.length === 0) {
    console.log(
      `\nOK -- ${dateien.length} Bundle-Dateien geprueft, kein Geheimnis gefunden.\n`,
    );
    return 0;
  }

  console.error("\nGEHEIMNIS IM CLIENT-BUNDLE.\n");
  for (const t of treffer) {
    console.error(`  ${t.datei}`);
    console.error(`    Muster: ${t.muster} -- ${t.beschreibung}\n`);
  }
  console.error(
    "Der Fund ist bereits im gebauten Artefakt. Wurde es ausgeliefert, ist der\n" +
      "betroffene Schluessel als kompromittiert zu behandeln und zu ersetzen --\n" +
      "das Entfernen aus dem Quelltext genuegt nicht.\n",
  );

  return 1;
}

process.exit(main());
