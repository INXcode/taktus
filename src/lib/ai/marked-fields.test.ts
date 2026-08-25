import { describe, expect, it } from "vitest";
import {
  AI_FIELD_SUMMARY,
  applyReview,
  isMarked,
  markField,
} from "@/lib/ai/marked-fields";

describe("markField", () => {
  it("kennzeichnet", () => {
    expect(markField([], AI_FIELD_SUMMARY)).toEqual([AI_FIELD_SUMMARY]);
  });

  it("kennzeichnet nicht doppelt", () => {
    expect(markField([AI_FIELD_SUMMARY], AI_FIELD_SUMMARY)).toEqual([
      AI_FIELD_SUMMARY,
    ]);
  });
});

describe("isMarked", () => {
  it("erkennt den Eintrag", () => {
    expect(isMarked([AI_FIELD_SUMMARY], AI_FIELD_SUMMARY)).toBe(true);
    expect(isMarked([], AI_FIELD_SUMMARY)).toBe(false);
  });
});

describe("applyReview", () => {
  it("entfernt die Kennzeichnung", () => {
    expect(applyReview([AI_FIELD_SUMMARY], AI_FIELD_SUMMARY)).toEqual([]);
  });

  it("ist wiederholbar -- Prüfen ist ein Zustand, kein Ereignis", () => {
    const einmal = applyReview([AI_FIELD_SUMMARY], AI_FIELD_SUMMARY);
    expect(applyReview(einmal, AI_FIELD_SUMMARY)).toEqual([]);
  });

  it("wirkt auch, wenn gar nichts gekennzeichnet war", () => {
    expect(applyReview([], AI_FIELD_SUMMARY)).toEqual([]);
  });

  /*
   * Der Punkt dieser Datei. Ein Feldname aus einer neueren Fassung darf nicht
   * verschwinden, nur weil diese hier ihn nicht darstellen kann -- sonst
   * löschte ein Zurückrollen der Anwendung den Hinweis auf ungeprüfte
   * Modellausgabe, und niemand merkte es.
   */
  it("lässt unbekannte Feldnamen stehen", () => {
    expect(
      applyReview(["ai_summary", "ai_priority"], AI_FIELD_SUMMARY),
    ).toEqual(["ai_priority"]);
  });
});
