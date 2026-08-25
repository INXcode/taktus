import { type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { DrawerTrigger, MobileDrawer } from "@/components/shell/mobile-drawer";
import { NavItem } from "@/components/shell/nav-item";
import { Sidebar } from "@/components/shell/sidebar";
import { TabBar } from "@/components/shell/tab-bar";
import { UserMenu } from "@/components/shell/user-menu";
import { SourceNotice } from "@/components/source-notice";
import { Avatar } from "@/components/ui/avatar";
import { type Viewer } from "@/lib/auth/session";
import { navigationForRole } from "@/lib/navigation";

/**
 * Bildschirm 5 -- der Rahmen um alles Angemeldete.
 *
 * Desktop: Seitenleiste 248 px, Kopfzeile 64 px, Inhalt 28 px Abstand,
 * §13-Fußzeile unten. Mobil: Kopfleiste 56 px mit Hamburger, Schublade von
 * links, feste untere Leiste.
 *
 * Die Fußzeile liegt **hier** und nicht auf einer Seite: §13 AGPL verlangt
 * den Quelltexthinweis dort, wo über das Netz mit der Anwendung gearbeitet
 * wird -- also auf jedem Bildschirm, mit Version und Commit.
 */
export function AppShell({
  viewer,
  title,
  action,
  children,
}: {
  readonly viewer: Viewer;
  /** Die aktuelle Seite, rechts neben dem Mandantennamen. */
  readonly title: string;
  /** Rechtsbündige Hauptaktion der Seite, etwa „Ticket anlegen". */
  readonly action?: ReactNode;
  readonly children: ReactNode;
}) {
  const groups = navigationForRole(viewer.role);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* ---------- Desktop ---------- */}
      <div className="hidden md:block">
        <Sidebar viewer={viewer} />
      </div>

      {/* ---------- Mobil: Kopfleiste ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 md:hidden">
        <DrawerTrigger
          label="Navigation öffnen"
          className="flex size-10 shrink-0 flex-col items-center justify-center gap-[3.5px] rounded-md bg-muted-surface"
        >
          <span aria-hidden="true" className="h-[1.5px] w-4 bg-body" />
          <span aria-hidden="true" className="h-[1.5px] w-4 bg-body" />
          <span aria-hidden="true" className="h-[1.5px] w-4 bg-body" />
        </DrawerTrigger>
        <span className="truncate text-[14.5px] font-semibold text-foreground">
          {title}
        </span>
        <span className="ml-auto">
          <Avatar displayName={viewer.displayName} size="lg" />
        </span>
      </header>

      <MobileDrawer>
        <p className="flex items-center gap-2.5 px-2 pb-2">
          <BrandMark className="size-3.5 shrink-0 text-primary" />
          <span className="text-md font-bold text-foreground">
            Taktus Kontor
          </span>
        </p>
        <p className="px-2 pb-4 text-sm text-muted">{viewer.tenantName}</p>

        <nav aria-label="Hauptnavigation" className="flex flex-col">
          {groups.map((group, index) => (
            <div key={group.title ?? `gruppe-${index}`}>
              {group.title !== undefined ? (
                <p
                  className={`px-2 pb-2 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase ${index > 0 ? "pt-4" : ""}`}
                >
                  {group.title}
                </p>
              ) : null}
              <ul className="flex list-none flex-col p-0">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavItem item={item} variant="drawer" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          <UserMenu viewer={viewer} />
        </div>
      </MobileDrawer>

      {/* ---------- Inhalt ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-16 shrink-0 items-center gap-3.5 border-b border-border px-7 md:flex">
          <span className="text-base font-semibold text-foreground">
            {viewer.tenantName}
          </span>
          <span aria-hidden="true" className="h-[18px] w-px bg-border" />
          <span className="text-sm text-muted">{title}</span>
          {action !== undefined ? (
            <span className="ml-auto">{action}</span>
          ) : null}
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-7">{children}</main>

        <SourceNotice />
        <TabBar role={viewer.role} />
      </div>
    </div>
  );
}
