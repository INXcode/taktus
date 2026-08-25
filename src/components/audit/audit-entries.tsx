import { Table, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { formatShortDate, formatTime } from "@/lib/format/datetime";
import { SYSTEM_ACTOR } from "@/lib/labels/audit";

/**
 * Aus dem Entwurf, Bildschirm 19 -- mit einer breiteren Akteursspalte.
 *
 * > [!note] Bewusste Abweichung: der Akteur wird **nicht** abgekürzt.
 * > Der Entwurf zeigt „Kim M."; die Ticketliste kürzt aus gutem Grund so, weil
 * > dort der Vorgang zählt und nicht die Person. Ein Protokoll ist das
 * > Gegenteil: Es soll belegen, wer etwas getan hat. „Kim M." trifft auf zwei
 * > Nutzer zu, sobald es zwei gibt -- und ein Nachweis, der zwei Personen
 * > meinen kann, ist keiner. Die Spalte wächst dafür um 32 px.
 */
const COLUMNS = "108px 150px 138px minmax(0,1fr)";

export type AuditEntry = {
  readonly id: number;
  readonly occurredAt: string;
  /** `null` = Löschlauf oder anonymisierte Person. Nie erfinden. */
  readonly actorName: string | null;
  readonly action: string;
  readonly entityType: string;
  /** Nur bei Tickets aufgelöst -- siehe `AuditObject`. */
  readonly ticketNumber: number | null;
  readonly changedFields: readonly string[];
};

/**
 * Bildschirm 19 -- die Protokollzeilen.
 *
 * > [!important] Die Kargheit ist die Aussage.
 * > Vier Spalten, Feldnamen als Mono-Marken, sonst nichts. Kein Vorher, kein
 * > Nachher, keine Feldinhalte, keine IP-Adresse, keine Browserkennung -- und
 * > kein Aufklapppfeil, weil es nichts aufzuklappen gibt. Ein leerer Pfeil
 * > wäre das Versprechen von Einzelheiten, die absichtlich fehlen.
 * >
 * > Das ist keine Sparsamkeit der Oberfläche, sondern die der Tabelle:
 * > `audit_log` speichert nur Feldnamen. Ein Protokoll mit alten und neuen
 * > Werten wäre eine zweite, länger aufbewahrte Kopie personenbezogener Daten
 * > -- und die taucht in keinem Löschkonzept auf.
 */
export function AuditEntries({
  entries,
}: {
  readonly entries: readonly AuditEntry[];
}) {
  return (
    <>
      {/* ---------- Desktop ---------- */}
      <div className="hidden sm:block">
        <Table caption="Protokolleinträge dieses Mandanten">
          <TableHead columns={COLUMNS}>
            <TableCell>Zeitpunkt</TableCell>
            <TableCell>Akteur</TableCell>
            <TableCell>Aktion</TableCell>
            <TableCell>Objekt und Felder</TableCell>
          </TableHead>

          {entries.map((entry) => (
            <TableRow key={entry.id} columns={COLUMNS}>
              <TableCell className="self-baseline font-mono text-xs text-field-label">
                {formatShortDate(entry.occurredAt)}{" "}
                {formatTime(entry.occurredAt)}
              </TableCell>

              <TableCell className="self-baseline">
                <Actor name={entry.actorName} />
              </TableCell>

              <TableCell className="self-baseline font-mono text-xs text-primary-text">
                {entry.action}
              </TableCell>

              <TableCell className="flex flex-wrap items-baseline gap-1.5 self-baseline">
                <AuditObject
                  entityType={entry.entityType}
                  ticketNumber={entry.ticketNumber}
                />
                {entry.changedFields.map((field) => (
                  <FieldChip key={field}>{field}</FieldChip>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </div>

      {/* ---------- Mobil ---------- */}
      <ul className="flex list-none flex-col gap-2.5 p-0 sm:hidden">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-[10px] border border-border p-3.5"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="font-mono text-[12.5px] text-primary-text">
                {entry.action}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {formatShortDate(entry.occurredAt)}{" "}
                {formatTime(entry.occurredAt)}
              </span>
            </div>

            <div className="mb-2 text-[13.5px] text-foreground">
              <Actor name={entry.actorName} />
              {" · "}
              <AuditObject
                entityType={entry.entityType}
                ticketNumber={entry.ticketNumber}
              />
            </div>

            {entry.changedFields.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {entry.changedFields.map((field) => (
                  <FieldChip key={field}>{field}</FieldChip>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Ein leerer Akteur bekommt keinen erfundenen Namen.
 *
 * `actor_id` darf NULL sein, und die Tabelle führt bewusst **keinen**
 * Fremdschlüssel auf `profiles`: Das Protokoll muss die Anonymisierung eines
 * Profils überdauern. Kursiv und ausgeschrieben ist deshalb richtiger als ein
 * Strich -- der läse sich wie „unbekannt", und unbekannt ist es nicht.
 */
function Actor({ name }: { readonly name: string | null }) {
  if (name === null) {
    return <span className="text-muted italic">{SYSTEM_ACTOR}</span>;
  }
  return <span className="text-[12.5px] text-foreground">{name}</span>;
}

/**
 * Das betroffene Objekt.
 *
 * Aufgelöst wird nur die Ticketnummer -- sie ist mandantenlokal, kurz und die
 * Kennung, unter der ein Vorgang im Haus besprochen wird. Für Kommentare,
 * Zeitbuchungen und Profile steht die Objektart allein: Eine UUID hilft
 * niemandem beim Lesen, und den Namen der betroffenen Person hier
 * nachzuschlagen hiesse, dem Protokoll einen Personenbezug hinzuzufügen, den
 * es absichtlich nicht speichert.
 *
 * Fehlt die Nummer bei einem Ticket, ist der Vorgang gelöscht -- bei
 * `ticket.delete` ist das der Normalfall und kein Mangel.
 */
function AuditObject({
  entityType,
  ticketNumber,
}: {
  readonly entityType: string;
  readonly ticketNumber: number | null;
}) {
  return (
    <span className="font-mono text-xs text-muted">
      {entityType}
      {ticketNumber !== null ? ` #${ticketNumber}` : ""}
    </span>
  );
}

function FieldChip({ children }: { readonly children: string }) {
  return (
    <span className="rounded-sm border border-border bg-muted-surface px-1.5 py-px font-mono text-[11.5px] text-field-label">
      {children}
    </span>
  );
}
