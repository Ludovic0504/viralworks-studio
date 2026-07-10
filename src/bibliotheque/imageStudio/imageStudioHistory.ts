import { listHistory, saveHistory } from "@/bibliotheque/supabase/historique";

export type ImageStudioGenerationRefs = {
  avatarUrl?: string | null;
  productUrl?: string | null;
  importedRefUrl?: string | null;
};

export type ImageStudioHistoryItem = {
  id: string;
  input?: string | null;
  output?: string | null;
  metadata?: {
    source?: string;
    aspectRatio?: string;
    imageStudioModel?: string;
    batchId?: string;
    urls?: string[];
    generationRefs?: ImageStudioGenerationRefs | null;
  } | null;
  created_at?: string;
};

export type ImageStudioAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

/** Plafond de sécurité pour l'affichage (toutes les générations Image Studio de l'utilisateur). */
const HISTORY_LIST_LIMIT = 1000;

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
  limit = HISTORY_LIST_LIMIT,
): Promise<ImageStudioHistoryItem[]> {
  const rows = await listHistory({
    kind: "image",
    limit,
    metadataSource: "image_studio",
  });
  return rows as ImageStudioHistoryItem[];
}

export async function saveImageStudioHistory(
  prompt: string,
  url: string,
  aspectRatio: ImageStudioAspectRatio,
  model?: string,
  batchId?: string,
  generationRefs?: ImageStudioGenerationRefs | null,
): Promise<void> {
  await saveHistory({
    kind: "image",
    input: prompt,
    output: url,
    model: model ?? "nano_banana_pro",
    metadata: {
      source: "image_studio",
      aspectRatio,
      imageStudioModel: model,
      ...(batchId ? { batchId } : {}),
      ...(generationRefs ? { generationRefs } : {}),
      urls: [url],
    },
  });
}

export function getGenerationRefsFromHistory(
  item: ImageStudioHistoryItem | null | undefined,
): ImageStudioGenerationRefs {
  const refs = item?.metadata?.generationRefs;
  if (!refs || typeof refs !== "object") return {};
  return {
    avatarUrl: typeof refs.avatarUrl === "string" ? refs.avatarUrl : null,
    productUrl: typeof refs.productUrl === "string" ? refs.productUrl : null,
    importedRefUrl:
      typeof refs.importedRefUrl === "string" ? refs.importedRefUrl : null,
  };
}

export function findHistoryItemById(
  history: ImageStudioHistoryItem[],
  id: string | null | undefined,
): ImageStudioHistoryItem | null {
  if (!id) return null;
  return history.find((item) => item.id === id) ?? null;
}

export function findHistoryItemForImage(
  history: ImageStudioHistoryItem[],
  options: { historyId?: string | null; url?: string | null },
): ImageStudioHistoryItem | null {
  const byId = findHistoryItemById(history, options.historyId);
  if (byId) return byId;
  const url = typeof options.url === "string" ? options.url.trim() : "";
  if (!url) return null;
  return (
    history.find((item) => {
      const output = typeof item.output === "string" ? item.output.trim() : "";
      const metaUrl = item.metadata?.urls?.[0];
      return output === url || metaUrl === url;
    }) ?? null
  );
}
