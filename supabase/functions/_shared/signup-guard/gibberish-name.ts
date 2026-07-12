const CJK_OR_JAPANESE_OR_KOREAN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

const LATIN_NAME_CHARS = /^[\p{L}\p{M}' -]+$/u;

function vowelRatio(text: string): number {
  const letters = text.match(/[\p{L}]/gu) || [];
  if (!letters.length) return 0;
  const vowels = letters.filter((ch) => /[aeiouyàâäéèêëïîôùûüæœ]/i.test(ch)).length;
  return vowels / letters.length;
}

/** Heuristique anti-bot : noms aléatoires, tokens, chiffres, etc. */
export function looksLikeGibberishName(name: string): boolean {
  const raw = name.trim();
  if (!raw) return true;
  if (raw.length < 2) return true;
  if (raw.length > 40) return true;

  if (CJK_OR_JAPANESE_OR_KOREAN.test(raw)) return false;

  if (/\d/.test(raw)) return true;
  if (/[^a-zA-ZÀ-ÿ' -]/.test(raw)) return true;
  if (!LATIN_NAME_CHARS.test(raw)) return true;

  const lower = raw.toLowerCase();
  if (/(.)\1{3,}/.test(lower)) return true;

  const lettersOnly = lower.replace(/[^a-zàâäéèêëïîôùûü]/g, "");
  if (lettersOnly.length >= 6 && vowelRatio(lettersOnly) < 0.12) return true;

  // Token aléatoire sans espace : mélange consonne/voyelle atypique
  if (!raw.includes(" ") && lettersOnly.length >= 8) {
    const ratio = vowelRatio(lettersOnly);
    if (ratio < 0.2 || ratio > 0.85) return true;
  }

  return false;
}
