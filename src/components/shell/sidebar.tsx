import { NavItem } from "@/components/shell/nav-item";
import { BrandMark } from "@/components/brand-mark";
import { UserMenu } from "@/components/shell/user-menu";
import { type Viewer } from "@/lib/auth/session";
import { navigationForRole } from "@/lib/navigation";

/**
 * Seitenleiste, Desktop. 248 px, gedämpfte Fläche, Nutzerblock unten
 * angeheftet.
 *
 * **Kein Mandantenwechsler.** Es gibt keine mandantenübergreifende Rolle, also
 * auch nichts zu wechseln; der Mandantenname steht als Text in der Kopfzeile.
 * **Keine Glocke, kein Zähler:** Realtime ist abgeschaltet, nichts läuft von
 * selbst hoch, und eine Anzeige, die es behauptete, wäre eine Lüge auf dem
 * Bildschirm.
 */
export function Sidebar({ viewer }: { readonly viewer: Viewer }) {
  const groups = navigationForRole(viewer.role);

  return (
    <div className="flex h-full w-[var(--size-sidebar)] shrink-0 flex-col border-r border-border bg-subtle px-3.5 py-5">
      <p className="flex items-center gap-2.5 px-2 pb-5">
        <BrandMark className="size-3.5 shrink-0 text-primary" />
        <span className="text-[15.5px] font-bold text-foreground">
          Taktus Kontor
        </span>
      </p>

      <nav aria-label="Hauptnavigation" className="flex flex-col">
        {groups.map((group, index) => (
          <div key={group.title ?? `gruppe-${index}`}>
            {group.title !== undefined ? (
              <p
                className={`px-2 pb-2 font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase ${index > 0 ? "pt-5" : ""}`}
              >
                {group.title}
              </p>
            ) : null}
            <ul className="flex list-none flex-col gap-0.5 p-0">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavItem item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-border pt-3.5">
        <UserMenu viewer={viewer} />
      </div>
    </div>
  );
}
