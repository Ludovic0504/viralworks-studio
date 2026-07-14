import type { ImageStudioTemplateCatalogEntry } from "./types";
import { IMAGE_STUDIO_TEMPLATE_CATALOG } from "./buildCatalog";

const MENTION_HINT_LABELS = {
  produit: "@Produit pour l'image jointe (apparence produit)",
  image1: "@Image1 pour une seconde référence visuelle",
  garment: "@Produit pour chaque vêtement uploadé (lookbook)",
  optional: "mention image optionnelle",
} as const;

function formatVariables(entry: ImageStudioTemplateCatalogEntry): string {
  const lines = entry.variables.map((variable) => {
    const required = variable.required ? "requis" : "optionnel";
    return `  - ${variable.key} (${variable.labelFr}, ${required}) : ${variable.roleFr}`;
  });
  return lines.join("\n");
}

function formatCatalogEntry(entry: ImageStudioTemplateCatalogEntry): string {
  const tags = entry.intentTagsFr.slice(0, 8).join(" · ");
  return `### ${entry.id} — ${entry.labelFr}
Résumé : ${entry.summaryFr}
Intentions FR : ${tags}
Focus prompt EN : ${entry.promptFocusEn}
Image : ${MENTION_HINT_LABELS[entry.mentionHint]}
Variables :
${formatVariables(entry)}`;
}

/** Bloc compact injecté dans le system prompt du Prompt Assistant (étape 2). */
export function buildPromptAssistCatalogBlock(): string {
  return IMAGE_STUDIO_TEMPLATE_CATALOG.map(formatCatalogEntry).join("\n\n");
}
