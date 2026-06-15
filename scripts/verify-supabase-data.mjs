import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const key =
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_ROLE ||
  "";

if (!url || !key) {
  console.error("❌ SUPABASE_URL ou SERVICE_ROLE_KEY manquant en local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("\n=== Abonnements par plan_key ===\n");
const { data: plans, error: plansErr } = await supabase
  .from("subscription_credit_cycles")
  .select("plan_key");
if (plansErr) {
  console.error("❌", plansErr.message);
} else {
  const counts = {};
  for (const row of plans ?? []) {
    counts[row.plan_key] = (counts[row.plan_key] || 0) + 1;
  }
  console.log(counts);
}

console.log("\n=== Derniers paiements stripe (5) ===\n");
const { data: payments, error: payErr } = await supabase
  .from("stripe_payments")
  .select("status, amount, currency, metadata, created_at")
  .order("created_at", { ascending: false })
  .limit(5);
if (payErr) console.error("❌", payErr.message);
else {
  for (const p of payments ?? []) {
    const plan = p.metadata?.subscription_plan ?? p.metadata?.type ?? "?";
    console.log(`  ${p.created_at?.slice(0, 10)} | ${p.status} | ${p.amount} ${p.currency} | plan=${plan}`);
  }
}

console.log("\n=== Migration image_studio (profiles colonnes) ===\n");
const { data: prof, error: profErr } = await supabase
  .from("profiles")
  .select("image_studio_count, image_studio_reset_at")
  .limit(1);
if (profErr) console.error("❌", profErr.message, "(migration peut-être non appliquée)");
else console.log("✅ Colonnes image_studio présentes");

console.log("\n=== Abonnements actifs stripe_subscriptions ===\n");
const { data: subs, error: subsErr } = await supabase
  .from("stripe_subscriptions")
  .select("status, user_id, current_period_end")
  .eq("status", "active");
if (subsErr) console.error("❌", subsErr.message);
else console.log(`  ${subs?.length ?? 0} abonnement(s) actif(s)`);
