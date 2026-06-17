import { getBrowserSupabase } from "./client-navigateur";
import type { UserPlan } from "./premiumAccess";
import { inferSubscriptionPlanFromCycle } from "./subscriptionPlans";

export type SubscriptionCycleSnapshot = {
  plan_key?: string | null;
  monthly_credit_amount?: number | null;
};

export async function fetchMySubscriptionCycle(): Promise<SubscriptionCycleSnapshot | null> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.rpc("get_my_subscription_cycle");

  if (error) {
    console.error("Erreur lecture cycle abonnement:", error);
    return null;
  }

  if (!data || typeof data !== "object") return null;
  return data as SubscriptionCycleSnapshot;
}

export async function resolveUserPlanFromSubscription(
  isSubscribed: boolean,
  isTester: boolean,
): Promise<UserPlan> {
  if (isTester) return "premium_129";
  if (!isSubscribed) return "free";

  const cycle = await fetchMySubscriptionCycle();
  const plan = inferSubscriptionPlanFromCycle(cycle);
  if (plan !== "free") return plan;

  if (cycle) {
    return "premium_129";
  }

  return "free";
}
