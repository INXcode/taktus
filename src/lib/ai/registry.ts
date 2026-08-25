import "server-only";

import { type AiProvider } from "@/lib/ai/provider";
import { nullProvider } from "@/lib/ai/providers/null";
// `AiProvider` heisst in `@/types` der **Name** aus dem Enum, hier die
// Schnittstelle. Der Alias hält beides auseinander, statt eines von beiden
// umzubenennen und die Bedeutung zu verwischen.
import { type AiProvider as AiProviderName } from "@/types";

/**
 * Welcher Anbieter zu welchem Namen gehört.
 *
 * Der Enum `ai_provider` in der Datenbank kennt bereits mehrere Namen -- die
 * Zuordnung hier kennt für jeden davon **denselben** Anbieter, nämlich den,
 * der nichts überträgt. Das ist der Stand von Release 1 und keine Lücke:
 * Solange die Anbieterwahl offen ist, wäre jede andere Zuordnung eine
 * Übermittlung, die niemand entschieden hat.
 *
 * `satisfies Record<AiProviderName, AiProvider>` ist die Absicherung: Kommt
 * ein Wert in den Enum, bricht `pnpm typecheck` hier -- statt dass zur
 * Laufzeit ein `undefined` durchrutscht und die Naht stillschweigend nichts
 * tut, ohne dass es jemand entschieden hätte.
 */
const PROVIDERS = {
  openai: nullProvider,
  anthropic: nullProvider,
  openai_compatible: nullProvider,
} as const satisfies Record<AiProviderName, AiProvider>;

export function providerFor(name: AiProviderName): AiProvider {
  return PROVIDERS[name];
}
