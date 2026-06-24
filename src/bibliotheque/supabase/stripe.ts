import { getBrowserSupabase } from "./client-navigateur";
import { resolveAuthenticatedUserId } from "./authSession";
import { getAppOrigin } from "@/bibliotheque/appOrigin";
import { track } from "@/bibliotheque/meta/pixel";
import { capturePostHog } from "@/bibliotheque/posthog/client";
import { type UserPlan } from "./premiumAccess";
import {
  fetchMySubscriptionCycle,
  type SubscriptionCycleSnapshot,
} from "./subscriptionCycle";
import {
  inferSubscriptionPlanFromCycle,
  subscriptionPlanLabel,
} from "./subscriptionPlans";

const SUBSCRIPTION_DETAILS_CACHE_TTL_MS = 45_000;

let subscriptionDetailsCache: {
  userId: string;
  data: UserSubscriptionDetails | null;
  fetchedAt: number;
} | null = null;

let subscriptionDetailsInflight: {
  userId: string;
  promise: Promise<UserSubscriptionDetails | null>;
} | null = null;

export { resolveAuthenticatedUserId } from "./authSession";

export function invalidateUserSubscriptionDetailsCache(): void {
  subscriptionDetailsCache = null;
}

export function readCachedUserSubscriptionDetails(
  userId?: string | null,
): UserSubscriptionDetails | null {
  if (!subscriptionDetailsCache || !userId) return null;
  if (subscriptionDetailsCache.userId !== userId) return null;
  if (Date.now() - subscriptionDetailsCache.fetchedAt >= SUBSCRIPTION_DETAILS_CACHE_TTL_MS) {
    return null;
  }
  return subscriptionDetailsCache.data;
}

export function hasCachedUserSubscriptionDetails(userId?: string | null): boolean {
  if (!subscriptionDetailsCache || !userId) return false;
  if (subscriptionDetailsCache.userId !== userId) return false;
  return Date.now() - subscriptionDetailsCache.fetchedAt < SUBSCRIPTION_DETAILS_CACHE_TTL_MS;
}

/** Lance le chargement en arrière-plan (ex. au clic « Boutique »). */
export function prefetchUserSubscriptionDetails(): void {
  void getUserSubscriptionDetails();
}

function normalizeActiveSubscription(
  data: StripeSubscription | null,
): StripeSubscription | null {
  if (!data) return null;
  if (data.cancel_at_period_end) {
    const periodEndMs = new Date(data.current_period_end).getTime();
    if (Number.isFinite(periodEndMs) && Date.now() >= periodEndMs) {
      return null;
    }
  }
  return data;
}

async function loadSubscriptionCycle(
  stripeSubscriptionId: string,
  prefetchedCycle?: SubscriptionCycleSnapshot | null,
): Promise<SubscriptionCycleSnapshot | null> {
  if (prefetchedCycle) return prefetchedCycle;

  const fromRpc = await fetchMySubscriptionCycle();
  if (fromRpc) return fromRpc;

  const supabase = getBrowserSupabase();
  const { data, error } = await supabase
    .from("subscription_credit_cycles")
    .select("plan_key, monthly_credit_amount")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (error) {
    console.error("Erreur lecture plan abonnement:", error);
  }

  return data;
}

export interface StripePayment {
  id: string;
  user_id: string;
  stripe_session_id: string;
  stripe_customer_id: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface StripeSubscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type UserSubscriptionDetails = {
  subscription: StripeSubscription;
  planKey: UserPlan;
  planName: string;
};

/** Identifiant de plan d'abonnement — utilisé par Stripe et le cadeau Gelato. */
export type SubscriptionPlanKey =
  | "image_9"
  | "pro_59"
  | "premium_129"
  | "monthly"
  | "yearly";

/**
 * Crée une session de checkout Stripe pour acheter des crédits
 */
export async function createCheckoutSession(
  amount: number,
  credits: number,
  type: "credits" | "subscription" = "credits",
  subscriptionPlan?: SubscriptionPlanKey
): Promise<{ sessionId: string; url: string | null } | { error: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { error: "Utilisateur non connecté" };
  }

  try {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      return { error: "Session expirée. Veuillez vous reconnecter." };
    }

    const { data, error } = await supabase.functions.invoke("stripe-payment", {
      body: {
        amount,
        credits,
        type,
        origin: getAppOrigin(),
        ...(type === "subscription" && subscriptionPlan
          ? { subscriptionPlan }
          : {}),
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      console.error("❌ Erreur création session Stripe:", error);
      console.error("📋 Détails complets de l'erreur:", JSON.stringify(error, null, 2));
      
      // Essayer de récupérer le message d'erreur depuis la réponse
      let errorMessage = error.message || "Erreur lors de la création de la session de paiement";
      
      // Si l'erreur contient des détails supplémentaires dans le contexte
      if (error.context) {
        console.error("🔍 Contexte de l'erreur:", error.context);

        // Cas habituel Supabase: context est une Response
        if (typeof Response !== "undefined" && error.context instanceof Response) {
          try {
            const responseClone = error.context.clone();
            const rawText = await responseClone.text();
            console.error("📨 Body brut de la fonction stripe-payment:", rawText);

            if (rawText) {
              try {
                const parsed = JSON.parse(rawText);
                if (parsed?.error) {
                  errorMessage = parsed.error;
                } else if (parsed?.message) {
                  errorMessage = parsed.message;
                } else {
                  errorMessage = rawText;
                }
              } catch {
                errorMessage = rawText;
              }
            }
          } catch (e) {
            console.warn("Impossible de lire la réponse d'erreur de la fonction:", e);
          }
        } else {
          // Compat fallback si le contexte expose directement body/message
          if (error.context.body) {
            try {
              const errorBody = typeof error.context.body === "string"
                ? JSON.parse(error.context.body)
                : error.context.body;
              if (errorBody?.error) {
                errorMessage = errorBody.error;
              }
            } catch (e) {
              console.warn("Impossible de parser le body de l'erreur:", e);
            }
          }

          if (error.context.message) {
            errorMessage = error.context.message;
          }
        }
      }
      
      // Ajouter le code de statut si disponible
      const statusCode =
        (typeof Response !== "undefined" && error.context instanceof Response
          ? error.context.status
          : error.status);
      if (statusCode) {
        errorMessage += ` (Code: ${statusCode})`;
      }
      
      return { error: errorMessage };
    }

    if (!data || !data.sessionId || !data.url) {
      console.error("Réponse invalide de la fonction Edge:", data);
      return { error: "Réponse invalide de la fonction de paiement" };
    }

    return {
      sessionId: data.sessionId,
      url: data.url,
    };
  } catch (err) {
    console.error("Erreur création session:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { error: `Erreur lors de la création de la session de paiement: ${errorMessage}` };
  }
}

/**
 * Redirige vers Stripe Checkout
 */
export async function redirectToCheckout(
  amount: number,
  credits: number,
  type: "credits" | "subscription" = "credits",
  subscriptionPlan?: SubscriptionPlanKey
): Promise<void> {
  const result = await createCheckoutSession(amount, credits, type, subscriptionPlan);

  if ("error" in result) {
    throw new Error(result.error);
  }

  if (!result.url) {
    throw new Error("URL de checkout non disponible");
  }

  try {
    sessionStorage.setItem(
      "onetool_last_checkout",
      JSON.stringify({ amount, credits, type, subscriptionPlan, currency: "EUR" })
    );
  } catch {
    // no-op
  }

  track("InitiateCheckout", { value: amount, currency: "EUR" });

  capturePostHog("checkout_started", {
    type,
    price: amount,
    credits,
    plan_name:
      subscriptionPlan === "image_9"
        ? "ViralWorks Image"
        : subscriptionPlan === "pro_59"
          ? "ViralWorks Pro"
        : subscriptionPlan === "premium_129" || subscriptionPlan === "monthly"
          ? "ViralWorks Studio"
          : subscriptionPlan === "yearly"
            ? "Abonnement Annuel"
            : `${credits} vidéos`,
  });

  // Rediriger vers Stripe Checkout
  window.location.href = result.url;
}

/**
 * Récupère les paiements de l'utilisateur
 */
export async function getUserPayments(
  limit: number = 50,
  userId?: string | null,
): Promise<StripePayment[]> {
  const supabase = getBrowserSupabase();

  const uid = await resolveAuthenticatedUserId(userId);
  if (!uid) {
    return [];
  }

  const { data, error } = await supabase
    .from("stripe_payments")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erreur récupération paiements:", error);
    return [];
  }

  return data || [];
}

/**
 * Récupère l'abonnement actif de l'utilisateur
 */
export async function getUserSubscription(userId?: string | null): Promise<StripeSubscription | null> {
  const details = await getUserSubscriptionDetails({ userId });
  return details?.subscription ?? null;
}

/**
 * Abonnement actif + clé de plan (subscription_credit_cycles).
 */
export async function getUserSubscriptionDetails(options?: {
  skipCache?: boolean;
  userId?: string | null;
}): Promise<UserSubscriptionDetails | null> {
  const userId = await resolveAuthenticatedUserId(options?.userId);
  if (!userId) return null;

  if (
    !options?.skipCache &&
    subscriptionDetailsCache?.userId === userId &&
    Date.now() - subscriptionDetailsCache.fetchedAt < SUBSCRIPTION_DETAILS_CACHE_TTL_MS
  ) {
    return subscriptionDetailsCache.data;
  }

  if (
    !options?.skipCache &&
    subscriptionDetailsInflight?.userId === userId
  ) {
    return subscriptionDetailsInflight.promise;
  }

  const supabase = getBrowserSupabase();

  const fetchDetails = async (): Promise<UserSubscriptionDetails | null> => {
    const [subResult, cycleFromRpc] = await Promise.all([
      supabase
        .from("stripe_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetchMySubscriptionCycle(),
    ]);

    if (subResult.error) {
      console.error("Erreur récupération abonnement:", subResult.error);
    }

    const subscription = normalizeActiveSubscription(subResult.data ?? null);
    if (!subscription) {
      subscriptionDetailsCache = {
        userId,
        data: null,
        fetchedAt: Date.now(),
      };
      return null;
    }

    const cycle = await loadSubscriptionCycle(
      subscription.stripe_subscription_id,
      cycleFromRpc,
    );
    const planKey = inferSubscriptionPlanFromCycle(cycle);
    const details: UserSubscriptionDetails = {
      subscription,
      planKey,
      planName: subscriptionPlanLabel(planKey !== "free" ? planKey : cycle?.plan_key),
    };

    subscriptionDetailsCache = {
      userId,
      data: details,
      fetchedAt: Date.now(),
    };

    return details;
  };

  const promise = fetchDetails().finally(() => {
    if (subscriptionDetailsInflight?.promise === promise) {
      subscriptionDetailsInflight = null;
    }
  });

  subscriptionDetailsInflight = { userId, promise };
  return promise;
}

/**
 * Annule l'abonnement de l'utilisateur
 */
export async function cancelSubscription(): Promise<{ success: boolean; error?: string; message?: string; cancel_at_period_end?: boolean; current_period_end?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { success: false, error: "Utilisateur non connecté" };
  }

  try {
    // Récupérer le token d'authentification
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;

    if (!accessToken) {
      return { success: false, error: "Session expirée. Veuillez vous reconnecter." };
    }

    const { data, error } = await supabase.functions.invoke("cancel-subscription", {
      body: {},
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      console.error("Erreur annulation abonnement:", error);
      // Parser l'erreur pour obtenir un message plus clair
      let errorMessage = "Erreur lors de l'annulation";
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error.context) {
        errorMessage = error.context.message || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      message: data?.message || "Abonnement annulé avec succès",
      cancel_at_period_end: data?.cancel_at_period_end,
      current_period_end: data?.current_period_end,
    };
  } catch (err) {
    console.error("Erreur annulation abonnement:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // Vérifier si c'est une erreur de connexion
    if (errorMessage.includes("Failed to send") || errorMessage.includes("fetch")) {
      return { 
        success: false, 
        error: "Impossible de contacter le serveur. Vérifiez votre connexion ou que la fonction est déployée." 
      };
    }
    
    return { success: false, error: `Erreur lors de l'annulation: ${errorMessage}` };
  }
}

/** Indique si l’utilisateur doit encore choisir son cadeau de bienvenue (après paiement). */
export async function fetchWelcomeGiftNeedsChoice(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return false;

  const { data, error } = await supabase.functions.invoke("welcome-gift-choice", {
    body: {},
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error || !data || typeof data.needsChoice !== "boolean") return false;
  return data.needsChoice;
}

/** Envoie le choix du cadeau et déclenche Gelato / Printful / traitement manuel. */
export async function submitWelcomeGiftChoice(
  giftId: string,
  giftSize?: string
): Promise<{ error?: string }> {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return { error: "Session expirée. Reconnecte-toi." };

  const { data, error } = await supabase.functions.invoke("welcome-gift-choice", {
    body: {
      giftId,
      ...(giftSize ? { giftSize } : {}),
    },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) {
    let errorMessage = error.message || "Erreur réseau";

    if (error.context) {
      if (typeof Response !== "undefined" && error.context instanceof Response) {
        try {
          const responseClone = error.context.clone();
          const rawText = await responseClone.text();
          if (rawText) {
            try {
              const parsed = JSON.parse(rawText);
              if (parsed?.error) {
                errorMessage = parsed.error;
              } else if (parsed?.message) {
                errorMessage = parsed.message;
              } else {
                errorMessage = rawText;
              }
            } catch {
              errorMessage = rawText;
            }
          }
        } catch {
          // keep fallback message
        }
      } else if (error.context.message) {
        errorMessage = error.context.message;
      }
    }

    return { error: errorMessage };
  }
  if (data?.error) return { error: data.error };
  return {};
}
