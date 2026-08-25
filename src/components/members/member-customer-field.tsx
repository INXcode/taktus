"use client";

import { useId } from "react";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { type CustomerOption } from "@/lib/customers";

/**
 * Die Kundenzuordnung eines Nutzers -- Bildschirme 16 und 17.
 *
 * Sichtbar **nur bei der Rolle „Melder"**, und das ist keine Bequemlichkeit:
 * Ein Melder gehört zu genau einem Kunden, Bearbeitung und Verwaltung hängen
 * am Mandanten und arbeiten quer über alle. Die Datenbank hält beide
 * Richtungen als `CHECK` fest; das Feld hier bildet ihn nach, damit die
 * Meldung am Feld erscheint und nicht erst nach dem Absenden.
 *
 * Wird das Feld ausgeblendet, verschwindet auch sein Wert aus dem `FormData`
 * -- ein nicht gerendertes `<select>` sendet nichts. Genau das ist gewollt:
 * Eine Rolle ohne Kundenbindung darf keinen Kunden mitschicken.
 */
export function MemberCustomerField({
  visible,
  customers,
  defaultValue,
  error,
}: {
  readonly visible: boolean;
  readonly customers: readonly CustomerOption[];
  readonly defaultValue?: string | null;
  readonly error?: string | undefined;
}) {
  const id = useId();

  if (!visible) return null;

  if (customers.length === 0) {
    return (
      <p className="max-w-[34rem] rounded-md border border-border-strong bg-subtle p-3.5 text-sm leading-[1.5] text-body">
        Dieser Mandant hat noch keinen aktiven Kunden. Ein Melder gehört zu
        genau einem Kunden — legen Sie zuerst einen an.
      </p>
    );
  }

  return (
    <Field
      id={id}
      label="Kunde"
      hint="Für wen dieser Nutzer Vorgänge meldet."
      error={error}
    >
      <Select
        id={id}
        name="customerId"
        defaultValue={defaultValue ?? ""}
        invalid={error !== undefined}
      >
        <option value="" disabled>
          bitte wählen
        </option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.isActive
              ? customer.name
              : `${customer.name} (stillgelegt)`}
          </option>
        ))}
      </Select>
    </Field>
  );
}
