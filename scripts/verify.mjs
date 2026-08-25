#!/usr/bin/env node
/**
 * Führt lokal aus, was die CI prüft -- ohne Playwright.
 *
 *   pnpm verify
 *   pnpm verify --ohne-db     # wenn der lokale Stack nicht läuft
 *
 * ---------------------------------------------------------------------------
 * Warum es das gibt
 *
 * GitHub Actions ist auf öffentlichen Repositories kostenlos und auf privaten
 * kontingentiert. Wer dieses Projekt privat betreibt, hat also ein begrenztes
 * Budget an Minuten -- und braucht eine Prüfung, die nichts davon verbraucht.
 *
 * Jeder Punkt hier entspricht einem Schritt aus `.github/workflows/ci.yml`.
 * Weicht die CI ab, weicht diese Datei ab; wer dort einen Schritt ergänzt,
 * ergänzt ihn hier.
 *
 * ---------------------------------------------------------------------------
 * Was bewusst fehlt
 *
 * **Playwright.** Es braucht einen vollständigen Build und mehrere Minuten.
 * Ein Tor, das so lange aufhält, wird umgangen -- und ein umgangenes Tor
 * prüft nichts. Die E2E-Suite läuft in der CI.
 *
 * ---------------------------------------------------------------------------
 * Warum die Historienprüfung hier steht und nicht nur im pre-commit-Hook
 *
 * Der Hook prüft die vorgemerkten Änderungen -- also den Commit, den jemand
 * gerade schreibt. Ein Schlüssel, der vor zwanzig Commits hineingeraten ist,
 * fällt ihm nicht auf. Die vollständige Historie zu prüfen kostet hier keine
 * halbe Sekunde, und Git löscht nichts: Was einmal committet wurde, bleibt.
 *
 * **Der Build selbst** aus demselben Grund. `bundle:check` und
 * `standalone:check` setzen ihn voraus und laufen deshalb ebenfalls nur dort.
 * `pnpm typecheck` fängt den größten Teil dessen ab, was ein Build fände.
 * ---------------------------------------------------------------------------
 */

import { spawnSync } from "node:child_process";

/**
 * @typedef {{ titel: string, befehl: string[], braucht?: "db" }} Schritt
 */

/** @type {Schritt[]} */
const SCHRITTE = [
  {
    titel: "Geheimnisse in der Historie",
    befehl: [
      "gitleaks",
      "git",
      "--redact",
      "--no-banner",
      "--config",
      ".gitleaks.toml",
    ],
  },
  { titel: "Node-Version", befehl: ["pnpm", "node:check"] },
  { titel: "Formatierung", befehl: ["pnpm", "format:check"] },
  { titel: "Lint", befehl: ["pnpm", "lint"] },
  { titel: "Typen", befehl: ["pnpm", "typecheck"] },
  { titel: "Unit-Tests", befehl: ["pnpm", "test"] },
  { titel: "Lizenzen", befehl: ["pnpm", "licenses:check"] },
  { titel: "Trennung intern/oeffentlich", befehl: ["pnpm", "public:check"] },
  {
    titel: "Statische Analyse",
    befehl: ["pnpm", "semgrep:selftest"],
  },
  { titel: "Semgrep", befehl: ["pnpm", "semgrep"] },
  {
    titel: "Schema-Pruefung",
    befehl: ["pnpm", "db:lint"],
    braucht: "db",
  },
  { titel: "pgTAP", befehl: ["pnpm", "db:test"], braucht: "db" },
];

function laeuftStack() {
  const ergebnis = spawnSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
  });
  return (ergebnis.stdout ?? "").includes("supabase_db_taktus");
}

/**
 * Prüft, ob die erzeugten Datenbanktypen zum Schema passen.
 *
 * Eigener Schritt, weil er zwei Befehle braucht und den Arbeitsbaum anfasst.
 * Nicht nachgezogene Typen führen erfahrungsgemäß zu `any`-Umgehungen -- die
 * CI bricht deshalb bei jeder Abweichung ab, und hier soll sie es auch.
 */
function typenAktuell() {
  const erzeugen = spawnSync("pnpm", ["db:types"], { stdio: "inherit" });
  if (erzeugen.status !== 0) return erzeugen.status ?? 1;

  const abweichung = spawnSync(
    "git",
    ["diff", "--exit-code", "src/types/database.ts"],
    { stdio: "inherit" },
  );
  return abweichung.status ?? 1;
}

function main() {
  const ohneDb = process.argv.includes("--ohne-db");
  const stackLaeuft = !ohneDb && laeuftStack();

  if (!ohneDb && !stackLaeuft) {
    console.log(
      "Der lokale Supabase-Stack laeuft nicht. Die Datenbankschritte werden\n" +
        "uebersprungen -- `pnpm db:start` und noch einmal, oder bewusst mit\n" +
        "`--ohne-db`.\n",
    );
  }

  const uebersprungen = [];
  const gescheitert = [];

  for (const schritt of SCHRITTE) {
    if (schritt.braucht === "db" && !stackLaeuft) {
      uebersprungen.push(schritt.titel);
      continue;
    }

    console.log(`\n=== ${schritt.titel} ===`);
    const [befehl, ...argumente] = schritt.befehl;
    const ergebnis = spawnSync(befehl, argumente, { stdio: "inherit" });

    if (ergebnis.status !== 0) gescheitert.push(schritt.titel);
  }

  if (stackLaeuft) {
    console.log("\n=== Datenbanktypen sind aktuell ===");
    if (typenAktuell() !== 0) gescheitert.push("Datenbanktypen sind aktuell");
  } else {
    uebersprungen.push("Datenbanktypen sind aktuell");
  }

  console.log("\n" + "=".repeat(60));

  if (uebersprungen.length > 0) {
    console.log(`\nUebersprungen (${uebersprungen.length}):`);
    for (const t of uebersprungen) console.log(`  -  ${t}`);
  }

  if (gescheitert.length > 0) {
    console.error(`\nFEHLGESCHLAGEN (${gescheitert.length}):`);
    for (const t of gescheitert) console.error(`  x  ${t}`);
    console.error("");
    return 1;
  }

  console.log(
    `\nOK -- ${SCHRITTE.length - uebersprungen.length} Schritt(e) gruen.\n\n` +
      "Nicht geprueft: Build, Bundle, Playwright. Die laufen in der CI des\n" +
      "oeffentlichen Repositories, wo Actions-Minuten nicht zaehlen.\n",
  );
  return 0;
}

process.exit(main());
