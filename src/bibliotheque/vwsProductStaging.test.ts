import { describe, expect, it } from "vitest";
import { parseLegacyProductStyleDetails } from "./vwsProductStaging";

describe("parseLegacyProductStyleDetails", () => {
  it("sans préfixe : chipIds vide et freeText inchangé", () => {
    const raw = "Ambiance studio, lumière douce";
    const out = parseLegacyProductStyleDetails(raw);
    expect(out.chipIds).toEqual([]);
    expect(out.freeText).toBe(raw);
  });
});
