import { z } from "zod";

/**
 * Der Auskunftsdatensatz einer Person -- Bildschirme 21 und 22.
 *
 * > [!important] Dieses Schema ist ein Abweichungsmelder, keine Formsache.
 * > Die Struktur entsteht in `export_person_data(uuid)` als `jsonb`. Zwischen
 * > SQL und Oberfläche gibt es sonst nichts, was die beiden aneinander bindet:
 * > Ein umbenanntes Feld in der Funktion ergäbe hier stumm ein leeres
 * > Kästchen, und eine Auskunft nach Art. 15, die etwas verschweigt, ist
 * > schlimmer als gar keine.
 * >
 * > Der Kommentar an der Funktion sagt: „Eine neue Tabelle mit Personenbezug
 * > gehoert hier ergaenzt." Wer das tut, muss auch hier vorbei -- der Parse
 * > schlägt sonst fehl.
 *
 * Angezeigt wird ausschliesslich, was die Funktion liefert. Die Ansicht holt
 * nichts nach und rechnet nichts hinzu: Was der Bildschirm zeigt, ist genau
 * das, was in der Datei steht.
 */

const timestamp = z.string();

const profileSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  role: z.string(),
  display_name: z.string(),
  /*
   * Der Kunde, zu dem ein Melder gehört -- bei Bearbeitung und Verwaltung
   * `null`.
   *
   * Der Name steht **neben** der Kennung, nicht statt ihrer: Die Kennung ist
   * das, was gespeichert ist, der Name das, was die Frage beantwortet. Eine
   * Auskunft, die nur eine UUID nennt, erfüllt Art. 15 dem Buchstaben nach und
   * dem Zweck nach nicht.
   */
  customer_id: z.string().nullable(),
  customer_name: z.string().nullable(),
  deactivated_at: timestamp.nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});

const reportedTicketSchema = z.object({
  id: z.string(),
  ticket_number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  category: z.string(),
  created_at: timestamp,
  closed_at: timestamp.nullable(),
});

const assignedTicketSchema = z.object({
  id: z.string(),
  ticket_number: z.number(),
  title: z.string(),
  status: z.string(),
  created_at: timestamp,
});

const commentSchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  body: z.string(),
  created_at: timestamp,
  updated_at: timestamp,
});

const timeEntrySchema = z.object({
  id: z.string(),
  ticket_id: z.string(),
  minutes: z.number(),
  worked_on: z.string(),
  note: z.string().nullable(),
  created_at: timestamp,
});

const auditEntrySchema = z.object({
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullable(),
  changed_fields: z.array(z.string()).nullable(),
  occurred_at: timestamp,
});

export const personDataSchema = z.object({
  erstellt_am: timestamp,
  hinweis: z.string(),
  profil: profileSchema,
  tickets_gemeldet: z.array(reportedTicketSchema),
  tickets_zugewiesen: z.array(assignedTicketSchema),
  kommentare: z.array(commentSchema),
  zeitbuchungen: z.array(timeEntrySchema),
  protokolleintraege: z.array(auditEntrySchema),
});

export type PersonData = z.infer<typeof personDataSchema>;

/**
 * Liest die Rückgabe der Funktion.
 *
 * Wirft bei Abweichung, statt ein halbes Ergebnis auszuliefern. Der Aufrufer
 * fängt das ab und zeigt eine Fehlermeldung -- „hier fehlt etwas, wir wissen
 * nicht was" ist die einzige ehrliche Auskunft, wenn die Struktur nicht mehr
 * stimmt.
 */
export function parsePersonData(value: unknown): PersonData {
  return personDataSchema.parse(value);
}

/**
 * Die sechs Abschnitte in fester Reihenfolge -- so verlangt es der Entwurf.
 *
 * Fest heisst: Die Reihenfolge hängt nicht davon ab, wo etwas vorkommt. Ein
 * Abschnitt ohne Einträge verschwindet nicht, er steht mit `0` da. Eine
 * Auskunft, in der leere Abschnitte fehlen, liesse offen, ob nichts vorliegt
 * oder ob nicht nachgesehen wurde.
 */
export type SectionCount = {
  readonly number: number;
  readonly title: string;
  /** Rechts in der Kopfzeile, etwa „11 Einträge" oder „3 Felder". */
  readonly measure: string;
};

export function sectionCounts(data: PersonData): readonly SectionCount[] {
  const entries = (count: number) =>
    `${count} ${count === 1 ? "Eintrag" : "Einträge"}`;

  const minutes = data.zeitbuchungen.reduce(
    (sum, entry) => sum + entry.minutes,
    0,
  );

  return [
    // Der Entwurf zählt hier drei Felder: Anzeigename, Rolle, Anlage. Gezeigt
    // werden genau die -- Kennung, Mandantenkennung und Änderungszeitpunkt
    // stehen in der Datei, sagen einer Person über sich selbst aber nichts.
    //
    // Beim Melder kommt der Kunde dazu: zu welchem Auftraggeber jemand gehört,
    // ist eine Angabe über ihn und keine technische Kennung. Die Zahl zählt
    // deshalb mit, was tatsächlich dasteht -- eine feste 3 neben vier Zeilen
    // wäre genau die Art kleiner Unstimmigkeit, die eine Auskunft unglaubwürdig
    // macht.
    {
      number: 1,
      title: "Profil",
      measure: `${data.profil.customer_id === null ? 3 : 4} Felder`,
    },
    {
      number: 2,
      title: "Gemeldete Tickets",
      measure: entries(data.tickets_gemeldet.length),
    },
    {
      number: 3,
      title: "Zugewiesene Tickets",
      measure: entries(data.tickets_zugewiesen.length),
    },
    {
      number: 4,
      title: "Kommentare",
      measure: entries(data.kommentare.length),
    },
    {
      number: 5,
      title: "Zeitbuchungen",
      measure: `${entries(data.zeitbuchungen.length)} · ${minutes} min`,
    },
    {
      number: 6,
      title: "Protokolleinträge",
      measure: entries(data.protokolleintraege.length),
    },
  ];
}
