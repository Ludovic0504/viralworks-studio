/**
 * État détaillé abonnement + crédits + quotas pour un user.
 * Usage: node scripts/subscription-state.mjs [--user-id UUID]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_USER = "7f77fb6d-015b-4962-b74a-03f86a835d77";

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
const key =
  env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE || "";

let userId = DEFAULT_USER;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--user-id" && process.argv[i + 1]) userId = process.argv[++i];
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: subs } = await admin
  .from("stripe_subscriptions")
  .select("*")
  .eq("user_id", userId)
  .order("updated_at", { ascending: false });

console.log("\n=== stripe_subscriptions ===");
for (const s of subs ?? []) {
  console.log(
    `  ${s.status.padEnd(10)} ${s.stripe_subscription_id} | fin ${s.current_period_end?.slice(0, 10)} | cancel_end=${s.cancel_at_period_end}`,
  );
}

const active = (subs ?? []).find((s) => s.status === "active");
if (active) {
  const { data: cycle } = await admin
    .from("subscription_credit_cycles")
    .select("*")
    .eq("stripe_subscription_id", active.stripe_subscription_id)
    .maybeSingle();
  console.log("\n=== cycle actif ===");
  console.log(cycle);

  const { data: credits } = await admin
    .from("user_credits")
    .select("credits, video_display_cap")
    .eq("user_id", userId)
    .maybeSingle();
  console.log("\n=== user_credits ===");
  console.log(credits);

  const { data: profile } = await admin
    .from("profiles")
    .select("image_studio_count, image_studio_reset_at, avatar_studio_count, avatar_studio_reset_at")
    .eq("id", userId)
    .maybeSingle();
  console.log("\n=== quotas profil ===");
  console.log(profile);
}
