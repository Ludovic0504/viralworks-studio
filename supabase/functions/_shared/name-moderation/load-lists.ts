import { normalizeDisplayName } from "./normalize.ts";
import { BADWORDS_FR, TOXIC_PERSONALITIES } from "./lists-data.ts";

let badwordsCache: Set<string> | null = null;
let toxicCache: Set<string> | null = null;

function buildNormalizedSet(entries: string[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeDisplayName(entry);
    if (normalized) set.add(normalized);
  }
  return set;
}

export function getBadwordsSet(): Set<string> {
  if (!badwordsCache) {
    badwordsCache = buildNormalizedSet(BADWORDS_FR);
  }
  return badwordsCache;
}

export function getToxicPersonalitiesSet(): Set<string> {
  if (!toxicCache) {
    toxicCache = buildNormalizedSet(TOXIC_PERSONALITIES);
  }
  return toxicCache;
}
