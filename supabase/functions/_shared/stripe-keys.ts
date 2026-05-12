export type StripeMode = "test" | "live";

export function getStripeCheckoutMode(): StripeMode {
  const mode = Deno.env.get("STRIPE_MODE")?.toLowerCase().trim();
  return mode === "live" ? "live" : "test";
}

export function getStripeSecretKeyForCheckout(): string | null {
  const mode = getStripeCheckoutMode();
  const key =
    mode === "live"
      ? Deno.env.get("STRIPE_SECRET_KEY_LIVE") ||
        Deno.env.get("STRIPE_SECRET_KEY") ||
        null
      : Deno.env.get("STRIPE_SECRET_KEY_TEST") || null;
  console.log(
    `getStripeSecretKeyForCheckout: ${key ? key.slice(0, 12) : "(null)"}`,
  );
  return key;
}

export function getStripeSecretKeyForEventLivemode(livemode: boolean): string | null {
  if (livemode) {
    return (
      Deno.env.get("STRIPE_SECRET_KEY_LIVE") ||
      Deno.env.get("STRIPE_SECRET_KEY") ||
      null
    );
  }
  return Deno.env.get("STRIPE_SECRET_KEY_TEST") || null;
}

export function getStripeWebhookSigningSecrets(): string[] {
  const secrets: string[] = [];
  const testSecret  = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST")?.trim();
  const liveSecret  = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE")?.trim();
  const genericSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim();
  if (testSecret)  secrets.push(testSecret);
  if (liveSecret)  secrets.push(liveSecret);
  if (genericSecret && !secrets.includes(genericSecret)) secrets.push(genericSecret);
  return secrets;
}

export function getAnyStripeApiKeyForVerifier(): string {
  return (
    Deno.env.get("STRIPE_SECRET_KEY_TEST") ||
    Deno.env.get("STRIPE_SECRET_KEY_LIVE") ||
    Deno.env.get("STRIPE_SECRET_KEY") ||
    "sk_test_placeholder"
  );
}
