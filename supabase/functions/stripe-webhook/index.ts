import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tryScheduleWelcomeGift } from "../_shared/welcome-gift-flow.ts";
import {
  getAnyStripeApiKeyForVerifier,
  getStripeSecretKeyForEventLivemode,
  getStripeWebhookSigningSecrets,
} from "../_shared/stripe-keys.ts";
import { nextVideoDisplayCap } from "../_shared/video-display-cap.ts";

function makeStripe(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: "2024-11-20.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

function resolveRenewalCreditsFromInvoiceAmount(
  amountPaidCents: number,
  planKey?: string | null,
): number {
  const p = (planKey ?? "").trim();
  if (p === "image_9" || p === "pro_59") return 0;

  // Plans actuels:
  // - Mensuel 129€ -> 30 crédits
  // - Annuel 107*12€ -> 360 crédits
  if (amountPaidCents >= 100000) return 360;
  if (amountPaidCents >= 12000) return 30;
  return 30;
}

function resolveSubscriptionCreditsFromPlan(plan: string | null | undefined): number {
  const p = (plan ?? "").trim();
  if (p === "image_9" || p === "pro_59") return 0;
  if (p === "yearly") return 30;
  return 30;
}

function normalizeStoredPlanKey(plan: string | null | undefined): string {
  const p = (plan ?? "").trim();
  if (p === "image_9") return "image_9";
  if (p === "pro_59") return "pro_59";
  if (p === "yearly") return "yearly";
  if (p === "premium_129" || p === "monthly") return "premium_129";
  return "premium_129";
}

type SubscriptionNotificationPayload = {
  customerName: string;
  customerEmail: string;
  plan: "monthly" | "yearly";
  amountCents: number;
  paidAtIso: string;
  source: "checkout.session.completed" | "invoice.payment_succeeded";
};

function formatAmountEUR(amountCents: number): string {
  const amount = Number.isFinite(amountCents) ? amountCents / 100 : 0;
  return `${amount.toFixed(2)} EUR`;
}

async function sendSubscriptionNotificationEmail(
  payload: SubscriptionNotificationPayload,
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!resendApiKey) {
    console.warn("📧 Notification abonnement ignorée: RESEND_API_KEY manquante");
    return;
  }

  const to = Deno.env.get("SUBSCRIPTION_NOTIFICATION_TO")?.trim() || "jean.limonta06@gmail.com";
  const from = Deno.env.get("SUBSCRIPTION_NOTIFICATION_FROM")?.trim() || "onboarding@resend.dev";
  const paidAt = new Date(payload.paidAtIso);
  const paidAtLabel = Number.isNaN(paidAt.getTime()) ? payload.paidAtIso : paidAt.toISOString();
  const planLabel = payload.plan === "yearly" ? "Annuel" : "Mensuel";

  const text = [
    "Paiement d'abonnement confirme sur Stripe.",
    "",
    `Client: ${payload.customerName}`,
    `Email client: ${payload.customerEmail}`,
    `Plan: ${planLabel}`,
    `Montant: ${formatAmountEUR(payload.amountCents)}`,
    `Date paiement: ${paidAtLabel}`,
    `Evenement Stripe: ${payload.source}`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Abonnement Stripe confirme - ${payload.customerEmail}`,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Echec envoi email notification: ${response.status} ${body}`);
  }
}

serve(async (req) => {
  try {
    // Les webhooks Stripe n'envoient pas de header Authorization
    // On peut utiliser le paramètre apikey dans l'URL ou le header apikey
    // La vérification de signature Stripe est suffisante pour sécuriser le webhook
    
    const url = new URL(req.url);
    const apikeyFromUrl = url.searchParams.get("apikey");
    const apikeyFromHeader = req.headers.get("apikey");
    
    // Si apikey est fourni (via URL ou header), on l'utilise pour authentifier la requête Supabase
    // Sinon, on continue quand même car la signature Stripe est suffisante
    if (apikeyFromUrl || apikeyFromHeader) {
      console.log("✅ apikey fourni pour authentification Supabase");
    } else {
      console.log("⚠️ Pas de apikey fourni, mais la signature Stripe sera vérifiée");
    }
    
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.error("❌ Missing stripe-signature header");
      return new Response("Missing signature", { status: 400 });
    }

    const body = await req.text();

    const signingSecrets = getStripeWebhookSigningSecrets();
    if (signingSecrets.length === 0) {
      console.error("❌ Aucun STRIPE_WEBHOOK_SECRET_* configuré");
      return new Response("Webhook signing secrets manquants", { status: 500 });
    }

    const verifier = makeStripe(getAnyStripeApiKeyForVerifier());

    let event: Stripe.Event | undefined;
    let verifyError: Error | null = null;

    for (const whSecret of signingSecrets) {
      try {
        event = await verifier.webhooks.constructEventAsync(body, signature, whSecret);
        verifyError = null;
        break;
      } catch (e) {
        verifyError = e instanceof Error ? e : new Error(String(e));
      }
    }

    if (!event) {
      console.error("❌ Webhook signature verification failed:", verifyError);
      return new Response(
        `Webhook Error: ${verifyError?.message ?? "signature"}`,
        { status: 400 }
      );
    }

    console.log("✅ Signature Stripe vérifiée", { livemode: event.livemode });

    const apiKey = getStripeSecretKeyForEventLivemode(event.livemode);
    if (!apiKey) {
      console.error("❌ STRIPE_SECRET_KEY_* manquant pour livemode=", event.livemode);
      return new Response("Stripe API key manquante pour cet événement", { status: 500 });
    }
    const stripe = makeStripe(apiKey);

    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("⚠️ SERVICE_ROLE_KEY n'est pas configurée dans les secrets Supabase");
      return new Response(
        JSON.stringify({ error: "Configuration manquante: SERVICE_ROLE_KEY" }),
        { status: 500 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    // Gérer les événements Stripe
    if (event.type === "checkout.session.completed") {
      console.log("📦 Événement checkout.session.completed reçu");
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const credits = parseInt(session.metadata?.credits || "0", 10);
      const type = session.metadata?.type || "credits";

      console.log("📋 Métadonnées:", { userId, credits, type, sessionId: session.id });

      if (!userId) {
        console.error("❌ User ID manquant dans les métadonnées");
        return new Response("User ID manquant", { status: 400 });
      }

      const planKey = (session.metadata?.subscription_plan || "").trim();
      const isZeroCreditSubscription =
        type === "subscription" &&
        (planKey === "image_9" || planKey === "pro_59");

      if (credits <= 0 && !isZeroCreditSubscription) {
        console.error("❌ Nombre de crédits invalide:", credits);
        return new Response("Nombre de crédits invalide", { status: 400 });
      }

      // S'assurer que l'utilisateur a une entrée dans user_credits (devrait être créée par le trigger, mais sécurité)
      // Vérifier d'abord si l'entrée existe, sinon la créer
      const { data: existingCredits, error: checkError } = await supabaseClient
        .from("user_credits")
        .select("user_id")
        .eq("user_id", userId)
        .single();

      if (checkError && checkError.code === "PGRST116") {
        // L'entrée n'existe pas, la créer
        const { error: insertError } = await supabaseClient
          .from("user_credits")
          .insert({
            user_id: userId,
            credits: 0,
          });

        if (insertError) {
          console.warn("⚠️ Erreur lors de la création user_credits:", insertError);
        }
      } else if (checkError) {
        console.warn("⚠️ Erreur lors de la vérification user_credits:", checkError);
      }
      // Si existingCredits existe, on ne fait rien (l'entrée existe déjà)

      if (type === "subscription") {
        // Gérer l'abonnement
        const subscriptionId = session.subscription as string;
        
        // Récupérer les détails de l'abonnement
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        // Créer ou mettre à jour l'abonnement dans la base
        await supabaseClient
          .from("stripe_subscriptions")
          .upsert({
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: subscription.customer as string,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          });

        const monthlyCredits = resolveSubscriptionCreditsFromPlan(planKey);
        const storedPlanKey = normalizeStoredPlanKey(planKey);

        if (monthlyCredits > 0) {
          const { data: creditsData } = await supabaseClient
            .from("user_credits")
            .select("credits, video_display_cap")
            .eq("user_id", userId)
            .single();

          const currentCredits = creditsData?.credits || 0;
          const newCredits = currentCredits + monthlyCredits;
          const nextCap = nextVideoDisplayCap({
            balanceBefore: currentCredits,
            oldCap: creditsData?.video_display_cap,
            purchaseQty: monthlyCredits,
            balanceAfter: newCredits,
          });

          if (creditsData) {
            await supabaseClient
              .from("user_credits")
              .update({ credits: newCredits, video_display_cap: nextCap })
              .eq("user_id", userId);
          } else {
            await supabaseClient
              .from("user_credits")
              .insert({
                user_id: userId,
                credits: newCredits,
                video_display_cap: nextCap,
              });
          }

          const { error: transactionError } = await supabaseClient
            .from("credit_transactions")
            .insert({
              user_id: userId,
              amount: monthlyCredits,
              type: "credit",
              reason: "subscription_payment",
              metadata: {
                subscription_id: subscriptionId,
                payment_intent: session.payment_intent,
              },
            });

          if (transactionError) {
            console.error("❌ Erreur création transaction abonnement:", transactionError);
          } else {
            console.log("✅ Transaction abonnement créée");
          }

          console.log(
            `✅ Abonnement créé et ${monthlyCredits} crédits ajoutés pour l'utilisateur ${userId}`,
          );
        } else {
          console.log(
            `✅ Abonnement ${storedPlanKey} créé pour l'utilisateur ${userId} (sans crédits vidéo)`,
          );
        }

        const cyclePayload = {
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          plan_key: storedPlanKey,
          monthly_credit_amount:
            storedPlanKey === "image_9" || storedPlanKey === "pro_59" ? 0 : 30,
          granted_months: storedPlanKey === "yearly" ? 1 : 0,
          updated_at: new Date().toISOString(),
        };

        const { error: cycleError } = await supabaseClient
          .from("subscription_credit_cycles")
          .upsert(cyclePayload, { onConflict: "stripe_subscription_id" });

        if (cycleError) {
          console.error("⚠️ Impossible de mettre à jour subscription_credit_cycles:", cycleError);
        }

        try {
          await tryScheduleWelcomeGift(supabaseClient, session, userId);
        } catch (giftErr) {
          console.error("🎁 Cadeau bienvenue: exception non gérée", giftErr);
        }

        try {
          const plan = planKey === "yearly" ? "yearly" : "monthly";
          await sendSubscriptionNotificationEmail({
            customerName: session.customer_details?.name || "Nom inconnu",
            customerEmail:
              session.customer_details?.email ||
              session.customer_email ||
              "email-inconnu@unknown.local",
            plan,
            amountCents: session.amount_total || 0,
            paidAtIso: new Date().toISOString(),
            source: "checkout.session.completed",
          });
          console.log("📧 Notification abonnement envoyée (checkout.session.completed)");
        } catch (mailErr) {
          console.error("📧 Erreur envoi notification abonnement (checkout):", mailErr);
        }
      } else {
        // Achat de crédits ponctuel
        // Récupérer les crédits actuels (ou créer l'entrée si elle n'existe pas)
        const { data: creditsData, error: creditsError } = await supabaseClient
          .from("user_credits")
          .select("credits, video_display_cap")
          .eq("user_id", userId)
          .single();

        let currentCredits = 0;
        if (creditsError && creditsError.code === "PGRST116") {
          // L'utilisateur n'a pas encore de crédits, on va créer l'entrée
          currentCredits = 0;
        } else if (creditsData) {
          currentCredits = creditsData.credits || 0;
        }

        const newCredits = currentCredits + credits;
        const nextCapPack = nextVideoDisplayCap({
          balanceBefore: currentCredits,
          oldCap: creditsData?.video_display_cap,
          purchaseQty: credits,
          balanceAfter: newCredits,
        });

        // Mettre à jour ou créer les crédits
        // Utiliser UPDATE puis INSERT si nécessaire pour éviter les erreurs de contrainte unique
        let updateError = null;
        if (creditsData) {
          // L'entrée existe, faire un UPDATE
          const { error } = await supabaseClient
            .from("user_credits")
            .update({ credits: newCredits, video_display_cap: nextCapPack })
            .eq("user_id", userId);
          updateError = error;
        } else {
          // L'entrée n'existe pas, faire un INSERT
          const { error } = await supabaseClient
            .from("user_credits")
            .insert({
              user_id: userId,
              credits: newCredits,
              video_display_cap: nextCapPack,
            });
          updateError = error;
        }

        if (updateError) {
          console.error("Erreur lors de la mise à jour des crédits:", updateError);
          throw updateError;
        }

        console.log(`✅ Crédits ajoutés: ${credits} (Total: ${newCredits}) pour l'utilisateur ${userId}`);

        // Créer la transaction
        const { error: transactionError } = await supabaseClient
          .from("credit_transactions")
          .insert({
            user_id: userId,
            amount: credits,
            type: "purchase",
            reason: "stripe_payment",
            metadata: {
              session_id: session.id,
              payment_intent: session.payment_intent,
            },
          });

        if (transactionError) {
          console.error("❌ Erreur création transaction:", transactionError);
        } else {
          console.log("✅ Transaction créée pour l'achat de crédits");
        }
      }

      // Mettre à jour le paiement (qui a été créé avec status "pending" lors de la création de session)
      // Utiliser UPDATE pour mettre à jour le statut existant
      const { error: paymentError } = await supabaseClient
        .from("stripe_payments")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
          metadata: {
            ...session.metadata,
            payment_completed_at: new Date().toISOString(),
            payment_intent: session.payment_intent,
          },
        })
        .eq("stripe_session_id", session.id);

      if (paymentError) {
        console.error("❌ Erreur mise à jour paiement:", paymentError);
        // Si le paiement n'existe pas, le créer
        const { error: insertError } = await supabaseClient
          .from("stripe_payments")
          .insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_customer_id: session.customer as string,
            amount: session.amount_total ? session.amount_total / 100 : 0,
            currency: session.currency || "eur",
            status: "completed",
            metadata: {
              ...session.metadata,
              payment_completed_at: new Date().toISOString(),
              payment_intent: session.payment_intent,
            },
          });
        
        if (insertError) {
          console.error("❌ Erreur création paiement:", insertError);
        } else {
          console.log("✅ Paiement créé dans stripe_payments (status: completed)");
        }
      } else {
        console.log("✅ Paiement mis à jour dans stripe_payments (status: completed)");
      }

      console.log("✅ Traitement checkout.session.completed terminé avec succès");
    }

    // Gérer le renouvellement d'abonnement
    if (event.type === "invoice.payment_succeeded") {
      console.log("📦 Événement invoice.payment_succeeded reçu");
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log("📋 Facture:", { subscriptionId, invoiceId: invoice.id, amount: invoice.amount_paid });

      if (!subscriptionId) {
        console.warn("⚠️ Pas de subscription_id dans la facture, ignoré");
        return new Response(JSON.stringify({ received: true, skipped: "no_subscription" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Récupérer l'abonnement depuis la base
      const { data: subscriptionData, error: subError } = await supabaseClient
        .from("stripe_subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      if (subError || !subscriptionData) {
        console.error("❌ Abonnement non trouvé dans la base:", subError);
        return new Response(JSON.stringify({ received: true, error: "subscription_not_found" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const userId = subscriptionData.user_id;
      const { data: cycleData } = await supabaseClient
        .from("subscription_credit_cycles")
        .select("plan_key, monthly_credit_amount")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();

      const isYearlyPlan = cycleData?.plan_key === "yearly";
      const monthlyCredits = isYearlyPlan
        ? Number(cycleData?.monthly_credit_amount || 30)
        : resolveRenewalCreditsFromInvoiceAmount(
            invoice.amount_paid || 0,
            cycleData?.plan_key,
          );

      console.log(`💰 Ajout de ${monthlyCredits} crédits pour le renouvellement (user: ${userId})`, {
        isYearlyPlan,
      });

      // Récupérer les crédits actuels (ou créer l'entrée si elle n'existe pas)
      const { data: creditsData, error: creditsError } = await supabaseClient
        .from("user_credits")
        .select("credits, video_display_cap")
        .eq("user_id", userId)
        .single();

      let currentCredits = 0;
      if (creditsError && creditsError.code === "PGRST116") {
        currentCredits = 0;
      } else if (creditsData) {
        currentCredits = creditsData.credits || 0;
      }

      const newCredits = currentCredits + monthlyCredits;
      const nextCapRenewal = nextVideoDisplayCap({
        balanceBefore: currentCredits,
        oldCap: creditsData?.video_display_cap,
        purchaseQty: monthlyCredits,
        balanceAfter: newCredits,
      });

      // Mettre à jour ou créer les crédits
      // Utiliser UPDATE puis INSERT si nécessaire pour éviter les erreurs de contrainte unique
      let updateError = null;
      if (creditsData) {
        // L'entrée existe, faire un UPDATE
        const { error } = await supabaseClient
          .from("user_credits")
          .update({ credits: newCredits, video_display_cap: nextCapRenewal })
          .eq("user_id", userId);
        updateError = error;
      } else {
        // L'entrée n'existe pas, faire un INSERT
        const { error } = await supabaseClient
          .from("user_credits")
          .insert({
            user_id: userId,
            credits: newCredits,
            video_display_cap: nextCapRenewal,
          });
        updateError = error;
      }

      if (updateError) {
        console.error("❌ Erreur mise à jour crédits renouvellement:", updateError);
        throw updateError;
      }

      console.log(`✅ Crédits renouvellement ajoutés: ${monthlyCredits} (Total: ${newCredits})`);

      // Créer la transaction
      const { error: transactionError } = await supabaseClient
        .from("credit_transactions")
        .insert({
          user_id: userId,
          amount: monthlyCredits,
          type: "credit",
          reason: "subscription_renewal",
          metadata: {
            subscription_id: subscriptionId,
            invoice_id: invoice.id,
            invoice_amount: invoice.amount_paid,
          },
        });

      if (transactionError) {
        console.error("❌ Erreur création transaction renouvellement:", transactionError);
      } else {
        console.log("✅ Transaction de renouvellement créée");
      }

      if (isYearlyPlan) {
        const { error: cycleResetError } = await supabaseClient
          .from("subscription_credit_cycles")
          .update({
            granted_months: 1,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (cycleResetError) {
          console.error("⚠️ Impossible de réinitialiser granted_months pour annuel:", cycleResetError);
        }
      }

      // Mettre à jour la date de fin de période de l'abonnement
      if (invoice.period_end) {
        await supabaseClient
          .from("stripe_subscriptions")
          .update({
            current_period_end: new Date(invoice.period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
      }

      try {
        const plan = cycleData?.plan_key === "yearly" ? "yearly" : "monthly";
        await sendSubscriptionNotificationEmail({
          customerName: invoice.customer_name || "Nom inconnu",
          customerEmail: invoice.customer_email || "email-inconnu@unknown.local",
          plan,
          amountCents: invoice.amount_paid || 0,
          paidAtIso: new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000).toISOString(),
          source: "invoice.payment_succeeded",
        });
        console.log("📧 Notification abonnement envoyée (invoice.payment_succeeded)");
      } catch (mailErr) {
        console.error("📧 Erreur envoi notification abonnement (renewal):", mailErr);
      }
    }

    // Gérer l'annulation d'abonnement
    if (event.type === "customer.subscription.deleted") {
      console.log("📦 Événement customer.subscription.deleted reçu");
      const subscription = event.data.object as Stripe.Subscription;
      
      const { error: updateError } = await supabaseClient
        .from("stripe_subscriptions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);

      if (updateError) {
        console.error("❌ Erreur mise à jour abonnement annulé:", updateError);
      } else {
        console.log("✅ Abonnement marqué comme annulé");
      }
    }

    // Gérer les paiements échoués
    if (event.type === "checkout.session.async_payment_failed" || event.type === "payment_intent.payment_failed") {
      console.log("📦 Événement paiement échoué reçu:", event.type);
      let sessionId: string | null = null;
      let userId: string | null = null;
      let amount = 0;

      if (event.type === "checkout.session.async_payment_failed") {
        const session = event.data.object as Stripe.Checkout.Session;
        sessionId = session.id;
        userId = session.metadata?.user_id || null;
        amount = session.amount_total ? session.amount_total / 100 : 0;
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // Récupérer la session depuis les métadonnées si disponible
        sessionId = paymentIntent.metadata?.session_id || null;
        userId = paymentIntent.metadata?.user_id || null;
        amount = paymentIntent.amount ? paymentIntent.amount / 100 : 0;
      }

      if (sessionId && userId) {
        // Mettre à jour le statut du paiement en "failed"
        const { error: updateError } = await supabaseClient
          .from("stripe_payments")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
            metadata: {
              failure_reason: event.type,
              failed_at: new Date().toISOString(),
            },
          })
          .eq("stripe_session_id", sessionId);

        if (updateError) {
          console.error("❌ Erreur mise à jour paiement échoué:", updateError);
        } else {
          console.log(`✅ Paiement échoué enregistré (session: ${sessionId}, user: ${userId})`);
        }
      } else {
        console.warn("⚠️ Impossible de traiter le paiement échoué: sessionId ou userId manquant");
      }
    }

    // Gérer les paiements annulés (quand l'utilisateur annule sur la page Stripe)
    if (event.type === "checkout.session.expired") {
      console.log("📦 Événement checkout.session.expired reçu");
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      const userId = session.metadata?.user_id || null;

      if (sessionId && userId) {
        const { error: updateError } = await supabaseClient
          .from("stripe_payments")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
            metadata: {
              cancelled_reason: "session_expired",
              cancelled_at: new Date().toISOString(),
            },
          })
          .eq("stripe_session_id", sessionId);

        if (updateError) {
          console.error("❌ Erreur mise à jour paiement annulé:", updateError);
        } else {
          console.log(`✅ Paiement annulé enregistré (session: ${sessionId})`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
