/**
 * Génère les icônes PWA à partir de public/logo.png.
 *
 * Usage (depuis la racine du projet) :
 *   node scripts/generate-pwa-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const sourcePath = path.join(publicDir, "logo.png");

const PWA_ICON_BG = { r: 12, g: 17, b: 22 }; // #0C1116

const outputs = [
  { file: "pwa-192x192.png", size: 192 },
  { file: "pwa-512x512.png", size: 512 },
];

if (!fs.existsSync(sourcePath)) {
  console.error(`Source introuvable : ${sourcePath}`);
  process.exit(1);
}

for (const { file, size } of outputs) {
  const dest = path.join(publicDir, file);
  await sharp(sourcePath)
    .flatten({ background: PWA_ICON_BG })
    .resize(size, size, { fit: "contain", background: PWA_ICON_BG })
    .png()
    .toFile(dest);
  console.log(`OK ${file} (${size}x${size})`);
}

console.log("Icônes PWA générées dans public/.");
