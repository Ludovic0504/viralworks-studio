import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecretKeyForCheckout } from "../_shared/stripe-keys.ts";
import { ENTITLED_SUBSCRIPTION_STATUSES } from "../_shared/subscription-status.ts";
import { subscriptionPeriodToIso } from "../_shared/subscription-period.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = getStripeSecretKeyForCheckout();
    const stripe = stripeSecretKey
      ? new Stripe(stripeSecretKey, {
          apiVersion: "2024-11-20.acacia",
          httpClient: Stripe.createFetchHttpClient(),
        })
      : null;

    if (!stripe) {
      return new Response(
        JSON.stringify({ error: "Stripe non configuré" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptionData, error: subError } = await supabaseClient
      .from("stripe_subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .in("status", [...ENTITLED_SUBSCRIPTION_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !subscriptionData?.stripe_subscription_id) {
      return new Response(JSON.stringify({ synced: false, reason: "no_subscription" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscriptionData.stripe_subscription_id,
    );

    const periodIso = subscriptionPeriodToIso(stripeSubscription);
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseAdminClient = serviceRoleKey
      ? createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRoleKey)
      : null;

    if (supabaseAdminClient && periodIso) {
      await supabaseAdminClient
        .from("stripe_subscriptions")
        .update({
          status: stripeSubscription.status,
          current_period_start: periodIso.current_period_start,
          current_period_end: periodIso.current_period_end,
          cancel_at_period_end: stripeSubscription.cancel_at_period_end === true,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionData.stripe_subscription_id);
    }

    return new Response(
      JSON.stringify({
        synced: true,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end === true,
        current_period_end: periodIso?.current_period_end ?? null,
        status: stripeSubscription.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("sync-subscription-from-stripe:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
