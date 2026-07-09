import { describe, expect, it } from "vitest";
import {
  enrichProfileForUsage,
  inferPackshotFlyingElements,
  inferPackshotUsageContext,
  PACKSHOT_AMBIANCE_PROFILES,
  resolvePackshotAmbianceProfile,
} from "./packshotDynamiqueConfig";

describe("inferPackshotUsageContext", () => {
  it("detects sport-actif before tech-bureau for a sports bottle", () => {
    expect(
      inferPackshotUsageContext("gourde isotherme inox, usage sport/randonnée"),
    ).toBe("sport-actif");
  });

  it("prioritises bebe-enfant over maison-cosy", () => {
    expect(inferPackshotUsageContext("biberon bébé pour nursery cosy")).toBe("bebe-enfant");
  });

  it("prioritises hygiene-bain over soin-beaute for shower gel", () => {
    expect(inferPackshotUsageContext("gel douche hydratant")).toBe("hygiene-bain");
  });

  it("returns null for vague product descriptions", () => {
    expect(inferPackshotUsageContext("produit")).toBeNull();
    expect(inferPackshotUsageContext("")).toBeNull();
  });
});

describe("enrichProfileForUsage", () => {
  it("enriches sport decor for tech-minimal without changing palette or style", () => {
    const base = resolvePackshotAmbianceProfile("environnement", "tech-minimal", null);
    const enriched = enrichProfileForUsage(
      base,
      "gourde isotherme inox, usage sport/randonnée",
      "tech-minimal",
    );

    expect(enriched.decorElements).toContain("randonnée");
    expect(enriched.decorElements).not.toContain("lavande");
    expect(enriched.surfaceType).toContain("banc");
    expect(enriched.paletteCouleurs).toBe(base.paletteCouleurs);
    expect(enriched.styleEditorial).toBe(base.styleEditorial);
    expect(enriched.temperatureCouleur).toBe(base.temperatureCouleur);
  });

  it("uses generic sport fallback for sport-actif + gourmand-frais instead of food props", () => {
    const base = resolvePackshotAmbianceProfile("environnement", "gourmand-frais", null);
    const enriched = enrichProfileForUsage(
      base,
      "gourde isotherme sport",
      "gourmand-frais",
    );

    expect(enriched.decorElements).toContain("sportif");
    expect(enriched.decorElements).not.toContain("fruits frais tranchés");
    expect(enriched.paletteCouleurs).toBe(base.paletteCouleurs);
    expect(enriched.styleEditorial).toBe("food styling commercial");
  });

  it("keeps custom ambiance text for autre while enriching decor props", () => {
    const base = resolvePackshotAmbianceProfile("environnement", "autre", "bohème désertique");
    const enriched = enrichProfileForUsage(base, "gourde isotherme sport", "autre");

    expect(enriched.fondAmbiance).toBe("bohème désertique");
    expect(enriched.ambianceLabel).toBe("bohème désertique");
    expect(enriched.decorElements).toContain("sportif");
    expect(enriched.decorElements).toContain("bohème désertique");
  });

  it("returns profile unchanged when usage cannot be inferred", () => {
    const base = PACKSHOT_AMBIANCE_PROFILES["artisanal-cosy"];
    const enriched = enrichProfileForUsage(base, "objet", "artisanal-cosy");

    expect(enriched).toEqual(base);
  });
});

describe("inferPackshotFlyingElements", () => {
  it("uses sport elements instead of lavender for a sports bottle in artisanal-cosy", () => {
    expect(
      inferPackshotFlyingElements("gourde isotherme sport", "sport-actif"),
    ).toBe("gouttelettes d'eau et particules légères");
  });

  it("falls back to product regex when usage is unknown", () => {
    expect(inferPackshotFlyingElements("boisson citron menthe", null)).toBe(
      "tranches d'agrumes et glaçons",
    );
  });
});
