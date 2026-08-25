import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { type AiProvider as AiProviderName } from "@/types";

/**
 * Der Schalter des Betreibers.
 *
 * > [!important] Die einzige Datei im Projekt, die `ai_config` liest.
 * > Die Tabelle hat RLS aktiviert und **keine einzige Policy** -- dem
 * > Nutzer-Client fehlt zusätzlich das Tabellenrecht. Erreichbar ist sie
 * > ausschliesslich über `service_role`, und der Weg dorthin soll genau einer
 * > sein, damit er prüfbar bleibt.
 *
 * Herausgegeben wird **nur**, ob der Betreiber die Funktion freigegeben hat.
 * Anbieter, Modell, Grundadresse und Zugangsschlüssel verlassen diese
 * Modulgrenze nicht -- die Oberfläche hat für sie kein Feld und braucht sie
 * nicht. Was der Aufruf gegen ein Sprachmodell davon benötigt, kommt mit dem
 * Aufruf selbst (Abschnitt 12) und wird dort abgeholt, nicht hier auf Vorrat
 * bereitgestellt.
 */
export async function operatorAiEnabled(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_config")
      .select("enabled")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("Betreiberfreigabe nicht lesbar", { code: error.code });
      return false;
    }

    return data?.enabled ?? false;
  } catch {
    // Fällt geschlossen aus. Fehlt der Schlüssel oder antwortet die Datenbank
    // nicht, ist der Zustand unbekannt -- und ein unbekannter Zustand ist bei
    // einer Übermittlung an Dritte ein „nein". Die Alternative wäre, eine
    // Freigabe anzuzeigen, die niemand erteilt hat.
    return false;
  }
}

/**
 * Was der Aufruf gegen ein Sprachmodell braucht.
 *
 * > [!important] Was diese Funktion **nicht** herausgibt: `api_key` und
 * > `base_url`.
 * > Beide bleiben in dieser Datei. Der Schlüssel gehört dem Betreiber, und
 * > die Grundadresse verrät, wohin übermittelt wird -- keines von beiden hat
 * > jenseits dieser Modulgrenze etwas zu suchen. Ein Anbieter, der sie
 * > braucht, holt sie hier ab; die Oberfläche bekommt sie nie zu sehen.
 *
 * Fällt geschlossen aus: Ohne lesbare Konfiguration gibt es keinen Vorschlag.
 */
export type AiSettings = {
  readonly enabled: boolean;
  readonly provider: AiProviderName;
  readonly model: string | null;
  readonly maxInputChars: number;
};

export async function aiSettings(): Promise<AiSettings | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_config")
      .select("enabled, provider, model, max_input_chars")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      if (error)
        console.error("KI-Einstellungen nicht lesbar", { code: error.code });
      return null;
    }

    return {
      enabled: data.enabled,
      provider: data.provider,
      model: data.model,
      maxInputChars: data.max_input_chars,
    };
  } catch {
    return null;
  }
}
