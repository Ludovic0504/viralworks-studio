/**
 * Batterie de vérifications abonnements (lecture seule + sécurité edge functions).
 * Usage: node scripts/subscription-test-battery.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEST_USER_ID = "7f77fb6d-015b-4962-b74a-03f86a835d77";

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
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
const serviceKey =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE || "";

if (!url || !anonKey || !serviceKey) {
  console.error("❌ Variables Supabase manquantes");
  process.exit(2);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkDbSubscription() {
  const { data: subs, error } = await admin
    .from("stripe_subscriptions")
    .select("stripe_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end")
    .eq("user_id", TEST_USER_ID)
    .order("updated_at", { ascending: false });

  if (error) return fail("DB stripe_subscriptions", error.message);
  const active = (subs ?? []).filter((s) => s.status === "active");
  if (active.length === 0) {
    return fail("Abonnement actif en DB", "0 ligne active");
  }
  if (active.length > 1) {
    fail("Un seul abonnement actif", `${active.length} lignes actives`);
  }
  const sub = active[0];
  if (!sub.current_period_start || !sub.current_period_end) {
    return fail("Période abonnement DB", "dates manquantes");
  }
  const startMs = new Date(sub.current_period_start).getTime();
  const endMs = new Date(sub.current_period_end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return fail("Période abonnement DB", "dates invalides");
  }
  pass("Abonnement actif en DB", `${sub.stripe_subscription_id} → ${sub.current_period_end.slice(0, 10)}`);

  const { data: cycle, error: cycleErr } = await admin
    .from("subscription_credit_cycles")
    .select("plan_key, monthly_credit_amount")
    .eq("stripe_subscription_id", sub.stripe_subscription_id)
    .maybeSingle();
  if (cycleErr || !cycle) {
    return fail("Cycle crédits DB", cycleErr?.message ?? "absent");
  }
  pass("Plan en subscription_credit_cycles", `${cycle.plan_key} (${cycle.monthly_credit_amount} crédits vidéo/mois)`);
}

async function checkRlsAnonymous() {
  const { data, error } = await anon
    .from("stripe_subscriptions")
    .select("id")
    .eq("user_id", TEST_USER_ID)
    .limit(1);
  if (error) {
    pass("RLS stripe_subscriptions (anon)", "accès refusé ou vide");
    return;
  }
  if ((data ?? []).length === 0) {
    pass("RLS stripe_subscriptions (anon)", "0 ligne visible");
  } else {
    fail("RLS stripe_subscriptions (anon)", "données visibles sans auth");
  }
}

async function checkEdgeFunctionSecurity() {
  const { data, error } = await anon.functions.invoke("stripe-payment", {
    body: { amount: 9, credits: 0, type: "subscription", subscriptionPlan: "image_9" },
  });
  if (error || data?.error) {
    pass("stripe-payment sans JWT", "refusé comme attendu");
  } else if (data?.sessionId) {
    fail("stripe-payment sans JWT", "session créée sans auth");
  } else {
    pass("stripe-payment sans JWT", "pas de session");
  }

  const { data: cancelData, error: cancelErr } = await anon.functions.invoke("cancel-subscription");
  if (cancelErr || cancelData?.error) {
    pass("cancel-subscription sans JWT", "refusé comme attendu");
  } else if (cancelData?.success) {
    fail("cancel-subscription sans JWT", "annulation sans auth");
  } else {
    pass("cancel-subscription sans JWT", "pas d'annulation");
  }
}

async function checkRecentPayments() {
  const { data, error } = await admin
    .from("stripe_payments")
    .select("status, amount, metadata, created_at")
    .eq("user_id", TEST_USER_ID)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) return fail("Historique paiements", error.message);
  if (!data?.length) return fail("Historique paiements", "vide");
  const paid = data.filter((p) => p.status === "paid" || p.status === "complete");
  pass("Historique paiements", `${paid.length}/${data.length} récents payés`);
}

async function main() {
  console.log("\n=== Batterie tests abonnement ViralWorks ===\n");
  await checkDbSubscription();
  await checkRlsAnonymous();
  await checkEdgeFunctionSecurity();
  await checkRecentPayments();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- Résultat: ${results.length - failed.length}/${results.length} OK ---\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
