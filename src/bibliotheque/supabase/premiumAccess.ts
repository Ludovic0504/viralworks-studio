import { getUserProfile } from "./profil";
import { getUserSubscriptionDetails } from "./stripe";
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

export type PremiumAccessData = {
  isSubscribed: boolean;
  isTester: boolean;
  hasAccess: boolean;
  plan: UserPlan;
};

const FREE_ACCESS: PremiumAccessData = {
  isSubscribed: false,
  isTester: false,
  hasAccess: false,
  plan: "free",
};

let premiumCache: { userId: string; data: PremiumAccessData } | null = null;
let premiumInflight: { userId: string; promise: Promise<PremiumAccessData> } | null = null;

export function readCachedPremiumAccess(userId?: string | null): PremiumAccessData | null {
  if (!userId || premiumCache?.userId !== userId) return null;
  return premiumCache.data;
}

export function prefetchPremiumAccessData(userId: string | undefined | null): void {
  if (!userId) return;
  void resolvePremiumAccess(userId);
}

export function resolvePremiumAccess(userId: string): Promise<PremiumAccessData> {
  if (premiumCache?.userId === userId) {
    return Promise.resolve(premiumCache.data);
  }
  if (premiumInflight?.userId === userId) {
    return premiumInflight.promise;
  }

  const promise = fetchPremiumAccess(userId)
    .then((data) => {
      premiumCache = { userId, data };
      return data;
    })
    .catch(() => FREE_ACCESS)
    .finally(() => {
      if (premiumInflight?.userId === userId) premiumInflight = null;
    });

  premiumInflight = { userId, promise };
  return promise;
}

export async function fetchPremiumAccess(userId?: string | null): Promise<PremiumAccessData> {
  const [details, profile] = await Promise.all([
    getUserSubscriptionDetails({ userId }),
    getUserProfile(userId),
  ]);

  const isSubscribed = Boolean(details?.subscription);
  const isTester = profile?.is_tester === true;
  const planFromDetails = details?.planKey && details.planKey !== "free"
    ? normalizeSubscriptionPlan(details.planKey)
    : null;
  const plan = planFromDetails ?? await resolveUserPlanFromSubscription(isSubscribed, isTester);
  const hasAccess = isSubscribed || isTester;

  return { isSubscribed, isTester, hasAccess, plan };
}
