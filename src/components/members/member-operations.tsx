"use client";

import { useActionState, useId, useRef, useState } from "react";
import {
  anonymizeMember,
  setMemberDeactivated,
  updateMemberRole,
} from "@/actions/members";
import { MemberCustomerField } from "@/components/members/member-customer-field";
import { RoleCards } from "@/components/members/role-cards";
import { Notice } from "@/components/patterns/notice";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { type CustomerOption } from "@/lib/customers";
import { type AppRole, type FormResult } from "@/types";

/**
 * Bildschirm 17 -- Nutzer bearbeiten.
 *
 * > [!important] Drei getrennte Vorgänge, nicht ein Knopf.
 * >
 * > | Vorgang        | Wirkung                                   | Umkehrbar |
 * > | -------------- | ----------------------------------------- | --------- |
 * > | Deaktivieren   | Zugang sofort entzogen, keine Datenverluste | ja      |
 * > | Anonymisieren  | Anzeigename dauerhaft ersetzt, Protokollbezug gelöst | **nein** |
 * > | Konto löschen  | außerhalb dieser Anwendung                | —         |
 * >
 * > Jeder mit eigenem Ort, eigenem Gewicht, eigener Bestätigung. Sie in einen
 * > Knopf zu legen wäre bequem und falsch: Deaktivieren ist eine
 * > Einschränkung der Verarbeitung, Anonymisieren ein Eingriff in die Daten
 * > selbst.
 */
export function MemberOperations({
  profileId,
  displayName,
  role,
  customerId,
  customers,
  deactivatedAt,
  counts,
}: {
  readonly profileId: string;
  readonly displayName: string;
  readonly role: AppRole;
  readonly customerId: string | null;
  readonly customers: readonly CustomerOption[];
  readonly deactivatedAt: string | null;
  readonly counts: {
    readonly tickets: number;
    readonly comments: number;
    readonly timeEntries: number;
  };
}) {
  return (
    <div className="flex max-w-[34rem] flex-col gap-8">
      <RoleSection
        profileId={profileId}
        role={role}
        customerId={customerId}
        customers={customers}
      />
      <DeactivateSection
        profileId={profileId}
        isDeactivated={deactivatedAt !== null}
      />
      <AnonymizeSection
        profileId={profileId}
        displayName={displayName}
        counts={counts}
      />
      <DeleteAccountHint />
    </div>
  );
}

/**
 * Rollenwechsel gehört hierher, nicht in „Mein Profil" (Bildschirm 20).
 *
 * Rolle und Kunde stehen in **einem** Formular, weil sie in der Datenbank eine
 * Bedingung sind: `profiles_kunde_nur_beim_melder` verlangt beim Melder einen
 * Kunden und bei den übrigen Rollen keinen. Zwei getrennte Vorgänge liessen
 * einen Zwischenzustand entstehen, den die Datenbank abweist -- und der
 * Rollenwechsel scheiterte an einer Bedingung, die der Bildschirm gar nicht
 * zeigt.
 */
function RoleSection({
  profileId,
  role,
  customerId,
  customers,
}: {
  readonly profileId: string;
  readonly role: AppRole;
  readonly customerId: string | null;
  readonly customers: readonly CustomerOption[];
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    updateMemberRole,
    null,
  );
  const [gewaehlteRolle, setGewaehlteRolle] = useState<AppRole>(role);
  const failed = state !== null && !state.ok;

  return (
    <form action={formAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <h2 className="mb-3 text-xl font-bold">Rolle</h2>

      {state !== null && !state.ok ? (
        <div className="mb-3">
          <Notice kind="error">{state.error}</Notice>
        </div>
      ) : null}
      {state?.ok ? (
        <div className="mb-3">
          <Notice kind="success">Rolle geändert.</Notice>
        </div>
      ) : null}

      <RoleCards defaultValue={role} onRoleChange={setGewaehlteRolle} />

      <div className="mt-5">
        <MemberCustomerField
          visible={gewaehlteRolle === "requester"}
          customers={customers}
          defaultValue={customerId}
          error={failed ? state.fields?.["customerId"] : undefined}
        />
      </div>

      <div className="mt-4">
        <SubmitButton pendingLabel="Speichert…">Rolle speichern</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Deaktivieren -- umkehrbar und sofort wirksam.
 *
 * Der Zugang endet in derselben Sekunde, nicht erst mit dem nächsten Token:
 * `current_tenant_id()` liefert für ein deaktiviertes Profil NULL, und daran
 * hängt jede Policy. Genau das war das Argument gegen einen JWT-Claim.
 */
function DeactivateSection({
  profileId,
  isDeactivated,
}: {
  readonly profileId: string;
  readonly isDeactivated: boolean;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    setMemberDeactivated,
    null,
  );

  return (
    <form action={formAction} className="border-t border-border pt-6">
      <input type="hidden" name="profileId" value={profileId} />
      <input
        type="hidden"
        name="deactivated"
        value={isDeactivated ? "nein" : "ja"}
      />

      <h2 className="mb-2 text-xl font-bold">
        {isDeactivated ? "Wieder aktivieren" : "Deaktivieren"}
      </h2>
      <p className="mb-3 text-base leading-[1.55] text-body">
        {isDeactivated
          ? "Der Zugang wird sofort wieder möglich. Tickets, Kommentare und Buchungen waren nie betroffen."
          : "Der Zugang endet sofort — in derselben Sekunde, nicht erst mit der nächsten Anmeldung. Es gehen keine Daten verloren, und der Schritt lässt sich jederzeit zurücknehmen."}
      </p>

      {state !== null && !state.ok ? (
        <div className="mb-3">
          <Notice kind="error">{state.error}</Notice>
        </div>
      ) : null}

      <SubmitButton
        pendingLabel={isDeactivated ? "Aktiviert…" : "Deaktiviert…"}
        variant="secondary"
      >
        {isDeactivated ? "Wieder aktivieren" : "Zugang deaktivieren"}
      </SubmitButton>
    </form>
  );
}

/**
 * Anonymisieren -- dauerhaft, mit getippter Bestätigung.
 *
 * > [!important] Der Text nennt den tatsächlichen Ersatznamen.
 * > Ein Dialog, der etwas anderes ankündigt als geschieht, wäre genau die
 * > Sorte Zusage, die dieses Projekt vermeidet. Maßgeblich ist die Datenbank:
 * > `anonymize_profile` setzt `Anonymisierter Nutzer`
 * > (`20260824000000_ersatzname_anonymisiert.sql`). Wird der Wert dort
 * > geändert, gehört diese Zeile mit geändert -- eine Prüfung, die das
 * > erzwingt, gibt es nicht.
 */
function AnonymizeSection({
  profileId,
  displayName,
  counts,
}: {
  readonly profileId: string;
  readonly displayName: string;
  readonly counts: {
    readonly tickets: number;
    readonly comments: number;
    readonly timeEntries: number;
  };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    anonymizeMember,
    null,
  );
  const confirmId = useId();
  const failed = state !== null && !state.ok;

  return (
    <section className="border-t border-border pt-6">
      <h2 className="mb-2 text-xl font-bold">Anonymisieren</h2>
      <p className="mb-3 text-base leading-[1.55] text-body">
        Der Anzeigename wird dauerhaft ersetzt und die Zuordnung im Protokoll
        gelöst. Die Beiträge selbst bleiben — ohne Namensbezug, aber mit ihrem
        Freitext.{" "}
        <strong className="font-semibold">
          Das lässt sich nicht zurücknehmen.
        </strong>
      </p>

      <Button
        variant="destructive"
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        Anonymisieren
      </Button>

      <dialog
        ref={dialog}
        aria-labelledby={`${confirmId}-titel`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 shadow-lg backdrop:bg-overlay"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <h3
          id={`${confirmId}-titel`}
          className="text-xl leading-[26px] font-bold"
        >
          {displayName} anonymisieren?
        </h3>

        <p className="mt-2.5 text-base leading-[1.55] text-body">
          Der Anzeigename wird dauerhaft durch{" "}
          <span className="font-mono">Anonymisierter Nutzer</span> ersetzt und
          die Zuordnung im Protokoll gelöst.{" "}
          <strong className="font-semibold">
            Das lässt sich nicht zurücknehmen.
          </strong>
        </p>

        <p className="mt-2.5 text-[12.5px] leading-[1.55] text-muted">
          Erhalten bleiben: {counts.tickets}{" "}
          {counts.tickets === 1 ? "Ticket" : "Tickets"}, {counts.comments}{" "}
          {counts.comments === 1 ? "Kommentar" : "Kommentare"},{" "}
          {counts.timeEntries}{" "}
          {counts.timeEntries === 1 ? "Zeitbuchung" : "Zeitbuchungen"} — ohne
          Namensbezug. Freitexte in Beschreibungen und Kommentaren bleiben
          unverändert und können weiterhin Namen enthalten. Die E-Mail-Adresse
          liegt in der Anmeldung und ist gesondert zu löschen.
        </p>

        <form action={formAction} className="mt-5">
          <input type="hidden" name="profileId" value={profileId} />

          <Field
            id={confirmId}
            label="Zur Bestätigung „anonymisieren“ tippen"
            error={
              failed
                ? (state.fields?.["confirmation"] ?? state.error)
                : undefined
            }
          >
            <TextInput
              id={confirmId}
              name="confirmation"
              autoComplete="off"
              placeholder="anonymisieren"
              invalid={failed}
            />
          </Field>

          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Abbrechen
            </Button>
            <SubmitButton pendingLabel="Anonymisiert…" variant="destructive">
              Anonymisieren
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </section>
  );
}

/**
 * Die dritte Abstufung -- und bewusst **kein Knopf**.
 *
 * Das Löschen des Anmeldekontos geschieht beim Betreiber der Instanz. Der
 * Hinweis steht trotzdem hier, damit die Abstufung vollständig ist: Wer nur
 * „Deaktivieren" und „Anonymisieren" sieht, hält eines davon für das
 * endgültige Löschen -- und keines von beiden ist es.
 */
function DeleteAccountHint() {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="mb-2 text-xl font-bold">Konto löschen</h2>
      <p className="text-base leading-[1.55] text-muted">
        Geschieht außerhalb dieser Anwendung, beim Betreiber der Instanz. Hier
        gibt es dafür bewusst keinen Knopf — nur diesen Hinweis, damit die
        Abstufung vollständig ist.
      </p>
    </section>
  );
}
