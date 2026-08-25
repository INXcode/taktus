import { type NextRequest } from "next/server";
import { supabaseUrl } from "@/lib/env";
import { contentSecurityPolicy, originOf } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Sitzungsauffrischung vor jeder Anfrage.
 *
 * In Next.js 16 heißt diese Datei `proxy.ts` mit `export function proxy`, nicht
 * mehr `middleware.ts`. Der falsche Dateiname wirft keinen Fehler -- die Datei
 * wird schlicht nie aufgerufen, und die Sitzung läuft still aus. Deshalb prüft
 * ein E2E-Test genau diesen Fall.
 *
 * > [!important] Diese Datei prüft **keine** Rolle, und das ist Absicht.
 * >
 * > CVE-2025-29927 ist die Umgehung über den Header `x-middleware-subrequest`:
 * > Wer ihn setzen kann, überspringt die Middleware vollständig. Eine
 * > Middleware, die über Rollen entscheidet, ist damit eine Middleware, deren
 * > Entscheidung sich überspringen lässt.
 * >
 * > Die Dokumentation von Next 16 sagt dasselbe aus einem zweiten Grund
 * > (`node_modules/next/dist/docs/.../proxy.md`, Abschnitt „Execution order"):
 * > Server Functions sind keine eigenen Routen in dieser Kette, sondern
 * > POST-Anfragen an die Route, in der sie verwendet werden. Ein Matcher, der
 * > einen Pfad ausnimmt, nimmt damit auch dessen Server Actions aus -- lautlos.
 * > „Always verify authentication and authorization inside each Server
 * > Function rather than relying on Proxy alone."
 * >
 * > Die Rollenentscheidung liegt deshalb in `requireRole()` (Stufe 3) und in
 * > den RLS-Policies (Stufe 4). Beide sitzen hinter dieser Umgehung. Was hier
 * > steht, ist Bequemlichkeit für den Normalfall, keine Sicherheitsgrenze.
 */
/**
 * Zusätzlich zur Sitzung: die Content-Security-Policy mit Nonce je Anfrage.
 *
 * Sie steht hier und nicht in `next.config.ts`, weil ein statischer Header
 * keine Nonce je Anfrage tragen kann. Die übrigen fünf Sicherheits-Header
 * liegen weiterhin dort -- sie ändern sich nie, und dort sind sie besser
 * aufgehoben. Beide Dateien verweisen aufeinander.
 *
 * > [!important] Der Header wird auf die **Anfrage** und auf die Antwort
 * > gesetzt.
 * > Auf die Antwort, damit der Browser ihn befolgt. Auf die Anfrage, weil
 * > Next die Nonce von dort liest und auf seine eigenen eingebetteten Skripte
 * > stempelt. Fehlt die Kopie auf der Anfrage, bekommen sie keine Nonce,
 * > werden blockiert -- und die Seite bleibt weiss, ohne Fehlermeldung im
 * > Server-Log.
 */
export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const supabaseOrigin = originOf(supabaseUrl());

  const policy = contentSecurityPolicy({
    nonce,
    // Ohne brauchbare Adresse fehlt der Eintrag, statt dass ein Platzhalter
    // hineingerät. Dann scheitern die Abfragen sichtbar -- das ist der
    // bessere Ausgang als eine Richtlinie, die mehr erlaubt als gedacht.
    supabaseOrigin: supabaseOrigin ?? "",
    isDevelopment: process.env.NODE_ENV === "development",
  });

  /*
   * Der Schalter für die schrittweise Einführung.
   *
   * `Content-Security-Policy-Report-Only` meldet Verstösse, ohne etwas zu
   * blockieren. Ein Betreiber kann damit erst zusehen und dann scharf
   * stellen. Die Vorgabe ist **scharf**: Wer eine Schutzmassnahme
   * standardmässig ausschaltet, betreibt sie nicht.
   */
  const headerName =
    process.env["CSP_REPORT_ONLY"] === "true"
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

  /*
   * Auf der Anfrage steht immer der **scharfe** Name.
   *
   * Next sucht dort nach dem Muster `'nonce-…'`, um seine eigenen Skripte zu
   * stempeln, und kennt `…-Report-Only` nicht. Stünde hier der andere Name,
   * bekämen die Skripte im Berichtsmodus keine Nonce -- der Modus, der nichts
   * blockieren soll, meldete dann lauter Verstösse, die es scharf gar nicht
   * gäbe. Der Bericht wäre unbrauchbar, und zwar genau dann, wenn man ihn
   * liest.
   *
   * Ein zusätzliches `x-nonce` steht hier bewusst nicht: Next liest die Nonce
   * aus dieser Zeile. Der Header wäre nur nötig, um sie in einer eigenen
   * Komponente zu lesen -- und keine tut das.
   */
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = await updateSession(request, requestHeaders);
  response.headers.set(headerName, policy);

  return response;
}

export const config = {
  /**
   * Alles außer statischen Auslieferungen. Die Schriften sind ausgenommen,
   * weil sie sonst bei jeder Anfrage einen Auth-Aufruf auslösten -- und weil
   * eine Weiterleitung auf die Anmeldung eine Schriftdatei kaputtmacht,
   * statt sie zu schützen.
   *
   * Aus demselben Grund stehen `icon.svg` und `apple-icon.png` hier: Next
   * erzeugt die `<link rel="icon">`-Verweise aus den Dateien unter `src/app/`,
   * und ein Symbol ist nichts, wovor jemand angemeldet werden müsste. Ohne die
   * Ausnahme beantwortete der Proxy beide Anfragen mit `307` auf die
   * Anmeldung -- und zwar auf genau dem Bildschirm, den ein Erstbesucher als
   * ersten sieht. `favicon.ico` stand von Anfang an in dieser Liste; die
   * beiden anderen sind später dazugekommen und fehlten deshalb.
   */
  matcher: [
    "/((?!_next/static|_next/image|fonts/|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)",
  ],
};
