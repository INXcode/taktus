/**
 * Initialen statt Bild.
 *
 * Es gibt keine Profilbilder und soll keine geben: ein Feld ohne Zweck, das
 * zugleich personenbezogene Daten trüge. Die Initialen stammen aus
 * `display_name` -- dem einzigen Namen, den das Schema kennt.
 */

const SIZES = {
  xs: "size-6 text-[10.5px]", // Tabellenzeile
  sm: "size-[26px] text-[10.5px]", // Kommentarkopf
  md: "size-8 text-[12.5px]", // Seitenleiste
  lg: "size-[34px] text-xs", // mobile Kopfzeile
  xl: "size-10 text-[13.5px]", // Nutzerdetail
} as const;

export type AvatarSize = keyof typeof SIZES;

/**
 * Erste Buchstaben der ersten beiden Wörter. `Intl.Segmenter` wäre genauer,
 * aber `display_name` ist ein freies Textfeld -- eine Zerlegung an
 * Leerzeichen trifft „Kim Musterbearbeitung" und scheitert bei nichts, was in
 * dieser Anwendung vorkommt.
 */
function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export function Avatar({
  displayName,
  size = "md",
  tone = "self",
}: {
  readonly displayName: string;
  readonly size?: AvatarSize;
  /**
   * `self` violett, `other` neutral. Der Unterschied trennt eigene von
   * fremden Beiträgen, ohne dass es nach Rangordnung aussieht.
   */
  readonly tone?: "self" | "other";
}) {
  const colours =
    tone === "self"
      ? "bg-primary-soft text-primary-text"
      : "bg-muted-surface text-status-waiting-text";

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${SIZES[size]} ${colours}`}
    >
      {initials(displayName)}
    </span>
  );
}
