import { describe, expect, it } from "vitest";
import {
  parsePersonData,
  sectionCounts,
  type PersonData,
} from "@/lib/export/person-data";

/**
 * Ein vollständiger Datensatz in der Form, die `export_person_data(uuid)`
 * liefert. Bewusst ausgeschrieben und nicht aus dem Schema erzeugt: Er ist die
 * zweite Beschreibung derselben Struktur, und genau darin liegt der Wert --
 * eine Abweichung zwischen SQL und Oberfläche fällt hier auf.
 */
const vollstaendig: PersonData = {
  erstellt_am: "2026-08-05T09:20:00.000Z",
  hinweis: "Die E-Mail-Adresse liegt in auth.users …",
  profil: {
    id: "11111111-0000-4000-8000-000000000002",
    tenant_id: "22222222-0000-4000-8000-000000000001",
    role: "agent",
    display_name: "Kim Musterbearbeitung",
    // Eine Bearbeitung hängt am Mandanten, nicht an einem Kunden -- beide
    // Felder sind für sie leer. Der Melder ist der andere Fall, und der steht
    // weiter unten.
    customer_id: null,
    customer_name: null,
    deactivated_at: null,
    created_at: "2026-03-12T08:00:00.000Z",
    updated_at: "2026-08-01T08:00:00.000Z",
  },
  tickets_gemeldet: [
    {
      id: "33333333-0000-4000-8000-000000000003",
      ticket_number: 3,
      title: "Turnusmäßige Wartung Hebebühne",
      description: null,
      status: "waiting",
      category: "wartung",
      created_at: "2026-07-01T08:00:00.000Z",
      closed_at: null,
    },
  ],
  tickets_zugewiesen: [
    {
      id: "33333333-0000-4000-8000-000000000001",
      ticket_number: 1,
      title: "Etikettendrucker zieht kein Papier ein",
      status: "in_progress",
      created_at: "2026-07-02T08:00:00.000Z",
    },
  ],
  kommentare: [],
  zeitbuchungen: [
    {
      id: "44444444-0000-4000-8000-000000000001",
      ticket_id: "33333333-0000-4000-8000-000000000001",
      minutes: 90,
      worked_on: "2026-07-02",
      note: null,
      created_at: "2026-07-02T09:00:00.000Z",
    },
    {
      id: "44444444-0000-4000-8000-000000000002",
      ticket_id: "33333333-0000-4000-8000-000000000001",
      minutes: 45,
      worked_on: "2026-07-03",
      note: "Nacharbeit",
      created_at: "2026-07-03T09:00:00.000Z",
    },
  ],
  protokolleintraege: [
    {
      action: "ticket.update",
      entity_type: "ticket",
      entity_id: "33333333-0000-4000-8000-000000000001",
      changed_fields: ["status"],
      occurred_at: "2026-07-02T09:05:00.000Z",
    },
  ],
};

describe("parsePersonData", () => {
  it("nimmt den vollständigen Datensatz an", () => {
    expect(parsePersonData(vollstaendig)).toEqual(vollstaendig);
  });

  it("nimmt leere Abschnitte an -- die Funktion liefert dann []", () => {
    const leer = {
      ...vollstaendig,
      tickets_gemeldet: [],
      tickets_zugewiesen: [],
      zeitbuchungen: [],
      protokolleintraege: [],
    };
    expect(parsePersonData(leer).tickets_gemeldet).toEqual([]);
  });

  /*
   * Der eigentliche Zweck. Wird ein Feld in `export_person_data` umbenannt
   * oder ein Abschnitt vergessen, muss das **auffallen** -- nicht als leeres
   * Kästchen in der Ansicht, sondern als Fehler. Eine Auskunft nach Art. 15,
   * die etwas verschweigt, ist schlimmer als gar keine.
   */
  it("weist einen fehlenden Abschnitt zurück, statt ihn zu übergehen", () => {
    const { zeitbuchungen: _entfernt, ...ohneAbschnitt } = vollstaendig;
    expect(() => parsePersonData(ohneAbschnitt)).toThrow();
  });

  /*
   * Der Kunde ist eine Angabe ÜBER die Person -- zu welchem Auftraggeber sie
   * gehört. Er gehört damit in die Auskunft, und zwar mit Namen: Eine UUID
   * beantwortet die Frage nicht, die ein Betroffener stellt.
   */
  it("nimmt einen Melder mit Kunden an -- Kennung und Name", () => {
    const melder = {
      ...vollstaendig,
      profil: {
        ...vollstaendig.profil,
        role: "requester",
        customer_id: "44444444-0000-4000-8000-000000000001",
        customer_name: "Beispielkunde Nord",
      },
    };
    expect(parsePersonData(melder).profil.customer_name).toBe(
      "Beispielkunde Nord",
    );
  });

  it("weist einen Kunden ohne Namen zurück -- eine Kennung allein ist keine Auskunft", () => {
    const ohneNamen = {
      ...vollstaendig,
      profil: { ...vollstaendig.profil, customer_id: "44444444-0000-4000" },
    };
    delete (ohneNamen.profil as Record<string, unknown>)["customer_name"];
    expect(() => parsePersonData(ohneNamen)).toThrow();
  });

  it("weist ein umbenanntes Feld zurück", () => {
    const umbenannt = {
      ...vollstaendig,
      profil: { ...vollstaendig.profil, anzeigename: "Kim" },
    };
    delete (umbenannt.profil as Record<string, unknown>)["display_name"];
    expect(() => parsePersonData(umbenannt)).toThrow();
  });

  it("weist eine Antwort zurück, die gar keine ist", () => {
    expect(() => parsePersonData(null)).toThrow();
    expect(() => parsePersonData("keine Daten")).toThrow();
  });
});

describe("sectionCounts", () => {
  it("liefert immer sechs Abschnitte in fester Reihenfolge", () => {
    const abschnitte = sectionCounts(vollstaendig);
    expect(abschnitte.map((a) => a.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(abschnitte.map((a) => a.title)).toEqual([
      "Profil",
      "Gemeldete Tickets",
      "Zugewiesene Tickets",
      "Kommentare",
      "Zeitbuchungen",
      "Protokolleinträge",
    ]);
  });

  it("lässt einen leeren Abschnitt stehen, statt ihn wegzulassen", () => {
    const abschnitte = sectionCounts(vollstaendig);
    expect(abschnitte[3]).toMatchObject({
      title: "Kommentare",
      measure: "0 Einträge",
    });
  });

  it("beugt den Singular", () => {
    const abschnitte = sectionCounts(vollstaendig);
    expect(abschnitte[1]?.measure).toBe("1 Eintrag");
  });

  it("summiert die Minuten der Zeitbuchungen", () => {
    expect(sectionCounts(vollstaendig)[4]?.measure).toBe(
      "2 Einträge · 135 min",
    );
  });
});
