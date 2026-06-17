import { describe, expect, it } from "vitest";
import {
  getImageStudioQuotaState,
  getImageStudioWarningUsedThreshold,
  IMAGE_STUDIO_WARNING_REMAINING_PERCENT,
  shouldShowImageStudioLowQuotaWarning,
} from "./quotaAlerts";
import {
  IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT,
  IMAGE_STUDIO_MONTHLY_QUOTA_IMAGE_9,
} from "@/bibliotheque/supabase/planQuotas";

describe("getImageStudioQuotaState", () => {
  it("reste à 200 images au départ (offres Pro / Studio)", () => {
    const state = getImageStudioQuotaState(0, IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT);
    expect(state.remaining).toBe(200);
    expect(state.level).toBe("ok");
  });

  it(`passe en warning à ${IMAGE_STUDIO_WARNING_REMAINING_PERCENT} % restants sur 200 images`, () => {
    const state = getImageStudioQuotaState(160, IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT);
    expect(state.remaining).toBe(40);
    expect(state.remainingPercent).toBe(20);
    expect(state.level).toBe("warning");
  });

  it(`passe en warning à ${IMAGE_STUDIO_WARNING_REMAINING_PERCENT} % restants sur 150 images`, () => {
    const state = getImageStudioQuotaState(120, IMAGE_STUDIO_MONTHLY_QUOTA_IMAGE_9);
    expect(state.remaining).toBe(30);
    expect(state.remainingPercent).toBe(20);
    expect(state.level).toBe("warning");
  });

  it("passe en exhausted à la limite", () => {
    const state = getImageStudioQuotaState(200, IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT);
    expect(state.remaining).toBe(0);
    expect(state.level).toBe("exhausted");
  });
});

describe("getImageStudioWarningUsedThreshold", () => {
  it("calcule 160 images utilisées sur 200", () => {
    expect(getImageStudioWarningUsedThreshold(200)).toBe(160);
  });

  it("calcule 120 images utilisées sur 150", () => {
    expect(getImageStudioWarningUsedThreshold(150)).toBe(120);
  });
});

describe("shouldShowImageStudioLowQuotaWarning", () => {
  it("affiche l'alerte à 80 % du quota (40 restantes sur 200)", () => {
    expect(shouldShowImageStudioLowQuotaWarning(160, 200)).toBe(true);
    expect(getImageStudioQuotaState(160, 200).remaining).toBe(40);
  });

  it("affiche l'alerte à 80 % du quota (30 restantes sur 150)", () => {
    expect(shouldShowImageStudioLowQuotaWarning(120, 150)).toBe(true);
    expect(getImageStudioQuotaState(120, 150).remaining).toBe(30);
  });

  it("n'affiche pas l'alerte sous le seuil", () => {
    expect(shouldShowImageStudioLowQuotaWarning(159, 200)).toBe(false);
    expect(shouldShowImageStudioLowQuotaWarning(119, 150)).toBe(false);
  });

  it("n'affiche pas l'alerte quand le quota est épuisé", () => {
    expect(shouldShowImageStudioLowQuotaWarning(200, 200)).toBe(false);
    expect(shouldShowImageStudioLowQuotaWarning(150, 150)).toBe(false);
  });
});
