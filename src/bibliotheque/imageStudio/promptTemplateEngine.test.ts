import { describe, expect, it } from "vitest";
import {
  assemblePromptFromTemplate,
  buildCustomFlavorElements,
  extractBeverageSlotsFromFirstMessage,
  extractDrinkSlotsFromMessage,
  extractSlotsFromMessage,
  fillTemplateSlotDefaults,
  hasExplicitFlavorInMessage,
  isBeverageGuideReady,
  isWeakRequiredSlot,
  mergeTemplateSlots,
  parseElementsModeChoice,
  resolveReferenceFlavorElements,
} from "./promptTemplateEngine";
import { getPromptTemplateById } from "./promptTemplates";

const productTemplate = getPromptTemplateById("product-photography");

describe("promptTemplateEngine", () => {
  if (!productTemplate) {
    throw new Error("product-photography template missing");
  }

  it("detects explicit flavor in user message", () => {
    expect(hasExplicitFlavorInMessage("Monster Energy avec des citrons verts")).toBe(true);
    expect(hasExplicitFlavorInMessage("Monster Energy")).toBe(false);
    expect(hasExplicitFlavorInMessage("Coca-Cola, oranges autour")).toBe(true);
  });

  it("extracts complete slots from first message when elements are explicit", () => {
    const slots = extractBeverageSlotsFromFirstMessage(
      "Monster Energy avec des citrons verts",
      productTemplate,
    );

    expect(slots.drink).toMatch(/Monster Energy/i);
    expect(slots.flavorElements).toMatch(/lime/i);
  });

  it("skips flavor on first message when elements are not explicit", () => {
    const slots = extractBeverageSlotsFromFirstMessage("Monster Energy", productTemplate);

    expect(slots.drink).toMatch(/Monster Energy/i);
    expect(slots.flavorElements).toBeUndefined();
  });

  it("extracts drink only without flavor when using extractDrinkSlotsFromMessage", () => {
    const slots = extractDrinkSlotsFromMessage(
      "Monster Energy avec des citrons verts",
      productTemplate,
    );

    expect(slots.drink).toMatch(/Monster Energy/i);
    expect(slots.flavorElements).toBeUndefined();
    expect(slots.brandBackdrop).toMatch(/green radial glow/i);
  });

  it("still extracts flavor with full extractSlotsFromMessage", () => {
    const slots = extractSlotsFromMessage(
      "Monster Energy avec des citrons verts",
      productTemplate,
    );

    expect(slots.drink).toMatch(/Monster Energy/i);
    expect(slots.flavorElements).toMatch(/lime/i);
  });

  it("parses elements mode choices", () => {
    expect(parseElementsModeChoice("référence")).toBe("reference");
    expect(parseElementsModeChoice("Éléments de référence de la marque")).toBe("reference");
    expect(parseElementsModeChoice("Choisir moi-même")).toBe("custom");
    expect(parseElementsModeChoice("Choisir moi-même les éléments")).toBe("custom");
    expect(parseElementsModeChoice("banane")).toBeNull();
  });

  it("resolves reference flavor from known brand", () => {
    const flavor = resolveReferenceFlavorElements(
      { drink: "Monster Energy drink" },
      productTemplate,
    );

    expect(flavor).toMatch(/lime/i);
  });

  it("builds custom flavor elements from user description", () => {
    const flavor = buildCustomFlavorElements("citrons verts et feuilles de menthe");
    expect(flavor).toMatch(/green limes/i);
    expect(flavor).toMatch(/orbital arrangement/i);
  });

  it("requires flavor elements before beverage guide is ready", () => {
    expect(
      isBeverageGuideReady(productTemplate, { drink: "Monster Energy drink" }),
    ).toBe(false);
    expect(
      isBeverageGuideReady(productTemplate, {
        drink: "Monster Energy drink",
        flavorElements: "Fresh limes — whole and sliced",
      }),
    ).toBe(true);
  });

  it("uses defaults for unspecified beverage slots", () => {
    const slots = fillTemplateSlotDefaults(productTemplate, {
      drink: "craft mango juice",
    });

    expect(slots.drink).toBe("craft mango juice");
    expect(slots.flavorElements).toMatch(/Fresh ingredients/i);
    expect(slots.brandBackdrop).toMatch(/brand's primary color/i);
  });

  it("assembles the full multi-section beverage prompt", () => {
    const prompt = assemblePromptFromTemplate(productTemplate, {
      drink: "Monster Energy drink",
      packaging: "in its iconic aluminum can format",
      flavorElements: "Fresh limes — whole and sliced",
      brandBackdrop: "Deep black studio backdrop with green radial glow",
      brandPalette: "Neon green and matte black",
    });

    expect(prompt).toMatch(/^Ultra-sharp studio product photography/i);
    expect(prompt).toContain("SUBJECT: Iconic Monster Energy drink");
    expect(prompt).toContain("SURROUNDING ELEMENTS:");
    expect(prompt).toContain("Portrait orientation 9:16");
    expect(prompt).toContain("Helmut Newton");
  });

  it("flags style-only messages as weak required slot", () => {
    expect(isWeakRequiredSlot(productTemplate, { drink: "luxe" })).toBe(true);
    expect(isWeakRequiredSlot(productTemplate, { drink: "Monster Energy drink" })).toBe(false);
  });

  it("merges new slot values without dropping existing ones", () => {
    const merged = mergeTemplateSlots(
      { drink: "sparkling grapefruit soda" },
      { flavorElements: "Fresh grapefruit slices — whole and sliced" },
    );

    expect(merged.drink).toBe("sparkling grapefruit soda");
    expect(merged.flavorElements).toMatch(/grapefruit/i);
  });
});
