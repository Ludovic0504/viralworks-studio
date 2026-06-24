/**
 * Synchronise un abonnement Stripe → Supabase (backfill après correctif période API).
 * Usage:
 *   node scripts/sync-stripe-subscription.mjs --subscription sub_xxx --user-id UUID --plan image_9
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

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

function resolveSubscriptionPeriodUnix(subscription) {
  const item = subscription.items?.data?.[0];
  const periodStart =
    item?.current_period_start ??
    subscription.current_period_start ??
    subscription.start_date;
  const periodEnd =
    item?.current_period_end ?? subscription.current_period_end;
  if (typeof periodStart !== "number" || typeof periodEnd !== "number") {
    return null;
  }
  return { periodStart, periodEnd };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let subscriptionId = "";
  let userId = "";
  let planKey = "image_9";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--subscription" && args[i + 1]) subscriptionId = args[++i];
    if (args[i] === "--user-id" && args[i + 1]) userId = args[++i];
    if (args[i] === "--plan" && args[i + 1]) planKey = args[++i];
  }
  return { subscriptionId, userId, planKey };
}

function monthlyCreditsForPlan(planKey) {
  if (planKey === "image_9") return 0;
  if (planKey === "pro_59") return 10;
  return 30;
}

async function main() {
  const { subscriptionId, userId, planKey } = parseArgs();
  if (!subscriptionId || !userId) {
    console.error("Usage: --subscription sub_xxx --user-id UUID [--plan image_9|pro_59|premium_129]");
    process.exit(2);
  }

  const fileEnv = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
  const env = { ...fileEnv, ...process.env };
  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE || "";
  const stripeKey =
    env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY || "";

  if (!supabaseUrl || !serviceKey || !stripeKey) {
    console.error("Missing SUPABASE_URL, SERVICE_ROLE_KEY or STRIPE_SECRET_KEY_TEST");
    process.exit(2);
  }

  const subRes = await fetch(
    `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  if (!subRes.ok) {
    console.error("Stripe retrieve failed:", await subRes.text());
    process.exit(1);
  }
  const subscription = await subRes.json();
  const period = resolveSubscriptionPeriodUnix(subscription);
  if (!period) {
    console.error("Could not resolve subscription period from Stripe object");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const { data: subRow, error: subErr } = await admin
    .from("stripe_subscriptions")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customerId,
        status: subscription.status,
        current_period_start: new Date(period.periodStart * 1000).toISOString(),
        current_period_end: new Date(period.periodEnd * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    )
    .select("stripe_subscription_id, status, current_period_end")
    .single();

  if (subErr) {
    console.error("stripe_subscriptions upsert failed:", subErr.message);
    process.exit(1);
  }
  console.log("✅ stripe_subscriptions:", subRow);

  const storedPlan =
    planKey === "monthly" ? "premium_129" : planKey;

  const { error: cycleErr } = await admin
    .from("subscription_credit_cycles")
    .upsert(
      {
        user_id: userId,
        stripe_subscription_id: subscriptionId,
        plan_key: storedPlan,
        monthly_credit_amount: monthlyCreditsForPlan(storedPlan),
        granted_months: storedPlan === "yearly" ? 1 : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" },
    );

  if (cycleErr) {
    console.error("subscription_credit_cycles upsert failed:", cycleErr.message);
    process.exit(1);
  }
  console.log("✅ subscription_credit_cycles:", storedPlan);

  const { data: activeSubs } = await admin
    .from("stripe_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .eq("status", "active");

  const stale = (activeSubs ?? []).filter(
    (s) => s.stripe_subscription_id !== subscriptionId,
  );
  if (stale.length > 0) {
    const { error: cancelErr } = await admin
      .from("stripe_subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .neq("stripe_subscription_id", subscriptionId)
      .eq("status", "active");
    if (cancelErr) {
      console.warn("⚠️ Could not cancel stale subs:", cancelErr.message);
    } else {
      console.log(`✅ Canceled ${stale.length} stale active subscription row(s)`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
