/**
 * Aufbewahrungsfristen lesbar machen.
 *
 * Der Entwurf verlangt auf Bildschirm 18 neben dem Feld „730" die Angabe
 * „= 2 Jahre". Das ist kein Schmuck: Eine Frist in Tagen lässt sich eintippen,
 * aber nicht beurteilen. Wer 1095 sieht, weiss nicht, ob das lang ist; wer
 * „= 3 Jahre" daneben liest, entscheidet.
 *
 * Die Grenzen spiegeln den `CHECK` der Tabelle. Weichen sie ab, ist die
 * Anwendung nachlässiger oder strenger als die Datenbank -- beides ist ein
 * Fehler, und der Test darauf ist der Melder.
 */

export const RETENTION_MIN = 30;
export const RETENTION_MAX = 3650;

/**
 * Die Umrechnung ist bewusst ungefähr -- und sagt das.
 *
 * Ein Jahr hat nicht 365 Tage, ein Monat nicht 30. „= rund 4 Monate" ist
 * deshalb ehrlicher als eine Kommastelle, die Genauigkeit vortäuscht, die
 * nicht besteht. Nur was ohne Rest aufgeht, steht ohne „rund" da: 730 Tage
 * sind zwei Jahre, so hat der Betreiber sie gemeint.
 */
export function describeRetention(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "";

  if (days % 365 === 0) {
    const years = days / 365;
    return years === 1 ? "= 1 Jahr" : `= ${years} Jahre`;
  }

  if (days < 365) {
    const months = Math.round(days / 30);
    return months <= 1 ? "= rund 1 Monat" : `= rund ${months} Monate`;
  }

  const years = Math.round((days / 365) * 10) / 10;
  if (years === 1) return "= rund 1 Jahr";

  // Deutsches Dezimalkomma, von Hand statt über `Intl`: Die Funktion soll
  // rein und ohne Gebietsschema-Abhängigkeit prüfbar bleiben.
  return `= rund ${String(years).replace(".", ",")} Jahre`;
}
