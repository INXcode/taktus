import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from "@/lib/labels/audit";

/**
 * Die Filter des Protokolls leben in der Adresse -- wie die der Ticketliste.
 *
 * Gleiche Bauart, gleiche Begründung: teilbar, mit funktionierendem
 * Zurück-Knopf und ohne JavaScript bedienbar. Und derselbe Preis: Jeder Wert
 * kommt aus einer URL und ist damit Nutzereingabe. Unbekanntes wird
 * **verworfen**, nicht durchgereicht -- ein `aktion=foo` würde PostgREST sonst
 * quittieren, und der Betrachter sähe eine kaputte Seite statt eines
 * ungefilterten Protokolls.
 */

/** Der Entwurf zeigt 25 Zeilen je Seite. */
export const PAGE_SIZE = 25;

export const PERIODS = {
  "7": { label: "Letzte 7 Tage", days: 7 },
  "30": { label: "Letzte 30 Tage", days: 30 },
  "90": { label: "Letzte 90 Tage", days: 90 },
  alle: { label: "Gesamter Zeitraum", days: null },
} as const;

export type PeriodKey = keyof typeof PERIODS;

/**
 * Sieben Tage als Vorgabe, nicht „alles".
 *
 * Das Protokoll ist kein Bericht, den man von vorn liest, sondern eine Frage
 * an die jüngste Vergangenheit. Wer weiter zurück will, sagt es -- und die
 * Angabe steht dann in der Adresse, statt eine stumme Voreinstellung zu sein.
 */
export const DEFAULT_PERIOD: PeriodKey = "7";

export type AuditFilters = {
  readonly period: PeriodKey;
  readonly action: AuditAction | null;
  readonly entityType: AuditEntityType | null;
  readonly page: number;
};

export const EMPTY_FILTERS: AuditFilters = {
  period: DEFAULT_PERIOD,
  action: null,
  entityType: null,
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAuditFilters(params: RawParams): AuditFilters {
  const rawPeriod = first(params["zeitraum"]);
  const period: PeriodKey =
    rawPeriod !== undefined && rawPeriod in PERIODS
      ? (rawPeriod as PeriodKey)
      : DEFAULT_PERIOD;

  const rawAction = first(params["aktion"]);
  const action = (AUDIT_ACTIONS as readonly string[]).includes(rawAction ?? "")
    ? (rawAction as AuditAction)
    : null;

  const rawEntity = first(params["objektart"]);
  const entityType = (AUDIT_ENTITY_TYPES as readonly string[]).includes(
    rawEntity ?? "",
  )
    ? (rawEntity as AuditEntityType)
    : null;

  const rawPage = Number.parseInt(first(params["seite"]) ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  return { period, action, entityType, page };
}

/**
 * Baut die Adresse für einen geänderten Filter.
 *
 * Leere und voreingestellte Werte fallen heraus, damit `/admin/audit` nicht
 * als `/admin/audit?zeitraum=7&seite=1` im Verlauf landet. Jede Änderung setzt
 * die Seite zurück -- Seite 3 eines anderen Filters ist selten die gemeinte.
 */
export function auditFiltersToQuery(
  filters: AuditFilters,
  overrides: Partial<AuditFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.period !== DEFAULT_PERIOD) params.set("zeitraum", merged.period);
  if (merged.action !== null) params.set("aktion", merged.action);
  if (merged.entityType !== null) params.set("objektart", merged.entityType);

  const page = "page" in overrides ? merged.page : 1;
  if (page > 1) params.set("seite", String(page));

  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

/** Ist überhaupt etwas eingeschränkt? Entscheidet über „Filter zurücksetzen". */
export function hasActiveAuditFilters(filters: AuditFilters): boolean {
  return (
    filters.period !== DEFAULT_PERIOD ||
    filters.action !== null ||
    filters.entityType !== null
  );
}

/**
 * Der früheste Zeitpunkt, der noch angezeigt wird -- oder `null` für „alles".
 *
 * Gerechnet wird ab dem übergebenen Jetzt, nicht ab einem hier gelesenen:
 * Eine Funktion, die selbst auf die Uhr sieht, lässt sich nicht prüfen.
 */
export function periodStart(period: PeriodKey, now: Date): string | null {
  const { days } = PERIODS[period];
  if (days === null) return null;

  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return start.toISOString();
}
