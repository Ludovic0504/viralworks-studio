import { listHistory, saveHistory } from "@/bibliotheque/supabase/historique";

export type ImageStudioHistoryItem = {
  id: string;
  input?: string | null;
  output?: string | null;
  metadata?: {
    source?: string;
    aspectRatio?: string;
    urls?: string[];
  } | null;
  created_at?: string;
};

export type ImageStudioAspectRatio = "1:1" | "9:16" | "16:9";

const HISTORY_LIMIT = 12;

export function getImageUrlFromHistory(item: ImageStudioHistoryItem): string | null {
  const fromOutput = typeof item?.output === "string" ? item.output.trim() : "";
  if (fromOutput) return fromOutput;
  const urls = item?.metadata?.urls;
  if (Array.isArray(urls) && typeof urls[0] === "string" && urls[0].trim()) {
    return urls[0].trim();
  }
  return null;
}

export async function listImageStudioHistory(
  limit = HISTORY_LIMIT,
): Promise<ImageStudioHistoryItem[]> {
  const rows = await listHistory({ kind: "image", limit: limit * 4 });
  return rows
    .filter((item) => item.metadata?.source === "image_studio")
    .slice(0, limit) as ImageStudioHistoryItem[];
}

export async function saveImageStudioHistory(
  prompt: string,
  url: string,
  aspectRatio: ImageStudioAspectRatio,
  model?: string,
): Promise<void> {
  await saveHistory({
    kind: "image",
    input: prompt,
    output: url,
    model: model ?? "nano-banana-pro",
    metadata: {
      source: "image_studio",
      aspectRatio,
      imageStudioModel: model,
      urls: [url],
    },
  });
}
