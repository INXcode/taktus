import { z } from "zod";

/**
 * Kommentare.
 *
 * `body` ist 1 bis 20 000 Zeichen -- so steht es im `CHECK` der Tabelle. Ein
 * leerer Kommentar ist keiner, deshalb die Untergrenze.
 */
export const COMMENT_MAX = 20_000;

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Bitte etwas schreiben.")
  .max(COMMENT_MAX, `Höchstens ${COMMENT_MAX} Zeichen.`);

export const createCommentSchema = z.object({
  ticketId: z.uuid({ message: "Ungültige Ticketkennung." }),
  body: commentBodySchema,
});

/**
 * Beim Ändern kommt die Kennung des Kommentars herein, nicht die des Tickets.
 * Wer ändern darf, entscheidet nicht dieses Schema, sondern die Policy:
 * `ticket_comments_update_eigene` für den Urheber,
 * `ticket_comments_update_admin` für die Verwaltung.
 */
export const updateCommentSchema = z.object({
  commentId: z.uuid({ message: "Ungültige Kommentarkennung." }),
  body: commentBodySchema,
});
