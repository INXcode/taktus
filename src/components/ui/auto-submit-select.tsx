"use client";

import { useRouter } from "next/navigation";
import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Select } from "@/components/ui/select";

/**
 * Ein Auswahlfeld in einem Filterformular, das die Liste sofort neu lädt.
 *
 * Verwendet von der Ticketliste, den Gesamtzeiten und der Kundenansicht.
 *
 * > [!important] Die Anwendung bleibt ohne JavaScript vollständig bedienbar.
 * > Das Filterband ist weiterhin ein `<form method="get">` und behält seinen
 * > Absendeknopf -- sichtbar dort, wo neben der Auswahl noch ein Freitextfeld
 * > steht, sonst in einem `<noscript>`. Dieses Blatt ist eine **Verbesserung
 * > obendrauf**: Wer Skripte hat, spart den zweiten Handgriff; wer keine hat,
 * > verliert nichts. Genau deshalb steht hier kein `onChange`-Handler auf
 * > einem Formular, das ohne ihn nicht abschickbar wäre.
 *
 * Der Sprung geht über `router.push` und nicht über `form.requestSubmit()`.
 * Ein nativer Absender lädt das Dokument neu, und der Fokus landet danach am
 * Seitenanfang -- wer mit der Tastatur durch vier Filter geht, wird nach jeder
 * Auswahl herausgeworfen. Die weiche Navigation zeichnet nur den Serverteil
 * neu; das Auswahlfeld behält den Fokus.
 *
 * Leere Werte fallen dabei heraus. Ein nativer GET-Absender schriebe
 * `?suche=&status=open&kategorie=&kunde=&zuweisung=&sortierung=neu` in die
 * Adresse -- teilbar ist so eine Zeile nur noch dem Namen nach.
 */
type AutoSubmitSelectProps = ComponentPropsWithoutRef<"select"> & {
  readonly children: ReactNode;
};

export function AutoSubmitSelect({
  children,
  ...props
}: AutoSubmitSelectProps) {
  const router = useRouter();

  return (
    <Select
      {...props}
      onChange={(event) => {
        const form = event.currentTarget.form;
        if (form === null) return;

        const query = new URLSearchParams();
        for (const [name, value] of new FormData(form).entries()) {
          // `FormData` kann auch Dateien liefern. Dieses Formular hat keine,
          // aber der Typ weiss das nicht -- und `String(File)` wäre stiller
          // Unsinn in der Adresse.
          if (typeof value === "string" && value !== "") {
            query.append(name, value);
          }
        }

        // Kein `page`: Wer den Filter ändert, will Seite 1 der neuen Auswahl
        // und nicht Seite 3 der alten. Das Formular führt das Feld gar nicht
        // erst mit, der Sprung setzt es damit von selbst zurück.
        const ziel = form.getAttribute("action") ?? window.location.pathname;
        const suffix = query.toString();
        router.push(suffix === "" ? ziel : `${ziel}?${suffix}`);
      }}
    >
      {children}
    </Select>
  );
}
