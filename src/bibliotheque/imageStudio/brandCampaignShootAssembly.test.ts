import { describe, expect, it } from "vitest";
import {
  assembleBrandCampaignShootPrompt,
  assembleBrandCampaignShootPromptFromSlots,
  isBrandCampaignShootGuideReady,
  resolveBrandCampaignFormatRatio,
} from "./brandCampaignShootAssembly";
import {
  BRAND_CAMPAIGN_FACE_TO_FACE_GAZE,
  pickWeightedTier,
  resolveBrandCampaignManualPhysique,
} from "./brandCampaignShootConfig";
import { getPromptTemplateById } from "./promptTemplates";
import { assemblePromptFromTemplate } from "./promptTemplateEngine";

describe("brandCampaignShootAssembly", () => {
  const sampleSlots = {
    gender: "homme",
    ambianceId: "sportif-luxe",
    ambiancePrompt: "sporty-luxe",
    cameraAngleId: "face-a-face",
    cameraAngleBlock:
      "camera positioned directly at the subject's eye level, perfectly centered, natural perspective, minimal distortion",
    distanceBlock: "medium shot, waist-up framing, subject and immediate surroundings both visible",
    physique: "A 30-year-old athletic man with toned shoulders, defined cheekbones, and a confident steady gaze",
    action:
      "crouching on one knee, resting a forearm on top of a sports equipment planted in the ground, other hand resting near the ankle",
    gazeBlock: BRAND_CAMPAIGN_FACE_TO_FACE_GAZE,
    productOutfit: "navy Lacoste polo with yellow shoulder stripes and white sneakers",
    environment:
      "a golf course green in the foreground, calm turquoise ocean behind, dramatic mountain silhouette in the distance under a clear blue sky",
    outputFormat: "feed",
    aspectRatio: "4:5",
  };

  it("assembles the template with strict placeholder swaps", () => {
    const prompt = assembleBrandCampaignShootPromptFromSlots(sampleSlots);

    expect(prompt).toContain("Editorial sporty-luxe campaign photograph.");
    expect(prompt).toContain(sampleSlots.cameraAngleBlock);
    expect(prompt).toContain(sampleSlots.distanceBlock);
    expect(prompt).toContain(sampleSlots.physique);
    expect(prompt).toContain(sampleSlots.action);
    expect(prompt).toContain(BRAND_CAMPAIGN_FACE_TO_FACE_GAZE);
    expect(prompt).toContain(`Wearing ${sampleSlots.productOutfit}.`);
    expect(prompt).toContain(`Environment: ${sampleSlots.environment}.`);
    expect(prompt).toContain("4:5 aspect ratio.");
    expect(prompt).not.toContain("[");
  });

  it("uses 9:16 ratio for story format", () => {
    const prompt = assembleBrandCampaignShootPrompt({
      ambiancePrompt: "sporty-luxe",
      cameraAngleBlock: sampleSlots.cameraAngleBlock,
      distanceBlock: sampleSlots.distanceBlock,
      physique: sampleSlots.physique,
      action: sampleSlots.action,
      gazeBlock: sampleSlots.gazeBlock,
      product: sampleSlots.productOutfit,
      environment: sampleSlots.environment,
      ratio: resolveBrandCampaignFormatRatio("story"),
    });

    expect(prompt).toContain("9:16 aspect ratio.");
  });

  it("pickWeightedTier favors moderate tiers over time", () => {
    const tiers = [
      { weight: 35, value: "moderate-a" },
      { weight: 35, value: "moderate-b" },
      { weight: 20, value: "strong" },
      { weight: 10, value: "extreme" },
    ];

    let extremeCount = 0;
    for (let i = 0; i < 200; i += 1) {
      if (pickWeightedTier(tiers, () => 0.99) === "extreme") {
        extremeCount += 1;
      }
    }
    expect(extremeCount).toBeGreaterThan(0);
    expect(pickWeightedTier(tiers, () => 0)).toBe("moderate-a");
  });

  it("manual physique descriptions are unique per age/morphology/gender combo", () => {
    const homme30Athletic = resolveBrandCampaignManualPhysique("homme", 30, "athletique");
    const homme30Standard = resolveBrandCampaignManualPhysique("homme", 30, "standard");
    const femme30Athletic = resolveBrandCampaignManualPhysique("femme", 30, "athletique");

    expect(homme30Athletic).not.toBe(homme30Standard);
    expect(homme30Athletic).not.toBe(femme30Athletic);
    expect(homme30Athletic).toContain("30-year-old");
    expect(femme30Athletic).toContain("woman");
  });

  it("isBrandCampaignShootGuideReady requires all mandatory slots", () => {
    expect(isBrandCampaignShootGuideReady(sampleSlots)).toBe(true);
    expect(isBrandCampaignShootGuideReady({ ...sampleSlots, productOutfit: "x" })).toBe(false);
    expect(isBrandCampaignShootGuideReady({ ...sampleSlots, environment: "" })).toBe(false);
  });

  it("routes through assemblePromptFromTemplate for brand-campaign-shoot", () => {
    const template = getPromptTemplateById("brand-campaign-shoot");
    if (!template) throw new Error("brand-campaign-shoot template missing");

    const prompt = assemblePromptFromTemplate(template, sampleSlots);
    expect(prompt).toContain("Editorial sporty-luxe campaign photograph.");
  });
});
