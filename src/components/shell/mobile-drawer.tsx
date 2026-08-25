"use client";

import { useRef, type ReactNode } from "react";

const DRAWER_ID = "hauptnavigation-schublade";

/**
 * Die Navigationsschublade auf Mobil.
 *
 * Ein natives `<dialog>` mit `showModal()`. Damit kommen Fokusfalle, Escape,
 * `inert` für den Hintergrund und der Verdunkler als `::backdrop` von der
 * Plattform -- vier Dinge, die eine handgebaute Schublade einzeln nachbauen
 * müsste und bei denen jedes Vergessen erst mit Screenreader auffällt.
 *
 * Client ist nur die Hülle, weil `showModal()` im Browser laufen muss. Die
 * **Kinder kommen aus einer Server-Komponente** -- die Navigation selbst
 * bleibt serverseitig gerendert.
 */
export function MobileDrawer({ children }: { readonly children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <dialog
      id={DRAWER_ID}
      ref={dialog}
      aria-label="Hauptnavigation"
      // `m-0 h-full max-h-full` hebt die Zentrierung auf, die `<dialog>` von
      // sich aus vornimmt -- die Schublade sitzt links und geht durch.
      // `md:hidden` nicht nur der Optik wegen: Ohne die Regel stünde die
      // Navigation auf Desktop ein zweites Mal im Baum -- einmal in der
      // Seitenleiste, einmal hier. Ein Screenreader fände dann zwei
      // Landmarken „Hauptnavigation", und der Nutzerblock läge doppelt vor.
      className="m-0 h-full max-h-full w-[272px] max-w-[85vw] border-r border-border bg-card p-0 shadow-[12px_0_40px_rgb(26_27_29_/_0.14)] backdrop:bg-overlay md:hidden"
      onClick={(event) => {
        // Klick auf den Verdunkler schließt. Das Ereignis trifft dann das
        // <dialog> selbst, nie ein Kind darin.
        if (event.target === dialog.current) dialog.current?.close();
      }}
    >
      <div className="flex h-full flex-col px-3 py-4.5">{children}</div>
    </dialog>
  );
}

/**
 * Öffnet die Schublade. Wird zweimal gebraucht: als Hamburger in der
 * Kopfzeile und als „Mehr" in der unteren Leiste.
 *
 * Sucht den Dialog über die Kennung statt über einen geteilten Zustand --
 * sonst müsste ein Kontext quer durch den Rahmen gereicht werden, und die
 * Kopfzeile wäre nur deshalb eine Client-Komponente.
 */
export function DrawerTrigger({
  children,
  className,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      className={className}
      onClick={() => {
        const element = document.getElementById(DRAWER_ID);
        if (element instanceof HTMLDialogElement) element.showModal();
      }}
    >
      {children}
    </button>
  );
}
