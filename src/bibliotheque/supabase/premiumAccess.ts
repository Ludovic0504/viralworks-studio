import { getUserProfile } from "./profil";
import { getUserSubscription } from "./stripe";
import { resolveUserPlanFromSubscription } from "./subscriptionCycle";

export type UserPlan = "free" | "image_9" | "pro_59" | "premium_129";

export function normalizeSubscriptionPlan(
  planKey: string | null | undefined,
): UserPlan {
  if (!planKey) return "free";
  if (planKey === "image_9") return "image_9";
  if (planKey === "pro_59") return "pro_59";
  if (
    planKey === "premium_129" ||
    planKey === "monthly" ||
    planKey === "yearly"
  ) {
    return "premium_129";
  }
  return "free";
}

export function hasImageStudioPlan(plan: UserPlan): boolean {
  return plan === "image_9" || plan === "pro_59" || plan === "premium_129";
}

export function hasSeedancePlan(plan: UserPlan): boolean {
  return false;
}

export function hasAvatarPlan(plan: UserPlan): boolean {
  return plan === "pro_59" || plan === "premium_129";
}

export function hasFullVideoPlan(plan: UserPlan): boolean {
  return plan === "pro_59" || plan === "premium_129";
}

export async function fetchPremiumAccess(): Promise<{
  isSubscribed: boolean;
  isTester: boolean;
  hasAccess: boolean;
  plan: UserPlan;
}> {
  const [sub, profile] = await Promise.all([
    getUserSubscription(),
    getUserProfile(),
  ]);

  const isSubscribed = Boolean(sub);
  const isTester = profile?.is_tester === true;
  const plan = await resolveUserPlanFromSubscription(isSubscribed, isTester);
  const hasAccess = isSubscribed || isTester;

  return { isSubscribed, isTester, hasAccess, plan };
}
