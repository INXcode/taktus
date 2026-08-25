"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DrawerTrigger } from "@/components/shell/mobile-drawer";
import { tabsForRole } from "@/lib/navigation";
import { type AppRole } from "@/types";

/**
 * Feste untere Leiste auf Mobil, zwei bis drei Ziele je Rolle.
 *
 * Die Symbole sind 18-px-Kästen mit 1,5-px-Rahmen, eckig oder rund -- so
 * steht es im Entwurf. Keine Icon-Bibliothek, keine SVG: Der Entwurf hat
 * jedes Symbol dieser Anwendung auf eine geometrische Form zurückgeführt,
 * und das ist zugleich eine Lizenzfrage weniger.
 */
export function TabBar({ role }: { readonly role: AppRole }) {
  const pathname = usePathname();
  const tabs = tabsForRole(role);

  return (
    <nav
      aria-label="Bereiche"
      className="flex border-t border-border bg-card md:hidden"
    >
      {tabs.map((tab) => {
        const active =
          tab.href !== null &&
          (pathname === tab.href || pathname.startsWith(`${tab.href}/`));

        const content = (
          <>
            <span
              aria-hidden="true"
              className={`mx-auto mb-[5px] block size-[18px] border-[1.5px] ${
                tab.shape === "round" ? "rounded-full" : "rounded"
              } ${active ? "border-primary" : "border-faint"}`}
            />
            {tab.label}
          </>
        );

        const classes = `flex-1 px-1 py-2.5 text-center text-[11.5px] min-h-[52px] ${
          active ? "font-semibold text-primary-text" : "text-muted"
        }`;

        if (tab.href === null) {
          return (
            <DrawerTrigger
              key={tab.label}
              label="Navigation öffnen"
              className={classes}
            >
              {content}
            </DrawerTrigger>
          );
        }

        return (
          <Link
            key={tab.label}
            href={tab.href}
            {...(active ? { "aria-current": "page" } : {})}
            className={`${classes} no-underline hover:no-underline`}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
