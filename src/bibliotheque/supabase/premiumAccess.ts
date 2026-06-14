import { getBrowserSupabase } from "./client-navigateur";
import { getUserProfile } from "./profil";
import { getUserSubscription } from "./stripe";

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
  return plan === "pro_59" || plan === "premium_129";
}

export function hasAvatarPlan(plan: UserPlan): boolean {
  return plan === "pro_59" || plan === "premium_129";
}

export function hasFullVideoPlan(plan: UserPlan): boolean {
  return plan === "premium_129";
}

export async function fetchPremiumAccess(): Promise<{
  isSubscribed: boolean;
  isTester: boolean;
  hasAccess: boolean;
  plan: UserPlan;
}> {
  const supabase = getBrowserSupabase();
  const [sub, profile] = await Promise.all([
    getUserSubscription(),
    getUserProfile(),
  ]);

  const isSubscribed = Boolean(sub);
  const isTester = profile?.is_tester === true;

  let planKey: string | null = null;
  if (sub?.stripe_subscription_id) {
    const { data } = await supabase
      .from("subscription_credit_cycles")
      .select("plan_key")
      .eq("stripe_subscription_id", sub.stripe_subscription_id)
      .maybeSingle();
    planKey = data?.plan_key ?? null;
  }

  let plan = normalizeSubscriptionPlan(planKey);
  if (isTester) {
    plan = "premium_129";
  } else if (isSubscribed && plan === "free") {
    // Abonnement actif sans plan_key connu → legacy premium complet
    plan = "premium_129";
  }

  const hasAccess = isSubscribed || isTester;

  return { isSubscribed, isTester, hasAccess, plan };
}
