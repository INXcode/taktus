import { describe, expect, it } from "vitest";
import {
  isPublicPath,
  paths,
  publicPaths,
  safeRedirectTarget,
} from "@/lib/paths";

/**
 * `isPublicPath` entscheidet, welche Adresse `src/proxy.ts` ohne Sitzung
 * durchlässt. Ein Fehler hier fällt nicht auf: Eine zu weite Regel gibt eine
 * geschützte Seite frei, ohne dass irgendetwas kaputtgeht -- die Seite lädt,
 * sie zeigt nur Daten, die niemanden etwas angehen.
 *
 * Dass die Seiten zusätzlich `requireRole()` aufrufen, ist der eigentliche
 * Schutz. Diese Tests halten die erste Stufe trotzdem eng, damit sich beide
 * Stufen nicht gegenseitig als Begründung dienen.
 */
describe("isPublicPath", () => {
  it("lässt genau die Anmeldestrecke durch", () => {
    for (const publicPath of publicPaths) {
      expect(isPublicPath(publicPath)).toBe(true);
    }
  });

  it.each([
    paths.tickets,
    paths.newTicket,
    paths.ticket(1),
    paths.myTime,
    paths.tenantTime,
    paths.customerTime,
    paths.members,
    paths.tenantSettings,
    paths.auditLog,
    paths.account,
    paths.myData,
    paths.noAccess,
    "/",
  ])("hält %s zurück", (guarded) => {
    expect(isPublicPath(guarded)).toBe(false);
  });

  it("gibt das Abmelden nicht frei -- es setzt eine Sitzung voraus", () => {
    expect(isPublicPath(paths.signOut)).toBe(false);
  });

  it("öffnet Unterpfade der Anmeldestrecke, aber keine Namensvettern", () => {
    // Der Rückruf braucht Unterpfade (PKCE-Tausch), deshalb das Präfix.
    expect(isPublicPath("/auth/callback/google")).toBe(true);
    // Ein bloß gleich beginnender Name darf davon nicht profitieren.
    expect(isPublicPath("/logins")).toBe(false);
    expect(isPublicPath("/login-intern")).toBe(false);
    expect(isPublicPath("/mfa-verwaltung")).toBe(false);
  });

  it("lässt sich nicht durch angehängte Zeichen austricksen", () => {
    expect(isPublicPath("/login/../tickets")).toBe(false);
    expect(isPublicPath("/tickets?weiter=/login")).toBe(false);
  });
});

/**
 * `safeRedirectTarget` entscheidet, wohin es nach der Anmeldung geht. Ohne
 * Prüfung wäre die Anmeldung eine offene Weiterleitung — die übliche Bühne
 * für eine nachgebaute Anmeldemaske: Der Verweis trägt die echte Adresse
 * dieser Anwendung, und erst nach dem Anmelden landet man woanders.
 */
describe("safeRedirectTarget", () => {
  const fallback = paths.tickets;

  it("übernimmt einen inneren Pfad samt Abfrageteil", () => {
    expect(safeRedirectTarget("/time/tenant", fallback)).toBe("/time/tenant");
    expect(safeRedirectTarget("/tickets?status=open", fallback)).toBe(
      "/tickets?status=open",
    );
    expect(safeRedirectTarget("/", fallback)).toBe("/");
  });

  it.each([
    ["fehlt", undefined],
    ["ist leer", ""],
    ["ist null", null],
  ])("nimmt den Rückfall, wenn das Ziel %s", (_fall, target) => {
    expect(safeRedirectTarget(target, fallback)).toBe(fallback);
  });

  it.each([
    "https://beispiel.invalid/tickets",
    "http://beispiel.invalid",
    // Protokollrelativ: der Browser ergänzt das Schema und geht nach draußen.
    "//beispiel.invalid/tickets",
    // Browser normalisieren den Rückstrich zum Schrägstrich.
    "/\\beispiel.invalid/tickets",
    "javascript:alert(1)",
    "tickets",
  ])("weist das externe Ziel %s ab", (target) => {
    expect(safeRedirectTarget(target, fallback)).toBe(fallback);
  });

  /*
   * Der Fall ist beim Handdurchlauf aufgefallen, nicht ausgedacht: Wer
   * „Abmelden" drückt, ohne noch angemeldet zu sein, landet auf
   * `/login?weiter=/auth/sign-out`. Ohne diese Prüfung führte der Rücksprung
   * per GET in eine Route, die nur POST kennt -- man meldete sich an, um
   * sofort einen 405 zu sehen.
   */
  it("weist ein Ziel ab, das nur POST beantwortet", () => {
    expect(safeRedirectTarget(paths.signOut, fallback)).toBe(fallback);
    expect(safeRedirectTarget(`${paths.signOut}?x=1`, fallback)).toBe(fallback);
  });

  it("weist Steuerzeichen ab -- sie taugen zum Einschmuggeln eines Headers", () => {
    expect(safeRedirectTarget("/tickets\nSet-Cookie: a=b", fallback)).toBe(
      fallback,
    );
    expect(safeRedirectTarget("/tickets\r\nLocation: /x", fallback)).toBe(
      fallback,
    );
    expect(safeRedirectTarget("/tickets\u0000", fallback)).toBe(fallback);
  });

  it("leitet nicht zurück in die Anmeldestrecke", () => {
    expect(safeRedirectTarget(paths.login, fallback)).toBe(fallback);
    expect(safeRedirectTarget("/login?weiter=/login", fallback)).toBe(fallback);
    expect(safeRedirectTarget(paths.forgotPassword, fallback)).toBe(fallback);
  });
});
