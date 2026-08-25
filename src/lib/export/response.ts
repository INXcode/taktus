import "server-only";

import { exportFileName } from "@/lib/export/load";
import { type PersonData } from "@/lib/export/person-data";

/**
 * Die Auskunft als Datei.
 *
 * `no-store` ist hier kein Zierrat: Die Datei enthält personenbezogene Daten
 * und hat in keinem Zwischenspeicher etwas verloren -- weder im Browser noch
 * in einem Vermittler davor.
 *
 * Steht in `lib/` und nicht in der Routendatei: Ein `route.ts` darf nur
 * HTTP-Methoden ausführen; jeder weitere Export dort bricht den Build.
 */
export function personDataDownload(
  data: PersonData,
  profileId: string,
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(profileId, data.erstellt_am)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Der Fehlerfall -- als Klartext, nicht als JSON.
 *
 * Wer eine Datei erwartet und stattdessen eine bekommt, in der eine
 * Fehlermeldung steht, merkt es unter Umständen erst spät. Ein `text/plain`
 * mit passendem Status ist unmissverständlich.
 */
export function personDataError(reason: "denied" | "missing" | "malformed") {
  const status = reason === "denied" ? 403 : 500;
  const text =
    reason === "denied"
      ? "Für diese Auskunft fehlt die Berechtigung."
      : "Die Auskunft ist derzeit nicht abrufbar. Ihr Auskunftsanspruch besteht unabhängig davon.";

  return new Response(text, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}
