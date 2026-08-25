import { z } from "zod";

/**
 * Kunden -- Bildschirme 26 bis 28.
 *
 * Ein Kunde hat einen Namen und ein Aktiv-Kennzeichen. Sonst nichts: keine
 * Anschrift, keine Rufnummer, kein Ansprechpartner, kein Notizfeld. Das ist
 * keine Sparsamkeit aus Zeitmangel, sondern die Regel aus
 * `docs/datenmodell.md` -- ein Freitextfeld neben einem Firmennamen füllt sich
 * binnen Wochen mit Namen, Durchwahlen und Krankmeldungen, und danach ist
 * nicht mehr zu sagen, welche personenbezogenen Daten die Anwendung führt.
 *
 * Die Grenzen spiegeln die `CHECK`-Bedingungen aus
 * `20260806000000_kunden.sql`. Verbindlich ist die Datenbank; hier steht die
 * Meldung, damit sie am Feld erscheint statt als englischer PostgREST-Text.
 */

export const CUSTOMER_NAME_MAX = 200;

export const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(CUSTOMER_NAME_MAX, `Höchstens ${CUSTOMER_NAME_MAX} Zeichen.`);

/**
 * Die Kennung eines Kunden aus einem `<select>` oder einem versteckten Feld.
 *
 * Anders als `assigneeId` **ohne** Leerwert: Ein Ticket ohne Kunden gibt es
 * nicht, die Spalte ist `NOT NULL`. Ein leeres Feld ist deshalb ein Fehler und
 * keine Bedeutung.
 */
export const customerIdSchema = z.uuid({
  message: "Bitte einen Kunden wählen.",
});

export const createCustomerSchema = z.object({
  name: customerNameSchema,
});

export const updateCustomerSchema = z.object({
  customerId: customerIdSchema,
  name: customerNameSchema,
});

/**
 * Stilllegen und wieder aufnehmen.
 *
 * Wie `setDeactivatedSchema` bei den Nutzern deutschsprachige
 * Formularwerte statt `"true"`/`"false"`: Der Wert steht so im HTML und wird
 * so gelesen; eine Umdeutung von `"false"` nach `false` ist genau die Stelle,
 * an der eine fehlende Prüfung zu `true` wird.
 */
export const setCustomerActiveSchema = z.object({
  customerId: customerIdSchema,
  active: z.enum(["ja", "nein"]),
});
