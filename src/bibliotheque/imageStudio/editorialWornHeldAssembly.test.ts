import { describe, expect, it } from "vitest";
import {
  assembleEditorialWornHeldPrompt,
  assembleEditorialWornHeldPromptFromSlots,
  isEditorialWornHeldGuideReady,
} from "./editorialWornHeldAssembly";

describe("editorialWornHeldAssembly", () => {
  const wristMacroSlots = {
    sceneTypeId: "bijou-porte",
    genderId: "femme",
    zoneId: "poignet-main",
    framingId: "macro",
    backgroundId: "neutre",
    ambianceId: null,
    customAmbiance: null,
    productDescription: "bracelet chaîne torsadée en argent poli",
    postureId: null,
    customGesture: null,
    formatId: "banniere-4-5",
  };

  it("assembles macro wrist jewelry scenario", () => {
    const prompt = assembleEditorialWornHeldPromptFromSlots(wristMacroSlots);

    expect(prompt).toContain("Photo éditoriale macro gros plan");
    expect(prompt).toContain("objectif 100mm à f/2.8");
    expect(prompt).toContain(wristMacroSlots.productDescription);
    expect(prompt).toContain("main remontant délicatement dans les cheveux");
    expect(prompt).toContain("grain de peau visible, non lissé");
    expect(prompt).toContain("Arrière-plan neutre uni");
    expect(prompt).toContain("10-15%");
    expect(prompt).toContain("ratio 4:5");
    expect(prompt).not.toContain("[");
  });

  it("applies three-lever full-body technique for cheville", () => {
    const prompt = assembleEditorialWornHeldPrompt({
      ...wristMacroSlots,
      zoneId: "cheville",
      framingId: "corps-entier",
      outfitDescription: "robe fluide blanche et sandales nude",
    });

    expect(prompt).toContain("mise au point différentielle");
    expect(prompt).toContain("Posture orientée de façon à rapprocher cheville et pied");
    expect(prompt).toContain("reflet ponctuel plus intense");
    expect(prompt).toContain("jambe croisée ramenant la cheville");
    expect(prompt).toContain("1-3%");
    expect(prompt).toContain("robe fluide blanche et sandales nude");
  });

  it("uses mi-corps subject block with default outfit hint", () => {
    const prompt = assembleEditorialWornHeldPrompt({
      ...wristMacroSlots,
      framingId: "mi-corps",
    });

    expect(prompt).toContain("cadrée à mi-corps");
    expect(prompt).toContain("tenue sobre et épurée");
    expect(prompt).toContain("4-7%");
    expect(prompt).not.toContain("mise au point différentielle");
  });

  it("uses held product wording for produit tenu", () => {
    const prompt = assembleEditorialWornHeldPrompt({
      ...wristMacroSlots,
      sceneTypeId: "produit-tenu",
      zoneId: "visage-levres",
      productDescription: "rouge à lèvres mat bordeaux",
    });

    expect(prompt).toContain("produit tenu à hauteur de bouche");
    expect(prompt).toContain("le produit");
    expect(prompt).not.toContain("le bijou");
  });

  it("requires outfit for corps entier and custom ambiance for autre", () => {
    expect(
      isEditorialWornHeldGuideReady({
        ...wristMacroSlots,
        framingId: "corps-entier",
        outfitDescription: "",
      }),
    ).toBe(false);

    expect(
      isEditorialWornHeldGuideReady({
        ...wristMacroSlots,
        framingId: "corps-entier",
        outfitDescription: "tailleur noir",
      }),
    ).toBe(true);

    expect(
      isEditorialWornHeldGuideReady({
        ...wristMacroSlots,
        backgroundId: "environnement",
        ambianceId: "autre",
        customAmbiance: "",
      }),
    ).toBe(false);

    expect(
      isEditorialWornHeldGuideReady({
        ...wristMacroSlots,
        backgroundId: "environnement",
        ambianceId: "autre",
        customAmbiance: "atelier joaillier",
      }),
    ).toBe(true);
  });
});
