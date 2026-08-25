"use client";

import { useState } from "react";
import { CommentEditor } from "@/components/tickets/comment-editor";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format/datetime";

export type CommentEntry = {
  readonly id: string;
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isOwn: boolean;
};

/**
 * Der Kommentarverlauf aus Bildschirm 9.
 *
 * > [!important] Eigen und fremd unterscheiden sich, ohne dass ein Rang
 * > entsteht.
 * > Der Entwurf legt dafür genau zwei Merkmale fest: eine schmale violette
 * > Kante links und die Marke „Sie". **Nicht** Ausrichtung, nicht die Farbe
 * > der Fläche, nicht die Größe -- alles drei erzeugte eine Rangordnung
 * > zwischen Beiträgen, die keine haben.
 *
 * **Wer berichtigen darf, hat sich geändert.** Bis 20260809000000 galt: nur
 * der Urheber, und die Verwaltung ausdrücklich nicht. Begründet war das mit
 * der Beweiskraft des Verlaufs -- praktisch hiess es, dass ein Tippfehler
 * stehen blieb, bis sein Urheber Zeit hatte. Jetzt darf die Verwaltung
 * berichtigen; der Bearbeiter weiterhin nur den eigenen Beitrag.
 *
 * Was die Beweiskraft trug, bleibt: Die **Zurechnung** ist unveränderlich (der
 * Trigger `ticket_comments_before_update` friert den Urheber ein), jede
 * Berichtigung steht im Protokoll, und ein berichtigter Beitrag trägt hier den
 * Vermerk „berichtigt". Der Vermerk ist nicht Zierde -- ohne ihn wäre die
 * Änderung genau das unsichtbare Umschreiben, gegen das die alte Regel sich
 * richtete.
 */
export function CommentList({
  comments,
  canEditAll = false,
}: {
  readonly comments: readonly CommentEntry[];
  /** Die Verwaltung darf auch fremde Beiträge berichtigen. */
  readonly canEditAll?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-border-strong bg-subtle p-4 text-base text-muted">
        Zu diesem Vorgang ist noch nichts vermerkt.
      </p>
    );
  }

  return (
    <ul className="flex list-none flex-col gap-3.5 p-0">
      {comments.map((comment) => {
        const darfBerichtigen = comment.isOwn || canEditAll;
        const berichtigt = comment.updatedAt !== comment.createdAt;

        return (
          <li
            key={comment.id}
            className={`rounded-[10px] border border-border p-4 ${
              comment.isOwn ? "border-l-[3px] border-l-primary" : ""
            }`}
          >
            <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
              <Avatar
                displayName={comment.authorName}
                size="sm"
                tone={comment.isOwn ? "self" : "other"}
              />
              <span className="text-sm font-semibold text-foreground">
                {comment.authorName}
              </span>
              {comment.isOwn ? (
                <span className="inline-flex rounded-[5px] bg-primary-soft px-[7px] py-0.5 text-[11.5px] font-semibold text-primary-text">
                  Sie
                </span>
              ) : null}
              <span className="text-[12.5px] text-muted">
                {formatDateTime(comment.createdAt)}
              </span>
              {berichtigt ? (
                <span className="text-[12.5px] text-faint">
                  berichtigt {formatDateTime(comment.updatedAt)}
                </span>
              ) : null}

              {darfBerichtigen ? (
                <button
                  type="button"
                  data-variant="ghost"
                  onClick={() =>
                    setEditing(editing === comment.id ? null : comment.id)
                  }
                  className="ml-auto rounded-md px-1.5 text-[12.5px] font-semibold text-primary"
                >
                  {editing === comment.id ? "Schließen" : "Berichtigen"}
                </button>
              ) : (
                // Die beschriftete Lücke: Ohne sie sähe der fehlende Knopf wie
                // ein Darstellungsfehler aus.
                <span className="ml-auto text-[12.5px] text-faint">
                  nicht bearbeitbar
                </span>
              )}
            </div>

            {editing === comment.id ? (
              <CommentEditor
                commentId={comment.id}
                body={comment.body}
                onDone={() => setEditing(null)}
              />
            ) : (
              /*
                `whitespace-pre-line` erhält Absätze aus der Eingabe. Kein
                Markdown, kein `dangerouslySetInnerHTML`: Kommentartexte sind
                Nutzereingabe und damit der einzige realistische XSS-Weg in
                dieser Anwendung (docs/security.md, Kapitel C).
              */
              <p className="text-[14.5px] leading-[23px] whitespace-pre-line text-body">
                {comment.body}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
