"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { createTicket, updateTicketContent } from "@/actions/tickets";
import { Notice } from "@/components/patterns/notice";
import { AiSuggest } from "@/components/tickets/ai-suggest";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { type CustomerOption } from "@/lib/customers";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/labels/category";
import { paths } from "@/lib/paths";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/validation/ticket";
import { type FormResult, type TicketCategory } from "@/types";

export type AssigneeChoice = {
  readonly id: string;
  readonly displayName: string;
};

/**
 * Bildschirm 8 „Ticket anlegen" und das Bearbeiten von Titel und Beschreibung.
 *
 * > [!important] Der KI-Bereich zeigt im Normalfall **nichts**.
 * > `ai_enabled` steht bei jedem Mandanten per Vorgabe auf `false`, und für
 * > diesen Fall verlangt der Entwurf ein Formular ohne Lücke, ohne leeren
 * > Kasten und ohne Hinweis auf eine fehlende Funktion. `AiSuggest` gibt dann
 * > `null` zurück -- kein bedingtes Ausblenden an dieser Stelle, damit die
 * > Regel an genau einem Ort steht.
 *
 * Kategorie und Zusammenfassung liegen im Zustand, weil ein übernommener
 * Vorschlag sie setzen können muss. Der Wert im Kategoriefeld bleibt dabei
 * sichtbar unverändert, bis jemand „Übernehmen" drückt -- das ist die halbe
 * Begründung für Variante C.
 *
 * Status wird nie mitgeschickt: Beim Anlegen ist er immer „Offen".
 */
export function TicketForm({
  mode,
  assignees,
  customers,
  ticketId,
  defaults,
  isRequester,
  aiEnabled = false,
}: {
  readonly mode: "create" | "edit";
  readonly assignees: readonly AssigneeChoice[];
  /** Leer für den Melder -- er wählt keinen Kunden aus. */
  readonly customers: readonly CustomerOption[];
  readonly ticketId?: string;
  readonly defaults?: {
    readonly title: string;
    readonly description: string;
    readonly category: TicketCategory;
    readonly assigneeId: string | null;
  };
  readonly isRequester: boolean;
  /** Freigabe des Mandanten. Nur beim Anlegen einschlägig. */
  readonly aiEnabled?: boolean;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    mode === "create" ? createTicket : updateTicketContent,
    null,
  );

  const [title, setTitle] = useState(defaults?.title ?? "");
  const [description, setDescription] = useState(defaults?.description ?? "");
  const [category, setCategory] = useState<TicketCategory>(
    defaults?.category ?? "sonstiges",
  );
  const [summary, setSummary] = useState("");
  const [summaryToken, setSummaryToken] = useState("");

  const titleId = useId();
  const descriptionId = useId();
  const categoryId = useId();
  const customerId = useId();
  const assigneeId = useId();

  const failed = state !== null && !state.ok;

  return (
    <form action={formAction} className="flex max-w-[42rem] flex-col gap-5">
      {ticketId !== undefined ? (
        <input type="hidden" name="ticketId" value={ticketId} />
      ) : null}

      {failed && state.fields === undefined ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}
      {state?.ok ? <Notice kind="success">Gespeichert.</Notice> : null}

      <Field
        id={titleId}
        label="Titel"
        error={failed ? state.fields?.["title"] : undefined}
        labelSuffix={
          <span className="font-mono text-[11.5px] text-muted">
            {title.length} / {TITLE_MAX}
          </span>
        }
      >
        <TextInput
          id={titleId}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={TITLE_MAX}
          autoFocus={mode === "create"}
          invalid={failed && state.fields?.["title"] !== undefined}
        />
      </Field>

      <Field
        id={descriptionId}
        label="Beschreibung"
        hint="Darf leer bleiben."
        error={failed ? state.fields?.["description"] : undefined}
        labelSuffix={
          <span className="font-mono text-[11.5px] text-muted">
            {description.length} / {DESCRIPTION_MAX.toLocaleString("de-DE")}
          </span>
        }
      >
        <textarea
          id={descriptionId}
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={4}
          className="min-h-24 w-full rounded-md border border-border-strong bg-card px-[13px] py-[11px] text-base text-foreground placeholder:text-muted"
        />
      </Field>

      {mode === "create" ? (
        <>
          {/*
            Der Kunde steht vor der Kategorie: „Für wen?" kommt vor „Was für
            eine Art Vorgang?".

            Für den Melder gibt es das Feld nicht -- nicht gesperrt, sondern
            nicht vorhanden. Er gehört zu genau einem Kunden, und welcher das
            ist, steht in seinem Profil; der Trigger `tickets_before_insert`
            setzt den Wert. Ein Auswahlfeld mit einer einzigen Möglichkeit wäre
            zudem eine Frage ohne Antwortspielraum.
          */}
          {isRequester ? null : (
            <Field
              id={customerId}
              label="Kunde"
              hint="Für wen wird dieser Vorgang geführt."
              error={failed ? state.fields?.["customerId"] : undefined}
            >
              <Select
                id={customerId}
                name="customerId"
                defaultValue=""
                invalid={failed && state.fields?.["customerId"] !== undefined}
              >
                <option value="" disabled>
                  bitte wählen
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            id={categoryId}
            label="Kategorie"
            error={failed ? state.fields?.["category"] : undefined}
          >
            <Select
              id={categoryId}
              name="category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as TicketCategory)
              }
            >
              {CATEGORY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>

          {/* Die Zuweisung gibt es für den Melder nicht -- nicht gesperrt,
              sondern nicht vorhanden. Er sieht die Namen seiner Kolleginnen
              und Kollegen ohnehin nicht. */}
          {isRequester ? null : (
            <Field
              id={assigneeId}
              label="Zuweisung"
              hint="Nur Bearbeiter und Verwaltung."
              error={failed ? state.fields?.["assigneeId"] : undefined}
            >
              <Select
                id={assigneeId}
                name="assigneeId"
                defaultValue={defaults?.assigneeId ?? ""}
              >
                <option value="">nicht zugewiesen</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {/*
            Die übernommene Zusammenfassung reist als verstecktes Feld mit --
            und `ai_summary` landet damit im selben Speichervorgang wie der
            Rest. Ein zweiter Vorgang „Zusammenfassung nachtragen" würde einen
            Zustand erzeugen, in dem ein Ticket schon existiert und die
            Kennzeichnung noch fehlt.
          */}
          {summary === "" ? null : (
            <>
              <input type="hidden" name="aiSummary" value={summary} />
              {/*
                Der Herkunftsnachweis reist daneben. Er bezeugt, dass dieser
                Text vom Modell stammt, von welchem und wann -- ohne ihn weist
                `createTicket` die Zusammenfassung ab, statt sie als
                Modellausgabe zu verbuchen, die niemand belegen kann.
              */}
              <input type="hidden" name="aiToken" value={summaryToken} />
            </>
          )}

          <AiSuggest
            enabled={aiEnabled}
            title={title}
            description={description}
            category={category}
            onAcceptCategory={setCategory}
            onAcceptSummary={(text, token) => {
              setSummary(text);
              setSummaryToken(token);
            }}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pendingLabel={mode === "create" ? "Legt an…" : "Speichert…"}
        >
          {mode === "create"
            ? isRequester
              ? "Meldung anlegen"
              : "Ticket anlegen"
            : "Speichern"}
        </SubmitButton>
        <Link href={paths.tickets} className="no-underline hover:no-underline">
          <Button variant="secondary" type="button">
            Abbrechen
          </Button>
        </Link>
      </div>

      {mode === "create" ? (
        <p className="text-[12.5px] leading-[1.5] text-muted">
          Status ist beim Anlegen immer &bdquo;Offen&ldquo;. Die Nummer wird
          beim Speichern vergeben.
        </p>
      ) : null}
    </form>
  );
}
