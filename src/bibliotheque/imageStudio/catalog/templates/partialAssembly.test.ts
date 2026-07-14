import { describe, expect, it } from "vitest";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "@/bibliotheque/imageStudio/imageStudioGuideApply";
import { assemblePartialPromptFromRoute } from "./partialAssembly";
import { routePromptAssistIntent } from "./intentRouter";
import { buildPromptAssistRoutingContextBlock } from "./routingContext";

describe("promptAssistPartialAssembly", () => {
  it("assembles outfit-studio prompt in English with @Produit when image is attached", () => {
    const text = "veste portée par un mannequin editorial";
    const route = routePromptAssistIntent(text, { hasReferenceImage: true });
    const partial = assemblePartialPromptFromRoute(route, text, { hasReferenceImage: true });

    expect(partial.usedEngine).toBe(true);
    expect(partial.templateId).toBe("outfit-studio");
    expect(partial.enginePrompt).toContain(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN);
    expect(partial.displayPromptEn).toContain("editorial fashion");
    expect(partial.displayPromptEn).toContain(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN);
  });

  it("assembles packshot prompt with @Produit in product slot", () => {
    const text = "packshot e-commerce fond blanc";
    const route = routePromptAssistIntent(text, { hasReferenceImage: true });
    const partial = assemblePartialPromptFromRoute(route, text, { hasReferenceImage: true });

    expect(partial.templateId).toBe("packshot-dynamique");
    expect(partial.enginePrompt).toContain("Photo produit packshot");
    expect(partial.enginePrompt).toContain(IMAGE_STUDIO_PRODUCT_MENTION_TOKEN);
    expect(partial.displayPromptEn).toContain("dynamic packshot");
    expect(partial.displayPromptEn).not.toContain("Photo produit packshot");
  });

  it("skips partial assembly when confidence is too low", () => {
    const text = "bonjour";
    const route = routePromptAssistIntent(text);
    const partial = assemblePartialPromptFromRoute(route, text);

    expect(partial.usedEngine).toBe(false);
    expect(partial.enginePrompt).toBeNull();
  });

  it("injects partial assembly into routing context for the LLM", () => {
    const text = "packshot fond blanc";
    const route = routePromptAssistIntent(text, { hasReferenceImage: true });
    const block = buildPromptAssistRoutingContextBlock(route, text, { hasReferenceImage: true });

    expect(block).toContain("Assemblage partiel (moteur guide)");
    expect(block).toContain("packshot-dynamique");
  });
});
