import { type SupabaseClient } from "@supabase/supabase-js";
import { type AuditAction, type AuditEntityType } from "@/lib/labels/audit";
import { type Database } from "@/types/database";

/**
 * Schreibt einen Protokolleintrag.
 *
 * `log_audit` ist der **einzige** Weg in `audit_log` -- die Tabelle hat keine
 * INSERT-Policy. Es gibt auch keinen Trigger: Jede Änderung, die protokolliert
 * gehört, ruft hier ausdrücklich auf. Das ist umständlicher als ein Trigger
 * und dafür ablesbar; ein vergessener Aufruf fällt beim Lesen der Action auf,
 * ein fehlender Trigger nicht.
 *
 * > [!warning] Nur Feldnamen, niemals Feldinhalte.
 * > `changed_fields` nimmt die **Namen** geänderter Spalten. Ein Protokoll mit
 * > alten und neuen Werten wäre eine zweite, länger aufbewahrte Kopie
 * > personenbezogener Daten -- und die taucht in keinem Löschkonzept auf.
 * > Eine Semgrep-Regel (`taktus-audit-log-mit-feldinhalten`) hält das fest.
 *
 * `action` und `entityType` sind an das Vokabular aus `lib/labels/audit.ts`
 * gebunden, nicht an `string`. Eine neue Aktion muss deshalb dort eingetragen
 * werden -- und erscheint damit im selben Zug im Filterband des Protokolls.
 * Ein Eintrag, den kein Filter kennt, ist einer, den niemand findet.
 */
export async function logAudit(
  client: SupabaseClient<Database>,
  action: AuditAction,
  entityType: AuditEntityType,
  entityId: string | null,
  changedFields?: readonly string[],
): Promise<void> {
  // `undefined` statt `null`: Die erzeugten Typen bilden die
  // DEFAULT-Parameter der Funktion als optional ab, nicht als nullbar. Ein
  // ausdrückliches `null` wäre ein Typfehler -- weggelassen greift der
  // Vorgabewert der Datenbank.
  const { error } = await client.rpc("log_audit", {
    p_action: action,
    p_entity_type: entityType,
    ...(entityId === null ? {} : { p_entity_id: entityId }),
    ...(changedFields === undefined
      ? {}
      : { p_changed_fields: [...changedFields] }),
  });

  if (error) {
    // Ein fehlgeschlagener Protokolleintrag darf den Vorgang nicht
    // zurückrollen -- die fachliche Änderung ist bereits geschehen, und ein
    // Abbruch hinterliesse den Nutzer mit einer Fehlermeldung zu einer
    // Aktion, die gewirkt hat. Gemeldet wird er trotzdem, mit Code statt
    // Meldung: Letztere kann Zeileninhalte zurückwerfen.
    console.error("Protokolleintrag fehlgeschlagen", {
      action,
      code: error.code,
    });
  }
}

/**
 * Ermittelt die geänderten Feldnamen.
 *
 * Vergleicht nur die Namen, gibt nur die Namen zurück -- die Werte verlassen
 * diese Funktion nicht.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): readonly string[] {
  return Object.keys(after).filter(
    (key) => after[key] !== undefined && after[key] !== before[key],
  );
}
