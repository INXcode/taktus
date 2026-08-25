import "server-only";

import { logAudit } from "@/lib/audit";
import { parsePersonData, type PersonData } from "@/lib/export/person-data";
import { createClient } from "@/lib/supabase/server";

/**
 * Holt die Auskunft für eine Person -- Bildschirme 21, 22 und beide Downloads.
 *
 * > [!important] Über den **normalen** Client, nicht über den Admin-Client.
 * > `export_person_data` ist an `authenticated` vergeben und prüft selbst:
 * > eigene Daten oder Administrator desselben Mandanten, sonst 42501. Der
 * > Service-Role-Schlüssel würde diese Prüfung gerade abschalten -- das wäre
 * > an der Stelle, an der es um fremde personenbezogene Daten geht, die
 * > falsche Richtung. Die Autorisierung bleibt dort, wo sie geprüft werden
 * > kann.
 */
export type ExportResult =
  | { readonly ok: true; readonly data: PersonData }
  | { readonly ok: false; readonly reason: "denied" | "missing" | "malformed" };

/**
 * Wann ein Protokolleintrag entsteht.
 *
 * | Fall                          | Ansicht | Datei |
 * | ----------------------------- | ------- | ----- |
 * | Auskunft über eine **andere** Person | ja | ja |
 * | Auskunft über sich selbst     | nein    | ja    |
 *
 * Die Regel dahinter: Ein Zugriff auf die Daten eines anderen wird
 * festgehalten, sobald er stattfindet -- der Entwurf verlangt für
 * Bildschirm 22 ausdrücklich `profile.export` im Protokoll. Die eigenen Daten
 * anzusehen ist dagegen kein fremder Zugriff; jedes Nachladen der Seite als
 * Ereignis zu führen, machte das Protokoll unlesbar, ohne etwas zu belegen.
 * Beim Herunterladen wird auch das eigene Ergebnis vermerkt: Ab da liegt eine
 * Datei ausserhalb der Anwendung.
 */
export async function loadPersonData({
  profileId,
  isSelf,
  reason,
}: {
  readonly profileId: string;
  readonly isSelf: boolean;
  readonly reason: "view" | "download";
}): Promise<ExportResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("export_person_data", {
    p_profile_id: profileId,
  });

  if (error) {
    // Nur der Code. Die Meldung von PostgREST kann Zeileninhalte zurückwerfen
    // -- ausgerechnet hier wäre das Personenbezug im Protokoll des Servers.
    console.error("Auskunft nicht abrufbar", { code: error.code });
    return {
      ok: false,
      reason: error.code === "42501" ? "denied" : "missing",
    };
  }

  let parsed: PersonData;
  try {
    parsed = parsePersonData(data);
  } catch {
    // Die Funktion hat geantwortet, aber nicht in der erwarteten Form. Eine
    // halbe Auskunft auszuliefern wäre schlimmer als keine: Die Person könnte
    // nicht erkennen, dass etwas fehlt.
    console.error("Auskunft in unerwarteter Form");
    return { ok: false, reason: "malformed" };
  }

  if (!isSelf || reason === "download") {
    await logAudit(supabase, "profile.export", "profile", profileId);
  }

  return { ok: true, data: parsed };
}

/**
 * Der Dateiname des Downloads.
 *
 * Er trägt **keinen** Namen und keine Adresse: Eine Datei mit
 * personenbezogenen Daten landet im Download-Ordner, wird weitergereicht und
 * taucht in Verlaufslisten auf -- der Name muss dabei nicht mitlaufen. Die
 * Kennung genügt, um sie zuzuordnen, und sie steht ohnehin in der Datei.
 */
export function exportFileName(profileId: string, createdAt: string): string {
  const day = createdAt.slice(0, 10);
  return `auskunft-${profileId}-${day}.json`;
}
