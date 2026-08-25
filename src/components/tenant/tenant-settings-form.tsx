"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { updateTenantSettings } from "@/actions/tenant";
import { Notice } from "@/components/patterns/notice";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { Field, FieldError, TextInput } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Toggle } from "@/components/ui/toggle";
import {
  RETENTION_MAX,
  RETENTION_MIN,
  describeRetention,
} from "@/lib/format/retention";
import { TENANT_NAME_MAX } from "@/lib/validation/tenant";
import { type FormResult } from "@/types";

export type TenantSettings = {
  readonly name: string;
  readonly ticketRetentionDays: number;
  readonly auditRetentionDays: number;
  readonly aiEnabled: boolean;
};

/**
 * Bildschirm 18 -- Mandanteneinstellungen.
 *
 * > [!important] Vier Werte, und kein fünfter.
 * > Es gibt hier **kein** Feld für Anbieter, Modell oder Zugangsschlüssel.
 * > Die gehören dem Betreiber der Instanz und sind für jede Rolle
 * > unerreichbar, auch für die Verwaltung -- `ai_config` hat RLS aktiv und
 * > keine einzige Policy. Ihr Fehlen ist die Aussage; ein gesperrtes Feld
 * > wäre eine schwächere.
 */
export function TenantSettingsForm({
  settings,
  operatorAiEnabled,
}: {
  readonly settings: TenantSettings;
  /** Der zweite Schalter -- gelesen, nie hier gesetzt. */
  readonly operatorAiEnabled: boolean;
}) {
  const [state, formAction] = useActionState<FormResult | null, FormData>(
    updateTenantSettings,
    null,
  );

  const nameId = useId();
  const ticketId = useId();
  const auditId = useId();
  const failed = state !== null && !state.ok;

  /*
   * Alle Felder sind gesteuert -- und das ist keine Vorliebe.
   *
   * > [!warning] React setzt ein Formular nach einer Action zurück.
   * > Bei `action={formAction}` leert React die **ungesteuerten** Felder,
   * > sobald die Action zurückkommt -- auch wenn sie mit einem Fehler
   * > zurückkommt. Die abgelehnte Eingabe verschwände damit genau in dem
   * > Moment, in dem daneben steht, was an ihr falsch war: Das Feld zeigte
   * > wieder „730", die Meldung darunter spräche von einer Zahl, die nicht
   * > mehr dasteht.
   * >
   * > Gesteuerte Felder sind davon nicht betroffen, weil ihr Wert aus dem
   * > Zustand kommt und nicht aus dem DOM.
   *
   * > [!warning] „Verwerfen" ist ein `type="button"`, kein `type="reset"`.
   * > Das ist keine Stilfrage. Der Zurücksetzen-Vorgang, den React nach der
   * > Action auslöst, ist ein echtes `form.reset()` -- und das feuert ein
   * > `reset`-Ereignis. Ein `onReset`-Handler, der die Ausgangswerte
   * > wiederherstellt, wird davon **mitgerissen**: Die abgelehnte Eingabe
   * > verschwand dadurch bei jedem Fehlschlag, obwohl niemand „Verwerfen"
   * > gedrückt hatte. Der Knopf stellt die Werte deshalb selbst her, und das
   * > Formular hat gar keinen `onReset`.
   *
   * Die Fristen liegen als Zeichenkette im Zustand, nicht als Zahl: Ein
   * geleertes Feld wäre sonst `0` und stünde als „0" da, statt leer zu sein.
   */
  const [name, setName] = useState(settings.name);
  const [ticketDays, setTicketDays] = useState(
    String(settings.ticketRetentionDays),
  );
  const [auditDays, setAuditDays] = useState(
    String(settings.auditRetentionDays),
  );
  const [aiEnabled, setAiEnabled] = useState(settings.aiEnabled);

  function restoreSaved() {
    setName(settings.name);
    setTicketDays(String(settings.ticketRetentionDays));
    setAuditDays(String(settings.auditRetentionDays));
    setAiEnabled(settings.aiEnabled);
  }

  /*
   * Das Kästchen wieder in Übereinstimmung mit dem Zustand bringen.
   *
   * > [!warning] Ohne diese Zeilen log der Schalter -- und zwar folgenreich.
   * > Der Zurücksetzen-Vorgang nach der Action trifft auch gesteuerte
   * > Kästchen: Das DOM fällt auf `defaultChecked` zurück, also „aus". Für
   * > Textfelder schreibt React seinen Zustand danach wieder hinein, für
   * > Kästchen nicht -- React sieht keinen Zustandswechsel und rendert nicht
   * > neu. Der Schalter stand danach sichtbar auf „aus", während der Zustand
   * > „ein" sagte.
   * >
   * > Das ist kein Anzeigefehler: Der sichtbare Schalter hängt über
   * > `peer-checked:` am DOM, und das nächste Absenden liest ebenfalls das
   * > DOM. Ein zweites „Speichern" hätte die KI-Freigabe zurückgenommen, ohne
   * > dass jemand sie angefasst hat -- bei einer Einwilligung zur
   * > Übermittlung an Dritte ist das die falsche Richtung, um sich zu irren.
   */
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const box = formRef.current?.elements.namedItem("aiEnabled");
    if (box instanceof HTMLInputElement) box.checked = aiEnabled;
  }, [state, aiEnabled]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex max-w-[38rem] flex-col gap-6"
    >
      {failed && state.fields === undefined ? (
        <Notice kind="error">{state.error}</Notice>
      ) : null}
      {state?.ok ? <Notice kind="success">Gespeichert.</Notice> : null}

      <Field
        id={nameId}
        label="Name"
        error={failed ? state.fields?.["name"] : undefined}
      >
        <TextInput
          id={nameId}
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={TENANT_NAME_MAX}
          invalid={failed && state.fields?.["name"] !== undefined}
        />
      </Field>

      <section>
        <div className="mb-3">
          <SectionLabel>Aufbewahrung</SectionLabel>
        </div>

        <div className="rounded-[10px] border border-border bg-subtle p-4">
          <div className="mb-3.5 grid gap-4 sm:grid-cols-2">
            <RetentionField
              id={ticketId}
              name="ticketRetentionDays"
              label="Tickets"
              value={ticketDays}
              onChange={setTicketDays}
              error={failed ? state.fields?.["ticketRetentionDays"] : undefined}
            />
            <RetentionField
              id={auditId}
              name="auditRetentionDays"
              label="Protokoll"
              value={auditDays}
              onChange={setAuditDays}
              error={failed ? state.fields?.["auditRetentionDays"] : undefined}
            />
          </div>

          {/*
            Der harte Satz aus dem Entwurf, wörtlich. Er steht hier, weil eine
            Frist, die nur ausblendet, kein Löschkonzept ist -- und weil ein
            Betreiber wissen muss, dass die Zahl im Feld darüber tatsächlich
            Daten entfernt. `purge_expired_data` führt DELETE aus, kein
            Kennzeichen.
          */}
          <p className="m-0 text-sm leading-[1.6] text-field-label">
            Zulässig sind {RETENTION_MIN} bis {RETENTION_MAX} Tage. Nach Ablauf
            der Frist wird{" "}
            <strong className="font-semibold text-foreground">
              tatsächlich gelöscht
            </strong>
            , nicht nur ausgeblendet. Gezählt wird ab dem Schließen eines
            Tickets —{" "}
            <strong className="font-semibold text-foreground">
              offene Vorgänge werden nie gelöscht.
            </strong>
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <SectionLabel>Vorschlagsfunktion</SectionLabel>
        </div>
        <AiSection
          checked={aiEnabled}
          onChange={setAiEnabled}
          operatorAiEnabled={operatorAiEnabled}
        />
      </section>

      <div className="flex flex-wrap gap-2.5">
        <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
        <Button variant="secondary" type="button" onClick={restoreSaved}>
          Verwerfen
        </Button>
      </div>
    </form>
  );
}

/**
 * Ein Fristfeld mit der Umrechnung daneben.
 *
 * `inputMode="numeric"` statt `type="number"`: Das Zahlenfeld bringt
 * Drehpfeile mit, die auf 3650 zu drehen niemand vorhat, und es verwirft in
 * manchen Browsern ungültige Eingaben stillschweigend beim Auslesen -- dann
 * käme im FormData eine leere Zeichenkette an, und die Fehlermeldung
 * beschriebe etwas anderes als das, was dasteht.
 */
function RetentionField({
  id,
  name,
  label,
  value,
  onChange,
  error,
}: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (days: string) => void;
  readonly error?: string | undefined;
}) {
  const description = describeRetention(Number.parseInt(value, 10));

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-field-label"
      >
        {label}
      </label>

      <div className="flex items-center gap-2.5">
        {/*
          Die Breite steht am Behälter, nicht am Feld: `TextInput` bringt
          `w-full` in seiner Grundklasse mit, und Tailwind entscheidet bei
          zwei Utilities derselben Gruppe nach der Reihenfolge im
          Stylesheet -- nicht nach der im Klassenattribut. Ein `w-24` am Feld
          gewinnt deshalb nicht verlässlich. Vier Ziffern brauchen keine
          halbe Spalte.
        */}
        <div className="w-[104px] shrink-0 sm:w-24">
          <TextInput
            id={id}
            name={name}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            invalid={error !== undefined}
            className="font-mono"
          />
        </div>
        {/*
          `whitespace-nowrap`, weil „Tage = 2 Jahre" ein Ausdruck ist und kein
          Satz. Ohne das bricht die Zeile zwischen „= 2" und „Jahre" um, und
          die Umrechnung liest sich als zwei zusammenhanglose Angaben.
        */}
        <span className="whitespace-nowrap text-[13.5px] text-foreground">
          Tage{" "}
          {description !== "" ? (
            <span className="text-muted">{description}</span>
          ) : null}
        </span>
      </div>

      {error !== undefined ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

/**
 * Der KI-Schalter -- und der Satz über den zweiten Schalter.
 *
 * > [!important] Ohne diesen Hinweis wirkt ein wirkungsloser Schalter wie ein
 * > Fehler.
 * > Die Freigabe braucht **zwei** Zustimmungen: die des Mandanten hier und
 * > die des Betreibers in `ai_config`. Steht die des Betreibers auf „aus",
 * > bleibt dieser Schalter folgenlos. Ein Nutzer, der das nicht liest, hält
 * > die Anwendung für kaputt -- und hat recht damit, dass etwas nicht stimmt.
 *
 * Der Schalter bleibt trotzdem bedienbar, wenn der Betreiber gesperrt hat:
 * Die Zustimmung des Mandanten ist eine eigene Entscheidung und darf im
 * Voraus getroffen werden. Sie zu sperren hiesse, den Betreiber über den
 * Willen des Mandanten bestimmen zu lassen.
 */
function AiSection({
  checked,
  onChange,
  operatorAiEnabled,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly operatorAiEnabled: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-border p-4">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="mb-1 text-[14.5px] font-semibold text-foreground">
            Zusammenfassung und Kategorie vorschlagen
          </p>
          <p className="mb-2.5 text-sm leading-[1.55] text-field-label">
            Beim Anlegen eines Tickets werden Titel und Beschreibung an ein
            Sprachmodell übermittelt. Die Antwort erscheint als Vorschlag und
            wird nie automatisch übernommen.
          </p>
          <p className="text-sm leading-[1.55] text-field-label">
            Ohne Ihre Zustimmung findet keine Übermittlung statt. Zusätzlich
            muss der Betreiber der Instanz die Funktion freigeben — steht dort
            „aus“, bleibt dieser Schalter ohne Wirkung.
          </p>
        </div>

        {/*
          Der Schalter steht rechts neben dem Text und trägt selbst keine
          sichtbare Beschriftung -- so zeichnet der Entwurf ihn. Damit fehlt
          ihm der zugängliche Name, den sonst der Text im umschliessenden
          `<label>` liefert; `aria-label` trägt ihn nach. Ohne das wäre der
          Schalter für einen Screenreader ein namenloses „ein/aus".
        */}
        <Toggle
          name="aiEnabled"
          value="ja"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          label="Zusammenfassung und Kategorie vorschlagen"
          aria-label="Zusammenfassung und Kategorie vorschlagen"
          stateLabel=""
          className="shrink-0"
        />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-muted-surface pt-3.5">
        <span className="inline-flex items-center gap-[7px] font-mono text-[11.5px] text-muted">
          <span
            aria-hidden="true"
            className={`size-[7px] rounded-full ${
              operatorAiEnabled ? "bg-primary" : "bg-border-strong"
            }`}
          />
          Betreiber: {operatorAiEnabled ? "freigegeben" : "gesperrt"}
        </span>
        <span className="text-[12.5px] text-muted">
          Aktiv wird die Funktion nur, wenn beide Schalter „ein“ stehen.
        </span>
      </div>
    </div>
  );
}
