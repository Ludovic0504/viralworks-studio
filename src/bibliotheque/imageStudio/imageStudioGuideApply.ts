import { PROMPT_MENTION_OPTIONS } from "@/bibliotheque/imageStudio/promptMentions";

export const IMAGE_STUDIO_PRODUCT_MENTION_TOKEN =
  PROMPT_MENTION_OPTIONS.find((option) => option.kind === "Produit")?.token ?? "@Produit";

export type ImageStudioGuideApplyPayload =
  | string
  | {
      prompt: string;
      productImageUrl?: string | null;
      productFocus?: string | null;
    };

export function resolveImageStudioGuideApplyPayload(payload: ImageStudioGuideApplyPayload): {
  prompt: string;
  productImageUrl: string | null;
  productFocus: string | null;
} {
  if (typeof payload === "string") {
    return { prompt: payload, productImageUrl: null, productFocus: null };
  }

  const url =
    typeof payload.productImageUrl === "string" ? payload.productImageUrl.trim() : "";
  const productFocus =
    typeof payload.productFocus === "string" ? payload.productFocus.trim() : "";
  return {
    prompt: payload.prompt,
    productImageUrl: url || null,
    productFocus: productFocus || null,
  };
}
