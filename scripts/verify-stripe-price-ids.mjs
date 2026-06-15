/**
 * Vérifie que STRIPE_PRICE_IMAGE_9 et STRIPE_PRICE_PRO_59 pointent vers les bons montants.
 * Usage: node scripts/verify-stripe-price-ids.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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
const stripeKey =
  env.STRIPE_SECRET_KEY_LIVE ||
  env.STRIPE_SECRET_KEY ||
  env.STRIPE_SECRET_KEY_TEST ||
  "";

const EXPECTED = {
  STRIPE_PRICE_IMAGE_9: { label: "ViralWorks Image", eur: 9 },
  STRIPE_PRICE_PRO_59: { label: "ViralWorks Pro", eur: 59 },
};

console.log("\n=== Vérification des Price ID Stripe ===\n");

if (!stripeKey) {
  console.log("⚠️  Aucune clé Stripe locale — lecture des secrets Supabase uniquement.\n");
}

let secretList = "";
try {
  secretList = execSync("supabase secrets list", { cwd: ROOT, encoding: "utf8" });
} catch (e) {
  secretList = e.stdout || "";
}

for (const [envName, { label, eur }] of Object.entries(EXPECTED)) {
  const present = secretList.includes(envName);
  console.log(`${present ? "✅" : "❌"} Secret Supabase ${envName} (${label} ${eur}€) ${present ? "défini" : "MANQUANT"}`);
}

if (!stripeKey) {
  console.log(
    "\nAjoutez STRIPE_SECRET_KEY_LIVE dans .env.local pour vérifier les montants des price_id.\n",
  );
  process.exit(0);
}

const priceIds = {};
for (const envName of Object.keys(EXPECTED)) {
  const fromLocal = env[envName];
  if (fromLocal) priceIds[envName] = fromLocal;
}

if (Object.keys(priceIds).length === 0) {
  console.log(
    "\nDéfinissez STRIPE_PRICE_IMAGE_9 et STRIPE_PRICE_PRO_59 dans .env.local pour la vérif API.\n",
  );
  process.exit(0);
}

if (priceIds.STRIPE_PRICE_IMAGE_9 === priceIds.STRIPE_PRICE_PRO_59) {
  console.log("\n❌ STRIPE_PRICE_IMAGE_9 et STRIPE_PRICE_PRO_59 ont le MÊME price_id !");
}

for (const [envName, priceId] of Object.entries(priceIds)) {
  const { label, eur } = EXPECTED[envName];
  try {
    const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const body = await res.json();
    if (!res.ok) {
      console.log(`❌ ${envName} (${priceId}): ${body.error?.message || res.status}`);
      continue;
    }
    const unitEur = (body.unit_amount ?? 0) / 100;
    const ok = Math.abs(unitEur - eur) < 0.01;
    console.log(
      `${ok ? "✅" : "❌"} ${label}: ${priceId} → ${unitEur}€ (attendu ${eur}€)`,
    );
  } catch (err) {
    console.log(`❌ ${envName}: ${err instanceof Error ? err.message : err}`);
  }
}

console.log("");
