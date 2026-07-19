import { chatCompletion, messageContentToText, type ChatMessage, type ChatContentPart } from "@/bibliotheque/openai/chatgpt-client";
import type { PersonGender, PersonTraits } from "./types";

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeGender(value: unknown): PersonGender | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (s === "homme" || s === "male" || s === "man" || s === "m") return "homme";
  if (s === "femme" || s === "female" || s === "woman" || s === "f") return "femme";
  return null;
}

function buildPhysiquePrompt(gender: PersonGender, ageRange: string, colors: string): string {
  const sexWord = gender === "homme" ? "man" : "woman";
  const age = ageRange.trim() || "adult";
  const colorBit = colors.trim() ? `, ${colors.trim()}` : "";
  return `A ${age}-year-old ${sexWord}${colorBit}`;
}

/**
 * Analyse vision de l’avatar : genre, âge approximatif, couleurs / apparence.
 */
export async function analyzePersonFromImage(imageUrl: string): Promise<PersonTraits> {
  const userContent: ChatContentPart[] = [
    {
      type: "text",
      text: `Analyze the main person in this image. Reply with JSON only, no markdown:
{"gender":"homme"|"femme","ageRange":"string like 20-25 or 30s","colors":"short English description of skin tone, hair color, notable appearance"}`,
    },
    { type: "image_url", image_url: { url: imageUrl } },
  ];

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You analyze people in photos for image generation. Output valid JSON only. gender must be homme or femme.",
    },
    { role: "user", content: userContent },
  ];

  const response = await chatCompletion(messages, {
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 200,
  });

  const contentText = messageContentToText(response.choices[0]?.message?.content);
  const parsed = extractJsonObject(contentText);
  if (!parsed) {
    throw new Error("Analyse personne : réponse invalide");
  }

  const gender = normalizeGender(parsed.gender);
  if (!gender) {
    throw new Error("Analyse personne : genre manquant");
  }

  const ageRange = String(parsed.ageRange ?? "").trim() || "25-35";
  const colors = String(parsed.colors ?? "").trim() || "natural skin tone";

  return {
    gender,
    ageRange,
    colors,
    physiquePrompt: buildPhysiquePrompt(gender, ageRange, colors),
  };
}

export function buildPersonTraitsFromFallback(input: {
  gender: PersonGender;
  ageRange: string;
  colors: string;
}): PersonTraits {
  const ageRange = input.ageRange.trim() || "25-35";
  const colors = input.colors.trim() || "natural skin tone";
  return {
    gender: input.gender,
    ageRange,
    colors,
    physiquePrompt: buildPhysiquePrompt(input.gender, ageRange, colors),
    fromFallback: true,
  };
}
