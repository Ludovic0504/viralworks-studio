/**
 * Tests manuels des Edge Functions de modération des prénoms/noms.
 * Usage : node scripts/test-name-moderation-production.mjs
 * Requiert VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans l'environnement ou .env local.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const baseUrl = (process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!baseUrl || !anonKey) {
  console.error("Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (fichier .env ou variables d'environnement).");
  process.exit(1);
}

async function callValidate(firstName, lastName) {
  const res = await fetch(`${baseUrl}/functions/v1/validate-display-name`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ firstName, lastName }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function callAuthHook(firstName, lastName, hookSecret) {
  const res = await fetch(`${baseUrl}/functions/v1/auth-before-user-created`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(hookSecret ? { "x-hook-secret": hookSecret } : {}),
    },
    body: JSON.stringify({
      metadata: { name: "before-user-created" },
      user: {
        email: "test-hook@example.com",
        user_metadata: { first_name: firstName, last_name: lastName },
      },
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function callAuthHookGoogle(fullName, hookSecret) {
  const res = await fetch(`${baseUrl}/functions/v1/auth-before-user-created`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(hookSecret ? { "x-hook-secret": hookSecret } : {}),
    },
    body: JSON.stringify({
      metadata: { name: "before-user-created" },
      user: {
        email: "google-test@example.com",
        raw_user_meta_data: { full_name: fullName, name: fullName },
      },
    }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const cases = [
  { label: "Toxique (Hitler)", firstName: "Hitler", lastName: "", expectBlocked: true },
  { label: "Insulte (Connard)", firstName: "Connard", lastName: "", expectBlocked: true },
  { label: "Normal (Marie Dupont)", firstName: "Marie", lastName: "Dupont", expectBlocked: false },
  { label: "Leetspeak (H1tl3r)", firstName: "H1tl3r", lastName: "", expectBlocked: true },
];

console.log("=== validate-display-name (production) ===\n");
let failed = 0;

for (const testCase of cases) {
  const { status, body } = await callValidate(testCase.firstName, testCase.lastName);
  const blocked = status === 400 || body?.ok === false;
  const ok = blocked === testCase.expectBlocked;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK" : "ECHEC"} | ${testCase.label}`);
  console.log(`     HTTP ${status} | bloqué=${blocked}`);
  if (!ok) console.log(`     Réponse:`, body);
}

const hookSecret = (process.env.AUTH_HOOK_SECRET || "").trim();
console.log("\n=== auth-before-user-created (simulation Google/email) ===\n");

if (!hookSecret) {
  console.log("INFO: AUTH_HOOK_SECRET non défini localement — tests hook ignorés (configure le secret dans .env pour les lancer).");
} else {
  const hookCases = [
    { label: "Email Hitler", fn: () => callAuthHook("Hitler", "", hookSecret), expectBlocked: true },
    { label: "Email normal", fn: () => callAuthHook("Marie", "Dupont", hookSecret), expectBlocked: false },
    { label: "Google full_name Hitler", fn: () => callAuthHookGoogle("Adolf Hitler", hookSecret), expectBlocked: true },
    { label: "Google full_name normal", fn: () => callAuthHookGoogle("Marie Dupont", hookSecret), expectBlocked: false },
  ];

  for (const testCase of hookCases) {
    const { status, body } = await testCase.fn();
    const blocked = status === 400;
    const ok = blocked === testCase.expectBlocked;
    if (!ok) failed += 1;
    console.log(`${ok ? "OK" : "ECHEC"} | ${testCase.label}`);
    console.log(`     HTTP ${status} | bloqué=${blocked}`);
    if (!ok) console.log(`     Réponse:`, body);
  }
}

console.log(`\n${failed === 0 ? "Tous les tests exécutés ont réussi." : `${failed} test(s) en échec.`}`);
process.exit(failed === 0 ? 0 : 1);
