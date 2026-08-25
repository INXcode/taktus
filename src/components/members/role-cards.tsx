"use client";

import { ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/labels/role";
import { type AppRole } from "@/types";

const ORDER = ["requester", "agent", "admin"] as const;

/**
 * Die Rollenauswahl aus Bildschirm 16.
 *
 * Drei Karten mit **erklärenden Sätzen statt Kürzeln**. Wer einen Nutzer
 * anlegt, entscheidet damit über Zugriff auf personenbezogene Daten -- die
 * Entscheidung soll aus der Beschreibung folgen und nicht aus dem Erraten
 * eines Wortes.
 *
 * Drei `<input type="radio">`, über `:has()` als Karten gestaltet: keine Zeile
 * JavaScript, Tastaturbedienung und Gruppenansage kommen vom Browser.
 * Aufsteigend nach Reichweite -- die folgenreichste Wahl steht zuletzt.
 */
export function RoleCards({
  name = "role",
  defaultValue = "requester",
  onRoleChange,
}: {
  readonly name?: string;
  readonly defaultValue?: AppRole;
  /**
   * Meldet die getroffene Wahl, damit das Kundenfeld daneben erscheinen oder
   * verschwinden kann.
   *
   * Die Knöpfe bleiben dabei **ungesteuert**. Ein gesteuertes Feld verlöre
   * seinen Wert, wenn React das Formular nach der Action zurücksetzt -- ein
   * Fehler, der in diesem Projekt schon einmal gebaut wurde und im Browser
   * genau einen Klick lang sichtbar war.
   */
  readonly onRoleChange?: (role: AppRole) => void;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1.5 text-sm font-semibold text-field-label">
        Rolle
      </legend>
      <div className="flex flex-col gap-2.5">
        {ORDER.map((role) => (
          <label
            key={role}
            className="flex cursor-pointer gap-3 rounded-md border border-border-strong p-3.5 has-checked:border-primary has-checked:bg-primary-soft"
          >
            <input
              type="radio"
              name={name}
              value={role}
              defaultChecked={role === defaultValue}
              onChange={() => onRoleChange?.(role)}
              className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span>
              <span className="block text-base font-semibold text-foreground">
                {ROLE_LABEL[role]}
              </span>
              <span className="mt-0.5 block text-sm leading-[1.5] text-muted">
                {ROLE_DESCRIPTION[role]}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
