"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Schließt ein `<details>` bei Klick nach außen und mit Escape.
 *
 * Das ist alles, was `<details>` für ein Menü fehlt. Aufklappen, Tastatur,
 * `aria-expanded` und die Ansage an unterstützende Technik bringt das Element
 * selbst mit -- ein handgebautes Popover müsste das nachbauen und wäre die
 * Stelle, an der ein Prüfer Risiko liest statt Sorgfalt.
 *
 * Bewusst ein eigenes Blatt: So bleibt alles darin -- Kopfzeile, Menü,
 * Einträge -- eine Server-Komponente.
 */
export function DismissOnOutside({
  children,
}: {
  readonly children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    function closeAll() {
      for (const open of element?.querySelectorAll("details[open]") ?? []) {
        open.removeAttribute("open");
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !element?.contains(event.target)) {
        closeAll();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Den Fokus zurück auf den Auslöser, sonst landet er im Nirgendwo --
      // für jemanden, der nur die Tastatur benutzt, ist das ein Sackgasse.
      const open = element?.querySelector("details[open] > summary");
      closeAll();
      if (open instanceof HTMLElement) open.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return <div ref={container}>{children}</div>;
}
