/**
 * Envoie les emails récapitulatifs des réponses onboarding (3 sections)
 * pour les utilisateurs inscrits depuis ONBOARDING_ROLLOUT_AT.
 *
 * Usage:
 *   node scripts/backfill-onboarding-answers-notify.mjs
 *   node scripts/backfill-onboarding-answers-notify.mjs --dry-run
 */
import fs from "node:fs";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const env = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };

  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
  const hookSecret = process.env.AUTH_HOOK_SECRET || env.AUTH_HOOK_SECRET || "";

  if (!url || !anonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  const endpoint =
    `${url}/functions/v1/backfill-onboarding-answers-notify${dryRun ? "?dry_run=1" : ""}`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };
  if (hookSecret) headers["x-hook-secret"] = hookSecret;

  console.log(dryRun ? "Dry run (aucun email)…" : "Envoi des emails récap réponses onboarding…");

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: "{}",
  });

  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
