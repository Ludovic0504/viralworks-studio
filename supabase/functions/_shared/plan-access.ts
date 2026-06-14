import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type UserPlan = "free" | "image_9" | "pro_59" | "premium_129";

export const SEEDANCE_MONTHLY_LIMIT = 15;
export const AVATAR_STUDIO_MONTHLY_LIMIT = 5;

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

export async function resolveUserPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPlan> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_tester")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.is_tester === true) return "premium_129";

  const { data: sub } = await supabase
    .from("stripe_subscriptions")
    .select(
      "stripe_subscription_id, status, cancel_at_period_end, current_period_end",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!sub) return "free";

  if (sub.cancel_at_period_end) {
    const periodEndMs = new Date(sub.current_period_end).getTime();
    if (Number.isFinite(periodEndMs) && Date.now() >= periodEndMs) {
      return "free";
    }
  }

  const { data: cycle } = await supabase
    .from("subscription_credit_cycles")
    .select("plan_key")
    .eq("stripe_subscription_id", sub.stripe_subscription_id)
    .maybeSingle();

  let plan = normalizeSubscriptionPlan(cycle?.plan_key ?? null);
  if (plan === "free") {
    plan = "premium_129";
  }
  return plan;
}

export function planAllowsSeedance(plan: UserPlan): boolean {
  return plan === "pro_59" || plan === "premium_129";
}

export function planAllowsAvatar(plan: UserPlan): boolean {
  return plan === "pro_59" || plan === "premium_129";
}
