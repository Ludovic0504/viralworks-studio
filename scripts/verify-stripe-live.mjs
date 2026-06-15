import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
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

function digest(v) {
  return createHash("sha256").update(v).digest("hex");
}

function ok(label, pass, detail = "") {
  console.log(`${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
const pk = env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const pkMode = pk.startsWith("pk_live") ? "live" : pk.startsWith("pk_test") ? "test" : "inconnu";

console.log("\n=== Alignement Stripe LIVE ===\n");

let secretList = "";
try {
  secretList = execSync("supabase secrets list", { cwd: ROOT, encoding: "utf8" });
} catch (e) {
  secretList = e.stdout || "";
}

const modeLine = secretList
  .split("\n")
  .find((l) => l.includes("STRIPE_MODE"));
const modeDigest = modeLine?.split("|")[1]?.trim() ?? "";
const serverMode =
  modeDigest === digest("live")
    ? "live"
    : modeDigest === digest("test")
      ? "test"
      : "inconnu";

ok("Supabase STRIPE_MODE = live", serverMode === "live", `détecté: ${serverMode}`);
ok("STRIPE_SECRET_KEY présent (utilisé en live)", secretList.includes("STRIPE_SECRET_KEY"));
ok(
  "STRIPE_WEBHOOK_SECRET présent (webhooks live)",
  secretList.includes("STRIPE_WEBHOOK_SECRET"),
);
ok("STRIPE_PRICE_IMAGE_9", secretList.includes("STRIPE_PRICE_IMAGE_9"), secretList.includes("STRIPE_PRICE_IMAGE_9") ? "défini" : "MANQUANT — fallback prix dynamique 9€");
ok("STRIPE_PRICE_PRO_59", secretList.includes("STRIPE_PRICE_PRO_59"));

console.log(`\n  Front local VITE_STRIPE_PUBLISHABLE_KEY: ${pkMode}`);
if (serverMode === "live" && pkMode === "test") {
  console.log(
    "  ⚠️  En local tu as encore pk_test — OK pour dev, mais les vrais paiements live passent par la prod (pk_live).",
  );
} else if (serverMode === "live" && pkMode === "live") {
  ok("Front et serveur alignés en LIVE", true);
}

console.log("");
