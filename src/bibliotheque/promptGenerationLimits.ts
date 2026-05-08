/**
 * Limites communes pour la génération de prompts (script / vidéo).
 * À garder aligné avec netlify/functions/generate-prompt.js (valeurs numériques).
 */

/** Taille max du texte « idée » envoyé au modèle (caractères) */
export const PROMPT_GEN_MAX_IDEA_CHARS = 12000;

/** Taille max du prompt généré (caractères) — troncature côté app + serveur */
export const PROMPT_GEN_MAX_OUTPUT_CHARS = 1500;

/** Complétion OpenAI — reste sous ~1500 caractères en pratique */
export const PROMPT_GEN_MAX_COMPLETION_TOKENS = 480;

export const PROMPT_GEN_TEMPERATURE_CONSTRAINED = 0.52;

/**
 * Bloc injecté dans les system prompts (script assistant) : fidélité à l’idée + bornes de verbosité.
 */
export const SCRIPT_PROMPT_THEME_AND_LIMITS_EN = `
THEMATIC DISCIPLINE AND HARD LIMITS (mandatory):
- Base every section ONLY on the user idea. Do not introduce new main subjects, brands, products, or locations not clearly implied by that idea.
- One coherent scene aligned with the idea. No sequels, no "part two", no alternate endings, no extra sketches.
- No preamble or postscript, no markdown code fences, no JSON, no hashtags, no tips to the creator, no pricing or CTAs.
- HARD CEILING: your ENTIRE response must be at most 1500 characters (including labels and newlines). Count mentally and stop before exceeding; prefer shorter sentences everywhere.
- Within that ceiling: [Ton idée] at most ~35 words; Style, Camera, Lighting, Environment each 1–2 very short sentences; Tone one short sentence; dialogue one short line.
- If you risk exceeding 1500 characters, shorten further; never omit a required labeled section.
- Finish_reason must not require continuation: the output must be self-contained within these limits.`;

export function clampGeneratedPrompt(
  text: string,
  maxChars: number = PROMPT_GEN_MAX_OUTPUT_CHARS
): string {
  const t = (text || "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars).trimEnd()}\n\n[… tronqué à la limite ${maxChars} caractères …]`;
}

export function validateIdeaLength(idea: string): { ok: true } | { ok: false; message: string } {
  const s = (idea || "").trim();
  if (s.length < 8) {
    return {
      ok: false,
      message: "L’idée doit contenir au moins 8 caractères.",
    };
  }
  if (s.length > PROMPT_GEN_MAX_IDEA_CHARS) {
    return {
      ok: false,
      message: `Texte trop long pour la génération (max ${PROMPT_GEN_MAX_IDEA_CHARS} caractères). Raccourcis ton idée ou le script.`,
    };
  }
  return { ok: true };
}
