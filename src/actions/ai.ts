"use server";

import { aiSettings } from "@/lib/ai/config";
import { signSuggestion } from "@/lib/ai/provenance";
import { limitInput, type AiOutcome } from "@/lib/ai/provider";
import { NULL_PROVIDER_NAME } from "@/lib/ai/providers/null";
import { providerFor } from "@/lib/ai/registry";
import { parseAiSuggestion } from "@/lib/ai/schema";
import { logAudit } from "@/lib/audit";
import { ALL_ROLES, requireRole } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  ticketDescriptionSchema,
  ticketTitleSchema,
} from "@/lib/validation/ticket";
import { z } from "zod";

/**
 * Ein Vorschlag für Zusammenfassung und Kategorie -- KI-Stufe 1.
 *
 * > [!important] Zwei Freigaben, nicht eine.
 * > `tenants.ai_enabled` ist die Zustimmung des Mandanten, `ai_config.enabled`
 * > die des Betreibers. Beide müssen stehen. Die Trennung ist kein
 * > Verwaltungsaufwand: Der Betreiber verantwortet den Vertrag mit dem
 * > Anbieter, der Mandant die Übermittlung seiner Inhalte -- das sind zwei
 * > Entscheidungen, und keine darf die andere ersetzen.
 *
 * Der Rückgabewert ist die Union aus `lib/ai/provider.ts`; die vier
 * Formularzustände fallen mit ihr zusammen. „Abgeschaltet" ist der
 * Normalfall, nicht der Ausnahmefall.
 */
export async function suggestTicketFields(input: {
  readonly title: string;
  readonly description: string;
}): Promise<AiOutcome> {
  const viewer = await requireRole(ALL_ROLES);

  // Die Freigabe des Mandanten steht in der Sitzung -- sie kommt aus
  // `tenants` und damit unter RLS.
  if (!viewer.aiEnabled) return { status: "disabled" };

  const settings = await aiSettings();
  if (settings === null || !settings.enabled) return { status: "disabled" };

  // Dieselben Grenzen wie beim Speichern. Ein Titel, der die Prüfung des
  // Formulars nicht besteht, hat auch nichts beim Anbieter verloren -- sonst
  // wäre die Übermittlung der Weg, die Prüfung zu umgehen.
  const parsed = z
    .object({ title: ticketTitleSchema, description: ticketDescriptionSchema })
    .safeParse({ title: input.title, description: input.description });

  if (!parsed.success) return { status: "failed", reason: "invalid_output" };

  const request = {
    ...limitInput({
      title: parsed.data.title,
      description: parsed.data.description,
      maxInputChars: settings.maxInputChars,
    }),
    maxInputChars: settings.maxInputChars,
  };

  const provider = providerFor(settings.provider);

  /*
   * Ohne angebundenen Anbieter wird gar nicht erst gefragt.
   *
   * Der Zweig steht **vor** dem Aufruf, nicht danach, und der Grund ist das
   * Protokoll: Ein Eintrag `ai.suggest` behauptet eine Übermittlung an einen
   * Dritten. Hätte keine stattgefunden, wäre das eine falsche Angabe in genau
   * dem Verzeichnis, dessen Zweck der Nachweis ist -- und falsche Einträge
   * sind dort schlimmer als fehlende.
   */
  if (provider.name === NULL_PROVIDER_NAME) {
    return { status: "failed", reason: "not_configured" };
  }

  const outcome = await provider.suggest(request);

  // Ab hier ist übermittelt worden -- auch dann, wenn die Antwort unbrauchbar
  // war oder ausblieb. Der Versuch gehört deshalb ins Protokoll.
  const supabase = await createClient();
  await logAudit(supabase, "ai.suggest", "ticket", null);

  if (outcome.status !== "ok") return outcome;

  /*
   * Die Antwort des Anbieters wird hier **noch einmal** geprüft.
   *
   * Jede Provider-Datei ruft `parseAiSuggestion` bereits selbst -- sie muss,
   * sonst käme sie nicht an ein typisiertes Ergebnis. Genau darauf soll die
   * Zusicherung aber nicht beruhen: Sie hinge dann daran, dass jede künftige
   * Datei unter `providers/` daran denkt, und eine Zusicherung, die von
   * Sorgfalt in einer noch nicht geschriebenen Datei abhängt, ist keine.
   *
   * Der zweite Lauf ist billig und macht die Grenze strukturell: Was diese
   * Aktion verlässt, ist gegen dasselbe Schema geprüft worden -- Kategorie aus
   * der Aufzählung, Zusammenfassung in der Länge begrenzt.
   */
  const geprueft = parseAiSuggestion(outcome.result);
  if (geprueft === null) return { status: "failed", reason: "invalid_output" };

  /*
   * Und der Herkunftsnachweis.
   *
   * Zwischen dieser Antwort und dem Anlegen des Tickets liegt der Rechner des
   * Nutzers. Ohne Unterschrift könnte das Formular jeden beliebigen Text als
   * Modellausgabe ausgeben -- `ai_marked_fields` wäre eine Behauptung des
   * Absenders, und `ai_model`/`ai_generated_at` blieben leer. Begründung
   * ausführlich in `lib/ai/provenance.ts`.
   */
  return {
    ...outcome,
    result: geprueft,
    token: signSuggestion({
      summary: geprueft.summary,
      category: geprueft.category,
      model: outcome.model,
      generatedAt: outcome.generatedAt,
      userId: viewer.userId,
    }),
  };
}
