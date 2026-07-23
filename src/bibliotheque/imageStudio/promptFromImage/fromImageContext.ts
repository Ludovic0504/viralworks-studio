import {
  IMAGE_STUDIO_IMAGE1_MENTION_TOKEN,
  IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
} from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import type {
  AccessoriesDecision,
  ClothingDecision,
  ClothingPieceType,
  PersonTraits,
  PromptFromImageContext,
} from "./types";

export function shouldSkipIdentitySteps(ctx: PromptFromImageContext | null | undefined): boolean {
  return Boolean(ctx?.personTraits);
}

export function shouldSkipClothingProductStep(
  ctx: PromptFromImageContext | null | undefined,
): boolean {
  if (!ctx?.clothing) return false;
  if (ctx.clothing.mode === "keep_avatar_outfit") return true;
  return ctx.clothing.refs.length > 0 || Boolean(ctx.clothing.notes.trim());
}

export function genderFromContext(
  ctx: PromptFromImageContext | null | undefined,
): "homme" | "femme" | null {
  return ctx?.personTraits?.gender ?? null;
}

export function physiqueFromContext(ctx: PromptFromImageContext | null | undefined): string {
  return ctx?.personTraits?.physiquePrompt?.trim() ?? "";
}

export function ageRangeFromContext(ctx: PromptFromImageContext | null | undefined): string {
  return ctx?.personTraits?.ageRange?.trim() ?? "";
}

function pieceFocusLabel(pieceType: ClothingPieceType | null | undefined, scope?: string | null): string {
  if (scope === "full_outfit" || pieceType === "tenue_entiere") {
    return "full outfit from reference";
  }
  if (pieceType === "haut") return "top garment only from reference";
  if (pieceType === "bas") return "bottom garment only from reference";
  if (pieceType === "chaussures") return "footwear only from reference";
  return "clothing from reference";
}

/**
 * Notes tenue en anglais pour productFocus / slots productOutfit.
 */
export function buildClothingNotesForPrompt(
  clothing: ClothingDecision | null | undefined,
  person?: PersonTraits | null,
): string {
  if (!clothing) return "";
  if (clothing.mode === "keep_avatar_outfit") {
    return "Keep the exact outfit worn by the person in the @Avatar reference image.";
  }

  const parts: string[] = [];
  for (const ref of clothing.refs) {
    if (ref.source === "text" && ref.text) {
      parts.push(ref.text.trim());
    } else if (ref.source === "image") {
      parts.push(pieceFocusLabel(ref.pieceType, ref.scope));
    }
  }
  if (clothing.notes.trim()) {
    parts.push(clothing.notes.trim());
  }
  if (clothing.restRandom) {
    parts.push("Fill any remaining outfit pieces with tasteful random complementary clothing.");
  }
  if (person?.gender) {
    parts.push(`Subject is ${person.gender === "homme" ? "male" : "female"}.`);
  }
  return parts.filter(Boolean).join(" ");
}

/**
 * Consigne accessoires / objets tenus (enceinte, sac, etc.) par rapport à @Avatar.
 */
export function buildAccessoriesNotesForPrompt(
  accessories: AccessoriesDecision | null | undefined,
): string {
  if (!accessories) return "";
  if (accessories.mode === "keep") {
    return "Keep any handheld accessories or props held by the person in the @Avatar reference image.";
  }
  if (accessories.mode === "replace") {
    const notes = accessories.notes.trim();
    return notes
      ? `Do NOT reproduce any handheld accessories or props from the @Avatar reference image. Instead, include these accessories: ${notes}.`
      : "Do NOT reproduce any handheld accessories, objects, or props held by the person in the @Avatar reference image. Hands should be empty unless the prompt specifies a product to hold.";
  }
  return "Do NOT reproduce any handheld accessories, objects, speakers, bags, bottles, or props held by the person in the @Avatar reference image. Hands should be empty unless the prompt specifies a product to hold.";
}

export type FromImageGuideApplyExtras = {
  avatarUrl: string | null;
  productImageUrl: string | null;
  importedRefImageUrl: string | null;
  productFocus: string | null;
  /** Consigne accessoires injectée côté @Avatar dans le bloc [Refs]. */
  avatarFocus: string | null;
  /** Mentions à garantir dans le prompt */
  ensureTokens: string[];
};

/**
 * Mappe le contexte vers les slots Image Studio (@Avatar, @Produit, @Image1).
 */
export function buildGuideApplyExtrasFromImageContext(
  ctx: PromptFromImageContext | null | undefined,
): FromImageGuideApplyExtras {
  if (!ctx) {
    return {
      avatarUrl: null,
      productImageUrl: null,
      importedRefImageUrl: null,
      productFocus: null,
      avatarFocus: null,
      ensureTokens: [],
    };
  }

  const ensureTokens = ["@Avatar"];
  const imageRefs =
    ctx.clothing?.mode === "change"
      ? ctx.clothing.refs.filter((r) => r.source === "image" && r.imageUrl)
      : [];

  const productImageUrl = imageRefs[0]?.imageUrl ?? null;
  const importedRefImageUrl = imageRefs[1]?.imageUrl ?? null;

  if (productImageUrl) ensureTokens.push(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN);
  if (importedRefImageUrl) ensureTokens.push(IMAGE_STUDIO_IMAGE1_MENTION_TOKEN);

  const productFocus = buildClothingNotesForPrompt(ctx.clothing, ctx.personTraits) || null;
  const avatarFocus = buildAccessoriesNotesForPrompt(ctx.accessories) || null;

  return {
    avatarUrl: ctx.avatarUrl || null,
    productImageUrl,
    importedRefImageUrl,
    productFocus,
    avatarFocus,
    ensureTokens,
  };
}

export function ensureMentionTokensInPrompt(prompt: string, tokens: string[]): string {
  let next = prompt;
  for (const token of tokens) {
    if (!next.includes(token)) {
      next = `${next} ${token}`.trim();
    }
  }
  return next;
}

/** Première étape d’un guide personne quand le contexte from-image est prêt. */
export function brandCampaignInitialStep(
  ctx: PromptFromImageContext | null | undefined,
): "gender" | "ambiance" {
  return shouldSkipIdentitySteps(ctx) ? "ambiance" : "gender";
}

export function ugcSelfieInitialStep(
  ctx: PromptFromImageContext | null | undefined,
): "gender" | "product" | "location" {
  if (!shouldSkipIdentitySteps(ctx)) return "gender";
  return shouldSkipClothingProductStep(ctx) ? "location" : "product";
}

export function outfitStudioInitialStep(
  ctx: PromptFromImageContext | null | undefined,
): "gender" | "clothing" | "sceneType" {
  if (!shouldSkipIdentitySteps(ctx)) return "gender";
  if (shouldSkipClothingProductStep(ctx)) return "sceneType";
  return "clothing";
}
