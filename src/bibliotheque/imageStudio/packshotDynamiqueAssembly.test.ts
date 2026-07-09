import { describe, expect, it } from "vitest";
import {
  assemblePackshotDynamiquePrompt,
  assemblePackshotDynamiquePromptFromSlots,
  isPackshotDynamiqueGuideReady,
} from "./packshotDynamiqueAssembly";
import { resolvePackshotFormatRatio } from "./packshotDynamiqueConfig";

describe("packshotDynamiqueAssembly", () => {
  const validatedCandleSlots = {
    productDescription:
      "bougie artisanale en verre ambré, cire végétale, étiquette kraft « Lavande Sauvage »",
    positionId: "debout-incline",
    backgroundId: "environnement",
    ambianceId: "artisanal-cosy",
    customAmbiance: null,
    interactionId: "fumee-vapeur",
    productStateId: "ouvert-entame",
    formatId: "story-9-16",
  };

  it("assembles the validated candle scenario (Template A)", () => {
    const prompt = assemblePackshotDynamiquePromptFromSlots(validatedCandleSlots);

    expect(prompt).toContain("Photo produit packshot");
    expect(prompt).toContain(validatedCandleSlots.productDescription);
    expect(prompt).toContain("légèrement incliné");
    expect(prompt).toContain("couvercle en bois retiré");
    expect(prompt).toContain("bois flotté texturé");
    expect(prompt).toContain("lavande séchée");
    expect(prompt).toContain("fumée blanche délicate");
    expect(prompt).toContain("ratio 9:16");
    expect(prompt).not.toContain("[");
  });

  it("uses Template B for levitation without surface contact", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      ...validatedCandleSlots,
      positionId: "levitation",
      interactionId: "aucun",
      productStateId: "ferme-neuf",
    });

    expect(prompt).toContain("en lévitation stylisée");
    expect(prompt).toContain("ombre portée douce et diffuse");
    expect(prompt).not.toContain("repose verticalement");
    expect(prompt).not.toContain("reflet flou du produit");
  });

  it("adds surreal note for levitation + matiere englobante", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      ...validatedCandleSlots,
      positionId: "levitation",
      interactionId: "matiere-englobante",
    });

    expect(prompt).toContain("Flottaison stylisée et surréaliste assumée");
    expect(prompt).toContain("partiellement enrobé");
  });

  it("uses neutral background when selected", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      productDescription: "flacon de sérum en verre",
      positionId: "debout-droit",
      backgroundId: "neutre",
      ambianceId: null,
      customAmbiance: null,
      interactionId: "aucun",
      productStateId: "ferme-neuf",
      formatId: "banniere-4-5",
    });

    expect(prompt).toContain("Arrière-plan neutre uni");
    expect(prompt).toContain("Flash studio / softbox");
    expect(prompt).toContain("ratio 4:5");
  });

  it("requires custom ambiance text when autre is selected", () => {
    expect(
      isPackshotDynamiqueGuideReady({
        productDescription: "produit test",
        positionId: "debout-droit",
        backgroundId: "environnement",
        ambianceId: "autre",
        customAmbiance: "",
      }),
    ).toBe(false);

    expect(
      isPackshotDynamiqueGuideReady({
        productDescription: "produit test",
        positionId: "debout-droit",
        backgroundId: "environnement",
        ambianceId: "autre",
        customAmbiance: "bohème désertique",
      }),
    ).toBe(true);
  });

  it("defaults format ratio to 4:5", () => {
    expect(resolvePackshotFormatRatio("banniere-4-5")).toBe("4:5");
    expect(resolvePackshotFormatRatio(null)).toBe("4:5");
  });

  it("uses usage-aware decor for sport bottle with tech-minimal ambiance", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      productDescription: "gourde isotherme inox, usage sport/randonnée",
      positionId: "debout-droit",
      backgroundId: "environnement",
      ambianceId: "tech-minimal",
      customAmbiance: null,
      interactionId: "aucun",
      productStateId: "ferme-neuf",
      formatId: "banniere-4-5",
    });

    expect(prompt).toContain("randonnée");
    expect(prompt).not.toContain("lavande");
    expect(prompt).toContain("Style éditorial tech premium");
    expect(prompt).toContain("gris anthracite");
  });

  it("uses generic sport decor for sport bottle with gourmand-frais ambiance", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      productDescription: "gourde isotherme sport",
      positionId: "debout-droit",
      backgroundId: "environnement",
      ambianceId: "gourmand-frais",
      customAmbiance: null,
      interactionId: "aucun",
      productStateId: "ferme-neuf",
      formatId: "banniere-4-5",
    });

    expect(prompt).toContain("sportif");
    expect(prompt).not.toContain("fruits frais tranchés");
  });

  it("uses usage-aware flying elements instead of lavender for sport bottle", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      productDescription: "gourde isotherme sport",
      positionId: "debout-droit",
      backgroundId: "environnement",
      ambianceId: "artisanal-cosy",
      customAmbiance: null,
      interactionId: "elements-volants",
      productStateId: "ferme-neuf",
      formatId: "banniere-4-5",
    });

    expect(prompt).toContain("gouttelettes d'eau");
    expect(prompt).not.toContain("lavande");
  });

  it("leaves neutral background unchanged when no usage inference applies", () => {
    const prompt = assemblePackshotDynamiquePrompt({
      productDescription: "flacon de sérum en verre",
      positionId: "debout-droit",
      backgroundId: "neutre",
      ambianceId: null,
      customAmbiance: null,
      interactionId: "aucun",
      productStateId: "ferme-neuf",
      formatId: "banniere-4-5",
    });

    expect(prompt).toContain("Arrière-plan neutre uni");
  });
});
