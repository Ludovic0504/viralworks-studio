import { normalizeSubscriptionPlan, type UserPlan } from "./premiumAccess";

export const SUBSCRIPTION_PLAN_LABELS: Record<string, string> = {
  image_9: "ViralWorks Image",
  pro_59: "ViralWorks Pro",
  premium_129: "ViralWorks Studio",
  monthly: "ViralWorks Studio",
};

type SubscriptionCycleRow = {
  plan_key?: string | null;
  monthly_credit_amount?: number | null;
};

export function inferSubscriptionPlanFromCycle(
  cycle: SubscriptionCycleRow | null | undefined,
): UserPlan {
  if (!cycle) return "free";

  const fromKey = normalizeSubscriptionPlan(cycle.plan_key);
  if (fromKey !== "free") return fromKey;

  const credits = cycle.monthly_credit_amount;
  if (credits === 0) return "image_9";
  if (credits === 10) return "pro_59";
  if (credits === 30) return "premium_129";

  return "free";
}

export function subscriptionPlanLabel(planKey: string | null | undefined): string {
  if (!planKey) return "Abonnement";
  const normalized = normalizeSubscriptionPlan(planKey);
  return SUBSCRIPTION_PLAN_LABELS[normalized] ?? SUBSCRIPTION_PLAN_LABELS[planKey] ?? "Abonnement";
}

export function subscriptionPlanRank(planKey: string | null | undefined): number {
  const plan = normalizeSubscriptionPlan(planKey);
  if (plan === "image_9") return 0;
  if (plan === "pro_59") return 1;
  if (plan === "premium_129") return 2;
  return -1;
}

export function isSameSubscriptionPlan(
  currentPlanKey: string | null | undefined,
  targetPlanId: string,
): boolean {
  const current = normalizeSubscriptionPlan(currentPlanKey);
  const target = normalizeSubscriptionPlan(targetPlanId);
  return current !== "free" && current === target;
}

export function canUpgradeToSubscriptionPlan(
  currentPlanKey: string | null | undefined,
  targetPlanId: string,
): boolean {
  const currentRank = subscriptionPlanRank(currentPlanKey);
  const targetRank = subscriptionPlanRank(targetPlanId);
  return currentRank >= 0 && targetRank > currentRank;
}
