import { PROMPT_MENTION_OPTIONS } from "@/bibliotheque/imageStudio/promptMentions";

export const IMAGE_STUDIO_PRODUCT_MENTION_TOKEN =
  PROMPT_MENTION_OPTIONS.find((option) => option.kind === "Produit")?.token ?? "@Produit";

export const IMAGE_STUDIO_IMAGE1_MENTION_TOKEN =
  PROMPT_MENTION_OPTIONS.find((option) => option.kind === "Image1")?.token ?? "@Image1";

export type ImageStudioGuideApplyPayload =
  | string
  | {
      prompt: string;
      productImageUrl?: string | null;
      productFocus?: string | null;
      /** Deuxième vêtement uploadé — mappé sur @Image1 dans le prompt assemblé. */
      importedRefImageUrl?: string | null;
    };

export function resolveImageStudioGuideApplyPayload(payload: ImageStudioGuideApplyPayload): {
  prompt: string;
  productImageUrl: string | null;
  productFocus: string | null;
  importedRefImageUrl: string | null;
} {
  if (typeof payload === "string") {
    return {
      prompt: payload,
      productImageUrl: null,
      productFocus: null,
      importedRefImageUrl: null,
    };
  }

  const url =
    typeof payload.productImageUrl === "string" ? payload.productImageUrl.trim() : "";
  const productFocus =
    typeof payload.productFocus === "string" ? payload.productFocus.trim() : "";
  const importedRefImageUrl =
    typeof payload.importedRefImageUrl === "string" ? payload.importedRefImageUrl.trim() : "";
  return {
    prompt: payload.prompt,
    productImageUrl: url || null,
    productFocus: productFocus || null,
    importedRefImageUrl: importedRefImageUrl || null,
  };
}
