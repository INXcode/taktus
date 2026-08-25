import { z } from "zod";
import type { AppRole } from "@/types";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";

/**
 * Profile und Nutzer.
 *
 * `display_name` ist 1 bis 120 Zeichen -- der `CHECK` der Tabelle. Mehr Felder
 * gibt es nicht: keine Telefonnummer, keine Abteilung, keine Personalnummer.
 * Für Tickets und Zeitbuchungen wird nichts davon gebraucht.
 */
export const DISPLAY_NAME_MAX = 120;

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Bitte einen Anzeigenamen eingeben.")
  .max(DISPLAY_NAME_MAX, `Höchstens ${DISPLAY_NAME_MAX} Zeichen.`);

export const appRoleSchema = z.enum(["admin", "agent", "requester"], {
  message: "Bitte eine Rolle wählen.",
});

/**
 * Rolle und Kunde gehören zusammen -- der Spiegel des `CHECK`
 * `profiles_kunde_nur_beim_melder` aus `20260806000000_kunden.sql`.
 *
 * Ein Melder gehört zu genau einem Kunden; Bearbeitung und Verwaltung hängen
 * am Mandanten und arbeiten quer über alle Kunden. Die Bedingung greift
 * deshalb in **beide** Richtungen: fehlender Kunde beim Melder ist ein
 * Fehler, und ein gesetzter Kunde bei den anderen Rollen ebenso.
 *
 * Ohne die zweite Hälfte entstünde beim Rollenwechsel ein Bearbeiter mit
 * Kundenbindung -- ein Zustand, den die Datenbank abweist, die Oberfläche aber
 * erst nach dem Absenden bemerkte, und dann mit einer PostgREST-Meldung.
 */
/** Leerer String aus dem `<select>` heisst „kein Kunde", nicht „ungültig". */
const optionalCustomerIdSchema = z
  .string()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    "Ungültiger Kunde.",
  );

const KUNDE_FEHLT = {
  message: "Bitte einen Kunden wählen.",
  path: ["customerId"],
};
const KUNDE_ZU_VIEL = {
  message: "Nur Melder gehören zu einem Kunden.",
  path: ["customerId"],
};

const brauchtKunden = (value: { role: AppRole; customerId: string | null }) =>
  value.role !== "requester" || value.customerId !== null;
const darfKeinenKundenHaben = (value: {
  role: AppRole;
  customerId: string | null;
}) => value.role === "requester" || value.customerId === null;

export const createMemberSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    role: appRoleSchema,
    customerId: optionalCustomerIdSchema,
  })
  .refine(brauchtKunden, KUNDE_FEHLT)
  .refine(darfKeinenKundenHaben, KUNDE_ZU_VIEL);

export const updateMemberRoleSchema = z
  .object({
    profileId: z.uuid({ message: "Ungültige Profilkennung." }),
    role: appRoleSchema,
    customerId: optionalCustomerIdSchema,
  })
  .refine(brauchtKunden, KUNDE_FEHLT)
  .refine(darfKeinenKundenHaben, KUNDE_ZU_VIEL);

export const setDeactivatedSchema = z.object({
  profileId: z.uuid({ message: "Ungültige Profilkennung." }),
  deactivated: z.enum(["ja", "nein"]),
});

/**
 * Anonymisieren -- dauerhaft, mit getippter Bestätigung.
 *
 * Der Entwurf verlangt das Wort ausgeschrieben, nicht nur einen Knopfdruck:
 * Der Vorgang lässt sich nicht zurücknehmen, und er trifft eine Person.
 */
export const anonymizeMemberSchema = z.object({
  profileId: z.uuid({ message: "Ungültige Profilkennung." }),
  confirmation: z.string().trim().toLowerCase(),
});

/** Der eigene Anzeigename -- das einzige Profilfeld, das man selbst pflegt. */
export const updateOwnDisplayNameSchema = z.object({
  displayName: displayNameSchema,
});

/**
 * Passwortwechsel -- Bildschirm 20.
 *
 * > [!important] Das alte Passwort ist Pflicht, obwohl Supabase es nicht
 * > verlangt.
 * > `auth.updateUser({ password })` ändert das Passwort allein aufgrund der
 * > bestehenden Sitzung. Damit genügt ein unbeaufsichtigter Bildschirm, um
 * > ein Konto dauerhaft zu übernehmen -- und der rechtmässige Inhaber merkt
 * > es erst bei der nächsten Anmeldung. Die Action prüft das alte Passwort
 * > deshalb selbst.
 *
 * Das alte Passwort wird **nicht** gegen die Richtlinie geprüft: Es ist ein
 * Nachweis, keine Eingabe. Eine Meldung „mindestens 12 Zeichen" verriete
 * ausserdem etwas über das hinterlegte Passwort.
 */
export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Bitte das aktuelle Passwort eingeben."),
    password: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.password, {
    message: "Das neue Passwort muss sich vom alten unterscheiden.",
    path: ["password"],
  });
