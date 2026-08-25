import { z } from "zod";
import { RETENTION_MAX, RETENTION_MIN } from "@/lib/format/retention";

/**
 * Mandanteneinstellungen -- Bildschirm 18.
 *
 * Vier Werte, mehr gibt es nicht: Name, zwei Fristen, KI-Freigabe. Kein Feld
 * für Anbieter, Modell oder Zugangsschlüssel -- die gehören dem Betreiber der
 * Instanz und sind für **jede** Rolle unerreichbar, auch für die Verwaltung.
 * `ai_config` hat RLS aktiv und keine einzige Policy; dieses Schema bildet
 * das ab, indem es die Felder gar nicht erst kennt.
 */

export const TENANT_NAME_MAX = 200;

export const tenantNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen für den Mandanten eingeben.")
  .max(TENANT_NAME_MAX, `Höchstens ${TENANT_NAME_MAX} Zeichen.`);

/**
 * Eine Frist kommt als Zeichenkette aus dem Formular.
 *
 * Geprüft wird zuerst die Form, dann der Bereich: `Number("12 Tage")` ist
 * `NaN`, `Number("")` ist 0, und `Number("1e3")` ist 1000 -- alle drei würden
 * eine reine Bereichsprüfung überstehen oder verwirrend scheitern. Die
 * Zeichenkette muss deshalb aus Ziffern bestehen, bevor sie eine Zahl wird.
 */
function retentionSchema(subject: string) {
  return z
    .string()
    .trim()
    .regex(
      /^\d{1,4}$/,
      `Bitte die Frist für ${subject} in ganzen Tagen angeben.`,
    )
    .transform(Number)
    .refine(
      (days) => days >= RETENTION_MIN && days <= RETENTION_MAX,
      `Zulässig sind ${RETENTION_MIN} bis ${RETENTION_MAX} Tage.`,
    );
}

export const updateTenantSettingsSchema = z.object({
  name: tenantNameSchema,
  ticketRetentionDays: retentionSchema("Tickets"),
  auditRetentionDays: retentionSchema("das Protokoll"),
  // Ein nicht angehaktes Kästchen kommt gar nicht erst im FormData an. Die
  // Action leitet daraus einen Wahrheitswert ab; hier steht deshalb ein
  // `boolean` und keine Zeichenkette.
  aiEnabled: z.boolean(),
});
