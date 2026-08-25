import { z } from "zod";

/**
 * Schemata der Anmeldestrecke.
 *
 * Die Meldungen stehen deutsch **im Schema** und nicht an der Aufrufstelle
 * (Definition of Done, Punkt 2). Sonst entstehen zwei Formulierungen
 * derselben Regel, und eine davon veraltet.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Bitte eine E-Mail-Adresse eingeben.")
  .email("Das sieht nicht nach einer E-Mail-Adresse aus.");

/**
 * Bei der Anmeldung wird das Passwort **nicht** gegen die Richtlinie geprüft.
 *
 * Das ist kein Versehen: Eine Meldung wie „mindestens 12 Zeichen" an der
 * Anmeldung verriete, dass die eingegebene Länge nicht passt — und damit
 * etwas über das hinterlegte Passwort. Geprüft wird nur, dass überhaupt etwas
 * dasteht; alles Weitere beantwortet der Server mit einer einzigen,
 * unterschiedslosen Meldung.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte das Passwort eingeben."),
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Die Passwortrichtlinie, wie sie **tatsächlich** durchgesetzt wird.
 *
 * Beide Regeln stehen in `supabase/config.toml`:
 *   minimum_password_length = 12
 *   password_requirements   = "lower_upper_letters_digits"
 *
 * Sie werden hier gespiegelt, damit die Rückmeldung am Feld erscheint statt
 * als englische Meldung aus dem Auth-Server. Weicht die Konfiguration ab,
 * weicht diese Datei ab — die Prüfung bleibt serverseitig maßgeblich.
 */
export const PASSWORD_MIN_LENGTH = 12;

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Das Passwort braucht mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`,
  )
  .regex(/\p{Ll}/u, "Es fehlt ein Kleinbuchstabe.")
  .regex(/\p{Lu}/u, "Es fehlt ein Großbuchstabe.")
  .regex(/\d/u, "Es fehlt eine Ziffer.");

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordRepeat: z.string(),
  })
  .refine((value) => value.password === value.passwordRepeat, {
    message: "Die beiden Eingaben stimmen nicht überein.",
    path: ["passwordRepeat"],
  });
