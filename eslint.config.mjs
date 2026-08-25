import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generiert von `pnpm db:types`, nie von Hand bearbeitet.
    "src/types/database.ts",
    // Absichtlich fehlerhafter Code als Nachweis fuer die Semgrep-Regeln.
    ".semgrep/probe/**",
  ]),

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      // Bewusst ungenutzte Bindungen werden mit Unterstrich markiert.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Beitragsregel (CONTRIBUTING.md): keine `any`-Abkuerzungen. Als Fehler, nicht als
      // Warnung -- eine Warnung, die niemand liest, ist keine Regel.
      "@typescript-eslint/no-explicit-any": "error",

      // Bei `verbatimModuleSyntax` muessen Typ-Importe markiert sein, sonst
      // landen sie im erzeugten Bundle.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },

  {
    // Hilfsskripte laufen ausserhalb von Next.js; die Konsole ist dort ihre
    // Ausgabeschnittstelle, nicht ein vergessenes Debug-Statement.
    files: ["scripts/**/*.mjs", "*.config.mjs", "*.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
