import Link from "next/link";
import { DismissOnOutside } from "@/components/shell/dismiss-on-outside";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABEL } from "@/lib/labels/role";
import { paths } from "@/lib/paths";
import { type Viewer } from "@/lib/auth/session";

/**
 * Nutzermenü am Fuß der Seitenleiste.
 *
 * `<details>/<summary>` statt eines eigenen Popovers: Aufklappen per Tastatur,
 * `aria-expanded` und die Bedienung mit Screenreader kommen von der Plattform.
 * Zugekauft wird nur das, was `<details>` nicht kann -- Schließen bei Klick
 * nach außen und mit Escape, und das sind fünfzehn Zeilen in einem Blatt.
 *
 * Genau drei Einträge, wie im Entwurf. Die Rolle steht als **Text**, nicht als
 * Auswahl: Sie ist hier nicht änderbar, und ein Feld, das je nach Rolle mal
 * bearbeitbar wäre und mal nicht, wäre für alle der schlechtere Bildschirm.
 */
export function UserMenu({ viewer }: { readonly viewer: Viewer }) {
  return (
    <DismissOnOutside>
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md p-2 hover:bg-subtle [&::-webkit-details-marker]:hidden">
          <Avatar displayName={viewer.displayName} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">
              {viewer.displayName}
            </span>
            <span className="block font-mono text-xs text-muted">
              {ROLE_LABEL[viewer.role]}
            </span>
          </span>
          <span aria-hidden="true" className="ml-auto text-xs text-muted">
            ▾
          </span>
        </summary>

        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-[10px] border border-border bg-card shadow-md">
          <div className="border-b border-muted-surface px-3.5 py-3">
            <p className="text-sm font-semibold text-foreground">
              {viewer.displayName}
            </p>
            <p className="font-mono text-xs text-muted">
              {ROLE_LABEL[viewer.role]} · {viewer.tenantName}
            </p>
          </div>

          <Link
            href={paths.account}
            className="block px-3.5 py-2.5 text-sm text-body no-underline hover:bg-subtle hover:no-underline"
          >
            Mein Profil
          </Link>
          <Link
            href={paths.myData}
            className="block px-3.5 py-2.5 text-sm text-body no-underline hover:bg-subtle hover:no-underline"
          >
            Meine Daten
          </Link>

          {/*
            Abmelden per POST-Formular, nicht als Verweis. Ein zustandsänderndes
            GET liesse sich über ein fremdes <img src="…"> auslösen.
          */}
          <form
            action={paths.signOut}
            method="post"
            className="border-t border-muted-surface"
          >
            <button
              type="submit"
              className="w-full px-3.5 py-2.5 text-left text-sm text-body hover:bg-subtle"
            >
              Abmelden
            </button>
          </form>
        </div>
      </details>
    </DismissOnOutside>
  );
}
