import { z } from "zod";
import { AI_SUMMARY_MAX } from "@/lib/ai/schema";
import { CATEGORY_ORDER } from "@/lib/labels/category";
import { STATUS_ORDER } from "@/lib/labels/status";
import { customerIdSchema } from "@/lib/validation/customer";

/**
 * Schemata rund um Tickets.
 *
 * Die Grenzen spiegeln die `CHECK`-Bedingungen aus
 * `20260804000000_initial_schema.sql`. Sie ersetzen die Datenbank nicht --
 * dort liegt die verbindliche Prüfung -- sondern sorgen dafür, dass die
 * Rückmeldung am Feld erscheint statt als englische Meldung aus PostgREST.
 *
 * Weicht das Schema ab, weicht diese Datei ab; die Tests halten die Grenzen
 * fest und sind damit der Abweichungsmelder.
 */

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 20_000;

export const ticketTitleSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Titel eingeben.")
  .max(TITLE_MAX, `Höchstens ${TITLE_MAX} Zeichen.`);

export const ticketDescriptionSchema = z
  .string()
  .max(DESCRIPTION_MAX, `Höchstens ${DESCRIPTION_MAX} Zeichen.`);

export const ticketStatusSchema = z.enum(STATUS_ORDER, {
  message: "Unbekannter Status.",
});

export const ticketCategorySchema = z.enum(CATEGORY_ORDER, {
  message: "Unbekannte Kategorie.",
});

/**
 * Die rechte Spalte aus Bildschirm 9 -- Status, Kategorie, Kunde und Zuweisung
 * in **einer** Action.
 *
 * Zusammen und nicht einzeln, aus zwei Gründen: Es entsteht ein
 * Protokolleintrag statt vierer, und ein Wechsel von „offen, unzugewiesen" zu
 * „in Bearbeitung, Kim" ist fachlich ein Vorgang, keine vier.
 *
 * `assigneeId` ist ein leerer String, wenn nicht zugewiesen -- so kommt es aus
 * dem `<select>`. Die Umwandlung nach `null` passiert hier und nicht in der
 * Action, damit sie nur an einer Stelle steht. `customerId` kennt diesen
 * Leerwert bewusst **nicht**: Ein Ticket ohne Kunden gibt es nicht.
 */
export const ticketMetaSchema = z.object({
  ticketId: z.uuid({ message: "Ungültige Ticketkennung." }),
  status: ticketStatusSchema,
  category: ticketCategorySchema,
  customerId: customerIdSchema,
  assigneeId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Ungültige Zuweisung.",
    ),
});

/** Titel und Beschreibung -- was ein Melder an seinem offenen Ticket ändern darf. */
export const ticketContentSchema = z.object({
  ticketId: z.uuid({ message: "Ungültige Ticketkennung." }),
  title: ticketTitleSchema,
  description: ticketDescriptionSchema,
});

/**
 * Ticket anlegen (Bildschirm 8) -- aus Sicht von Bearbeitung und Verwaltung.
 *
 * Nummer, Melder und Status setzt der Server -- ein Formular sendet sie nie
 * mit. Der Kunde dagegen ist hier eine Eingabe: Wer quer über alle Kunden
 * arbeitet, muss sagen, für wen der Vorgang läuft.
 */
export const createTicketSchema = z.object({
  title: ticketTitleSchema,
  description: ticketDescriptionSchema,
  category: ticketCategorySchema,
  customerId: customerIdSchema,
  assigneeId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Ungültige Zuweisung.",
    ),

  /*
   * Eine übernommene KI-Zusammenfassung, oder leer.
   *
   * Sie kommt aus einem versteckten Feld und ist damit **Nutzereingabe** --
   * dass sie in der Oberfläche aus einem Vorschlag stammte, weiss der Server
   * nicht und darf er nicht annehmen. Also dieselbe Grenze wie in der Spalte,
   * und nicht mehr Vertrauen als für jeden anderen Formularwert.
   */
  aiSummary: z
    .string()
    .max(AI_SUMMARY_MAX, `Höchstens ${AI_SUMMARY_MAX} Zeichen.`),

  /*
   * Der Herkunftsnachweis zur Zusammenfassung, oder leer.
   *
   * Genau deshalb steht im Absatz darüber „weiss der Server nicht": Ohne
   * Nachweis weiss er es tatsächlich nicht. Mit Nachweis schon -- die
   * Unterschrift bindet Text, Kategorie, Modell, Zeitpunkt und Nutzer
   * aneinander und wird in `createTicket` geprüft, nicht geglaubt.
   *
   * Die Länge ist nur eine Plausibilitätsschranke gegen einen
   * Formularwert, der die Signaturprüfung gar nicht erst beschäftigen muss.
   */
  aiToken: z.string().max(1024),
});

/**
 * Dieselbe Maske aus Sicht des Melders -- ohne Kunde und ohne Zuweisung.
 *
 * Beides fehlt nicht aus Platzgründen: Ein Melder gehört zu genau einem
 * Kunden, und welcher das ist, steht in seinem Profil. Würde das Formular ihn
 * mitschicken, wäre der Kunde eine Eingabe -- und ein untergeschobenes Feld
 * genügte, um einen Vorgang auf fremde Rechnung zu buchen. Er wird deshalb
 * hier nicht angenommen und in der Datenbank vom Trigger gesetzt.
 *
 * Abgeleitet statt abgeschrieben: Eine spätere Grenze am Titel gilt so auch
 * für Meldungen, ohne dass jemand daran denken muss.
 *
 * Der `transform` setzt beide Felder auf `null` -- nicht um sie doch noch
 * einzuführen, sondern damit beide Schemata **dieselbe Form** liefern. Die
 * Action muss dann nicht zwischen zwei Gestalten unterscheiden, und `null`
 * heisst an dieser einen Stelle unmissverständlich „wurde nicht erhoben".
 */
export const createReportSchema = createTicketSchema
  .omit({ customerId: true, assigneeId: true })
  .transform((value) => ({ ...value, customerId: null, assigneeId: null }));

/**
 * Die Prüfung einer KI-Zusammenfassung -- der Übergang markiert → geprüft.
 *
 * Der Text ist änderbar, und das ist der Punkt: Prüfen heisst hinsehen und
 * gegebenenfalls berichtigen, nicht abnicken. Ein reiner „Gelesen"-Knopf
 * hätte dieselbe Wirkung auf `ai_marked_fields` und wäre trotzdem etwas
 * anderes -- er belegte, dass jemand geklickt hat, nicht dass jemand
 * hingesehen hat.
 */
export const reviewAiSummarySchema = z.object({
  ticketId: z.uuid({ message: "Ungültige Ticketkennung." }),
  aiSummary: z
    .string()
    .trim()
    .min(1, "Bitte einen Text eingeben oder die Zusammenfassung entfernen.")
    .max(AI_SUMMARY_MAX, `Höchstens ${AI_SUMMARY_MAX} Zeichen.`),
});

/**
 * Löschen mit getippter Bestätigung (Bildschirm 11).
 *
 * Die Nummer wird als Text entgegengenommen und erst serverseitig verglichen.
 * Ein `confirm()` genügt hier nicht: Gelöscht werden mit dem Ticket auch
 * seine Kommentare und Zeitbuchungen, und das lässt sich nicht zurückholen.
 */
export const deleteTicketSchema = z.object({
  ticketId: z.uuid({ message: "Ungültige Ticketkennung." }),
  confirmation: z.string().trim(),
});
