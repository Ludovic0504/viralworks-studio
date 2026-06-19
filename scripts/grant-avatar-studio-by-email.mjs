/**
 * Accorde l'accès Avatar Studio + quota mensuel pour un utilisateur (test / prod).
 *
 * Usage:
 *   node scripts/grant-avatar-studio-by-email.mjs --email jeanlmt.pro@gmail.com --remaining 3
 *
 * Requiert SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (ou .env.local).
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const AVATAR_STUDIO_MONTHLY_LIMIT = 5;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let email = "";
  let remaining = 3;
  let asTester = true;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    if (args[i] === "--remaining" && args[i + 1]) remaining = Number(args[++i]);
    if (args[i] === "--no-tester") asTester = false;
  }

  return { email: email.trim().toLowerCase(), remaining, asTester };
}

async function findUserIdByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((row) => String(row.email || "").toLowerCase() === email);
    if (user) return user;
    if (!data.users.length || data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main() {
  const { email, remaining, asTester } = parseArgs();
  if (!email || !email.includes("@")) {
    console.error(
      "Usage: node scripts/grant-avatar-studio-by-email.mjs --email user@example.com [--remaining 3]",
    );
    process.exit(2);
  }
  if (!Number.isFinite(remaining) || remaining < 1 || remaining > AVATAR_STUDIO_MONTHLY_LIMIT) {
    console.error(`--remaining doit être entre 1 et ${AVATAR_STUDIO_MONTHLY_LIMIT}`);
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

  if (!url || !serviceKey) {
    console.error("Variables manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const user = await findUserIdByEmail(admin, email);
  if (!user) {
    console.error(`Aucun utilisateur auth avec l'email: ${email}`);
    process.exit(1);
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const consumedCount = AVATAR_STUDIO_MONTHLY_LIMIT - remaining;

  const patch = {
    avatar_studio_count: consumedCount,
    avatar_studio_reset_at: monthStart.toISOString(),
  };
  if (asTester) patch.is_tester = true;

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .update(patch)
    .eq("user_id", user.id)
    .select("user_id, email, is_tester, avatar_studio_count, avatar_studio_reset_at")
    .maybeSingle();

  if (profileErr) throw profileErr;
  if (!profile) {
    console.error(`Profil introuvable pour user_id=${user.id}`);
    process.exit(1);
  }

  console.log("OK Avatar Studio configuré:");
  console.log({
    email: profile.email ?? email,
    user_id: user.id,
    is_tester: profile.is_tester,
    avatar_studio_count: profile.avatar_studio_count,
    remaining_this_month: remaining,
    monthly_limit: AVATAR_STUDIO_MONTHLY_LIMIT,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
