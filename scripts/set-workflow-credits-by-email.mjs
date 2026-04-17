/**
 * Met à jour le solde workflow (table public.user_credits) pour un utilisateur.
 * Nécessite la clé service_role (Dashboard Supabase → Project Settings → API).
 *
 * Usage:
 *   $env:SERVICE_ROLE_KEY='...'; node scripts/set-workflow-credits-by-email.mjs email@example.com 0
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    out[k] = v;
  }
  return out;
}

async function findUserIdByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => String(x.email || "").toLowerCase() === email);
    if (u) return u.id;
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  const credits = Number.parseInt(String(process.argv[3] ?? "0"), 10);
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/set-workflow-credits-by-email.mjs <email> <credits>");
    process.exit(2);
  }
  if (!Number.isFinite(credits) || credits < 0) {
    console.error("credits doit être un entier >= 0");
    process.exit(2);
  }

  const env = {
    ...readEnvFile(".env"),
    ...readEnvFile(".env.local"),
  };
  const url = String(env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
  const serviceKey =
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!url) {
    console.error("Variable manquante: VITE_SUPABASE_URL ou SUPABASE_URL (fichier .env.local à la racine du projet).");
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      "Variable manquante: SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY (clé « service_role » du dashboard Supabase, pas la clé anon)."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await findUserIdByEmail(supabase, email);
  if (!userId) {
    console.error(`Aucun utilisateur auth avec l’email: ${email}`);
    process.exit(1);
  }

  const { data: existing, error: selErr } = await supabase
    .from("user_credits")
    .select("user_id, credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing) {
    const { error: upErr } = await supabase.from("user_credits").update({ credits }).eq("user_id", userId);
    if (upErr) throw upErr;
  } else {
    const { error: insErr } = await supabase.from("user_credits").insert({ user_id: userId, credits });
    if (insErr) throw insErr;
  }

  console.log(`OK user_credits mis à jour pour ${email} → ${credits} (workflow).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
