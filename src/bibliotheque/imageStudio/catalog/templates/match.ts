import type { ImageStudioTemplateCatalogEntry } from "./types";
import { IMAGE_STUDIO_TEMPLATE_CATALOG } from "./buildCatalog";

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score de correspondance intent → template (préparation étape 3). */
export function scoreTemplateIntentMatch(
  entry: ImageStudioTemplateCatalogEntry,
  text: string,
): number {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) return 0;

  let score = 0;
  for (const tag of entry.intentTagsFr) {
    const normalizedTag = normalizeForMatch(tag);
    if (!normalizedTag) continue;
    if (normalizedText.includes(normalizedTag)) score += 1;
  }

  return score;
}

/** Templates dont au moins un tag d'intention est présent dans le texte. */
export function findTemplateCatalogMatchesInText(
  text: string,
  options?: { minScore?: number },
): ImageStudioTemplateCatalogEntry[] {
  const minScore = options?.minScore ?? 1;

  return IMAGE_STUDIO_TEMPLATE_CATALOG.filter(
    (entry) => scoreTemplateIntentMatch(entry, text) >= minScore,
  ).sort(
    (left, right) => scoreTemplateIntentMatch(right, text) - scoreTemplateIntentMatch(left, text),
  );
}
