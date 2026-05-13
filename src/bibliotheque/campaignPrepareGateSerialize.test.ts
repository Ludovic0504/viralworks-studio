import { describe, expect, it } from "vitest";
import { createDefaultCampaignGenerationSpec } from "./campaignGenerationSpec";
import { serializeCampaignSpecForPrepareGate } from "./campaignPrepareGateSerialize";

describe("serializeCampaignSpecForPrepareGate", () => {
  it("diffère lorsque seuls les staging_chips changent", () => {
    const base = createDefaultCampaignGenerationSpec();
    const specA = {
      ...base,
      campaign: {
        ...base.campaign,
        profession: "Produit X",
        core_idea: "Une idée stable",
        video_format_id: "produit_demo",
        location_type: "neutre" as const,
        style_details: "même texte",
        staging_chips: ["situation_reelle"],
      },
    };
    const specB = {
      ...base,
      campaign: {
        ...base.campaign,
        profession: "Produit X",
        core_idea: "Une idée stable",
        video_format_id: "produit_demo",
        location_type: "neutre" as const,
        style_details: "même texte",
        staging_chips: ["situation_reelle", "avant_apres"],
      },
    };

    const sigA = serializeCampaignSpecForPrepareGate(specA);
    const sigB = serializeCampaignSpecForPrepareGate(specB);

    expect(sigA).not.toBe(sigB);
    const parsedA = JSON.parse(sigA) as { stagingChips: string[] };
    const parsedB = JSON.parse(sigB) as { stagingChips: string[] };
    expect(parsedA.stagingChips).toEqual(["situation_reelle"]);
    expect(parsedB.stagingChips).toEqual(["situation_reelle", "avant_apres"]);
  });

  it("diffère lorsque le décor produit change", () => {
    const base = createDefaultCampaignGenerationSpec();
    const specA = {
      ...base,
      campaign: {
        ...base.campaign,
        profession: "Produit X",
        core_idea: "Une idée stable",
        video_format_id: "produit_demo",
        location_type: "neutre" as const,
        style_details: "même texte",
        staging_chips: ["facecam"],
        product_scene_decor_id: "studio" as string | null,
        product_opening_hook_id: null,
      },
    };
    const specB = {
      ...base,
      campaign: {
        ...base.campaign,
        profession: "Produit X",
        core_idea: "Une idée stable",
        video_format_id: "produit_demo",
        location_type: "neutre" as const,
        style_details: "même texte",
        staging_chips: ["facecam"],
        product_scene_decor_id: "nature" as string | null,
        product_opening_hook_id: null,
      },
    };
    expect(serializeCampaignSpecForPrepareGate(specA)).not.toBe(serializeCampaignSpecForPrepareGate(specB));
  });
});
