/**
 * Active un abonnement mensuel de test pour un utilisateur (prod).
 * Usage:
 *   node scripts/activate-monthly-subscription.mjs --email jean.limonta06@gmail.com
 *
 * Requiert SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans l'environnement.
 */
import { createClient } from "@supabase/supabase-js";

const MONTHLY_CREDITS = 30;
const TEST_SUBSCRIPTION_ID = "manual_test_sub_jean_limonta_monthly";

function parseArgs() {
  const args = process.argv.slice(2);
  let email = "jean.limonta06@gmail.com";
  let userId = process.env.USER_ID?.trim() || "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--user-id" && args[i + 1]) userId = args[++i];
  }
  return { email, userId };
}

function nextVideoDisplayCap({ balanceBefore, oldCap, purchaseQty, balanceAfter }) {
  const B = Math.max(0, Math.floor(balanceBefore));
  const Q = Math.max(0, Math.floor(purchaseQty));
  const A = Math.max(0, Math.floor(balanceAfter));
  const C_old = oldCap == null ? 30 : Math.max(0, Math.floor(Number(oldCap)));
  const C_new = B === 0 || B === C_old ? Q : B + Q;
  return Math.max(C_new, A);
}

async function main() {
  const { email, userId: userIdArg } = parseArgs();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = userIdArg;
  if (!userId) {
    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      console.error("listUsers failed:", listErr.message);
      process.exit(1);
    }

    const user = listData.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      console.error(`User not found for email: ${email}`);
      process.exit(1);
    }
    userId = user.id;
  }
  console.log("user_id:", userId);

  const { data: customerRow } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  const stripeCustomerId =
    customerRow?.stripe_customer_id ?? `manual_test_cus_${userId.slice(0, 8)}`;

  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 30);

  const subscriptionPayload = {
    user_id: userId,
    stripe_subscription_id: TEST_SUBSCRIPTION_ID,
    stripe_customer_id: stripeCustomerId,
    status: "active",
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
    updated_at: new Date().toISOString(),
  };

  const { data: subRow, error: subErr } = await admin
    .from("stripe_subscriptions")
    .upsert(subscriptionPayload, { onConflict: "stripe_subscription_id" })
    .select("id, status, current_period_end")
    .single();

  if (subErr) {
    console.error("stripe_subscriptions upsert failed:", subErr.message);
    process.exit(1);
  }
  console.log("stripe_subscriptions:", subRow);

  const cyclePayload = {
    user_id: userId,
    stripe_subscription_id: TEST_SUBSCRIPTION_ID,
    plan_key: "monthly",
    monthly_credit_amount: MONTHLY_CREDITS,
    granted_months: 0,
    updated_at: new Date().toISOString(),
  };

  const { error: cycleErr } = await admin
    .from("subscription_credit_cycles")
    .upsert(cyclePayload, { onConflict: "stripe_subscription_id" });

  if (cycleErr) {
    console.error("subscription_credit_cycles upsert failed:", cycleErr.message);
    process.exit(1);
  }
  console.log("subscription_credit_cycles: ok (monthly)");

  const { data: creditsData, error: creditsReadErr } = await admin
    .from("user_credits")
    .select("credits, video_display_cap")
    .eq("user_id", userId)
    .maybeSingle();

  if (creditsReadErr) {
    console.error("user_credits read failed:", creditsReadErr.message);
    process.exit(1);
  }

  const balanceBefore = Number(creditsData?.credits ?? 0);
  const newCredits = balanceBefore + MONTHLY_CREDITS;
  const nextCap = nextVideoDisplayCap({
    balanceBefore,
    oldCap: creditsData?.video_display_cap,
    purchaseQty: MONTHLY_CREDITS,
    balanceAfter: newCredits,
  });

  if (creditsData) {
    const { error: creditsUpdErr } = await admin
      .from("user_credits")
      .update({ credits: newCredits, video_display_cap: nextCap })
      .eq("user_id", userId);
    if (creditsUpdErr) {
      console.error("user_credits update failed:", creditsUpdErr.message);
      process.exit(1);
    }
  } else {
    const { error: creditsInsErr } = await admin.from("user_credits").insert({
      user_id: userId,
      credits: newCredits,
      video_display_cap: nextCap,
    });
    if (creditsInsErr) {
      console.error("user_credits insert failed:", creditsInsErr.message);
      process.exit(1);
    }
  }
  console.log("user_credits:", { before: balanceBefore, after: newCredits, cap: nextCap });

  const { error: txErr } = await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: MONTHLY_CREDITS,
    type: "credit",
    reason: "subscription_payment",
    metadata: {
      subscription_id: TEST_SUBSCRIPTION_ID,
      manual_activation: true,
      plan: "monthly",
    },
  });

  if (txErr) {
    console.error("credit_transactions insert failed:", txErr.message);
    process.exit(1);
  }
  console.log("credit_transactions: +30 (subscription_payment)");

  const { data: verifySub } = await admin
    .from("stripe_subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  console.log("verify active subscription:", verifySub);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
