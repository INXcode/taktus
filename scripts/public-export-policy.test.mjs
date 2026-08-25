import { describe, expect, it } from "vitest";
import {
  INTERNE_PFADE,
  SPERRLISTE,
  findeGesperrtes,
} from "./public-export-policy.mjs";

/**
 * Hier stehen nur die ALLGEMEINEN Muster -- die, die ohne Kenntnis eines
 * konkreten Namens auskommen.
 *
 * Die konkreten Namen und die Faelle dazu liegen in der Ergaenzungsdatei und
 * ihrer eigenen Testdatei. Der Grund steht im Kopf des Moduls, kurz: Ein
 * Ausschluss ist keine Entwarnung. Aus „dieser Name darf hier nicht stehen"
 * folgt, dass es eine Verbindung zu ihm gibt -- und bei einem fremden Kunden
 * ist genau dieser Rueckschluss der Schaden.
 */

describe("Ergaenzung", () => {
  /*
   * Der Fall, der diese Trennung ueberhaupt tragfaehig macht.
   *
   * Ohne Ergaenzungsdatei darf das Modul nicht scheitern -- sonst waere jede
   * Uebernahme dieses Projekts sofort rot, und die naheliegende Abhilfe waere,
   * die Pruefung ganz abzuschalten.
   */
  it("laedt, ohne dass ein fehlender Import etwas kaputtmacht", () => {
    expect(Array.isArray(SPERRLISTE)).toBe(true);
    expect(Array.isArray(INTERNE_PFADE)).toBe(true);
  });

  // Die allgemeinen Muster stehen im Modul selbst und gelten immer.
  it("behaelt die allgemeinen Muster in jedem Fall", () => {
    expect(SPERRLISTE.length).toBeGreaterThanOrEqual(5);
  });
});

describe("findeGesperrtes", () => {
  it("findet einen Pfad mit Benutzernamen", () => {
    const befunde = findeGesperrtes('"Read(/Users/jemand/Developer/X/.env*)"');
    expect(befunde).toHaveLength(1);
    expect(befunde[0].grund).toMatch(/Benutzernamen/u);
  });

  // Der Befund, der diese Zeile ausgeloest hat: Drei Adressen standen im
  // Meldeweg fuer Sicherheitsluecken und existierten nicht.
  it("findet erfundene E-Mail-Adressen", () => {
    expect(findeGesperrtes("E-Mail an security@inxsystems.de")).toHaveLength(1);
    expect(findeGesperrtes("conduct@inxsystems.de")).toHaveLength(1);
    expect(findeGesperrtes("info@inxsystems.de")).toHaveLength(1);
  });

  // Der zweite Befund, aus der Durchsicht vor der Veroeffentlichung: Die
  // Aufzaehlung der drei erfundenen Adressen liess eine persoenliche durch.
  it("findet persoenliche Adressen, nicht nur die erfundenen", () => {
    expect(
      findeGesperrtes("geprueft von vorname.nachname@inxsystems.de"),
    ).toHaveLength(1);
    expect(findeGesperrtes("a@inxsystems.de")).toHaveLength(1);
  });

  // `inxsystems.de` ist die Mail-Domain. Die Webseite lautet `inx.systems` --
  // im README stand der Herstellerverweis auf der falschen.
  it("findet die Mail-Domain, wo eine Webadresse stehen soll", () => {
    expect(
      findeGesperrtes("Ein Projekt von [INX Systems](https://inxsystems.de)."),
    ).toHaveLength(1);
    expect(findeGesperrtes("https://www.inxsystems.de")).toHaveLength(1);
    expect(findeGesperrtes("Webseite: https://inx.systems")).toHaveLength(0);
  });

  it("laesst die Adresse durch, die es gibt", () => {
    expect(findeGesperrtes("kontakt@inxsystems.de")).toHaveLength(0);
  });

  it("findet unersetzte Platzhalter", () => {
    expect(findeGesperrtes("INX Systems GmbH\n[ANSCHRIFT]")).toHaveLength(1);
    expect(findeGesperrtes("[KONTAKT-E-MAIL]")).toHaveLength(1);
  });

  // Ein Platzhalter ist eine offene Aufgabe, kein Fehler im Zweig. Faerbte er
  // jeden Pull Request rot, waere die Pruefung nach zwei Tagen abgeschaltet --
  // und finge dann auch die echten Befunde nicht mehr.
  it("kennzeichnet Platzhalter als nur im strengen Lauf abbrechend", () => {
    const [befund] = findeGesperrtes("[ANSCHRIFT]");
    expect(befund.nurStreng).toBe(true);
  });

  it("kennzeichnet echte Befunde als immer abbrechend", () => {
    for (const text of ["/Users/jemand/x", "info@inxsystems.de"]) {
      expect(findeGesperrtes(text)[0].nurStreng).toBe(false);
    }
  });

  it("meldet nichts bei unverdaechtigem Text", () => {
    expect(
      findeGesperrtes("Row Level Security auf allen Tabellen."),
    ).toHaveLength(0);
  });

  it("meldet mehrere Befunde in mehreren Zeilen", () => {
    const befunde = findeGesperrtes(
      "/Users/jemand/x\nharmlos\ninfo@inxsystems.de",
    );
    expect(befunde).toHaveLength(2);
    expect(befunde.map((b) => b.zeile)).toEqual([1, 3]);
  });
});
