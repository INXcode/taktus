"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type NavItem as NavItemData } from "@/lib/navigation";

/**
 * Ein Navigationspunkt mit der violetten Schiene, wenn er aktiv ist.
 *
 * Muss eine Client-Komponente sein, und zwar nur wegen `usePathname()`. Die
 * geprüften Alternativen scheitern beide daran, dass Next ein Layout bei
 * clientseitiger Navigation zwischen Geschwisterseiten **nicht** neu rendert:
 * Ein aus dem Proxy durchgereichter `x-pathname`-Header bliebe dann auf dem
 * vorigen Wert stehen, und die Schiene klebte an der falschen Zeile.
 *
 * Das Blatt trägt keine Daten -- nur Beschriftung und Adresse.
 */
export function NavItem({
  item,
  variant = "desktop",
}: {
  readonly item: NavItemData;
  readonly variant?: "desktop" | "drawer";
}) {
  const pathname = usePathname();

  // Genauer Treffer oder Unterpfad: `/admin/members/abc` hält „Nutzer"
  // aktiv. Die Wurzel `/tickets` würde sonst bei `/tickets/3` verlöschen.
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

  const size =
    variant === "drawer"
      ? "min-h-[var(--size-control-mobile)] px-2 py-3 text-md"
      : "min-h-[var(--size-control)] px-2 py-2.5 text-base";

  return (
    <Link
      href={item.href}
      {...(active ? { "aria-current": "page" } : {})}
      className={`flex items-center gap-[11px] rounded-md no-underline hover:no-underline ${size} ${
        active
          ? "bg-primary-soft font-semibold text-primary-text"
          : "text-field-label hover:bg-subtle"
      }`}
    >
      {/* Die Schiene steht auch inaktiv als leerer Platzhalter, damit die
          Beschriftungen aller Punkte auf einer Kante liegen. */}
      <span
        aria-hidden="true"
        className={`w-[3px] shrink-0 rounded-[2px] ${
          variant === "drawer" ? "h-[17px]" : "h-4"
        } ${active ? "bg-primary" : "bg-transparent"}`}
      />
      {item.label}
    </Link>
  );
}
