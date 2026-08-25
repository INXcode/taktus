"use client";

import { useActionState, useId } from "react";
import { setCustomerActive, updateCustomer } from "@/actions/customers";
import { Notice } from "@/components/patterns/notice";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CUSTOMER_NAME_MAX } from "@/lib/validation/customer";
import { type FormResult } from "@/types";

/**
 * Bildschirm 28 -- Kunde bearbeiten.
 *
 * Zwei getrennte Vorgänge, wie bei den Nutzern: Umbenennen ist eine
 * Berichtigung, Stilllegen eine Entscheidung über künftige Vorgänge. In einem
 * Formular vermischten sich beide, und ein Tippfehler im Namen legte den
 * Kunden mit still.
 *
 * **Kein Löschen.** An einem Kunden hängen Vorgänge; verschwände er, verlören
 * sie ihre Zuordnung, und die Aufbewahrungsfrist liefe an Zeilen ab, die
 * niemand mehr einordnen kann. Es gibt für `customers` deshalb keine
 * DELETE-Policy — der Knopf fehlt nicht, er ist nicht vorgesehen.
 */
export function CustomerOperations({
  customerId,
  name,
  isActive,
  ticketCount,
  memberCount,
}: {
  readonly customerId: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly ticketCount: number;
  readonly memberCount: number;
}) {
  return (
    <div className="flex max-w-[34rem] flex-col gap-8">
      <NameSection customerId={customerId} name={name} />
      <ActiveSection
        customerId={customerId}
        isActive={isActive}
        ticketCount={ticketCount}
        memberCount={memberCount}
      />
    </div>
  );
}

function NameSection({
  customerId,
  name,
}: {
  readonly customerId: string;
  readonly name: string;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    updateCustomer,
    null,
  );
  const nameId = useId();
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <h2 className="mb-3 text-xl font-bold">Name</h2>

      {failed && state.fields === undefined ? (
        <div className="mb-3">
          <Notice kind="error">{state.error}</Notice>
        </div>
      ) : null}
      {state?.ok ? (
        <div className="mb-3">
          <Notice kind="success">Gespeichert.</Notice>
        </div>
      ) : null}

      <Field
        id={nameId}
        label="Name"
        error={failed ? state.fields?.["name"] : undefined}
      >
        <TextInput
          id={nameId}
          name="name"
          defaultValue={name}
          maxLength={CUSTOMER_NAME_MAX}
          invalid={failed && state.fields?.["name"] !== undefined}
        />
      </Field>

      <div className="mt-4">
        <SubmitButton pendingLabel="Speichert…">Namen speichern</SubmitButton>
      </div>

      <p className="mt-3 text-[12.5px] leading-[1.5] text-muted">
        Der neue Name erscheint an allen bestehenden Vorgängen dieses Kunden —
        es gibt keine zweite, historische Fassung.
      </p>
    </form>
  );
}

/**
 * Stilllegen -- umkehrbar, und ausdrücklich keine Löschung.
 *
 * Der Kunde verschwindet aus jeder Auswahlliste; seine Vorgänge bleiben
 * unverändert sichtbar und weiterhin bearbeitbar. Das ist der Unterschied zum
 * Löschen, und der Text sagt ihn, statt ihn vorauszusetzen.
 */
function ActiveSection({
  customerId,
  isActive,
  ticketCount,
  memberCount,
}: {
  readonly customerId: string;
  readonly isActive: boolean;
  readonly ticketCount: number;
  readonly memberCount: number;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    setCustomerActive,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="active" value={isActive ? "nein" : "ja"} />
      <h2 className="mb-3 text-xl font-bold">Zustand</h2>

      {state !== null && !state.ok ? (
        <div className="mb-3">
          <Notice kind="error">{state.error}</Notice>
        </div>
      ) : null}
      {state?.ok ? (
        <div className="mb-3">
          <Notice kind="success">
            {isActive ? "Stillgelegt." : "Wieder aufgenommen."}
          </Notice>
        </div>
      ) : null}

      <p className="mb-4 text-base leading-[1.6] text-body">
        {isActive ? (
          <>
            Dieser Kunde ist <strong>aktiv</strong>. Stillgelegt verschwindet er
            aus der Auswahl beim Anlegen von Tickets und Nutzern. Seine{" "}
            {ticketCount} {ticketCount === 1 ? "Vorgang" : "Vorgänge"} und{" "}
            {memberCount} {memberCount === 1 ? "Melder" : "Melder"} bleiben
            unverändert bestehen.
          </>
        ) : (
          <>
            Dieser Kunde ist <strong>stillgelegt</strong>. Neue Vorgänge lassen
            sich nicht auf ihn anlegen. Seine {ticketCount}{" "}
            {ticketCount === 1 ? "Vorgang" : "Vorgänge"} bleiben sichtbar und
            bearbeitbar.
          </>
        )}
      </p>

      <SubmitButton
        pendingLabel={isActive ? "Legt still…" : "Nimmt auf…"}
        variant="secondary"
      >
        {isActive ? "Stilllegen" : "Wieder aufnehmen"}
      </SubmitButton>
    </form>
  );
}
