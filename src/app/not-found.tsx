import { type Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SourceNotice } from "@/components/source-notice";
import { paths } from "@/lib/paths";

/**
 * Ohne diese Zeile trägt der Reiter den Titel der Route, die `notFound()`
 * gerufen hat -- „Ticket · Taktus Kontor" über einer Seite, die sagt, dass es
 * das Ticket nicht gibt.
 */
export const metadata: Metadata = { title: "Nicht gefunden · Taktus Kontor" };

/**
 * Bildschirm 25, erste Hälfte -- nicht gefunden.
 *
 * > [!important] Ohne diese Datei liefert Next seine eigene Seite aus.
 * > Sie ist englisch, trägt keinen Quelltexthinweis und sieht aus wie eine
 * > andere Anwendung. Auffallen kann das nur, wenn jemand eine falsche
 * > Adresse aufruft -- also selten und meistens dann, wenn ohnehin gerade
 * > etwas schiefgeht. Ein E2E-Test hat die Lücke gefunden, keine Codeprüfung.
 *
 * Der zweite Satz erklärt den Fall, der hier am häufigsten landet:
 * **Ticketnummern sind mandantenlokal.** Wer eine Nummer aus einem anderen
 * Zusammenhang aufruft, bekommt diese Seite -- nicht „kein Zugriff", denn das
 * verriete, dass es die Nummer anderswo gibt. Der Unterschied ist der ganze
 * Grund, warum es zwei Seiten sind.
 *
 * Ohne `AppShell`: Diese Seite wird auch unangemeldet ausgeliefert, und die
 * Shell setzt einen Betrachter voraus. Der Quelltexthinweis nach Paragraph 13
 * steht trotzdem darunter -- er gilt für jede Seite, die über das Netz
 * ausgeliefert wird, auch für diese.
 *
 * > [!important] `await connection()` ist hier keine Zierde -- ohne die Zeile
 * > blockiert die eigene CSP jedes Skript dieser Seite.
 * >
 * > Next stempelt die Nonce beim serverseitigen Rendern an die Skript-Tags und
 * > liest sie dafür aus dem `Content-Security-Policy`-Header der **Anfrage**.
 * > Eine Seite, die zur Bauzeit vorgerendert wird, hat keine Anfrage, also
 * > keinen Header und keine Nonce. Genau das war der Fall: `/_not-found` stand
 * > im Build als `○` (statisch), und auf jeder 404-Antwort meldete die Konsole
 * > zwölf blockierte Skripte -- während dieselben Skripte auf `/login`
 * > einwandfrei liefen. Verloren ging damit das clientseitige Routing; ein
 * > Klick lud voll neu.
 * >
 * > `connection()` wartet auf die eingehende Anfrage und zwingt die Seite
 * > damit ins dynamische Rendern. Der Beleg steht in
 * > `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`,
 * > Abschnitt „Forcing dynamic rendering". Der Preis ist gering: Diese Seite
 * > wird ohnehin nur im Fehlerfall ausgeliefert und bringt keine Daten mit.
 * >
 * > Im Entwicklungsserver ist davon nichts zu sehen -- dort ist `script-src`
 * > nachsichtig. Geprüft wird das deshalb gegen den Produktivbau.
 */
export default async function NotFound() {
  await connection();

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[34rem] rounded-xl border border-border bg-card p-8 sm:p-10">
          <p className="mb-3 font-mono text-xs tracking-[0.1em] text-faint">
            404
          </p>

          <h1 className="text-2xl leading-[31px] font-bold text-foreground">
            Diese Seite gibt es nicht.
          </h1>

          <p className="mt-2.5 max-w-[30rem] text-sm leading-[23px] text-field-label">
            Möglicherweise wurde der Vorgang gelöscht, oder die Adresse ist
            unvollständig. Ticketnummern gelten nur innerhalb Ihres Mandanten —
            eine Nummer aus einem anderen Zusammenhang führt hierher.
          </p>

          {/*
            Ein Verweis, kein Knopf mit Verlauf: „Zurück" bräuchte
            `history.back()` und damit eine Client-Komponente auf einer Seite,
            die vor allem eines sein soll -- da. Der Browser hat einen
            Zurück-Knopf, und er funktioniert besser als jeder nachgebaute.
          */}
          <p className="mt-5">
            <Link
              href={paths.tickets}
              className="inline-flex min-h-[var(--size-control)] items-center rounded-md bg-primary px-4 text-base font-semibold text-on-primary no-underline hover:bg-primary-hover hover:no-underline"
            >
              Zu den Tickets
            </Link>
          </p>
        </div>
      </main>

      {/* `SourceNotice` bringt sein eigenes `<footer>` mit -- hier keines
          darum, sonst stünden zwei ineinander. */}
      <SourceNotice />
    </div>
  );
}
