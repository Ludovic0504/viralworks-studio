import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

/** Aligné sur getUserSubscription (client) + cancel-subscription / sync-subscription-credits */
async function userHasActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return false;

  if (data.cancel_at_period_end) {
    const periodEndMs = new Date(data.current_period_end).getTime();
    if (Number.isFinite(periodEndMs) && Date.now() >= periodEndMs) {
      return false;
    }
  }

  return true;
}

async function userIsTester(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_tester")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_tester === true;
}

export async function userHasPremiumAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const [isSub, isTester] = await Promise.all([
    userHasActiveSubscription(supabase, userId),
    userIsTester(supabase, userId),
  ]);
  return isSub || isTester;
}
