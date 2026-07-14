import type { PromptAssistIntentRoute } from "./intentRouter";
import { assemblePartialPromptFromRoute, type PartialAssemblyOptions } from "./partialAssembly";

const CONFIDENCE_LABELS = {
  high: "élevée",
  medium: "moyenne",
  low: "faible",
  none: "aucune",
} as const;

/** Bloc injecté dans le message utilisateur pour guider le LLM (étapes 3–4). */
export function buildPromptAssistRoutingContextBlock(
  route: PromptAssistIntentRoute,
  text?: string,
  options?: PartialAssemblyOptions,
): string | null {
  if (!route.primaryTemplate || route.confidence === "none") return null;

  const tags =
    route.matchedIntentTags.length > 0
      ? route.matchedIntentTags.join(", ")
      : "—";
  const glossaryHints =
    route.matchedGlossaryTemplateIds.length > 0
      ? route.matchedGlossaryTemplateIds.join(", ")
      : "—";
  const variables = route.suggestedVariableKeys.slice(0, 6).join(", ") || "—";
  const alternatives =
    route.alternatives.length > 0
      ? route.alternatives.map((item) => `${item.templateId} (${item.score})`).join(", ")
      : "—";

  const partial =
    text && text.trim()
      ? assemblePartialPromptFromRoute(route, text, options)
      : null;
  const partialBlock =
    partial?.enginePrompt && partial.usedEngine
      ? `\nAssemblage partiel (moteur guide) :\n${partial.enginePrompt.slice(0, 900)}\n→ Adapter en anglais dans <prompt>, conserver @Produit/@Image1.`
      : "";

  return `[Routage Prompt Assistant — confiance ${CONFIDENCE_LABELS[route.confidence]}]
Template prioritaire : ${route.primaryTemplate.id} (${route.primaryTemplate.labelFr})
Tags intention : ${tags}
Indices glossaire : ${glossaryHints}
Variables clés : ${variables}
Focus EN : ${route.primaryTemplate.promptFocusEn}
Alternatives : ${alternatives}
→ Réutilise le vocabulaire de ce guide dans le prompt final.]${partialBlock}`;
}
