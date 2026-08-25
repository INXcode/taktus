import Link from "next/link";
import { Select } from "@/components/ui/select";
import {
  PERIODS,
  auditFiltersToQuery,
  hasActiveAuditFilters,
  type AuditFilters,
  type PeriodKey,
} from "@/lib/audit/filters";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/labels/audit";
import { paths } from "@/lib/paths";

/**
 * Das Filterband aus Bildschirm 19.
 *
 * Bauart wie das der Ticketliste: ein `<form method="get">` mit nativen
 * Auswahlfeldern, dahinter die gesetzten Filter als entfernbare Marken. Zwei
 * Listen mit demselben Zweck sollten sich nicht unterschiedlich bedienen
 * lassen -- und beide funktionieren so ohne eine Zeile JavaScript.
 *
 * Aktion und Objektart stehen **unübersetzt** in der Auswahl. Es sind die
 * Werte, die in der Datenbank stehen und in der Zeile erscheinen; eine
 * deutsche Beschriftung im Filter und eine englische in der Zeile wären zwei
 * Vokabulare für dieselbe Sache.
 */
export function AuditFilterBar({
  filters,
}: {
  readonly filters: AuditFilters;
}) {
  return (
    <div className="mb-4">
      <form
        method="get"
        action={paths.auditLog}
        className="flex flex-wrap items-end gap-2.5"
      >
        <div>
          <label
            htmlFor="filter-zeitraum"
            className="mb-1.5 block text-sm font-semibold text-field-label"
          >
            Zeitraum
          </label>
          <Select
            id="filter-zeitraum"
            name="zeitraum"
            defaultValue={filters.period}
            className="min-w-[11rem]"
          >
            {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
              <option key={key} value={key}>
                {PERIODS[key].label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="filter-aktion"
            className="mb-1.5 block text-sm font-semibold text-field-label"
          >
            Aktion
          </label>
          <Select
            id="filter-aktion"
            name="aktion"
            defaultValue={filters.action ?? ""}
            className="min-w-[11rem] font-mono text-sm"
          >
            <option value="">alle</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor="filter-objektart"
            className="mb-1.5 block text-sm font-semibold text-field-label"
          >
            Objektart
          </label>
          <Select
            id="filter-objektart"
            name="objektart"
            defaultValue={filters.entityType ?? ""}
            className="min-w-[10rem] font-mono text-sm"
          >
            <option value="">alle</option>
            {AUDIT_ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityType}
              </option>
            ))}
          </Select>
        </div>

        <button
          type="submit"
          data-variant="secondary"
          className="min-h-[var(--size-control)] rounded-md border border-border-strong bg-card px-4 text-base font-semibold text-body hover:border-primary hover:bg-subtle"
        >
          Anwenden
        </button>

        {hasActiveAuditFilters(filters) ? (
          <Link
            href={paths.auditLog}
            data-variant="ghost"
            className="inline-flex min-h-[var(--size-control)] items-center rounded-md px-3 text-base font-semibold text-primary no-underline hover:bg-primary-soft hover:no-underline"
          >
            Filter zurücksetzen
          </Link>
        ) : null}
      </form>

      <ActiveChips filters={filters} />
    </div>
  );
}

/** Jede Marke ist ein Verweis, der genau einen Parameter fallen lässt. */
function ActiveChips({ filters }: { readonly filters: AuditFilters }) {
  const chips: { key: string; label: string; href: string; mono: boolean }[] =
    [];

  if (filters.action !== null) {
    chips.push({
      key: "aktion",
      label: `Aktion: ${filters.action}`,
      href: `${paths.auditLog}${auditFiltersToQuery(filters, { action: null })}`,
      mono: true,
    });
  }

  if (filters.entityType !== null) {
    chips.push({
      key: "objektart",
      label: `Objektart: ${filters.entityType}`,
      href: `${paths.auditLog}${auditFiltersToQuery(filters, { entityType: null })}`,
      mono: true,
    });
  }

  if (chips.length === 0) return null;

  return (
    <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.href}
            className={`inline-flex items-center gap-2 rounded-md border border-primary bg-primary-soft px-3 py-1.5 font-semibold text-primary-text no-underline hover:no-underline ${
              chip.mono ? "font-mono text-[12.5px]" : "text-sm"
            }`}
          >
            {chip.label}
            <span aria-hidden="true" className="text-xs">
              ✕
            </span>
            <span className="sr-only">Filter entfernen</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
