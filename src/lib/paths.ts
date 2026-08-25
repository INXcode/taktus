/**
 * Alle Adressen der Anwendung an einer Stelle.
 *
 * Die Segmente sind englisch. Verzeichnisse im App Router sind Code, und die
 * Regel des Projekts lautet „deutsche Oberflächentexte, englischer Code"
 * (CONTRIBUTING.md). Beschriftet wird deutsch -- das entscheidet
 * `src/lib/navigation.ts`, nicht diese Datei.
 */

export const paths = {
  /** Anmeldung. `weiter` trägt den ursprünglich gewünschten Pfad. */
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  mfa: "/mfa",
  authCallback: "/auth/callback",
  signOut: "/auth/sign-out",

  /** 403. Bewusst eine eigene Seite, kein `forbidden()`. */
  noAccess: "/no-access",

  tickets: "/tickets",
  newTicket: "/tickets/new",
  ticket: (ticketNumber: number) => `/tickets/${ticketNumber}`,

  /**
   * Eine einzelne Buchung im Ticketdetail -- Reiter „Gebuchte Zeiten", Sprung
   * auf die Buchung selbst.
   *
   * Das ist das Ziel jeder Zeile in den Zeitlisten: Geändert wird eine Buchung
   * dort, wo ihr Vorgang steht, und nicht in einer Liste, die davon nichts
   * weiss.
   */
  ticketTimeEntry: (ticketNumber: number, entryId: string) =>
    `/tickets/${ticketNumber}?ansicht=zeiten#buchung-${entryId}`,

  myTime: "/time",
  tenantTime: "/time/tenant",
  customerTime: "/time/customers",

  customers: "/admin/customers",
  newCustomer: "/admin/customers/new",
  customer: (customerId: string) => `/admin/customers/${customerId}`,

  members: "/admin/members",
  newMember: "/admin/members/new",
  member: (profileId: string) => `/admin/members/${profileId}`,
  memberData: (profileId: string) => `/admin/members/${profileId}/data`,
  memberDataDownload: (profileId: string) =>
    `/admin/members/${profileId}/data/download`,
  tenantSettings: "/admin/tenant",
  auditLog: "/admin/audit",

  account: "/account",
  myData: "/account/data",
  myDataDownload: "/account/data/download",
} as const;

/**
 * Pfade, die ohne Anmeldung erreichbar sein müssen.
 *
 * `src/proxy.ts` prüft dagegen. Die Liste ist absichtlich kurz und
 * ausgeschrieben: Ein Muster mit Platzhalter würde bei jedem neuen Bereich
 * still zu viel durchlassen.
 */
export const publicPaths: readonly string[] = [
  paths.login,
  paths.forgotPassword,
  paths.resetPassword,
  paths.mfa,
  paths.authCallback,
];

/**
 * Adressen, die kein Ziel einer Weiterleitung sein duerfen.
 *
 * `/auth/sign-out` kennt nur `POST` -- ein `GET` darauf beantwortet die Route
 * mit `405`. Genau das passierte: Wer „Abmelden" drueckte, ohne noch
 * angemeldet zu sein, wurde vom Proxy auf `/login?weiter=/auth/sign-out`
 * geschickt, und der Ruecksprung nach der Anmeldung lief per `GET` in die
 * Route. Man meldete sich an, um sofort auf einem Fehler zu landen.
 *
 * Der Ausschluss steht hier und nicht in der Route, weil das Problem keines
 * der Route ist: Sie verhaelt sich richtig. Falsch war das Ziel.
 */
export const nonNavigablePaths: readonly string[] = [paths.signOut];

/**
 * Vergleicht segmentweise statt ueber `startsWith`.
 *
 * Der Unterschied ist nicht theoretisch: `"/login/../tickets"` beginnt mit
 * `"/login/"`, und eine geschuetzte Seite waere damit freigegeben. Next.js
 * normalisiert den Pfad zwar, bevor der Proxy ihn sieht -- aber eine
 * Zugriffsentscheidung, die an der Sorgfalt ihres Aufrufers haengt, ist
 * keine.
 *
 * Faellt geschlossen aus: Ein Pfad mit `.`- oder `..`-Segment passt nie.
 */
function passtAufEinen(pathname: string, kandidaten: readonly string[]) {
  const segments = pathname.split("/").filter((segment) => segment !== "");

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return false;
  }

  return kandidaten.some((candidate) => {
    const expected = candidate.split("/").filter((segment) => segment !== "");
    return (
      segments.length >= expected.length &&
      expected.every((segment, index) => segments[index] === segment)
    );
  });
}

/**
 * Ist diese Adresse ohne Anmeldung erreichbar?
 *
 * Verglichen wird segmentweise und nicht über `startsWith` -- die Begründung
 * steht an `passtAufEinen`.
 */
export function isPublicPath(pathname: string): boolean {
  return passtAufEinen(pathname, publicPaths);
}

/**
 * Prüft den `weiter`-Parameter, bevor nach der Anmeldung dorthin geleitet wird.
 *
 * Ohne diese Prüfung wäre die Anmeldung eine offene Weiterleitung: Ein Verweis
 * auf `/login?weiter=https://…` sähe wie eine Adresse dieser Anwendung aus,
 * führte aber nach der Anmeldung auf eine fremde Seite — die übliche Bühne
 * für eine nachgebaute Anmeldemaske.
 *
 * Zugelassen ist ausschließlich ein absoluter Pfad **innerhalb** dieser
 * Anwendung. Alles andere fällt still auf `fallback` zurück, statt eine
 * Fehlermeldung zu erzeugen: Der Parameter ist Bequemlichkeit, kein Auftrag.
 */
export function safeRedirectTarget(
  target: string | null | undefined,
  fallback: string,
): string {
  if (!target || !target.startsWith("/")) {
    return fallback;
  }

  // `//host` ist protokollrelativ und damit extern. `/\host` ebenso, weil
  // Browser den Rückstrich zum Schrägstrich normalisieren.
  if (target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }

  // Kein Steuerzeichen, kein Zeilenumbruch — beides taugt zum Einschmuggeln
  // eines zweiten Headers.
  if (/[\u0000-\u001f\u007f]/.test(target)) {
    return fallback;
  }

  // Nach der Anmeldung wieder zur Anmeldung wäre eine Schleife.
  const pathname = target.split(/[?#]/)[0] ?? "";
  if (isPublicPath(pathname)) {
    return fallback;
  }

  // Und ein Ziel, das kein `GET` beantwortet, wäre ein `405` als Begrüssung.
  if (passtAufEinen(pathname, nonNavigablePaths)) {
    return fallback;
  }

  return target;
}
