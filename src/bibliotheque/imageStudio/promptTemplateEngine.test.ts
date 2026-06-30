import { describe, expect, it } from "vitest";
import {
  assemblePromptFromTemplate,
  buildCustomFlavorElements,
  extractBeverageSlotsFromFirstMessage,
  extractDrinkSlotsFromMessage,
  extractSlotsFromMessage,
  extractVerbatimSlot,
  fillTemplateSlotDefaults,
  hasExplicitFlavorInMessage,
  isBeverageGuideReady,
  isLifestyleGuideReady,
  isPackagingResolved,
  isWeakRequiredSlot,
  mergeTemplateSlots,
  parseElementsModeChoice,
  parsePackagingChoice,
  resolveReferenceFlavorElements,
} from "./promptTemplateEngine";
import {
  ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  getPromptTemplateById,
  PRODUCT_PHOTOGRAPHY_PLACEHOLDERS,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED,
} from "./promptTemplates";

const productTemplate = getPromptTemplateById("product-photography");

const EXPECTED_SHOT_PROMPT_VALUES: Record<string, string> = {
  "Vue basse":
    "centered, slightly low camera angle (worm's eye view), container monumental and imposing",
  "Gros plan":
    "extreme close-up on the label and container surface, macro detail, condensation droplets in foreground",
  "Explosion large":
    "wide shot, container small in frame, ingredients explosion filling 80% of the image",
  "Freeze-frame":
    "freeze-frame action shot, container mid-fall, ingredients and ice erupting outward in all directions",
  "Brume au sol":
    "smoke and mist ground effect, container emerging from a low fog layer, moody atmosphere",
  "45° diagonal":
    "45-degree angle shot, container slightly tilted, dynamic diagonal composition",
  "Serré minimal":
    "tight centered shot, container filling 70% of frame, minimal ingredients, clean and minimal",
  "Côté gauche":
    "side profile shot, container facing left, ingredients bursting from the right side",
  Underwater:
    "underwater-style shot, container submerged, bubbles and water distortion around it",
  "Vue du dessus":
    "bird's eye view, top-down flat lay, container centered from above, ingredients spread around",
};

describe("product photography prompt template", () => {
  it("matches the canonical multi-section structure with bracket placeholders", () => {
    if (!productTemplate) throw new Error("product-photography template missing");

    const { body } = productTemplate;

    expect(body).toMatch(
      new RegExp(
        `^${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.sceneIntro.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} composition\\.`,
      ),
    );
    expect(body).toContain(
      `SUBJECT: Iconic ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.drinkName} in its original packaging format (${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.formatPackaging}), ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.subjectDetail}`,
    );
    expect(body).toContain(`SURROUNDING ELEMENTS: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.flavorElements}`);
    expect(body).toContain(`BASE: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.baseSection}`);
    expect(body).toContain(`BACKGROUND: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandBackdrop}`);
    expect(body).toContain(`LIGHTING: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.lightingSection}`);
    expect(body).toContain(`COLOR PALETTE: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandPalette}`);
    expect(body).toContain(
      `COMPOSITION: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType}, portrait orientation 9:16, ingredients and flavor elements fill the frame space dynamically.`,
    );
    expect(body).toContain(`STYLE: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.styleSection}`);
  });

  it("swaps all bracket placeholders with user values", () => {
    if (!productTemplate) throw new Error("product-photography template missing");

    const prompt = assemblePromptFromTemplate(
      productTemplate,
      { drink: "Monster Energy drink", packaging: "can" },
      {
        shotType:
          "centered, slightly low camera angle (worm's eye view), container monumental and imposing",
        drinkName: "Monster Energy",
        shotId: "low-angle",
      },
    );

    expect(prompt).toContain(
      "SUBJECT: Iconic Monster Energy in its original packaging format (can),",
    );
    expect(prompt).toContain(
      "Ultra-sharp studio product photography, 50mm lens f/8, centered, slightly low camera angle (worm's eye view), container monumental and imposing composition.",
    );
    expect(prompt).toContain(
      "COMPOSITION: centered, slightly low camera angle (worm's eye view), container monumental and imposing, portrait orientation 9:16, ingredients and flavor elements fill the frame space dynamically.",
    );
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.drinkName);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.formatPackaging);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.subjectDetail);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.flavorElements);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.baseSection);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandBackdrop);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandPalette);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.sceneIntro);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.lightingSection);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.styleSection);
  });

  it("injects brand-specific slots for Monster Energy", () => {
    if (!productTemplate) throw new Error("product-photography template missing");

    const drinkSlots = extractDrinkSlotsFromMessage("Monster Energy", productTemplate);
    const flavor = resolveReferenceFlavorElements(drinkSlots, productTemplate);
    const prompt = assemblePromptFromTemplate(
      productTemplate,
      mergeTemplateSlots(drinkSlots, { flavorElements: flavor }),
      {
        shotType:
          "centered, slightly low camera angle (worm's eye view), container monumental and imposing",
        drinkName: "Monster Energy",
        shotId: "low-angle",
      },
    );

    expect(prompt).toContain("Deep black studio backdrop with a bright green radial glow");
    expect(prompt).toMatch(/Fresh limes/i);
    expect(prompt).toMatch(/Neon green claw-mark accents/i);
    expect(prompt).toContain("floating slightly above center frame");
    expect(prompt).toContain("Dramatic frozen water splash");
  });

  it("injects underwater twice with strict swap and no reformulated composition text", () => {
    if (!productTemplate) throw new Error("product-photography template missing");

    const underwaterValue = EXPECTED_SHOT_PROMPT_VALUES.Underwater;
    const drinkSlots = extractDrinkSlotsFromMessage("Monster Energy", productTemplate);
    const flavor = resolveReferenceFlavorElements(drinkSlots, productTemplate);
    const prompt = assemblePromptFromTemplate(
      productTemplate,
      mergeTemplateSlots(drinkSlots, { flavorElements: flavor }),
      {
        shotType: underwaterValue,
        drinkName: "Monster Energy",
        shotId: "underwater",
      },
    );

    expect(prompt).toContain(
      "Ultra-sharp underwater commercial product photography, 50mm lens f/8, underwater-style shot, container submerged, bubbles and water distortion around it composition.",
    );
    expect(prompt).toContain("container submerged and slightly tilted in crystal-clear water");
    expect(prompt).toContain("Dense columns of air bubbles in varied organic sizes");
    expect(prompt).toContain("Natural underwater lighting");
    expect(prompt).toContain("clear ice cubes and fresh green mint leaves");
    expect(prompt).toContain("underwater environment");
    expect(prompt).toContain("Photorealistic underwater product photography");
    expect(prompt).toMatch(/suspended in the water at varied depths/i);
    expect(prompt).not.toContain("Three-point studio setup");
    expect(prompt).not.toContain("Helmut Newton");
    expect(prompt).not.toContain("subject centered slightly below the geometric center");
    expect(prompt).not.toContain("upper and peripheral frame space");
    expect(prompt).not.toContain("wide shot, container small in frame");
    expect(prompt).not.toContain("floating slightly above center frame");
    expect(prompt).not.toContain("Dramatic frozen water splash");
    expect(prompt).not.toContain("dripping water onto the surface below");
    expect(prompt).toContain(
      `COMPOSITION: ${underwaterValue}, portrait orientation 9:16, ingredients and flavor elements fill the frame space dynamically.`,
    );
    expect(prompt.split(underwaterValue)).toHaveLength(3);
  });
});

describe("product photography shot styles", () => {
  it("defines exactly 10 shots across primary and extended grids", () => {
    expect(PRODUCT_PHOTOGRAPHY_SHOT_STYLES).toHaveLength(5);
    expect(PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED).toHaveLength(5);
    expect(ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES).toHaveLength(10);
  });

  it("assigns one unique promptValue per shot label", () => {
    const promptValues = ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES.map((shot) => shot.promptValue);
    expect(new Set(promptValues).size).toBe(10);

    for (const shot of ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES) {
      expect(shot.promptValue).toBe(EXPECTED_SHOT_PROMPT_VALUES[shot.label]);
    }
  });

  it("uses each shot promptValue when assembling the template", () => {
    if (!productTemplate) throw new Error("product-photography template missing");

    for (const shot of ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES) {
      const prompt = assemblePromptFromTemplate(
        productTemplate,
        { drink: "Monster Energy drink" },
        {
          shotType: shot.promptValue,
          drinkName: "Monster Energy",
          shotId: shot.id,
        },
      );

      expect(prompt.split(shot.promptValue)).toHaveLength(3);
      expect(prompt).not.toContain("[TYPE DE SHOT]");
    }
  });
});

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

    expect(slots.drink).toBe("Monster Energy");
    expect(slots.flavorElements).toMatch(/lime/i);
  });

  it("skips flavor on first message when elements are not explicit", () => {
    const slots = extractBeverageSlotsFromFirstMessage("Monster Energy", productTemplate);

    expect(slots.drink).toBe("Monster Energy");
    expect(slots.flavorElements).toBeUndefined();
  });

  it("extracts drink only without flavor when using extractDrinkSlotsFromMessage", () => {
    const slots = extractDrinkSlotsFromMessage(
      "Monster Energy avec des citrons verts",
      productTemplate,
    );

    expect(slots.drink).toBe("Monster Energy");
    expect(slots.flavorElements).toBeUndefined();
    expect(slots.brandBackdrop).toMatch(/green radial glow/i);
  });

  it("still extracts flavor with full extractSlotsFromMessage", () => {
    const slots = extractSlotsFromMessage(
      "Monster Energy avec des citrons verts",
      productTemplate,
    );

    expect(slots.drink).toBe("Monster Energy");
    expect(slots.flavorElements).toMatch(/lime/i);
  });

  it("preserves the exact drink label from user input without canonical brand rewrite", () => {
    const slots = extractDrinkSlotsFromMessage("Coca-Cola Cherry", productTemplate);
    expect(slots.drink).toBe("Coca-Cola Cherry");
    expect(slots.brandBackdrop).toMatch(/Coca-Cola visual identity/i);
  });

  it("keeps variant names in assembled prompt SUBJECT line", () => {
    const drinkSlots = extractDrinkSlotsFromMessage("Coca-Cola Cherry", productTemplate);
    const prompt = assemblePromptFromTemplate(
      productTemplate,
      mergeTemplateSlots(drinkSlots, { packaging: "can", flavorElements: "Fresh cherries" }),
      {
        shotType: EXPECTED_SHOT_PROMPT_VALUES.Underwater,
        drinkName: drinkSlots.drink ?? "",
        shotId: "underwater",
      },
    );

    expect(prompt).toContain("SUBJECT: Iconic Coca-Cola Cherry in its original packaging format (can),");
    expect(prompt).not.toContain("Iconic Coca-Cola in its");
  });

  it("parses packaging choices", () => {
    expect(parsePackagingChoice("Canette")).toBe("can");
    expect(parsePackagingChoice("Bouteille")).toBe("bottle");
    expect(parsePackagingChoice("banane")).toBeNull();
  });

  it("detects unresolved packaging for guide flow", () => {
    expect(
      isPackagingResolved({ drink: "Coca-Cola Cherry", packaging: "can" }, productTemplate),
    ).toBe(true);
    expect(isPackagingResolved({ drink: "Coca-Cola Cherry" }, productTemplate)).toBe(false);
    expect(
      isPackagingResolved(
        extractDrinkSlotsFromMessage("Coca-Cola en canette", productTemplate),
        productTemplate,
      ),
    ).toBe(true);
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
    const drinkSlots = extractDrinkSlotsFromMessage("Monster Energy", productTemplate);
    const prompt = assemblePromptFromTemplate(
      productTemplate,
      drinkSlots,
      {
        shotType:
          "centered, slightly low camera angle (worm's eye view), container monumental and imposing",
        drinkName: "Monster Energy",
        shotId: "low-angle",
      },
    );

    expect(prompt).toMatch(/^Ultra-sharp studio product photography/i);
    expect(prompt).toContain(
      "SUBJECT: Iconic Monster Energy in its original packaging format (can, bottle, carton or other),",
    );
    expect(prompt).toContain("SURROUNDING ELEMENTS:");
    expect(prompt).toContain(
      "COMPOSITION: centered, slightly low camera angle (worm's eye view), container monumental and imposing, portrait orientation 9:16, ingredients and flavor elements fill the frame space dynamically.",
    );
    expect(prompt).toContain("Helmut Newton");
    expect(prompt).toContain("Deep black studio backdrop with a bright green radial glow");
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.drinkName);
    expect(prompt).not.toContain(PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.formatPackaging);
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

describe("lifestyle product photography", () => {
  const lifestyleTemplate = getPromptTemplateById("lifestyle-product-photography");

  const lifestyleSlots = {
    product: "HOLY Hydration Strawberry Kiwi",
    environment: "salle de sport moderne",
  };

  it("assembles body-continuity template for POV assis with exact shot type text", () => {
    if (!lifestyleTemplate) throw new Error("lifestyle-product-photography template missing");

    const prompt = assemblePromptFromTemplate(lifestyleTemplate, lifestyleSlots, {
      shotId: "pov-assis",
    });

    expect(prompt).toContain("BODY CONTINUITY:");
    expect(prompt).toContain("HOLY Hydration Strawberry Kiwi");
    expect(prompt).toContain("salle de sport moderne");
    expect(prompt).toContain(
      "First-person POV, product gripped from the top by one hand, fingers spread over the lid in a natural overhead grasp. Strong low-angle view looking down toward the seated body, legs and lower body visible in the lower portion of the frame.",
    );
    expect(prompt).not.toContain("[NOM DU PRODUIT]");
    expect(prompt).not.toContain("[TYPE DE SHOT]");
    expect(prompt).not.toContain("[LIEU]");
  });

  it("assembles body-continuity template for POV debout", () => {
    if (!lifestyleTemplate) throw new Error("lifestyle-product-photography template missing");

    const prompt = assemblePromptFromTemplate(lifestyleTemplate, lifestyleSlots, {
      shotId: "pov-debout",
    });

    expect(prompt).toContain("BODY CONTINUITY:");
    expect(prompt).toContain(
      "First-person POV, arm extended forward holding the product at shoulder height while walking, product slightly motion-blurred at the edges to suggest movement, ground or path visible in the lower portion of the frame beneath the extended arm.",
    );
  });

  it("assembles standalone template for produit seul without body continuity", () => {
    if (!lifestyleTemplate) throw new Error("lifestyle-product-photography template missing");

    const prompt = assemblePromptFromTemplate(lifestyleTemplate, lifestyleSlots, {
      shotId: "produit-seul",
    });

    expect(prompt).not.toContain("BODY CONTINUITY:");
    expect(prompt).toContain(
      "Product alone, no hands or person, resting on a natural surface within the environment, slightly elevated or placed at an interesting angle. Clean isolated product focus, 45-degree angle shot, shallow depth of field.",
    );
  });

  it("assembles standalone template for vue du dessus extended shot", () => {
    if (!lifestyleTemplate) throw new Error("lifestyle-product-photography template missing");

    const prompt = assemblePromptFromTemplate(lifestyleTemplate, lifestyleSlots, {
      shotId: "vue-dessus",
    });

    expect(prompt).not.toContain("BODY CONTINUITY:");
    expect(prompt).toContain(
      "Top-down bird's eye view, product placed flat on a surface within the environment, surrounded by complementary lifestyle objects related to the context, clean overhead composition.",
    );
  });

  it("copies product and environment verbatim without reformulation", () => {
    if (!lifestyleTemplate) throw new Error("lifestyle-product-photography template missing");

    const prompt = assemblePromptFromTemplate(
      lifestyleTemplate,
      {
        product: "  mon produit custom  ",
        environment: "  terrain de tennis ensoleillé  ",
      },
      { shotId: "main-gros-plan" },
    );

    expect(prompt).toContain("mon produit custom");
    expect(prompt).toContain("terrain de tennis ensoleillé");
    expect(prompt).not.toContain("  mon produit custom  ");
  });

  it("extractVerbatimSlot preserves user input as-is aside from trim", () => {
    expect(extractVerbatimSlot("  HOLY Hydration  ")).toBe("HOLY Hydration");
    expect(extractVerbatimSlot("le produit du client")).toBe("le produit du client");
  });

  it("isLifestyleGuideReady requires both product and environment", () => {
    if (!lifestyleTemplate) throw new Error("lifestyle-product-photography template missing");

    expect(isLifestyleGuideReady(lifestyleTemplate, { product: "HOLY", environment: "gym" })).toBe(
      true,
    );
    expect(isLifestyleGuideReady(lifestyleTemplate, { product: "HOLY" })).toBe(false);
    expect(isLifestyleGuideReady(lifestyleTemplate, { environment: "gym" })).toBe(false);
  });
});
