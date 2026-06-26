import { describe, expect, it } from "vitest";
import {
  assemblePromptFromTemplate,
  extractSlotsFromMessage,
  fillTemplateSlotDefaults,
  isWeakRequiredSlot,
  mergeTemplateSlots,
} from "./promptTemplateEngine";
import { getPromptTemplateById } from "./promptTemplates";

const productTemplate = getPromptTemplateById("product-photography");

describe("promptTemplateEngine", () => {
  if (!productTemplate) {
    throw new Error("product-photography template missing");
  }

  it("extracts Monster Energy drink and lime flavor from French message", () => {
    const slots = extractSlotsFromMessage(
      "Monster Energy avec des citrons verts",
      productTemplate,
    );

    expect(slots.drink).toMatch(/Monster Energy/i);
    expect(slots.flavorElements).toMatch(/lime/i);
    expect(slots.brandBackdrop).toMatch(/green radial glow/i);
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
