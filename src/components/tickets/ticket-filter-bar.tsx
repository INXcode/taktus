import Link from "next/link";
import { AutoSubmitSelect } from "@/components/ui/auto-submit-select";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { type CustomerOption } from "@/lib/customers";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/labels/category";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/labels/status";
import { shortName } from "@/lib/format/name";
import { paths } from "@/lib/paths";
import {
  SORT_OPTIONS,
  filtersToQuery,
  hasActiveFilters,
  type SortKey,
  type TicketFilters,
} from "@/lib/tickets/filters";

export type AssigneeOption = {
  readonly id: string;
  readonly displayName: string;
};

/**
 * Das Filterband aus Bildschirm 6.
 *
 * Ein `<form method="get">` mit nativen Auswahlfeldern. Die Filter landen
 * damit in der Adresse: teilbar, mit funktionierendem Zurück-Knopf, und wer
 * die Seite ohne Skripte lädt, kann trotzdem filtern -- der Knopf „Suchen"
 * schickt das Formular auch dann ab.
 *
 * Die Auswahlfelder lösen darüber hinaus sofort aus (`AutoSubmitSelect`).
 * Eine Auswahl aus einer festen Liste ist bereits die Entscheidung; sie
 * anschliessend noch bestätigen zu lassen, ist ein Handgriff ohne Frage
 * dahinter. Das Freitextfeld dagegen behält seinen Knopf: Beim Tippen weiss
 * nur der Nutzer selbst, wann die Eingabe fertig ist.
 *
 * **Kein Prioritätsfilter, keine Ampel, keine „überfällig"-Marke.** Es gibt
 * keine Priorität im Datenmodell (docs/datenmodell.md: „Ohne Auswertung, die
 * sie nutzt, sind das Felder ‚für später'"), und ein Filter über ein Feld,
 * das es nicht gibt, wäre eine Zusage ohne Deckung.
 */
export function TicketFilterBar({
  filters,
  assignees,
  customers,
}: {
  readonly filters: TicketFilters;
  readonly assignees: readonly AssigneeOption[];
  readonly customers: readonly CustomerOption[];
}) {
  return (
    <div className="mt-5">
      <form
        method="get"
        action={paths.tickets}
        className="flex flex-wrap items-end gap-3"
      >
        {/*
          Der Knopf steht hinter dem Feld, zu dem er gehört, und nicht mehr am
          Ende der Reihe: Er wendet nicht mehr das ganze Band an, sondern
          schickt die Sucheingabe ab -- die übrigen Filter lösen selbst aus.

          `items-stretch` statt einer festen Höhe. Ein Knopf ist sonst 40 px
          hoch, ein Eingabefeld 46 (22 px Zeilenhöhe, zweimal 11 px Innenabstand,
          2 px Rahmen); nebeneinander sah der Knopf geschrumpft aus. Gestreckt
          folgt er der Höhe des Feldes, ohne dass irgendwo eine zweite Zahl
          steht, die beim nächsten Eingriff auseinanderläuft.
        */}
        <div className="min-w-[18rem] flex-1">
          <label
            htmlFor="filter-suche"
            className="mb-1.5 block text-sm font-semibold text-field-label"
          >
            Suche
          </label>
          <div className="flex items-stretch gap-2">
            <TextInput
              id="filter-suche"
              name="suche"
              type="search"
              defaultValue={filters.search}
              placeholder="Titel oder Nummer suchen"
              // `flex-1 min-w-0` statt der `w-full` aus dem Feld: In einer
              // Reihe mit dem Knopf müsste das Feld sonst 100 % breit sein und
              // schöbe ihn hinaus.
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              Suchen
            </Button>
          </div>
        </div>

        {/*
          Mehrfachauswahl über ein `<select multiple>` wäre nativ, aber auf
          Mobil kaum bedienbar. Der Status ist deshalb eine Einfachauswahl;
          mehrere Werte kommen weiterhin über die Adresse hinein und bleiben
          als entfernbare Marken sichtbar.
        */}
        <FilterSelect
          id="filter-status"
          name="status"
          label="Status"
          value={filters.status[0] ?? ""}
          options={STATUS_ORDER.map((status) => ({
            value: status,
            label: STATUS_LABEL[status],
          }))}
        />

        <FilterSelect
          id="filter-kategorie"
          name="kategorie"
          label="Kategorie"
          value={filters.category ?? ""}
          options={CATEGORY_ORDER.map((category) => ({
            value: category,
            label: CATEGORY_LABEL[category],
          }))}
        />

        {/*
          Kein „ohne Kunde": Jedes Ticket hat einen, die Spalte ist NOT NULL.
          Ein stillgelegter Kunde steht weiterhin zur Auswahl -- an ihm hängen
          Tickets, und wer sie sucht, muss ihn wählen können.
        */}
        <FilterSelect
          id="filter-kunde"
          name="kunde"
          label="Kunde"
          value={filters.customer ?? ""}
          options={customers.map((customer) => ({
            value: customer.id,
            label: customer.isActive
              ? customer.name
              : `${customer.name} (stillgelegt)`,
          }))}
        />

        <FilterSelect
          id="filter-zuweisung"
          name="zuweisung"
          label="Zuweisung"
          value={filters.assignee ?? ""}
          options={[
            { value: "none", label: "nicht zugewiesen" },
            ...assignees.map((person) => ({
              value: person.id,
              label: shortName(person.displayName),
            })),
          ]}
        />

        <div>
          <label
            htmlFor="filter-sortierung"
            className="mb-1.5 block text-sm font-semibold text-field-label"
          >
            Sortierung
          </label>
          <AutoSubmitSelect
            id="filter-sortierung"
            name="sortierung"
            defaultValue={filters.sort}
            className="min-w-[11rem]"
          >
            {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_OPTIONS[key].label}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>

        {hasActiveFilters(filters) ? (
          <Link
            href={paths.tickets}
            data-variant="ghost"
            className="inline-flex min-h-[var(--size-control)] items-center rounded-md px-3 text-base font-semibold text-primary no-underline hover:bg-primary-soft hover:no-underline"
          >
            Filter zurücksetzen
          </Link>
        ) : null}
      </form>

      <ActiveFilterChips
        filters={filters}
        assignees={assignees}
        customers={customers}
      />
    </div>
  );
}

function FilterSelect({
  id,
  name,
  label,
  value,
  options,
}: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-field-label"
      >
        {label}
      </label>
      <AutoSubmitSelect
        id={id}
        name={name}
        defaultValue={value}
        className="min-w-[10rem]"
      >
        <option value="">alle</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </AutoSubmitSelect>
    </div>
  );
}

/**
 * Die gesetzten Filter als entfernbare Marken.
 *
 * Jede Marke ist ein Verweis, der genau einen Parameter fallen lässt -- kein
 * Skript, kein Zustand. So bleibt auch nach mehreren Filtern ablesbar, was
 * gerade eingeschränkt ist; die Zahl „7 von 24" allein sagt das nicht.
 */
function ActiveFilterChips({
  filters,
  assignees,
  customers,
}: {
  readonly filters: TicketFilters;
  readonly assignees: readonly AssigneeOption[];
  readonly customers: readonly CustomerOption[];
}) {
  const chips: { key: string; label: string; href: string }[] = [];

  if (filters.search !== "") {
    chips.push({
      key: "suche",
      label: `Suche: ${filters.search}`,
      href: `${paths.tickets}${filtersToQuery(filters, { search: "" })}`,
    });
  }

  if (filters.status.length > 0) {
    chips.push({
      key: "status",
      label: `Status: ${filters.status.map((s) => STATUS_LABEL[s]).join(", ")}`,
      href: `${paths.tickets}${filtersToQuery(filters, { status: [] })}`,
    });
  }

  if (filters.category !== null) {
    chips.push({
      key: "kategorie",
      label: `Kategorie: ${CATEGORY_LABEL[filters.category]}`,
      href: `${paths.tickets}${filtersToQuery(filters, { category: null })}`,
    });
  }

  if (filters.customer !== null) {
    const customer = customers.find((entry) => entry.id === filters.customer);
    chips.push({
      key: "kunde",
      // „unbekannt" statt einer Kennung: Sie stünde für einen Kunden, den
      // dieser Mandant nicht hat -- der Name wäre eine Erfindung.
      label: `Kunde: ${customer?.name ?? "unbekannt"}`,
      href: `${paths.tickets}${filtersToQuery(filters, { customer: null })}`,
    });
  }

  if (filters.assignee !== null) {
    const person = assignees.find((entry) => entry.id === filters.assignee);
    chips.push({
      key: "zuweisung",
      label: `Zuweisung: ${
        filters.assignee === "none"
          ? "nicht zugewiesen"
          : (person?.displayName ?? "unbekannt")
      }`,
      href: `${paths.tickets}${filtersToQuery(filters, { assignee: null })}`,
    });
  }

  if (chips.length === 0) return null;

  return (
    <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Link
            href={chip.href}
            className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary-text no-underline hover:no-underline"
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
