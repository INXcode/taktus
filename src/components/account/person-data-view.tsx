import { type ReactNode } from "react";
import { formatDate } from "@/lib/format/datetime";
import { sectionCounts, type PersonData } from "@/lib/export/person-data";
import { ROLE_LABEL } from "@/lib/labels/role";
import { STATUS_LABEL } from "@/lib/labels/status";
import { type AppRole, type TicketStatus } from "@/types";

/**
 * Bildschirme 21 und 22 -- die sechs Abschnitte.
 *
 * > [!important] Beide Bildschirme sind **dieselbe** Ansicht.
 * > Der Entwurf sagt es ausdrücklich: gleicher Aufbau, anderer Kopf. Die
 * > Verwaltung sieht keinen erweiterten Datensatz, wenn sie die Auskunft für
 * > einen Nutzer aufruft -- sie sieht denselben. Zwei Komponenten wären zwei
 * > Gelegenheiten, dass die eine mehr zeigt als die andere.
 *
 * Angezeigt wird ausschliesslich, was `export_person_data` liefert -- und die
 * Datei enthält genau dasselbe. Ansicht und Download sind nicht zwei Wege zu
 * ähnlichen Daten, sondern zwei Darstellungen derselben Antwort.
 */
export function PersonDataView({
  data,
  header,
}: {
  readonly data: PersonData;
  /** Der Kopf unterscheidet 21 von 22. Alles darunter ist gleich. */
  readonly header: ReactNode;
}) {
  const sections = sectionCounts(data);

  return (
    <div className="max-w-[38rem]">
      {header}

      {/*
        Der Hinweis läuft mit -- im Kopf der Ansicht und in der Datei selbst,
        nicht in einer Fussnote. Eine Auskunft, die eine Lücke hat, muss die
        Lücke benennen, und zwar dort, wo sie gelesen wird.
      */}
      <div className="mt-4 mb-5 flex items-start gap-3 rounded-md border border-border bg-subtle p-3.5">
        <span aria-hidden="true" className="text-base font-bold text-muted">
          i
        </span>
        <p className="text-sm leading-[1.55] text-field-label">
          <strong className="font-semibold text-foreground">
            Die E-Mail-Adresse ist in diesem Export nicht enthalten.
          </strong>{" "}
          Sie liegt in der Anmeldung, nicht im Anwendungsschema, und wird
          gesondert beigefügt. Derselbe Satz steht auch in der Datei.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Section section={sections[0]}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[12.5px] leading-[1.7] text-field-label">
            <dt className="text-muted">display_name:</dt>
            <dd className="m-0">{data.profil.display_name}</dd>
            <dt className="text-muted">role:</dt>
            <dd className="m-0">
              {data.profil.role}{" "}
              <span className="font-sans text-muted">
                ({ROLE_LABEL[data.profil.role as AppRole] ?? "unbekannt"})
              </span>
            </dd>
            {/*
              Nur beim Melder gesetzt -- Bearbeitung und Verwaltung hängen am
              Mandanten. Eine Zeile „customer_id: null" wäre keine Auskunft,
              sondern ein Feld, das nach einer Lücke aussieht.

              Der Name steht dabei, weil eine Kennung die Frage nicht
              beantwortet, die ein Betroffener stellt.
            */}
            {data.profil.customer_id === null ? null : (
              <>
                <dt className="text-muted">customer_id:</dt>
                <dd className="m-0">
                  {data.profil.customer_id}{" "}
                  <span className="font-sans text-muted">
                    ({data.profil.customer_name ?? "unbekannt"})
                  </span>
                </dd>
              </>
            )}
            <dt className="text-muted">created_at:</dt>
            <dd className="m-0">{formatDate(data.profil.created_at)}</dd>
          </dl>
        </Section>

        <Section section={sections[1]}>
          {data.tickets_gemeldet.length === 0 ? null : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-field-label">
              {data.tickets_gemeldet.map((ticket) => (
                <li key={ticket.id}>
                  <TicketNumber value={ticket.ticket_number} /> {ticket.title}{" "}
                  <span className="text-muted">
                    · {STATUS_LABEL[ticket.status as TicketStatus] ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section section={sections[2]}>
          {data.tickets_zugewiesen.length === 0 ? null : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-field-label">
              {data.tickets_zugewiesen.map((ticket) => (
                <li key={ticket.id}>
                  <TicketNumber value={ticket.ticket_number} /> {ticket.title}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/*
          Kommentare und Zeitbuchungen stehen nur als Anzahl da -- der Entwurf
          zeigt das so, und es ist auch die richtige Zurückhaltung: Der
          Wortlaut von elf Kommentaren gehört in die Datei, nicht auf einen
          Bildschirm, über den jemand im Vorbeigehen sieht.
        */}
        <Section section={sections[3]} />
        <Section section={sections[4]} />

        <Section section={sections[5]}>
          <p className="m-0 text-[12.5px] leading-[1.55] text-muted">
            Zeitpunkt, Aktion, Objektart und geänderte Feldnamen — ohne
            Feldinhalte, weil keine gespeichert werden.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({
  section,
  children,
}: {
  readonly section: ReturnType<typeof sectionCounts>[number] | undefined;
  readonly children?: ReactNode;
}) {
  if (section === undefined) return null;

  return (
    <section className="rounded-[10px] border border-border p-3.5">
      <div
        className={`flex items-baseline justify-between gap-3 ${
          children === undefined ? "" : "mb-2"
        }`}
      >
        <h2 className="text-base font-semibold text-foreground">
          {section.number} · {section.title}
        </h2>
        <span className="shrink-0 font-mono text-xs text-muted">
          {section.measure}
        </span>
      </div>
      {children}
    </section>
  );
}

function TicketNumber({ value }: { readonly value: number }) {
  return <span className="font-mono text-muted">#{value}</span>;
}
