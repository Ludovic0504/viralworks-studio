export const PROMPT_ASSIST_PROMPT_INTRO = "Tu peux utiliser ça :";

/** Intro affichée quand le message contient un prompt final. */
export function formatPromptAssistIntro(intro: string | null, hasPrompt: boolean): string | null {
  if (!hasPrompt) return intro;
  return PROMPT_ASSIST_PROMPT_INTRO;
}

export type ParsedPromptAssistMessage = {
  intro: string | null;
  prompt: string | null;
  outro: string | null;
  plain: string | null;
};

export function extractPromptFromAssistantText(text: string): string | null {
  const tagged = text.match(/<prompt>([\s\S]*?)<\/prompt>/i);
  return tagged?.[1]?.trim() ?? null;
}

/** Découpe le message assistant en intro, prompt final et note de fin. */
export function parsePromptAssistAssistantMessage(text: string): ParsedPromptAssistMessage {
  const prompt = extractPromptFromAssistantText(text);
  if (!prompt) {
    return {
      intro: null,
      prompt: null,
      outro: null,
      plain: text.trim() || null,
    };
  }

  const match = text.match(/<prompt>[\s\S]*?<\/prompt>/i);
  const tagStart = match?.index ?? -1;
  const tagEnd = tagStart >= 0 ? tagStart + match![0].length : text.length;

  return {
    intro: text.slice(0, tagStart).trim() || null,
    prompt,
    outro: text.slice(tagEnd).trim() || null,
    plain: null,
  };
}

/** Affiche le prompt en lignes lisibles (séparateurs « + » ou retours à la ligne). */
export function splitPromptForDisplay(prompt: string): string[] {
  const normalized = prompt.replace(/\s*\n+\s*/g, "\n").trim();
  if (!normalized) return [];

  if (normalized.includes("\n")) {
    return normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (/\s+\+\s+/.test(normalized)) {
    return normalized
      .split(/\s+\+\s+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  return [normalized];
}
