import { getBadwordsSet, getToxicPersonalitiesSet } from "./load-lists.ts";
import { normalizeDisplayName } from "./normalize.ts";

/** Mots alphanumériques (lettres unicode, chiffres, @ pour leetspeak). */
const WORD_PATTERN = /[\p{L}\p{N}@]+/gu;

/** Correspondance exacte sur le token (chat) — évite le scan O(n) des listes à chaque mot. */
function isBlockedMessageToken(
  token: string,
  badwords: Set<string>,
  toxic: Set<string>,
): boolean {
  const normalized = normalizeDisplayName(token);
  if (!normalized) return false;
  return toxic.has(normalized) || badwords.has(normalized);
}

/**
 * Remplace les mots interdits par autant d'étoiles que de caractères du mot original.
 * La ponctuation et les espaces sont conservés.
 */
export function censorMessageText(
  text: string,
  badwords = getBadwordsSet(),
  toxic = getToxicPersonalitiesSet(),
): string {
  if (!text) return text;

  return text.replace(WORD_PATTERN, (word) => {
    if (isBlockedMessageToken(word, badwords, toxic)) {
      return "*".repeat(word.length);
    }
    return word;
  });
}
