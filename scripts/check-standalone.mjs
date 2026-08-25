#!/usr/bin/env node
/**
 * Startet das Standalone-Ergebnis und prüft, ob es überhaupt hochkommt.
 *
 * Warum das existiert:
 * Am 20.08.2026 hat ein Patch-Update von Next (16.3.0 auf 16.3.1) die Demo für
 * knapp vier Tage lahmgelegt. Der Container starb beim Start in einer
 * Neustartschleife:
 *
 *   Error: Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'
 *
 * Der Datei-Tracer von `next build` hatte nur die `cjs`-Variante des Pakets
 * mitkopiert, Node 24 verlangt zur Laufzeit über die Bedingung `module-sync`
 * aber die `esm`-Variante. Behoben ist das über `outputFileTracingIncludes` in
 * `next.config.ts`; dort steht die ausführliche Begründung.
 *
 * Bemerkt hat es niemand, weil KEINE Prüfung das Artefakt anfasst, das
 * tatsächlich produktiv läuft:
 *
 *   - `pnpm build` meldet Erfolg -- der Bau gelingt ja, unvollständig wird
 *     erst das getracte Ergebnis
 *   - `pnpm bundle:check` liest `.next/static`, also das Client-Bundle
 *   - Playwright läuft laut `playwright.config.ts` gegen `pnpm dev` und damit
 *     gegen die vollständigen `node_modules`, in denen die Datei vorhanden ist
 *   - Coolify meldete den Rollout als `finished`, weil der Bau gelang und der
 *     Container erst danach starb
 *
 * Der Fehler war also ausschließlich im Standalone-Ergebnis sichtbar. Genau
 * das startet dieses Skript.
 *
 * > [!note] Was diese Prüfung NICHT leistet
 * > Sie belegt, dass der Server hochkommt und antwortet -- nicht, dass die
 * > Seiten korrekt rendern. Dafür ist die Playwright-Suite zuständig. Die
 * > Umgebungsvariablen unten sind Platzhalter und zeigen auf nichts; eine
 * > Antwort mit 5xx ist deshalb kein Fehlschlag. Geprüft wird die Klasse von
 * > Fehlern, die den Prozess gar nicht erst starten lässt.
 *
 * Aufruf: pnpm build && pnpm standalone:check
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverDatei = join(wurzel, ".next", "standalone", "server.js");

/**
 * 3101 liegt direkt neben dem Anwendungsport 3100 und damit ausserhalb der
 * Ephemeral-Range von macOS (49152-65535) sowie der Supabase-Blöcke. Ein vom
 * Betriebssystem vergebener Port wäre bequemer, brächte aber ein Wettrennen
 * zwischen Freigabe und erneuter Belegung mit sich.
 */
const PORT = Number(process.env["STANDALONE_CHECK_PORT"] ?? 3101);

/** Wie lange der Server Zeit bekommt, bevor der Versuch als gescheitert gilt. */
const ZEITGRENZE_MS = 60_000;

/**
 * Platzhalter, bewusst ohne Bezug zu einer echten Instanz.
 *
 * Sie müssen gesetzt sein, weil `src/lib/env.ts` sie über `process.env[name]`
 * liest -- also mit einer Variablen indiziert, was Next nicht ersetzen kann.
 * Fehlen sie, antwortet jede Seite mit 500. Das würde diese Prüfung zwar nicht
 * fehlschlagen lassen, aber die Ausgabe unnötig verwirrend machen.
 */
const PLATZHALTER_UMGEBUNG = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "platzhalter-kein-echter-schluessel",
  NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
};

function schreibe(zeile) {
  process.stdout.write(`${zeile}\n`);
}

function scheitere(zeile) {
  process.stderr.write(`${zeile}\n`);
}

if (!existsSync(serverDatei)) {
  scheitere("Kein Standalone-Ergebnis gefunden.");
  scheitere(`Erwartet: ${serverDatei}`);
  scheitere("");
  scheitere('Vorher `pnpm build` ausfuehren. `output: "standalone"` steht');
  scheitere("in next.config.ts und ist Voraussetzung fuer diese Pruefung.");
  process.exit(1);
}

schreibe(`Starte ${serverDatei}`);
schreibe(`Port ${PORT}, Zeitgrenze ${ZEITGRENZE_MS / 1000} s`);

const server = spawn(process.execPath, [serverDatei], {
  cwd: join(wurzel, ".next", "standalone"),
  env: {
    ...process.env,
    ...PLATZHALTER_UMGEBUNG,
    NODE_ENV: "production",
    // 127.0.0.1 statt 0.0.0.0: Die Pruefung braucht keinen Zugang von
    // ausserhalb, und ein offener Port waere in der CI unnoetig.
    HOSTNAME: "127.0.0.1",
    PORT: String(PORT),
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

/** Alles, was der Server ausgibt -- im Fehlerfall die einzige Spur. */
let ausgabe = "";
server.stdout.on("data", (stueck) => {
  ausgabe += stueck;
});
server.stderr.on("data", (stueck) => {
  ausgabe += stueck;
});

/** Ob der Prozess von sich aus geendet hat, bevor er antworten konnte. */
let vorzeitigBeendet = null;
server.on("exit", (code, signal) => {
  vorzeitigBeendet = { code, signal };
});

server.on("error", (fehler) => {
  scheitere(`Der Server liess sich nicht starten: ${fehler.message}`);
  process.exit(1);
});

function aufraeumen() {
  if (vorzeitigBeendet === null) {
    server.kill("SIGTERM");
  }
}

function schlafe(ms) {
  return new Promise((fertig) => {
    setTimeout(fertig, ms);
  });
}

const begonnen = Date.now();
let antwort = null;

while (Date.now() - begonnen < ZEITGRENZE_MS) {
  if (vorzeitigBeendet !== null) {
    const { code, signal } = vorzeitigBeendet;
    scheitere("");
    scheitere("Das Standalone-Ergebnis startet nicht.");
    scheitere(
      signal
        ? `Der Prozess wurde durch ${signal} beendet.`
        : `Der Prozess endete mit Code ${code}.`,
    );
    scheitere("");
    scheitere("Ausgabe des Servers:");
    scheitere(ausgabe.trimEnd() || "(keine)");
    scheitere("");
    scheitere("Meldet die Ausgabe MODULE_NOT_FOUND, fehlt eine Datei im");
    scheitere("getracten Ergebnis. Solche Dateien gehoeren in");
    scheitere("`outputFileTracingIncludes` in next.config.ts -- nicht in den");
    scheitere("Kopierbefehl des Dockerfiles.");
    process.exit(1);
  }

  try {
    // Jede Antwort genuegt. Belegt ist damit, dass der Prozess lebt, lauscht
    // und Anfragen bedient -- mehr soll diese Pruefung nicht behaupten.
    antwort = await fetch(`http://127.0.0.1:${PORT}/login`, {
      redirect: "manual",
    });
    break;
  } catch {
    // Verbindung noch nicht angenommen. Der Server braucht einen Moment.
    await schlafe(250);
  }
}

if (antwort === null) {
  aufraeumen();
  scheitere("");
  scheitere(
    `Der Server hat innerhalb von ${ZEITGRENZE_MS / 1000} s nicht geantwortet.`,
  );
  scheitere("");
  scheitere("Ausgabe des Servers:");
  scheitere(ausgabe.trimEnd() || "(keine)");
  process.exit(1);
}

aufraeumen();

const dauer = ((Date.now() - begonnen) / 1000).toFixed(1);
schreibe("");
schreibe(
  `Das Standalone-Ergebnis startet und antwortet (HTTP ${antwort.status} nach ${dauer} s).`,
);
process.exit(0);
