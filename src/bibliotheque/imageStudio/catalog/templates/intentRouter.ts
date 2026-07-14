import { findGlossaryMatchesInText } from "../glossary/match";
import { getTemplateCatalogEntryById, IMAGE_STUDIO_TEMPLATE_CATALOG } from "./buildCatalog";
import { scoreTemplateIntentMatch } from "./match";
import type { ImageStudioTemplateCatalogEntry } from "./types";

export type PromptAssistRouteConfidence = "high" | "medium" | "low" | "none";

export type PromptAssistIntentRoute = {
  primaryTemplateId: string | null;
  primaryTemplate: ImageStudioTemplateCatalogEntry | null;
  confidence: PromptAssistRouteConfidence;
  score: number;
  matchedIntentTags: string[];
  matchedGlossaryTemplateIds: string[];
  alternatives: Array<{ templateId: string; score: number }>;
  /** Variables du guide prioritaire à privilégier dans le prompt. */
  suggestedVariableKeys: string[];
};

export type RoutePromptAssistIntentOptions = {
  hasReferenceImage?: boolean;
};

type RoutingBoostRule = {
  templateId: string;
  terms: string[];
  weight: number;
};

const GLOSSARY_HINT_WEIGHT = 1.5;
const IMAGE_REFERENCE_WEIGHT = 0.75;

/** Règles de désambiguïsation (boost ciblé au-delà des tags catalogue). */
const ROUTING_BOOST_RULES: RoutingBoostRule[] = [
  {
    templateId: "outfit-studio",
    terms: ["veste", "pantalon", "robe", "manteau", "lookbook", "styling", "vetement"],
    weight: 3,
  },
  {
    templateId: "editorial-worn-held",
    terms: ["bijou", "bracelet", "bague", "collier", "montre", "boucle d oreille"],
    weight: 4,
  },
  {
    templateId: "produit-en-application",
    terms: ["creme", "serum", "cosmetique", "application", "hydratant", "maquillage"],
    weight: 3,
  },
  {
    templateId: "product-photography",
    terms: ["boisson", "canette", "bouteille", "energy drink", "soda", "jus"],
    weight: 4,
  },
  {
    templateId: "ugc-selfie-produit",
    terms: ["selfie", "miroir", "tiktok", "creator", "influenceur"],
    weight: 3,
  },
  {
    templateId: "ugc-presentation-produit",
    terms: ["presentation produit", "face camera", "demo produit", "essayage"],
    weight: 2.5,
  },
  {
    templateId: "packshot-dynamique",
    terms: ["packshot", "e-commerce", "fiche produit", "fond blanc", "catalogue"],
    weight: 3,
  },
  {
    templateId: "brand-campaign-shoot",
    terms: ["campagne publicitaire", "shooting premium", "lookbook luxe"],
    weight: 2.5,
  },
  {
    templateId: "lifestyle-product-photography",
    terms: ["en main", "terrain de", "salle de sport", "decor reel"],
    weight: 2,
  },
];

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectMatchedIntentTags(entry: ImageStudioTemplateCatalogEntry, text: string): string[] {
  const normalizedText = normalizeForMatch(text);
  return entry.intentTagsFr.filter((tag) => normalizedText.includes(normalizeForMatch(tag)));
}

function scoreGlossaryTemplateHints(text: string): Map<string, number> {
  const scores = new Map<string, number>();
  for (const entry of findGlossaryMatchesInText(text)) {
    if (!entry.templateHint) continue;
    scores.set(
      entry.templateHint,
      (scores.get(entry.templateHint) ?? 0) + GLOSSARY_HINT_WEIGHT,
    );
  }
  return scores;
}

function scoreRoutingBoostRules(text: string): Map<string, number> {
  const normalizedText = normalizeForMatch(text);
  const scores = new Map<string, number>();

  for (const rule of ROUTING_BOOST_RULES) {
    const matched = rule.terms.some((term) => normalizedText.includes(normalizeForMatch(term)));
    if (!matched) continue;
    scores.set(rule.templateId, (scores.get(rule.templateId) ?? 0) + rule.weight);
  }

  return scores;
}

function scoreImageReferenceBoost(
  entry: ImageStudioTemplateCatalogEntry,
  hasReferenceImage: boolean,
): number {
  if (!hasReferenceImage) return 0;
  if (entry.mentionHint === "produit" || entry.mentionHint === "garment") {
    return IMAGE_REFERENCE_WEIGHT;
  }
  return 0;
}

function computeTemplateScore(
  entry: ImageStudioTemplateCatalogEntry,
  text: string,
  glossaryScores: Map<string, number>,
  boostScores: Map<string, number>,
  options?: RoutePromptAssistIntentOptions,
): number {
  return (
    scoreTemplateIntentMatch(entry, text) +
    (glossaryScores.get(entry.id) ?? 0) +
    (boostScores.get(entry.id) ?? 0) +
    scoreImageReferenceBoost(entry, Boolean(options?.hasReferenceImage))
  );
}

function resolveConfidence(
  topScore: number,
  secondScore: number,
): PromptAssistRouteConfidence {
  if (topScore <= 0) return "none";
  if (topScore >= 3 && topScore - secondScore >= 2) return "high";
  if (topScore >= 2 || topScore - secondScore >= 1) return "medium";
  return "low";
}

function buildSuggestedVariableKeys(
  template: ImageStudioTemplateCatalogEntry | null,
): string[] {
  if (!template) return [];
  const required = template.variables.filter((variable) => variable.required).map((v) => v.key);
  const optional = template.variables
    .filter((variable) => !variable.required)
    .slice(0, 4)
    .map((v) => v.key);
  return [...new Set([...required, ...optional])];
}

/** Route l'intention utilisateur vers le template guide le plus pertinent (étape 3). */
export function routePromptAssistIntent(
  text: string,
  options?: RoutePromptAssistIntentOptions,
): PromptAssistIntentRoute {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) {
    return {
      primaryTemplateId: null,
      primaryTemplate: null,
      confidence: "none",
      score: 0,
      matchedIntentTags: [],
      matchedGlossaryTemplateIds: [],
      alternatives: [],
      suggestedVariableKeys: [],
    };
  }

  const glossaryScores = scoreGlossaryTemplateHints(text);
  const boostScores = scoreRoutingBoostRules(text);

  const ranked = IMAGE_STUDIO_TEMPLATE_CATALOG.map((entry) => ({
    entry,
    score: computeTemplateScore(entry, text, glossaryScores, boostScores, options),
  }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const primary = ranked[0]?.entry ?? null;
  const topScore = ranked[0]?.score ?? 0;
  const secondScore = ranked[1]?.score ?? 0;

  const matchedGlossaryTemplateIds = [...glossaryScores.entries()]
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([templateId]) => templateId);

  return {
    primaryTemplateId: primary?.id ?? null,
    primaryTemplate: primary,
    confidence: resolveConfidence(topScore, secondScore),
    score: topScore,
    matchedIntentTags: primary ? collectMatchedIntentTags(primary, text) : [],
    matchedGlossaryTemplateIds,
    alternatives: ranked.slice(1, 3).map((item) => ({
      templateId: item.entry.id,
      score: item.score,
    })),
    suggestedVariableKeys: buildSuggestedVariableKeys(primary),
  };
}

/** Agrège le texte utilisateur d'une conversation Prompt Assistant pour le routage contextuel. */
export function collectPromptAssistUserText(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join(" ");
}

export function getRoutedTemplateById(templateId: string): ImageStudioTemplateCatalogEntry | undefined {
  return getTemplateCatalogEntryById(templateId);
}
