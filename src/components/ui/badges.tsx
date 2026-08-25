import { CATEGORY_LABEL, CATEGORY_SQUARE } from "@/lib/labels/category";
import { ROLE_LABEL } from "@/lib/labels/role";
import { STATUS_CLASSES, STATUS_LABEL } from "@/lib/labels/status";
import { type AppRole, type TicketCategory, type TicketStatus } from "@/types";

/**
 * Status als farbige Pille mit rundem Punkt.
 *
 * Der Punkt ist rund, das Quadrat der Kategorie ist eckig -- und das ist der
 * ganze Trick: Zwei Ebenen, die sich nie überstimmen, weil sie sich in der
 * Form unterscheiden und nicht nur in der Farbe. Wer farbenblind ist, liest
 * trotzdem beides auseinander.
 */
export function StatusPill({ status }: { readonly status: TicketStatus }) {
  const classes = STATUS_CLASSES[status];

  return (
    <span
      className={`inline-flex items-center gap-[7px] rounded-full px-[11px] py-1 text-[12.5px] font-semibold ${classes.pill}`}
    >
      <span
        aria-hidden="true"
        className={`size-[7px] shrink-0 rounded-full ${classes.dot}`}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Kategorie als gedecktes Quadrat auf neutraler Fläche.
 *
 * Immer dieselbe Fläche, immer dieselbe Textfarbe -- nur das Quadrat wechselt.
 */
export function CategoryChip({
  category,
}: {
  readonly category: TicketCategory;
}) {
  return (
    <span className="inline-flex items-center gap-[7px] rounded-sm border border-border bg-subtle px-2.5 py-1 text-[12.5px] text-field-label">
      <span
        aria-hidden="true"
        className={`size-[7px] shrink-0 ${CATEGORY_SQUARE[category]}`}
      />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

const ROLE_CLASSES = {
  admin: "bg-primary-soft text-primary-text border-role-border",
  agent: "bg-muted-surface text-field-label border-border",
  requester: "bg-card text-muted border-border",
} as const satisfies Record<AppRole, string>;

/** Rollenmarke in Mono -- sie benennt eine Einstufung, keinen Fließtext. */
export function RoleBadge({ role }: { readonly role: AppRole }) {
  return (
    <span
      className={`inline-flex rounded-sm border px-2.5 py-[3px] font-mono text-[11.5px] font-medium ${ROLE_CLASSES[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
