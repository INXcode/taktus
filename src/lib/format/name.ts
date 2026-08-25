/**
 * `Kim Musterbearbeitung` → `Kim M.`
 *
 * So kürzt der Entwurf Personen in Tabellen ab. Der volle Name steht daneben
 * im `title`-Attribut, damit die Kurzform nichts verschluckt.
 *
 * Bei einem einteiligen Namen bleibt er stehen -- „Kim." wäre schlicht falsch.
 */
export function shortName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/u).filter(Boolean);
  if (parts.length < 2) return displayName.trim();

  const first = parts[0] ?? "";
  const lastInitial = [...(parts.at(-1) ?? "")][0] ?? "";
  return lastInitial === "" ? first : `${first} ${lastInitial}.`;
}
