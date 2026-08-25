import { createRequire } from "node:module";
import path from "node:path";

import type { NextConfig } from "next";

/**
 * `@swc/helpers` wird von Next zur Laufzeit nachgeladen, aber vom Datei-Tracer
 * nur zur Haelfte mitkopiert. Ohne diesen Eintrag startet das Standalone-Abbild
 * nicht:
 *
 *   Error: Cannot find module '.../@swc/helpers/esm/_interop_require_default.js'
 *
 * Ursache ist eine Abweichung zwischen zwei Aufloesungen derselben Angabe. Das
 * Paket ist `"type": "module"` und bietet in `exports` mehrere Varianten an:
 *
 *   "./_/_interop_require_default": {
 *     "module-sync": "./esm/_interop_require_default.js",
 *     "import":      "./esm/_interop_require_default.js",
 *     "default":     "./cjs/_interop_require_default.cjs"
 *   }
 *
 * Der Tracer von `next build` waehlt den `default`-Zweig und kopiert nur `cjs/`
 * -- nachpruefbar in jeder `.nft.json`, dort steht ausschliesslich die
 * `.cjs`-Datei. Node 24 waehlt zur Laufzeit dagegen `module-sync` und sucht
 * `esm/`. Die Datei wurde nie mitkopiert, und der Server stirbt beim Start.
 *
 * Sichtbar ist das ausschliesslich im Standalone-Ergebnis. Der
 * Entwicklungsserver und `next start` lesen die vollstaendigen `node_modules`,
 * in denen `esm/` selbstverstaendlich vorhanden ist -- der Fehler tritt also
 * erst im Container auf. Genau diese Klasse Fehler meint die Warnung im
 * Dockerfile: Laufzeitdateien gehoeren hierher, nicht in den Kopierbefehl.
 *
 * Der Pfad wird aufgeloest statt geschrieben. `@swc/helpers` ist keine direkte
 * Abhaengigkeit und liegt unter pnpm deshalb nicht auf oberster Ebene, sondern
 * unter `node_modules/.pnpm/@swc+helpers@<version>/...`. Ein fest notierter
 * Glob truege die pnpm-Struktur und die Versionsnummer im Namen und ginge
 * beim naechsten Update still kaputt -- still, weil erst der Container es
 * merkt. Aufgeloest wird ueber `next`, weil das Paket dessen Abhaengigkeit ist.
 *
 * Fortfallen darf der Eintrag, sobald der Tracer `module-sync` beruecksichtigt.
 * Gegenprobe dafuer ist `pnpm standalone:check`.
 */
const swcHelpersEsm = (() => {
  const fromConfig = createRequire(import.meta.url);
  const fromNext = createRequire(fromConfig.resolve("next/package.json"));
  const helpersPackageJson = fromNext.resolve("@swc/helpers/package.json");
  const esmDir = path.join(path.dirname(helpersPackageJson), "esm");
  // Globs in `outputFileTracingIncludes` werden von der Projektwurzel aus
  // aufgeloest, und Next erwartet Schraegstriche auch unter Windows.
  return `${path.relative(process.cwd(), esmDir).split(path.sep).join("/")}/**/*`;
})();

/**
 * Sicherheits-Header werden zentral gesetzt und in der CI geprueft.
 * `docs/security.md`, Kapitel H fuehrt fehlende Header als eigenes Risiko --
 * eine Konfiguration, die nur im Betrieb wirksam wird und im Code unsichtbar
 * bleibt, ist genau die Klasse Fehler, die kein statischer Scanner findet.
 *
 * Die Content-Security-Policy steht **nicht** hier, sondern in
 * `src/lib/security/csp.ts` und wird von `src/proxy.ts` gesetzt. Der Grund ist
 * technisch: Sie traegt eine Nonce je Anfrage, und ein statischer Header kann
 * das nicht. Die fuenf Header hier aendern sich dagegen nie -- sie in den
 * Proxy zu ziehen, hiesse sie bei jeder Anfrage neu zu bauen, ohne dass etwas
 * gewonnen waere.
 */
const securityHeaders = [
  // Verhindert MIME-Sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Kein Einbetten in fremde Rahmen -- Clickjacking-Schutz.
  { key: "X-Frame-Options", value: "DENY" },
  // Referrer nur innerhalb der eigenen Herkunft vollstaendig.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browser-Funktionen, die diese Anwendung nicht braucht, werden abgelehnt.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // HSTS. Wirkt nur ueber HTTPS und ist damit lokal folgenlos.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Standalone-Ausgabe fuer den Container-Betrieb. Kein Vercel -- die
  // Begruendung steht in docs/architektur.md.
  output: "standalone",

  // Der Schluessel ist ein Routen-Glob, kein Dateipfad. `/*` trifft jede
  // Route: Next gleicht mit picomatch und `contains: true` ab, prueft also
  // auf Enthaltensein statt auf vollstaendige Uebereinstimmung.
  // Rein statische Seiten und Edge-Routen erzeugen keine Trace-Datei und
  // bleiben aussen vor -- unerheblich, denn die Dateien muessen nur ein
  // einziges Mal im Standalone-Ergebnis landen.
  outputFileTracingIncludes: {
    "/*": [swcHelpersEsm],
  },

  reactStrictMode: true,

  // Verraet die eingesetzte Technologie nicht im Antwort-Header.
  poweredByHeader: false,

  /**
   * AGPL Paragraph 13: Wer ueber das Netzwerk mit der Anwendung interagiert,
   * muss den Quelltext angeboten bekommen. Diese Werte speisen den
   * Quellcode-Hinweis in der Oberflaeche -- Repository-Link zusammen mit
   * Version und Commit, damit erkennbar ist, welcher Stand laeuft.
   */
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env["npm_package_version"] ?? "0.0.0",
    NEXT_PUBLIC_GIT_SHA: (process.env["GIT_SHA"] ?? "dev").slice(0, 7),
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
