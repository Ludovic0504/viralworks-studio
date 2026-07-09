import { describe, expect, it } from "vitest";
import {
  isLifestyleFramingEligible,
  resolveLifestyleComposition,
  resolveLifestyleLensLine,
} from "./lifestyleFramingConfig";

describe("lifestyleFramingConfig", () => {
  it("marks only the five toggle-eligible shot ids", () => {
    expect(isLifestyleFramingEligible("pov-debout")).toBe(true);
    expect(isLifestyleFramingEligible("produit-seul")).toBe(true);
    expect(isLifestyleFramingEligible("pov-assis")).toBe(false);
    expect(isLifestyleFramingEligible("zoom-produit")).toBe(false);
  });

  it("uses 85mm f/2.0 for fixed shots", () => {
    expect(resolveLifestyleLensLine("pov-assis", null)).toBe("85mm lens f/2.0");
    expect(resolveLifestyleLensLine("main-gros-plan", "large")).toBe("85mm lens f/2.0");
  });

  it("uses 50mm f/4.0 for large POV shots", () => {
    expect(resolveLifestyleLensLine("pov-debout", "large")).toBe("50mm lens f/4.0");
    expect(resolveLifestyleLensLine("deux-mains", "large")).toBe("50mm lens f/4.0");
  });

  it("uses 35mm f/4.0 for large scene shots", () => {
    expect(resolveLifestyleLensLine("produit-seul", "large")).toBe("35mm lens f/4.0");
    expect(resolveLifestyleLensLine("vue-dessus", "large")).toBe("35mm lens f/4.0");
  });

  it("defaults eligible shots to serré composition and lens when framing is omitted", () => {
    expect(resolveLifestyleLensLine("produit-seul", null)).toBe("85mm lens f/2.0");
    expect(resolveLifestyleComposition("produit-seul", null, "standalone")).toContain("45–55%");
  });

  it("uses medium contextual composition for deux-mains large", () => {
    const composition = resolveLifestyleComposition("deux-mains", "large", "body-continuity");
    expect(composition).toContain("30–40%");
    expect(composition).toContain("medium contextual framing");
    expect(composition).not.toContain("15–20%");
  });
});
