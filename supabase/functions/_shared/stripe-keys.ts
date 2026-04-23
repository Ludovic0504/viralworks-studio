/**
 * Deux jeux de clés Stripe (test / live) sur Supabase + bascule via STRIPE_MODE.
 *
 * Secrets recommandés :
 * - STRIPE_MODE = "test" | "live" (défaut : live) — à aligner avec ce que tu utilises dans le dashboard
 * - STRIPE_SECRET_KEY_TEST, STRIPE_WEBHOOK_SECRET_TEST
 * - STRIPE_SECRET_KEY_LIVE, STRIPE_WEBHOOK_SECRET_LIVE
 *
 * Rétrocompat : STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET utilisés si les *_LIVE / génériques manquent.
 */

export type StripeCheckoutMode = "test" | "live";

export function getStripeCheckoutMode(): StripeCheckoutMode {
  const m = (Deno.env.get("STRIPE_MODE") ?? "live").toLowerCase().trim();
  return m === "test" ? "test" : "live";
}

/** Clé API pour checkout / annulation : suit STRIPE_MODE. */
export function getStripeSecretKeyForCheckout(): string {
  const mode = getStripeCheckoutMode();
  if (mode === "test") {
    return (
      Deno.env.get("STRIPE_SECRET_KEY_TEST")?.trim() ||
      Deno.env.get("STRIPE_SECRET_KEY")?.trim() ||
      ""
    );
  }
  return (
    Deno.env.get("STRIPE_SECRET_KEY_LIVE")?.trim() ||
    Deno.env.get("STRIPE_SECRET_KEY")?.trim() ||
    ""
  );
}

/** Clé API après réception d’un webhook (selon event.livemode). */
export function getStripeSecretKeyForEventLivemode(livemode: boolean): string {
  if (livemode) {
    return (
      Deno.env.get("STRIPE_SECRET_KEY_LIVE")?.trim() ||
      Deno.env.get("STRIPE_SECRET_KEY")?.trim() ||
      ""
    );
  }
  return (
    Deno.env.get("STRIPE_SECRET_KEY_TEST")?.trim() ||
    Deno.env.get("STRIPE_SECRET_KEY")?.trim() ||
    ""
  );
}

/**
 * Secrets de signature webhook à essayer dans l’ordre (test puis live puis legacy).
 * Permet une seule URL de webhook pour les deux environnements Stripe.
 */
export function getStripeWebhookSigningSecrets(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [
    Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE"),
    Deno.env.get("STRIPE_WEBHOOK_SECRET"),
  ]) {
    const s = k?.trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** N’importe quelle clé API non vide (pour instancier Stripe avant verify ; la vérif n’utilise que le signing secret). */
export function getAnyStripeApiKeyForVerifier(): string {
  return (
    Deno.env.get("STRIPE_SECRET_KEY_TEST")?.trim() ||
    Deno.env.get("STRIPE_SECRET_KEY_LIVE")?.trim() ||
    Deno.env.get("STRIPE_SECRET_KEY")?.trim() ||
    "sk_test_placeholder"
  );
}
