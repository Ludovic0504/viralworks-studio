import posthog from "posthog-js";
import { getUserCreditBuckets } from "@/bibliotheque/supabase/credits";
import { getUserPayments, getUserSubscription } from "@/bibliotheque/supabase/stripe";

declare global {
  interface Window {
    __posthogInitialized?: boolean;
    __posthogLastPageUrl?: string;
  }
}

export type PostHogErrorType =
  | "network"
  | "auth"
  | "validation"
  | "credits"
  | "payment"
  | "generation"
  | "unknown";

function getApiKey(): string {
  return String(import.meta.env.VITE_POSTHOG_API_KEY ?? "").trim();
}

function getHost(): string {
  return String(import.meta.env.VITE_POSTHOG_HOST ?? "").trim();
}

function canUseDom(): boolean {
  return typeof window !== "undefined";
}

function ensureReady(): boolean {
  if (!canUseDom() || !getApiKey()) return false;
  if (!window.__posthogInitialized) initPostHog();
  return Boolean(posthog.__loaded);
}

export function initPostHog(): void {
  if (!canUseDom()) return;

  const apiKey = getApiKey();
  if (!apiKey) return;

  if (window.__posthogInitialized) return;
  window.__posthogInitialized = true;

  posthog.init(apiKey, {
    api_host: getHost() || "https://eu.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
}

export function capturePostHog(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!ensureReady()) return;
  posthog.capture(event, properties);
}

export function classifyErrorType(
  input: unknown,
  hint?: PostHogErrorType
): PostHogErrorType {
  if (hint) return hint;
  const msg = String(
    input instanceof Error ? input.message : input ?? ""
  ).toLowerCase();

  if (
    /network|fetch|timeout|abort|failed to fetch|connexion|internet/.test(msg)
  ) {
    return "network";
  }
  if (
    /auth|session|connect|login|password|email not confirmed|credentials/.test(
      msg
    )
  ) {
    return "auth";
  }
  if (/quota|crédit|credit|insufficient|limite|abonnement requis/.test(msg)) {
    return "credits";
  }
  if (/stripe|paiement|payment|checkout/.test(msg)) {
    return "payment";
  }
  if (/validation|invalide|minimum|trop court|trop long|choisis/.test(msg)) {
    return "validation";
  }
  if (/génération|generation|veo|hailuo|vidéo|video/.test(msg)) {
    return "generation";
  }
  return "unknown";
}

export function trackPostHogError(
  message: string,
  page?: string,
  errorTypeHint?: PostHogErrorType
): void {
  const safePage =
    page?.trim() ||
    (canUseDom()
      ? `${window.location.pathname}${window.location.search}`
      : "");
  capturePostHog("error_encountered", {
    error_message: message,
    page: safePage,
    error_type: classifyErrorType(message, errorTypeHint),
  });
}

export async function resolvePlanTypeForAnalytics(): Promise<string> {
  try {
    const sub = await getUserSubscription();
    if (sub) {
      const payments = await getUserPayments(5);
      for (const p of payments) {
        const plan = String(p.metadata?.subscription_plan ?? "").trim();
        if (plan === "monthly" || plan === "yearly") return plan;
      }
      return "subscriber";
    }
    const buckets = await getUserCreditBuckets();
    if (Number(buckets.video_generation || 0) > 0) return "pack_credits";
    return "free";
  } catch {
    return "unknown";
  }
}

export async function syncPostHogUserFromSession(user: {
  id: string;
  email?: string | null;
}): Promise<void> {
  const plan_type = await resolvePlanTypeForAnalytics();
  identifyPostHogUser(user.id, {
    email: user.email ?? undefined,
    plan_type,
  });
}

export function trackPostHogPageView(url?: string): void {
  if (!canUseDom()) return;
  if (!getApiKey()) return;

  if (!window.__posthogInitialized) initPostHog();
  if (!posthog.__loaded) return;

  const safeUrl =
    typeof url === "string" && url.trim()
      ? url.trim()
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (window.__posthogLastPageUrl === safeUrl) return;
  window.__posthogLastPageUrl = safeUrl;

  posthog.capture("$pageview", { $current_url: safeUrl });
}

export function identifyPostHogUser(
  distinctId: string,
  properties?: Record<string, unknown>
): void {
  if (!ensureReady()) return;
  posthog.identify(distinctId, properties);
}

export function resetPostHogUser(): void {
  if (!canUseDom()) return;
  if (!posthog.__loaded) return;
  posthog.reset();
  window.__posthogLastPageUrl = undefined;
}

/** Durée affichée (8s, 24s…) → secondes pour analytics. */
export function parseVideoDurationSeconds(duration: string): number {
  const m = String(duration || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
