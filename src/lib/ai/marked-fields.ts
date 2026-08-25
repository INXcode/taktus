/**
 * `tickets.ai_marked_fields` -- welche Felder das Modell zuletzt geschrieben
 * hat, ohne dass jemand hingesehen hätte.
 *
 * > [!important] Der Eintrag bedeutet **nicht** „von der KI erzeugt", sondern
 * > „von der KI erzeugt und noch ungeprüft".
 * > Deshalb verschwindet er beim Speichern durch einen Menschen, und deshalb
 * > verschwindet mit ihm die Schraffur. Was bleibt, ist die Herkunftszeile --
 * > sie gehört zum Vorgang, nicht zur Kennzeichnung.
 *
 * In Release 1 gibt es genau **einen** markierbaren Feldnamen. Für einen
 * Kategorievorschlag existiert keine Spalte, in der Modellausgabe stünde: Der
 * Vorschlag auf Bildschirm 8 lebt nur im Formular, und „Übernehmen" ist dort
 * bereits die menschliche Prüfung. Ein Eintrag `category` würde eine
 * ungeprüfte Übernahme behaupten, die es nicht gibt.
 */

export const AI_FIELD_SUMMARY = "ai_summary";

/** Was diese Fassung kennzeichnen kann. */
export const AI_MARKABLE_FIELDS = [AI_FIELD_SUMMARY] as const;

export type AiMarkableField = (typeof AI_MARKABLE_FIELDS)[number];

export function isMarked(
  fields: readonly string[],
  field: AiMarkableField,
): boolean {
  return fields.includes(field);
}

/** Kennzeichnet ein Feld. Doppelt kennzeichnen ändert nichts. */
export function markField(
  fields: readonly string[],
  field: AiMarkableField,
): readonly string[] {
  return fields.includes(field) ? fields : [...fields, field];
}

/**
 * Ein Mensch hat hingesehen -- die Kennzeichnung fällt weg.
 *
 * > [!note] Unbekannte Feldnamen bleiben stehen.
 * > Das ist keine Nachlässigkeit. Ein Name, den diese Fassung nicht kennt,
 * > stammt aus einer neueren -- und eine ältere Oberfläche darf eine
 * > Kennzeichnung nicht stillschweigend entfernen, die sie gar nicht
 * > darstellen konnte. Sonst löschte ein Zurückrollen der Anwendung den
 * > Hinweis auf ungeprüfte Modellausgabe, und niemand merkte es.
 *
 * Mehrfaches Anwenden ändert nichts mehr: Prüfen ist ein Zustand, kein
 * Ereignis.
 */
export function applyReview(
  fields: readonly string[],
  reviewed: AiMarkableField,
): readonly string[] {
  return fields.filter((field) => field !== reviewed);
}
