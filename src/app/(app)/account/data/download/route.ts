import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { loadPersonData } from "@/lib/export/load";
import { personDataDownload, personDataError } from "@/lib/export/response";

/**
 * Die eigene Auskunft als Datei -- Bildschirm 21.
 *
 * Ein `GET`, obwohl er einen Protokolleintrag schreibt. Die übliche Regel
 * „`GET` ändert nichts" zielt darauf, dass ein fremder Verweis keinen Schaden
 * auslösen kann; hier wäre der Effekt ein Eintrag über einen Zugriff, der
 * tatsächlich stattgefunden hat. Ein Protokoll, das Zugriffe verschweigt,
 * weil sie über die falsche Methode kamen, wäre das grössere Problem.
 *
 * Ein Verweis statt eines Formulars, weil der Download genau das ist: eine
 * Adresse, die eine Datei liefert. Der Browser erledigt den Rest -- und die
 * Adresse lässt sich nicht versehentlich doppelt abschicken.
 */
export async function GET() {
  const viewer = await requireRole(ALL_ROLES);

  const result = await loadPersonData({
    profileId: viewer.userId,
    isSelf: true,
    reason: "download",
  });

  return result.ok
    ? personDataDownload(result.data, viewer.userId)
    : personDataError(result.reason);
}
