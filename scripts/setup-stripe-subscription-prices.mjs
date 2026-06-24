/**
 * Crée ou retrouve les price_id Stripe (test) pour image_9 et pro_59,
 * puis met à jour les secrets Supabase.
 *
 * Usage:
 *   STRIPE_SECRET_KEY_TEST=sk_test_... node scripts/setup-stripe-subscription-prices.mjs
 *   node scripts/setup-stripe-subscription-prices.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const PROJECT_REF = "wuvtfhletxieocetzppo";

const PLANS = [
  {
    secretName: "STRIPE_PRICE_IMAGE_9",
    productName: "ViralWorks Image",
    amountCents: 900,
    metadata: { plan_key: "image_9" },
  },
  {
    secretName: "STRIPE_PRICE_PRO_59",
    productName: "ViralWorks Pro",
    amountCents: 5900,
    metadata: { plan_key: "pro_59" },
  },
];

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
const stripeKey =
  env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY || "";
const dryRun = process.argv.includes("--dry-run");

if (!stripeKey) {
  console.error("❌ STRIPE_SECRET_KEY_TEST manquant");
  process.exit(2);
}

async function stripeForm(path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe ${path} → ${res.status}`);
  }
  return json;
}

async function stripeGet(path, query = {}) {
  const qs = new URLSearchParams(query).toString();
  const url = `https://api.stripe.com/v1/${path}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe GET ${path} → ${res.status}`);
  }
  return json;
}

async function findExistingPrice(plan) {
  let startingAfter;
  for (let page = 0; page < 10; page++) {
    const list = await stripeGet("prices", {
      limit: "100",
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const price of list.data ?? []) {
      if (price.type !== "recurring") continue;
      if (price.currency !== "eur") continue;
      if (price.unit_amount !== plan.amountCents) continue;
      if (price.recurring?.interval !== "month") continue;
      if (!price.active) continue;
      return price.id;
    }
    if (!list.has_more) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }
  return null;
}

async function ensurePrice(plan) {
  const existing = await findExistingPrice(plan);
  if (existing) {
    console.log(`✅ ${plan.secretName}: price existant ${existing} (${plan.amountCents / 100}€/mois)`);
    return existing;
  }

  console.log(`📦 Création produit + prix pour ${plan.productName}…`);
  const product = await stripeForm("products", {
    name: plan.productName,
    "metadata[plan_key]": plan.metadata.plan_key,
    "metadata[viralworks]": "subscription",
  });

  const price = await stripeForm("prices", {
    product: product.id,
    currency: "eur",
    unit_amount: plan.amountCents,
    "recurring[interval]": "month",
    "metadata[plan_key]": plan.metadata.plan_key,
  });

  console.log(`✅ ${plan.secretName}: nouveau price ${price.id} (${plan.amountCents / 100}€/mois)`);
  return price.id;
}

async function main() {
  console.log("\n=== Configuration Price ID Stripe (test) ===\n");

  const priceIds = {};
  for (const plan of PLANS) {
    priceIds[plan.secretName] = await ensurePrice(plan);
  }

  if (priceIds.STRIPE_PRICE_IMAGE_9 === priceIds.STRIPE_PRICE_PRO_59) {
    console.error("\n❌ Les deux plans ont le même price_id — abandon.");
    process.exit(1);
  }

  console.log("\nRésumé:");
  console.log(`  STRIPE_PRICE_IMAGE_9 = ${priceIds.STRIPE_PRICE_IMAGE_9}`);
  console.log(`  STRIPE_PRICE_PRO_59 = ${priceIds.STRIPE_PRICE_PRO_59}`);

  if (dryRun) {
    console.log("\n(dry-run — secrets Supabase non modifiés)\n");
    return;
  }

  const secretArgs = Object.entries(priceIds)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");

  console.log("\nMise à jour des secrets Supabase…");
  execSync(
    `npx supabase secrets set ${secretArgs} --project-ref ${PROJECT_REF}`,
    { cwd: ROOT, stdio: "inherit" },
  );

  console.log("\n✅ Secrets Supabase mis à jour.\n");
}

main().catch((err) => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
