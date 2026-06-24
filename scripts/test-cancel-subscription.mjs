/**
 * Test annulation abonnement via Stripe API (simule le résultat de cancel-subscription).
 * Met cancel_at_period_end sur l'abonnement actif puis vérifie la DB.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const USER_ID = "7f77fb6d-015b-4962-b74a-03f86a835d77";

function parseEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local"), ...process.env };
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || "";
const stripeKey = env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY || "";

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: sub } = await admin
  .from("stripe_subscriptions")
  .select("stripe_subscription_id, status, cancel_at_period_end")
  .eq("user_id", USER_ID)
  .eq("status", "active")
  .maybeSingle();

if (!sub) {
  console.error("❌ Pas d'abonnement actif");
  process.exit(1);
}

console.log("Avant:", sub);

const body = new URLSearchParams({ cancel_at_period_end: "true" });
const res = await fetch(
  `https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  },
);
const stripeSub = await res.json();
if (!res.ok) {
  console.error("❌ Stripe:", stripeSub);
  process.exit(1);
}

const periodEnd = stripeSub.items?.data?.[0]?.current_period_end;
const periodStart = stripeSub.items?.data?.[0]?.current_period_start;

await admin
  .from("stripe_subscriptions")
  .update({
    cancel_at_period_end: true,
    updated_at: new Date().toISOString(),
    ...(periodEnd
      ? { current_period_end: new Date(periodEnd * 1000).toISOString() }
      : {}),
    ...(periodStart
      ? { current_period_start: new Date(periodStart * 1000).toISOString() }
      : {}),
  })
  .eq("stripe_subscription_id", sub.stripe_subscription_id);

const { data: after } = await admin
  .from("stripe_subscriptions")
  .select("status, cancel_at_period_end, current_period_end")
  .eq("stripe_subscription_id", sub.stripe_subscription_id)
  .single();

console.log("✅ Annulation programmée (fin de période)");
console.log("Après DB:", after);
console.log("Stripe cancel_at_period_end:", stripeSub.cancel_at_period_end);
