import {
  IMAGE_STUDIO_IMAGE1_MENTION_TOKEN,
  IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
} from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { parseFramingOverrideFromNotes } from "@/bibliotheque/imageStudio/outfitStudioConfig";
import type { TemplateSlotValues } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { fillTemplateSlotDefaults } from "@/bibliotheque/imageStudio/promptTemplateEngine";
import { getPromptTemplateById } from "@/bibliotheque/imageStudio/promptTemplates";

export type InferPartialSlotsOptions = {
  hasReferenceImage?: boolean;
  hasSecondaryImage?: boolean;
};

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractClothingNotes(text: string): string {
  const cleaned = text
    .replace(
      /\b(je veux|je souhaite|port[ée]e?|mannequin|modele|editorial|studio|produit|image jointe)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 3 ? cleaned : "garment from uploaded reference";
}

function extractProductPhrase(text: string): string {
  const cleaned = text
    .replace(/\b(je veux|packshot|e-?commerce|fond blanc|studio|produit)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 3 ? cleaned.slice(0, 160) : "";
}

function resolveProductToken(text: string, options?: InferPartialSlotsOptions): string {
  if (options?.hasReferenceImage) return IMAGE_STUDIO_PRODUCT_MENTION_TOKEN;
  return extractProductPhrase(text) || IMAGE_STUDIO_PRODUCT_MENTION_TOKEN;
}

function inferGenderId(text: string): "homme" | "femme" {
  const normalized = normalizeForMatch(text);
  if (/\b(homme|male|masculin)\b/.test(normalized)) return "homme";
  return "femme";
}

function inferOutfitSceneTypeId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(selfie|miroir)\b/.test(normalized)) return "mirror-selfie";
  if (/\b(lifestyle|exterieur|exterieur|rue|urbain)\b/.test(normalized)) {
    return "lifestyle-exterieur";
  }
  if (/\b(interieur|coffee|boutique|magasin)\b/.test(normalized)) {
    return "interieur-commercial";
  }
  return "studio-blanc";
}

function inferOutfitSubContextId(sceneTypeId: string): string {
  switch (sceneTypeId) {
    case "lifestyle-exterieur":
      return "rue-urbaine";
    case "interieur-commercial":
      return "concept-store";
    case "mirror-selfie":
      return "dressing";
    default:
      return "blanc-pur";
  }
}

function inferPackshotBackgroundId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(environnement|decor|scene|contexte)\b/.test(normalized)) return "environnement";
  return "neutre";
}

function inferPackshotPositionId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(levitation|flottant|flotte|suspendu)\b/.test(normalized)) return "levitation";
  if (/\b(incline|penche|tilt)\b/.test(normalized)) return "debout-incline";
  if (/\b(allonge|couch)\b/.test(normalized)) return "allonge";
  return "debout-droit";
}

function inferPackshotInteractionId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(fumee|fumée|vapeur|smoke)\b/.test(normalized)) return "fumee-vapeur";
  if (/\b(eclaboussure|splash|goutte)\b/.test(normalized)) return "eclaboussure";
  return "aucun";
}

function inferEditorialSceneTypeId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(bijou|bracelet|bague|collier|montre|boucle)\b/.test(normalized)) {
    return "bijou-porte";
  }
  return "produit-tenu";
}

function inferEditorialFramingId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(macro|gros plan)\b/.test(normalized)) return "macro";
  if (/\b(corps entier|plan entier|plein pied|full body)\b/.test(normalized)) {
    return "corps-entier";
  }
  return "mi-corps";
}

function inferEditorialZoneId(text: string, sceneTypeId: string): string {
  const normalized = normalizeForMatch(text);
  if (sceneTypeId === "bijou-porte") {
    if (/\b(poignet|main|bracelet)\b/.test(normalized)) return "poignet-main";
    if (/\b(cou|neck|collier)\b/.test(normalized)) return "cou";
    if (/\b(oreille|boucle)\b/.test(normalized)) return "oreille";
    if (/\b(doigt|bague)\b/.test(normalized)) return "doigt";
    return "poignet-main";
  }

  if (/\b(visage|levres|levre)\b/.test(normalized)) return "visage-levres";
  if (/\b(joue)\b/.test(normalized)) return "joue";
  if (/\b(cou)\b/.test(normalized)) return "cou";
  return "main";
}

function inferTextureTypeId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(serum)\b/.test(normalized)) return "serum-liquide";
  if (/\b(gel)\b/.test(normalized)) return "gel";
  return "creme-riche";
}

function inferBodyZoneId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(main|mains)\b/.test(normalized)) return "main-avant-bras";
  if (/\b(cou|decollete)\b/.test(normalized)) return "cou-decollete";
  return "visage-joue";
}

function inferLightingId(text: string): string {
  const normalized = normalizeForMatch(text);
  if (/\b(studio|flash|softbox)\b/.test(normalized)) return "studio-classique-commercial";
  return "naturelle-douce";
}

/** Slots partiels dérivés du texte utilisateur pour un template donné. */
export function inferPartialSlotsForTemplate(
  templateId: string,
  text: string,
  options?: InferPartialSlotsOptions,
): TemplateSlotValues {
  const template = getPromptTemplateById(templateId);
  const base = template ? fillTemplateSlotDefaults(template, {}) : {};

  switch (templateId) {
    case "outfit-studio": {
      const notes = extractClothingNotes(text);
      const framingOverride = parseFramingOverrideFromNotes(notes);
      const sceneTypeId = inferOutfitSceneTypeId(text);
      return {
        ...base,
        genderId: inferGenderId(text),
        sceneTypeId,
        subContextId: inferOutfitSubContextId(sceneTypeId),
        framingId: framingOverride ?? "plein-pied",
        ratioId: "4-5",
        poseId: "debout-statique",
        clothingNotes: notes,
        clothingImageCount: options?.hasReferenceImage ? "1" : "0",
      };
    }

    case "packshot-dynamique":
      return {
        ...base,
        productDescription: resolveProductToken(text, options),
        positionId: inferPackshotPositionId(text),
        backgroundId: inferPackshotBackgroundId(text),
        interactionId: inferPackshotInteractionId(text),
        productStateId: "ferme-neuf",
        formatId: "banniere-4-5",
        ambianceId: "",
        customAmbiance: "",
      };

    case "editorial-worn-held": {
      const sceneTypeId = inferEditorialSceneTypeId(text);
      const framingId = inferEditorialFramingId(text);
      return {
        ...base,
        sceneTypeId,
        genderId: inferGenderId(text),
        zoneId: inferEditorialZoneId(text, sceneTypeId),
        framingId,
        outfitDescription:
          framingId === "corps-entier"
            ? "minimal neutral outfit letting the product stand out"
            : "",
        backgroundId: inferPackshotBackgroundId(text),
        ambianceId: "",
        customAmbiance: "",
        productDescription: resolveProductToken(text, options),
        postureId: "debout",
        customGesture: "",
        formatId: "banniere-4-5",
      };
    }

    case "produit-en-application":
      return {
        ...base,
        productTypeId: "texture",
        genderId: inferGenderId(text),
        bodyZoneId: inferBodyZoneId(text),
        containerId: "visible",
        textureTypeId: inferTextureTypeId(text),
        objectTypeId: "",
        postureId: "debout",
        decorId: "studio",
        lightingId: inferLightingId(text),
        productName: resolveProductToken(text, options),
        physique: "",
      };

    default:
      return base;
  }
}

export function ensurePromptAssistMentions(
  prompt: string,
  options?: InferPartialSlotsOptions,
): string {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;

  let result = trimmed;
  if (
    options?.hasReferenceImage &&
    !result.includes(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN)
  ) {
    result = `${result} ${IMAGE_STUDIO_PRODUCT_MENTION_TOKEN}`;
  }

  if (
    options?.hasSecondaryImage &&
    !result.includes(IMAGE_STUDIO_IMAGE1_MENTION_TOKEN)
  ) {
    result = `${result} ${IMAGE_STUDIO_IMAGE1_MENTION_TOKEN}`;
  }

  return result.trim();
}
