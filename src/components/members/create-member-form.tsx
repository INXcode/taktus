"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { createMember } from "@/actions/members";
import { MemberCustomerField } from "@/components/members/member-customer-field";
import { RoleCards } from "@/components/members/role-cards";
import { Notice } from "@/components/patterns/notice";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { type CustomerOption } from "@/lib/customers";
import { paths } from "@/lib/paths";
import { DISPLAY_NAME_MAX } from "@/lib/validation/profile";
import { type AppRole, type FormResult } from "@/types";

/** Bildschirm 16 -- Nutzer anlegen. */
export function CreateMemberForm({
  customers,
}: {
  readonly customers: readonly CustomerOption[];
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    createMember,
    null,
  );
  const nameId = useId();
  const emailId = useId();
  // Die Vorgabe der Rollenauswahl ist „Melder", also steht das Kundenfeld von
  // Anfang an da -- sonst erschiene es erst nach einem Klick auf die bereits
  // gewählte Karte.
  const [role, setRole] = useState<AppRole>("requester");
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction} className="flex max-w-[34rem] flex-col gap-5">
      {failed && state.fields === undefined ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}

      <Field
        id={nameId}
        label="Anzeigename"
        hint={`1–${DISPLAY_NAME_MAX} Zeichen. Erscheint in Listen, Kommentaren und im Protokoll.`}
        error={failed ? state.fields?.["displayName"] : undefined}
      >
        <TextInput
          id={nameId}
          name="displayName"
          maxLength={DISPLAY_NAME_MAX}
          autoFocus
          invalid={failed && state.fields?.["displayName"] !== undefined}
        />
      </Field>

      <Field
        id={emailId}
        label="E-Mail"
        hint="Wird für die Anmeldung gespeichert, nicht im Profil."
        error={failed ? state.fields?.["email"] : undefined}
      >
        <TextInput
          id={emailId}
          name="email"
          type="email"
          autoComplete="off"
          invalid={failed && state.fields?.["email"] !== undefined}
        />
      </Field>

      <RoleCards onRoleChange={setRole} />

      <MemberCustomerField
        visible={role === "requester"}
        customers={customers}
        error={failed ? state.fields?.["customerId"] : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Legt an…">
          Anlegen und einladen
        </SubmitButton>
        <Link href={paths.members} className="no-underline hover:no-underline">
          <Button variant="secondary" type="button">
            Abbrechen
          </Button>
        </Link>
      </div>

      <p className="text-[12.5px] leading-[1.5] text-muted">
        Es wird kein Passwort vergeben. Der Nutzer bekommt eine Einladung und
        setzt es selbst — ein Passwort, das jemand anders kennt, ist keines.
      </p>
    </form>
  );
}
