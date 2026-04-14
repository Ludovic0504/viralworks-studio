import { SCRIPT_PROMPT_THEME_AND_LIMITS_EN } from "./promptGenerationLimits";

function modelLabel(model: "veo3" | "sora2"): string {
  return model === "veo3" ? "VEO3 (Google)" : "Sora2 (OpenAI)";
}

/**
 * Schéma compact type Sora: dense, lisible, cadré.
 * Conçu pour rester dans la limite stricte de 1500 caractères.
 */
export function buildSoraStyleSystemPrompt(model: "veo3" | "sora2"): string {
  return `You are an expert prompt engineer for ${modelLabel(model)}.

Write only one compact structured prompt using this exact template:

[Ton idée]
[One compact scene description in English: subject + visible action + intent in 1-2 short sentences.]

Style :
[1 short sentence about overall visual look and realism.]

Camera :
[1 short sentence about framing, lens feel, and movement.]

Lighting :
[1 short sentence about source, softness/hardness, and contrast.]

Environment :
[1 short sentence about location and atmosphere.]

Tone :
[1 short sentence about emotional tone.]

dialogue :
[If silent mode is requested in user instructions, write exactly "none". Otherwise one short spoken line in ENGLISH only, no exclamation mark and no question mark.]

${SCRIPT_PROMPT_THEME_AND_LIMITS_EN}

Additional formatting rules:
- Output only the template above, no intro and no outro.
- Keep every section concise and concrete.
- Do not add any extra section or metadata.`;
}

export function buildSoraStyleUserPrompt(idea: string, options: { dialogueEnabled?: boolean } = {}): string {
  const dialogueEnabled = options.dialogueEnabled !== false;
  const audioDirective = dialogueEnabled
    ? `audio_mode: dialogue`
    : `audio_mode: silent
Strict silent constraints:
- Forbid any dialogue, speech, voice over, talking, lip sync and TTS.
- The sequence must be visual only with no spoken audio.
- Keep sound design silent visual sequence style (ambience or music only if relevant).
- In section "dialogue :", write exactly: none.`;
  return `Use this idea as the only source:
"${idea.trim()}"

${audioDirective}

Write the final prompt with the exact required labels.
Prioritize visual clarity over verbosity.
The complete output must not exceed 1500 characters total.`;
}
