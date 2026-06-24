import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getStripeSecretKeyForCheckout } from "../_shared/stripe-keys.ts";
import { subscriptionPeriodToIso } from "../_shared/subscription-period.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
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
        JSON.stringify({
          error:
            "Stripe n'est pas configuré. Vérifie STRIPE_MODE + STRIPE_SECRET_KEY_TEST / STRIPE_SECRET_KEY_LIVE (ou STRIPE_SECRET_KEY).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Récupérer l'utilisateur
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Récupérer l'abonnement actif de l'utilisateur
    const { data: subscriptionData, error: subError } = await supabaseClient
      .from("stripe_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (subError || !subscriptionData) {
      return new Response(
        JSON.stringify({ error: "Aucun abonnement actif trouvé" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Annuler l'abonnement dans Stripe (annulation à la fin de la période)
    const canceledSubscription = await stripe.subscriptions.update(
      subscriptionData.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    // Mettre à jour l'abonnement dans la base de données
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseAdminClient = serviceRoleKey
      ? createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          serviceRoleKey
        )
      : null;

    if (supabaseAdminClient) {
      await supabaseAdminClient
        .from("stripe_subscriptions")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionData.stripe_subscription_id);
    }

    console.log(`✅ Abonnement ${subscriptionData.stripe_subscription_id} sera annulé à la fin de la période`);

    const periodIso = subscriptionPeriodToIso(canceledSubscription);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Abonnement annulé. Il restera actif jusqu'à la fin de la période en cours.",
        cancel_at_period_end: canceledSubscription.cancel_at_period_end,
        current_period_end: periodIso?.current_period_end ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur annulation abonnement:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
