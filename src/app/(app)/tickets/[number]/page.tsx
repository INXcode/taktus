import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentComposer } from "@/components/tickets/comment-composer";
import { DeleteTicketDialog } from "@/components/tickets/delete-ticket-dialog";
import { BookedTime, type BookedEntry } from "@/components/time/booked-time";
import { TicketForm } from "@/components/tickets/ticket-form";
import {
  CommentList,
  type CommentEntry,
} from "@/components/tickets/comment-list";
import {
  TicketSideRail,
  type AssigneeChoice,
} from "@/components/tickets/ticket-side-rail";
import { AiSummaryBlock } from "@/components/ai/summary-block";
import { AiSummaryReviewForm } from "@/components/ai/summary-review-form";
import { AppShell } from "@/components/shell/app-shell";
import { CategoryChip, StatusPill } from "@/components/ui/badges";
import { SectionLabel } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Notice } from "@/components/patterns/notice";
import { AI_FIELD_SUMMARY, isMarked } from "@/lib/ai/marked-fields";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { loadCustomerOptions, type CustomerOption } from "@/lib/customers";
import {
  calendarDay,
  formatDateTime,
  formatRelativeDate,
} from "@/lib/format/datetime";
import { paths } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ticket · Taktus Kontor" };

/**
 * Bildschirm 9 „Ticketdetail" und Bildschirm 10 „Ticketdetail als Melder".
 *
 * Zwei Spalten für Bearbeiter und Verwaltung: links der Vorgang, rechts die
 * Verwaltung des Tickets. Der Melder bekommt nur die linke Spalte -- keine
 * Zeiten, kein Statuswechsel, keine Zuweisung.
 *
 * Links steht die Beschreibung fest -- sie ist der Vorgang und deshalb das
 * einzige Element der Seite mit einem Rahmen in Primärfarbe. Darunter teilen
 * sich Kommentare und gebuchte Zeiten einen Reiter (`?ansicht=`): Beide Listen
 * werden unabhängig voneinander lang, und untereinander verdrängt die eine die
 * andere. Rechts bleibt damit nur, was in Griffweite gehört -- Bearbeitung und
 * Löschen.
 *
 * Die KI-Zusammenfassung erscheint nur, wenn es eine gibt -- kein leerer
 * Kasten „keine Zusammenfassung vorhanden". Ein Abschnitt, der nichts kann,
 * sieht aus wie einer, der nichts findet; und bei abgeschalteter Funktion
 * wäre er Werbung für sie.
 */
export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requireRole(ALL_ROLES);
  const { number } = await params;
  const query = await searchParams;

  const ticketNumber = Number.parseInt(number, 10);
  if (!Number.isFinite(ticketNumber) || ticketNumber < 1) notFound();

  const supabase = await createClient();

  const { data: ticket, error } = await supabase
    .from("tickets")
    .select(
      `id, ticket_number, title, description, status, category, assignee_id,
       customer_id, created_at, updated_at,
       ai_summary, ai_model, ai_generated_at, ai_marked_fields,
       creator:profiles!tickets_tenant_id_created_by_fkey (display_name),
       assignee:profiles!tickets_tenant_id_assignee_id_fkey (display_name),
       customer:customers!tickets_tenant_id_customer_id_fkey (name)`,
    )
    .eq("ticket_number", ticketNumber)
    .maybeSingle();

  if (error) {
    console.error("Ticket konnte nicht geladen werden", { code: error.code });
  }

  // Kein Treffer bedeutet hier zweierlei -- es gibt das Ticket nicht, oder es
  // ist für diese Rolle nicht sichtbar. Die Datenbank liefert in beiden
  // Fällen stumm null Zeilen, und mehr lässt sich ehrlich nicht sagen.
  // Deshalb dieselbe Antwort: nicht gefunden.
  if (!ticket) notFound();

  const istMelder = viewer.role === "requester";
  const ungeprueft = isMarked(ticket.ai_marked_fields, AI_FIELD_SUMMARY);

  const { data: commentRows } = await supabase
    .from("ticket_comments")
    .select(
      "id, body, created_at, updated_at, author_id, author:profiles (display_name)",
    )
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  const comments: readonly CommentEntry[] = (commentRows ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    // Ein Melder darf `profiles` nur für sich selbst lesen -- der Name einer
    // fremden Person kommt für ihn deshalb leer zurück.
    //
    // „Unbekannt" stünde da wie ein Datenfehler. Wer an seinem eigenen Ticket
    // kommentiert hat und nicht er selbst ist, kann nach den Policies nur
    // Bearbeitung oder Verwaltung sein: `ticket_comments_insert_mandant`
    // verlangt denselben Mandanten, und ein anderer Melder sähe das Ticket
    // gar nicht. „Aus der Bearbeitung" ist damit keine Vermutung, sondern
    // das, was sich sicher sagen lässt.
    authorName:
      row.author?.display_name ??
      (istMelder ? "Aus der Bearbeitung" : "Unbekannt"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwn: row.author_id === viewer.userId,
  }));

  // Gebuchte Zeiten. Der Melder bekommt sie nicht -- er hat auf `time_entries`
  // keinerlei Zugriff, auch nicht lesend, und die Tabelle hat für ihn keine
  // einzige Policy. Die Abfrage bliebe leer; sie zu stellen wäre irreführend.
  let bookedEntries: readonly BookedEntry[] = [];
  if (!istMelder) {
    const { data } = await supabase
      .from("time_entries")
      .select(
        "id, minutes, note, worked_on, user_id, person:profiles (display_name)",
      )
      .eq("ticket_id", ticket.id)
      // Aufsteigend, genau wie der Kommentarverlauf daneben. Zwei Listen in
      // einem Reiterpaar, die in verschiedene Richtungen laufen, sind ein
      // Lesefehler in der Anwendung, kein Detail: Wer den Reiter wechselt,
      // sucht das Neueste zweimal an einer anderen Stelle.
      //
      // `created_at` als zweites Kriterium, weil `worked_on` nur tagesgenau
      // ist -- ohne das stünden zwei Buchungen desselben Tages in beliebiger
      // Reihenfolge, und zwar bei jedem Aufruf in einer anderen.
      .order("worked_on", { ascending: true })
      .order("created_at", { ascending: true });

    bookedEntries = (data ?? []).map((row) => ({
      id: row.id,
      minutes: row.minutes,
      note: row.note,
      workedOn: row.worked_on,
      personName: row.person?.display_name ?? "Unbekannt",
      isOwn: row.user_id === viewer.userId,
    }));
  }

  // Die Folgen des Löschens -- nur die Verwaltung sieht den Dialog, also wird
  // auch nur für sie gezählt. `head: true` holt die Anzahl ohne die Zeilen.
  let commentCount = 0;
  let timeEntryCount = 0;
  let totalMinutes = 0;
  if (viewer.role === "admin") {
    const [kommentare, zeiten] = await Promise.all([
      supabase
        .from("ticket_comments")
        .select("id", { count: "exact", head: true })
        .eq("ticket_id", ticket.id),
      supabase
        .from("time_entries")
        .select("minutes")
        .eq("ticket_id", ticket.id),
    ]);
    commentCount = kommentare.count ?? 0;
    timeEntryCount = zeiten.data?.length ?? 0;
    // Die Summe wird in der Anwendung gebildet: Es gibt bewusst keine Views,
    // und für eine Handvoll Buchungen je Ticket lohnt keine eigene Funktion.
    totalMinutes = (zeiten.data ?? []).reduce(
      (sum, row) => sum + row.minutes,
      0,
    );
  }

  let assignees: readonly AssigneeChoice[] = [];
  let customers: readonly CustomerOption[] = [];
  if (!istMelder) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .is("deactivated_at", null)
      .order("display_name");
    assignees = (data ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
    }));
    // Der Kunde dieses Tickets bleibt in der Auswahl, auch wenn er
    // stillgelegt ist -- sonst stünde die Seitenschiene auf einem Wert, den
    // die Liste nicht kennt.
    customers = await loadCustomerOptions(supabase, {
      zusaetzlich: ticket.customer_id,
    });
  }

  // Welcher Reiter offen ist, steht in der Adresse (`?ansicht=`) -- wie die
  // Gruppierung auf Bildschirm 13. Das hält die Wahl teilbar, lässt den
  // Zurück-Knopf stimmen und kostet keine Client-Komponente. Wichtiger noch:
  // Die Server Actions rufen `revalidatePath`, laden also dieselbe Adresse neu
  // -- wer im Reiter „Zeiten" eine Buchung anlegt, bleibt dort.
  const ansicht = query["ansicht"] === "zeiten" ? "zeiten" : "kommentare";

  const bearbeitbar = istMelder && ticket.status === "open";
  // Bearbeiter und Verwaltung dürfen Inhalt jederzeit ändern, der Melder nur
  // solange sein Ticket offen ist -- das erzwingt `tickets_update_eigene`.
  const darfInhaltAendern = istMelder ? bearbeitbar : true;

  return (
    <AppShell viewer={viewer} title={`#${ticket.ticket_number}`}>
      <nav
        aria-label="Brotkrumen"
        className="mb-3.5 flex items-center gap-2.5 text-sm text-muted"
      >
        <Link href={paths.tickets} className="font-semibold">
          {istMelder ? "Meine Meldungen" : "Tickets"}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-mono">#{ticket.ticket_number}</span>
      </nav>

      {/*
        Die Ticketnummer steht **nur** in den Brotkrumen darüber. Sie hier vor
        dem Titel zu wiederholen, half niemandem: Wer die Seite offen hat, hat
        die Nummer zwei Zeilen weiter oben und in der Adresse. Der Titel ist
        das, was den Vorgang unterscheidet.
      */}
      <div className="border-b border-border pb-5">
        <h1 className="text-4xl font-bold">{ticket.title}</h1>
        {/*
          Der Kunde steht in einer eigenen Zeile über den Bearbeitungsdaten und
          nicht in deren Aufzählung: Er beantwortet die erste Frage bei einem
          fremden Vorgang, und zwischen Zeitangaben ginge er unter.

          Ein Melder liest `customers` nur für seinen eigenen Kunden -- er
          bekommt den Namen also, und zwar seinen. Fehlt er wider Erwarten,
          steht die Zeile gar nicht erst da, statt eine Lücke zu behaupten.
        */}
        {ticket.customer === null ? null : (
          <p className="mt-2 text-base text-body">
            <span className="text-muted">Kunde:</span>{" "}
            <span className="font-semibold">{ticket.customer.name}</span>
          </p>
        )}
        {/*
          Kein Zusatz „Nummer gilt innerhalb <Mandant>". Der Hinweis erklärte
          eine Eigenschaft, die niemand erlebt: Ein Nutzer sieht ausschliesslich
          die Nummern seines eigenen Mandanten, für ihn gibt es also gar keine
          zweite Nummernreihe, von der die seine abzugrenzen wäre. Dass die
          Reihe mandantenlokal ist, gehört ins Datenmodell -- nicht in eine
          Zeile, die bei jedem Vorgang mitläuft.
        */}
        <p className="mt-2 text-sm text-muted">
          Angelegt von {ticket.creator?.display_name ?? "Unbekannt"} am{" "}
          {formatDateTime(ticket.created_at)} · geändert{" "}
          {formatRelativeDate(ticket.updated_at)}
        </p>

        {/* Der Melder sieht Status und Kategorie als Text, nicht als Auswahl:
            Er darf beides nicht ändern, und ein gesperrtes Feld verriete
            Struktur, die ihn nichts angeht. */}
        {istMelder ? (
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <StatusPill status={ticket.status} />
            <CategoryChip category={ticket.category} />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-7 pt-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/*
            Die Zusammenfassung steht **über** der Beschreibung, aber nur wenn
            es eine gibt. Kein leerer Kasten „keine Zusammenfassung
            vorhanden" -- der sähe aus wie ein Abschnitt, der nichts findet,
            und wäre bei abgeschalteter Funktion schlicht Werbung für sie.

            Ungeprüft und prüfberechtigt: das Formular (Zustand 1 → 2 → 3).
            Sonst der stille Block -- ein Melder sieht die Kennzeichnung, kann
            sie aber nicht auflösen; das gehört zur Bearbeitung.
          */}
          {ticket.ai_summary === null ? null : (
            <section>
              <SectionLabel>Zusammenfassung</SectionLabel>
              <div className="mt-2.5 max-w-[40rem]">
                {ungeprueft && !istMelder ? (
                  <AiSummaryReviewForm
                    ticketId={ticket.id}
                    summary={ticket.ai_summary}
                    model={ticket.ai_model}
                    generatedAt={ticket.ai_generated_at}
                  />
                ) : (
                  <AiSummaryBlock
                    summary={ticket.ai_summary}
                    model={ticket.ai_model}
                    generatedAt={ticket.ai_generated_at}
                    unreviewed={ungeprueft}
                  />
                )}
              </div>
            </section>
          )}

          {/*
            Die Beschreibung steht im einzigen Rahmen der Seite in
            Primärfarbe. Sie ist der Vorgang selbst -- ohne Kante trat sie
            zwischen der großen Überschrift und den gerahmten Kommentaren
            zurück, obwohl sie der Grund ist, warum jemand die Seite öffnet.
            Genau ein Element in Primärfarbe zu rahmen ist der Preis dafür,
            dass die Hervorhebung trägt.
          */}
          <section>
            <SectionLabel>Beschreibung</SectionLabel>
            <div className="mt-2.5 rounded-lg border border-primary p-4.5">
              <p className="max-w-[40rem] text-md leading-[25px] whitespace-pre-line text-body">
                {ticket.description === ""
                  ? "Ohne Beschreibung angelegt."
                  : ticket.description}
              </p>

              {/*
                Bearbeiten liegt in einem `<details>`: aufgeklappt wird per
                Tastatur bedienbar, ohne dass eine Client-Komponente den
                Zustand führt. Der Melder bekommt es nur, solange sein Ticket
                offen ist -- danach verschwindet die Schaltfläche, und der
                Hinweis unten erklärt warum.
              */}
              {darfInhaltAendern ? (
                <details className="mt-3.5">
                  <summary className="inline-flex cursor-pointer list-none items-center rounded-md border border-border-strong px-4 text-base font-semibold text-body min-h-[var(--size-control)] hover:border-primary hover:bg-subtle [&::-webkit-details-marker]:hidden">
                    Bearbeiten
                  </summary>
                  <div className="mt-4">
                    <TicketForm
                      mode="edit"
                      ticketId={ticket.id}
                      assignees={assignees}
                      customers={customers}
                      isRequester={istMelder}
                      defaults={{
                        title: ticket.title,
                        description: ticket.description,
                        category: ticket.category,
                        assigneeId: ticket.assignee_id,
                      }}
                    />
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          {/* Bildschirm 10: der Übergang „bearbeitbar → nur lesbar".
              Er passiert für den Melder unangekündigt, sobald jemand anders
              den Status ändert -- deshalb steht der Hinweis an der Stelle, an
              der sonst die Schaltfläche wäre, und nicht als Fehlermeldung. */}
          {istMelder ? (
            <section>
              {bearbeitbar ? (
                <p className="text-[12.5px] leading-[1.5] text-muted">
                  Solange der Status &bdquo;Offen&ldquo; ist, können Sie Titel
                  und Beschreibung ändern. Sobald jemand die Bearbeitung
                  aufnimmt, entfällt das.
                </p>
              ) : (
                <Notice kind="info">
                  Diese Meldung wird bearbeitet und ist deshalb nicht mehr
                  änderbar. Sie können weiter kommentieren — Ergänzungen
                  erreichen die Bearbeitung auf diesem Weg. Das Schließen
                  übernimmt die Bearbeitung, weil damit die Aufbewahrungsfrist
                  beginnt.
                </Notice>
              )}
            </section>
          ) : null}

          {/*
            Für den Melder gibt es nichts umzuschalten -- er hat auf
            `time_entries` keine einzige Policy. Ein Reiterpaar, dessen zweiter
            Reiter fehlt, wäre eine Andeutung von Struktur, die ihn nichts
            angeht; er bekommt den Kommentarverlauf schlicht als Abschnitt.
          */}
          {istMelder ? (
            <section>
              <div className="flex items-baseline gap-2.5">
                <SectionLabel>Kommentare</SectionLabel>
                <span className="text-[12.5px] text-faint">
                  {comments.length}
                </span>
              </div>
              <div className="mt-3.5">
                <CommentList comments={comments} />
                <CommentComposer
                  ticketId={ticket.id}
                  placeholder="Etwas ergänzen…"
                />
              </div>
            </section>
          ) : (
            /*
              Kommentare und gebuchte Zeiten teilen sich einen Reiter, statt
              untereinander zu stehen. Der Grund ist das Mengenverhältnis: Ein
              Vorgang mit zehn Buchungen und zwei Kommentaren schob den
              Kommentarverlauf beliebig weit nach unten -- und in der
              Seitenschiene wuchs derselbe Block an der Verwaltung vorbei, die
              dort eigentlich in Griffweite bleiben soll. Zwei Listen, die
              unabhängig voneinander lang werden, gehören nicht auf eine Bahn.
            */
            <section>
              <Tabs
                label="Kommentare und Zeiten"
                current={ansicht}
                hrefFor={(value) =>
                  `${paths.ticket(ticket.ticket_number)}?ansicht=${value}`
                }
                options={[
                  {
                    value: "kommentare",
                    label: "Kommentare",
                    count: comments.length,
                  },
                  {
                    value: "zeiten",
                    label: "Gebuchte Zeiten",
                    count: bookedEntries.length,
                  },
                ]}
              />

              {/* `mt-7`, nicht `mt-4.5`: Die Summe steht in 3xl-Mono und hat
                  fast keine Oberlänge über der Ziffernhöhe -- optisch klebte
                  sie sonst an der Reiterleiste, während der Kommentarkasten
                  daneben mit derselben Zahl richtig sass. */}
              {ansicht === "zeiten" ? (
                <div className="mt-7">
                  <BookedTime
                    ticketId={ticket.id}
                    entries={bookedEntries}
                    today={calendarDay(new Date())}
                    canBook
                    canEditAll={viewer.role === "admin"}
                  />
                </div>
              ) : (
                <div className="mt-5">
                  <CommentList
                    comments={comments}
                    canEditAll={viewer.role === "admin"}
                  />
                  <CommentComposer
                    ticketId={ticket.id}
                    placeholder="Kommentar schreiben…"
                  />
                </div>
              )}
            </section>
          )}
        </div>

        {istMelder ? null : (
          <aside className="min-w-0">
            <SectionLabel>Bearbeitung</SectionLabel>
            <div className="mt-2.5 rounded-lg border border-border p-4.5">
              <TicketSideRail
                ticketId={ticket.id}
                status={ticket.status}
                category={ticket.category}
                customerId={ticket.customer_id}
                customers={customers}
                assigneeId={ticket.assignee_id}
                assignees={assignees}
              />
            </div>

            {/* Löschen gehört nicht ins Formular daneben: Es ist kein
                Speichern, sondern ein eigener Vorgang mit eigener Folge. */}
            {viewer.role === "admin" ? (
              <div className="mt-4">
                <DeleteTicketDialog
                  ticketId={ticket.id}
                  ticketNumber={ticket.ticket_number}
                  commentCount={commentCount}
                  timeEntryCount={timeEntryCount}
                  totalMinutes={totalMinutes}
                />
              </div>
            ) : null}
          </aside>
        )}
      </div>
    </AppShell>
  );
}
