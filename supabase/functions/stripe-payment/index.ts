import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getStripeCheckoutMode,
  getStripeSecretKeyForCheckout,
} from "../_shared/stripe-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function resolveBaseUrl(req: Request, requestedOrigin?: unknown): string {
  const fallbackUrl = Deno.env.get("SITE_URL") || "http://localhost:5173";

  const candidates = [
    typeof requestedOrigin === "string" ? requestedOrigin : "",
    req.headers.get("origin") || "",
    fallbackUrl,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.origin;
      }
    } catch {
      // Ignorer les URLs invalides et continuer sur le fallback suivant.
    }
  }

  return "http://localhost:5173";
}

function subscriptionProductName(planKey: string): string {
  if (planKey === "image_9") return "ViralWorks Image";
  if (planKey === "pro_59") return "ViralWorks Pro";
  if (planKey === "premium_129" || planKey === "monthly") return "ViralWorks Studio";
  if (planKey === "yearly") return "Abonnement Annuel";
  return "Abonnement";
}

function buildCheckoutLineItems(
  type: string,
  planKey: string,
  amount: number,
  credits: number,
  stripePriceImage9: string | null,
  stripePricePro59: string | null,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  if (type === "subscription" && planKey === "image_9" && stripePriceImage9) {
    return [{ price: stripePriceImage9, quantity: 1 }];
  }

  if (type === "subscription" && planKey === "pro_59" && stripePricePro59) {
    return [{ price: stripePricePro59, quantity: 1 }];
  }

  return [
    {
      price_data: {
        currency: "eur",
        product_data: {
          name:
            type === "subscription"
              ? subscriptionProductName(planKey)
              : `${credits} crédits`,
          description:
            type === "subscription"
              ? "Abonnement mensuel"
              : `Achat de ${credits} crédits`,
        },
        unit_amount: Math.round(amount * 100),
        ...(type === "subscription" && {
          recurring: {
            interval: planKey === "yearly" ? "year" : "month",
          },
        }),
      },
      quantity: 1,
    },
  ];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = getStripeSecretKeyForCheckout();
    const stripeMode = getStripeCheckoutMode();
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
            "Stripe n'est pas configuré. Pour le mode test : STRIPE_MODE=test et STRIPE_SECRET_KEY_TEST. Pour le live : STRIPE_MODE=live et STRIPE_SECRET_KEY_LIVE (ou STRIPE_SECRET_KEY).",
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

    // Créer un client avec service_role pour les insertions (bypass RLS)
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseAdminClient = serviceRoleKey
      ? createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          serviceRoleKey
        )
      : null;

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

    // Créer une session de checkout pour acheter des crédits ou s'abonner
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Corps de la requête invalide (JSON)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { amount, credits, type, origin, subscriptionPlan } = requestBody;

    const planKey =
      typeof subscriptionPlan === "string" ? subscriptionPlan.trim() : "";
    const giftEligibleSubscription =
      type === "subscription" &&
      (planKey === "premium_129" ||
        planKey === "monthly" ||
        planKey === "yearly");
    const welcomeGiftMeta = giftEligibleSubscription;
    if (giftEligibleSubscription) {
      const normalizedAmount = Number(amount);
      const knownPrice =
        normalizedAmount === 129 || normalizedAmount === 107 * 12;
      if (!knownPrice) {
        console.warn("🎁 Prix abonnement inattendu pour un cadeau éligible", {
          userId: user.id,
          subscriptionPlan: planKey,
          amount: normalizedAmount,
        });
      }
    }

    // Coupons launch (a definir dans les secrets Edge Functions, un seul coupon par session)
    // STRIPE_COUPON_LAUNCH_MONTHLY_TEST=<id coupon mensuel mode test>
    // STRIPE_COUPON_LAUNCH_YEARLY_TEST=<id coupon annuel mode test>
    // STRIPE_COUPON_LAUNCH_MONTHLY_LIVE=<id coupon mensuel mode live>
    // STRIPE_COUPON_LAUNCH_YEARLY_LIVE=<id coupon annuel mode live>
    let launchDiscountCoupon: string | null = null;
    if (type === "subscription") {
      const monthlyEnvName =
        stripeMode === "live"
          ? "STRIPE_COUPON_LAUNCH_MONTHLY_LIVE"
          : "STRIPE_COUPON_LAUNCH_MONTHLY_TEST";
      const yearlyEnvName =
        stripeMode === "live"
          ? "STRIPE_COUPON_LAUNCH_YEARLY_LIVE"
          : "STRIPE_COUPON_LAUNCH_YEARLY_TEST";
      const monthlyCoupon = Deno.env.get(monthlyEnvName)?.trim() ?? "";
      const yearlyCoupon = Deno.env.get(yearlyEnvName)?.trim() ?? "";
      if (planKey === "premium_129" || planKey === "monthly") {
        launchDiscountCoupon = monthlyCoupon;
      } else if (planKey === "yearly" && yearlyCoupon) {
        launchDiscountCoupon = yearlyCoupon;
      }
      if (launchDiscountCoupon) {
        console.log(`Launch discount applied: ${launchDiscountCoupon}`);
      } else {
        console.log("No launch discount (env not set)");
      }
    }

    const boutiqueShippingCountries = [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
      "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
      "SI", "ES", "SE", "CH", "GB", "US", "CA",
    ];

    console.log("🟦 stripe-payment appelée", {
      userId: user.id,
      email: user.email,
      amount,
      credits,
      type,
      subscriptionPlan: planKey,
      stripeMode,
      origin,
      hasStripeKey: Boolean(stripeSecretKey),
      stripeKeyPrefix: stripeSecretKey ? stripeSecretKey.slice(0, 8) : null,
    });

    const normalizedAmount = Number(amount);
    const normalizedCredits = Number(credits);

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0 ||
      !Number.isFinite(normalizedCredits) ||
      normalizedCredits < 0
    ) {
      return new Response(
        JSON.stringify({ error: "amount et credits requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (type === "subscription" && (planKey === "image_9" || planKey === "pro_59") && normalizedCredits !== 0) {
      return new Response(
        JSON.stringify({ error: `Le plan ${planKey} ne doit pas inclure de crédits vidéo` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripePriceImage9 = Deno.env.get("STRIPE_PRICE_IMAGE_9")?.trim() || null;
    const stripePricePro59 = Deno.env.get("STRIPE_PRICE_PRO_59")?.trim() || null;
    if (type === "subscription" && planKey === "image_9" && !stripePriceImage9) {
      console.warn(
        "STRIPE_PRICE_IMAGE_9 non configuré — repli sur price_data dynamique pour image_9",
      );
    }
    if (type === "subscription" && planKey === "pro_59" && !stripePricePro59) {
      console.warn(
        "STRIPE_PRICE_PRO_59 non configuré — repli sur price_data dynamique pour pro_59",
      );
    }

      // Créer ou récupérer le customer Stripe
      let customerId: string | null = null;
      
      // Vérifier si l'utilisateur a déjà un customer_id dans la base
      const { data: paymentData } = await supabaseClient
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .single();

      const clientToUse = supabaseAdminClient || supabaseClient;

      const createAndPersistCustomer = async () => {
        console.log("👤 Création d'un customer Stripe", { userId: user.id, email: user.email });
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: user.id,
          },
        });
        customerId = customer.id;
        console.log("✅ Customer Stripe créé", { customerId, userId: user.id });

        await clientToUse.from("stripe_customers").upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          email: user.email,
        });
      };

      if (paymentData?.stripe_customer_id) {
        customerId = paymentData.stripe_customer_id;
        console.log("👤 Customer Stripe en base trouvé", { customerId, userId: user.id });

        // Vérifier que le customer existe bien dans Stripe (utile si la clé Stripe a changé)
        try {
          await stripe.customers.retrieve(customerId);
          console.log("✅ Customer Stripe confirmé", { customerId, userId: user.id });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("⚠️ Customer Stripe invalide, recréation…", { customerId, userId: user.id, msg });
          await createAndPersistCustomer();
        }
      } else {
        await createAndPersistCustomer();
      }

      const baseUrl = resolveBaseUrl(req, origin);
      console.log("🌍 URL de retour Checkout résolue", { baseUrl, userId: user.id });

      // Créer la session de checkout
      console.log("🧾 Création session Checkout Stripe", {
        userId: user.id,
        customerId,
        amount,
        credits,
        type,
        baseUrl,
      });
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        ...(launchDiscountCoupon
          ? { discounts: [{ coupon: launchDiscountCoupon }] }
          : {}),
        line_items: buildCheckoutLineItems(
          type,
          planKey,
          normalizedAmount,
          normalizedCredits,
          stripePriceImage9,
          stripePricePro59,
        ),
        mode: type === "subscription" ? "subscription" : "payment",
        success_url: `${baseUrl}/?payment=success`,
        cancel_url: `${baseUrl}/?payment=cancelled`,
        ...(welcomeGiftMeta && {
          shipping_address_collection: {
            allowed_countries: boutiqueShippingCountries,
          },
          phone_number_collection: { enabled: true },
        }),
        metadata: {
          user_id: user.id,
          credits: normalizedCredits.toString(),
          type: type || "credits",
          subscription_plan: planKey,
          welcome_gift: welcomeGiftMeta ? "1" : "",
          welcome_gift_choice: "",
        },
      });
      console.log("✅ Session Checkout Stripe créée", {
        sessionId: session.id,
        url: session.url,
        userId: user.id,
      });

      // Enregistrer la tentative de paiement (même si elle n'est pas encore complétée)
      // Cela permet de tracer toutes les tentatives de paiement
      if (supabaseAdminClient) {
        try {
          const { error: paymentLogError } = await supabaseAdminClient
            .from("stripe_payments")
            .insert({
              user_id: user.id,
              stripe_session_id: session.id,
              stripe_customer_id: customerId,
              amount: amount,
              currency: "eur",
              status: "pending", // Statut initial : en attente
              metadata: {
                ...session.metadata,
                session_created_at: new Date().toISOString(),
                credits: normalizedCredits.toString(),
                type: type || "credits",
              },
            });
          
          if (paymentLogError) {
            console.warn("⚠️ Erreur enregistrement tentative paiement:", paymentLogError);
          } else {
            console.log(`📝 Tentative de paiement enregistrée (session: ${session.id}, user: ${user.id})`);
          }
        } catch (paymentLogError) {
          // Ne pas faire échouer la création de session si l'enregistrement échoue
          console.warn("⚠️ Erreur enregistrement tentative paiement:", paymentLogError);
        }
      } else {
        console.warn("⚠️ SERVICE_ROLE_KEY non configurée, impossible d'enregistrer la tentative de paiement");
      }

      return new Response(
        JSON.stringify({ 
          sessionId: session.id,
          url: session.url 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
  } catch (error) {
    console.error("Erreur Stripe:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Détails de l'erreur:", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
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
