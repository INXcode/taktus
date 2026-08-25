"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { createCustomer } from "@/actions/customers";
import { Notice } from "@/components/patterns/notice";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { paths } from "@/lib/paths";
import { CUSTOMER_NAME_MAX } from "@/lib/validation/customer";
import { type FormResult } from "@/types";

/**
 * Bildschirm 27 -- Kunde anlegen.
 *
 * Ein Feld. Das ist kein unfertiger Bildschirm, sondern der Umfang: Ein Kunde
 * trägt einen Namen und ein Aktiv-Kennzeichen, und das Kennzeichen steht beim
 * Anlegen fest auf „aktiv". Anschrift, Rufnummer und Ansprechpartner gibt es
 * bewusst nicht -- ein Kunde ist hier eine Zuordnung, keine Adresskartei.
 */
export function CreateCustomerForm() {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    createCustomer,
    null,
  );
  const nameId = useId();
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction} className="flex max-w-[34rem] flex-col gap-5">
      {failed && state.fields === undefined ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}

      <Field
        id={nameId}
        label="Name"
        hint={`1–${CUSTOMER_NAME_MAX} Zeichen. Erscheint an jedem Vorgang dieses Kunden.`}
        error={failed ? state.fields?.["name"] : undefined}
      >
        <TextInput
          id={nameId}
          name="name"
          maxLength={CUSTOMER_NAME_MAX}
          autoFocus
          invalid={failed && state.fields?.["name"] !== undefined}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Legt an…">Kunde anlegen</SubmitButton>
        <Link
          href={paths.customers}
          className="no-underline hover:no-underline"
        >
          <Button variant="secondary" type="button">
            Abbrechen
          </Button>
        </Link>
      </div>

      <p className="text-[12.5px] leading-[1.5] text-muted">
        Der Name muss innerhalb dieses Mandanten eindeutig sein — zwei
        gleichnamige Kunden wären in keiner Auswahlliste zu unterscheiden.
      </p>
    </form>
  );
}
