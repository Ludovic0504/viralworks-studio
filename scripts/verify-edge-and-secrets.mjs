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

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const url = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon = env.VITE_SUPABASE_ANON_KEY || "";

function ok(label, pass, detail = "") {
  console.log(`${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

console.log("\n=== Edge Functions — santé ===\n");

const endpoints = [
  { name: "stripe-payment (sans auth)", path: "stripe-payment", method: "POST", body: {}, expect: [401, 400] },
  { name: "generate-image-studio (GET)", path: "generate-image-studio", method: "GET", expect: [200] },
  { name: "stripe-webhook (sans signature)", path: "stripe-webhook", method: "POST", body: {}, expect: [400] },
];

for (const ep of endpoints) {
  try {
    const res = await fetch(`${url}/functions/v1/${ep.path}`, {
      method: ep.method,
      headers: {
        apikey: anon,
        "Content-Type": "application/json",
        ...(ep.method === "POST" ? {} : {}),
      },
      body: ep.body !== undefined ? JSON.stringify(ep.body) : undefined,
    });
    const pass = ep.expect.includes(res.status);
    ok(ep.name, pass, `HTTP ${res.status}`);
  } catch (e) {
    ok(ep.name, false, e.message);
  }
}

console.log("\n=== Secrets Supabase (présence via CLI) ===\n");
const required = [
  "KIE_AI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_MODE",
  "STRIPE_PRICE_PRO_59",
  "STRIPE_PRICE_IMAGE_9",
  "SERVICE_ROLE_KEY",
  "SITE_URL",
];
const { execSync } = await import("node:child_process");
let secretList = "";
try {
  secretList = execSync("supabase secrets list", { cwd: ROOT, encoding: "utf8" });
} catch (e) {
  secretList = e.stdout || "";
}
for (const name of required) {
  const present = secretList.includes(name);
  ok(`Secret ${name}`, present, present ? "défini" : "MANQUANT");
}

console.log("\n=== Migrations image_studio locales ===\n");
const migDir = path.join(ROOT, "supabase/migrations");
const migs = fs.readdirSync(migDir).filter((f) => f.includes("image_studio"));
ok("Migration image_studio_quota présente", migs.some((f) => f.includes("profiles_image_studio")));
console.log("  Fichiers:", migs.join(", ") || "(aucun)");

console.log("\n=== Stripe publishable key mode ===\n");
const pk = env.VITE_STRIPE_PUBLISHABLE_KEY || "";
ok("Clé publique Stripe définie", Boolean(pk));
console.log(`  Mode front: ${pk.startsWith("pk_live") ? "LIVE" : pk.startsWith("pk_test") ? "TEST" : "inconnu"}`);

console.log("");
