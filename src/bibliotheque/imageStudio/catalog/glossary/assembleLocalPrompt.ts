import { findGlossaryMatchesInText } from "./match";
import { assemblePartialPromptFromRoute } from "../templates/partialAssembly";
import { routePromptAssistIntent } from "../templates/intentRouter";
import { PROMPT_ASSIST_PROMPT_INTRO } from "./parsePromptAssistMessage";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";

const SKETCH_STYLE_IDS = new Set(["style-sketch"]);

export type BuildLocalPromptOptions = {
  hasReferenceImage?: boolean;
};

function appendQualityLine(body: string, isSketch: boolean): string {
  const qualityLine = isSketch
    ? "Artistic illustration quality, clean composition, detailed line work."
    : "Photorealistic quality, high detail, 4K, cinematic color grading.";

  if (body.includes(qualityLine)) return body;
  return `${body}. ${qualityLine}`;
}

/**
 * Assemblage local sans LLM — fallback quand l'API OpenAI est indisponible.
 * Priorise l'assemblage partiel des moteurs guides (étape 4), puis glossaire.
 */
export function buildLocalPromptFromUserText(
  text: string,
  options?: BuildLocalPromptOptions,
): string | null {
  const route = routePromptAssistIntent(text, options);
  const partial = assemblePartialPromptFromRoute(route, text, options);
  const matches = findGlossaryMatchesInText(text);
  const isSketch = matches.some((entry) => SKETCH_STYLE_IDS.has(entry.id));

  if (partial.displayPromptEn) {
    return appendQualityLine(partial.displayPromptEn, isSketch);
  }

  if (matches.length === 0 && !route.primaryTemplate && !options?.hasReferenceImage) {
    return null;
  }

  const segments = matches.map((entry) => entry.promptEn);

  if (route.primaryTemplate && !segments.includes(route.primaryTemplate.promptFocusEn)) {
    segments.unshift(route.primaryTemplate.promptFocusEn);
  }

  const body = segments.length > 0 ? segments.join(". ") : route.primaryTemplate?.promptFocusEn ?? "";
  const withQuality = appendQualityLine(body, isSketch);
  if (!options?.hasReferenceImage) return withQuality;

  const token = IMAGE_STUDIO_PRODUCT_MENTION_TOKEN;
  if (withQuality.includes(token)) return withQuality;
  return `${withQuality} ${token}`;
}

export function buildLocalPromptAssistReply(
  text: string,
  options?: BuildLocalPromptOptions,
): string | null {
  const route = routePromptAssistIntent(text, options);
  const partial = assemblePartialPromptFromRoute(route, text, options);
  const prompt = buildLocalPromptFromUserText(text, options);
  if (!prompt) return null;

  const imageNote = options?.hasReferenceImage
    ? " L'image jointe sera utilisée via @Produit dans Image Studio."
    : "";
  const guideNote = route.primaryTemplate
    ? ` Guide détecté : ${route.primaryTemplate.labelFr}.`
    : "";
  const engineNote = partial.usedEngine ? " Assemblage partiel du guide appliqué." : "";

  return `${PROMPT_ASSIST_PROMPT_INTRO}

<prompt>${prompt}</prompt>${imageNote}${guideNote}${engineNote}

Vous pouvez l'appliquer tel quel ou préciser d'autres détails (produit, environnement, ratio).`;
}
