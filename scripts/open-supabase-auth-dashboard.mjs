/**
 * Ouvre le dashboard Supabase (SMTP + auth) pour le project ref dérivé de VITE_SUPABASE_URL.
 * Lit .env.local puis .env à la racine du repo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readViteSupabaseUrl() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const m = text.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$/m);
    if (m) {
      return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

const viteUrl = readViteSupabaseUrl();
if (!viteUrl) {
  console.error("VITE_SUPABASE_URL introuvable dans .env.local ou .env");
  process.exit(1);
}

let ref;
try {
  ref = new URL(viteUrl).hostname.split(".")[0];
} catch {
  console.error("VITE_SUPABASE_URL invalide:", viteUrl);
  process.exit(1);
}

if (!ref || ref === "placeholder") {
  console.error("Project ref invalide (placeholder ?)");
  process.exit(1);
}

const smtp = `https://supabase.com/dashboard/project/${ref}/auth/smtp`;
const urls = `https://supabase.com/dashboard/project/${ref}/auth/url-configuration`;

console.log("Ouverture navigateur :");
console.log(" ", smtp);
console.log(" ", urls);

const open = process.platform === "win32" ? `start "" "${smtp}"` : `open "${smtp}"`;
exec(open, (err) => {
  if (err) console.error(err);
});
