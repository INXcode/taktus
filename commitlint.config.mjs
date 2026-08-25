/**
 * Conventional Commits, auf Englisch. Die Historie wird oeffentlich und ist
 * Teil des Eindrucks. Die Regeln stehen in CONTRIBUTING.md.
 */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "auth",
        "tickets",
        "customers",
        "members",
        "time",
        "ai",
        "rls",
        "db",
        "audit",
        "dsgvo",
        "security",
        "admin",
        "license",
        "ui",
        "ci",
        "deps",
        "docs",
        "config",
      ],
    ],
    "scope-empty": [0],
    "subject-case": [2, "always", "lower-case"],
    "header-max-length": [2, "always", 72],
    "body-max-line-length": [2, "always", 100],
  },
};

export default config;
