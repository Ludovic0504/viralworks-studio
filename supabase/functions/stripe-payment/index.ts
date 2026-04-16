import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
if (!stripeSecretKey) {
  console.error("⚠️ STRIPE_SECRET_KEY n'est pas configurée dans les secrets Supabase");
}

const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null;

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Vérifier que Stripe est configuré
    if (!stripe) {
      return new Response(
        JSON.stringify({ error: "Stripe n'est pas configuré. Vérifiez STRIPE_SECRET_KEY dans les secrets Supabase." }),
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

    const { amount, credits, type, origin } = requestBody;

    console.log("🟦 stripe-payment appelée", {
      userId: user.id,
      email: user.email,
      amount,
      credits,
      type,
      origin,
      hasStripeKey: Boolean(stripeSecretKey),
      stripeKeyPrefix: stripeSecretKey ? stripeSecretKey.slice(0, 8) : null,
    });

    if (!amount || !credits) {
      return new Response(
        JSON.stringify({ error: "amount et credits requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: type === "subscription" ? "Abonnement" : `${credits} crédits`,
                description: type === "subscription" 
                  ? "Abonnement mensuel" 
                  : `Achat de ${credits} crédits`,
              },
              unit_amount: Math.round(amount * 100), // Convertir en centimes
              ...(type === "subscription" && {
                recurring: {
                  interval: "month",
                },
              }),
            },
            quantity: 1,
          },
        ],
        mode: type === "subscription" ? "subscription" : "payment",
        success_url: `${baseUrl}/boutique?payment=success`,
        cancel_url: `${baseUrl}/boutique?payment=cancelled`,
        metadata: {
          user_id: user.id,
          credits: credits.toString(),
          type: type || "credits",
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
                credits: credits.toString(),
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
