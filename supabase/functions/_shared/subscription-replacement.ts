import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ENTITLED_SUBSCRIPTION_STATUSES } from "./subscription-status.ts";

export async function listOtherActiveSubscriptions(
  supabase: SupabaseClient,
  userId: string,
  exceptSubscriptionId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .in("status", [...ENTITLED_SUBSCRIPTION_STATUSES])
    .neq("stripe_subscription_id", exceptSubscriptionId);

  if (error) {
    console.error("listOtherActiveSubscriptions:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => row.stripe_subscription_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function listOtherActiveStripeSubscriptions(
  stripe: Stripe,
  stripeCustomerId: string,
  exceptSubscriptionId: string,
): Promise<string[]> {
  try {
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 20,
    });
    const entitled = subs.data.filter(
      (sub) =>
        sub.status === "active" || sub.status === "trialing",
    );
    return entitled
      .map((sub) => sub.id)
      .filter((id) => id !== exceptSubscriptionId);
  } catch (err) {
    console.error("listOtherActiveStripeSubscriptions:", err);
    return [];
  }
}

export async function cancelStripeSubscriptionsImmediately(
  stripe: Stripe,
  supabase: SupabaseClient,
  subscriptionIds: string[],
): Promise<void> {
  for (const subId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("no such subscription")) {
        console.error(`❌ Stripe cancel ${subId}:`, err);
      }
    }

    const { error: updateError } = await supabase
      .from("stripe_subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subId);

    if (updateError) {
      console.error(`❌ DB cancel ${subId}:`, updateError);
    } else {
      console.log(`✅ Ancien abonnement annulé: ${subId}`);
    }
  }
}

export async function resetImageStudioQuotaOnPlanChange(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("reset_image_studio_quota_on_plan_change", {
    p_user_id: userId,
  });

  if (error) {
    console.error("reset_image_studio_quota_on_plan_change:", error);
    return;
  }

  console.log(`✅ Quota Image Studio réinitialisé (changement de plan) pour ${userId}`);
}

export async function resetAvatarStudioQuotaOnPlanChange(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("reset_avatar_studio_quota_on_plan_change", {
    p_user_id: userId,
  });

  if (error) {
    console.error("reset_avatar_studio_quota_on_plan_change:", error);
    return;
  }

  console.log(`✅ Quota Avatar Studio réinitialisé (changement de plan) pour ${userId}`);
}

async function resetPlanQuotasOnChange(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await resetImageStudioQuotaOnPlanChange(supabase, userId);
  await resetAvatarStudioQuotaOnPlanChange(supabase, userId);
}

/**
 * Annule les autres abonnements Stripe actifs et réinitialise les quotas mensuels (images + avatars).
 * @returns true si au moins un abonnement précédent a été remplacé
 */
export async function replacePriorSubscriptions(
  stripe: Stripe,
  supabase: SupabaseClient,
  userId: string,
  newSubscriptionId: string,
  stripeCustomerId?: string | null,
): Promise<boolean> {
  const fromDb = await listOtherActiveSubscriptions(
    supabase,
    userId,
    newSubscriptionId,
  );

  const fromStripe = stripeCustomerId
    ? await listOtherActiveStripeSubscriptions(
        stripe,
        stripeCustomerId,
        newSubscriptionId,
      )
    : [];

  const priorIds = [...new Set([...fromDb, ...fromStripe])];

  if (priorIds.length === 0) {
    return false;
  }

  console.log(
    `🔄 Remplacement abonnement: annulation de ${priorIds.length} abo(s) précédent(s)`,
    { userId, newSubscriptionId, priorIds },
  );

  await cancelStripeSubscriptionsImmediately(stripe, supabase, priorIds);
  await resetPlanQuotasOnChange(supabase, userId);
  return true;
}
