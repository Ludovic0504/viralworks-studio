import { describe, expect, it } from "vitest";
import {
  assembleOutfitStudioPrompt,
  assembleOutfitStudioPromptFromSlots,
  isOutfitStudioGuideReady,
} from "./outfitStudioAssembly";
import {
  inferOutfitPieceTypeFromFilename,
  parseFramingOverrideFromNotes,
  resolveOutfitStudioLighting,
  resolveOutfitStudioReferenceImageUrls,
} from "./outfitStudioConfig";
import { resolvePromptMentions } from "./promptMentions";

describe("outfitStudioAssembly", () => {
  const fixedRandom = () => 0;

  const studioInput = {
    genderId: "homme" as const,
    sceneTypeId: "studio-blanc" as const,
    subContextId: "gris-clair",
    framingId: "plein-pied" as const,
    ratioId: "4-5" as const,
    poseId: "debout-statique" as const,
    userNotes: "",
    imageCount: 1,
    imageFilenames: ["polo-blanc.jpg"],
    randomFn: fixedRandom,
  };

  it("assembles Template A with @Produit for uploaded garment", () => {
    const prompt = assembleOutfitStudioPrompt(studioInput);

    expect(prompt).toContain("Clean editorial fashion shot, minimal studio aesthetic.");
    expect(prompt).toContain("He is wearing @Produit");
    expect(prompt).toContain("tailored charcoal grey trousers");
    expect(prompt).toContain("polished black leather oxford shoes");
    expect(prompt).not.toContain("exact uploaded garment");
    expect(prompt).not.toContain("[");
  });

  it("assembles Template B for mirror selfie with @Produit", () => {
    const prompt = assembleOutfitStudioPrompt({
      ...studioInput,
      genderId: "femme",
      sceneTypeId: "mirror-selfie",
      subContextId: "chambre",
      ratioId: "9-16",
      imageFilenames: ["robe-ete.png"],
      poseId: "dynamique-legere",
    });

    expect(prompt).toContain("Authentic smartphone mirror selfie");
    expect(prompt).toContain("She is wearing @Produit");
    expect(prompt).toContain("minimal neutral styling to complement the dress");
    expect(prompt).toContain("black pointed-toe ankle boots");
    expect(prompt).not.toContain("[");
  });

  it("never mixes golden hour lighting with studio blanc environment", () => {
    const lighting = resolveOutfitStudioLighting("studio-blanc", "gris-clair", fixedRandom);
    const prompt = assembleOutfitStudioPrompt(studioInput);

    expect(lighting.sourceAndDirection).toContain("studio lighting");
    expect(lighting.sourceAndDirection).not.toContain("golden hour");
    expect(prompt).not.toContain("golden hour");
  });

  it("applies user notes override for framing", () => {
    const prompt = assembleOutfitStudioPrompt({
      ...studioInput,
      framingId: "plein-pied",
      userNotes: "focus sur la veste, plan buste",
    });

    expect(prompt).toContain("Medium close-up shot, framed from chest up");
    expect(prompt).not.toContain("Full body shot, head to toe clearly visible");
  });

  it("assembles from slots and validates readiness", () => {
    const slots = {
      genderId: "femme",
      sceneTypeId: "lifestyle-exterieur",
      subContextId: "plage",
      framingId: "mi-cuisse",
      ratioId: "1-1",
      poseId: "",
      clothingNotes: "",
      clothingImageCount: "1",
      clothingImageFilenames: "maillot.jpg",
      clothingImageUrl: "data:image/png;base64,abc",
    };

    expect(isOutfitStudioGuideReady(slots)).toBe(true);

    const prompt = assembleOutfitStudioPromptFromSlots(slots, fixedRandom);
    expect(prompt).toContain("@Produit");
    expect(prompt).toContain("coastal beach setting");
    expect(prompt).toContain("1:1 aspect ratio");
  });

  it("keeps text-only descriptive outfit without @Produit in top slot", () => {
    const prompt = assembleOutfitStudioPrompt({
      ...studioInput,
      userNotes: "veste en cuir marron vintage",
      imageCount: 0,
      imageFilenames: [],
    });

    expect(prompt).toContain("veste en cuir marron vintage");
    expect(prompt).not.toContain("@Produit");
  });

  it("maps multi-image outfit to @Produit and @Image1", () => {
    const prompt = assembleOutfitStudioPrompt({
      ...studioInput,
      sceneTypeId: "mirror-selfie",
      subContextId: "couloir",
      imageCount: 2,
      imageFilenames: ["veste.jpg", "jean.jpg"],
    });

    expect(prompt).toContain("@Produit");
    expect(prompt).toContain("@Image1");
  });

  it("failed scenario: vest mirror selfie attaches product reference and scope", () => {
    const prompt = assembleOutfitStudioPrompt({
      genderId: "homme",
      sceneTypeId: "mirror-selfie",
      subContextId: "couloir",
      framingId: "plein-pied",
      ratioId: "9-16",
      poseId: "marche-figee",
      userNotes: "le vêtement est la veste à mettre en avant",
      imageCount: 1,
      imageFilenames: ["veste.jpg"],
      randomFn: fixedRandom,
    });

    expect(prompt).toContain("@Produit");
    expect(prompt).toContain("relaxed straight-leg dark wash jeans");
    expect(prompt).not.toContain("slim-fit black tailored trousers");

    const resolved = resolvePromptMentions(prompt, {
      avatarUrl: null,
      productUrl: "data:image/png;base64,VEST",
      image1Url: null,
      productFocus: "le vêtement est la veste à mettre en avant",
    });

    expect(resolved.referenceImages).toEqual(["data:image/png;base64,VEST"]);
    expect(resolved.generationPrompt).toContain("@Produit scope:");
    expect(resolved.generationPrompt).toContain("la veste à mettre en avant");
    expect(resolved.generationPrompt).not.toContain("hero focus piece clearly emphasized");
  });

  it("resolves hero clothing image from focus notes", () => {
    const refs = resolveOutfitStudioReferenceImageUrls({
      imageUrls: ["data:image/png;base64,JEAN", "data:image/png;base64,VEST"],
      imageFilenames: ["jean.jpg", "veste.jpg"],
      userNotes: "la veste à mettre en avant",
      assembledPrompt: "He is wearing @Produit, @Image1",
    });

    expect(refs.productImageUrl).toBe("data:image/png;base64,VEST");
    expect(refs.importedRefImageUrl).toBe("data:image/png;base64,JEAN");
  });

  it("infers clothing piece type from filename", () => {
    expect(inferOutfitPieceTypeFromFilename("veste-cuir-noir.jpg")).toBe("haut");
    expect(inferOutfitPieceTypeFromFilename("pantalon-tailored.png")).toBe("bas");
    expect(inferOutfitPieceTypeFromFilename("robe-fluide.png")).toBe("robe");
  });

  it("parses framing override from free text notes", () => {
    expect(parseFramingOverrideFromNotes("je veux un plan buste")).toBe("buste");
    expect(parseFramingOverrideFromNotes("plein pied stp")).toBe("plein-pied");
  });

  it("rejects incomplete slots", () => {
    expect(isOutfitStudioGuideReady({ genderId: "homme" })).toBe(false);
    expect(
      isOutfitStudioGuideReady({
        genderId: "homme",
        sceneTypeId: "interieur-commercial",
        framingId: "buste",
        ratioId: "4-5",
        clothingImageUrl: "data:image/png;base64,abc",
      }),
    ).toBe(false);
  });
});
