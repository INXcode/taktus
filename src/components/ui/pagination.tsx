import Link from "next/link";

/**
 * Blätterung, 25 Zeilen je Seite.
 *
 * Als Verweise, nicht als Knöpfe: Die Seitenzahl gehört in die Adresse, damit
 * sie sich teilen lässt, der Zurück-Knopf des Browsers stimmt und die Liste
 * ohne JavaScript blätterbar bleibt. Der aktuelle Eintrag ist deshalb kein
 * Verweis, sondern Text -- ein Link auf die Seite, auf der man steht, ist für
 * die Tastatur nur ein Halt mehr.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefForPage,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly total: number;
  readonly pageSize: number;
  readonly hrefForPage: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const base =
    "rounded-md px-3 py-2 text-sm no-underline hover:no-underline min-h-[var(--size-control)] inline-flex items-center justify-center";

  return (
    <nav
      aria-label="Blätterung"
      className="flex flex-wrap items-center gap-2 pt-4"
    >
      {page > 1 ? (
        <Link
          href={hrefForPage(page - 1)}
          rel="prev"
          className={`${base} border border-border-strong bg-card text-body`}
        >
          Zurück
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={`${base} border border-border bg-card text-text-disabled`}
        >
          Zurück
        </span>
      )}

      {pages.map((candidate) =>
        candidate === page ? (
          <span
            key={candidate}
            aria-current="page"
            className={`${base} min-w-[38px] bg-primary font-semibold text-on-primary`}
          >
            {candidate}
          </span>
        ) : (
          <Link
            key={candidate}
            href={hrefForPage(candidate)}
            aria-label={`Seite ${candidate}`}
            className={`${base} min-w-[38px] border border-border-strong bg-card text-body`}
          >
            {candidate}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={hrefForPage(page + 1)}
          rel="next"
          className={`${base} border border-border-strong bg-card text-body`}
        >
          Weiter
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={`${base} border border-border bg-card text-text-disabled`}
        >
          Weiter
        </span>
      )}

      <span className="ml-2 text-[12.5px] text-muted">
        {total} {total === 1 ? "Zeile" : "Zeilen"}, {pageSize} je Seite
      </span>
    </nav>
  );
}
