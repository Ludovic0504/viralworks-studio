import {
  PROMPT_TRANSLATION_GLOSSARY,
  type GlossaryCategory,
  type GlossaryEntry,
} from "./entries";

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trouve les entrées du glossaire présentes dans un texte utilisateur. */
export function findGlossaryMatchesInText(
  text: string,
  options?: { categories?: GlossaryCategory[] },
): GlossaryEntry[] {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText) return [];

  const allowedCategories = options?.categories
    ? new Set(options.categories)
    : null;

  const matches: GlossaryEntry[] = [];

  for (const entry of PROMPT_TRANSLATION_GLOSSARY) {
    if (allowedCategories && !allowedCategories.has(entry.category)) continue;

    const matched = entry.termsFr.some((term) => {
      const normalizedTerm = normalizeForMatch(term);
      if (!normalizedTerm) return false;
      return normalizedText.includes(normalizedTerm);
    });

    if (matched) matches.push(entry);
  }

  return matches;
}

/** Déduplique par id en conservant l'ordre d'apparition. */
export function mergeGlossaryMatches(...groups: GlossaryEntry[][]): GlossaryEntry[] {
  const seen = new Set<string>();
  const merged: GlossaryEntry[] = [];

  for (const group of groups) {
    for (const entry of group) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry);
    }
  }

  return merged;
}
