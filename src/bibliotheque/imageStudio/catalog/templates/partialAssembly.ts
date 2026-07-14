import { assembleEditorialWornHeldPromptFromSlots } from "@/bibliotheque/imageStudio/editorialWornHeldAssembly";
import { assembleOutfitStudioPromptFromSlots } from "@/bibliotheque/imageStudio/outfitStudioAssembly";
import { assemblePackshotDynamiquePromptFromSlots } from "@/bibliotheque/imageStudio/packshotDynamiqueAssembly";
import { assembleProduitApplicationPromptFromSlots } from "@/bibliotheque/imageStudio/produitEnApplicationAssembly";
import type { TemplateSlotValues } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { findGlossaryMatchesInText } from "../glossary/match";
import type { PromptAssistIntentRoute, PromptAssistRouteConfidence } from "./intentRouter";
import { ensurePromptAssistMentions, inferPartialSlotsForTemplate } from "./inferPartialSlots";

const PARTIAL_ASSEMBLY_TEMPLATE_IDS = new Set([
  "outfit-studio",
  "packshot-dynamique",
  "editorial-worn-held",
  "produit-en-application",
]);

const EN_PARTIAL_ASSEMBLY_TEMPLATE_IDS = new Set(["outfit-studio"]);

export type PartialAssemblyOptions = {
  hasReferenceImage?: boolean;
  hasSecondaryImage?: boolean;
  minConfidence?: PromptAssistRouteConfidence;
};

export type PartialAssemblyResult = {
  templateId: string | null;
  slotsUsed: TemplateSlotValues;
  enginePrompt: string | null;
  /** Prompt EN prêt pour affichage local / <prompt>. */
  displayPromptEn: string | null;
  usedEngine: boolean;
};

function meetsPartialAssemblyConfidence(
  confidence: PromptAssistRouteConfidence,
  minConfidence: PromptAssistRouteConfidence = "medium",
): boolean {
  const order: PromptAssistRouteConfidence[] = ["none", "low", "medium", "high"];
  return order.indexOf(confidence) >= order.indexOf(minConfidence);
}

function mergeGlossarySegments(prompt: string, text: string): string {
  const glossarySegments = findGlossaryMatchesInText(text).map((entry) => entry.promptEn);
  if (glossarySegments.length === 0) return prompt;

  const uniqueSegments = glossarySegments.filter((segment) => !prompt.includes(segment));
  if (uniqueSegments.length === 0) return prompt;

  return `${uniqueSegments.join(". ")}. ${prompt}`;
}

function buildEnglishDisplayFromEngine(
  templateId: string,
  enginePrompt: string,
  route: PromptAssistIntentRoute,
  text: string,
): string {
  if (EN_PARTIAL_ASSEMBLY_TEMPLATE_IDS.has(templateId)) {
    return mergeGlossarySegments(enginePrompt, text);
  }

  const focus = route.primaryTemplate?.promptFocusEn ?? "";
  const mentions = [...new Set(enginePrompt.match(/@Produit|@Image1/g) ?? [])];
  const body = mergeGlossarySegments(focus, text);
  if (mentions.length === 0) return body;
  const mentionSuffix = mentions.join(" ");
  if (body.includes(mentionSuffix)) return body;
  return `${body} ${mentionSuffix}`.trim();
}

function runTemplateAssembler(templateId: string, slots: TemplateSlotValues): string {
  switch (templateId) {
    case "outfit-studio":
      return assembleOutfitStudioPromptFromSlots(slots, () => 0.42);
    case "packshot-dynamique":
      return assemblePackshotDynamiquePromptFromSlots(slots);
    case "editorial-worn-held":
      return assembleEditorialWornHeldPromptFromSlots(slots);
    case "produit-en-application":
      return assembleProduitApplicationPromptFromSlots(slots, () => 0.42);
    default:
      return "";
  }
}

/** Assemblage partiel via les moteurs guides existants (étape 4). */
export function assemblePartialPromptFromRoute(
  route: PromptAssistIntentRoute,
  text: string,
  options?: PartialAssemblyOptions,
): PartialAssemblyResult {
  const emptyResult: PartialAssemblyResult = {
    templateId: null,
    slotsUsed: {},
    enginePrompt: null,
    displayPromptEn: null,
    usedEngine: false,
  };

  if (!route.primaryTemplateId || !route.primaryTemplate) return emptyResult;
  if (!PARTIAL_ASSEMBLY_TEMPLATE_IDS.has(route.primaryTemplateId)) return emptyResult;
  if (!meetsPartialAssemblyConfidence(route.confidence, options?.minConfidence ?? "medium")) {
    return emptyResult;
  }

  const slots = inferPartialSlotsForTemplate(route.primaryTemplateId, text, options);
  const enginePrompt = runTemplateAssembler(route.primaryTemplateId, slots);
  if (!enginePrompt.trim()) return emptyResult;

  const withMentions = ensurePromptAssistMentions(enginePrompt, options);
  const displayPromptEn = buildEnglishDisplayFromEngine(
    route.primaryTemplateId,
    withMentions,
    route,
    text,
  );

  return {
    templateId: route.primaryTemplateId,
    slotsUsed: slots,
    enginePrompt: withMentions,
    displayPromptEn: displayPromptEn.trim() || null,
    usedEngine: true,
  };
}
