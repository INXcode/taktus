import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` wirft beim Import, sobald die Bedingung `react-server`
      // fehlt -- genau das ist sein Zweck, und in Vitest fehlt sie. Das Paket
      // bringt fuer diesen Fall eine leere Fassung mit, gibt sie in seiner
      // `exports`-Karte aber nicht als Unterpfad frei; deshalb der direkte
      // Dateiweg statt "server-only/empty.js".
      //
      // Der Schutz im Build bleibt unberuehrt: Dort entscheidet Next ueber die
      // Bedingung, nicht diese Datei. Faellt die Datei einer kuenftigen
      // Paketfassung weg, schlagen die Tests laut fehl -- nicht still.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // Tests liegen neben dem Code, den sie pruefen -- auch bei den
    // CI-Hilfsskripten. Das Lizenz-Gate bricht den Build; seine Logik ohne
    // Test zu lassen waere dieselbe Nachlaessigkeit, die bei RLS-Policies
    // ausdruecklich untersagt ist.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.mjs"],
    environment: "node",
    // Row-Level-Security wird nicht hier getestet, sondern mit pgTAP gegen die
    // echte Datenbank (`pnpm db:test`). Eine nachgebaute Zugriffspruefung in
    // JavaScript wuerde die Policies nicht pruefen, sondern nur die eigene
    // Nachbildung davon.
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts", "src/actions/**/*.ts"],
      exclude: ["src/types/**"],
    },
  },
});
