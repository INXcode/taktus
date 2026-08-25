"use client";

import { useActionState, useId } from "react";
import { updateTicketMeta } from "@/actions/tickets";
import { Notice } from "@/components/patterns/notice";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { type CustomerOption } from "@/lib/customers";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/labels/category";
import { STATUS_LABEL, STATUS_ORDER } from "@/lib/labels/status";
import {
  type TicketCategory,
  type TicketStatus,
  type FormResult,
} from "@/types";

export type AssigneeChoice = {
  readonly id: string;
  readonly displayName: string;
};

/**
 * Die rechte Spalte aus Bildschirm 9 -- die Verwaltung des Tickets.
 *
 * Ein Formular mit ausdrücklichem „Speichern", **kein** Absenden bei jeder
 * Änderung. Zwei Gründe: Ein automatisches Absenden feuerte mitten in der
 * Tastaturbedienung, sobald jemand mit den Pfeiltasten durch eine Auswahl
 * geht -- und drei Einzelvorgänge erzeugten drei Protokolleinträge, wo einer
 * richtig ist.
 */
export function TicketSideRail({
  ticketId,
  status,
  category,
  customerId,
  customers,
  assigneeId,
  assignees,
}: {
  readonly ticketId: string;
  readonly status: TicketStatus;
  readonly category: TicketCategory;
  readonly customerId: string;
  readonly customers: readonly CustomerOption[];
  readonly assigneeId: string | null;
  readonly assignees: readonly AssigneeChoice[];
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    updateTicketMeta,
    null,
  );

  const statusId = useId();
  const categoryId = useId();
  const customerSelectId = useId();
  const assigneeSelectId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="ticketId" value={ticketId} />

      {state !== null && !state.ok ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}
      {state?.ok ? <Notice kind="success">Gespeichert.</Notice> : null}

      <div>
        <label
          htmlFor={statusId}
          className="mb-1.5 block text-sm font-semibold text-field-label"
        >
          Status
        </label>
        <Select id={statusId} name="status" defaultValue={status}>
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label
          htmlFor={categoryId}
          className="mb-1.5 block text-sm font-semibold text-field-label"
        >
          Kategorie
        </label>
        <Select id={categoryId} name="category" defaultValue={category}>
          {CATEGORY_ORDER.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>

      {/*
        Der Kunde ist nachträglich änderbar -- eine Fehlzuordnung beim Anlegen
        wäre sonst dauerhaft. Ein stillgelegter Kunde bleibt in der Auswahl,
        solange dieses Ticket an ihm hängt: Sonst stünde das Feld auf einem
        Wert, den es scheinbar nicht gibt, und das nächste Speichern setzte ihn
        stillschweigend um.
      */}
      <div>
        <label
          htmlFor={customerSelectId}
          className="mb-1.5 block text-sm font-semibold text-field-label"
        >
          Kunde
        </label>
        <Select
          id={customerSelectId}
          name="customerId"
          defaultValue={customerId}
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.isActive
                ? customer.name
                : `${customer.name} (stillgelegt)`}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label
          htmlFor={assigneeSelectId}
          className="mb-1.5 block text-sm font-semibold text-field-label"
        >
          Zuweisung
        </label>
        <Select
          id={assigneeSelectId}
          name="assigneeId"
          defaultValue={assigneeId ?? ""}
        >
          <option value="">nicht zugewiesen</option>
          {assignees.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </Select>
      </div>

      <SubmitButton pendingLabel="Speichert…" variant="primary" fullWidth>
        Speichern
      </SubmitButton>

      <p className="text-[12.5px] leading-[1.5] text-muted">
        Änderungen greifen sofort und werden im Protokoll mit dem Feldnamen
        vermerkt — ohne den Inhalt.
      </p>
    </form>
  );
}
