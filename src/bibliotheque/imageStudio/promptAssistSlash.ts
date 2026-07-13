export const PROMPT_ASSIST_SLASH_COMMAND = "/promptassist";

export type PromptAssistSlashMatch = {
  replaceStart: number;
  replaceEnd: number;
};

/** Détecte `/promptassist` juste avant le curseur (insensible à la casse). */
export function detectPromptAssistSlash(
  value: string,
  caretIndex: number,
): PromptAssistSlashMatch | null {
  const before = value.slice(0, caretIndex);
  const match = before.match(/\/promptassist$/i);
  if (!match) return null;

  return {
    replaceStart: caretIndex - match[0].length,
    replaceEnd: caretIndex,
  };
}

export function stripPromptAssistSlash(
  value: string,
  match: PromptAssistSlashMatch,
): string {
  return `${value.slice(0, match.replaceStart)}${value.slice(match.replaceEnd)}`;
}
