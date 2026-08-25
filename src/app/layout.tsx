import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taktus Kontor",
  description:
    "Schlanker Orchestrator für Kleinunternehmen: Tickets, Zeiterfassung, KI.",
};

/**
 * Desktop und Mobil sind im Entwurf gleichrangig -- ohne diese Angabe
 * skalierte iOS die 390-px-Entwürfe auf eine 980-px-Seite herunter.
 * `maximumScale` bleibt bewusst ungesetzt: Zoom zu unterbinden wäre ein
 * Barrierefreiheitsfehler, und WCAG AA ist hier keine Kür.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <head>
        {/*
         * Nur die Oberflächenschrift wird vorgeladen, nicht beide: JetBrains
         * Mono trägt Ticketnummern, Minuten und Aktionsnamen und damit einen
         * kleinen Teil der Fläche. `font-display: swap` fängt die späte
         * Ankunft ab, ohne dass etwas springt -- die Zellen stehen auf
         * `tabular-nums` und haben feste Breiten.
         *
         * `crossOrigin` ist auch bei gleichem Ursprung nötig: Schriftabrufe
         * laufen im CORS-Modus, und ohne das Attribut lädt der Browser die
         * Datei ein zweites Mal.
         */}
        <link
          rel="preload"
          href="/fonts/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
