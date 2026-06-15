import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(import.meta.dirname, "..");
function parse(f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) return {};
  const o = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    o[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return o;
}
const env = { ...parse(".env"), ...parse(".env.local"), ...parse(".env.production") };
const pk = env.VITE_STRIPE_PUBLISHABLE_KEY || "";
const ftp = env.FTP_PASSWORD || "";
console.log(JSON.stringify({
  stripeKey: pk ? `${pk.startsWith("pk_live") ? "live" : pk.startsWith("pk_test") ? "test" : "?"} len=${pk.length}` : "absent",
  hasFtp: Boolean(ftp),
  siteUrl: env.VITE_SITE_URL || "",
}));
