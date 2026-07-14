import { describe, expect, it } from "vitest";
import {
  collectPromptAssistUserText,
  routePromptAssistIntent,
} from "./intentRouter";
import { buildPromptAssistRoutingContextBlock } from "./routingContext";

describe("promptAssistIntentRouter", () => {
  it("routes packshot e-commerce to packshot-dynamique with high confidence", () => {
    const route = routePromptAssistIntent("packshot e-commerce fond blanc pour ma bougie");
    expect(route.primaryTemplateId).toBe("packshot-dynamique");
    expect(route.confidence).not.toBe("none");
    expect(route.matchedIntentTags.length).toBeGreaterThan(0);
  });

  it("routes garment on mannequin to outfit-studio", () => {
    const route = routePromptAssistIntent("veste portée par un mannequin editorial");
    expect(route.primaryTemplateId).toBe("outfit-studio");
    expect(route.confidence).not.toBe("none");
  });

  it("routes jewelry worn to editorial-worn-held", () => {
    const route = routePromptAssistIntent("bracelet porté editorial sur le poignet");
    expect(route.primaryTemplateId).toBe("editorial-worn-held");
  });

  it("routes selfie UGC to ugc-selfie-produit", () => {
    const route = routePromptAssistIntent("selfie ugc naturel avec mon produit");
    expect(route.primaryTemplateId).toBe("ugc-selfie-produit");
  });

  it("routes beverage hero to product-photography", () => {
    const route = routePromptAssistIntent("canette energy drink avec splash citron vert");
    expect(route.primaryTemplateId).toBe("product-photography");
  });

  it("routes skincare application to produit-en-application", () => {
    const route = routePromptAssistIntent("creme hydratante en application sur la peau");
    expect(route.primaryTemplateId).toBe("produit-en-application");
  });

  it("boosts image-reference templates when an image is attached", () => {
    const withoutImage = routePromptAssistIntent("produit mode premium");
    const withImage = routePromptAssistIntent("produit mode premium", {
      hasReferenceImage: true,
    });
    expect(withImage.score).toBeGreaterThanOrEqual(withoutImage.score);
  });

  it("aggregates conversation text for contextual routing", () => {
    const messages = [
      { role: "user" as const, content: "je veux un packshot" },
      { role: "assistant" as const, content: "Quel fond ?" },
      { role: "user" as const, content: "fond blanc e-commerce" },
    ];
    const text = collectPromptAssistUserText(messages);
    const route = routePromptAssistIntent(text);
    expect(route.primaryTemplateId).toBe("packshot-dynamique");
  });

  it("builds routing context block for the LLM", () => {
    const route = routePromptAssistIntent("packshot fond blanc");
    const block = buildPromptAssistRoutingContextBlock(route);
    expect(block).toContain("[Routage Prompt Assistant");
    expect(block).toContain("packshot-dynamique");
    expect(block).toContain("Focus EN");
  });

  it("returns null routing block when no template matches", () => {
    const route = routePromptAssistIntent("bonjour");
    expect(buildPromptAssistRoutingContextBlock(route)).toBeNull();
  });

  it("suggests required variable keys for the routed template", () => {
    const route = routePromptAssistIntent("packshot produit artisanal");
    expect(route.suggestedVariableKeys).toContain("productDescription");
  });
});
