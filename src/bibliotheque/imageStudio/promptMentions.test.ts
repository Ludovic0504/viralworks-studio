import { describe, expect, it } from "vitest";
import {
  countMentionOccurrences,
  getImageStudioUserPrompt,
  parseMentionKindsInOrder,
  promptHasMentions,
  resolvePromptMentions,
  splitPromptForMentionHighlight,
  stripImageStudioCompositionBlock,
} from "./promptMentions";

describe("promptMentions", () => {
  it("returns mention kinds in order of first appearance", () => {
    expect(parseMentionKindsInOrder("Use @Produit then @Avatar and @Produit again")).toEqual([
      "Produit",
      "Avatar",
    ]);
  });

  it("counts repeated mentions", () => {
    expect(countMentionOccurrences("@Avatar looks at @Avatar", "Avatar")).toBe(2);
  });

  it("detects when prompt has mentions", () => {
    expect(promptHasMentions("plain prompt")).toBe(false);
    expect(promptHasMentions("with @Image1 ref")).toBe(true);
  });

  it("keeps user prompt separate from generation prompt", () => {
    const userText = "Show @Avatar with @Produit";
    const result = resolvePromptMentions(userText, {
      avatarUrl: "https://cdn/avatar.png",
      productUrl: "https://cdn/product.png",
      image1Url: null,
    });

    expect(result.userPrompt).toBe(userText);
    expect(result.generationPrompt).toContain(userText);
    expect(result.generationPrompt).toContain("[Refs]");
    expect(stripImageStudioCompositionBlock(result.generationPrompt)).toBe(userText);
    expect(result.generationPrompt.indexOf(userText)).toBe(0);
  });

  it("injects product focus scope in refs block without altering user prompt body", () => {
    const userText =
      "Photorealistic lifestyle portrait. She is fully wearing @Produit in a luxury closet.";
    const result = resolvePromptMentions(userText, {
      avatarUrl: null,
      productUrl: "https://cdn/product.png",
      image1Url: null,
      productFocus: "la veste uniquement, ignorer le pantalon",
    });

    expect(result.userPrompt).toBe(userText);
    expect(stripImageStudioCompositionBlock(result.generationPrompt)).toBe(userText);
    expect(result.generationPrompt).toContain("@Produit scope:");
    expect(result.generationPrompt).toContain("la veste uniquement, ignorer le pantalon");
    expect(result.generationPrompt).toContain("Ignore every other garment");
  });

  it("resolves attached mentions to ordered reference images with role instructions", () => {
    const result = resolvePromptMentions("Show @Avatar with @Produit", {
      avatarUrl: "https://cdn/avatar.png",
      productUrl: "https://cdn/product.png",
      image1Url: null,
    });

    expect(result.referenceImages).toEqual([
      "https://cdn/avatar.png",
      "https://cdn/product.png",
    ]);
    expect(result.generationPrompt).toContain("@Avatar=image1");
    expect(result.generationPrompt).toContain("@Produit=image2");
    expect(result.generationPrompt).toContain("identité du personnage");
  });

  it("allows mentions without attached assets when described in text", () => {
    const result = resolvePromptMentions(
      "@Avatar dans une salle de sport moderne avec @Produit",
      {
        avatarUrl: null,
        productUrl: "https://cdn/product.png",
        image1Url: null,
      },
    );

    expect(result.referenceImages).toEqual(["https://cdn/product.png"]);
    expect(result.generationPrompt).toContain("@Avatar sans image");
    expect(result.generationPrompt).toContain("@Produit=image1");
  });

  it("prioritizes scene image before avatar when both are attached", () => {
    const result = resolvePromptMentions(
      "@Avatar in @Image1 showing @Produit",
      {
        avatarUrl: "https://cdn/a.png",
        productUrl: "https://cdn/p.png",
        image1Url: "https://cdn/i.png",
      },
    );

    expect(result.referenceImages).toEqual([
      "https://cdn/i.png",
      "https://cdn/a.png",
      "https://cdn/p.png",
    ]);
    expect(result.generationPrompt).toContain("@Image1=image1");
    expect(result.generationPrompt).toContain("@Avatar=image2");
    expect(result.generationPrompt).toContain("@Produit=image3");
    expect(result.generationPrompt).toContain("Remplacer toute personne visible");
  });

  it("adds explicit replacement hint when user asks to replace a person", () => {
    const result = resolvePromptMentions(
      "@Avatar dans @Image1 a la place de la personne en noir",
      {
        avatarUrl: "https://cdn/a.png",
        productUrl: null,
        image1Url: "https://cdn/i.png",
      },
    );

    expect(result.generationPrompt).toContain("remplacement explicite");
  });

  it("strips composition block from stored history prompts", () => {
    const stored =
      "Mon prompt\n\n[Refs] Mapping: @Avatar=image1 (identité du personnage)";
    expect(getImageStudioUserPrompt(stored)).toBe("Mon prompt");
  });

  it("splits prompt into highlight parts with resolved state", () => {
    const parts = splitPromptForMentionHighlight("@Avatar and @Produit", {
      avatarUrl: "https://cdn/a.png",
      productUrl: null,
      image1Url: null,
    });

    expect(parts).toEqual([
      { type: "mention", value: "@Avatar", kind: "Avatar", resolved: true },
      { type: "text", value: " and " },
      { type: "mention", value: "@Produit", kind: "Produit", resolved: false },
    ]);
  });

  it("keeps text-only flow when no mentions are present", () => {
    const result = resolvePromptMentions("A simple scene", {
      avatarUrl: "https://cdn/avatar.png",
      productUrl: null,
      image1Url: null,
    });

    expect(result.referenceImages).toEqual([]);
    expect(result.userPrompt).toBe("A simple scene");
    expect(result.generationPrompt).toBe("A simple scene");
  });

  it("sends imported image without @Image1 and without composition instructions", () => {
    const userText = "Ultra-realistic lifestyle product photography";
    const result = resolvePromptMentions(userText, {
      avatarUrl: null,
      productUrl: null,
      image1Url: "https://cdn/imported-ref.png",
    });

    expect(result.referenceImages).toEqual(["https://cdn/imported-ref.png"]);
    expect(result.userPrompt).toBe(userText);
    expect(result.generationPrompt).toBe(userText);
    expect(result.generationPrompt).not.toContain("[Refs]");
  });
});
