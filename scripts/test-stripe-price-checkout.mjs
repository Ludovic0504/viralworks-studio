/**
 * Vérifie que les price_id configurés produisent des checkouts distincts (9€ / 59€).
 * Usage: node scripts/test-stripe-price-checkout.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TEST_EMAIL = "jean.limonta06@gmail.com";
const PRICE_IMAGE_9 = "price_1TlocpL5hU2aPnTdE6cs2pK3";
const PRICE_PRO_59 = "price_1TlocpL5hU2aPnTdJG9N8A36";

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
  env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || "";
const stripeKey = env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY || "";

if (!url || !anonKey || !serviceKey || !stripeKey) {
  console.error("❌ Variables manquantes (Supabase + STRIPE_SECRET_KEY_TEST)");
  process.exit(2);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verifyPrice(priceId, expectedEur, label) {
  const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${label}: ${body.error?.message}`);
  const eur = (body.unit_amount ?? 0) / 100;
  const ok = body.active && Math.abs(eur - expectedEur) < 0.01;
  console.log(`${ok ? "✅" : "❌"} ${label}: ${priceId} → ${eur}€ actif=${body.active}`);
  return ok;
}

async function getUserAccessToken() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: TEST_EMAIL,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(linkErr?.message ?? "generateLink failed");
  }
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (otpErr || !otpData.session?.access_token) {
    throw new Error(otpErr?.message ?? "verifyOtp failed");
  }
  return otpData.session.access_token;
}

async function invokeStripePayment(accessToken, planKey, amount, credits) {
  const res = await fetch(`${url}/functions/v1/stripe-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      credits,
      type: "subscription",
      subscriptionPlan: planKey,
      origin: "http://localhost:5173",
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function inspectCheckoutSession(sessionId) {
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items.data.price`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message);
  const item = body.line_items?.data?.[0];
  const priceId = item?.price?.id ?? item?.price;
  const amount = item?.amount_total ?? body.amount_total;
  return { priceId, amountCents: amount, mode: body.mode, url: body.url };
}

console.log("\n=== Test price_id Stripe (post-config) ===\n");

let ok = true;
ok = (await verifyPrice(PRICE_IMAGE_9, 9, "Image 9€")) && ok;
ok = (await verifyPrice(PRICE_PRO_59, 59, "Pro 59€")) && ok;

if (PRICE_IMAGE_9 === PRICE_PRO_59) {
  console.log("❌ Même price_id pour les deux plans");
  ok = false;
}

console.log("\n--- Edge function stripe-payment ---\n");

const token = await getUserAccessToken();

for (const [planKey, amount, credits, expectedPriceId] of [
  ["image_9", 9, 0, PRICE_IMAGE_9],
  ["pro_59", 59, 10, PRICE_PRO_59],
]) {
  const { status, body } = await invokeStripePayment(token, planKey, amount, credits);
  if (status !== 200 || !body.sessionId) {
    console.log(`❌ ${planKey}: HTTP ${status} — ${body.error ?? JSON.stringify(body)}`);
    ok = false;
    continue;
  }
  const session = await inspectCheckoutSession(body.sessionId);
  const priceMatch = session.priceId === expectedPriceId;
  const amountMatch =
    planKey === "image_9"
      ? session.amountCents === 900
      : session.amountCents === 5900;
  const pass = priceMatch && amountMatch && session.mode === "subscription";
  console.log(
    `${pass ? "✅" : "❌"} ${planKey}: session ${body.sessionId}`,
  );
  console.log(
    `   price=${session.priceId} (${priceMatch ? "OK" : `attendu ${expectedPriceId}`}), total=${(session.amountCents ?? 0) / 100}€`,
  );
  if (!pass) ok = false;
}

console.log(`\n--- Résultat: ${ok ? "TOUT OK" : "ÉCHEC"} ---\n`);
process.exit(ok ? 0 : 1);
