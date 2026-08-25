import { requireRole } from "@/lib/auth/guard";
import { loadPersonData } from "@/lib/export/load";
import { personDataDownload, personDataError } from "@/lib/export/response";
import { createClient } from "@/lib/supabase/server";

/**
 * Die Auskunft für einen Nutzer als Datei -- Bildschirm 22. Nur `admin`.
 *
 * Die Mandantenprüfung steht hier ausgeschrieben, obwohl `export_person_data`
 * sie selbst noch einmal vornimmt. Das ist kein Versehen und keine
 * Verdopplung aus Misstrauen: Ohne sie liefe die Kennung aus der Adresse
 * ungeprüft in eine SECURITY-DEFINER-Funktion, und die Sicherheit dieses
 * Aufrufs hinge allein daran, dass in einer anderen Datei eine Prüfung
 * steht. Zwei Schlösser an einer Tür, die auf fremde personenbezogene Daten
 * führt.
 */
export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly id: string }> },
) {
  const viewer = await requireRole(["admin"]);
  const { id } = await params;

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (member === null) {
    // Unter RLS nicht auffindbar heisst: gehört nicht zu diesem Mandanten,
    // oder es gibt sie nicht. Beides beantwortet dieselbe Meldung -- welcher
    // der beiden Fälle vorliegt, geht den Aufrufer nichts an.
    return personDataError("denied");
  }

  const result = await loadPersonData({
    profileId: member.id,
    isSelf: member.id === viewer.userId,
    reason: "download",
  });

  return result.ok
    ? personDataDownload(result.data, member.id)
    : personDataError(result.reason);
}
