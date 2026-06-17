/**
 * Vérification locale du stack Image Studio / Stripe / Kie AI
 * Usage: node scripts/verify-image-studio-stack.mjs
 */
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
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function mask(v) {
  if (!v) return { status: "absent", preview: "(absent)" };
  if (v.length <= 8) return { status: "set", preview: "***" };
  return { status: "set", preview: `${v.slice(0, 6)}…${v.slice(-4)} (${v.length} chars)` };
}

function ok(label, pass, detail = "") {
  const icon = pass ? "✅" : "❌";
  console.log(`${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";

console.log("\n=== 1. Variables d'environnement locales ===\n");
const localChecks = [
  ["VITE_SUPABASE_URL", supabaseUrl],
  ["VITE_SUPABASE_ANON_KEY", anonKey],
  ["VITE_STRIPE_PUBLISHABLE_KEY", env.VITE_STRIPE_PUBLISHABLE_KEY],
];
let localOk = true;
for (const [k, v] of localChecks) {
  const m = mask(v);
  console.log(`  ${k}: ${m.preview}`);
  if (m.status === "absent") localOk = false;
}
ok("Config front minimale", localOk);

console.log("\n=== 2. Edge Function generate-image-studio (GET modèles) ===\n");
let modelsOk = false;
let models = null;
if (supabaseUrl && anonKey) {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image-studio`, {
      method: "GET",
      headers: { apikey: anonKey },
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    console.log(`  HTTP ${res.status}`);
    if (res.ok && body?.models) {
      models = body.models;
      console.log("  Modèles:", JSON.stringify(models));
      modelsOk = Boolean(models.nano_banana_pro || models.hailuo || models.gpt_image_2);
      ok("Au moins un modèle image disponible", modelsOk);
      ok("Kie AI (NanaBanana Pro) configuré côté serveur", Boolean(models.nano_banana_pro));
    } else {
      console.log("  Réponse:", JSON.stringify(body).slice(0, 300));
      ok("Endpoint modèles accessible", false, `status ${res.status}`);
    }
  } catch (e) {
    ok("Appel generate-image-studio", false, e.message);
  }
} else {
  ok("Appel generate-image-studio", false, "URL/anon key manquants");
}

console.log("\n=== 3. Cohérence code abonnement image_9 ===\n");
const files = {
  payImage9: fs.readFileSync(path.join(ROOT, "src/hooks/useStripePayment.js"), "utf8"),
  stripePayment: fs.readFileSync(
    path.join(ROOT, "supabase/functions/stripe-payment/index.ts"),
    "utf8",
  ),
  stripeWebhook: fs.readFileSync(
    path.join(ROOT, "supabase/functions/stripe-webhook/index.ts"),
    "utf8",
  ),
  generateStudio: fs.readFileSync(
    path.join(ROOT, "supabase/functions/generate-image-studio/index.ts"),
    "utf8",
  ),
  planAccess: fs.readFileSync(
    path.join(ROOT, "supabase/functions/_shared/plan-access.ts"),
    "utf8",
  ),
};

ok("payImage9 → plan image_9 à 9€", /image_9[\s\S]*amount:\s*9/.test(files.payImage9));
ok("payImage9 → 0 crédits vidéo", /image_9[\s\S]*credits:\s*0/.test(files.payImage9));
ok(
  "stripe-payment utilise STRIPE_PRICE_IMAGE_9",
  files.stripePayment.includes("STRIPE_PRICE_IMAGE_9"),
);
ok(
  "webhook image_9 → 0 crédits vidéo",
  files.stripeWebhook.includes('p === "image_9"') &&
    files.stripeWebhook.includes("return 0"),
);
ok(
  "quota Image Studio selon offre",
  files.generateStudio.includes("getImageStudioMonthlyLimit") &&
    files.planAccess.includes("IMAGE_STUDIO_MONTHLY_LIMIT_IMAGE_9 = 150"),
);

console.log("\n=== 4. Tests unitaires quota ===\n");
const { execSync } = await import("node:child_process");
try {
  const out = execSync("npm run test -- src/bibliotheque/imageStudio/quotaAlerts.test.ts", {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  const passed = /Tests\s+\d+ passed/.test(out) || /✓/.test(out);
  ok("Tests quotaAlerts", passed);
  const m = out.match(/Tests\s+(\d+) passed/);
  if (m) console.log(`  ${m[0]}`);
} catch (e) {
  ok("Tests quotaAlerts", false, e.stderr?.slice(0, 200) || e.message);
}

console.log("\n=== 5. App locale Vite ===\n");
try {
  const res = await fetch("http://localhost:5173/");
  ok("Dev server http://localhost:5173", res.ok, `HTTP ${res.status}`);
} catch {
  ok("Dev server http://localhost:5173", false, "non accessible — lance npm run dev");
}

console.log("\n=== FIN — actions manuelles si ❌ ===\n");
console.log("  • Supabase secrets: STRIPE_PRICE_IMAGE_9, KIE_AI_API_KEY, STRIPE_SECRET_KEY_*");
console.log("  • Dashboard Stripe: vérifier un paiement test 9€ sur ton compte");
console.log("  • kie.ai: recharger le solde si nano_banana_pro = false\n");

process.exitCode = localOk && modelsOk ? 0 : 1;
