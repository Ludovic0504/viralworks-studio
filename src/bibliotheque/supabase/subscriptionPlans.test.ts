import { describe, expect, it } from "vitest";
import {
  canUpgradeToSubscriptionPlan,
  getAlternativeSubscriptionPlans,
  inferSubscriptionPlanFromCycle,
  isSameSubscriptionPlan,
  subscriptionPlanRank,
} from "./subscriptionPlans";
import {
  hasAvatarPlan,
  hasFullVideoPlan,
  hasImageStudioPlan,
  normalizeSubscriptionPlan,
} from "./premiumAccess";
import {
  IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT,
  IMAGE_STUDIO_MONTHLY_QUOTA_IMAGE_9,
} from "./planQuotas";

describe("subscriptionPlans — upgrade / downgrade", () => {
  it("image_9 peut upgrader vers pro_59 et premium_129", () => {
    expect(canUpgradeToSubscriptionPlan("image_9", "pro_59")).toBe(true);
    expect(canUpgradeToSubscriptionPlan("image_9", "premium_129")).toBe(true);
    expect(canUpgradeToSubscriptionPlan("image_9", "image_9")).toBe(false);
  });

  it("pro_59 peut upgrader vers premium_129 mais pas downgrade via upgrade", () => {
    expect(canUpgradeToSubscriptionPlan("pro_59", "premium_129")).toBe(true);
    expect(canUpgradeToSubscriptionPlan("pro_59", "image_9")).toBe(false);
  });

  it("premium_129 ne peut plus upgrader", () => {
    expect(canUpgradeToSubscriptionPlan("premium_129", "pro_59")).toBe(false);
    expect(canUpgradeToSubscriptionPlan("premium_129", "image_9")).toBe(false);
  });

  it("free peut voir les 3 plans alternatifs", () => {
    const alts = getAlternativeSubscriptionPlans("free");
    expect(alts.map((p) => p.id)).toEqual(["image_9", "pro_59", "premium_129"]);
  });

  it("image_9 voit pro et studio comme alternatives", () => {
    const alts = getAlternativeSubscriptionPlans("image_9");
    expect(alts.map((p) => p.id)).toEqual(["pro_59", "premium_129"]);
  });

  it("pro_59 voit image et studio comme alternatives (downgrade + upgrade)", () => {
    const alts = getAlternativeSubscriptionPlans("pro_59");
    expect(alts.map((p) => p.id)).toEqual(["image_9", "premium_129"]);
  });

  it("rangs de plans cohérents", () => {
    expect(subscriptionPlanRank("image_9")).toBe(0);
    expect(subscriptionPlanRank("pro_59")).toBe(1);
    expect(subscriptionPlanRank("premium_129")).toBe(2);
    expect(subscriptionPlanRank("monthly")).toBe(2);
    expect(subscriptionPlanRank("free")).toBe(-1);
  });

  it("isSameSubscriptionPlan normalise monthly → premium_129", () => {
    expect(isSameSubscriptionPlan("monthly", "premium_129")).toBe(true);
    expect(isSameSubscriptionPlan("premium_129", "monthly")).toBe(true);
  });
});

describe("inferSubscriptionPlanFromCycle", () => {
  it("lit plan_key en priorité", () => {
    expect(inferSubscriptionPlanFromCycle({ plan_key: "pro_59", monthly_credit_amount: 30 })).toBe(
      "pro_59",
    );
  });

  it("déduit image_9 via 0 crédits vidéo", () => {
    expect(inferSubscriptionPlanFromCycle({ plan_key: null, monthly_credit_amount: 0 })).toBe(
      "image_9",
    );
  });

  it("déduit pro_59 via 10 crédits", () => {
    expect(inferSubscriptionPlanFromCycle({ monthly_credit_amount: 10 })).toBe("pro_59");
  });

  it("déduit premium_129 via 30 crédits", () => {
    expect(inferSubscriptionPlanFromCycle({ monthly_credit_amount: 30 })).toBe("premium_129");
  });
});

describe("premiumAccess — quotas par plan", () => {
  it("image_9 a Image Studio mais pas vidéo complète ni avatar", () => {
    const plan = normalizeSubscriptionPlan("image_9");
    expect(hasImageStudioPlan(plan)).toBe(true);
    expect(hasFullVideoPlan(plan)).toBe(false);
    expect(hasAvatarPlan(plan)).toBe(false);
    expect(IMAGE_STUDIO_MONTHLY_QUOTA_IMAGE_9).toBe(150);
  });

  it("pro_59 a image + vidéo + avatar", () => {
    const plan = normalizeSubscriptionPlan("pro_59");
    expect(hasImageStudioPlan(plan)).toBe(true);
    expect(hasFullVideoPlan(plan)).toBe(true);
    expect(hasAvatarPlan(plan)).toBe(true);
    expect(IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT).toBe(200);
  });

  it("premium_129 a les mêmes accès que pro pour vidéo/avatar", () => {
    const plan = normalizeSubscriptionPlan("premium_129");
    expect(hasFullVideoPlan(plan)).toBe(true);
    expect(hasAvatarPlan(plan)).toBe(true);
  });
});
