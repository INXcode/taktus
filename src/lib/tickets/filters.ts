import { CATEGORY_ORDER } from "@/lib/labels/category";
import { STATUS_ORDER } from "@/lib/labels/status";
import { type TicketCategory, type TicketStatus } from "@/types";

/**
 * Die Filter der Ticketliste leben in der Adresse.
 *
 * Damit sind sie teilbar, der Zurück-Knopf stimmt, und die Liste funktioniert
 * ohne JavaScript -- das Filterband ist ein `<form method="get">`. Der Preis
 * ist, dass jeder Wert aus einer URL kommt und damit Nutzereingabe ist: Diese
 * Datei ist die Stelle, an der daraus etwas Gültiges wird.
 *
 * Unbekannte Werte werden **verworfen**, nicht durchgereicht. Ein `status=foo`
 * würde PostgREST sonst mit einem Enum-Fehler quittieren, und der Nutzer sähe
 * eine kaputte Seite statt einer ungefilterten Liste.
 */

export const SORT_OPTIONS = {
  neu: { label: "Neueste zuerst", column: "created_at", ascending: false },
  alt: { label: "Älteste zuerst", column: "created_at", ascending: true },
  nummer: {
    label: "Nummer absteigend",
    column: "ticket_number",
    ascending: false,
  },
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

/** Der Entwurf zeigt 25 Zeilen je Seite. */
export const PAGE_SIZE = 25;

export type TicketFilters = {
  readonly search: string;
  readonly status: readonly TicketStatus[];
  readonly category: TicketCategory | null;
  /** `null` = alle, `"none"` = nicht zugewiesen, sonst eine Profil-Kennung. */
  readonly assignee: string | null;
  /**
   * `null` = alle, sonst eine Kundenkennung.
   *
   * Kein `"none"` wie bei der Zuweisung: Jedes Ticket hat einen Kunden, die
   * Spalte ist `NOT NULL`. Ein Filter „ohne Kunde" verspräche eine Auswahl,
   * die immer leer bliebe.
   */
  readonly customer: string | null;
  readonly sort: SortKey;
  readonly page: number;
};

export const EMPTY_FILTERS: TicketFilters = {
  search: "",
  status: [],
  category: null,
  assignee: null,
  customer: null,
  sort: "neu",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function many(value: string | string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : value.split(",");
}

export function parseFilters(params: RawParams): TicketFilters {
  const status = many(params["status"]).filter(
    (candidate): candidate is TicketStatus =>
      (STATUS_ORDER as readonly string[]).includes(candidate),
  );

  const rawCategory = first(params["kategorie"]);
  const category = (CATEGORY_ORDER as readonly string[]).includes(
    rawCategory ?? "",
  )
    ? (rawCategory as TicketCategory)
    : null;

  const rawSort = first(params["sortierung"]);
  const sort: SortKey =
    rawSort !== undefined && rawSort in SORT_OPTIONS
      ? (rawSort as SortKey)
      : "neu";

  const rawPage = Number.parseInt(first(params["seite"]) ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const rawAssignee = first(params["zuweisung"]);
  // Nur „keine Zuweisung" oder eine UUID. Alles andere wäre entweder ein
  // Tippfehler oder ein Versuch, etwas in die Abfrage zu schmuggeln.
  const assignee =
    rawAssignee === "none"
      ? "none"
      : rawAssignee !== undefined && isUuid(rawAssignee)
        ? rawAssignee
        : null;

  const rawCustomer = first(params["kunde"]);
  const customer =
    rawCustomer !== undefined && isUuid(rawCustomer) ? rawCustomer : null;

  return {
    search: (first(params["suche"]) ?? "").trim().slice(0, 200),
    status,
    category,
    assignee,
    customer,
    sort,
    page,
  };
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * Baut die Adresse für einen geänderten Filter.
 *
 * Leere Werte fallen heraus, damit `/tickets` nicht als
 * `/tickets?suche=&status=&seite=1` im Verlauf landet. Jede Änderung setzt
 * die Seite zurück -- Seite 3 eines anderen Filters ist selten die gemeinte.
 */
export function filtersToQuery(
  filters: TicketFilters,
  overrides: Partial<TicketFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (merged.search !== "") params.set("suche", merged.search);
  for (const value of merged.status) params.append("status", value);
  if (merged.category !== null) params.set("kategorie", merged.category);
  if (merged.assignee !== null) params.set("zuweisung", merged.assignee);
  if (merged.customer !== null) params.set("kunde", merged.customer);
  if (merged.sort !== "neu") params.set("sortierung", merged.sort);

  const page = "page" in overrides ? merged.page : 1;
  if (page > 1) params.set("seite", String(page));

  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

/**
 * Entschärft `%`, `_` und `\` für ein LIKE-Muster.
 *
 * Ohne das wäre eine Suche aus lauter Prozentzeichen ein Volltreffer auf
 * alles, und ein Unterstrich träfe jedes beliebige Zeichen.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/gu, "\\$&");
}

/**
 * Setzt einen Wert als Zeichenkette in einen PostgREST-Filterausdruck.
 *
 * ---------------------------------------------------------------------------
 * Warum das nötig ist
 *
 * `or()` nimmt einen rohen Filterausdruck entgegen, den PostgREST selbst
 * zerlegt -- das Komma trennt dort die Terme. Eine Suche nach
 * `12,status.eq.closed` erzeugte unquotiert einen DRITTEN Term, den der
 * Aufrufer nie gesetzt hat. Gegen die laufende Instanz nachgestellt: Der
 * Ausdruck wurde angenommen und ausgewertet.
 *
 * Gefährlich war das nicht -- `or=` kann nur Zeilen filtern, keine Spalten
 * oder Verknüpfungen hinzufügen, und RLS begrenzt die Treffer weiterhin auf
 * das, was der Aufrufer ohnehin sehen darf. Aber die Klasse gehört
 * geschlossen, nicht abgewogen.
 *
 * ---------------------------------------------------------------------------
 * Warum die beiden Ebenen in dieser Reihenfolge stehen
 *
 * Innerhalb von Anführungszeichen gelten `,`, `.` und Klammern als Text; dort
 * maskiert der Backslash `"` und sich selbst. PostgREST trägt beim Zerlegen
 * **eine** Backslash-Ebene ab -- was danach bei ILIKE ankommt, ist genau das
 * Muster aus `escapeLikePattern`.
 *
 * Deshalb erst die LIKE-Entschärfung, dann diese. Die zweite maskiert die
 * Backslashes der ersten mit, und das ist kein Versehen, sondern der Zweck:
 *
 *   Eingabe `a\b`  ->  `a\\b`  ->  `a\\\\b`  ->  PostgREST: `a\\b`  ->  ILIKE trifft `a\b`
 *   Eingabe `a%b`  ->  `a\%b`  ->  `a\\%b`  ->  PostgREST: `a\%b`  ->  ILIKE trifft `a%b`
 *
 * CodeQL meldet das als `js/double-escaping`. Die Regel erkennt zwei
 * Ersetzungen, die beide den Backslash anfassen, und kann nicht sehen, dass
 * zwischen ihnen ein Parser steht, der eine Ebene wieder abträgt. Die Tests in
 * filters.test.ts halten die Kette fest -- ohne sie wäre dieser Absatz eine
 * Behauptung.
 * ---------------------------------------------------------------------------
 */
export function quoteForFilterExpression(value: string): string {
  return value.replace(/["\\]/gu, "\\$&");
}

/** Ist überhaupt etwas gefiltert? Entscheidet über „Filter zurücksetzen". */
export function hasActiveFilters(filters: TicketFilters): boolean {
  return (
    filters.search !== "" ||
    filters.status.length > 0 ||
    filters.category !== null ||
    filters.assignee !== null ||
    filters.customer !== null
  );
}
