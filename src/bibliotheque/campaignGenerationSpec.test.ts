import { describe, expect, it } from "vitest";
import { normalizeCampaignGenerationSpec } from "./campaignGenerationSpec";

describe("normalizeCampaignGenerationSpec — staging produit", () => {
  it("migration legacy : style_details encodé → texte libre + staging_chips", () => {
    const legacy =
      "__VWS_PRODUCT_STAGING__:" +
      JSON.stringify({ staging: ["situation_reelle", "avant_apres"] }) +
      "\n" +
      "warm light";

    const n = normalizeCampaignGenerationSpec({
      campaign: {
        style_details: legacy,
        profession: "Soap",
        core_idea: "Scène test",
        video_format_id: "produit_demo",
        location_type: "neutre",
      },
    });

    expect(n.campaign.style_details).toBe("warm light");
    expect(n.campaign.staging_chips).toEqual(["situation_reelle", "avant_apres"]);
  });

  it("nouveau brouillon : staging_chips explicite + style_details texte inchangés", () => {
    const style = "lumière naturelle, tons chauds";
    const chips = ["test_direct", "temoignage"];

    const n = normalizeCampaignGenerationSpec({
      campaign: {
        style_details: style,
        staging_chips: chips,
        profession: "Crème",
        core_idea: "Idée",
        location_type: "neutre",
      },
    });

    expect(n.campaign.style_details).toBe(style);
    expect(n.campaign.staging_chips).toEqual(chips);
  });

  it("trace.persistence.last_prepared_core_idea est conservé après normalisation", () => {
    const n = normalizeCampaignGenerationSpec({
      trace: {
        persistence: {
          last_prepared_core_idea: "  Idée précédente  ",
        },
      },
    });
    expect(n.trace.persistence.last_prepared_core_idea).toBe("Idée précédente");
  });
});
