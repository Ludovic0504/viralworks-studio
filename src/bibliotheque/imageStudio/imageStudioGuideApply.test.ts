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
      avatarFocus: null,
      importedRefImageUrl: null,
      avatarUrl: null,
    });
  });

  it("extracts product image url and focus from object payloads", () => {
    expect(
      resolveImageStudioGuideApplyPayload({
        prompt: "use @Produit",
        productImageUrl: "data:image/png;base64,abc",
        productFocus: "la veste uniquement",
        avatarFocus: "Do NOT reproduce accessories from @Avatar",
        importedRefImageUrl: "data:image/png;base64,def",
        avatarUrl: "data:image/png;base64,avatar",
      }),
    ).toEqual({
      prompt: "use @Produit",
      productImageUrl: "data:image/png;base64,abc",
      productFocus: "la veste uniquement",
      avatarFocus: "Do NOT reproduce accessories from @Avatar",
      importedRefImageUrl: "data:image/png;base64,def",
      avatarUrl: "data:image/png;base64,avatar",
    });
  });

  it("uses the canonical product mention token", () => {
    expect(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN).toBe("@Produit");
  });
});
