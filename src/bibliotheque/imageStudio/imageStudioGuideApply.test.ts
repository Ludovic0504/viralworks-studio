import { describe, expect, it } from "vitest";
import {
  IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
  resolveImageStudioGuideApplyPayload,
} from "./imageStudioGuideApply";

describe("imageStudioGuideApply", () => {
  it("keeps string payloads as prompt-only applies", () => {
    expect(resolveImageStudioGuideApplyPayload("hello prompt")).toEqual({
      prompt: "hello prompt",
      productImageUrl: null,
      productFocus: null,
      importedRefImageUrl: null,
    });
  });

  it("extracts product image url and focus from object payloads", () => {
    expect(
      resolveImageStudioGuideApplyPayload({
        prompt: "use @Produit",
        productImageUrl: "data:image/png;base64,abc",
        productFocus: "la veste uniquement",
        importedRefImageUrl: "data:image/png;base64,def",
      }),
    ).toEqual({
      prompt: "use @Produit",
      productImageUrl: "data:image/png;base64,abc",
      productFocus: "la veste uniquement",
      importedRefImageUrl: "data:image/png;base64,def",
    });
  });

  it("uses the canonical product mention token", () => {
    expect(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN).toBe("@Produit");
  });
});
