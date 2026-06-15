import { useState } from "react";
import { getAppOrigin } from "@/bibliotheque/appOrigin";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { capturePostHog, trackPostHogError } from "@/bibliotheque/posthog/client";

export const SUBSCRIPTION_PLANS = {
  image_9: { amount: 9, credits: 0, label: "ViralWorks Image" },
  pro_59: { amount: 59, credits: 0, label: "ViralWorks Pro" },
  premium_129: { amount: 129, credits: 30, label: "ViralWorks Studio" },
  /** Alias legacy */
  monthly: { amount: 129, credits: 30, label: "Mensuel" },
  yearly: { amount: 107 * 12, credits: 30, label: "Annuel" },
};

export const VIDEO_PACKS = [
  { videos: 3, amount: 14.99 },
  { videos: 10, amount: 49.99 },
  { videos: 30, amount: 149.99 },
];

export function useStripePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startPayment = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getBrowserSupabase();
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      const headers = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined;

      const { billedAmount: _billedForClientOnly, ...checkoutBody } = payload;
      try {
        localStorage.setItem("vw_stripe_checkout_at", String(Date.now()));
      } catch {
        // no-op
      }
      const { data, error: fnError } = await supabase.functions.invoke("stripe-payment", {
        body: { ...checkoutBody, origin: getAppOrigin() },
        ...(headers ? { headers } : {}),
      });
      if (fnError) throw new Error(fnError.message || "Erreur lors du paiement");
      if (!data?.url) throw new Error("URL de paiement manquante dans la réponse");

      try {
        const billedAmount =
          typeof payload.billedAmount === "number"
            ? payload.billedAmount
            : payload.amount;
        sessionStorage.setItem(
          "onetool_last_checkout",
          JSON.stringify({
            amount: billedAmount,
            ...(typeof payload.billedAmount === "number"
              ? {
                  billedAmount: payload.billedAmount,
                  catalogAmount: payload.amount,
                }
              : {}),
            credits: payload.credits,
            type: payload.type,
            ...(payload.subscriptionPlan
              ? { subscriptionPlan: payload.subscriptionPlan }
              : {}),
            currency: "EUR",
          }),
        );
      } catch {
        // no-op
      }

      const billedAmount =
        typeof payload.billedAmount === "number"
          ? payload.billedAmount
          : payload.amount;
      const planName =
        payload.subscriptionPlan === "image_9"
          ? "ViralWorks Image"
          : payload.subscriptionPlan === "pro_59"
            ? "ViralWorks Pro"
          : payload.subscriptionPlan === "premium_129" ||
              payload.subscriptionPlan === "monthly"
            ? "ViralWorks Studio"
            : payload.subscriptionPlan === "yearly"
              ? "Abonnement Annuel"
              : `${payload.credits} vidéos`;

      capturePostHog("checkout_started", {
        type: payload.type,
        price: billedAmount,
        credits: payload.credits,
        plan_name: planName,
      });

      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue";
      setError(message);
      capturePostHog("payment_failed", {
        error_type: "payment",
        error_message: message,
      });
      trackPostHogError(message, "/boutique", "payment");
      console.error("❌ Erreur Stripe:", err);
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, startPayment };
}

export const payImage9 = () => ({
  type: "subscription",
  subscriptionPlan: "image_9",
  amount: 9,
  credits: 0,
});

export const payPro59 = () => ({
  type: "subscription",
  subscriptionPlan: "pro_59",
  amount: 59,
  credits: 0,
});

export const payPremium129 = () => ({
  type: "subscription",
  subscriptionPlan: "premium_129",
  amount: 129,
  billedAmount: 64.5,
  credits: 30,
});

/** @deprecated Utiliser payPremium129 */
export const payMonthly = payPremium129;

/** Conservé pour compatibilité backend — masqué de l'UI */
export const payYearly = () => ({
  type: "subscription",
  subscriptionPlan: "yearly",
  amount: 107 * 12,
  billedAmount: 1230.5,
  credits: 30,
});

export const payVideoPack = (pack) => ({
  type: "credits",
  credits: pack.videos,
  amount: pack.amount,
});
