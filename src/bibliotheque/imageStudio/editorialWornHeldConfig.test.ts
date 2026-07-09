import { describe, expect, it } from "vitest";
import {
  getAvailableEditorialFramingOptions,
  isEditorialFramingAvailable,
} from "./editorialWornHeldConfig";

describe("editorialWornHeldConfig", () => {
  it("allows all framings for cou and cheville jewelry zones", () => {
    expect(isEditorialFramingAvailable("bijou-porte", "cou", "corps-entier")).toBe(true);
    expect(isEditorialFramingAvailable("bijou-porte", "cheville", "corps-entier")).toBe(true);
  });

  it("disables corps entier for doigt and oreille jewelry zones", () => {
    expect(isEditorialFramingAvailable("bijou-porte", "doigt", "corps-entier")).toBe(false);
    expect(isEditorialFramingAvailable("bijou-porte", "oreille", "corps-entier")).toBe(false);
    expect(isEditorialFramingAvailable("bijou-porte", "doigt", "macro")).toBe(true);
    expect(isEditorialFramingAvailable("bijou-porte", "oreille", "mi-corps")).toBe(true);
  });

  it("excludes corps entier from framing options for doigt and oreille", () => {
    const doigtOptions = getAvailableEditorialFramingOptions("bijou-porte", "doigt");
    const oreilleOptions = getAvailableEditorialFramingOptions("bijou-porte", "oreille");

    expect(doigtOptions.map((item) => item.id)).toEqual(["macro", "mi-corps"]);
    expect(oreilleOptions.map((item) => item.id)).toEqual(["macro", "mi-corps"]);
  });

  it("allows all framings for held product zones", () => {
    expect(isEditorialFramingAvailable("produit-tenu", "visage-levres", "corps-entier")).toBe(true);
    expect(isEditorialFramingAvailable("produit-tenu", "main", "corps-entier")).toBe(true);
  });
});
