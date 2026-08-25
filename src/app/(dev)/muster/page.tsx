import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { AiPatternCatalogue } from "@/components/ai/catalogue";
import { EmptyState } from "@/components/patterns/empty-state";
import { Notice, WriteDeniedNotice } from "@/components/patterns/notice";
import { CategoryChip, RoleBadge, StatusPill } from "@/components/ui/badges";
import { Button, LinkButton, Spinner } from "@/components/ui/button";
import { Card, Kpi, SectionLabel } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Field, FieldError, TextInput } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { Segmented } from "@/components/ui/segmented";
import { Tabs } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableCell,
  TableHead,
  TableRow,
  TableSkeleton,
} from "@/components/ui/table";
import { Checkbox, Toggle } from "@/components/ui/toggle";
import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/labels/category";
import { STATUS_ORDER } from "@/lib/labels/status";
import { type AppRole } from "@/types";

/**
 * Der Titel wird erzeugt statt fest ausgesprochen -- und die Sperre steht hier
 * ein zweites Mal.
 *
 * Ein `export const metadata` wird ausgewertet, gleich ob die Komponente
 * danach `notFound()` ruft. Im Produktivbau antwortete `/muster` deshalb zwar
 * mit 404, der Reiter trug aber „Musterkatalog" -- und verriet damit genau
 * die Route, die nicht ausgeliefert werden soll. Aufgefallen beim
 * Handdurchlauf unter Produktionsbedingungen, nicht im Entwicklungsserver.
 *
 * `notFound()` in `generateMetadata` bricht bereits den Metadatenlauf ab; die
 * Seite bekommt dann den Titel von `not-found.tsx`.
 */
export async function generateMetadata(): Promise<Metadata> {
  if (process.env.NODE_ENV === "production") notFound();

  return { title: "Musterkatalog" };
}

/**
 * Der Musterkatalog -- Grundlagen B auf einer Seite.
 *
 * > [!important] Nur außerhalb der Produktion.
 * > Die Seite ist kein Bestandteil der Anwendung: Sie zeigt Komponenten, keine
 * > Daten, und sie steht in keinem Bildschirmverzeichnis. Im Produktivbau
 * > antwortet sie mit „nicht gefunden" -- kein `requireRole()`, weil es hier
 * > nichts zu schützen gibt, was nicht ohnehin im Quelltext steht.
 *
 * Ihr Zweck ist die Abnahme: Ohne sie ließe sich der Zustand „Fokus" oder
 * „ladend" nur über einen echten Bildschirm herbeiführen, und die
 * gestalterische Prüfung käme erst nach dem Bauen.
 */

const COLUMNS = "62px 1fr 130px 118px 150px";

const ROLES: readonly AppRole[] = ["admin", "agent", "requester"];

export default function MusterPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-[var(--size-content-max)] p-6 sm:p-10">
      <h1 className="text-4xl font-bold">Musterkatalog</h1>
      <p className="mt-2 mb-10 max-w-[38rem] text-base text-muted">
        Grundlagen B aus den Bildschirmentwürfen. Was hier nicht steht, kommt in
        den Bildschirmen auch nicht vor. Diese Seite wird nur außerhalb der
        Produktion ausgeliefert.
      </p>

      <div className="flex flex-col gap-10">
        {/* ---------- Knöpfe ---------- */}
        <section>
          <SectionLabel>Knöpfe</SectionLabel>
          <Card className="mt-3">
            <div className="flex flex-col gap-4">
              {(["primary", "secondary", "destructive", "ghost"] as const).map(
                (variant) => (
                  <div
                    key={variant}
                    className="flex flex-wrap items-center gap-5"
                  >
                    <span className="w-24 shrink-0 text-sm font-semibold text-field-label">
                      {
                        {
                          primary: "Primär",
                          secondary: "Sekundär",
                          destructive: "Gefährlich",
                          ghost: "Flach",
                        }[variant]
                      }
                    </span>
                    <Button variant={variant}>Speichern</Button>
                    <Button variant={variant} focusPreview>
                      Fokus
                    </Button>
                    <Button variant={variant} disabled>
                      Deaktiviert
                    </Button>
                    <Button variant={variant} loading>
                      <Spinner variant={variant} />
                      Speichert…
                    </Button>
                    <LinkButton variant={variant} href="#muster">
                      Als Verweis
                    </LinkButton>
                  </div>
                ),
              )}
            </div>
            <div className="mt-4 max-w-[46rem] text-sm leading-6 text-muted">
              <p>
                Der Knopf mit der Beschriftung &bdquo;Fokus&ldquo; zeigt den
                Ring <strong className="text-field-label">dauerhaft</strong>.
                Das ist nötig, weil sich der echte Zustand im Katalog sonst
                nicht vorführen lässt:
              </p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                <li>
                  <strong className="text-field-label">Ein Mausklick</strong>{" "}
                  zeigt auf einem Knopf absichtlich keinen Ring —{" "}
                  <code className="font-mono">:focus-visible</code> trifft dann
                  nicht, weil wer klickt ohnehin weiß, wo er ist.
                </li>
                <li>
                  <strong className="text-field-label">In Safari</strong>{" "}
                  springt der Tabulator Knöpfe und Verweise gar nicht erst an,
                  solange &bdquo;Press Tab to highlight each item on a
                  webpage&ldquo; in Einstellungen → Erweitert ausgeschaltet ist.
                  Das ist die Vorgabe.
                </li>
              </ul>
              <p className="mt-2">
                Die Vorschau hängt im selben Selektor wie der echte Fokus, kann
                also nicht davon abweichen. Zum Gegenprüfen in Chrome oder
                Firefox: mit der Tabulatortaste durch die Reihe — jeder Knopf
                muss denselben Ring bekommen, der gefährliche einen roten, der
                flache einen ohne Halo.
              </p>
            </div>
          </Card>
        </section>

        {/* ---------- Felder ---------- */}
        <section>
          <SectionLabel>Eingabefeld</SectionLabel>
          <Card className="mt-3">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="m-ruhe" label="Ruhe">
                <TextInput id="m-ruhe" placeholder="Kurz und eindeutig" />
              </Field>
              <Field id="m-fokus" label="Fokus">
                <TextInput
                  id="m-fokus"
                  focusPreview
                  defaultValue="Etikettendrucker zieht kein Papier"
                />
              </Field>
              <Field
                id="m-fehler"
                label="Fehler"
                error="Bitte einen Titel eingeben. 1 bis 200 Zeichen."
              >
                <TextInput id="m-fehler" invalid defaultValue="" />
              </Field>
              <Field
                id="m-hinweis"
                label="Mit Hilfstext"
                hint="Darf leer bleiben."
                labelSuffix={
                  <span className="font-mono text-[11.5px] text-muted">
                    58 / 20 000
                  </span>
                }
              >
                <TextInput id="m-hinweis" defaultValue="Seit heute Morgen." />
              </Field>
              <Field
                id="m-aus"
                label="Deaktiviert"
                hint="Wird vom Server gesetzt."
              >
                <TextInput
                  id="m-aus"
                  disabled
                  defaultValue="Muster Handwerk GmbH"
                />
              </Field>
              <Field id="m-auswahl" label="Auswahl">
                <Select id="m-auswahl" defaultValue="stoerung">
                  {CATEGORY_ORDER.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABEL[category]}
                    </option>
                  ))}
                </Select>
              </Field>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-field-label">
                  Skelett
                </p>
                <div className="animate-pulse rounded-md border border-border bg-subtle px-[13px] py-[11px]">
                  <span className="block h-[15px] w-[62%] rounded bg-border" />
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* ---------- Schalter ---------- */}
        <section>
          <SectionLabel>Schalter, Kästchen, Segment, Reiter</SectionLabel>
          <Card className="mt-3">
            <div className="flex flex-wrap items-center gap-7">
              <Toggle label="KI-Freigabe" stateLabel="Aus" />
              <Toggle label="KI-Freigabe" stateLabel="Ein" defaultChecked />
              <Toggle label="KI-Freigabe" stateLabel="Gesperrt" disabled />
              <Checkbox label="Leer" />
              <Checkbox label="Gesetzt" defaultChecked />
            </div>
            <div className="mt-4">
              <Segmented
                label="Gruppierung"
                current="woche"
                hrefFor={(value) => `?gruppierung=${value}`}
                options={[
                  { value: "woche", label: "Woche" },
                  { value: "monat", label: "Monat" },
                ]}
              />
            </div>
            {/* Segment und Reiter sehen sich nah und meinen Verschiedenes:
                Das Segment tauscht die Darstellung derselben Sache, der
                Reiter wechselt den Inhalt. Deshalb stehen sie hier
                nebeneinander. */}
            <div className="mt-5">
              <Tabs
                label="Beispiel"
                current="kommentare"
                hrefFor={(value) => `?ansicht=${value}`}
                options={[
                  { value: "kommentare", label: "Kommentare", count: 3 },
                  { value: "zeiten", label: "Gebuchte Zeiten", count: 10 },
                ]}
              />
            </div>
          </Card>
        </section>

        {/* ---------- Marken ---------- */}
        <section>
          <SectionLabel>Status · Kategorie · Person · Rolle</SectionLabel>
          <Card className="mt-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {STATUS_ORDER.map((status) => (
                <StatusPill key={status} status={status} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              {CATEGORY_ORDER.map((category) => (
                <CategoryChip key={category} category={category} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {ROLES.map((role) => (
                <RoleBadge key={role} role={role} />
              ))}
              <span className="inline-flex items-center gap-2">
                <Avatar displayName="Kim Musterbearbeitung" />
                <span className="text-base text-body">
                  Kim Musterbearbeitung
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <Avatar displayName="Alex Musterleitung" tone="other" />
                <span className="text-base text-body">Alex Musterleitung</span>
              </span>
            </div>
            <p className="mt-4 max-w-[38rem] text-sm text-muted">
              Status ist eine farbige Pille mit rundem Punkt, Kategorie ein
              gedecktes Quadrat auf neutraler Fläche. Die Form trennt die beiden
              Ebenen — nicht die Farbe allein.
            </p>
          </Card>
        </section>

        {/* ---------- Liste ---------- */}
        <section>
          <SectionLabel>Listenzeile</SectionLabel>
          <div className="mt-3">
            <Table caption="Beispielhafte Ticketliste">
              <TableHead columns={COLUMNS}>
                <TableCell>Nr.</TableCell>
                <TableCell>Titel</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Kategorie</TableCell>
                <TableCell>Zuweisung</TableCell>
              </TableHead>
              <TableRow columns={COLUMNS} href="#muster">
                <TableCell className="font-mono text-sm text-muted">
                  #2
                </TableCell>
                <TableCell className="text-base text-foreground">
                  Zugang zum Ersatzteilkatalog fehlt
                </TableCell>
                <TableCell>
                  <StatusPill status="open" />
                </TableCell>
                <TableCell>
                  <CategoryChip category="anfrage" />
                </TableCell>
                <TableCell className="text-sm text-muted italic">
                  nicht zugewiesen
                </TableCell>
              </TableRow>
              <TableRow columns={COLUMNS} href="#muster">
                <TableCell className="font-mono text-sm text-muted">
                  #1
                </TableCell>
                <TableCell className="text-base text-foreground">
                  Etikettendrucker in der Werkstatt zieht kein Papier ein
                </TableCell>
                <TableCell>
                  <StatusPill status="in_progress" />
                </TableCell>
                <TableCell>
                  <CategoryChip category="stoerung" />
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2 text-sm text-body">
                    <Avatar displayName="Kim Musterbearbeitung" size="xs" />
                    Kim M.
                  </span>
                </TableCell>
              </TableRow>
              <TableSkeleton
                columns={COLUMNS}
                rows={2}
                shapes={["short", "text", "pill", "chip", "text"]}
              />
            </Table>
            <p className="mt-3.5 max-w-[38rem] text-sm text-muted">
              &bdquo;nicht zugewiesen&ldquo; steht kursiv und gedämpft in
              derselben Spalte, in der sonst eine Person steht — die Lücke ist
              als Lücke sichtbar, ohne Warnfarbe.
            </p>
            <Pagination
              page={1}
              pageCount={2}
              total={24}
              pageSize={25}
              hrefForPage={(page) => `?seite=${page}`}
            />
          </div>
        </section>

        {/* ---------- Rückmeldungen ---------- */}
        <section>
          <SectionLabel>Rückmeldung nach dem Speichern</SectionLabel>
          <div className="mt-3 flex flex-col gap-3">
            <Notice
              kind="success"
              action={
                <a href="#muster" className="font-semibold">
                  Öffnen
                </a>
              }
            >
              Ticket #4 angelegt.
            </Notice>
            <WriteDeniedNotice />
            <Notice kind="info">
              Die Sitzung ist abgelaufen. Bitte erneut anmelden — die Eingabe
              bleibt erhalten.
            </Notice>
            <FieldError>
              Anmeldung nicht möglich. Bitte prüfen Sie E-Mail und Passwort.
            </FieldError>
          </div>
        </section>

        {/* ---------- Kennzahlen ---------- */}
        <section>
          <SectionLabel>Karte · Kennzahl</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-3.5">
            <Kpi
              label="Gebucht auf dieses Ticket"
              value="45 min"
              sub="1 Buchung"
            />
            <Kpi
              label="Diese Woche"
              value="6 h 15"
              sub="KW 32 · 5 Buchungen"
              muted
            />
          </div>
        </section>

        {/* ---------- Leerzustand ---------- */}
        <section>
          <SectionLabel>Leerzustand — das benannte Muster</SectionLabel>
          <div className="mt-3">
            <EmptyState
              shows="Diese Ansicht zeigt keine Tickets."
              doesNotMean="Das kann bedeuten, dass keine angelegt sind — oder dass die aktiven Filter nichts treffen. Wenn Sie Tickets erwarten, die hier fehlen, wenden Sie sich an die Verwaltung Ihres Mandanten."
              action={
                <>
                  <Button variant="secondary">Filter zurücksetzen</Button>
                  <Button>Ticket anlegen</Button>
                </>
              }
            />
            <p className="mt-3.5 max-w-[38rem] text-sm text-muted">
              Bei fehlender Leseberechtigung liefert die Datenbank stumm null
              Zeilen. Ein Leerzustand darf deshalb nie behaupten, dass es nichts
              gibt — er beschreibt die Ansicht, nicht die Welt.
            </p>
          </div>
        </section>

        {/* ---------- Das KI-Vorschlagsmuster ---------- */}
        <section>
          <SectionLabel>Das KI-Vorschlagsmuster — Variante C</SectionLabel>
          <p className="mt-2 mb-3.5 max-w-[38rem] text-sm text-muted">
            In der laufenden Anwendung ist dieser Zustand mit dem ausgelieferten
            Anbieter <span className="font-mono">null</span> nicht
            herbeizuführen — er überträgt nichts und antwortet immer
            „abgeschaltet“. Ohne diesen Abschnitt liesse sich die Kennzeichnung
            also gar nicht prüfen, und geprüft werden muss sie: Sie trägt eine
            Sicherheitsaussage.
          </p>

          <AiPatternCatalogue />

          <p className="mt-3.5 max-w-[38rem] text-sm text-muted">
            Drei Träger, nie die Farbe allein: schraffierte Fläche, orange
            Kante, Beschriftung. Nach dem Prüfen verschwindet die Schraffur
            restlos — das Feld sieht aus wie jedes andere gespeicherte. Was
            bleibt, ist die Herkunftszeile; sie gehört zum Vorgang, nicht zur
            Kennzeichnung.
          </p>
        </section>
      </div>
    </div>
  );
}
