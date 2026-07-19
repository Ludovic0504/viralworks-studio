import { chatCompletion, messageContentToText, type ChatMessage, type ChatContentPart } from "@/bibliotheque/openai/chatgpt-client";
import type { ClothingPieceType } from "./types";

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

function normalizePieceType(value: unknown): ClothingPieceType | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "haut" || s === "top" || s === "shirt" || s === "upper") return "haut";
  if (s === "bas" || s === "bottom" || s === "pants" || s === "trousers" || s === "skirt")
    return "bas";
  if (s === "chaussures" || s === "shoes" || s === "footwear" || s === "sneakers")
    return "chaussures";
  if (
    s === "tenue_entiere" ||
    s === "tenue" ||
    s === "full_outfit" ||
    s === "outfit" ||
    s === "ensemble" ||
    s === "full"
  ) {
    return "tenue_entiere";
  }
  return null;
}

/**
 * Détecte si l’image de ref vêtement est un haut, bas, chaussures ou une tenue entière.
 */
export async function analyzeClothingRef(imageUrl: string): Promise<ClothingPieceType> {
  const userContent: ChatContentPart[] = [
    {
      type: "text",
      text: `Look at the clothing in this image. Reply with JSON only:
{"pieceType":"haut"|"bas"|"chaussures"|"tenue_entiere"}
- haut = top / shirt / jacket only
- bas = pants / skirt / shorts only
- chaussures = shoes only
- tenue_entiere = full outfit or multiple clothing pieces visible together`,
    },
    { type: "image_url", image_url: { url: imageUrl } },
  ];

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You classify clothing reference photos. Output valid JSON only with pieceType one of: haut, bas, chaussures, tenue_entiere.",
    },
    { role: "user", content: userContent },
  ];

  const response = await chatCompletion(messages, {
    model: "gpt-4o-mini",
    temperature: 0.1,
    max_tokens: 80,
  });

  const contentText = messageContentToText(response.choices[0]?.message?.content);
  const parsed = extractJsonObject(contentText);
  const pieceType = normalizePieceType(parsed?.pieceType);
  if (!pieceType) {
    throw new Error("Analyse vêtement : type manquant");
  }
  return pieceType;
}
