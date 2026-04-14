import fs from "node:fs";
import path from "node:path";

function loadDotEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let raw = fs.readFileSync(filePath, "utf8");
  // Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Always override from .env.* files for deterministic local checks
    process.env[key] = val;
  }
}

// Charger .env.local / .env si présents (utile hors Vite)
const cwd = process.cwd();
loadDotEnvFile(path.join(cwd, ".env.local"));
loadDotEnvFile(path.join(cwd, ".env"));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(2);
}

const base = supabaseUrl.replace(/\/+$/, "");

const tables = {
  profiles: [
    "user_id",
    "email",
    "full_name",
    "first_name",
    "last_name",
    "job",
    "birth_date",
    "avatar_url",
    "created_at",
    "updated_at",
    "role",
  ],
  user_credits: ["user_id", "credits", "created_at", "updated_at"],
  credit_transactions: ["user_id", "amount", "type", "reason", "metadata", "created_by", "created_at"],
  stripe_customers: ["user_id", "stripe_customer_id", "email"],
  stripe_payments: ["user_id", "stripe_session_id", "stripe_customer_id", "amount", "currency", "status", "metadata", "created_at", "updated_at"],
  stripe_subscriptions: [
    "user_id",
    "stripe_subscription_id",
    "stripe_customer_id",
    "status",
    "current_period_start",
    "current_period_end",
    "cancel_at_period_end",
    "created_at",
    "updated_at",
  ],
  history: ["id", "user_id", "kind", "input", "output", "model", "metadata", "created_at"],
  nouveautes: [
    "id",
    "title",
    "description",
    "type",
    "category",
    "redirect_path",
    "redirect_label",
    "icon_name",
    "is_active",
    "created_by",
    "created_at",
    "updated_at",
    "published_at",
  ],
};

async function checkTable(table, cols) {
  const url = `${base}/rest/v1/${table}?select=${encodeURIComponent(cols.join(","))}&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // ignore
  }
  return { table, ok: res.ok, status: res.status, body };
}

const results = [];
for (const [table, cols] of Object.entries(tables)) {
  // eslint-disable-next-line no-await-in-loop
  results.push(await checkTable(table, cols));
}

const summary = results.map((r) => ({
  table: r.table,
  ok: r.ok,
  status: r.status,
  error:
    r.ok
      ? null
      : typeof r.body === "object"
        ? r.body?.message || r.body?.error || JSON.stringify(r.body)
        : String(r.body).slice(0, 300),
}));

console.log(JSON.stringify(summary, null, 2));
