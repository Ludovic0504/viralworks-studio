import type { ImageStudioAspectRatio } from "./imageStudioHistory";
import {
  getImageUrlFromHistory,
  type ImageStudioHistoryItem,
} from "./imageStudioHistory";

export type ImageStudioFeedImage = {
  url: string;
  historyId?: string;
};

export type ImageStudioFeedRow = {
  id: string;
  prompt: string;
  model?: string;
  aspectRatio?: ImageStudioAspectRatio | string;
  createdAt?: string;
  images: ImageStudioFeedImage[];
  generating?: boolean;
  progress?: { current: number; total: number };
};

export const IMAGE_STUDIO_FEED_PROMPT_MAX = 140;

export function truncateFeedPrompt(
  text: string,
  max = IMAGE_STUDIO_FEED_PROMPT_MAX,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function groupHistoryIntoFeedRows(
  items: ImageStudioHistoryItem[],
): ImageStudioFeedRow[] {
  const batchMap = new Map<string, ImageStudioFeedRow>();
  const batchOrder: string[] = [];

  for (const item of items) {
    const url = getImageUrlFromHistory(item);
    if (!url) continue;

    const batchId =
      (item.metadata as { batchId?: string } | null)?.batchId?.trim() || item.id;

    if (!batchMap.has(batchId)) {
      batchOrder.push(batchId);
      batchMap.set(batchId, {
        id: batchId,
        prompt: item.input?.trim() || "",
        model: item.metadata?.imageStudioModel,
        aspectRatio: item.metadata?.aspectRatio,
        createdAt: item.created_at,
        images: [],
      });
    }

    batchMap.get(batchId)!.images.push({ url, historyId: item.id });
  }

  return batchOrder.reverse().map((batchId) => {
    const row = batchMap.get(batchId)!;
    return { ...row, images: [...row.images].reverse() };
  });
}

export function feedRowAspectClass(ratio?: string): string {
  if (ratio === "9:16") return "is-portrait";
  if (ratio === "16:9") return "is-landscape";
  return "is-square";
}
