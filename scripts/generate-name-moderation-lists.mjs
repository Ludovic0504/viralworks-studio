import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "../supabase/functions/_shared/name-moderation");

const badwords = fs
  .readFileSync(path.join(dir, "badwords-fr-merged.txt"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const toxic = JSON.parse(fs.readFileSync(path.join(dir, "toxic-personalities.json"), "utf8"));

const output = `// Fichier généré — ne pas éditer à la main.
// Regénérer : node scripts/generate-name-moderation-lists.mjs

export const BADWORDS_FR: string[] = ${JSON.stringify(badwords, null, 2)};

export const TOXIC_PERSONALITIES: string[] = ${JSON.stringify(toxic, null, 2)};
`;

fs.writeFileSync(path.join(dir, "lists-data.ts"), output);
console.log(`lists-data.ts régénéré (${badwords.length} insultes, ${toxic.length} entrées toxiques).`);
