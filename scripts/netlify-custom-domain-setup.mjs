/**
 * Configure le domaine personnalisé sur le site Netlify « viralworks-studio » (API REST).
 * Lit le jeton du Netlify CLI : %APPDATA%\\netlify\\Config\\config.json
 *
 * Usage : node scripts/netlify-custom-domain-setup.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const siteId = "d9b9d6c4-e37d-464d-8da5-319b9b4af2a6"
const apex = "viralworks-studio.com"
const www = `www.${apex}`

const cfgPath = join(homedir(), "AppData", "Roaming", "netlify", "Config", "config.json")
if (!existsSync(cfgPath)) {
  console.error("Config Netlify introuvable:", cfgPath, "\nLance: npx netlify-cli login")
  process.exit(1)
}
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"))
const token = cfg.users?.[cfg.userId]?.auth?.token
if (!token) {
  console.error("Jeton Netlify introuvable.")
  process.exit(1)
}

const url = `https://api.netlify.com/api/v1/sites/${siteId}`
const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    custom_domain: apex,
    domain_aliases: [www],
  }),
})
const text = await res.text()
if (!res.ok) {
  console.error("Erreur API", res.status, text)
  process.exit(1)
}

console.log("Domaines Netlify configurés :")
console.log("  -", apex, "(principal)")
console.log("  -", www, "(alias)")
console.log("")
console.log("Suite : mets à jour la zone DNS chez OVH, puis dans Netlify :")
console.log("  https://app.netlify.com/projects/viralworks-studio/domain-management")
console.log("Vérifie « Pending DNS verification » pour les valeurs exactes (A + CNAME www).")
console.log("Le certificat HTTPS sera provisionné après propagation DNS.")
