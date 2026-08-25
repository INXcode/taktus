"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TimeEntryForm } from "@/components/time/time-entry-form";
import { formatShortDate } from "@/lib/format/datetime";
import { formatMinutes } from "@/lib/format/duration";
import { shortName } from "@/lib/format/name";

export type BookedEntry = {
  readonly id: string;
  readonly minutes: number;
  readonly note: string;
  readonly workedOn: string;
  readonly personName: string;
  readonly isOwn: boolean;
};

/**
 * „Gebuchte Zeiten" im Ticketdetail (Bildschirm 9).
 *
 * **Genau eine Summe**, keine Kachelwand. Der Entwurf begründet das mit dem
 * Datenmodell: Es gibt bewusst keine Datenbank-Views, jede Summe kostet also
 * eine eigene Abfrage -- und eine Kennzahl gehört dorthin, wo sie eine
 * Entscheidung stützt.
 *
 * Fremde Buchungen trägt ein Bearbeiter nur mit dem Vermerk „fremd" -- für ihn
 * bleibt es beim Unterschied lesbar / nicht änderbar, und die beschriftete
 * Lücke sorgt dafür, dass er nicht wie ein Fehler aussieht.
 *
 * **Die Verwaltung darf seit 20260809000000 auch fremde Buchungen
 * berichtigen.** Vorher konnte sie eine falsche Buchung nur löschen und neu
 * anlegen lassen; das hiess in der Praxis, dass sie entweder ganz aus der
 * Auswertung verschwand oder gar nicht. Die Zurechnung bleibt fest -- der
 * Trigger `time_entries_before_update` lässt die buchende Person nicht
 * umschreiben.
 */
export function BookedTime({
  ticketId,
  entries,
  today,
  canBook,
  canEditAll = false,
}: {
  readonly ticketId: string;
  readonly entries: readonly BookedEntry[];
  readonly today: string;
  readonly canBook: boolean;
  /** Die Verwaltung darf auch fremde Buchungen berichtigen. */
  readonly canEditAll?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <div>
      <p className="font-mono text-3xl font-semibold text-foreground">
        {total === 0 ? "0 min" : formatMinutes(total)}
      </p>
      <p className="mt-1 text-xs text-muted">
        {entries.length} {entries.length === 1 ? "Buchung" : "Buchungen"}
      </p>

      {entries.length > 0 ? (
        <ul className="mt-3 flex list-none flex-col gap-2.5 p-0">
          {entries.map((entry) => (
            /*
              `id` und `target:`: Die Zeitlisten verweisen auf die einzelne
              Buchung (`…?ansicht=zeiten#buchung-<id>`), weil hier geändert
              wird und nicht mehr dort. Der Browser springt auf die Zeile --
              ohne Hervorhebung landet man aber irgendwo in einer Liste
              gleich aussehender Kästen und sucht die gemeinte von Hand.
            */
            <li
              key={entry.id}
              id={`buchung-${entry.id}`}
              className="scroll-mt-24 rounded-md border border-border px-3 py-2.5 target:border-primary target:bg-primary-tint"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-base font-semibold text-foreground">
                  {formatMinutes(entry.minutes)}
                </span>
                <span className="text-[12.5px] text-muted">
                  {shortName(entry.personName)} ·{" "}
                  {formatShortDate(entry.workedOn)}
                </span>
                {entry.isOwn || canEditAll ? (
                  <button
                    type="button"
                    data-variant="ghost"
                    onClick={() =>
                      setEditing(editing === entry.id ? null : entry.id)
                    }
                    className="ml-auto rounded-md px-1.5 text-[12.5px] font-semibold text-primary"
                  >
                    {editing === entry.id ? "Schließen" : "Ändern"}
                  </button>
                ) : (
                  // Die beschriftete Lücke: Ohne sie sähe die fehlende
                  // Schaltfläche wie ein Darstellungsfehler aus.
                  <span className="ml-auto text-[12.5px] text-faint">
                    fremd
                  </span>
                )}
              </div>

              {entry.note !== "" ? (
                <p className="mt-1 text-sm text-body">{entry.note}</p>
              ) : null}

              {editing === entry.id ? (
                <div className="mt-3 border-t border-border pt-3">
                  <TimeEntryForm
                    mode="edit"
                    entryId={entry.id}
                    today={today}
                    defaults={{
                      duration: String(entry.minutes),
                      workedOn: entry.workedOn,
                      note: entry.note,
                    }}
                    onDone={() => setEditing(null)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canBook ? (
        <>
          {/* Nicht mehr `fullWidth`: Der Block steht seit der Umstellung auf
              Reiter in der Hauptspalte, und ein Knopf über deren volle Breite
              sähe aus wie eine Hauptaktion der Seite. */}
          <div className="mt-3.5">
            <Button
              variant="secondary"
              type="button"
              onClick={() => dialog.current?.showModal()}
            >
              Zeit buchen
            </Button>
          </div>

          {/* `m-auto`, weil Tailwinds Preflight die Zentrierung eines modalen
              <dialog> über margin:auto sonst aushebelt. */}
          <dialog
            ref={dialog}
            aria-label="Zeit buchen"
            className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 shadow-lg backdrop:bg-overlay"
            onClick={(event) => {
              if (event.target === dialog.current) dialog.current?.close();
            }}
          >
            <h2 className="text-xl leading-[26px] font-bold">Zeit buchen</h2>
            <p className="mt-1.5 mb-4 text-sm text-muted">
              Eine Buchung gehört immer zu einem Ticket.
            </p>
            <TimeEntryForm
              mode="create"
              ticketId={ticketId}
              today={today}
              onDone={() => dialog.current?.close()}
            />
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                type="button"
                onClick={() => dialog.current?.close()}
              >
                Abbrechen
              </Button>
            </div>
          </dialog>
        </>
      ) : null}
    </div>
  );
}
