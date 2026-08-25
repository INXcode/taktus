/**
 * Das Zeichen von Taktus Kontor: vier Balken im Raster 32 x 32.
 *
 * **Die Form hat einen Grund.** Die Hoehen folgen der Akzentfolge eines
 * Vierertakts -- stark, schwach, mittel, schwach. Daher der Name: ein Takt
 * ist das, was das Zeichen zeigt. Ein Nebeneffekt, der hier passt: Dieselbe
 * Figur liest sich als Balken ueber einer Zeitachse, und Zeiterfassung ist
 * die zweite Haelfte dieser Anwendung.
 *
 * **Warum kein Firmenlogo.** Das Zeichen von INX Systems stand hier
 * zwischenzeitlich und ist bewusst wieder entfernt worden, aus zwei
 * unabhaengigen Gruenden. Rechtlich: Das Repository steht unter AGPL-3.0,
 * und die AGPL raeumt Rechte am Urheberrecht ein, nicht am Kennzeichenrecht
 * -- eine Marke laesst sich so nicht mitliefern, ohne entweder zu viel zu
 * versprechen oder einen Sonderfall zu erfinden. Fachlich: Diese Anwendung
 * laeuft bei fremden Betreibern. Das Zeichen des Herstellers waere auf deren
 * Bildschirmen schlicht die falsche Absenderangabe.
 *
 * **Warum als Pfad im Code und nicht als Datei unter `public/`.** Das Zeichen
 * steht neben dem Schriftzug auf jedem Bildschirm, auch auf den
 * unangemeldeten. Als `<img>` waere es ein zweiter Netzabruf vor dem ersten
 * sinnvollen Bild und truege im dunklen Farbschema die falsche Farbe.
 * Eingebettet kostet es rund 0,3 kB im HTML und kommt mit der Seite.
 *
 * **`currentColor`, nicht `#97005e`.** Die Rufstelle setzt `text-primary`;
 * das Zeichen haengt damit an `--color-primary` statt an einem zweiten
 * Literal, das beim naechsten Palettenwechsel uebersehen wuerde. Das ist
 * nicht theoretisch: In `globals.css` liegt eine dunkle Palette fertig, aber
 * stumm auskommentiert vor, und sie setzt `--color-primary` auf `#e08fbd` --
 * der helle Markenton haette auf dunkler Flaeche zu wenig Abstand. Wird der
 * Block scharf geschaltet, geht das Zeichen ohne Aenderung hier mit.
 *
 * Die Dateien unter `src/app/` -- `icon.svg`, `favicon.ico`, `apple-icon.png`
 * -- zeigen dieselben vier Balken. Aendert sich die Form, aendern sie sich
 * mit; erzeugt werden sie aus denselben vier Rechtecken.
 *
 * Rein schmueckend: Der Name steht als Text daneben, weshalb hier bewusst
 * kein `role` und kein `aria-label` gesetzt ist.
 */
export function BrandMark({ className }: { readonly className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="5" height="32" rx="1.5" />
      <rect x="9" y="16" width="5" height="16" rx="1.5" />
      <rect x="18" y="8" width="5" height="24" rx="1.5" />
      <rect x="27" y="16" width="5" height="16" rx="1.5" />
    </svg>
  );
}
